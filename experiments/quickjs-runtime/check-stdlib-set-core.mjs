// Worker 3 (Set constructor, add/has/delete). Host differential tests are test
// oracles only, never a runtime fallback; no GPU is used here.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Script, createContext } from 'node:vm';
import { SET_IDS, collectionIntrinsics } from './stdlib-ids.js';
import { createCollectionHostModel, instantiateHelper } from './stdlib-collections-host-model.js';
import { setCoreSources, setConstructSource, setConstructEntry, setCoreMethods, setCoreIntrinsics, setCorePending } from './stdlib-set-core.js';
import { setCoreCases, setCoreUnsupportedSources, setCoreResumptionSource, setCoreResumptionInput, setCoreResumptionExpected } from './stdlib-set-core-cases.js';
import { privateBuiltins } from './bootstrap.js';
import { packProgram, entrySource } from './program.js';
import { createCompiler } from './compiler.js';

let exactChecks = 0;
const same = (actual, expected, label) => { assert.ok(Object.is(actual, expected), `${label}: ${String(actual)} vs ${String(expected)}`); exactChecks++; };

// --- Metadata contract -----------------------------------------------------
let metadataChecks = 0;
assert.equal(setConstructEntry.id, SET_IDS.construct); assert.equal(setConstructEntry.field, 'setConstruct'); assert.equal(setConstructEntry.source, setConstructSource); metadataChecks += 3;
for (const [name, len] of [['add', 1], ['has', 1], ['delete', 1]]) {
  const m = setCoreMethods.find(x => x.name === name);
  assert.ok(m && m.owner === 'Set.prototype' && m.id === SET_IDS[name] && m.length === len && m.kind === 'method');
  assert.equal(m.field, 'set' + name[0].toUpperCase() + name.slice(1)); assert.equal(m.source, setCoreSources[m.field]); metadataChecks += 3;
}
for (const [name, id] of Object.entries(setCoreIntrinsics)) { assert.equal(privateBuiltins[name], id, name); metadataChecks++; }
for (const name of Object.keys(setCoreIntrinsics).filter(n => n.startsWith('__lanesCollection') || n === '__lanesSetAdd')) { assert.equal(collectionIntrinsics[name], setCoreIntrinsics[name]); metadataChecks++; }
assert.ok(setCorePending.length > 0);
for (const c of setCoreCases) {
  assert.match(c.source, /^function f\(x\)\{/, c.feature);
  assert.ok(Array.isArray(c.inputs) && c.inputs.length > 0, c.feature); metadataChecks++;
}
assert.ok(setCoreCases.length >= 30); assert.ok(setCoreCases.some(c => c.gc));
assert.equal(new Set(setCoreCases.map(c => c.feature)).size, setCoreCases.length, 'unique features');

// Host model of the existing builtin __lanesIterationKind (1273,
// phase4-iteration.js): 4 null/undefined, 1 arrays/arguments (intrinsic Array
// iteration), 2 strings and String wrappers, 0 otherwise (numbers, booleans,
// symbols, bigints, functions, plain objects, objects with @@iterator).
function iterationKind(value) {
  if (value === undefined || value === null) return 4;
  if (typeof value === 'string') return 2;
  if (typeof value !== 'object') return 0;
  if (Array.isArray(value) || Object.prototype.toString.call(value) === '[object Arguments]') return 1;
  try { String.prototype.valueOf.call(value); return 2; } catch { return 0; }
}
const hostCall = (f, t, ...a) => Reflect.apply(f, t, a);
let iterationKindChecks = 0;
for (const [v, k] of [[undefined, 4], [null, 4], [[1], 1], [(function () { return arguments; })(1), 1], ['ab', 2], [new String('a'), 2], [5, 0], [true, 0],
  [Symbol('s'), 0], [1n, 0], [{}, 0], [() => 0, 0], [new Set(), 0], [new Map(), 0], [{ length: 1, 0: 1 }, 0], [new Script('[1]').runInContext(createContext({})), 1]]) {
  assert.equal(iterationKind(v), k); iterationKindChecks++;
}

// --- Mock Set built from the guest helper sources over the host model -------
// A fresh realm per evaluation so patches of Set.prototype never leak.
function mockRealm() {
  const sandbox = {};
  const ctx = createContext(sandbox);
  const realm = new Script('({TypeError,Object,Function,Symbol})').runInContext(ctx);
  const setPrototype = new Script('({})').runInContext(ctx);
  const model = createCollectionHostModel({ setPrototype, mapPrototype: new Script('({})').runInContext(ctx) });
  const I = model.intrinsics;
  const bindings = { ...I, __lanesCall: hostCall, __lanesIterationKind: iterationKind, TypeError: realm.TypeError };
  const helpers = Object.fromEntries(Object.entries(setCoreSources).map(([field, source]) => [field, instantiateHelper(source, bindings)]));
  const SetCtor = new Script(`(function(construct,TypeError){return function Set(){
    if(new.target===undefined)throw new TypeError("Constructor Set requires 'new'");
    if(new.target!==Set)throw new Error("status 6: subclass NewTarget");
    return construct(arguments[0]);};})`).runInContext(ctx)(helpers.setConstruct, realm.TypeError);
  realm.Object.defineProperty(SetCtor, 'prototype', { value: setPrototype, writable: false, enumerable: false, configurable: false });
  realm.Object.defineProperty(setPrototype, 'constructor', { value: SetCtor, writable: true, enumerable: false, configurable: true });
  const install = (name, fn, length) => {
    Object.defineProperty(fn, 'name', { value: name, configurable: true }); Object.defineProperty(fn, 'length', { value: length, configurable: true });
    Object.defineProperty(setPrototype, name, { value: fn, writable: true, enumerable: false, configurable: true });
  };
  for (const m of setCoreMethods) install(m.name, helpers[m.field], m.length);
  // Host stubs for `requires` helpers owned by other workers (oracle only).
  const brand = (t, n) => { if (I.__lanesCollectionBrand(t) !== 2) throw new realm.TypeError(n); };
  install('forEach', function (callback, thisArg) {
    brand(this, 'forEach'); if (typeof callback !== 'function') throw new realm.TypeError('forEach');
    const it = I.__lanesCollectionIterator(this, 1);
    while (I.__lanesCollectionStep(it)) { const v = I.__lanesCollectionIterValue(it); Reflect.apply(callback, thisArg, [v, v, this]); }
  }, 1);
  const size = function () { brand(this, 'size'); return I.__lanesCollectionSize(this); };
  Object.defineProperty(size, 'name', { value: 'get size' });
  Object.defineProperty(setPrototype, 'size', { get: size, enumerable: false, configurable: true });
  Object.defineProperty(setPrototype, Symbol.toStringTag, { value: 'Set', writable: false, enumerable: false, configurable: true });
  sandbox.Set = SetCtor;
  assert.equal(new Script('Set').runInContext(ctx), SetCtor);
  return ctx;
}
const runMock = (source, input) => new Script('(' + source + ')').runInContext(mockRealm())(input);
const runNative = (source, input) => new Script('(' + source + ')').runInContext(createContext({}))(input);

// --- Direct helper differential: random op sequences vs native Set ----------
const mockProto = {};
const model = createCollectionHostModel({ setPrototype: mockProto });
const H = Object.fromEntries(Object.entries(setCoreSources).map(([field, source]) => [field, instantiateHelper(source, { ...model.intrinsics, __lanesCall: hostCall, __lanesIterationKind: iterationKind })]));
Object.assign(mockProto, { add: H.setAdd, has: H.setHas, delete: H.setDelete });
const keysOf = s => { const out = [], it = model.intrinsics.__lanesCollectionIterator(s, 0); while (model.intrinsics.__lanesCollectionStep(it)) out.push(model.intrinsics.__lanesCollectionIterKey(it)); return out; };
const symA = Symbol('a'), symB = Symbol('a'), objA = {}, objB = {}, fnA = () => 1, fnB = function () {};
const pool = [NaN, 0 / 0, 0, -0, 1, -1, 0.5, Infinity, -Infinity, '1', 'a', 'ab', 'a' + 'b', '', '\uD83D', '😀', symA, symB, Symbol.iterator,
  10n, BigInt(10), 2n ** 64n, -(2n ** 64n), objA, objB, fnA, fnB, undefined, null, true, false, [], new String('a')];
let seed = 0x9e3779b9; const rnd = n => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) % n; };
let randomOps = 0;
for (let round = 0; round < 400; round++) {
  const native = new Set(), s = model.intrinsics.__lanesCollectionCreate(2);
  for (let step = 0; step < 60; step++) {
    const v = pool[rnd(pool.length)], op = rnd(3);
    if (op === 0) { assert.equal(H.setAdd.call(s, v), s); native.add(v); }
    else if (op === 1) same(H.setHas.call(s, v), native.has(v), 'has');
    else same(H.setDelete.call(s, v), native.delete(v), 'delete');
    randomOps++;
  }
  const a = keysOf(s), b = [...native];
  assert.equal(a.length, b.length); a.forEach((k, i) => same(k, b[i], 'order'));
  same(model.intrinsics.__lanesCollectionSize(s), native.size, 'size');
}
// -0 is stored as +0; constructor over arrays/strings/arguments.
{ const s = H.setConstruct([-0, 0, NaN, NaN, 'x']); assert.equal(Object.getPrototypeOf(s), mockProto); same(keysOf(s).length, 3, 'ctor dup'); same(keysOf(s)[0], 0, '-0 normalized');
  const t = model.intrinsics.__lanesCollectionCreate(2); H.setAdd.call(t, -0); same(keysOf(t)[0], 0, 'add -0 normalized');
  assert.deepEqual(keysOf(H.setConstruct('a😀a\uD83D')), [...new Set('a😀a\uD83D')]);
  assert.deepEqual(keysOf((function () { return H.setConstruct(arguments); })(1, 1, 2)), [1, 2]);
  same(keysOf(H.setConstruct(undefined)).length, 0, 'undefined'); same(keysOf(H.setConstruct(null)).length, 0, 'null'); exactChecks += 2; }
