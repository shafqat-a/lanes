// Promise + async wave, worker 7 part A: the guest job queue (ES2025 9.5
// HostEnqueuePromiseJob + the host's job loop), its dispatch/resumption through
// main(), and completion publication (statuses 12/13/14).
//
// Everything here is GPU semantics: WGSL hooks plus one strict guest runner
// helper compiled by QuickJS. The host never runs a job, never inspects the
// queue and never synthesizes a settlement. This module never writes files;
// promiseJobsIntegrationEdits is an anchored recipe the parent composes on top
// of generatorIntegrationPatch(live,{iteratorPrototypeNode:77}).
//
// Layout (PROMISE-ASYNC-CONTRACT.md "Jobs"):
//   fixed node 92, kind 72: value=(headJob, tailJob, count, totalRun)
//   job cell kind 73:       value=payload A (V), key=payload cell, next=next job
//   payload cell kind 67:   value=payload B (V), key=job type, next=payload C cell (kind 67) or 0
//   payload C cell kind 67: value=payload C (V), key=0, next=0 (type 2 only)
// Job types: 1 PromiseReactionJob(A=reaction, B=argument) -> 2831
//            2 PromiseResolveThenableJob(A=promise, B=thenable, C=then) -> 2826
//            3 plain call A(B), receiver undefined (via __lanesCall 113)
//
// Draining (status 10, internal): finish() completing the outermost frame with
// a non-empty queue keeps the top-level result in states[l].result (a GC root:
// collect() marks it) and sets status 10. main() resolves status 10 in the same
// post-instruction block as status 9 (and, defensively, before the step loop
// of every dispatch), so it never reaches the output snapshot. jobDispatch
// dequeues FIFO, resets the depth-0 operand stack, calls the runner 2911 with
// frame tail 136; continuation 136 discards the runner's result and re-enters
// jobsSettle (status 10 again, or publication).
import { PROMISE_NODES, PROMISE_KINDS, PROMISE_CONTINUATIONS, PROMISE_STATUS, ASYNC_ID_RANGES } from './promise-ids.js';

export const JOB_QUEUE_NODE = PROMISE_NODES.jobQueue;          // 92
export const JOB_KINDS = Object.freeze({ header: PROMISE_KINDS.jobQueueHeader, job: PROMISE_KINDS.jobCell, payload: PROMISE_KINDS.jobPayload }); // 72 / 73 / 67
export const JOB_CONTINUATION = PROMISE_CONTINUATIONS.jobDone; // 136
export const JOB_STATUS = Object.freeze({ drain: PROMISE_STATUS.drainJobs, fulfilled: PROMISE_STATUS.resultFulfilled, rejected: PROMISE_STATUS.resultRejected, pending: PROMISE_STATUS.resultPending }); // 10 / 12 / 13 / 14
export const JOB_TYPES = Object.freeze({ reaction: 1, resolveThenable: 2, call: 3 });
export const PROMISE_JOB_IDS = Object.freeze({ enqueue: 2910, runner: 2911 });
for (const id of Object.values(PROMISE_JOB_IDS)) if (id < ASYNC_ID_RANGES.worker7[0] || id > ASYNC_ID_RANGES.worker7[1]) throw new Error(`job id ${id} outside worker-7 range`);
if (JOB_QUEUE_NODE !== 92 || JOB_KINDS.header !== 72 || JOB_KINDS.job !== 73 || JOB_KINDS.payload !== 67 || JOB_CONTINUATION !== 136) throw new Error('promise-ids drift (jobs)');

// ---- guest runner ---------------------------------------------------------------
// HostCallJobCallback is the identity (single realm). The runner's return value
// is discarded by continuation 136. Type 3 uses __lanesCall so the receiver is
// undefined. An unknown type is a trusted-code violation: __lanesUnsupported
// (status 6) rather than a guest-visible error.
export const promiseRunJobSource = `function promiseRunJobBootstrap(type, a, b, c) {
  "use strict";
  if (type === 1) { __promiseReactionJob(a, b); return undefined; }
  if (type === 2) { __promiseResolveThenableJob(a, b, c); return undefined; }
  if (type === 3) { __lanesCall(a, undefined, b); return undefined; }
  return __lanesUnsupported();
}`;
// FIELDS slot (not a public property name).
export const promiseJobSources = Object.freeze({ promiseRunJob: promiseRunJobSource });
export const promiseJobFields = Object.freeze(Object.keys(promiseJobSources));
export const promiseJobBuiltinFields = Object.freeze({ [PROMISE_JOB_IDS.runner]: 'promiseRunJob' });
// privateBuiltins OWNED here.
export const promiseJobPrivateBuiltins = Object.freeze({ __lanesEnqueueJob: PROMISE_JOB_IDS.enqueue, __promiseRunJob: PROMISE_JOB_IDS.runner });
// Names the runner calls, owned by other workers (registered by them).
export const promiseJobDependencies = Object.freeze({
  __promiseReactionJob: { id: 2831, owner: 'worker 3 (promise-then-source.js)' },
  __promiseResolveThenableJob: { id: 2826, owner: 'worker 2 (promise-resolve-source.js)' },
  __lanesCall: { id: 113, owner: 'existing' },
  __lanesUnsupported: { id: 141, owner: 'existing' },
});
export const promiseJobWGSLDependencies = Object.freeze({ promiseHeaderOf: 'worker 1: fn promiseHeaderOf(l:u32,v:V)->u32' });

