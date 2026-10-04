// Host algorithm/reference and compiler check only, never a runtime backend.
// fill / copyWithin / reverse helper sources against native V8 in separate vm realms.
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { attachBootstrap, bootstrapSources } from './bootstrap.js';
import { entrySource, packProgram } from './program.js';
import { createCompiler } from './compiler.js';
import { arrayMutationSources as helpers } from './array-mutation-source.js';
import {
  arrayMutationCases, arrayMutationExpected, arrayMutationResumptionSource,
  arrayMutationResumptionExpected, arrayMutationNegativeSources,
} from './array-mutation-cases.js';

const compiler = await createCompiler();
const nativePath = fileURLToPath(new URL('./generated/compiler', import.meta.url));
const nativeRaw = source => JSON.parse(execFileSync(nativePath, [source], { encoding: 'utf8' }));
const bootstraps = Object.fromEntries(Object.entries(bootstrapSources).map(([name, source]) => [name, nativeRaw(source)]));
const nativeCompile = source => packProgram(attachBootstrap(nativeRaw(source), bootstraps), entrySource(source));

// (a) exact export contract.
assert.ok(Object.isFrozen(helpers));
assert.deepEqual(Object.keys(helpers), ['arrayFill', 'arrayCopyWithin', 'arrayReverse']);
for (const [key, source] of Object.entries(helpers)) {
  assert.equal(typeof source, 'string');
  const name = key[5].toLowerCase() + key.slice(6);
  assert.ok(source.startsWith(`function ${name}Bootstrap(`), key);
  assert.ok(source.includes('"use strict"') && source.includes('__lanesArrayObject(this)'), key);
}

const setup = Object.entries(helpers).map(([key, source]) =>
  `Array.prototype[${JSON.stringify(key[5].toLowerCase() + key.slice(6))}] = (${source});`).join('\n');
const intrinsics = `const __lanesNumber=Number;const __lanesCall=Function.prototype.call.bind(Function.prototype.call);function __lanesArrayObject(value){if(value===null||value===undefined)throw new TypeError();if(typeof value!=="object"&&typeof value!=="function")throw new Error("Unsupported boxing");return value;}`;
const helperPrelude = intrinsics + '\n' + setup + '\n';
const inputs = [0, 1, -1, 17];

function call(source, input, prelude) {
  try {
    return { threw: false, value: new Script((prelude || '') + `(${source})(${input})`).runInNewContext({}, { timeout: 1000 }) };
  } catch (error) {
    // vm realms do not share the outer error constructors, so compare by name.
    const value = error !== null && typeof error === 'object' ? 'error:' + error.name : error;
    return { threw: true, value };
  }
}
function agree(source) {
  const wasm = compiler.compile(source);
  const native = nativeCompile(source);
  assert.deepEqual(wasm.code, native.code, source);
  assert.deepEqual(wasm.image, native.image, source);
}

