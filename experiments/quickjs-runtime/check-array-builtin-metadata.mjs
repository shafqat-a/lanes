// Native metadata oracle and native/Wasm compiler parity; no CPU backend.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { arrayBuiltinLengths } from './array-builtin-metadata.js';
import { arrayBuiltins } from './array-source.js';
import { arrayBuiltinMetadataSources, arrayBuiltinMetadataUnsupportedSources } from './array-builtin-metadata-cases.js';
import { createCompiler } from './compiler.js';
import { attachBootstrap, bootstrapSources } from './bootstrap.js';
import { entrySource, packProgram } from './program.js';
import { Script } from 'node:vm';
assert.deepEqual(Object.keys(arrayBuiltinLengths).sort(), [...arrayBuiltins].sort());
for (const name of arrayBuiltins) {
  assert.equal(Array.prototype[name].name, name, name);
  assert.equal(Array.prototype[name].length, arrayBuiltinLengths[name], name);
}
const nativePath = fileURLToPath(new URL('./generated/compiler', import.meta.url));
const nativeRaw = source => JSON.parse(execFileSync(nativePath, [source], { encoding: 'utf8' }));
const bootstraps = Object.fromEntries(Object.entries(bootstrapSources).map(([name, source]) => [name, nativeRaw(source)]));
const compiler = await createCompiler();
for (const source of [...arrayBuiltinMetadataSources, ...arrayBuiltinMetadataUnsupportedSources]) {
  const native = packProgram(attachBootstrap(nativeRaw(source), bootstraps), entrySource(source));
  const wasm = compiler.compile(source);
  assert.deepEqual(wasm.code, native.code, source);
  assert.deepEqual(wasm.image, native.image, source);
}
for (let i = 0; i < arrayBuiltins.length; i++) {
  const name = Object.keys(arrayBuiltinLengths)[i];
  assert.equal(new Script(`(${arrayBuiltinMetadataSources[i * 2]})(0)`).runInNewContext(), name);
  assert.equal(new Script(`(${arrayBuiltinMetadataSources[i * 2 + 1]})(0)`).runInNewContext(), arrayBuiltinLengths[name]);
}
console.log(JSON.stringify({ identities: arrayBuiltins.length, metadataChecks: arrayBuiltinMetadataSources.length, compilerPrograms: arrayBuiltinMetadataSources.length + arrayBuiltinMetadataUnsupportedSources.length, gpuExecuted: false }));
