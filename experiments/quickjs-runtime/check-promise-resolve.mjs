// Host-only evidence for worker 2 (Promise resolution / thenable assimilation).
// Never touches the GPU and never edits live files.
//  (1) metadata / id-range / private-name audit;
//  (2) native oracle: every fixture runs on Node's native Promise in a fresh vm
//      realm with real microtask draining; settlement + value must equal the
//      fixture's expected/expectedNext;
//  (3) spec-model oracle: the SAME fixtures run in a realm whose Promise is a
//      reference model of the other workers' parts (worker 1/3/4/7 stand-ins,
//      oracle-only) and whose resolution procedure is THIS worker's actual guest
//      helper sources; results must equal native (exact job order);
//  (4) direct helper unit checks in the model (job payloads, getter counts);
//  (5) native/Wasm bytecode parity for every helper and fixture, kind 0 only;
//  (6) integration preview: anchors unique in generatorIntegrationPatch output,
//      edits applied to temporary copies (tmpdir, removed), helpers packed with
//      intrinsicRoot via attachBootstrap from both compilers (opcode support),
//      FIELDS/opcodes stable, shader dispatch rendered.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import createModule from './generated/compiler.mjs';
import { generatorIntegrationPatch } from './generator-integration-patch.js';
import { OP as liveOP, FIELDS as liveFIELDS } from './program.js';
import { privateBuiltins as livePrivate } from './bootstrap.js';
import { PROMISE_HELPER_RANGES } from './promise-ids.js';
import {
  promiseResolveSources, promiseResolveFields, promiseResolveMetadata, promiseResolveBuiltinFields,
  promiseResolveHelperNames, promiseResolveDependencies, promiseResolveIntrinsics,
  promiseResolveIntegrationEdits, promiseResolvePending, THENABLE_JOB_TYPE,
} from './promise-resolve-source.js';
import { promiseResolveCases } from './promise-resolve-cases.js';

const failures = [];
const fail = (label, detail) => failures.push(`${label}: ${detail}`);
const same = (actual, expected, label) => { if (!Object.is(actual, expected)) fail(label, `actual ${JSON.stringify(actual)} vs expected ${JSON.stringify(expected)}`); };