let checks = 0, compiled = 0;
// (b) compile agreement, (c) differential native vs helper realms.
for (const source of [...arrayMutationCases,arrayMutationResumptionSource]) {
  agree(source); compiled++;
  for (const input of inputs) {
    const expected = call(source, input);
    const actual = call(source, input, helperPrelude);
    assert.equal(expected.threw, false, source + ' ' + JSON.stringify(expected.value));
    assert.equal(actual.threw, false, source + ' ' + JSON.stringify(actual.value));
    const kind = actual.value === null ? 'null' : typeof actual.value;
    assert.ok(['number', 'string', 'boolean', 'undefined'].includes(kind), source);
    assert.equal(actual.value, expected.value, source);
    checks++;
  }
}
// (d) fixed normative outcomes, required to hold in both realms.
const covered = new Set();
for (const [index, input, value] of arrayMutationExpected) {
  covered.add(index);
  for (const x of input === '*' ? inputs : [input]) {
    for (const prelude of ['', helperPrelude]) {
      const result = call(arrayMutationCases[index], x, prelude);
      assert.deepEqual(result, { threw: false, value }, `case ${index} input ${x} ${prelude ? 'helper' : 'native'}`);
      checks++;
    }
  }
}
assert.equal(covered.size, arrayMutationCases.length, 'every corpus entry has a normative expectation');
for (const prelude of ['', helperPrelude]) {
  for (const input of inputs) {
    assert.deepEqual(call(arrayMutationResumptionSource, input, prelude), { threw: false, value: arrayMutationResumptionExpected });
    checks++;
  }
}
// (e) uncaught completions compared by error name or thrown primitive.
for (const source of arrayMutationNegativeSources) {
  agree(source); compiled++;
  for (const input of inputs) {
    const expected = call(source, input);
    const actual = call(source, input, helperPrelude);
    assert.equal(expected.threw, true, source);
    assert.equal(actual.threw, true, source);
    assert.equal(actual.value, expected.value, source);
    checks++;
  }
}
// Primitive receivers stay on the private receiver guard.
for (const expression of [
  'Array.prototype.fill.call("ab", 1)',
  'Array.prototype.copyWithin.call(1, 0, 1)',
  'Array.prototype.reverse.call(true)',
  'Array.prototype.reverse.call("ab")',
]) {
  assert.throws(() => new Script(helperPrelude + expression).runInNewContext({}, { timeout: 1000 }),
    error => error !== null && typeof error === 'object' && error.name === 'Error' && /Unsupported boxing/.test(error.message), expression);
  checks++;
}
// (f) standalone helper compilation: record the outcome honestly for each compiler.
const outcome = fn => { try { const p = fn(); return { ok: true, code: p.code, image: p.image }; } catch (error) { return { ok: false, error: `${error.name}: ${error.message}` }; } };
const helperCompile = {};
for (const [key, source] of Object.entries(helpers)) {
  const wasm = outcome(() => compiler.compile(source));
  const native = outcome(() => nativeCompile(source));
  assert.deepEqual(wasm, native, key);
  // Also compile the helper as a closure inside an ordinary entry function.
  const wrapped = `function wrapper(x) { const helper = (${source}); return typeof helper; }`;
  const wrapWasm = outcome(() => compiler.compile(wrapped));
  const wrapNative = outcome(() => nativeCompile(wrapped));
  assert.deepEqual(wrapWasm, wrapNative, key + ' wrapped');
  // Private intrinsics only resolve for bootstrap roots, so additionally bind them as
  // wrapper parameters: this proves every opcode in the helper body packs for the GPU.
  const bound = `function wrapper(__lanesArrayObject, __lanesNumber, __lanesCall) { return (${source}); }`;
  const boundWasm = outcome(() => compiler.compile(bound));
  const boundNative = outcome(() => nativeCompile(bound));
  assert.deepEqual(boundWasm, boundNative, key + ' intrinsic parameters');
  assert.ok(boundWasm.ok, key + ' must compile with intrinsics bound as parameters: ' + boundWasm.error);
  assert.equal(nativeRaw(source).error, undefined, key + ' raw QuickJS parse');
  helperCompile[key] = {
    standalone: wasm.ok ? 'compiled, wasm/native agree' : 'both rejected: ' + wasm.error,
    closureInEntry: wrapWasm.ok ? 'compiled, wasm/native agree' : 'both rejected: ' + wrapWasm.error,
    intrinsicsAsParameters: 'compiled, wasm/native agree',
    rawQuickJS: 'native bridge compiles without error',
  };
}
console.log(JSON.stringify({
  helpers: Object.keys(helpers),
  programs: arrayMutationCases.length + 1,
  negativePrograms: arrayMutationNegativeSources.length,
  compiledPrograms: compiled,
  normativeExpectations: arrayMutationExpected.length,
  hostAlgorithmChecks: checks,
  nativeWasmAgreement: true,
  helperCompile,
  primitiveBoxing: 'explicitly unsupported',
  numericIndexLimit: 'indices at or above 2^31 remain unsupported by the existing numeric key path',
  gpuChecks: false,
  resumptionExpected: arrayMutationResumptionExpected,
}, null, 1));
