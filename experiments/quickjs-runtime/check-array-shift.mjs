// Host algorithm/reference and compiler check only, never a runtime backend.
// Array.prototype.shift / unshift helpers are compared with the host's native
// builtins in separate vm realms; nothing here runs on, or validates, the GPU.
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { attachBootstrap, bootstrapSources } from './bootstrap.js';
import { entrySource, packProgram } from './program.js';
import { createCompiler } from './compiler.js';
import { arrayShiftSources } from './array-shift-source.js';
import {
  arrayShiftCases, arrayShiftExpected, arrayShiftResumptionSource,
  arrayShiftResumptionExpected, arrayShiftNegativeSources,
} from './array-shift-cases.js';

const compiler = await createCompiler();
// Raw wasm bridge output, created the same way compiler.js does, for helper-level agreement.
const { default: createModule } = await import('./generated/compiler.mjs');
const wasmModule = await createModule();
const wasmRaw = source => JSON.parse(wasmModule.ccall('lanes_compile', 'string', ['string'], [source]));
const nativePath = fileURLToPath(new URL('./generated/compiler', import.meta.url));
const nativeRaw = source => JSON.parse(execFileSync(nativePath, [source], { encoding: 'utf8' }));
const bootstraps = Object.fromEntries(Object.entries(bootstrapSources).map(([name, source]) => [name, nativeRaw(source)]));
const nativeCompile = source => packProgram(attachBootstrap(nativeRaw(source), bootstraps), entrySource(source));

assert.deepEqual(Object.keys(arrayShiftSources), ['arrayShift', 'arrayUnshift']);
assert.ok(Object.isFrozen(arrayShiftSources));
for (const source of Object.values(arrayShiftSources)) assert.equal(typeof source, 'string');
assert.equal(arrayShiftCases.length, arrayShiftExpected.length);

const setup = Object.entries(arrayShiftSources).map(([key, source]) =>
  `Array.prototype[${JSON.stringify(key.slice(5, 6).toLowerCase() + key.slice(6))}] = (${source});`).join('\n');
const intrinsics = `const __lanesNumber=Number;const __lanesCall=Function.prototype.call.bind(Function.prototype.call);function __lanesArrayObject(value){if(value===null||value===undefined)throw new TypeError();if(typeof value!=="object"&&typeof value!=="function")throw new Error("Unsupported boxing");return value;}`;
const prelude = intrinsics + '\n' + setup + '\n';
const inputs = [0, 1, -1, 17];

function call(source, input, prefix) {
  try {
    return { threw: false, value: new Script((prefix || '') + `(${source})(${input})`).runInNewContext({}, { timeout: 1000 }) };
  } catch (error) {
    // vm realms do not share the outer TypeError constructor; compare by name.
    const value = error !== null && typeof error === 'object' && typeof error.name === 'string' ? error.name : error;
    return { threw: true, value };
  }
}
function agree(source) {
  const wasm = compiler.compile(source);
  const native = nativeCompile(source);
  assert.deepEqual(wasm.code, native.code, source);
  assert.deepEqual(wasm.image, native.image, source);
}

let checks = 0, compiled = 0, fixed = 0;
// The helper realm really uses the helpers (not the host builtins).
assert.equal(new Script(prelude + 'Array.prototype.shift.name + Array.prototype.unshift.name + Array.prototype.unshift.length').runInNewContext({}), 'shiftBootstrapunshiftBootstrap1');

const programs = [...arrayShiftCases, arrayShiftResumptionSource];
for (const [index, source] of programs.entries()) {
  agree(source); compiled++;
  for (const input of inputs) {
    const expected = call(source, input);
    const actual = call(source, input, prelude);
    assert.equal(expected.threw, false, `${source} native ${String(expected.value)}`);
    assert.equal(actual.threw, false, `${source} helper ${String(actual.value)}`);
    const kind = actual.value === null ? 'null' : typeof actual.value;
    assert.ok(['number', 'string', 'boolean', 'undefined'].includes(kind), source);
    assert.equal(actual.value, expected.value, source);
    checks++;
  }
  // Fixed normative outcome for x = 17, for both the helpers and the host builtins.
  const want = index < arrayShiftCases.length ? arrayShiftExpected[index] : arrayShiftResumptionExpected;
  assert.equal(call(source, 17, prelude).value, want, `helper: ${source}`);
  assert.equal(call(source, 17).value, want, `native: ${source}`);
  fixed++;
}

