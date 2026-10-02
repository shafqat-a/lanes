// Native JavaScript oracles execute outside the VM, only in the test harness.
import { test262Cases } from './vm-test262-cases.js';
import { runFunctionConformance } from './vm-function-cases.js';
import { runControlConformance } from './vm-control-cases.js';
import { runGCConformance } from './vm-gc-cases.js';
import { runStringConformance } from './vm-string-cases.js';
export function vmCases() {
  let seed = 0x6c616e65;
  const next = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; };
  const bits = new DataView(new ArrayBuffer(8));
  const randomNumber = () => { bits.setUint32(0, next(), true); bits.setUint32(4, next(), true); return bits.getFloat64(0, true); };
  const inputs = [0, -0, 1, -1, 0.1, -0.1, Number.MIN_VALUE, -Number.MIN_VALUE, Number.MAX_VALUE, -Number.MAX_VALUE,
    2 ** -1022, -(2 ** -1022), 2 ** -1022 - Number.MIN_VALUE, 2 ** 53, 2 ** 53 - 1, Infinity, -Infinity, NaN,
    true, false, null, undefined, ...Array.from({ length: 512 }, randomNumber)];
  const literal = x => Object.is(x, -0) ? '-0' : String(x);
  const constants = [0, -0, 1, -1, 0.1, Number.MIN_VALUE, Number.MAX_VALUE, Infinity, NaN, 1e-300, 1e300,
    2 ** 53, 2 ** -1022, 2 ** -1023, 1.0000000000000002, ...Array.from({ length: 12 }, randomNumber)];
  const cases = [];
  const add = (name, source, values = inputs) => cases.push({ name, source, inputs: values, oracle: new Function(`return (${source})`)() });
  for (const op of ['+', '-', '*', '/', '%']) {
    for (const c of constants) add(`${op} ${literal(c)}`, `function f(x) { return x ${op} ${literal(c)}; }`);
    add(`${op} self`, `function f(x) { return x ${op} x; }`);
  }
  for (const op of ['<', '<=', '>', '>=', '===', '!==', '==', '!=', '&', '|', '^', '<<', '>>', '>>>']) {
    for (const c of [0, -1, 31, 33]) add(`${op} ${c}`, `function f(x) { return x ${op} ${c}; }`);
  }
  for (const op of ['-', '+', '!', '~']) add(`unary ${op}`, `function f(x) { return ${op}x; }`);
  add('identity', 'function f(x) { return x; }');
  add('tag distinctions', 'function f(x) { if (x === true) { return false; } if (x === null) { return undefined; } return x; }');
  add('evaluation order', 'function f(x) { return x + (x = 1); }');
  add('postfix coercion', 'function f(x) { return x++; }');
  add('prefix coercion', 'function f(x) { return ++x; }');
  add('fallthrough', 'function f(x) { let y = x; }');
  add('while and early return', 'function f(x) { let i = 0; let sum = x; while (i < 37) { sum += 0.1; i++; } if (sum > 4) { return sum; } return null; }', [0, -0, 1, -1, 0.1, 1e300]);
  add('for and branch', 'function f(x) { let y = x; for (let i = 0; i < 17; i++) { if (i < 8) { y *= 1.5; } else { y /= 3; } } return y; }', [0, -0, 1, -1, Number.MIN_VALUE, Number.MAX_VALUE]);
  cases.push(...test262Cases.map(item => ({ ...item, inputs: [0], oracle: () => false })));
  return cases;
}
export async function runVMConformance(vm, progress = () => {}, signal) {
  const cases = vmCases(); let checked = 0;
  const start = performance.now();
  for (const item of cases) {
    const result = await vm.run(vm.compile(item.source), item.inputs, { signal });
    for (let i = 0; i < item.inputs.length; i++) {
      const expected = item.oracle(item.inputs[i]), actual = result.values[i];
      if (!Object.is(actual, expected)) throw new Error(`${item.name} at input ${i} (${String(item.inputs[i])}): expected ${Object.is(expected, -0) ? '-0' : String(expected)}, got ${Object.is(actual, -0) ? '-0' : String(actual)}`);
      checked++;
    }
    progress({ name: item.name, checked });
  }
  const functions = await runFunctionConformance(vm, signal); progress({ name: 'functions', checked: checked + functions.checked });
  const control = await runControlConformance(vm, signal); progress({ name: 'control', checked: checked + functions.checked + control.checked });
  const gc = await runGCConformance(vm, signal);
  const strings = await runStringConformance(vm, signal);
  return { backend: vm.backend, programs: cases.length + functions.programs + control.programs + gc.programs + strings.programs,
    checked: checked + functions.checked + control.checked + gc.checked + strings.checked,
    durationMs: performance.now() - start, seed: '0x6c616e65', adaptedTest262Predicates: test262Cases.length,
    functions, control, gc, strings, fullTest262: false };
}