// ---- WGSL -----------------------------------------------------------------------
const Q = JOB_QUEUE_NODE, KH = JOB_KINDS.header, KJ = JOB_KINDS.job, KP = JOB_KINDS.payload;
export const promiseJobWGSLFunctions = ({ F }) => {
  if (!('promiseRunJob' in F)) throw new Error('promise-jobs: FIELDS lacks promiseRunJob');
  return `
const JOB_QUEUE:u32=${Q}u;
// HostEnqueuePromiseJob. Never collects (callers collect at the start of their
// instruction while every payload is still on the operand stack). Exhaustion:
// false + status 3. Type 2 carries the third payload in a second cell.
fn jobEnqueue(l:u32,jobType:u32,a:V,b:V,c:V)->bool {
  if(states[l].status!=0u){return false;}
  if(states[l].heap[JOB_QUEUE].kind!=${KH}u||jobType<1u||jobType>3u){states[l].status=2u;return false;}
  var third=0u;
  if(jobType==2u){third=alloc(l,${KP}u,c,0u,0u);if(states[l].status!=0u){return false;}}
  let payload=alloc(l,${KP}u,b,jobType,third);
  if(states[l].status!=0u){return false;}
  let job=alloc(l,${KJ}u,a,payload,0u);
  if(states[l].status!=0u){return false;}
  let q=states[l].heap[JOB_QUEUE].value;
  if(q.y==0u){states[l].heap[JOB_QUEUE].value=V(job,job,q.z+1u,q.w);}
  else{states[l].heap[q.y].next=job;states[l].heap[JOB_QUEUE].value=V(q.x,job,q.z+1u,q.w);}
  return true;
}
fn jobsPending(l:u32)->bool {
  return states[l].heap[JOB_QUEUE].kind==${KH}u&&states[l].heap[JOB_QUEUE].value.x!=0u;
}
// Run completed with an empty queue: publish. states[l].result is the saved
// top-level completion value.
fn jobsPublish(l:u32) {
  let header=promiseHeaderOf(l,states[l].result);
  if(header==0u){states[l].status=1u;return;}
  let state=(states[l].heap[header].marked>>4u)&3u;
  if(state==1u){states[l].result=states[l].heap[header].value;states[l].status=${JOB_STATUS.fulfilled}u;}
  else if(state==2u){states[l].result=states[l].heap[header].value;states[l].status=${JOB_STATUS.rejected}u;}
  else{states[l].result=undef();states[l].status=${JOB_STATUS.pending}u;}
}
// Called by finish() on outermost completion (status 1, result saved) and by
// continuation ${JOB_CONTINUATION} (a job returned). Status 10 defers dispatch to main().
fn jobsSettle(l:u32) {
  if(jobsPending(l)){states[l].status=${JOB_STATUS.drain}u;return;}
  jobsPublish(l);
}
// main(): status 10 => dequeue the head job and call the runner with frame tail ${JOB_CONTINUATION}.
// Collects first while every queued payload is rooted through node ${Q}.
fn jobDispatch(l:u32) {
  if(states[l].status!=${JOB_STATUS.drain}u){return;}
  states[l].status=0u;
  if(states[l].depth!=0u||!jobsPending(l)){states[l].status=2u;return;}
  if(states[l].freeCount<192u){collect(l);}
  if(states[l].freeCount<64u){states[l].status=3u;return;}
  let q=states[l].heap[JOB_QUEUE].value;let job=q.x;
  if(states[l].heap[job].kind!=${KJ}u){states[l].status=2u;return;}
  let payload=states[l].heap[job].key;
  if(payload==0u||states[l].heap[payload].kind!=${KP}u){states[l].status=2u;return;}
  let jobType=states[l].heap[payload].key;let a=states[l].heap[job].value;let b=states[l].heap[payload].value;
  var c=undef();let third=states[l].heap[payload].next;
  if(third!=0u){if(states[l].heap[third].kind!=${KP}u){states[l].status=2u;return;}c=states[l].heap[third].value;}
  let helper=image[image[params.padding+1u].w+${F.promiseRunJob}u].y;
  if(helper==0u){states[l].status=6u;return;}
  // Every payload goes onto the operand stack (rooted) before the queue drops the job.
  states[l].sp=states[l].frames[0].base;states[l].env=states[l].frames[0].env;
  push(l,undef());push(l,num(fromUnsigned(jobType)));push(l,a);push(l,b);push(l,c);
  if(states[l].status!=0u){return;}
  let next=states[l].heap[job].next;
  states[l].heap[JOB_QUEUE].value=V(next,select(q.y,0u,next==0u),q.z-1u,q.w+1u);
  states[l].heap[job].next=0u;
  let runner=closure(l,helper-1u);
  if(states[l].status!=0u){return;}
  states[l].stack[states[l].frames[0].base]=runner;
  call(l,4u,false,false);
  if(states[l].status!=0u){return;}
  if(states[l].depth!=1u){states[l].status=2u;return;}
  states[l].frames[1].tail=${JOB_CONTINUATION}u;
}
`;
};