// Brand checks are guest TypeErrors, never internal errors.
let brandChecks = 0;
for (const recv of [{}, [], null, undefined, 1, 'x', Symbol('s'), () => 0, new Set(), new Map(), model.intrinsics.__lanesCollectionCreate(1), Object.create(mockProto)])
  for (const f of [H.setAdd, H.setHas, H.setDelete]) { assert.throws(() => f.call(recv, 1), TypeError); brandChecks++; }
// The constructor's adder is an observable Get on the new set (here: the host
// model prototype; skipped for null/undefined; non-callable -> TypeError.
{ let gets = 0; Object.defineProperty(mockProto, 'add', { configurable: true, get() { gets++; return H.setAdd; } });
  const s = H.setConstruct([1, 2, 1]); assert.deepEqual(keysOf(s), [1, 2]); H.setConstruct(null); H.setConstruct(undefined); assert.equal(gets, 1);
  Object.defineProperty(mockProto, 'add', { configurable: true, writable: true, value: 7 });
  assert.throws(() => H.setConstruct([]), TypeError); assert.equal(keysOf(H.setConstruct(null)).length, 0);
  mockProto.add = H.setAdd; }
// Temporary pre-check: kind-0 values without a callable @@iterator are guest
// TypeErrors; a callable @@iterator falls through to the language for-of
// (status 6 on the GPU today). The pre-check performs one extra observable Get
// of @@iterator and must be removed once the generic protocol merges.
let preCheckChecks = 0;
for (const v of [5, 0, true, Symbol('s'), 1n, {}, () => 0, { length: 1, 0: 1 }, { [Symbol.iterator]: 1 }, { [Symbol.iterator]: null }, Object.create({ [Symbol.iterator]: 'x' })]) {
  assert.throws(() => H.setConstruct(v), TypeError); preCheckChecks++;
}
{ let gets = 0; const o = { get [Symbol.iterator]() { gets++; return function* () { yield 1; yield 1; yield 2; }; } };
  assert.deepEqual(keysOf(H.setConstruct(o)), [1, 2]); assert.equal(gets, 2, 'pre-check Get + for-of Get'); preCheckChecks++;
  assert.deepEqual(keysOf(H.setConstruct(new Set([3, 3, 4]))), [3, 4]); preCheckChecks++; }

