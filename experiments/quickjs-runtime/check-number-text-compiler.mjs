// Compile-only feasibility/parity; this deliberately does not execute on GPU.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createCompiler } from './compiler.js';
import { attachBootstrap, bootstrapSources } from './bootstrap.js';
import { entrySource, packProgram } from './program.js';
const compiler = await createCompiler();
const nativePath = fileURLToPath(new URL('./generated/compiler', import.meta.url));
const raw = source => JSON.parse(execFileSync(nativePath, [source], { encoding: 'utf8' }));
const bootstrap = Object.fromEntries(Object.entries(bootstrapSources).map(([name, source]) => [name, raw(source)]));
const sources = [
  'function f(value) { return value + ""; }',
  'function f(value) { return new Error(value).message; }',
  'function f(value) { const o = {}; o[value] = 1; return o[value + ""]; }',
  'function f(value) { return "prefix:" + { valueOf() { return value; } }; }',
  'function f(value) { let result = ""; for (let i = 0; i < 3; i++) result = value + ""; return result; }',
];
for (const source of sources) {
  const native = packProgram(attachBootstrap(raw(source), bootstrap), entrySource(source));
  const wasm = compiler.compile(source);
  assert.deepEqual(wasm.code, native.code, source);
  assert.deepEqual(wasm.image, native.image, source);
}
console.log(JSON.stringify({ numberFormattingPrograms: sources.length, nativeWasmAgreement: true, gpuChecks: false }));