// collect() mark arm (inside the queue loop; `node` in scope). Head/tail are
// node ids in value.x/y (not V values), so they are marked explicitly; the
// generic mark(node.next) already follows job->job and payload->payload links.
export const promiseJobGCWGSL = `
    if(node.kind==${KH}u){mark(l,node.value.x);mark(l,node.value.y);}
    if(node.kind==${KJ}u){markValue(l,node.value);mark(l,node.key);}
    if(node.kind==${KP}u){markValue(l,node.value);}
`;
// main() init: node 92 written in place (kind != 0 => rooted by the reserved-range sweep).
export const promiseJobInitWGSL = `
    states[l].heap[${Q}u]=Node(V(0u,0u,0u,0u),0u,0u,${KH}u,0u);
`;
// call() hook for __lanesEnqueueJob(type,a,b,c): four arguments, so it cannot go
// through objectMethod (three). All arguments are on the live stack, so a
// collection here is safe; jobEnqueue itself never collects.
export const promiseJobCallWGSL = `  if(fnValue.z==11u&&fnValue.x==${PROMISE_JOB_IDS.enqueue}u){
    var jobArgs=array<V,4>(undef(),undef(),undef(),undef());
    for(var i=0u;i<4u;i++){if(i<argc){jobArgs[i]=states[l].stack[base+extra+i];}}
    if(jobArgs[0].z!=0u){states[l].status=2u;return;}
    if(states[l].freeCount<8u){collect(l);}
    if(!jobEnqueue(l,toBits(jobArgs[0].xy),jobArgs[1],jobArgs[2],jobArgs[3])){if(states[l].status==0u){states[l].status=2u;}return;}
    states[l].sp=base;if(tail){finish(l,undef());}else{push(l,undef());}return;
  }
`;
export const promiseJobDispatchWGSL = ({ F }) => Object.entries(promiseJobBuiltinFields).map(([id, field]) => `if(fnValue.x==${id}u){field=${F[field]}u;}`).join('\n    ');
// finish(): continuation 136 (else-if chain) and the outermost-completion hook.
export const promiseJobContinuationWGSL = `else if(continuation==${JOB_CONTINUATION}u){jobsSettle(l);}\n  `;
export const promiseJobCompleteWGSL = `  if(complete&&states[l].status==1u){jobsSettle(l);}\n`;
export const promiseJobMainWGSL = `    jobDispatch(l);\n`;

