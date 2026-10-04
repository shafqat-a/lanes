// Worker 3 host-only evidence (never runs a GPU, never edits live files).
// 1. Real-ES oracle: every fixture expectation is reproduced by node's Promise.
// 2. Guest-model oracle: the fixtures run against %Promise.prototype% methods
//    whose bodies are THIS module's helper sources evaluated verbatim, on top of
//    spec-faithful test models of the other workers' contracts (promise
//    brand/state intrinsics, resolving functions, NewPromiseCapability,
//    PromiseResolve, FIFO job queue). Jobs are drained exactly like status 10.
//    The models are test scaffolding for the oracle only, not deliverables.
// 3. Native/Wasm parity of helper (and fixture) bytecode; helpers are kind 0.
// 4. Isolated integration preview (temporary copies inside this directory):
//    generatorIntegrationPatch + promiseThenIntegrationEdits, anchors unique,
//    FIELDS/OP stable, WGSL lint + acyclic call graph, and packProgram of every
//    bootstrap helper through both compiler bridges (only supported opcodes).
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import createModule from './generated/compiler.mjs';
import { generatorIntegrationPatch } from './generator-integration-patch.js';
import { phase3WellKnownNames } from './phase3-values.js';
import { PROMISE_HELPER_RANGES, PROMISE_INTRINSIC_RANGES, PROMISE_IDS } from './promise-ids.js';
import {
  promiseThenSources, promiseThenMetadata, promiseThenHelpers, promiseThenPrivateBuiltins, promiseThenDependencies,
  promiseThenFields, promiseThenWGSLFunctions, promiseThenObjectMethodWGSL, promiseThenDispatchWGSL,
  promiseThenPropertyWGSL, promiseThenInitWGSL, promiseThenIntegrationEdits, applyPromiseThenEdits,
  promiseThenGaps, SPECIES_SYMBOL_NODE, PROMISE_THEN_IDS,
} from './promise-then-source.js';
import { promiseThenCases } from './promise-then-cases.js';
import { LIMITS, FIELDS, OP } from './program.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const report = {};

// ------------------------------------------------------------ reservations --
assert.equal(SPECIES_SYMBOL_NODE, 31 + phase3WellKnownNames.indexOf('species'), 'species cell');
for (const h of promiseThenHelpers) assert.ok(h.id >= PROMISE_HELPER_RANGES.worker3[0] && h.id <= PROMISE_HELPER_RANGES.worker3[1], h.name);
for (const id of [PROMISE_THEN_IDS.speciesSymbol, PROMISE_THEN_IDS.isConstructor]) assert.ok(id >= PROMISE_INTRINSIC_RANGES.worker3[0] && id <= PROMISE_INTRINSIC_RANGES.worker3[1]);
assert.deepEqual(promiseThenMetadata.map(m => [m.id, m.name, m.length]), [[PROMISE_IDS.then, 'then', 2], [PROMISE_IDS.catch, 'catch', 1], [PROMISE_IDS.finally, 'finally', 1]]);
assert.ok(promiseThenCases.length >= 35, 'fixture count');
assert.equal(new Set(promiseThenCases.map(c => c.feature)).size, promiseThenCases.length, 'unique features');

// ----------------------------------------------------------- 1. real ES --
const tick = () => new Promise(r => setImmediate(r));
async function nativeRun(source, x) {
  const ctx = vm.createContext({});
  const p = vm.runInContext(`${source};f(${JSON.stringify(x)})`, ctx);
  let settlement = 'pending', value;
  p.then(v => { settlement = 'fulfilled'; value = v; }, e => { settlement = 'rejected'; value = e; });
  for (let i = 0; i < 4; i++) await tick();
  return { settlement, value };
}
let nativeChecks = 0;
for (const c of promiseThenCases) for (const [x, expected] of [[c.input, c.expected], [c.input + 1, c.expectedNext]]) {
  const r = await nativeRun(c.source, x);
  assert.equal(r.settlement, c.settlement, `${c.feature}(${x}) native settlement`);
  assert.ok(Object.is(r.value, expected), `${c.feature}(${x}) native value ${String(r.value)} !== ${String(expected)}`);
  nativeChecks++;
}
report.nativeChecks = nativeChecks;

