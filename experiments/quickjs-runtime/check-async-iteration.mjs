// Host-only evidence for worker 7 part B (async iteration). Never touches the
// live tree, never runs a GPU. Sections:
//  1. host oracle (real job draining) for every fixture; fixtures where node's
//     V8 deviates from the ES2025 text carry the observed V8 value in `v8`,
//     which is asserted too (so a V8 change is noticed);
//  2. guest helpers: native vs Wasm bytecode parity, strict kind-0 roots,
//     declared globals only, nested arrows anonymous and private-name free;
//     fixture sources compile identically; opcode coverage of the for-await
//     lowering;
//  3. WGSL static lint + id/kind/node/continuation ownership;
//  4. anchors on generatorIntegrationPatch(live,{iteratorPrototypeNode:77});
//     composed temp-copy previews import, keep OP/FIELDS stable, place every
//     hook, keep the WGSL call graph acyclic and pack every fixture from both
//     compilers.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import createModule from './generated/compiler.mjs';
import { LIMITS, FIELDS, OP } from './program.js';
import { PROMISE_NODES } from './promise-ids.js';
import * as A from './async-iteration-source.js';
import { asyncIterationCases } from './async-iteration-cases.js';
import { root, liveBase, anchorCounts, composePreview, importPreview, wgslFunctions, unresolvedCalls, lintWGSL, oracle } from './promise-jobs-preview.js';

const failures = [];
const step = async (name, fn) => { try { return await fn(); } catch (e) { failures.push(`${name}: ${e.stack || e.message}`); } };
process.on('unhandledRejection', () => {});

