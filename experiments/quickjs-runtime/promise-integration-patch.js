// Parent-owned, explicit integration recipe for the Promise + async wave.
// Returns patched source strings; never writes files. Applies on top of
// generatorIntegrationPatch (async functions reuse the generator activation
// contract). Every edit requires exactly one anchor match; drift fails loudly.
import { generatorIntegrationPatch } from './generator-integration-patch.js';
import { FIXED_RESERVED_LAST_REQUIRED, assertDisjointRanges } from './reserved-ranges.js';
import { promiseCoreIntegrationEdits } from './promise-core-source.js';
import { promiseResolveIntegrationEdits } from './promise-resolve-source.js';
import { promiseThenIntegrationEdits } from './promise-then-source.js';
import { promiseCombinatorsIntegrationEdits } from './promise-combinators-source.js';
import { promiseJobsIntegrationEdits } from './promise-jobs-source.js';
import { asyncFunctionIntegrationEdits } from './async-function-source.js';
import { asyncGeneratorIntegrationEdits } from './async-generator-source.js';
import { asyncIterationIntegrationEdits } from './async-iteration-source.js';

export const PROMISE_INTEGRATION_FILES = Object.freeze([
  'program.js', 'phase4-registry.js', 'phase4-class-elements.js', 'phase4-classes.js', 'phase4-global.js',
  'phase4-fixed-nodes.js', 'phase4-iteration.js', 'bootstrap.js', 'shader.js', 'runtime.js',
]);

// Reserved-range machinery: 86..105 join the never-allocated, never-swept
// fixed range (86..89 RegExp, 90..105 Promise/async). shader.js, the
// conformance checks and freeCount all derive from this constant.
export const reservedRangeEdits = Object.freeze([
  { file: 'phase4-fixed-nodes.js', anchor: 'export const FIXED_RESERVED_LAST = 85;', position: 'replace',
    text: `// 86..89 RegExp (Grok), 90..105 Promise + async (promise-ids.js, reserved-ranges.js).\nexport const FIXED_RESERVED_LAST = ${FIXED_RESERVED_LAST_REQUIRED};`,
    why: 'exclude every reserved fixed node from the free list and sweep' },
  { file: 'phase4-fixed-nodes.js', anchor: "//     hand out a reserved node (node 25's successor is 86);", position: 'replace',
    text: `//     hand out a reserved node (node 25's successor is ${FIXED_RESERVED_LAST_REQUIRED + 1});`, why: 'comment' },
]);

// Internal statuses 10/11 are published as 0 (running) and persist in state.
// Worker 7 resumes a persisted 10 before the step loop; a persisted 11 must be
// resumed too (it can settle the async promise and then request draining),
// otherwise the step loop never runs again and the lane never completes.
export const parentGuardEdits = Object.freeze([
  { file: 'shader.js', anchor: '  jobDispatch(l);\n  for (var step=0u;step<params.budget && states[l].status==0u;step++) {', position: 'before',
    text: '  asyncRejectDispatch(l);\n', why: 'resume a persisted status 11 before a persisted status 10' },
]);

