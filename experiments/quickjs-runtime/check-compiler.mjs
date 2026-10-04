import { stringSearchNegativeSources } from './string-search-cases.js';
import { stringSearchIntegrationNegativeSources, stringSearchIntegrationUnsupportedSources } from './string-search-integration-cases.js';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
import { createCompiler } from './compiler.js';
import { entrySource, packProgram } from './program.js';
import { sources, stringSources, specExpectations } from './cases.js';
import { attachBootstrap, bootstrapSources } from './bootstrap.js';

const compiler = await createCompiler();
const nativePath = fileURLToPath(new URL('./generated/compiler', import.meta.url));
const bootstrap = Object.fromEntries(Object.entries(bootstrapSources).map(([field, source]) =>
  [field, JSON.parse(execFileSync(nativePath, [source], { encoding: 'utf8' }))]));
const nativeReferenceDifferences = [];
for (const [source, expectation] of specExpectations) {
  const actual = new Script(`(${source})(0)`).runInNewContext({}, { timeout: 1000 });
  if (expectation.allowNodeReferenceDifference && !Object.is(actual, expectation.value)) nativeReferenceDifferences.push({ source, actual, expected: expectation.value });
  else assert.equal(actual, expectation.value, source);
}
const validationSources = [
  ...stringSearchNegativeSources, ...stringSearchIntegrationNegativeSources, ...stringSearchIntegrationUnsupportedSources,
  ...[...stringSearchNegativeSources.slice(0, 5), ...stringSearchIntegrationNegativeSources].map(source =>
    `function check(x) { try { (${source})(x); } catch (error) { return error instanceof TypeError; } return false; }`),
];
for (const source of [...sources, ...stringSources, ...validationSources]) {
  const raw = JSON.parse(execFileSync(nativePath, [source], { encoding: 'utf8' }));
  const native = packProgram(attachBootstrap(raw, bootstrap), entrySource(source));
  const wasm = compiler.compile(source);
  // Raw bytecode contains build-dependent atom IDs. The exported operands and
  // packed GPU image must agree after those atoms have been resolved to text.
  assert.deepEqual(wasm.code, native.code, source);
  assert.deepEqual(wasm.image, native.image, source);
}
console.log(JSON.stringify({ programs: sources.length + stringSources.length,
  validationPrograms: validationSources.length, nativeWasmAgreement: true, guestExecution: false, nativeReferenceDifferences }));