// ---- integration edits ----------------------------------------------------------
const IMPORT = "import {promiseJobWGSLFunctions,promiseJobGCWGSL,promiseJobInitWGSL,promiseJobCallWGSL,promiseJobDispatchWGSL,promiseJobContinuationWGSL,promiseJobCompleteWGSL,promiseJobMainWGSL} from './promise-jobs-source.js';";
const PUBLISHED = '(states[l].status==1u||states[l].status==12u||states[l].status==13u)';
export const promiseJobsIntegrationEdits = Object.freeze([
  { file: 'program.js', anchor: 'export const FIELDS =', position: 'before',
    text: "for(const name of ['promiseRunJob'])if(!fieldNames.includes(name))fieldNames.push(name);\n", why: 'append-only FIELDS slot for the job runner helper' },
  { file: 'bootstrap.js', anchor: "import { phase4BootstrapSources, phase4PrivateBuiltins, protocolBootstrapSources } from './phase4-registry.js';", position: 'after',
    text: "\nimport { promiseJobSources, promiseJobPrivateBuiltins } from './promise-jobs-source.js';", why: 'import runner source + private names' },
  { file: 'bootstrap.js', anchor: '  ...phase3BigintConversionIntrinsics,', position: 'before',
    text: '  ...promiseJobPrivateBuiltins,\n', why: 'privateBuiltins: __lanesEnqueueJob 2910, __promiseRunJob 2911' },
  { file: 'bootstrap.js', anchor: '  ...generatorDelegationSources,', position: 'after',
    text: '\n  ...promiseJobSources,', why: 'bootstrapSources: promiseRunJob' },
  { file: 'shader.js', anchor: "import { LIMITS as L, OP, FIELDS as F, objectStaticPlaceholders, numberWords } from './program.js';", position: 'after',
    text: '\n' + IMPORT, why: 'job-queue WGSL fragments' },
  { file: 'shader.js', anchor: '    ${generatorGCWGSL}', position: 'after',
    text: '\n    ${promiseJobGCWGSL}', why: 'GC: queue header head/tail, job cells, payload cells' },
  { file: 'shader.js', anchor: '    if(fnValue.x==960u){field=${F.numberPow}u;}', position: 'before',
    text: '    ${promiseJobDispatchWGSL({F})}\n', why: 'call(): 2911 -> promiseRunJob closure' },
  { file: 'shader.js', anchor: '  if(fnValue.z==11u&&fnValue.x>=2500u&&fnValue.x<=2502u){', position: 'before',
    text: '${promiseJobCallWGSL}', why: 'call(): __lanesEnqueueJob(type,a,b,c) (4 args, normalized after bound/call/apply unwrapping)' },
  { file: 'shader.js', anchor: '  ${phase4Finish.map(', position: 'before',
    text: '  ${promiseJobContinuationWGSL}', why: 'finish(): continuation 136 (job returned) re-enters jobsSettle' },
  { file: 'shader.js', anchor: '  else if(!omitResult){push(l,returned);}\n', position: 'after',
    text: '${promiseJobCompleteWGSL}', why: 'finish(): outermost completion with queued jobs => status 10 / publication 1,12,13,14' },
  { file: 'shader.js', anchor: '${phase4WGSLFunctions(phase4Context)}', position: 'before',
    text: '${promiseJobWGSLFunctions({F})}\n', why: 'module-scope job functions' },
  { file: 'shader.js', anchor: '    // Fixed node 65: global object (phase4-global.js), global-object mode only.', position: 'before',
    text: '    ${promiseJobInitWGSL}\n', why: 'init fixed node 92 (requires FIXED_RESERVED_LAST >= 92)' },
  { file: 'shader.js', anchor: '  }\n  output[l].status=states[l].status;output[l].steps=states[l].steps;', position: 'replace',
    text: '${promiseJobMainWGSL}  }\n  output[l].status=select(states[l].status,0u,states[l].status==10u||states[l].status==11u);output[l].steps=states[l].steps;',
    why: 'main(): resolve status 10 at the end of the post-instruction block (after status 9 and any status-11 dispatch, so a 10 produced there is handled in the same iteration); internal statuses 10/11 are published as 0 (running) and persist in state' },
  { file: 'shader.js', anchor: '  for (var step=0u;step<params.budget && states[l].status==0u;step++) {', position: 'before',
    text: '  jobDispatch(l);\n', why: 'main(): defensive resume of a persisted status 10 at the start of a dispatch' },
  { file: 'shader.js', anchor: '  if(states[l].status==1u && states[l].result.z==7u) {', position: 'replace',
    text: `  if(${PUBLISHED} && states[l].result.z==7u) {`, why: 'output: statuses 12/13 publish string chars like status 1' },
  { file: 'shader.js', anchor: '  if(states[l].status==1u && states[l].result.z==18u){', position: 'replace',
    text: `  if(${PUBLISHED} && states[l].result.z==18u){`, why: 'output: statuses 12/13 publish BigInt limbs like status 1' },
]);

export function applyEdits(files, edits, label = 'edit') {
  const out = { ...files };
  for (const e of edits) {
    const s = out[e.file];
    if (typeof s !== 'string') throw new Error(`${label}: missing file ${e.file}`);
    const n = s.split(e.anchor).length - 1;
    if (n !== 1) throw new Error(`${label}: anchor matched ${n} times: ${e.file}: ${e.anchor.slice(0, 90)}`);
    out[e.file] = e.position === 'replace' ? s.replace(e.anchor, () => e.text)
      : e.position === 'before' ? s.replace(e.anchor, () => e.text + e.anchor)
      : s.replace(e.anchor, () => e.anchor + e.text);
  }
  return out;
}