// ------------------------------------------------------- 2. guest model --
// Test models of the contract surface owned by workers 1, 2, 4 and 7. They
// live in the fixture realm so errors/objects match the guest's view.
const modelSource = `
"use strict";
const STATE = new WeakMap();
const jobs = [];
let jobErrors = [];
let PromiseProto;
// worker 1 intrinsics 2840..2846
function __lanesPromiseCreate(proto) {
  const o = Object.create(proto !== null && (typeof proto === "object" || typeof proto === "function") ? proto : PromiseProto);
  STATE.set(o, { state: 0, result: undefined, fulfill: [], reject: [], handled: false });
  return o;
}
function __lanesPromiseState(v) { const s = (v !== null && (typeof v === "object" || typeof v === "function")) ? STATE.get(v) : undefined; return s ? s.state : -1; }
function __lanesPromiseResult(p) { return STATE.get(p).result; }
function __lanesPromiseSettle(p, state, value) {
  const s = STATE.get(p); if (!s || s.state !== 0) throw new Error("internal: settle on settled promise");
  const list = state === 1 ? s.fulfill : s.reject;
  s.state = state; s.result = value; s.fulfill = s.reject = null;
  for (const reaction of list) __lanesEnqueueJob(1, reaction, value, undefined);
}
function __lanesPromiseAddReaction(p, fr, rr) { const s = STATE.get(p); if (s.state !== 0) throw new Error("internal: add reaction to settled promise"); s.fulfill.push(fr); s.reject.push(rr); }
function __lanesPromiseMarkHandled(p) { STATE.get(p).handled = true; }
function __lanesPromiseIsHandled(p) { return STATE.get(p).handled; }
// worker 7
function __lanesEnqueueJob(type, a, b, c) { jobs.push([type, a, b, c]); }
function __promiseRunJob(type, a, b, c) {
  if (type === 1) return __promiseReactionJob(a, b);
  if (type === 2) return __promiseResolveThenableJob(a, b, c);
  return __lanesCall(a, undefined, b);
}
function __drain() { let n = 0; while (jobs.length) { const j = jobs.shift(); n++; try { __promiseRunJob(...j); } catch (e) { jobErrors.push(e); } } return n; }
// existing private builtins
function __lanesCall(f, thisArg, ...args) { return Reflect.apply(f, thisArg, args); }
function __lanesDescriptor() { return Object.create(null); }
// worker 1 helpers 2820/2821/2801
function __promiseCreateResolvingFunctions(promise) {
  const record = { resolved: false };
  return [value => { if (record.resolved) return undefined; record.resolved = true; __promiseResolveBody(promise, value); return undefined; },
          reason => { if (record.resolved) return undefined; record.resolved = true; __lanesPromiseSettle(promise, 2, reason); return undefined; }];
}
function __promiseNewCapability(C) {
  if (!__lanesPromiseIsConstructor(C)) throw new TypeError("not a constructor");
  let resolve, reject;
  const executor = (a, b) => { if (resolve !== undefined) throw new TypeError("resolve"); if (reject !== undefined) throw new TypeError("reject"); resolve = a; reject = b; };
  const promise = Reflect.construct(C, [executor]);
  if (typeof resolve !== "function" || typeof reject !== "function") throw new TypeError("capability");
  return { promise, resolve, reject };
}
// worker 2 helpers 2825..2827
function __promiseResolveBody(promise, resolution) {
  if (resolution === promise) return __lanesPromiseSettle(promise, 2, new TypeError("Chaining cycle detected for promise"));
  if (resolution === null || (typeof resolution !== "object" && typeof resolution !== "function")) return __lanesPromiseSettle(promise, 1, resolution);
  let then;
  try { then = resolution.then; } catch (e) { return __lanesPromiseSettle(promise, 2, e); }
  if (typeof then !== "function") return __lanesPromiseSettle(promise, 1, resolution);
  __lanesEnqueueJob(2, promise, resolution, then);
}
function __promiseResolveThenableJob(promise, thenable, then) {
  const [resolve, reject] = __promiseCreateResolvingFunctions(promise);
  try { return __lanesCall(then, thenable, resolve, reject); } catch (e) { return __lanesCall(reject, undefined, e); }
}
function __promiseResolve(C, x) {
  if (__lanesPromiseState(x) >= 0 && x.constructor === C) return x;
  const capability = __promiseNewCapability(C);
  __lanesCall(capability.resolve, undefined, x);
  return capability.promise;
}
// %Promise% (worker 1) and statics/species (worker 4) as the guest sees them
function Promise(executor) {
  if (new.target === undefined) throw new TypeError("Promise constructor requires new");
  if (typeof executor !== "function") throw new TypeError("executor");
  const p = __lanesPromiseCreate(new.target.prototype);
  const [resolve, reject] = __promiseCreateResolvingFunctions(p);
  try { executor(resolve, reject); } catch (e) { reject(e); }
  return p;
}
PromiseProto = Promise.prototype;
Object.defineProperty(Promise, Symbol.species, { get() { return this; }, configurable: true });
// Worker 3 under test: public methods are tag-11 builtins whose call()
// dispatch enters the bootstrap helper with the same receiver/arguments.
const methods = {
  then(onFulfilled, onRejected) { return Reflect.apply(__helpers.promiseThen, this, arguments); },
  catch(onRejected) { return Reflect.apply(__helpers.promiseCatch, this, arguments); },
  finally(onFinally) { return Reflect.apply(__helpers.promiseFinally, this, arguments); },
};
for (const name of ["then", "catch", "finally"]) Object.defineProperty(PromiseProto, name, { value: methods[name], writable: true, enumerable: false, configurable: true });
Object.defineProperty(PromiseProto, Symbol.toStringTag, { value: "Promise", configurable: true });
// Worker 3 intrinsics 2855/2856 and the %Promise% private name.
function __lanesSpeciesSymbol() { return Symbol.species; }
function __lanesSpeciesIsConstructor(v) { try { Reflect.construct(String, [], v); return true; } catch { return false; } }
const __lanesPromiseIsConstructor = __lanesSpeciesIsConstructor; // worker 1's 2847 (test model)
const __lanesPromiseIntrinsic = Promise;
// Worker 3 private helpers (ids 2830..2832): verbatim guest sources.
const __promisePerformThen = (...a) => Reflect.apply(__helpers.promisePerformThen, undefined, a);
const __promiseReactionJob = (...a) => Reflect.apply(__helpers.promiseReactionJob, undefined, a);
const __promiseSpeciesConstructor = (...a) => Reflect.apply(__helpers.promiseSpeciesConstructor, undefined, a);
`;
function modelRun(source, x) {
  const ctx = vm.createContext({});
  vm.runInContext(`var __helpers = {};`, ctx);
  // Helpers are compiled in the same global scope as the model so their free
  // names resolve exactly like intrinsic-root privateBuiltins on the GPU.
  vm.runInContext(modelSource + Object.entries(promiseThenSources).map(([k, s]) => `__helpers.${k} = (${s});`).join('\n') +
    `\nglobalThis.__model = { __drain, __lanesPromiseState, __lanesPromiseResult, jobErrors: () => jobErrors };`, ctx);
  // A guest promise result is published only after the queue drains (status 12/13/14).
  const result = vm.runInContext(`${source};f(${JSON.stringify(x)})`, ctx);
  const model = vm.runInContext('__model', ctx);
  const jobsRun = model.__drain();
  assert.equal(model.jobErrors().length, 0, 'no uncaught job exception (status 7)');
  const state = model.__lanesPromiseState(result);
  assert.ok(state >= 0, 'f returns a guest promise');
  return { settlement: ['pending', 'fulfilled', 'rejected'][state], value: state ? model.__lanesPromiseResult(result) : undefined, jobsRun };
}
let modelChecks = 0, modelJobs = 0;
for (const c of promiseThenCases) for (const [x, expected] of [[c.input, c.expected], [c.input + 1, c.expectedNext]]) {
  const r = modelRun(c.source, x);
  assert.equal(r.settlement, c.settlement, `${c.feature}(${x}) model settlement`);
  assert.ok(Object.is(r.value, expected), `${c.feature}(${x}) model value ${String(r.value)} !== ${String(expected)}`);
  modelChecks++; modelJobs += r.jobsRun;
}
// Metadata observed through the model mirrors the WGSL metadata.
{
  const ctx = vm.createContext({});
  vm.runInContext('var __helpers = {};' + modelSource, ctx);
  assert.equal(vm.runInContext('[Promise.prototype.then.length,Promise.prototype.catch.length,Promise.prototype.finally.length,Promise.prototype.then.name,Promise.prototype.catch.name,Promise.prototype.finally.name].join()', ctx), '2,1,1,then,catch,finally');
}
report.modelChecks = modelChecks; report.modelJobsRun = modelJobs;

