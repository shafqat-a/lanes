// Host algorithm/reference and compiler check only, never a runtime backend.
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { attachBootstrap, bootstrapSources } from './bootstrap.js';
import { entrySource, packProgram } from './program.js';
import { createCompiler } from './compiler.js';
import { arrayReduceSources } from './array-reduce-source.js';
import {
  arrayReduceCases, arrayReduceExpected, arrayReduceResumptionSource,
  arrayReduceResumptionExpected, arrayReduceNegativeSources,
} from './array-reduce-cases.js';

const compiler = await createCompiler();
const nativePath = fileURLToPath(new URL('./generated/compiler', import.meta.url));
const nativeRaw = source => JSON.parse(execFileSync(nativePath, [source], { encoding: 'utf8' }));
const bootstraps = Object.fromEntries(Object.entries(bootstrapSources).map(([name, source]) => [name, nativeRaw(source)]));
const compileBoth = source => {
  const wasm = compiler.compile(source);
  const native = packProgram(attachBootstrap(nativeRaw(source), bootstraps), entrySource(source));
  assert.deepEqual(wasm.code, native.code, source);
  assert.deepEqual(wasm.image, native.image, source);
};

assert.deepEqual(Object.keys(arrayReduceSources), ['arrayReduce', 'arrayReduceRight']);
assert.ok(Object.isFrozen(arrayReduceSources));
for (const source of Object.values(arrayReduceSources)) assert.equal(typeof source, 'string');
assert.equal(arrayReduceCases.length, arrayReduceExpected.length);

const setup = Object.entries(arrayReduceSources).map(([key, source]) =>
  `Array.prototype[${JSON.stringify(key.slice(5, 6).toLowerCase() + key.slice(6))}] = (${source});`).join('\n');
const intrinsics = `const __lanesNumber=Number;const __lanesCall=Function.prototype.call.bind(Function.prototype.call);function __lanesArrayObject(value){if(value===null||value===undefined)throw new TypeError();if(typeof value!=="object"&&typeof value!=="function")throw new Error("Unsupported boxing");return value;}`;
const prelude = intrinsics + '\n' + setup + '\n';
const inputs = [0, 1, -1, 17];

function call(source, input, prefix) {
  const script = `(${source})(${input})`;
  try {
    return { threw: false, value: new Script((prefix || '') + script).runInNewContext({}, { timeout: 1000 }) };
  } catch (error) {
    // vm realms do not share the outer TypeError constructor.
    const value = error !== null && typeof error === 'object' && error.name === 'TypeError' ? 'TypeError' : error;
    return { threw: true, value };
  }
}

let checks = 0;
// Private helper globals only resolve when attached as intrinsic bootstrap roots.
// Compare native/Wasm packed images using each helper's actual registered slot.
const { default: createModule } = await import('./generated/compiler.mjs');
const wasmModule = await createModule();
const wasmRaw = source => JSON.parse(wasmModule.ccall('lanes_compile', 'string', ['string'], [source]));
const standaloneHelperCompile = {};
const trivialEntry = 'function f(x) { return x; }';
for (const [key, source] of Object.entries(arrayReduceSources)) {
  assert.throws(() => compiler.compile(source), /Unsupported global or module reference: __lanes/);
  assert.throws(() => packProgram(attachBootstrap(nativeRaw(source), bootstraps), entrySource(source)), /Unsupported global or module reference: __lanes/);
  const native = nativeRaw(source);
  const wasm = wasmRaw(source);
  assert.equal(native.error, undefined, key);
  assert.equal(wasm.error, undefined, key);
  // Raw `bytes` embed process-local QuickJS atom ids, so raw JSON is not compared directly;
  // agreement is asserted on the packed code/image, as for every other program.
  const packed = raw => packProgram(attachBootstrap(nativeRaw(trivialEntry), { ...bootstraps, [key]: raw }), 'f');
  const a = packed(wasm), b = packed(native);
  assert.deepEqual(a.code, b.code, key);
  assert.deepEqual(a.image, b.image, key);
  standaloneHelperCompile[key] = 'root compile rejected (private globals, expected); raw wasm/native compile; packed bootstrap code/image agree';
  checks++;
}

const programs = [...arrayReduceCases, arrayReduceResumptionSource];
const expectations = [...arrayReduceExpected, arrayReduceResumptionExpected];
programs.forEach((source, index) => {
  compileBoth(source);
  for (const input of inputs) {
    const expected = call(source, input);
    const actual = call(source, input, prelude);
    assert.equal(expected.threw, false, source);
    assert.equal(actual.threw, false, source);
    const kind = actual.value === null ? 'null' : typeof actual.value;
    assert.ok(kind === 'number' || kind === 'string' || kind === 'boolean' || kind === 'undefined', source);
    assert.equal(actual.value, expected.value, source);
    assert.equal(actual.value, expectations[index], source);
    checks++;
  }
});

for (const source of arrayReduceNegativeSources) {
  compileBoth(source);
  for (const input of inputs) {
    const expected = call(source, input);
    const actual = call(source, input, prelude);
    assert.equal(expected.threw, true, source);
    assert.equal(actual.threw, true, source);
    assert.equal(actual.value, expected.value, source);
    checks++;
  }
}

for (const expression of [
  'Array.prototype.reduce.call("ab", function(a, v){ return a + v; })',
  'Array.prototype.reduceRight.call(1, function(){ return 0; }, 0)',
  'Array.prototype.reduce.call(true, function(){ return 0; }, 0)',
]) {
  assert.throws(() => new Script(prelude + expression).runInNewContext({}, { timeout: 1000 }),
    error => error !== null && typeof error === 'object' && error.name === 'Error' && /Unsupported boxing/.test(error.message));
  checks++;
}

console.log(JSON.stringify({
  helpers: Object.keys(arrayReduceSources),
  programs: programs.length,
  negativePrograms: arrayReduceNegativeSources.length,
  hostAlgorithmChecks: checks,
  nativeWasmAgreement: true,
  standaloneHelperCompile,
  primitiveBoxing: 'explicitly unsupported',
  numericIndexLimit: 'indices at or above 2^31 remain unsupported by the existing numeric key path',
  gpuChecks: false,
  resumptionExpected: arrayReduceResumptionExpected,
}));
