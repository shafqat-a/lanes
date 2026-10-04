// Verify the rebuilt native and Wasm bridges against every focused phase 4
// record. Guest execution remains exclusively in the GPU runtime.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createCompiler } from './compiler.js';
import { entrySource, packProgram } from './program.js';
import { attachBootstrap, bootstrapSources } from './bootstrap.js';
import { phase4Suite } from './phase4-suite.js';
const binary = fileURLToPath(new URL('./generated/compiler', import.meta.url));
const raw = source => JSON.parse(execFileSync(binary, [source], { encoding: 'utf8', maxBuffer: 1 << 26 }));
const bootstrap = Object.fromEntries(Object.entries(bootstrapSources).map(([field, source]) => [field, raw(source)]));
const wasm = await createCompiler();
const native = source => { const name=entrySource(source); return packProgram(attachBootstrap(raw(source), bootstrap), name); };
const result = compile => { try { return { program: compile() }; } catch (error) { return { error: `${error.name}: ${error.message}` }; } };
let admitted = 0, rejected = 0, resourceLimited = 0;
for (const record of phase4Suite()) {
  const a = result(() => native(record.source)), b = result(() => wasm.compile(record.source));
  assert.equal(a.error, b.error, `${record.id}: admission`);
  if (a.error) {
    if(record.outcome==='resource-limit'&&a.error==='RangeError: GPU string limit: 256 UTF-16 code units'){resourceLimited++;continue;}
    assert.ok(record.outcome === 'rejected' || record.outcome === 'unsupported', `${record.id}: unexpected rejection ${a.error}`);
    rejected++;
  } else {
    assert.notEqual(record.outcome, 'rejected', `${record.id}: expected rejection`);
    assert.deepEqual(a.program.code, b.program.code, `${record.id}: code`);
    assert.deepEqual(a.program.image, b.program.image, `${record.id}: image`);
    admitted++;
  }
}
console.log(JSON.stringify({ records: admitted + rejected + resourceLimited, admitted, rejected, resourceLimited, nativeWasmAgreement: true, guestExecution: false }));