// ------------------------------------------------------ 3. bytecode parity --
const module = await createModule();
const binary = join(root, 'generated/compiler');
const native = s => JSON.parse(execFileSync(binary, [s], { encoding: 'utf8', maxBuffer: 1 << 26 }));
const wasm = s => JSON.parse(module.ccall('lanes_compile', 'string', ['string'], [s]));
const normalize = r => ({ ...r, functions: r.functions.map(f => ({ ...f, instructions: f.instructions.map(i => typeof i.operand === 'string' ? { ...i, bytes: i.bytes.map((b, n) => n >= 1 && n <= 4 ? 0 : b) } : i) })) });
let helperParity = 0, fixtureParity = 0;
const knownNames = new Set([...Object.keys(promiseThenPrivateBuiltins), ...Object.keys(promiseThenDependencies), 'TypeError', 'undefined']);
for (const [field, source] of Object.entries(promiseThenSources)) {
  const n = native(source), w = wasm(source);
  assert.ok(!n.error, `${field}: ${n.error}`);
  assert.deepEqual(normalize(w), normalize(n), `${field} native/Wasm bytecode`);
  for (const [index, f] of n.functions.entries()) {
    assert.equal(f.kind, 0, `${field}: function kind 0`);
    // Private names resolve only in the intrinsic root (program.js); nested
    // closures must capture root locals instead.
    if (index > 0) for (const ref of f.refs) assert.notEqual(ref.type, 3, `${field}: nested function references global ${ref.name}`);
    assert.ok(f.args <= LIMITS.args && f.locals <= LIMITS.locals && f.refs.length <= LIMITS.refs && f.stack <= LIMITS.stack, `${field} within GPU limits`);
    for (const ref of f.refs) if (ref.type === 3) assert.ok(knownNames.has(ref.name), `${field}: free name ${ref.name} is registered`);
  }
  helperParity++;
}
for (const c of promiseThenCases) {
  const n = native(c.source), w = wasm(c.source);
  assert.ok(!n.error, `${c.feature}: ${n.error}`);
  assert.deepEqual(normalize(w), normalize(n), `${c.feature} native/Wasm bytecode`);
  for (const f of n.functions) assert.equal(f.kind, 0, `${c.feature} kind 0`);
  fixtureParity++;
}
report.helperNativeWasmParity = helperParity; report.fixtureNativeWasmParity = fixtureParity;