// --- Fixture differential (mock Set in node:vm vs native V8) ---------------
let fixtureChecks = 0, gatedFixtureChecks = 0;
for (const item of setCoreCases) for (const input of item.inputs) {
  const actual = runMock(item.source, input), expected = runNative(item.source, input);
  assert.ok(expected === null || !['object', 'function', 'symbol', 'bigint'].includes(typeof expected), `${item.feature} returns a primitive`);
  same(actual, expected, item.feature + ' ' + String(input));
  if (item.requires) gatedFixtureChecks++; else fixtureChecks++;
}
same(runNative(setCoreResumptionSource, setCoreResumptionInput), setCoreResumptionExpected, 'resumption native');
same(runMock(setCoreResumptionSource, setCoreResumptionInput), setCoreResumptionExpected, 'resumption mock');
// Unsupported sources are valid JavaScript (native V8 runs them); in the GPU
// runtime they are status 6, never a guest catch.
for (const source of setCoreUnsupportedSources) { const v = runNative(source, 3); assert.notEqual(v, 'wrong guest catch'); }

// --- Compiler: helper parity (native vs Wasm) and fixture compilation -------
const { default: create } = await import('./generated/compiler.mjs');
const wasm = await create();
const nativePath = fileURLToPath(new URL('./generated/compiler', import.meta.url));
const compileNative = source => JSON.parse(execFileSync(nativePath, [source], { encoding: 'utf8' }));
let helperParity = 0, helperRefChecks = 0;
for (const source of Object.values(setCoreSources)) {
  const native = compileNative(source), raw = JSON.parse(wasm.ccall('lanes_compile', 'string', ['string'], [source]));
  assert.ok(!native.error && !raw.error, native.error || raw.error);
  for (const code of [raw, native]) code.functions[0].intrinsicRoot = true;
  for (const ref of native.functions[0].refs.filter(r => r.type > 2)) { assert.ok(ref.name in setCoreIntrinsics || ['TypeError', 'undefined', 'Symbol'].includes(ref.name), `helper global ${ref.name}`); helperRefChecks++; }
  const a = packProgram(raw, entrySource(source)), b = packProgram(native, entrySource(source));
  assert.deepEqual(a.code, b.code); assert.deepEqual(a.image, b.image); helperParity++;
}
let nativeFixtureCompiles = 0;
for (const source of [...setCoreCases.map(i => i.source), setCoreResumptionSource, ...setCoreUnsupportedSources]) {
  const raw = compileNative(source); assert.ok(!raw.error, raw.error); nativeFixtureCompiles++;
}
let integratedPrograms = 0, integrationPending = false, integrationError = null;
const compiler = await createCompiler();
for (const source of [...setCoreCases.map(i => i.source), setCoreResumptionSource]) {
  try { compiler.compile(source); integratedPrograms++; }
  catch (error) { if (!(error instanceof SyntaxError) || !/Unsupported/.test(error.message)) throw error; integrationPending = true; integrationError ??= error.message; }
}

console.log(JSON.stringify({
  cases: setCoreCases.length, gatedCases: setCoreCases.filter(c => c.requires).length, unsupportedSources: setCoreUnsupportedSources.length,
  metadataChecks, iterationKindChecks, preCheckChecks, exactChecks, randomOps, brandChecks, fixtureChecks, gatedFixtureChecks, helperParity, helperRefChecks,
  nativeFixtureCompiles, integratedPrograms, integrationPending, integrationError, gpuChecks: false,
}));
