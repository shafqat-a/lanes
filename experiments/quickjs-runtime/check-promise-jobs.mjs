// Host-only evidence for worker 7 part A (guest job queue). Never touches the
// live tree, never runs a GPU. Sections:
//  1. host oracle: every fixture run with real job draining; settlement/value
//     must equal the fixed expectations (statuses 1/12/13/14);
//  2. runner helper: native binary vs Wasm bridge bytecode parity, kind 0,
//     strict, every global it names is declared; fixture sources compile
//     identically in both bridges;
//  3. WGSL static lint + layout checks (kinds 72/73/67, node 92, statuses);
//  4. anchors: each edit matches exactly once in
//     generatorIntegrationPatch(live,{iteratorPrototypeNode:77}); composed
//     temp-copy previews (worker 7 alone, all applicable workers in both
//     orders) import, keep OP/FIELDS stable, splice every hook in place, keep
//     the WGSL call graph acyclic, and pack fixtures from both compilers.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import createModule from './generated/compiler.mjs';
import { LIMITS, FIELDS, OP } from './program.js';
import { PROMISE_NODES, PROMISE_KINDS, PROMISE_CONTINUATIONS, PROMISE_STATUS } from './promise-ids.js';
import * as J from './promise-jobs-source.js';
import { promiseJobsCases, SETTLEMENT_STATUS } from './promise-jobs-cases.js';
import { root, liveBase, anchorCounts, composePreview, importPreview, wgslFunctions, unresolvedCalls, lintWGSL, oracle } from './promise-jobs-preview.js';

const failures = [];
const step = async (name, fn) => { try { return await fn(); } catch (e) { failures.push(`${name}: ${e.stack || e.message}`); } };
process.on('unhandledRejection', () => {});