// Host API: wait for guest async results without running guest callbacks on
// the CPU. Statuses 12/13/14 are published by the GPU only after the guest job
// queue drained; the host merely decodes them. Opt-in per job.
export const hostApiEdits = Object.freeze([
  { file: 'runtime.js', anchor: '  async start(program, inputs, { signal } = {}) {\n    signal?.throwIfAborted();',
    position: 'replace',
    text: `  async start(program, inputs, { signal, promiseResults } = {}) {
    signal?.throwIfAborted();
    if (promiseResults !== undefined && promiseResults !== 'settle') throw new TypeError("promiseResults must be undefined or 'settle'");`,
    why: 'opt-in promise settlement reporting' },
  { file: 'runtime.js', anchor: `          const values = [], statuses = [], steps = [], collections = [];`, position: 'replace',
    text: `          const values = [], statuses = [], steps = [], collections = [], settlements = [];`, why: 'settlements' },
  { file: 'runtime.js', anchor: `            if (status >= 2) {`, position: 'replace',
    text: `            // 12/13/14: script and guest job queue completed on GPU with a promise result.
            const settlement = status >= 12 && status <= 14 ? ['fulfilled', 'rejected', 'pending'][status - 12] : undefined;
            if (settlement && promiseResults !== 'settle') throw new TypeError(\`Promise result (\${settlement}) in lane \${i} requires { promiseResults: 'settle' }; no CPU fallback\`);
            settlements.push(settlement);
            if (status >= 2 && !settlement) {`, why: 'settled statuses are not errors when requested' },
  { file: 'runtime.js', anchor: `            values.push(status === 1 ? decode(words, i * SNAPSHOT_WORDS + 4, program.image) : undefined);`, position: 'replace',
    text: `            values.push(status === 1 || status === 12 || status === 13 ? decode(words, i * SNAPSHOT_WORDS + 4, program.image) : undefined);`,
    why: 'decode fulfillment value / rejection reason exactly like a completion value' },
  { file: 'runtime.js', anchor: `          return { backend: 'gpu', done: statuses.every(s => s === 1), values, statuses, steps, collections };`, position: 'replace',
    text: `          return { backend: 'gpu', done: statuses.every(s => s === 1 || (s >= 12 && s <= 14)), values, statuses, steps, collections, settlements };`,
    why: 'a published settlement is a completed lane' },
  { file: 'runtime.js', anchor: `  async run(program, inputs, { budget = 256, maxDispatches = 1024, signal } = {}) {`, position: 'replace',
    text: `  async run(program, inputs, { budget = 256, maxDispatches = 1024, signal, promiseResults } = {}) {`, why: 'pass-through' },
  { file: 'runtime.js', anchor: `    const job = await this.start(program, inputs, { signal });`, position: 'replace',
    text: `    const job = await this.start(program, inputs, { signal, promiseResults });`, why: 'pass-through' },
]);

export function applyEdits(files, edits, label) {
  const out = { ...files };
  for (const e of edits) {
    const s = out[e.file];
    if (typeof s !== 'string') throw new Error(`${label}: missing file ${e.file}`);
    const n = s.split(e.anchor).length - 1;
    if (n !== 1) throw new Error(`${label}: anchor matched ${n} times in ${e.file}: ${e.anchor.slice(0, 100)}`);
    out[e.file] = s.replace(e.anchor, () => e.position === 'before' ? e.text + e.anchor : e.position === 'after' ? e.anchor + e.text : e.text);
  }
  return out;
}

// Worker edit lists in application order. Order matters only where documented:
// worker 1 initializes nodes 90/91 before worker 3/4 install methods on them.
export async function promiseWaveEdits() {
  const groups = [
    ['reserved-ranges', reservedRangeEdits],
    ['worker1 promise-core', promiseCoreIntegrationEdits],
    ['worker2 promise-resolve', promiseResolveIntegrationEdits],
    ['worker3 promise-then', promiseThenIntegrationEdits],
    ['worker4 promise-combinators', promiseCombinatorsIntegrationEdits],
    ['worker7 promise-jobs', promiseJobsIntegrationEdits],
    ['worker5 async-function', asyncFunctionIntegrationEdits],
    ['worker6 async-generator', asyncGeneratorIntegrationEdits],
    ['worker7 async-iteration', asyncIterationIntegrationEdits],
    ['parent guards', parentGuardEdits],
    ['host api', hostApiEdits],
  ];
  return groups;
}

export async function promiseIntegrationPatch(original) {
  assertDisjointRanges();
  if(original['shader.js'].includes("from './promise-core-source.js'")){
    if(!original['runtime.js'].includes('promiseResults')||!original['program.js'].includes('ASYNC_GENERATOR_INFO_BITS'))throw new Error('Partial Promise integration detected');
    return {...original};
  }
  // The coordinator may already have qualified and installed generators.
  let files = original['program.js'].includes('GENERATOR_KIND_BIT')
    ? { ...original } : generatorIntegrationPatch(original, { iteratorPrototypeNode: 77 });
  for (const name of PROMISE_INTEGRATION_FILES) if (typeof files[name] !== 'string') files[name] = original[name];
  for (const [label, edits] of await promiseWaveEdits()) files = applyEdits(files, edits, label);
  return files;
}
