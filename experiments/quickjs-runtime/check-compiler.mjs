import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createCompiler } from './compiler.js';
import { entrySource, packProgram } from './program.js';
import { sources, stringSources } from './cases.js';
import { attachBootstrap, descriptorSource } from './bootstrap.js';

const compiler = await createCompiler();
const nativePath = fileURLToPath(new URL('./generated/compiler', import.meta.url));
const bootstrap = JSON.parse(execFileSync(nativePath, [descriptorSource], { encoding: 'utf8' }));
for (const source of [...sources, ...stringSources]) {
  const raw = JSON.parse(execFileSync(nativePath, [source], { encoding: 'utf8' }));
  const native = packProgram(attachBootstrap(raw, bootstrap), entrySource(source));
  const wasm = compiler.compile(source);
  // Raw bytecode contains build-dependent atom IDs. The exported operands and
  // packed GPU image must agree after those atoms have been resolved to text.
  assert.deepEqual(wasm.code, native.code, source);
  assert.deepEqual(wasm.image, native.image, source);
}
console.log(JSON.stringify({ programs: sources.length + stringSources.length,
  nativeWasmAgreement: true, guestExecution: false }));