const negativeNames = [];
for (const source of arrayShiftNegativeSources) {
  agree(source); compiled++;
  for (const input of inputs) {
    const expected = call(source, input);
    const actual = call(source, input, prelude);
    assert.equal(expected.threw, true, source);
    assert.equal(actual.threw, true, source);
    assert.equal(actual.value, expected.value, source);
    checks++;
  }
  negativeNames.push(call(source, 17, prelude).value);
}
// Explicit expected completions for x = 17 (TypeError by name, or the thrown value 17).
assert.deepEqual(negativeNames, ['TypeError', 'TypeError', 'TypeError', 'TypeError', 'TypeError', 'TypeError', 'TypeError', 17, 17, 17, 17]);

for (const expression of [
  'Array.prototype.shift.call("ab")',
  'Array.prototype.unshift.call("ab", 1)',
  'Array.prototype.unshift.call(1)',
  'Array.prototype.shift.call(true)',
]) {
  assert.throws(() => new Script(prelude + expression).runInNewContext({}, { timeout: 1000 }),
    error => error !== null && typeof error === 'object' && error.name === 'Error' && /Unsupported boxing/.test(error.message));
  checks++;
}

// Helper sources themselves: raw QuickJS bytecode must agree between wasm and native bridges.
// A standalone compile packs the helper as an entry function, where private __lanes* names are
// unresolved globals; both compilers must reject it identically (recorded below). Two wrapped
// forms must pack identically: (1) a closure inside an entry whose parameters bind the private
// names, and (2) the real bootstrap path (intrinsicRoot resolution of __lanes* builtins), with the
// helper attached to its actual registered bootstrap slot.
const wasmBootstraps = Object.fromEntries(Object.entries(bootstrapSources).map(([name, source]) => [name, wasmRaw(source)]));
const entry = 'function f(x) { return x; }';
const helperResults = {};
for (const [key, source] of Object.entries(arrayShiftSources)) {
  // Raw bridge JSON is not compared byte-for-byte: instruction bytes embed atom ids that depend on
  // the long-lived wasm instance's atom table, while the native bridge starts fresh per call.
  let standalone;
  try { compiler.compile(source); standalone = 'compiled'; } catch (error) { standalone = `${error.name}: ${error.message}`; }
  let nativeStandalone;
  try { nativeCompile(source); nativeStandalone = 'compiled'; } catch (error) { nativeStandalone = `${error.name}: ${error.message}`; }
  assert.equal(standalone, nativeStandalone, key);
  agree(`function helperEntry(__lanesArrayObject, __lanesNumber) { return (${source}); }`);
  const wasmSlot = packProgram(attachBootstrap(wasmRaw(entry), { ...wasmBootstraps, [key]: wasmRaw(source) }), 'f');
  const nativeSlot = packProgram(attachBootstrap(nativeRaw(entry), { ...bootstraps, [key]: nativeRaw(source) }), 'f');
  assert.deepEqual(wasmSlot.code, nativeSlot.code, key);
  assert.deepEqual(wasmSlot.image, nativeSlot.image, key);
  helperResults[key] = { standalone, closureWrappedAgreement: true, bootstrapSlotAgreement: true };
  checks += 3;
}

console.log(JSON.stringify({
  programs: arrayShiftCases.length + 1,
  negativePrograms: arrayShiftNegativeSources.length,
  compiledPrograms: compiled,
  fixedExpectations: fixed,
  hostAlgorithmChecks: checks,
  nativeWasmAgreement: true,
  helpers: helperResults,
  primitiveBoxing: 'explicitly unsupported',
  numericIndexLimit: 'indices at or above 2^31 remain unsupported by the existing numeric key path',
  gpuChecks: false,
  resumptionExpected: arrayShiftResumptionExpected,
}));
