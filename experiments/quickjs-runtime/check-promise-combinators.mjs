// Host-only evidence for worker 4 (Promise combinators + AggregateError).
// Never touches the GPU, never edits or copies live files.
//  (1) metadata / id-range / private-name audit;
//  (2) native oracle: every fixture on Node's native Promise in a fresh vm
//      realm, microtask queue drained; settlement + value == expected/expectedNext;
//  (3) guest-helper model oracle: the SAME fixtures in a realm whose
//      Promise.resolve/reject/all/allSettled/any/race/withResolvers and
//      AggregateError are THIS worker's guest sources (evaluated as plain JS for
//      the oracle only), with the live generic iterator helpers (phase6 w2/w3
//      sources), worker 1's real __promiseNewCapability and worker 2's real
//      __promiseResolve; only WGSL intrinsics are modeled. Results must equal
//      native exactly (including job order observed by the fixtures);
//  (4) native/Wasm bytecode parity for every helper and fixture; helpers are
//      kind 0, nested helper functions have no global/private references;
//  (5) helpers pack through attachBootstrap + live packProgram (opcode/limit
//      admission; worker-1/2/4 private names temporarily aliased to
//      __lanesCall because they are not in live privateBuiltins yet);
//  (6) WGSL lint of every generated string;
//  (7) anchors: each edit anchor matches exactly once in
//      generatorIntegrationPatch(live,{iteratorPrototypeNode:77}) output and the
//      whole edit list applies in memory.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { types } from 'node:util';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import createModule from './generated/compiler.mjs';
import { generatorIntegrationPatch } from './generator-integration-patch.js';
import { OP, FIELDS as liveFIELDS, LIMITS, packProgram } from './program.js';
import { privateBuiltins as livePrivate, bootstrapSources as liveBootstrap, attachBootstrap } from './bootstrap.js';
import { phase3WellKnownNames } from './phase3-values.js';
import { PROMISE_IDS, PROMISE_HELPER_RANGES, PROMISE_INTRINSIC_RANGES, PROMISE_NODES } from './promise-ids.js';
import * as W4 from './promise-combinators-source.js';
import { promiseCombinatorCases } from './promise-combinators-cases.js';

// Fixtures legitimately leave losing rejections unhandled (e.g. the second
// rejection in Promise.all); host-level unhandled-rejection tracking is not a
// guest semantic.
process.on('unhandledRejection', () => {});
const here = p => fileURLToPath(new URL(p, import.meta.url));
const failures = [];
const fail = (label, detail) => failures.push(`${label}: ${detail}`);
const same = (actual, expected, label) => { if (!Object.is(actual, expected)) fail(label, `actual ${JSON.stringify(actual)} vs expected ${JSON.stringify(expected)}`); };

