// Host algorithm/reference and compiler check only, never a runtime backend.
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { attachBootstrap, bootstrapSources } from './bootstrap.js';
import { entrySource, packProgram } from './program.js';
import { createCompiler } from './compiler.js';
import { arraySources, arrayBuiltins, arrayMethods } from './array-source.js';
import { arraySearchSources, arraySearchResumptionSource, arraySearchResumptionExpected, arraySearchNegativeSources } from './array-search-cases.js';

const compiler = await createCompiler();
const nativePath = fileURLToPath(new URL('./generated/compiler', import.meta.url));
const nativeRaw = source => JSON.parse(execFileSync(nativePath, [source], { encoding: 'utf8' }));
const bootstraps = Object.fromEntries(Object.entries(bootstrapSources).map(([name, source]) => [name, nativeRaw(source)]));
const setup = Object.entries(arraySources).map(([key, source]) =>
  `Array.prototype[${JSON.stringify(key.slice(5, 6).toLowerCase() + key.slice(6))}] = (${source});`).join('\n');
const intrinsics = `const __lanesNumber=Number;const __lanesCall=Function.prototype.call.bind(Function.prototype.call);function __lanesArrayObject(value){if(value===null||value===undefined)throw new TypeError();if(typeof value!=="object"&&typeof value!=="function")throw new Error("Unsupported boxing");return value;}`;
const inputs = [0, 1, -1, 17];
const previousKeys = ['arrayPush', 'arrayPop', 'arrayAt', 'arrayIndexOf', 'arrayIncludes', 'arrayEvery', 'arraySome', 'arrayForEach'];
const addedKeys = ['arrayFind', 'arrayFindIndex', 'arrayFindLast', 'arrayFindLastIndex', 'arrayLastIndexOf'];
const extendedKeys = ['arrayReduce', 'arrayReduceRight', 'arrayFill', 'arrayCopyWithin', 'arrayReverse', 'arrayShift', 'arrayUnshift'];
assert.deepEqual(Object.keys(arraySources), [...previousKeys, ...addedKeys, ...extendedKeys]);
assert.equal(new Set(arrayBuiltins).size, arrayBuiltins.length);
const derived = Object.fromEntries(arrayBuiltins.map((name, index) => [300 + index, 'array' + name[0].toUpperCase() + name.slice(1)]).filter(([, helper]) => Object.hasOwn(arraySources, helper)));
assert.deepEqual(arrayMethods, derived);
assert.equal(new Set(Object.keys(arrayMethods)).size, Object.keys(arrayMethods).length);
for (const name of ['find', 'findIndex', 'findLast', 'findLastIndex', 'lastIndexOf']) {
  assert.equal(arrayBuiltins.filter(item => item === name).length, 1);
  const id = 300 + arrayBuiltins.indexOf(name);
  assert.equal(arrayMethods[id], 'array' + name[0].toUpperCase() + name.slice(1));
}
for (const key of previousKeys) assert.equal(typeof arraySources[key], 'string');

function call(source, input, prelude) {
  const script = `(${source})(${input})`;
  try {
    return { threw: false, value: new Script((prelude || '') + script).runInNewContext({}, { timeout: 1000 }) };
  } catch (error) {
    // vm realms do not share the outer TypeError constructor.
    const value = error !== null && typeof error === 'object' && error.name === 'TypeError' ? 'TypeError' : error;
    return { threw: true, value };
  }
}

let checks = 0;
const programs = [...arraySearchSources, arraySearchResumptionSource];
for (const source of programs) {
  const wasm = compiler.compile(source);
  const native = packProgram(attachBootstrap(nativeRaw(source), bootstraps), entrySource(source));
  assert.deepEqual(wasm.code, native.code, source);
  assert.deepEqual(wasm.image, native.image, source);
  for (const input of inputs) {
    const expected = call(source, input);
    const actual = call(source, input, intrinsics + '\n' + setup + '\n');
    assert.equal(actual.threw, false, source);
    assert.equal(expected.threw, false, source);
    const kind = actual.value === null ? 'null' : typeof actual.value;
    assert.ok(kind === 'number' || kind === 'string' || kind === 'boolean' || kind === 'undefined', source);
    assert.equal(actual.value, expected.value, source);
    checks++;
  }
}
assert.equal(call(arraySearchResumptionSource, 17).value, arraySearchResumptionExpected);
for (const source of arraySearchNegativeSources) {
  const wasm = compiler.compile(source);
  const native = packProgram(attachBootstrap(nativeRaw(source), bootstraps), entrySource(source));
  assert.deepEqual(wasm.code, native.code, source);
  assert.deepEqual(wasm.image, native.image, source);
  for (const input of inputs) {
    const expected = call(source, input);
    const actual = call(source, input, intrinsics + '\n' + setup + '\n');
    assert.equal(expected.threw, true, source);
    assert.equal(actual.threw, true, source);
    assert.equal(actual.value, expected.value, source);
    checks++;
  }
}
for (const expression of [
  'Array.prototype.find.call("ab", function(){ return false; })',
  'Array.prototype.lastIndexOf.call(1, 1)',
  'Array.prototype.findLast.call(true, function(){ return true; })',
]) {
  assert.throws(() => new Script(intrinsics + '\n' + setup + '\n' + expression).runInNewContext({}, { timeout: 1000 }), error => error !== null && typeof error === 'object' && error.name === 'Error' && /Unsupported boxing/.test(error.message));
  checks++;
}
console.log(JSON.stringify({
  programs: arraySearchSources.length + 1,
  negativePrograms: arraySearchNegativeSources.length,
  hostAlgorithmChecks: checks,
  nativeWasmAgreement: true,
  primitiveBoxing: 'explicitly unsupported',
  numericIndexLimit: 'indices at or above 2^31 remain unsupported by the existing numeric key path',
  gpuChecks: false,
  resumptionExpected: arraySearchResumptionExpected,
}));