// ------------------------------------------------------- WGSL static lint --
const fields = { ...FIELDS }; for (const name of promiseThenFields) if (!(name in fields)) fields[name] = Object.keys(fields).length;
const wgslParts = {
  functions: promiseThenWGSLFunctions({ L: LIMITS }), objectMethod: promiseThenObjectMethodWGSL,
  dispatch: promiseThenDispatchWGSL({ F: fields }), property: promiseThenPropertyWGSL({ F: fields }), init: promiseThenInitWGSL({ F: fields }),
};
const reserved = new Set('abstract active alignas alignof as asm async await become cast catch class const_cast consteval constexpr debugger decltype delete do enum explicit export extends extern external fallthrough filter final finally friend from get goto impl implements import inline instanceof interface layout macro match meta mod module move mut mutable namespace new nil noexcept null nullptr of operator package partition pass patch precise precision private protected pub public readonly ref register require resource restrict self set shared sizeof static super target template this throw trait try type typedef typeid typename typeof union unless unsafe unsized use using virtual volatile where with yield'.split(' '));
for (const [part, text] of Object.entries(wgslParts)) {
  assert.ok(!/undefined\s*u|NaNu|\$\{|\[object/.test(text), `${part}: unresolved template`);
  for (const m of text.matchAll(/\b(?:let|var|fn|const)\s+([A-Za-z_]\w*)/g)) assert.ok(!reserved.has(m[1]), `${part}: reserved identifier ${m[1]}`);
  let depth = 0, paren = 0; for (const ch of text) { if (ch === '{') depth++; if (ch === '}') depth--; if (ch === '(') paren++; if (ch === ')') paren--; assert.ok(depth >= 0 && paren >= 0, part); }
  assert.equal(depth, 0, `${part} braces`); assert.equal(paren, 0, `${part} parens`);
}
report.wgslStaticChecks = Object.keys(wgslParts).length;

// --------------------------------------------- 4. isolated integration --
const names = ['program.js', 'phase4-registry.js', 'phase4-class-elements.js', 'shader.js', 'phase4-classes.js', 'bootstrap.js'];
const live = Object.fromEntries(names.map(n => [n, readFileSync(join(root, n), 'utf8')]));
const base = generatorIntegrationPatch(live, { iteratorPrototypeNode: 77 });
for (const e of promiseThenIntegrationEdits) {
  assert.ok(['before', 'after', 'replace'].includes(e.position));
  assert.equal(base[e.file].split(e.anchor).length, 2, `anchor unique in post-generator ${e.file}: ${e.anchor.slice(0, 60)}`);
  assert.equal(live[e.file].split(e.anchor).length - 1 <= 1, true);
}
// Order independence against sibling workers' edit lists that already exist
// (textual: every anchor still matches exactly once in either order).
{
  const siblings = [];
  for (const [file, name] of [['./promise-core-source.js', 'promiseCoreIntegrationEdits'], ['./promise-resolve-source.js', 'promiseResolveIntegrationEdits']]) {
    try { const m = await import(file); if (Array.isArray(m[name])) siblings.push(...m[name]); } catch { /* sibling not delivered yet */ }
  }
  const extra = [...new Set(siblings.map(e => e.file))].filter(f => !(f in base));
  const start = { ...base, ...Object.fromEntries(extra.map(f => [f, readFileSync(join(root, f), 'utf8')])) };
  for (const order of [[...siblings, ...promiseThenIntegrationEdits], [...promiseThenIntegrationEdits, ...siblings]]) applyPromiseThenEdits(start, order);
  report.composedWithSiblingEdits = siblings.length;
}
const patched = applyPromiseThenEdits(base);
// Preview-only: the contract names of other workers' helpers/intrinsics so the
// helpers can be packed before those workers integrate. Not a deliverable edit.
const previewDeps = Object.entries(promiseThenDependencies).filter(([n]) => !['__lanesCall', '__lanesDescriptor'].includes(n)).map(([n, id]) => `${n}:${id},`).join('');
patched['bootstrap.js'] = patched['bootstrap.js'].replace('  __lanesSymbolText:1003,', `  __lanesSymbolText:1003,${previewDeps}`);
const directory = mkdtempSync(join(root, '.promise-then-preview-'));
try {
  for (const name of names) {
    const code = patched[name].replace(/(from\s*|import\s*)['"](\.\.?\/[^'"]+|acorn)['"]/g, (match, prefix, specifier) => {
      const relative = specifier.slice(2), url = specifier === 'acorn' ? import.meta.resolve('acorn') : pathToFileURL(join(names.includes(relative) ? directory : root, specifier)).href;
      return prefix + JSON.stringify(url);
    });
    writeFileSync(join(directory, name), code);
  }
  const B = await import(pathToFileURL(join(directory, 'bootstrap.js')));
  const P = await import(pathToFileURL(join(directory, 'program.js')));
  const S = await import(pathToFileURL(join(directory, 'shader.js')));
  for (const [name, id] of Object.entries(OP)) assert.equal(P.OP[name], id, `${name} opcode stable`);
  for (const [name, id] of Object.entries(FIELDS)) assert.equal(P.FIELDS[name], id, `${name} field stable`);
  for (const name of promiseThenFields) assert.ok(Number.isInteger(P.FIELDS[name]), `FIELDS has ${name}`);
  for (const [name, id] of Object.entries(promiseThenPrivateBuiltins)) assert.equal(B.privateBuiltins[name], id, `privateBuiltins ${name}`);
  for (const field of Object.keys(promiseThenSources)) assert.equal(B.bootstrapSources[field], promiseThenSources[field]);
  const shader = S.shader;
  assert.ok(!/undefinedu|NaNu|\$\{/.test(shader), 'shader has no unresolved template');
  assert.equal((shader.match(/fn promiseThenIsConstructor\(/g) || []).length, 1);
  for (const m of [...promiseThenMetadata, ...promiseThenHelpers]) assert.equal((shader.match(new RegExp(`if\\(fnValue\\.x==${m.id}u\\)\\{field=${P.FIELDS[m.field]}u;\\}`, 'g')) || []).length, 1, `dispatch ${m.id}`);
  for (const m of promiseThenMetadata) assert.ok(shader.includes(`dataProperty(l,91u,fieldKey(${P.FIELDS[m.name]}u),V(${m.id}u,0u,11u,0u),5u);`), `install ${m.name}`);
  assert.ok(shader.includes(`if(id==2855u){return V(39u,0u,17u,0u);}`));
  // Acyclic WGSL call graph (no recursion), as in check-generator-integration.mjs.
  const functions = new Map(), clean = shader.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  for (const m of clean.matchAll(/\bfn\s+(\w+)\s*\(/g)) {
    let start = clean.indexOf('{', m.index), end = start + 1, depth = 1;
    while (depth && end < clean.length) { if (clean[end] === '{') depth++; else if (clean[end] === '}') depth--; end++; }
    assert.equal(depth, 0, m[1]); functions.set(m[1], clean.slice(start + 1, end - 1));
  }
  const active = [], done = new Set();
  function visit(name) { assert.ok(!active.includes(name), `WGSL recursion: ${[...active, name].join(' -> ')}`); if (done.has(name)) return; active.push(name); for (const m of functions.get(name).matchAll(/\b(\w+)\s*\(/g)) if (functions.has(m[1])) visit(m[1]); active.pop(); done.add(name); }
  for (const name of functions.keys()) visit(name);
  for (const m of shader.matchAll(/\b(?:let|var|fn|const)\s+([A-Za-z_]\w*)/g)) assert.ok(!reserved.has(m[1]) || !wgslParts.functions.includes(m[0]), `reserved ${m[1]}`);
  // Pack every bootstrap helper (incl. ours) through both bridges: packProgram
  // rejects unsupported instructions/globals, so this proves supported ops only.
  const entry = 'function f(x){return x;}';
  const bootNative = Object.fromEntries(Object.entries(B.bootstrapSources).map(([k, s]) => [k, native(s)]));
  const bootWasm = Object.fromEntries(Object.entries(B.bootstrapSources).map(([k, s]) => [k, wasm(s)]));
  const a = P.packProgram(B.attachBootstrap(native(entry), bootNative), P.entrySource(entry));
  const b = P.packProgram(B.attachBootstrap(wasm(entry), bootWasm), P.entrySource(entry));
  assert.deepEqual(a.code, b.code, 'packed code native/Wasm'); assert.deepEqual(a.image, b.image, 'packed image native/Wasm');
  report.integrationPreview = { anchors: promiseThenIntegrationEdits.length, packedHelpers: Object.keys(B.bootstrapSources).length, wgslFunctionsAcyclic: functions.size, opcodesPreserved: Object.keys(OP).length, fieldsPreserved: Object.keys(FIELDS).length };
} finally { rmSync(directory, { recursive: true, force: true }); }

report.gaps = promiseThenGaps.length;
report.gpuExecuted = false; report.liveCoreModified = false;
console.log(JSON.stringify(report));
