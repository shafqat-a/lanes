export const functionCases = [
  ['hoisted call', 'function f(x) { return add(x, 2); function add(a, b) { return a + b; } }', [-1, 0, 1, 0.1]],
  ['root recursion', 'function f(x) { if (x <= 1) { return 1; } return x * f(x - 1); }', [0, 1, 5, 12]],
  ['mutual recursion', 'function f(x) { function even(n) { return n === 0 ? true : odd(n - 1); } function odd(n) { return n === 0 ? false : even(n - 1); } return even(x); }', [0, 1, 2, 9]],
  ['escaped mutable closure', 'function f(x) { function make(n) { return function(delta) { n += delta; return n; }; } const a = make(x); const b = make(100); a(1); b(2); return a(3) + b(4); }', [-1, 0, 2, 0.1]],
  ['shared binding', 'function f(x) { let get = undefined; function make() { let n = x; get = () => n; return () => ++n; } const increment = make(); increment(); increment(); return get(); }', [0, 1, -1]],
  ['nested shadowing', 'function f(x) { const get = () => x; { let x = 100; const other = () => x; x++; return get() + other(); } }', [0, 1, -10]],
  ['argument order', 'function f(x) { function add(a,b,c) { return a + b + c; } return add(x++, x++, x); }', [0, 1, -1]],
  ['callee before arguments', 'function f(x) { let g = a => a + 1; const h = a => a + 10; return g((g = h)(x)); }', [0, 2]],
  ['missing args', 'function f(x) { function g(a,b) { return b; } return g(x); }', [0]],
  ['extra args side effects', 'function f(x) { const g = () => x; return g(x++, x++); }', [0, 2]],
  ['named expression recursion', 'function f(x) { const g = function inner(n) { if (n < 2) { return 1; } return n * inner(n - 1); }; return g(x); }', [0, 5, 12]],
  ['closure identity', 'function f(x) { const factory = () => () => x; const a = factory(); const b = factory(); return a === a && a !== b && !!a; }', [0, 1]],
  ['per iteration capture', 'function f(x) { let a; let b; let c; for (let i = 0; i < 3; i++) { if (i === 0) { a = () => i; } if (i === 1) { b = () => i; } if (i === 2) { c = () => i; } } return a() + b() * 10 + c() * 100; }', [0]],
  ['closure captures later binding', 'function f(x) { const get = () => y; let y = x + 1; return get(); }', [0, -1]],
  ['short circuit side effects', 'function f(x) { let y = 0; const inc = () => ++y; x && inc(); x || inc(); return y; }', [0, 1, false, true, null, undefined, NaN]],
  ['returned closure chain', 'function f(x) { return (a => b => c => a + b + c)(x)(2)(3); }', [0, 0.1, 4]],
];
export async function runFunctionConformance(vm, signal) {
  let checked = 0;
  for (const [name, source, inputs] of functionCases) {
    const native = new Function(`return (${source})`)();
    const result = await vm.run(vm.compile(source), inputs, { signal, budget: 7 });
    inputs.forEach((value, i) => {
      if (!Object.is(result.values[i], native(value))) throw new Error(`Closure mismatch: ${name}, input ${i}, got ${result.values[i]}`);
      checked++;
    });
  }
  return { programs: functionCases.length, checked };
}
