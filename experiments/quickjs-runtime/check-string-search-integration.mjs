// Host metadata oracle and compiler parity only; GPU evidence is separate.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
import { createCompiler } from './compiler.js';
import { attachBootstrap, bootstrapSources } from './bootstrap.js';
import { entrySource, packProgram } from './program.js';
import { stringSearchMetadata } from './string-search-metadata.js';
import { stringSearchIntegrationSources, stringSearchIntegrationNegativeSources, stringSearchIntegrationUnsupportedSources } from './string-search-integration-cases.js';
for (const {name, length} of stringSearchMetadata) {
  assert.equal(String.prototype[name].name, name);
  assert.equal(String.prototype[name].length, length);
}
const nativePath = fileURLToPath(new URL('./generated/compiler', import.meta.url));
const nativeRaw = source => JSON.parse(execFileSync(nativePath, [source], { encoding: 'utf8' }));
const bootstraps = Object.fromEntries(Object.entries(bootstrapSources).map(([name, source]) => [name, nativeRaw(source)]));
const compiler = await createCompiler();
const programs = [...stringSearchIntegrationSources, ...stringSearchIntegrationNegativeSources, ...stringSearchIntegrationUnsupportedSources];
for (const source of programs) {
  const native = packProgram(attachBootstrap(nativeRaw(source), bootstraps), entrySource(source));
  const wasm = compiler.compile(source);
  assert.deepEqual(wasm.code, native.code, source); assert.deepEqual(wasm.image, native.image, source);
}
for (const source of stringSearchIntegrationSources) {
  const value = new Script(`(${source})(0)`).runInNewContext();
  assert.ok(['string','boolean','number'].includes(typeof value));
}
for (const source of stringSearchIntegrationNegativeSources) {
  assert.throws(() => new Script(`(${source})(0)`).runInNewContext(), error => error?.name === 'TypeError');
}
console.log(JSON.stringify({ metadataChecks: stringSearchMetadata.length * 2, compilerPrograms: programs.length, nativePositiveChecks: stringSearchIntegrationSources.length, nativeNegativeChecks: stringSearchIntegrationNegativeSources.length, gpuExecuted: false }));