// ---- (1) metadata ----------------------------------------------------------------
const [lo, hi] = PROMISE_HELPER_RANGES.worker2;
for (const m of promiseResolveMetadata) {
  assert.ok(m.id >= lo && m.id <= hi, `${m.name} id range`);
  assert.equal(promiseResolveBuiltinFields[m.id], m.field);
  assert.equal(promiseResolveHelperNames[m.name], m.id);
  assert.ok(!(m.name in livePrivate), `${m.name} not already registered`);
  assert.ok(!(m.field in liveFIELDS), `${m.field} FIELDS name is new`);
  for (const id of Object.values(livePrivate)) assert.notEqual(id, m.id, `${m.id} unused in live privateBuiltins`);
}
assert.deepEqual(promiseResolveFields, promiseResolveMetadata.map(m => m.field));
assert.equal(new Set(promiseResolveFields).size, promiseResolveFields.length);
assert.equal(livePrivate.__lanesCall, 113);
for (const [field, source] of Object.entries(promiseResolveSources)) {
  for (const name of source.match(/\b__\w+/g) || []) assert.ok(Object.hasOwn(promiseResolveIntrinsics, name), `${field}: undeclared private name ${name}`);
  assert.ok(/^function \w+\([^)]*\) \{\n  "use strict";/.test(source), `${field} strict root`);
  assert.ok(!/=>|function\s*\(|function \w+[^]*function /.test(source.slice(source.indexOf('{'))), `${field}: no nested functions (private names only resolve in the intrinsic root)`);
}
assert.ok(Array.isArray(promiseResolvePending) && promiseResolvePending.length > 0);

// ---- (2) native oracle ---------------------------------------------------------------
const settleTick = () => new Promise(r => setImmediate(r));
async function runNative(source, input) {
  const ctx = vm.createContext({});
  const origThen = vm.runInContext('Promise.prototype.then', ctx);
  const isPromise = vm.runInContext('(function(p){try{Promise.prototype.then.call;return p instanceof Promise;}catch(e){return false;}})', ctx);
  let p;
  try { p = vm.runInContext(`(${source})`, ctx)(input); } catch (e) { return { settlement: 'sync-throw', value: String(e) }; }
  if (!isPromise(p)) return { settlement: 'not-a-promise', value: typeof p };
  let out = { settlement: 'pending', value: undefined };
  Reflect.apply(origThen, p, [v => { out = { settlement: 'fulfilled', value: v }; }, e => { out = { settlement: 'rejected', value: e }; }]);
  for (let i = 0; i < 3; i++) await settleTick();
  return out;
}
let nativeChecks = 0;
const features = new Set();
for (const c of promiseResolveCases) {
  assert.ok(!features.has(c.feature), `duplicate ${c.feature}`); features.add(c.feature);
  assert.match(c.source, /^function f\(x\)\{/);
  assert.ok(['fulfilled', 'rejected'].includes(c.settlement));
  for (const [x, expected] of [[c.input, c.expected], [c.input + 1, c.expectedNext]]) {
    const r = await runNative(c.source, x);
    same(r.settlement, c.settlement, `native ${c.feature}(${x}) settlement`);
    same(r.value, expected, `native ${c.feature}(${x}) value`);
    assert.ok(r.value === null || ['number', 'string', 'boolean', 'undefined'].includes(typeof r.value), `${c.feature}: primitive result`);
    nativeChecks++;
  }
}

// ---- (3) spec-model realm --------------------------------------------------------
// ORACLE ONLY stand-ins for other workers (1: brand/state/settle, resolving
// functions, NewPromiseCapability, constructor; 3: then/catch/PerformPromiseThen/
// reaction job; 4: resolve/reject/race; 7: FIFO job queue + runner). Worker 2's
// helpers are the real guest sources, unmodified.
const modelPrelude = `"use strict";
const __S = new WeakMap();
const __queue = [];
const __violations = [];
let __jobsRun = 0;
function __lanesPromiseCreate(proto) {
  const p = Object.create(proto !== null && (typeof proto === "object" || typeof proto === "function") ? proto : Promise.prototype);
  __S.set(p, { state: 0, result: undefined, fulfill: [], reject: [], handled: false });
  return p;
}
function __lanesPromiseState(v) {
  if (v === null || (typeof v !== "object" && typeof v !== "function")) return -1;
  const s = __S.get(v); return s === undefined ? -1 : s.state;
}
function __lanesPromiseResult(p) { return __S.get(p).result; }
function __lanesPromiseSettle(p, state, value) {
  const s = __S.get(p);
  if (s === undefined || s.state !== 0 || (state !== 1 && state !== 2)) { __violations.push("settle on non-pending promise"); return; }
  const list = state === 1 ? s.fulfill : s.reject;
  s.state = state; s.result = value; s.fulfill = s.reject = null;
  for (const reaction of list) __lanesEnqueueJob(1, reaction, value, undefined);
}
function __lanesEnqueueJob(type, a, b, c) { __queue.push([type, a, b, c]); }
function __lanesCall(f, thisArg, ...args) { return Reflect.apply(f, thisArg, args); }
const __promiseResolveBody = (${promiseResolveSources.promiseResolveBody});
const __promiseResolveThenableJob = (${promiseResolveSources.promiseResolveThenableJob});
const __promiseResolve = (${promiseResolveSources.promiseResolveAbstract});
function __promiseCreateResolvingFunctions(promise) {
  let alreadyResolved = false;
  const resolve = (resolution) => { if (alreadyResolved) return undefined; alreadyResolved = true; __promiseResolveBody(promise, resolution); return undefined; };
  const reject = (reason) => { if (alreadyResolved) return undefined; alreadyResolved = true; __lanesPromiseSettle(promise, 2, reason); return undefined; };
  return [resolve, reject];
}
function __isConstructor(C) { if (typeof C !== "function") return false; try { Reflect.construct(String, [], C); return true; } catch (e) { return false; } }
function __promiseNewCapability(C) {
  if (!__isConstructor(C)) throw new TypeError("not a constructor");
  let resolve, reject;
  const executor = (res, rej) => {
    if (resolve !== undefined) throw new TypeError("resolve already set");
    if (reject !== undefined) throw new TypeError("reject already set");
    resolve = res; reject = rej;
  };
  const promise = Reflect.construct(C, [executor]);
  if (typeof resolve !== "function") throw new TypeError("resolve not callable");
  if (typeof reject !== "function") throw new TypeError("reject not callable");
  return { promise, resolve, reject };
}
function __speciesConstructor(O, defaultConstructor) {
  const C = O.constructor;
  if (C === undefined) return defaultConstructor;
  if (C === null || (typeof C !== "object" && typeof C !== "function")) throw new TypeError("constructor not an object");
  const S = C[Symbol.species];
  if (S === undefined || S === null) return defaultConstructor;
  if (__isConstructor(S)) return S;
  throw new TypeError("species not a constructor");
}
function __performThen(promise, onFulfilled, onRejected, capability) {
  if (typeof onFulfilled !== "function") onFulfilled = undefined;
  if (typeof onRejected !== "function") onRejected = undefined;
  const fr = { capability, type: 0, handler: onFulfilled }, rr = { capability, type: 1, handler: onRejected };
  const s = __S.get(promise);
  if (s.state === 0) { s.fulfill.push(fr); s.reject.push(rr); }
  else if (s.state === 1) __lanesEnqueueJob(1, fr, s.result, undefined);
  else __lanesEnqueueJob(1, rr, s.result, undefined);
  s.handled = true;
  return capability === undefined ? undefined : capability.promise;
}
function __reactionJob(reaction, argument) {
  let result, abrupt = false;
  if (reaction.handler === undefined) { result = argument; abrupt = reaction.type === 1; }
  else { try { result = __lanesCall(reaction.handler, undefined, argument); } catch (e) { result = e; abrupt = true; } }
  if (reaction.capability === undefined) return undefined;
  return __lanesCall(abrupt ? reaction.capability.reject : reaction.capability.resolve, undefined, result);
}
function __runJob(type, a, b, c) {
  if (type === 1) return __reactionJob(a, b);
  if (type === ${THENABLE_JOB_TYPE}) return __promiseResolveThenableJob(a, b, c);
  if (type === 3) return __lanesCall(a, undefined, b);
  __violations.push("bad job type " + type);
}
function __drain() {
  while (__queue.length) {
    if (++__jobsRun > 100000) { __violations.push("job limit"); return; }
    const [type, a, b, c] = __queue.shift();
    try { __runJob(type, a, b, c); } catch (e) { __violations.push("uncaught exception in job: " + String(e)); return; }
  }
}
const Promise = function Promise(executor) {
  if (new.target === undefined) throw new TypeError("Promise constructor requires new");
  if (typeof executor !== "function") throw new TypeError("executor not callable");
  const promise = __lanesPromiseCreate(new.target.prototype);
  const fns = __promiseCreateResolvingFunctions(promise);
  try { __lanesCall(executor, undefined, fns[0], fns[1]); } catch (e) { __lanesCall(fns[1], undefined, e); }
  return promise;
};
const __proto = Promise.prototype;
const __def = (o, k, v) => Object.defineProperty(o, k, { value: v, writable: true, enumerable: false, configurable: true });
__def(__proto, "then", function then(onFulfilled, onRejected) {
  if (__lanesPromiseState(this) < 0) throw new TypeError("not a promise");
  const C = __speciesConstructor(this, Promise);
  return __performThen(this, onFulfilled, onRejected, __promiseNewCapability(C));
});
__def(__proto, "catch", function (onRejected) { return this.then(undefined, onRejected); });
__def(Promise, "resolve", function resolve(x) {
  const C = this;
  if (C === null || (typeof C !== "object" && typeof C !== "function")) throw new TypeError("receiver");
  return __promiseResolve(C, x);
});
__def(Promise, "reject", function reject(r) { const cap = __promiseNewCapability(this); __lanesCall(cap.reject, undefined, r); return cap.promise; });
__def(Promise, "race", function race(iterable) {
  const C = this; const cap = __promiseNewCapability(C);
  try {
    const promiseResolve = C.resolve;
    if (typeof promiseResolve !== "function") throw new TypeError("resolve not callable");
    for (const value of iterable) { const next = __lanesCall(promiseResolve, C, value); next.then(cap.resolve, cap.reject); }
  } catch (e) { __lanesCall(cap.reject, undefined, e); }
  return cap.promise;
});
Object.defineProperty(Promise, Symbol.species, { get() { return this; }, configurable: true });
globalThis.Promise = Promise;
`;
function makeModelRealm(prelude = modelPrelude) {
  const ctx = vm.createContext({});
  vm.runInContext(prelude, ctx);
  return ctx;
}
function runModel(source, input, prelude) {
  const ctx = makeModelRealm(prelude);
  let p;
  try { p = vm.runInContext(`(${source})`, ctx)(input); } catch (e) { return { settlement: 'sync-throw', value: String(e) }; }
  vm.runInContext('__drain()', ctx);
  const violations = vm.runInContext('__violations', ctx);
  if (violations.length) return { settlement: 'violation', value: violations.join('; ') };
  const state = vm.runInContext('__lanesPromiseState', ctx)(p);
  if (state < 0) return { settlement: 'not-a-promise', value: typeof p };
  const value = state === 0 ? undefined : vm.runInContext('__lanesPromiseResult', ctx)(p);
  return { settlement: ['pending', 'fulfilled', 'rejected'][state], value, jobs: vm.runInContext('__jobsRun', ctx) };
}
let modelChecks = 0, modelJobs = 0;
for (const c of promiseResolveCases) {
  for (const [x, expected] of [[c.input, c.expected], [c.input + 1, c.expectedNext]]) {
    const r = runModel(c.source, x);
    same(r.settlement, c.settlement, `model ${c.feature}(${x}) settlement`);
    same(r.value, expected, `model ${c.feature}(${x}) value`);
    modelJobs += r.jobs || 0; modelChecks++;
  }
}

// Mutation self-test: plausible wrong helpers must each be caught by some fixture.
const mutations = [
  ['synchronous thenable call (no job)', 'promiseResolveBody', '__lanesEnqueueJob(2, promise, resolution, then);', '__promiseResolveThenableJob(promise, resolution, then);'],
  ['double Get(then)', 'promiseResolveBody', 'then = resolution.then;', 'then = resolution.then; then = resolution.then;'],
  ['no self-resolution check', 'promiseResolveBody', 'if (resolution === promise) {', 'if (false) {'],
  ['getter abrupt fulfills', 'promiseResolveBody', '__lanesPromiseSettle(promise, 2, error);', '__lanesPromiseSettle(promise, 1, resolution);'],
  ['native promise shortcut (no observable then)', 'promiseResolveBody', '  let then;', '  if (__lanesPromiseState(resolution) === 1) { __lanesPromiseSettle(promise, 1, __lanesPromiseResult(resolution)); return undefined; }\n  let then;'],
  ['thenable abrupt bypasses guard', 'promiseResolveThenableJob', 'return reject(error);', '__lanesPromiseSettle(promise, 2, error); return undefined;'],
  ['thenable called without receiver', 'promiseResolveThenableJob', '__lanesCall(then, thenable, resolve, reject)', '__lanesCall(then, undefined, resolve, reject)'],
  ['PromiseResolve never returns x', 'promiseResolveAbstract', 'if (xConstructor === C) return x;', ''],
  ['PromiseResolve skips constructor Get', 'promiseResolveAbstract', 'const xConstructor = x.constructor;\n    if (xConstructor === C) return x;', 'return x;'],
  ['PromiseResolve resolve with receiver', 'promiseResolveAbstract', 'resolve(x);', 'capability.resolve(x);'],
];
let mutationsKilled = 0;
for (const [label, field, from, to] of mutations) {
  assert.equal(promiseResolveSources[field].split(from).length, 2, `mutation anchor ${label}`);
  const prelude = modelPrelude.replace(promiseResolveSources[field], promiseResolveSources[field].replace(from, to));
  assert.notEqual(prelude, modelPrelude, `mutation applied ${label}`);
  let killed = false;
  for (const c of promiseResolveCases) {
    const r = runModel(c.source, c.input, prelude);
    if (r.settlement !== c.settlement || !Object.is(r.value, c.expected)) { killed = true; break; }
  }
  if (killed) mutationsKilled++; else fail('mutation survived', label);
}

// ---- (4) direct helper unit checks (model realm) ---------------------------------
let unitChecks = 0;
{
  const ctx = makeModelRealm();
  const run = code => vm.runInContext(code, ctx);
  const check = (code, expected, label) => { same(run(code), expected, `unit ${label}`); unitChecks++; };
  // Self resolution: rejected with TypeError of this realm, no job.
  check(`(function(){const p=__lanesPromiseCreate();__promiseResolveBody(p,p);return __lanesPromiseState(p)+":"+(__lanesPromiseResult(p) instanceof TypeError)+":"+__queue.length;})()`, '2:true:0', 'self');
  // Primitive: fulfilled synchronously, no job; every primitive type.
  check(`(function(){const out=[];for(const v of [undefined,null,true,0,-0,NaN,"s",1n,Symbol.iterator]){const p=__lanesPromiseCreate();__promiseResolveBody(p,v);out.push(__lanesPromiseState(p)===1&&Object.is(__lanesPromiseResult(p),v));}return out.every(Boolean)+":"+__queue.length;})()`, 'true:0', 'primitives');
  // Callable then: exactly one job of type 2 with (promise, resolution, then) identities, promise still pending.
  check(`(function(){let n=0;const fn=function(){};const th={get then(){n++;return fn;}};const p=__lanesPromiseCreate();__promiseResolveBody(p,th);const j=__queue.pop();return n+":"+__lanesPromiseState(p)+":"+(j[0]===2&&j[1]===p&&j[2]===th&&j[3]===fn)+":"+__queue.length;})()`, '1:0:true:0', 'thenable enqueue');
  // Getter throws: rejected with the thrown value itself.
  check(`(function(){const err={};const th={get then(){throw err;}};const p=__lanesPromiseCreate();__promiseResolveBody(p,th);return __lanesPromiseState(p)+":"+(__lanesPromiseResult(p)===err)+":"+__queue.length;})()`, '2:true:0', 'getter throws');
  // Non-callable then values fulfill with the object.
  check(`(function(){const out=[];for(const t of [undefined,null,1,"f",{},[]]){const o={then:t};const p=__lanesPromiseCreate();__promiseResolveBody(p,o);out.push(__lanesPromiseState(p)===1&&__lanesPromiseResult(p)===o);}return out.every(Boolean)+":"+__queue.length;})()`, 'true:0', 'non-callable then');
  // Thenable job: receiver = thenable, two distinct callables; return value passed through (runner ignores it).
  check(`(function(){let info;const th={};const then=function(a,b){info=(this===th)+":"+(typeof a)+(typeof b)+":"+arguments.length;return 42;};const p=__lanesPromiseCreate();const r=__promiseResolveThenableJob(p,th,then);return info+":"+r+":"+__lanesPromiseState(p);})()`, 'true:functionfunction:2:42:0', 'thenable job call');
  // Thenable job: throw after resolve ignored; throw before resolve rejects with thrown value.
  check(`(function(){const p=__lanesPromiseCreate();__promiseResolveThenableJob(p,{},function(res){res(7);throw 1;});const q=__lanesPromiseCreate();const e={};__promiseResolveThenableJob(q,{},function(){throw e;});return __lanesPromiseState(p)+":"+__lanesPromiseResult(p)+":"+__lanesPromiseState(q)+":"+(__lanesPromiseResult(q)===e);})()`, '1:7:2:true', 'thenable job abrupt');
  // PromiseResolve: identity, one constructor Get, non-promise skips constructor, capability resolve receiver undefined.
  check(`(function(){let n=0;const p=__lanesPromiseCreate();Object.defineProperty(p,"constructor",{get(){n++;return Promise;}});const r=__promiseResolve(Promise,p);return (r===p)+":"+n;})()`, 'true:1', 'PromiseResolve identity');
  check(`(function(){let n=0;const o={get constructor(){n++;return Promise;}};const r=__promiseResolve(Promise,o);return (r!==o)+":"+n+":"+__lanesPromiseState(r)+":"+(__lanesPromiseResult(r)===o);})()`, 'true:0:1:true', 'PromiseResolve non-promise (no then -> fulfilled synchronously)');
  check(`(function(){let recv="unset",arg;function C(ex){ex(function(v){"use strict";recv=this;arg=v;},function(){});}const r=__promiseResolve(C,5);return (recv===undefined)+":"+arg+":"+(r instanceof C);})()`, 'true:5:true', 'PromiseResolve custom C');
  check(`(function(){const p=__lanesPromiseCreate();Object.defineProperty(p,"constructor",{get(){throw "c";}});try{__promiseResolve(Promise,p);return "no";}catch(e){return e;}})()`, 'c', 'PromiseResolve abrupt Get');
  run('__queue.length=0;__violations.length=0;');
}

// ---- (5) compile parity --------------------------------------------------------------
const module = await createModule();
const root = fileURLToPath(new URL('.', import.meta.url));
const binary = join(root, 'generated/compiler');
const compileNative = s => JSON.parse(execFileSync(binary, [s], { encoding: 'utf8', maxBuffer: 1 << 26 }));
const compileWasm = s => JSON.parse(module.ccall('lanes_compile', 'string', ['string'], [s]));
const normalize = r => ({ ...r, functions: r.functions.map(f => ({ ...f, instructions: f.instructions.map(i => typeof i.operand === 'string' ? { ...i, bytes: i.bytes.map((b, n) => n >= 1 && n <= 4 ? 0 : b) } : i) })) });
const helperRaw = {};
let helperParity = 0, fixtureParity = 0;
const helperOps = new Set(), helperSizes = {};
for (const [field, source] of Object.entries(promiseResolveSources)) {
  const native = compileNative(source), wasm = compileWasm(source);
  assert.ok(!native.error, `${field}: ${native.error}`); assert.ok(!wasm.error, `${field}: ${wasm.error}`);
  assert.deepEqual(normalize(wasm), normalize(native), `${field} native/Wasm bytecode`);
  assert.equal(native.functions.length, 1, `${field}: single root function`);
  for (const fn of native.functions) { assert.equal(fn.kind, 0, `${field}: kind 0 only`); for (const i of fn.instructions) helperOps.add(i.op); }
  helperSizes[field] = native.functions[0].instructions.length;
  helperRaw[field] = { native, wasm }; helperParity++;
}
for (const c of promiseResolveCases) {
  const native = compileNative(c.source), wasm = compileWasm(c.source);
  if (native.error) { fail(`compile ${c.feature}`, native.error); continue; }
  assert.deepEqual(normalize(wasm), normalize(native), `${c.feature} native/Wasm bytecode`);
  for (const fn of native.functions) assert.equal(fn.kind, 0, `${c.feature}: kind 0 only`);
  fixtureParity++;
}

// ---- (6) integration preview -------------------------------------------------------
const names = ['program.js', 'phase4-registry.js', 'phase4-class-elements.js', 'shader.js', 'phase4-classes.js', 'bootstrap.js'];
const original = Object.fromEntries(names.map(n => [n, readFileSync(join(root, n), 'utf8')]));
const patched = generatorIntegrationPatch(original, { iteratorPrototypeNode: 77 });
for (const e of promiseResolveIntegrationEdits) {
  assert.ok(['before', 'after', 'replace'].includes(e.position));
  assert.equal(patched[e.file].split(e.anchor).length, 2, `anchor unique: ${e.file}: ${e.anchor.slice(0, 80)}`);
}
function applyEdits(files, edits) {
  const out = { ...files };
  for (const e of edits) {
    const s = out[e.file]; const i = s.indexOf(e.anchor);
    assert.ok(i >= 0 && s.indexOf(e.anchor, i + 1) < 0, `apply anchor ${e.anchor.slice(0, 60)}`);
    const end = i + e.anchor.length;
    out[e.file] = e.position === 'before' ? s.slice(0, i) + e.text + s.slice(i)
      : e.position === 'after' ? s.slice(0, end) + e.text + s.slice(end)
      : s.slice(0, i) + e.text + s.slice(end);
  }
  return out;
}
// TEST-ONLY stand-in registration of the names owned by workers 1 and 7 (contract ids),
// so the helpers can be packed before those workers' edits are composed. Not exported.
const dependencyStandIn = {
  file: 'bootstrap.js', anchor: '  ...phase3BigintConversionIntrinsics,\n});', position: 'before',
  text: Object.entries(promiseResolveDependencies).filter(([n]) => !(n in livePrivate)).map(([n, { id }]) => `  ${n}: ${id},\n`).join(''),
};
const edited = applyEdits(patched, [...promiseResolveIntegrationEdits, dependencyStandIn]);
const directory = mkdtempSync(join(tmpdir(), 'lanes-promise-resolve-preview-'));
let preview;
try {
  for (const name of names) {
    const code = edited[name].replace(/(from\s*|import\s*)['"](\.\.?\/[^'"]+|acorn)['"]/g, (match, prefix, specifier) => {
      const relative = specifier.slice(2), url = specifier === 'acorn' ? import.meta.resolve('acorn') : pathToFileURL(join(names.includes(relative) ? directory : root, specifier)).href;
      return prefix + JSON.stringify(url);
    });
    writeFileSync(join(directory, name), code);
  }
  const B = await import(pathToFileURL(join(directory, 'bootstrap.js')));
  const P = await import(pathToFileURL(join(directory, 'program.js')));
  const S = await import(pathToFileURL(join(directory, 'shader.js')));
  for (const [name, id] of Object.entries(liveOP)) assert.equal(P.OP[name], id, `${name} opcode stable`);
  for (const [name, id] of Object.entries(liveFIELDS)) assert.equal(P.FIELDS[name], id, `${name} field stable`);
  for (const field of promiseResolveFields) assert.ok(Number.isInteger(P.FIELDS[field]), `FIELDS.${field}`);
  for (const [name, id] of Object.entries(promiseResolveHelperNames)) assert.equal(B.privateBuiltins[name], id, `privateBuiltins.${name}`);
  for (const field of promiseResolveFields) assert.equal(B.bootstrapSources[field], promiseResolveSources[field], `bootstrapSources.${field}`);
  const shaderText = typeof S.shader === 'string' ? S.shader : String(S.shader);
  assert.ok(!/undefinedu|NaNu|\$\{/.test(shaderText), 'shader rendered');
  for (const m of promiseResolveMetadata) assert.equal(shaderText.split(`if(fnValue.x==${m.id}u){field=${P.FIELDS[m.field]}u;}`).length, 2, `shader dispatch ${m.id}`);
  // Pack the helpers exactly as the runtime does (attachBootstrap marks the helper root
  // intrinsicRoot); packProgram rejects any unsupported opcode or unresolved name.
  const entry = 'function f(x){return x;}';
  const packed = {};
  for (const flavor of ['native', 'wasm']) {
    const raw = flavor === 'native' ? compileNative(entry) : compileWasm(entry);
    const boots = Object.fromEntries(promiseResolveFields.map(f => [f, helperRaw[f][flavor]]));
    packed[flavor] = P.packProgram(B.attachBootstrap(raw, boots), 'f');
  }
  assert.deepEqual(packed.native.code, packed.wasm.code, 'packed helper code parity');
  assert.deepEqual(packed.native.image, packed.wasm.image, 'packed helper image parity');
  // Private names resolve to [4,id] capture specs (tag-11 builtin values) in the helper roots.
  const image = packed.native.image;
  const words = [];
  for (let i = 0; i + 3 < image.length; i += 4) words.push([image[i], image[i + 1], image[i + 2], image[i + 3]]);
  for (const id of [...Object.values(promiseResolveDependencies).map(d => d.id), 2841, 2843]) assert.ok(words.some(w => w[0] === 4 && w[1] === id), `capture spec [4,${id}] present`);
  // Fixture programs: Promise is not yet a recognised global (worker 1 / parent).
  const fixturePack = new Set();
  for (const c of promiseResolveCases) { try { P.packProgram(compileNative(c.source), 'f'); fixturePack.add('packed'); } catch (e) { fixturePack.add(e.message); } }
  preview = { anchors: promiseResolveIntegrationEdits.length, opcodesPreserved: Object.keys(liveOP).length, fieldsPreserved: Object.keys(liveFIELDS).length, helpersPacked: promiseResolveFields.length, packedWords: packed.native.code.length, fixturePackOutcomes: [...fixturePack] };
} finally { rmSync(directory, { recursive: true, force: true }); }

console.log(JSON.stringify({
  fixtures: promiseResolveCases.length, nativeChecks, modelChecks, modelJobs, mutationsKilled: `${mutationsKilled}/${mutations.length}`, unitChecks, helperParity, fixtureParity,
  helperSizes, helperOps: [...helperOps].sort(), preview, wgslAdded: false, gpuExecuted: false, failures,
}, null, 1));
if (failures.length) process.exitCode = 1;