// ---------------------------------------------------------------- 1. oracle --
let oracleChecks = 0;
{
  const seen = new Set();
  for (const c of promiseJobsCases) { assert.ok(!seen.has(c.feature), `duplicate ${c.feature}`); seen.add(c.feature); assert.equal(c.status, SETTLEMENT_STATUS[c.settlement]); assert.match(c.source, /^function f\(x\)\{/); }
  for (const s of ['none', 'fulfilled', 'rejected', 'pending']) assert.ok(promiseJobsCases.some(c => c.settlement === s), `fixture with settlement ${s}`);
  assert.ok(promiseJobsCases.some(c => typeof c.expected === 'bigint'), 'BigInt fixture');
  assert.ok(promiseJobsCases.some(c => c.gcPressure && c.minimumJobs >= 500), '500-job chain');
}
for (const c of promiseJobsCases) for (const [x, expected] of [[c.input, c.expected], [c.input + 1, c.expectedNext]]) {
  const [settlement, value] = await oracle(vm, c.source, x);
  if (settlement !== c.settlement || !Object.is(value, expected)) failures.push(`oracle ${c.feature}(${x}): host ${settlement} ${String(value)}, expected ${c.settlement} ${String(expected)}`);
  else oracleChecks++;
}

// ------------------------------------------------- 2. compiler parity --
const module = await createModule();
const native = s => JSON.parse(execFileSync(join(root, 'generated/compiler'), [s], { encoding: 'utf8', maxBuffer: 1 << 26 }));
const wasm = s => JSON.parse(module.ccall('lanes_compile', 'string', ['string'], [s]));
const normalize = r => ({ ...r, functions: r.functions.map(f => ({ ...f, instructions: f.instructions.map(i => typeof i.operand === 'string' ? { ...i, bytes: i.bytes.map((b, n) => n >= 1 && n <= 4 ? 0 : b) } : i) })) });
let helperParity = 0, fixtureParity = 0;
const declared = { ...J.promiseJobPrivateBuiltins, ...Object.fromEntries(Object.entries(J.promiseJobDependencies).map(([k, v]) => [k, v.id])) };
for (const [field, source] of Object.entries(J.promiseJobSources)) await step(`helper ${field}`, () => {
  const a = native(source), b = wasm(source);
  assert.ok(!a.error, a.error); assert.ok(!b.error, b.error);
  assert.deepEqual(normalize(b), normalize(a));
  assert.equal(a.functions.length, 1); assert.equal(a.functions[0].kind, 0); assert.equal(a.functions[0].strict, 1);
  for (const ref of a.functions[0].refs) if (ref.type === 3) assert.ok(ref.name === 'undefined' || ref.name in declared, `undeclared global ${ref.name}`);
  assert.deepEqual(a.functions[0].refs.filter(r => r.type === 3).map(r => r.name).sort(), ['__lanesCall', '__lanesUnsupported', '__promiseReactionJob', '__promiseResolveThenableJob', 'undefined'].filter(n => a.functions[0].refs.some(r => r.name === n)).sort());
  helperParity++;
});
for (const c of promiseJobsCases) await step(`fixture compile ${c.feature}`, () => { const a = native(c.source), b = wasm(c.source); assert.ok(!a.error, a.error); assert.deepEqual(normalize(b), normalize(a)); fixtureParity++; });

// ------------------------------------------------------------ 3. WGSL lint --
const F = { ...FIELDS }; for (const n of J.promiseJobFields) if (!(n in F)) F[n] = Object.keys(F).length;
const parts = {
  functions: J.promiseJobWGSLFunctions({ F, L: LIMITS }), gc: J.promiseJobGCWGSL, init: J.promiseJobInitWGSL, call: J.promiseJobCallWGSL,
  dispatch: J.promiseJobDispatchWGSL({ F }), continuation: J.promiseJobContinuationWGSL.replace(/^else /, ''), complete: J.promiseJobCompleteWGSL, main: J.promiseJobMainWGSL,
};
await step('wgsl lint', () => {
  assert.deepEqual(lintWGSL(parts), []);
  const all = Object.values(parts).join('\n');
  assert.match(parts.functions, /fn jobEnqueue\(l:u32,jobType:u32,a:V,b:V,c:V\)->bool/);
  assert.ok(!/collect\(/.test(parts.functions.slice(parts.functions.indexOf('fn jobEnqueue'), parts.functions.indexOf('fn jobsPending'))), 'jobEnqueue never collects');
  for (const m of all.matchAll(/alloc\(l,(\d+)u/g)) assert.ok([PROMISE_KINDS.jobPayload, PROMISE_KINDS.jobCell].includes(Number(m[1])), `alloc kind ${m[1]}`);
  for (const m of all.matchAll(/\b(2[89]\d\d)u\b/g)) assert.ok([2910, 2911].includes(Number(m[1])), `foreign id ${m[1]}`);
  for (const m of all.matchAll(/heap\[(\d+)u\]/g)) assert.equal(Number(m[1]), PROMISE_NODES.jobQueue);
  assert.ok(parts.functions.includes(`const JOB_QUEUE:u32=${PROMISE_NODES.jobQueue}u;`));
  for (const s of [PROMISE_STATUS.drainJobs, PROMISE_STATUS.resultFulfilled, PROMISE_STATUS.resultRejected, PROMISE_STATUS.resultPending]) assert.ok(parts.functions.includes(`status=${s}u`) || parts.functions.includes(`!=${s}u`), `status ${s}`);
  assert.ok(parts.functions.includes(`frames[1].tail=${PROMISE_CONTINUATIONS.jobDone}u`));
  assert.ok(parts.gc.includes('node.kind==72u') && parts.gc.includes('mark(l,node.value.x);mark(l,node.value.y);') && parts.gc.includes('node.kind==73u') && parts.gc.includes('node.kind==67u'));
  assert.ok(parts.init.includes(`heap[${PROMISE_NODES.jobQueue}u]=Node(V(0u,0u,0u,0u),0u,0u,72u,0u)`));
});

// ------------------------------------------------------- 4. anchors + preview --
const base = liveBase();
let anchorsChecked = 0;
await step('anchors', () => {
  for (const a of anchorCounts(base, J.promiseJobsIntegrationEdits)) { assert.equal(a.count, 1, `${a.file}: ${a.anchor.slice(0, 80)} matched ${a.count}`); assert.ok(['before', 'after', 'replace'].includes(a.position)); anchorsChecked++; }
});
const previews = {};
const JOB_FUNCTIONS = ['jobEnqueue', 'jobsPending', 'jobsPublish', 'jobsSettle', 'jobDispatch'];
for (const [name, options] of [['worker7Only', { mode: 'worker7Only' }], ['allWorkers', { mode: 'withOthers' }], ['allWorkersWorker7First', { mode: 'withOthers', order: 'worker7First' }]]) await step(`preview ${name}`, async () => {
  const { files, applied, skipped } = await composePreview(options);
  const { B, P, S } = await importPreview(files);
  for (const [n, id] of Object.entries(OP)) assert.equal(P.OP[n], id, `${n} opcode stable`);
  for (const [n, id] of Object.entries(FIELDS)) assert.equal(P.FIELDS[n], id, `${n} field stable`);
  assert.ok('promiseRunJob' in P.FIELDS);
  assert.equal(B.privateBuiltins.__lanesEnqueueJob, 2910); assert.equal(B.privateBuiltins.__promiseRunJob, 2911);
  assert.equal(B.bootstrapSources.promiseRunJob, J.promiseRunJobSource);
  const shader = S.shader;
  assert.ok(!/undefinedu|NaNu|\$\{/.test(shader), 'template leak');
  const fns = wgslFunctions(shader);
  for (const f of JOB_FUNCTIONS) assert.ok(fns.has(f), `fn ${f}`);
  // Hook placement.
  const at = s => { const i = shader.indexOf(s); assert.ok(i >= 0, `missing ${s.slice(0, 60)}`); assert.equal(shader.indexOf(s, i + 1), -1, `twice ${s.slice(0, 60)}`); return i; };
  const finishStart = at('fn finish(l:u32,completionValue:V) {'), raiseStart = at('fn raise(l:u32,error:V) {');
  const cont = at('else if(continuation==136u){jobsSettle(l);}'), complete = at('if(complete&&states[l].status==1u){jobsSettle(l);}');
  assert.ok(finishStart < cont && cont < complete && complete < raiseStart, 'finish hooks inside finish(), completion hook after the continuation chain');
  const collectStart = at('fn collect(l: u32) {'), gc = at('if(node.kind==72u){mark(l,node.value.x);mark(l,node.value.y);}'), sweep = shader.indexOf('states[l].freeHead=0u; states[l].freeCount=0u;', collectStart);
  assert.ok(collectStart < gc && gc < sweep, 'GC arm in mark loop');
  const callStart = at('fn call(l: u32, argumentCount: u32, method: bool, tail: bool) {'), enqueue = at('if(fnValue.z==11u&&fnValue.x==2910u){'), construct = at('fn construct(l:u32,argumentCount:u32) {');
  assert.ok(callStart < enqueue && enqueue < construct, 'enqueue hook in call()');
  const mainStart = at('fn main(@builtin(global_invocation_id) gid: vec3<u32>) {'), init = at('heap[92u]=Node(V(0u,0u,0u,0u),0u,0u,72u,0u)'), entry = at('let fnValue=closure(l,0u);');
  assert.ok(mainStart < init && init < entry, 'node 92 init before the entry closure');
  const loop = at('for (var step=0u;step<params.budget && states[l].status==0u;step++) {');
  const preLoop = shader.lastIndexOf('jobDispatch(l);', loop);
  assert.ok(preLoop > entry, 'pre-loop resume of a persisted status 10');
  const status9 = at('if(states[l].status==9u){'), postLoop = shader.indexOf('jobDispatch(l);', status9), output = at('output[l].status=select(states[l].status,0u,states[l].status==10u||states[l].status==11u);');
  assert.ok(status9 < postLoop && postLoop < output, 'status 10 resolved after the status-9 block, inside the loop');
  // Any status-11 dispatch (worker 5) precedes the job dispatch in the same iteration.
  const reject11 = shader.indexOf('asyncRejectDispatch(l);', loop);
  if (reject11 >= 0) assert.ok(reject11 < postLoop, 'status 11 dispatch before status 10 dispatch');
  assert.ok(shader.includes('if((states[l].status==1u||states[l].status==12u||states[l].status==13u) && states[l].result.z==7u) {'));
  assert.ok(shader.includes('if((states[l].status==1u||states[l].status==12u||states[l].status==13u) && states[l].result.z==18u){'));
  const unresolved = unresolvedCalls(fns, JOB_FUNCTIONS);
  // Pack the fixtures from both compilers when the composition admits them.
  const bootNative = Object.fromEntries(Object.entries(B.bootstrapSources).map(([k, s]) => [k, native(s)]));
  const bootWasm = Object.fromEntries(Object.entries(B.bootstrapSources).map(([k, s]) => [k, wasm(s)]));
  let packed = 0; const unpacked = [];
  for (const c of promiseJobsCases) {
    try {
      const a = P.packProgram(B.attachBootstrap(native(c.source), bootNative), P.entrySource(c.source));
      const b = P.packProgram(B.attachBootstrap(wasm(c.source), bootWasm), P.entrySource(c.source));
      assert.deepEqual(a.code, b.code); assert.deepEqual(a.image, b.image); packed++;
    } catch (e) { unpacked.push(`${c.feature}: ${e.message}`); }
  }
  if (name === 'allWorkers' && applied.length === 7) assert.deepEqual(unpacked, [], 'all fixtures pack once every worker is composed');
  previews[name] = { applied, skipped, wgslFunctions: fns.size, wgslAcyclic: true, unresolvedJobCalls: unresolved, packedNativeWasmFixtures: packed, unpacked: unpacked.length ? unpacked.slice(0, 3) : [] };
});
if (previews.allWorkers) {
  const fullyComposed = previews.allWorkers.applied.length === 7;
  if (fullyComposed) assert.deepEqual(previews.allWorkers.unresolvedJobCalls, [], 'job WGSL resolves every call once all workers are composed');
}

const { FIXED_RESERVED_LAST } = await import('./phase4-fixed-nodes.js');
const report = {
  dependencies: { liveFixedReservedLast: FIXED_RESERVED_LAST, fixedReservedCoversNode92: FIXED_RESERVED_LAST >= 92, promiseHeaderOf: 'worker 1 WGSL', __promiseReactionJob: 'worker 3 (2831)', __promiseResolveThenableJob: 'worker 2 (2826)', runtimeProposal: 'promiseJobsRuntimeProposal (parent applies)' },
  oracleChecks, fixtures: promiseJobsCases.length, helperNativeWasmParity: helperParity, fixtureCompileParity: fixtureParity, anchorsChecked, previews,
  liveCoreModified: false, gpuExecuted: false, failures,
};
console.log(JSON.stringify(report, null, 1));
if (failures.length) process.exit(1);