// Proposed host change (parent applies; runtime.js is not edited by workers).
export const promiseJobsRuntimeProposal = `--- a/experiments/quickjs-runtime/runtime.js
+++ b/experiments/quickjs-runtime/runtime.js
@@ async start(program, inputs, { signal } = {}) {
-  async start(program, inputs, { signal } = {}) {
+  async start(program, inputs, { signal, promiseResults } = {}) {
     signal?.throwIfAborted();
     this.#check(); checkProgram(program);
+    if (promiseResults !== undefined && promiseResults !== 'settle') throw new TypeError("promiseResults must be 'settle' or undefined");
@@ step: (budget = 256) => {
-          const values = [], statuses = [], steps = [], collections = [];
+          const values = [], statuses = [], steps = [], collections = [], settlements = [];
+          // 12/13/14: script completed and the guest job queue drained; the
+          // top-level result was a fulfilled/rejected/never-settling promise.
+          // 10/11 are internal: the shader publishes them as 0 (running) and
+          // resumes them on the next dispatch; accept them defensively here too.
+          const SETTLED = { 12: 'fulfilled', 13: 'rejected', 14: 'pending' };
           for (let i = 0; i < count; i++) {
             const status = words[i * SNAPSHOT_WORDS]; statuses.push(status); steps.push(words[i * SNAPSHOT_WORDS + 1]); collections.push(words[i * SNAPSHOT_WORDS + 2]);
-            if (status >= 2) {
+            const settled = SETTLED[status];
+            if (settled && promiseResults !== 'settle') throw new TypeError(\`Promise result in lane \${i}: pass { promiseResults: 'settle' }; no CPU fallback\`);
+            if (status >= 2 && !settled && status !== 10 && status !== 11) {
               const reasons = { 2: 'Invalid bytecode state', 3: 'Resource limit', 4: 'TypeError', 5: 'ReferenceError', 6: 'Unsupported runtime operation', 7: 'Uncaught guest exception', 8: 'RangeError' };
               throw new Error(\`\${reasons[status]} in lane \${i}, instruction \${words[i * SNAPSHOT_WORDS + 3] - 1}; no CPU fallback\`);
             }
-            values.push(status === 1 ? decode(words, i * SNAPSHOT_WORDS + 4, program.image) : undefined);
+            settlements.push(settled);
+            values.push(status === 1 || status === 12 || status === 13 ? decode(words, i * SNAPSHOT_WORDS + 4, program.image) : undefined);
           }
-          return { backend: 'gpu', done: statuses.every(s => s === 1), values, statuses, steps, collections };
+          return { backend: 'gpu', done: statuses.every(s => s === 1 || s in SETTLED), values, statuses, steps, collections, ...(promiseResults === 'settle' ? { settlements } : {}) };
@@ async run(program, inputs, { budget = 256, maxDispatches = 1024, signal } = {}) {
-  async run(program, inputs, { budget = 256, maxDispatches = 1024, signal } = {}) {
+  async run(program, inputs, { budget = 256, maxDispatches = 1024, signal, promiseResults } = {}) {
     positive(budget, 4096, 'Budget'); positive(maxDispatches, 100000, 'Dispatch limit'); signal?.throwIfAborted();
-    const job = await this.start(program, inputs, { signal });
+    const job = await this.start(program, inputs, { signal, promiseResults });
`;

export const promiseJobsGaps = Object.freeze([
  'An uncaught exception escaping a job (only possible for type 3 or a trusted-helper bug; reaction/thenable jobs catch handler errors) ends the lane with status 7 (contract). ES2025 hosts report it (HostReportErrors) and keep draining; this VM stops.',
  'Starvation: an endless job chain (e.g. a then-loop that re-schedules itself) only consumes steps; each dispatch resumes draining and the host maxDispatches limit ends the run ("Execution limit"). There is no separate job budget.',
  'Jobs queued after an uncaught top-level exception are not run (status 7 is terminal).',
  'A rejected top-level promise whose reason is an object publishes status 13 with an object value; the host decode reports object results as unsupported exactly like status 1.',
  'Requires parent changes: FIXED_RESERVED_LAST >= 92 (contract: 105) so node 92 is excluded from allocation/sweep and rooted, and the runtime.js proposal for statuses 12/13/14.',
]);
