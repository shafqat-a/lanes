// Worker 4 host checks for Set.prototype.size/clear/forEach and the ES2025
// Set composition methods. Test oracle only: the guest helpers run against the
// host model of the private collection intrinsics inside a node:vm realm with
// a mock Set, compared with native V8 Set (ES2025 set methods). Never a
// runtime fallback; no GPU is used here (gpuChecks:false).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { setExtraMethods, setExtraIntrinsics, setExtraPending, setExtraSources } from './stdlib-set-extra.js';
import { setExtraCases, setExtraUnsupportedSources, setExtraResumptionSource, setExtraResumptionExpected } from './stdlib-set-extra-cases.js';
import { createCollectionHostModel } from './stdlib-collections-host-model.js';
import { SET_IDS, collectionIntrinsics } from './stdlib-ids.js';
// bootstrap.js / program.js (and through them the parent registry) are loaded
// after the differential checks, so the oracle runs even while sibling worker
// modules are still missing from the registry.
const fnName = s => /^function\s+([\w$]+)\s*\(/.exec(s)?.[1];

assert.equal(typeof Set.prototype.union, 'function', 'Node must provide ES2025 Set methods for the native oracle');

// ---- metadata / contract checks ------------------------------------------
let metadataChecks = 0;
const expectedMeta = [['size', 0, 'setSize', 'getter'], ['clear', 0, 'setClear', 'method'], ['forEach', 1, 'setForEach', 'method'],
  ['union', 1, 'setUnion', 'method'], ['intersection', 1, 'setIntersection', 'method'], ['difference', 1, 'setDifference', 'method'],
  ['symmetricDifference', 1, 'setSymmetricDifference', 'method'], ['isSubsetOf', 1, 'setIsSubsetOf', 'method'],
  ['isSupersetOf', 1, 'setIsSupersetOf', 'method'], ['isDisjointFrom', 1, 'setIsDisjointFrom', 'method']];
assert.equal(setExtraMethods.length, expectedMeta.length);
for (const [name, length, field, kind] of expectedMeta) {
  const m = setExtraMethods.find(x => x.name === name);
  assert.ok(m, name); assert.equal(m.owner, 'Set.prototype'); assert.equal(m.id, SET_IDS[name]); assert.equal(m.length, length);
  assert.equal(m.field, field); assert.equal(m.kind, kind); assert.equal(m.source, setExtraSources[field]);
  assert.ok(m.id >= 2220 && m.id <= 2239);
  const fnLength = Object.getOwnPropertyDescriptor(Set.prototype, name);
  assert.equal((fnLength.get || fnLength.value).length, length, name + ' native length');
  metadataChecks++;
}
assert.equal(setExtraMethods.find(m => m.name === 'size').functionName, 'get size');
for (const [name, id] of Object.entries(setExtraIntrinsics)) { if (name in collectionIntrinsics) assert.equal(collectionIntrinsics[name], id); else assert.ok([113, 122, 129].includes(id), name); metadataChecks++; }
for (const source of Object.values(setExtraSources)) for (const name of source.match(/__lanes\w+/g)) { assert.ok(Object.hasOwn(setExtraIntrinsics, name), name); metadataChecks++; }
// forEach and the "this" branches walk iterator objects, never raw entry ids.
assert.match(setExtraSources.setForEach, /__lanesCollectionIterator\(set, 1\)/);
assert.match(setExtraSources.setForEach, /__lanesCall\(callbackfn, thisArg, value, value, set\)/);
for (const f of ['setIntersection', 'setIsSubsetOf', 'setIsDisjointFrom']) assert.match(setExtraSources[f], /__lanesCollectionIterator\(this, 1\)/);
// Results are built with the internal add, never the public method.
for (const source of Object.values(setExtraSources)) assert.doesNotMatch(source, /\.add\(|\.has\(|\.delete\(/);
assert.ok(Array.isArray(setExtraPending) && setExtraPending.length > 0);

// ---- mock Set realm (helpers + host model) -------------------------------
const mockContext = vm.createContext({});
const R = vm.runInContext('({Function, Object, Reflect, Symbol})', mockContext);
const hostCall = (f, t, ...a) => Reflect.apply(f, t, a);
function hostPrimitive(value) { // ToPrimitive(value, number); oracle only
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return value;
  const exotic = value[Symbol.toPrimitive];
  if (exotic !== undefined && exotic !== null) { const r = Reflect.apply(exotic, value, ['number']); if (r === null || (typeof r !== 'object' && typeof r !== 'function')) return r; throw new R.Function('return TypeError')()('Cannot convert object to primitive value'); }
  for (const key of ['valueOf', 'toString']) { const fn = value[key]; if (typeof fn === 'function') { const r = Reflect.apply(fn, value, []); if (r === null || (typeof r !== 'object' && typeof r !== 'function')) return r; } }
  throw new (new R.Function('return TypeError')())('Cannot convert object to primitive value');
}
let model;
const create = b => model.intrinsics.__lanesCollectionCreate(b);
const MockSet = new R.Function('create', 'call', '"use strict";return function Set(){if(new.target===undefined)throw new TypeError("Constructor Set requires \'new\'");const set=create(2);const iterable=arguments[0];if(iterable===undefined||iterable===null)return set;const adder=set.add;if(typeof adder!=="function")throw new TypeError("add");for(const v of iterable)call(adder,set,v);return set;};')(create, hostCall);
const SetIteratorPrototype = R.Object.create(R.Object.prototype);
model = createCollectionHostModel({ setPrototype: MockSet.prototype, setIteratorPrototype: SetIteratorPrototype });
const bindings = { ...model.intrinsics, __lanesCall: hostCall, __lanesPrimitive: hostPrimitive, __lanesNumber: Number };
const instantiate = source => new R.Function(...Object.keys(bindings), `"use strict";return (${source});`)(...Object.values(bindings));
// Host versions of worker 3's add/has/delete, the iterator worker's
// values/keys/next, written against the same intrinsics.
const coreSources = {
  add: 'function setAddBootstrap(value){"use strict";if(__lanesCollectionBrand(this)!==2)throw new TypeError("add");if(value===0)value=0;__lanesSetAdd(this,value);return this;}',
  has: 'function setHasBootstrap(value){"use strict";if(__lanesCollectionBrand(this)!==2)throw new TypeError("has");return __lanesCollectionHas(this,value);}',
  delete: 'function setDeleteBootstrap(value){"use strict";if(__lanesCollectionBrand(this)!==2)throw new TypeError("delete");return __lanesCollectionDelete(this,value);}',
  values: 'function setValuesBootstrap(){"use strict";if(__lanesCollectionBrand(this)!==2)throw new TypeError("values");return __lanesCollectionIterator(this,1);}',
};
const nextSource = 'function setIteratorNextBootstrap(){"use strict";if(__lanesCollectionIterBrand(this)!==2)throw new TypeError("next");if(!__lanesCollectionStep(this))return {value:undefined,done:true};return {value:__lanesCollectionIterValue(this),done:false};}';
const P = MockSet.prototype;
const defineFn = (fn, name, length) => { R.Object.defineProperty(fn, 'name', { value: name, configurable: true }); R.Object.defineProperty(fn, 'length', { value: length, configurable: true }); return fn; };
const method = (target, name, fn) => R.Object.defineProperty(target, name, { value: fn, writable: true, enumerable: false, configurable: true });
for (const [name, source] of Object.entries(coreSources)) method(P, name, defineFn(instantiate(source), name, name === 'values' ? 0 : 1));
method(P, 'keys', P.values); method(P, R.Symbol.iterator, P.values);
method(SetIteratorPrototype, 'next', defineFn(instantiate(nextSource), 'next', 0));
for (const m of setExtraMethods) {
  const fn = instantiate(m.source);
  if (m.kind === 'getter') R.Object.defineProperty(P, m.name, { get: defineFn(fn, m.functionName, m.length), set: undefined, enumerable: false, configurable: true });
  else method(P, m.name, defineFn(fn, m.name, m.length));
}
R.Object.defineProperty(P, R.Symbol.toStringTag, { value: 'Set', configurable: true });
R.Object.defineProperty(mockContext, 'Set', { value: MockSet, writable: true, configurable: true, enumerable: false });
// The realm really runs the guest helpers (not a native Set).
assert.equal(vm.runInContext('Set', mockContext), MockSet);
assert.equal(vm.runInContext('Set.prototype.union.toString().includes("__lanesSetAdd")&&Object.getPrototypeOf(new Set([1]).union(new Set()))===Set.prototype', mockContext), true);
for (const [name] of expectedMeta) {
  const a = R.Object.getOwnPropertyDescriptor(P, name), b = Object.getOwnPropertyDescriptor(Set.prototype, name);
  for (const k of ['enumerable', 'configurable', 'writable']) assert.equal(a[k], b[k], name + k);
  const fa = a.get || a.value, fb = b.get || b.value; assert.equal(fa.name, fb.name); assert.equal(fa.length, fb.length); metadataChecks++;
}

// ---- differential cases ----------------------------------------------------
let exactChecks = 0;
const same = (actual, expected, label) => { assert.ok(Object.is(actual, expected), `${label}: ${String(actual)} vs ${String(expected)}`); exactChecks++; };
const primitive = v => v === null || ['number', 'boolean', 'string', 'undefined'].includes(typeof v);
const nativeContext = vm.createContext({});
const features = new Set(); const perMethod = {};
for (const item of setExtraCases) {
  assert.ok(!features.has(item.feature), 'duplicate ' + item.feature); features.add(item.feature);
  assert.equal(fnName(item.source), 'f');
  assert.ok(item.inputs.length > 0);
  for (const m of setExtraMethods) if (item.source.includes(m.name === 'size' ? '.size' : '.' + m.name + '(')) perMethod[m.name] = (perMethod[m.name] || 0) + 1;
  const mockFn = new vm.Script('(' + item.source + ')').runInContext(mockContext);
  const nativeFn = new vm.Script('(' + item.source + ')').runInContext(nativeContext);
  for (const input of item.inputs) {
    const expected = nativeFn(input);
    assert.ok(primitive(expected), item.feature + ' returns a primitive');
    if (typeof expected === 'string') assert.ok(expected.length <= 256, item.feature + ' string limit');
    same(mockFn(input), expected, `${item.feature}(${String(input)})`);
  }
}
assert.ok(setExtraCases.length >= 40);
for (const m of setExtraMethods) assert.ok(perMethod[m.name] >= 3, m.name + ' coverage');
same(new vm.Script('(' + setExtraResumptionSource + ')').runInContext(nativeContext)(3), setExtraResumptionExpected, 'resumption native');
same(new vm.Script('(' + setExtraResumptionSource + ')').runInContext(mockContext)(3), setExtraResumptionExpected, 'resumption mock');

let unsupportedChecks = 0;
for (const source of setExtraUnsupportedSources) { assert.equal(fnName(source), 'f'); unsupportedChecks++; }
console.error(JSON.stringify({ differential: 'ok', exactChecks }));

// ---- shared runtime modules (loaded late, see top) -------------------------
const { privateBuiltins } = await import('./bootstrap.js');
const { packProgram, entrySource } = await import('./program.js');
for (const [name, id] of Object.entries(setExtraIntrinsics)) { assert.equal(privateBuiltins[name], id, name); metadataChecks++; }
for (const source of [...setExtraCases.map(i => i.source), setExtraResumptionSource, ...setExtraUnsupportedSources]) assert.equal(entrySource(source), 'f');

// ---- compiler parity (native vs Wasm) for each helper ----------------------
const { default: createWasm } = await import('./generated/compiler.mjs');
const wasm = await createWasm();
const nativePath = fileURLToPath(new URL('./generated/compiler', import.meta.url));
let helperParity = 0;
for (const m of setExtraMethods) {
  const native = JSON.parse(execFileSync(nativePath, [m.source], { encoding: 'utf8' }));
  const raw = JSON.parse(wasm.ccall('lanes_compile', 'string', ['string'], [m.source]));
  assert.ok(!native.error && !raw.error, m.field + ': ' + (native.error || raw.error));
  assert.equal(native.functions.length, 1, m.field + ' must not declare nested functions');
  for (const code of [raw, native]) code.functions[0].intrinsicRoot = true;
  const name = entrySource(m.source);
  const a = packProgram(raw, name), b = packProgram(native, name);
  assert.deepEqual(a.code, b.code); assert.deepEqual(a.image, b.image);
  helperParity++;
}

// ---- case sources: native compile; packing pending until `Set` is wired ----
let nativeCompiled = 0, integratedPacked = 0, integrationPending = false; const pendingReasons = new Set();
for (const source of [...setExtraCases.map(i => i.source), setExtraResumptionSource, ...setExtraUnsupportedSources]) {
  const native = JSON.parse(execFileSync(nativePath, [source], { encoding: 'utf8' }));
  assert.ok(!native.error, source + ': ' + native.error);
  nativeCompiled++;
  try { packProgram(native, entrySource(source)); integratedPacked++; }
  catch (error) {
    if (!/\bSet\b|\bMap\b/.test(error.message)) throw error;
    integrationPending = true; pendingReasons.add(error.message);
  }
}

console.log(JSON.stringify({
  cases: setExtraCases.length, inputs: setExtraCases.reduce((n, c) => n + c.inputs.length, 0), exactChecks, metadataChecks,
  unsupportedChecks, helperParity, nativeCompiled, integratedPacked, integrationPending, pendingReasons: [...pendingReasons], gpuChecks: false,
}));