// ---- (1) metadata ------------------------------------------------------------
{
  const [hlo, hhi] = PROMISE_HELPER_RANGES.worker4, [ilo, ihi] = PROMISE_INTRINSIC_RANGES.worker4;
  for (const id of Object.values(W4.PROMISE_COMBINATOR_HELPER_IDS)) assert.ok(id >= hlo && id <= hhi, `helper ${id} in worker-4 range`);
  for (const id of Object.values(W4.AGGREGATE_ERROR_IDS)) assert.ok(id >= ilo && id <= ihi, `intrinsic ${id} in worker-4 range`);
  for (const m of W4.promiseStaticMetadata) assert.equal(PROMISE_IDS[m.key], m.id, `${m.key} id`);
  assert.equal(W4.promiseSpeciesMetadata.id, PROMISE_IDS.species);
  assert.deepEqual(W4.AGGREGATE_ERROR_NODES, { ctor: 98, proto: 99 });
  assert.equal(W4.AGGREGATE_ERROR_MAKE_ERROR_KIND + 4, PROMISE_NODES.aggregateErrorProto);
  assert.equal(W4.SPECIES_SYMBOL_NODE, 31 + phase3WellKnownNames.indexOf('species'), 'species well-known cell');
  // Recorded for the parent: promise-ids.js SYMBOL_NODES.asyncIterator (32) disagrees with phase3 (31).
  assert.equal(31 + phase3WellKnownNames.indexOf('asyncIterator'), 31);
  const used = new Set(Object.values(livePrivate));
  for (const [name, id] of Object.entries(W4.promiseCombinatorsIntrinsics)) {
    assert.ok(!(name in livePrivate), `${name} is new`); assert.ok(!used.has(id), `${id} unused in live privateBuiltins`);
  }
  for (const [name, id] of Object.entries(W4.promiseCombinatorsDependencies)) {
    if (id < 2800) assert.equal(livePrivate[name], id, `live dependency ${name}`);
  }
  const helperFields = Object.keys(W4.promiseCombinatorsSources);
  for (const field of helperFields) {
    assert.ok(!(field in liveFIELDS), `${field} is a new FIELDS slot`);
    assert.ok(!(field in liveBootstrap), `${field} is a new bootstrap source`);
    assert.ok(W4.promiseCombinatorsFields.includes(field), `${field} in FIELDS list`);
  }
  const publicNames = new Set([...W4.promiseStaticMetadata.map(m => m.key), 'AggregateError', 'errors', 'then', 'catch', 'finally']);
  for (const field of helperFields) assert.ok(!publicNames.has(field), `${field} must not alias a public name`);
  for (const m of [...W4.promiseStaticMetadata, ...W4.promiseHelperMetadata]) assert.ok(m.field in W4.promiseCombinatorsSources, `${m.field} has source`);
  const known = { ...W4.promiseCombinatorsIntrinsics, ...W4.promiseCombinatorsDependencies };
  for (const [field, source] of Object.entries(W4.promiseCombinatorsSources)) {
    for (const name of source.match(/\b__\w+/g) || []) assert.ok(Object.hasOwn(known, name), `${field}: undeclared private name ${name}`);
    assert.match(source, /^function \w+\([^)]*\) \{\n {2}"use strict";/, `${field} strict root`);
  }
  assert.ok(W4.promiseCombinatorsGaps.length > 0 && W4.promiseCombinatorsParentRequirements.length > 0);
}

// ---- (2) native oracle ---------------------------------------------------------
const tick = () => new Promise(r => setImmediate(r));
async function settle(ctx, run) {
  let p;
  try { p = run(); } catch (e) { return { settlement: 'sync-throw', value: String(e) }; }
  if (!types.isPromise(p)) return { settlement: 'not-a-promise', value: typeof p };
  let out = { settlement: 'pending', value: undefined };
  const then = vm.runInContext('Promise.prototype.then', ctx);
  Reflect.apply(then, p, [v => { out = { settlement: 'fulfilled', value: v }; }, e => { out = { settlement: 'rejected', value: e }; }]);
  for (let i = 0; i < 4; i++) await tick();
  return out;
}
const runNative = (source, x) => { const ctx = vm.createContext({}); return settle(ctx, () => vm.runInContext(`(${source})`, ctx)(x)); };

