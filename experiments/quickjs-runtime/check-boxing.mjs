// CPU evaluation is a test oracle only, never part of the GPU runtime.
// Checks native/Wasm compiler parity for every boxing fixture and validates
// the fixtures against fresh native realms. GPU evidence is separate.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
import { createCompiler } from './compiler.js';
import { attachBootstrap, bootstrapSources } from './bootstrap.js';
import { entrySource, packProgram } from './program.js';
import { boxingNegativeNormativeExpectations, boxingInputNormativeExpectations, boxingTaggedTemplateSources, boxingSources, boxingTypeErrorSources, boxingRangeErrorSources, boxingUnsupportedSources, boxingResumptionSource, boxingResumptionExpected, boxingNormativeExpectations, wrapErrorSource } from './boxing-cases.js';

const inputs = [0, 1, -1, 17];
const typeErrorWrapped = boxingTypeErrorSources.map(source => wrapErrorSource(source, 'TypeError'));
const rangeErrorWrapped = boxingRangeErrorSources.map(source => wrapErrorSource(source, 'RangeError'));

const nativePath = fileURLToPath(new URL('./generated/compiler', import.meta.url));
const raw = source => JSON.parse(execFileSync(nativePath, [source], { encoding: 'utf8' }));
const bootstraps = Object.fromEntries(Object.entries(bootstrapSources).map(([name, source]) => [name, raw(source)]));
const compiler = await createCompiler();
function evaluate(source, input) {
  try { return { value: new Script(`(${source})(${input})`).runInNewContext({}, { timeout: 1000 }) }; }
  catch (error) { return { error: error?.name }; }
}
const primitive = value => value === null || (typeof value !== 'object' && typeof value !== 'function');

const all = [...boxingSources, boxingResumptionSource, ...boxingTypeErrorSources, ...typeErrorWrapped,
  ...boxingRangeErrorSources, ...rangeErrorWrapped, ...boxingUnsupportedSources];
assert.equal(new Set(all).size, all.length, 'duplicate boxing fixture');
for (const source of all) {
  const native = packProgram(attachBootstrap(raw(source), bootstraps), entrySource(source));
  const wasm = compiler.compile(source);
  assert.deepEqual(wasm.code, native.code, source); assert.deepEqual(wasm.image, native.image, source);
}

// Formerly rejected tagged templates are admitted positive programs: they are
// in boxingSources (native/Wasm parity above, native realm checks below).
for(const source of boxingTaggedTemplateSources)assert.ok(boxingSources.includes(source),`tagged template not admitted: ${source}`);
compiler.compile('function f(x){function nested(){return `x${x}`;}return nested();}');
compiler.compile('function f(x){return `literal`;}');
compiler.compile('function f(x){return "a".concat(x);}');
for(const [source,item] of boxingInputNormativeExpectations)for(const input of inputs)assert.equal(evaluate(source,input).value,item.expectedForInput(input));
for(const [source,item] of boxingNegativeNormativeExpectations)assert.equal(evaluate(source,17).error,item.expectedError);
let positiveChecks = 0;
for (const source of boxingSources) {
  for (const input of inputs) {
    const first = evaluate(source, input), second = evaluate(source, input);
    assert.ok('value' in first, `native threw ${first.error}: ${source}`);
    assert.ok(primitive(first.value), `non-primitive result: ${source}`);
    assert.ok(Object.is(first.value, second.value), `nondeterministic across realms: ${source}`);
    positiveChecks++;
  }
}
let negativeChecks = 0;
for (const [sources, wrapped, name] of [[boxingTypeErrorSources, typeErrorWrapped, 'TypeError'], [boxingRangeErrorSources, rangeErrorWrapped, 'RangeError']]) {
  sources.forEach((source, index) => {
    for (const input of inputs) {
      assert.deepEqual(evaluate(source, input), { error: name }, source);
      assert.deepEqual(evaluate(wrapped[index], input), { value: true }, wrapped[index]);
      negativeChecks++;
    }
  });
}
// Unsupported fixtures complete natively with a primitive; on GPU they must
// instead end in the uncatchable unsupported status (checked in the browser).
for (const source of boxingUnsupportedSources) {
  const result = evaluate(source, 17);
  assert.ok('value' in result && primitive(result.value), source);
  assert.notEqual(result.value, 'wrong guest exception', source);
}
assert.deepEqual(evaluate(boxingResumptionSource, 17), { value: boxingResumptionExpected });
for (const [source, expected] of boxingNormativeExpectations) assert.ok(boxingSources.includes(source) && primitive(expected), source);

console.log(JSON.stringify({
  programs: boxingSources.length + 1, typeErrorPrograms: boxingTypeErrorSources.length,
  rangeErrorPrograms: boxingRangeErrorSources.length, unsupportedPrograms: boxingUnsupportedSources.length,
  compilerPrograms: all.length, taggedTemplatePrograms: boxingTaggedTemplateSources.length, nativeWasmAgreement: true, nativePositiveChecks: positiveChecks,
  nativeNegativeChecks: negativeChecks, normativeExpectations: boxingNormativeExpectations.size + boxingInputNormativeExpectations.size,
  resumptionExpected: boxingResumptionExpected, gpuChecks: false,
}));