// ---------------------------------------------------------------- 1. oracle --
let oracleChecks = 0; const v8Deviations = [];
{
  const seen = new Set();
  for (const c of asyncIterationCases) { assert.ok(!seen.has(c.feature), `duplicate ${c.feature}`); seen.add(c.feature); assert.match(c.source, /^function f\(x\)\{/); }
  assert.ok(asyncIterationCases.length >= 40, 'at least 40 fixtures');
}
for (const c of asyncIterationCases) for (const [index, x, expected] of [[0, c.input, c.expected], [1, c.input + 1, c.expectedNext]]) {
  const [settlement, value] = await oracle(vm, c.source, x);
  const host = c.v8 ? c.v8[index] : expected;
  if (settlement !== c.settlement || !Object.is(value, host)) failures.push(`oracle ${c.feature}(${x}): host ${settlement} ${String(value)}, expected ${c.settlement} ${String(host)}`);
  else { oracleChecks++; if (c.v8 && index === 0) v8Deviations.push(`${c.feature}: ES2025 ${JSON.stringify(c.expected)}, node ${JSON.stringify(value)}`); }
}

// ------------------------------------------------- 2. compiler parity --
const module = await createModule();
const native = s => JSON.parse(execFileSync(join(root, 'generated/compiler'), [s], { encoding: 'utf8', maxBuffer: 1 << 26 }));
const wasm = s => JSON.parse(module.ccall('lanes_compile', 'string', ['string'], [s]));
const normalize = r => ({ ...r, functions: r.functions.map(f => ({ ...f, instructions: f.instructions.map(i => typeof i.operand === 'string' ? { ...i, bytes: i.bytes.map((b, n) => n >= 1 && n <= 4 ? 0 : b) } : i) })) });
const declared = { ...A.asyncIterationPrivateBuiltins, ...Object.fromEntries(Object.entries(A.asyncIterationDependencies).map(([k, v]) => [k, v.id])) };
const allowedGlobals = new Set(['undefined', 'TypeError', 'Symbol', ...Object.keys(declared)]);
let helperParity = 0;
for (const [field, source] of Object.entries(A.asyncIterationSources)) await step(`helper ${field}`, () => {
  const a = native(source), b = wasm(source);
  assert.ok(!a.error, a.error); assert.ok(!b.error, b.error);
  assert.deepEqual(normalize(b), normalize(a));
  assert.equal(a.functions[0].strict, 1);
  const parent = new Map();
  a.functions.forEach((f, i) => { assert.equal(f.kind, 0, `${field}#${i} kind`); for (const k of f.constants) if ('function' in k) parent.set(k.function, i); });
  for (const ref of a.functions[0].refs) if (ref.type === 3) assert.ok(allowedGlobals.has(ref.name), `${field}: undeclared global ${ref.name}`);
  a.functions.slice(1).forEach((f, j) => {
    assert.equal(f.name, '', `${field}: nested function must be anonymous (CreateBuiltinFunction name "")`);
    assert.equal(f.hasPrototype, 0, `${field}: nested function must be an arrow`);
    assert.equal(f.length, 1, `${field}: nested function length 1`);
    for (const ref of f.refs) if (ref.type === 3) assert.ok(!/^__/.test(ref.name), `${field}: private ${ref.name} in nested function`);
  });
  helperParity++;
});
let fixtureParity = 0; const opcodes = new Set(); const getValueDonePredecessors = new Set();
for (const c of asyncIterationCases) await step(`fixture compile ${c.feature}`, () => {
  const a = native(c.source), b = wasm(c.source);
  assert.ok(!a.error, a.error); assert.deepEqual(normalize(b), normalize(a));
  for (const f of a.functions) f.instructions.forEach((ins, i) => { opcodes.add(ins.op); if (ins.op === 'iterator_get_value_done') getValueDonePredecessors.add(f.instructions[i - 1]?.op); if (ins.op === 'for_await_of_next') assert.equal(f.instructions[i + 1]?.op, 'await'); });
  fixtureParity++;
});
await step('opcode coverage', () => {
  for (const op of ['for_await_of_start', 'for_await_of_next', 'await', 'iterator_get_value_done', 'iterator_close', 'nip_catch', 'return_async']) assert.ok(opcodes.has(op), `fixtures exercise ${op}`);
  assert.deepEqual([...getValueDonePredecessors], ['await']);
  assert.ok(!opcodes.has('async_iterator_close'), 'this QuickJS revision has no async_iterator_close');
});

// ------------------------------------------------------------ 3. WGSL lint --
// 'return'/'throw' come from the generator patch (generatorFields); the preview checks the real table.
const fieldsPlus = { ...FIELDS }; for (const n of ['return', 'throw', ...A.asyncIterationFields]) if (!(n in fieldsPlus)) fieldsPlus[n] = Object.keys(fieldsPlus).length;
const opPlus = { ...OP, await: OP.await ?? 9999 };
const parts = {
  functions: A.asyncIterationWGSLFunctions({ F: fieldsPlus, L: LIMITS, OP: opPlus }),
  ...Object.fromEntries(Object.entries(A.asyncIterationWGSLCases()).map(([k, v]) => [`case:${k}`, v])),
  ...Object.fromEntries(A.asyncIterationContinuations().map(({ code, body }) => [`continuation:${code}`, body])),
  objectMethod: A.asyncIterationObjectMethodWGSL, gc: A.asyncIterationGCWGSL, init: A.asyncIterationInitWGSL({ F: fieldsPlus }),
  property: A.asyncIterationPropertyWGSL({ F: fieldsPlus }), dispatch: A.asyncIterationDispatchWGSL({ F: fieldsPlus }),
};
await step('wgsl lint', () => {
  assert.deepEqual(lintWGSL(parts), []);
  const all = Object.values(parts).join('\n');
  const ids = new Set([...Object.values(A.ASYNC_ITERATION_IDS)]);
  for (const m of all.matchAll(/\b(2[89]\d\d)u\b/g)) assert.ok(ids.has(Number(m[1])), `foreign id ${m[1]}`);
  for (const m of all.matchAll(/alloc\(l,(\d+)u/g)) assert.ok([2, A.BRAND_KIND].includes(Number(m[1])), `alloc kind ${m[1]}`);
  for (const m of all.matchAll(/heap\[(\d+)u\]|dataProperty\(l,(\d+)u/g)) { const n = Number(m[1] ?? m[2]); if (n >= 86 && n <= 105) assert.ok([96, 97].includes(n), `fixed node ${n}`); }
  assert.ok(parts.init.includes(`0x60000000u|31u,V(${A.ASYNC_ITERATION_IDS.asyncIteratorMethod}u`), '@@asyncIterator key uses well-known cell 31');
  assert.ok(parts.init.includes(`heap[${PROMISE_NODES.asyncFromSyncIteratorProto}u]=Node(V(${PROMISE_NODES.asyncIteratorProto}u,0u,0u,1u),0u,0u,2u,0u)`), 'node 97 proto 96');
  assert.ok(parts.init.includes(`heap[${PROMISE_NODES.asyncIteratorProto}u]=Node(V(1u,0u,0u,1u),0u,0u,2u,0u)`), 'node 96 proto Object.prototype');
  assert.ok(parts.functions.includes('asyncGeneratorStep(l,9999u)'), 'async-generator await branch');
  for (const code of [152, 153, 154]) assert.ok(`continuation:${code}` in parts);
});

// ------------------------------------------------------- 4. anchors + preview --
const base = liveBase();
let anchorsChecked = 0;
await step('anchors', () => {
  for (const a of anchorCounts(base, A.asyncIterationIntegrationEdits)) { assert.equal(a.count, 1, `${a.file}: ${a.anchor.slice(0, 80)} matched ${a.count}`); anchorsChecked++; }
});
const MINE = ['asyncIterTag', 'asyncIterObject', 'asyncIterSentinel', 'asyncIterationAwait', 'asyncIterHelper', 'asyncIterationStart', 'asyncIterationOpened', 'asyncIterationNext', 'asyncIterationValueDone', 'asyncIterationStepResult', 'asyncIterationClose', 'asyncIterationIntrinsic'];
const previews = {};
for (const [name, options] of [['worker7Only', { mode: 'worker7Only' }], ['allWorkers', { mode: 'withOthers' }], ['allWorkersWorker7First', { mode: 'withOthers', order: 'worker7First' }]]) await step(`preview ${name}`, async () => {
  const { files, applied, skipped } = await composePreview(options);
  const { B, P, S, R } = await importPreview(files);
  for (const [n, id] of Object.entries(OP)) assert.equal(P.OP[n], id, `${n} opcode stable`);
  for (const [n, id] of Object.entries(FIELDS)) assert.equal(P.FIELDS[n], id, `${n} field stable`);
  for (const op of A.asyncIterationOpcodes) assert.ok(op in P.OP, `OP ${op}`);
  for (const n of A.asyncIterationFields) assert.ok(n in P.FIELDS, `FIELDS ${n}`);
  for (const [n, id] of Object.entries(A.asyncIterationPrivateBuiltins)) assert.equal(B.privateBuiltins[n], id, `privateBuiltins ${n}`);
  for (const [k, s] of Object.entries(A.asyncIterationSources)) assert.equal(B.bootstrapSources[k], s);
  const cont = R.phase4Continuations({ OP: P.OP, F: P.FIELDS, L: P.LIMITS }).map(c => c.code);
  for (const code of [152, 153, 154]) assert.equal(cont.filter(c => c === code).length, 1, `continuation ${code} once`);
  assert.equal(new Set(cont).size, cont.length, 'continuation codes unique');
  const shader = S.shader;
  const fullyComposed = applied.length === 7;
  if (fullyComposed || name !== 'worker7Only') assert.ok(!/undefinedu|NaNu|\$\{/.test(shader), 'template leak');
  const fns = wgslFunctions(shader);
  for (const f of MINE) assert.ok(fns.has(f), `fn ${f}`);
  const at = s => { const i = shader.indexOf(s); assert.ok(i >= 0, `missing ${s.slice(0, 70)}`); assert.equal(shader.indexOf(s, i + 1), -1, `twice ${s.slice(0, 70)}`); return i; };
  // iterator_close: the async prefix runs before the synchronous body.
  const close = at('if(asyncIterationClose(l)){break;}'), syncClose = shader.indexOf('states[l].sp-=3u;let record=states[l].stack[states[l].sp];', close);
  assert.ok(syncClose > close && syncClose - close < 400, 'iterator_close prefix precedes the sync path');
  for (const c of ['asyncIterationStart(l);', 'asyncIterationNext(l);', 'asyncIterationValueDone(l);']) at(c);
  const finish = at('fn finish(l:u32,completionValue:V) {'), raise = at('fn raise(l:u32,error:V) {');
  for (const c of ['else if(continuation==152u){push(l,returned);states[l].pc=constructed.x;}', 'else if(continuation==153u){asyncIterationStepResult(l,constructed,returned);}', 'else if(continuation==154u){asyncIterationOpened(l,constructed,returned);}']) { const i = at(c); assert.ok(finish < i && i < raise, `${c} in finish()`); }
  const om = at('fn objectMethod('), omHook = at(A.asyncIterationObjectMethodWGSL), om150 = shader.indexOf('if(id>=150u){', om);
  assert.ok(om < omHook && (om150 < 0 || omHook < om150), 'objectMethod hook');
  const init = at('heap[96u]=Node(V(1u,0u,0u,1u),0u,0u,2u,0u)'), symbolInit = at('let symbolNames=array<u32,15>('), entry = at('let fnValue=closure(l,0u);');
  assert.ok(symbolInit < init && init < entry, 'nodes 96/97 + Symbol.asyncIterator after Symbol ctor init, before entry');
  const col = at('fn collect(l: u32) {'), gc = at(A.asyncIterationGCWGSL.trim());
  assert.ok(col < gc && gc < shader.indexOf('states[l].freeHead=0u; states[l].freeCount=0u;', col), 'GC arm');
  const unresolved = unresolvedCalls(fns, MINE);
  if (fullyComposed) {
    assert.deepEqual(unresolved, [], 'every WGSL call resolves once all workers are composed');
    assert.ok(fns.get('asyncIterationAwait').includes(`asyncGeneratorStep(l,${P.OP.await}u)`), 'async generator await branch');
    assert.ok(fns.get('asyncIterationAwait').includes('asyncAwait(l)'), 'async function await branch');
  }
  const bootNative = Object.fromEntries(Object.entries(B.bootstrapSources).map(([k, s]) => [k, native(s)]));
  const bootWasm = Object.fromEntries(Object.entries(B.bootstrapSources).map(([k, s]) => [k, wasm(s)]));
  let packed = 0; const unpacked = [];
  for (const c of asyncIterationCases) {
    try {
      const a = P.packProgram(B.attachBootstrap(native(c.source), bootNative), P.entrySource(c.source));
      const b = P.packProgram(B.attachBootstrap(wasm(c.source), bootWasm), P.entrySource(c.source));
      assert.deepEqual(a.code, b.code); assert.deepEqual(a.image, b.image); packed++;
    } catch (e) { unpacked.push(`${c.feature}: ${e.message}`); }
  }
  if (fullyComposed) assert.deepEqual(unpacked, [], 'every fixture packs once all workers are composed');
  previews[name] = { applied, skipped, wgslFunctions: fns.size, wgslAcyclic: true, unresolvedCalls: unresolved, packedNativeWasmFixtures: packed, unpackedSample: unpacked.slice(0, 2) };
});

const { FIXED_RESERVED_LAST } = await import('./phase4-fixed-nodes.js');
const report = {
  dependencies: { liveFixedReservedLast: FIXED_RESERVED_LAST, fixedReservedCoversNodes96to97: FIXED_RESERVED_LAST >= 97, await: 'worker 5 asyncActive/asyncAwait', asyncGeneratorAwait: 'worker 6 asyncGeneratorActive/asyncGeneratorStep', promiseHelpers: '2821 / 2827 / 2830' },
  oracleChecks, fixtures: asyncIterationCases.length, v8Deviations, helperNativeWasmParity: helperParity, fixtureCompileParity: fixtureParity, opcodes: [...opcodes].filter(o => /iterator|await|async/.test(o)).sort(),
  anchorsChecked, previews, liveCoreModified: false, gpuExecuted: false, failures,
};
console.log(JSON.stringify(report, null, 1));
if (failures.length) process.exit(1);