let nativeChecks = 0;
const features = new Set();
for (const c of promiseCombinatorCases) {
  assert.ok(!features.has(c.feature), `duplicate ${c.feature}`); features.add(c.feature);
  assert.match(c.source, /^function f\(x\)\{/);
  assert.ok(['fulfilled', 'rejected', 'pending'].includes(c.settlement));
  for (const [x, expected] of [[c.input, c.expected], [c.input + 1, c.expectedNext]]) {
    const r = await runNative(c.source, x);
    same(r.settlement, c.settlement, `native ${c.feature}(${x}) settlement`);
    same(r.value, expected, `native ${c.feature}(${x}) value`);
    if (!(r.value === null || ['number', 'string', 'boolean', 'undefined'].includes(typeof r.value))) fail(c.feature, 'non-primitive result');
    nativeChecks++;
  }
}

// ---- (3) guest-helper model oracle ------------------------------------------------
// Real guest sources: generic iterator record (live bootstrap), worker 1
// NewPromiseCapability, worker 2 PromiseResolve, this worker's helpers.
// Modeled WGSL intrinsics only (oracle stand-ins, never production):
// __lanesCall/Descriptor/Define/Text/ToText/ReviverDefine, __lanesPromiseState
// (IsPromise), __lanesPromiseIsConstructor, __lanesAggregateErrorCreate.
let w1Source = null, w2Source = null;
try { w1Source = (await import('./promise-core-source.js')).promiseNewCapabilitySource; } catch { /* worker 1 absent */ }
try { w2Source = (await import('./promise-resolve-source.js')).promiseResolveSource; } catch { /* worker 2 absent */ }
const fallbackCapability = `function promiseNewCapabilityBootstrap(C){
  "use strict";
  if (!__lanesPromiseIsConstructor(C)) throw new TypeError("not a constructor");
  let resolve = undefined; let reject = undefined;
  const promise = new C((a, b) => { if (resolve !== undefined) throw new TypeError("x"); if (reject !== undefined) throw new TypeError("x"); resolve = a; reject = b; });
  if (typeof resolve !== "function") throw new TypeError("x"); if (typeof reject !== "function") throw new TypeError("x");
  return { promise: promise, resolve: resolve, reject: reject };
}`;
const fallbackResolve = `function promiseResolveBootstrap(C, x) {
  "use strict";
  if (__lanesPromiseState(x) >= 0) { if (x.constructor === C) return x; }
  const capability = __promiseNewCapability(C); const resolve = capability.resolve; resolve(x); return capability.promise;
}`;
const S = W4.promiseCombinatorsSources;
const modelPrelude = `
const __NativeAggregateError = AggregateError;
const __lanesCall = (f, t, ...a) => Reflect.apply(f, t, a);
const __lanesDescriptor = () => Object.create(null);
const __lanesDefine = (o, k, d) => { Object.defineProperty(o, k, Object.assign({}, d)); return o; };
const __lanesText = v => String(v);
const __lanesToText = v => \`\${v}\`;
const __lanesReviverDefine = (o, k, v) => Reflect.defineProperty(o, k, { value: v, writable: true, enumerable: true, configurable: true });
const __lanesPromiseState = v => __hostIsPromise(v) ? 0 : -1;
const __lanesPromiseIsConstructor =C => { if (typeof C !== "function") return false; try { Reflect.construct(String, [], C); return true; } catch (e) { return false; } };
const __lanesAggregateErrorCreate = () => { const e = Reflect.construct(Error, [], __NativeAggregateError); delete e.stack; return e; };
const __lanesIteratorOpen = (${liveBootstrap.iteratorOpen});
const __lanesIteratorStep = (${liveBootstrap.iteratorStep});
const __lanesIteratorCloseThrow = (${liveBootstrap.iteratorCloseThrow});
const __promiseNewCapability = (${w1Source ?? fallbackCapability});
const __promiseResolve = (${w2Source ?? fallbackResolve});
const __promiseGetResolve = (${S.promiseGetResolve});
const __promiseListToArray = (${S.promiseListToArray});
const __promiseAggregateError = (${S.promiseAggregateError});
const __aggregateErrorConstruct = (${S.aggregateErrorConstruct});
const __install = (o, key, fn, name, length) => {
  Object.defineProperty(fn, "name", { value: name, configurable: true });
  Object.defineProperty(fn, "length", { value: length, configurable: true });
  Object.defineProperty(o, key, { value: fn, writable: true, enumerable: false, configurable: true });
};
${W4.promiseStaticMetadata.map(m => `__install(Promise, "${m.key}", (${S[m.field]}), "${m.name}", ${m.length});`).join('\n')}
const __AggregateError = function AggregateError(errors, message, options) { return __aggregateErrorConstruct(errors, message, options); };
Object.defineProperty(__AggregateError, "length", { value: 2, configurable: true });
Object.defineProperty(__AggregateError, "prototype", { value: __NativeAggregateError.prototype, writable: false, enumerable: false, configurable: false });
Object.setPrototypeOf(__AggregateError, Error);
Object.defineProperty(__NativeAggregateError.prototype, "constructor", { value: __AggregateError, writable: true, enumerable: false, configurable: true });
Object.defineProperty(globalThis, "AggregateError", { value: __AggregateError, writable: true, enumerable: false, configurable: true });
`;
function modelContext() {
  const ctx = vm.createContext({ __hostIsPromise: types.isPromise });
  vm.runInContext(`"use strict";${modelPrelude}`, ctx);
  // Sanity: the realm really uses the guest helpers.
  assert.ok(vm.runInContext('Promise.all.toString().includes("__promiseGetResolve")', ctx));
  return ctx;
}
let modelChecks = 0;
for (const c of promiseCombinatorCases) {
  for (const [x, expected] of [[c.input, c.expected], [c.input + 1, c.expectedNext]]) {
    const ctx = modelContext();
    const r = await settle(ctx, () => vm.runInContext(`(${c.source})`, ctx)(x));
    same(r.settlement, c.settlement, `model ${c.feature}(${x}) settlement`);
    same(r.value, expected, `model ${c.feature}(${x}) value`);
    modelChecks++;
  }
}
// Direct helper checks in the model realm.
{
  const ctx = modelContext();
  const run = src => vm.runInContext(src, ctx);
  same(run('__promiseListToArray({0:"a",1:"b"}, 2).join()'), 'a,b', 'listToArray');
  same(run('Object.defineProperty(Array.prototype,"0",{set(v){throw 1;},configurable:true}); const r=__promiseListToArray({0:7},1)[0]; delete Array.prototype[0]; r'), 7, 'listToArray bypasses inherited setters');
  same(run('const e=__promiseAggregateError({0:1,1:2},2); Object.getOwnPropertyNames(e).join()+":"+(e instanceof AggregateError)'), 'message,errors:true', 'aggregate error own keys');
  same(run('typeof __promiseGetResolve({resolve(){}})'), 'function', 'GetPromiseResolve');
  same(run('try{__promiseGetResolve({resolve:1});"no"}catch(e){e instanceof TypeError}'), true, 'GetPromiseResolve TypeError');
  modelChecks += 5;
}

// ---- (4) native/Wasm parity -----------------------------------------------------------
const module = await createModule(), binary = here('./generated/compiler');
const compileNative = src => JSON.parse(execFileSync(binary, [src], { encoding: 'utf8', maxBuffer: 1 << 26 }));
const compileWasm = src => JSON.parse(module.ccall('lanes_compile', 'string', ['string'], [src]));
const normalize = r => ({ ...r, functions: r.functions.map(f => ({ ...f, instructions: f.instructions.map(i => typeof i.operand === 'string' ? { ...i, bytes: i.bytes.map((b, n) => n >= 1 && n <= 4 ? 0 : b) } : i) })) });
let parity = 0;
const helperRaw = {};
for (const [field, src] of Object.entries(S)) {
  const native = compileNative(src), wasm = compileWasm(src);
  assert.ok(!native.error, `${field}: ${native.error}`);
  assert.deepEqual(normalize(wasm), normalize(native), `${field} native/Wasm bytecode`);
  native.functions.forEach((f, i) => {
    assert.equal(f.kind, 0, `${field}#${i} kind 0`);
    assert.ok(f.args <= LIMITS.args && f.locals <= LIMITS.locals && f.refs.length <= LIMITS.refs && f.stack <= LIMITS.stack, `${field}#${i} limits`);
    if (i > 0) assert.deepEqual(f.refs.filter(r => r.type === 3).map(r => r.name), [], `${field}#${i}: nested function references a global/private name`);
  });
  helperRaw[field] = native; parity++;
}
for (const c of promiseCombinatorCases) {
  const native = compileNative(c.source), wasm = compileWasm(c.source);
  assert.ok(!native.error, `${c.feature}: ${native.error}`);
  assert.deepEqual(normalize(wasm), normalize(native), `${c.feature} native/Wasm bytecode`);
  for (const f of native.functions) assert.ok(f.kind === 0 || f.kind === 1, `${c.feature}: sync function kinds only`);
  parity++;
}

// ---- (5) helper packing through the live packer --------------------------------------
// Live privateBuiltins lacks the promise-wave names until integration; alias
// them to __lanesCall (same capture spec 4) so packProgram admits every opcode.
const aliasNames = new Set([...Object.keys(W4.promiseCombinatorsIntrinsics), '__promiseNewCapability', '__promiseResolve']);
const aliased = raw => ({ ...raw, functions: raw.functions.map(f => ({ ...f, refs: f.refs.map(r => aliasNames.has(r.name) ? { ...r, name: '__lanesCall' } : r) })) });
const entry = compileNative('function f(x){return x;}');
// The new FIELDS slots do not exist in live program.js either, so each helper
// is packed alone under an existing slot name (slot identity is irrelevant to
// opcode admission).
const opNames = Object.keys(OP);
const usedOps = new Set();
for (const [field, raw] of Object.entries(helperRaw)) {
  const program = packProgram(attachBootstrap(entry, { iteratorOpen: aliased(raw) }), 'f');
  for (let i = 0; i < program.code.length; i += 4) usedOps.add(opNames[program.code[i]]);
  assert.ok(program.functions === entry.functions.length + raw.functions.length, `${field} packed`);
}
assert.ok(!usedOps.has(undefined));

// ---- (6) WGSL lint ----------------------------------------------------------------
const F = { ...liveFIELDS };
for (const name of W4.promiseCombinatorsFields) if (!(name in F)) F[name] = Object.keys(F).length;
const wgsl = W4.promiseCombinatorsWGSL({ F });
assert.ok(!/undefinedu|NaNu|\$\{|\bundefined\b|\bNaN\b/.test(wgsl), 'WGSL interpolation');
const reserved = new Set('abstract active alignas alignof as asm async await become cast catch class const_cast consteval constexpr debugger decltype delete do enum explicit export extends extern external fallthrough filter final finally friend from get goto impl implements import inline instanceof interface layout macro match meta mod module move mut mutable namespace new nil noexcept null nullptr of operator package partition pass patch precise precision private protected pub public readonly ref register require resource restrict self set shared sizeof static super target template this throw trait try type typedef typeid typename typeof union unless unsafe unsized use using virtual volatile where with yield'.split(' '));
for (const m of wgsl.matchAll(/\b(?:let|var|fn|const)\s+([A-Za-z_]\w*)/g)) assert.ok(!reserved.has(m[1]), `WGSL reserved identifier ${m[1]}`);
let depth = 0; for (const ch of wgsl) { if (ch === '{') depth++; if (ch === '}') depth--; assert.ok(depth >= 0, 'brace balance'); } assert.equal(depth, 0, 'brace balance');
assert.equal((wgsl.match(/\(/g) || []).length, (wgsl.match(/\)/g) || []).length, 'paren balance');
assert.ok(wgsl.includes(`0x${W4.SPECIES_KEY.toString(16)}`) || wgsl.includes(`${W4.SPECIES_KEY}u`), 'species key installed');
for (const m of W4.promiseStaticMetadata) assert.ok(wgsl.includes(`V(${m.id}u,0u,11u,0u),5u)`), `${m.key} installed`);

// ---- (7) anchors ------------------------------------------------------------------
const liveFiles = Object.fromEntries(['shader.js', 'program.js', 'bootstrap.js', 'phase4-registry.js', 'phase4-class-elements.js', 'phase4-global.js'].map(f => [f, readFileSync(here(`./${f}`), 'utf8')]));
const patched = generatorIntegrationPatch(liveFiles, { iteratorPrototypeNode: 77 });
const files = { ...patched };
for (const e of W4.promiseCombinatorsIntegrationEdits) {
  assert.ok(['before', 'after', 'replace'].includes(e.position) && typeof e.why === 'string');
  const n = patched[e.file].split(e.anchor).length - 1;
  if (n !== 1) { fail('anchor', `${e.file} matched ${n} times: ${e.anchor.slice(0, 80)}`); continue; }
  const s = files[e.file]; const n2 = s.split(e.anchor).length - 1;
  if (n2 !== 1) { fail('anchor (sequential)', `${e.file}: ${e.anchor.slice(0, 80)}`); continue; }
  files[e.file] = s.replace(e.anchor, () => e.position === 'replace' ? e.text : e.position === 'before' ? e.text + e.anchor : e.anchor + e.text);
}
for (const fn of ['promiseCombinatorsMetadataWGSL', 'promiseCombinatorsDispatchWGSL', 'promiseCombinatorsInitWGSL', 'promiseCombinatorsConstructWGSL']) assert.ok(files['shader.js'].includes(`\${${fn}(`), `${fn} spliced`);
assert.ok(!files['phase4-global.js'].includes("'AggregateError', 'ArrayBuffer'"));

if (failures.length) { console.error(failures.join('\n')); console.error(`${failures.length} failure(s)`); process.exit(1); }
console.log(JSON.stringify({
  fixtures: promiseCombinatorCases.length, nativeChecks, modelChecks, modelUsesWorker1: !!w1Source, modelUsesWorker2: !!w2Source,
  nativeWasmParity: parity, helpersPacked: Object.keys(S).length, helperOpcodes: usedOps.size,
  wgslStaticChecks: true, anchors: W4.promiseCombinatorsIntegrationEdits.length, coreIntegrated: false, gpuExecuted: false,
}));
