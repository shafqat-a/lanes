import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyTest262Outcome as classify } from './test262-outcome.js';

test('known capacity diagnostics are resource-limited, never passing', () => {
  for (const [message, stage] of [
    ['Execution limit; use start()/step() to resume', 'runtime'],
    ['GPU string limit: 256 UTF-16 code units', 'compile'],
    ['GPU string limit: 256 UTF-16 code units', 'runtime'],
    ['Program/batch exceeds GPU buffer limits', 'runtime'],
    ['Resource limit in lane 0, instruction 55; no CPU fallback', 'runtime'],
  ]) assert.equal(classify(new Error(message), stage), 'resourceLimited');
});

test('unsupported capabilities are distinguished from resources', () => {
  for (const message of ['Unsupported global or module reference: Symbol', 'Unsupported QuickJS instruction: pow',
    'Unsupported QuickJS special object: 3', 'Unsupported QuickJS constant type',
    'QuickJS function exceeds GPU limits or uses a generator/async kind']) assert.equal(classify(message, 'compile'), 'unsupported');
  assert.equal(classify('Unsupported runtime operation in lane 0, instruction 12; no CPU fallback', 'runtime'), 'unsupported');
});

test('semantic, device, unknown and misleading partial diagnostics remain failures', () => {
  for (const message of ['TypeError in lane 0, instruction 1; no CPU fallback',
    'Uncaught guest exception in lane 0, instruction 1; no CPU fallback', 'assert.sameValue',
    'Device lost', 'Invalid bytecode state in lane 0, instruction 1; no CPU fallback',
    'Expected true on GPU', 'Guest says Resource limit', 'Resource limit',
    'GPU string limit: 512 UTF-16 code units', 'Unsupported arbitrary failure',
    'Execution limit; use start()/step() to resume EXTRA',
    'Unsupported runtime operation in lane 0, instruction 1; no CPU fallback EXTRA']) {
    assert.equal(classify(message, 'runtime'), 'failed', message);
  }
  assert.equal(classify('Execution limit; use start()/step() to resume', 'compile'), 'failed');
  assert.equal(classify('Unsupported global or module reference: Symbol', 'runtime'), 'failed');
  assert.equal(classify('Resource limit in lane 0, instruction 55; no CPU fallback', 'compile'), 'failed');
  assert.equal(classify(null, 'runtime'), 'failed');
});

test('derived report retains original statuses and provenance without rerunning', async () => {
  const { mkdtemp, writeFile, readFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { execFileSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const dir = await mkdtemp(join(tmpdir(), 'lanes-reclassify-'));
  try {
    const original = { date:'original-date', report:{fullTest262:false,counts:{passed:1,failed:1,unsupported:1,referenceRejected:0},records:[
      {status:'passed'}, {status:'failed',stage:'runtime',error:'Execution limit; use start()/step() to resume'},
      {status:'unsupported',stage:'runtime',error:'Resource limit in lane 0, instruction 4; no CPU fallback'},
    ]}};
    const input=join(dir,'raw.json'),output=join(dir,'classified.json');
    await writeFile(input,JSON.stringify(original));
    const run=()=>execFileSync(process.execPath,[fileURLToPath(new URL('./reclassify-test262-report.mjs',import.meta.url)),input,output],{stdio:['ignore','pipe','pipe']});
    run(); const derived=JSON.parse(await readFile(output,'utf8'));
    assert.deepEqual(JSON.parse(await readFile(input,'utf8')),original);
    assert.equal(derived.date,'original-date');
    assert.deepEqual(derived.report.counts,{passed:1,failed:0,unsupported:0,referenceRejected:0,resourceLimited:2});
    assert.deepEqual(derived.report.records.map(r=>r.originalStatus),['passed','failed','unsupported']);
    assert.equal(derived.report.reclassification.rerun,false);
    assert.match(derived.report.reclassification.sourceSha256,/^[a-f0-9]{64}$/);
    assert.throws(run); // Never overwrite an existing derived report.
  } finally { await rm(dir,{recursive:true,force:true}); }
});
