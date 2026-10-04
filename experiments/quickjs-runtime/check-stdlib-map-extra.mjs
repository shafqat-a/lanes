// Worker 2 host checks for Map.prototype.size/delete/clear/forEach.
// Test oracle only: the helpers run against the host model of the private
// collection intrinsics, compared with native V8 Map. Never a runtime fallback;
// no GPU is used here (gpuChecks:false).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { mapExtraMethods, mapExtraIntrinsics, mapExtraPending, mapExtraSources } from './stdlib-map-extra.js';
import { mapExtraCases, mapExtraUnsupportedSources, mapExtraResumptionSource, mapExtraResumptionExpected } from './stdlib-map-extra-cases.js';
import { createCollectionHostModel } from './stdlib-collections-host-model.js';
import { MAP_IDS, collectionIntrinsics } from './stdlib-ids.js';
import { privateBuiltins } from './bootstrap.js';
import { packProgram, entrySource } from './program.js';

// ---- metadata / contract checks ------------------------------------------
let metadataChecks = 0;
const meta = name => mapExtraMethods.find(m => m.name === name);
for (const [name, id, length, field, kind] of [['size', MAP_IDS.size, 0, 'mapSize', 'getter'], ['delete', MAP_IDS.delete, 1, 'mapDelete', 'method'], ['clear', MAP_IDS.clear, 0, 'mapClear', 'method'], ['forEach', MAP_IDS.forEach, 1, 'mapForEach', 'method']]) {
  const m = meta(name);
  assert.ok(m, name); assert.equal(m.owner, 'Map.prototype'); assert.equal(m.id, id); assert.equal(m.length, length); assert.equal(m.field, field); assert.equal(m.kind, kind);
  assert.equal(m.source, mapExtraSources[field]); metadataChecks++;
}
assert.equal(mapExtraMethods.length, 4);
for (const [name, id] of Object.entries(mapExtraIntrinsics)) { assert.equal(collectionIntrinsics[name], id); assert.equal(privateBuiltins[name], id); metadataChecks++; }
assert.equal(privateBuiltins.__lanesCall, 113);
// Every free __lanes* name in a source must be a declared intrinsic (or __lanesCall).
for (const source of Object.values(mapExtraSources)) for (const name of source.match(/__lanes\w+/g)) { assert.ok(name === '__lanesCall' || Object.hasOwn(mapExtraIntrinsics, name), name); metadataChecks++; }
// forEach must walk an iterator object (never raw entry ids).
assert.match(mapExtraSources.mapForEach, /__lanesCollectionIterator\(map, 2\)/);
assert.match(mapExtraSources.mapForEach, /__lanesCall\(callbackfn, thisArg, value, key, map\)/);
assert.ok(Array.isArray(mapExtraPending) && mapExtraPending.length > 0);

// ---- mock Map realm (helpers + host model) -------------------------------
const mockContext = vm.createContext({});
const R = vm.runInContext('({Function, Object, Reflect, Symbol})', mockContext);
const hostCall = (f, t, ...a) => Reflect.apply(f, t, a);
let model;
const MockMap = new R.Function('create', '"use strict";return function Map(){if(new.target===undefined)throw new TypeError("Constructor Map requires \'new\'");if(arguments.length>0&&arguments[0]!==undefined&&arguments[0]!==null)throw new Error("mock Map: iterable argument not modelled");return create(1);};')((b) => model.intrinsics.__lanesCollectionCreate(b));
model = createCollectionHostModel({ mapPrototype: MockMap.prototype });
const bindings = { ...model.intrinsics, __lanesCall: hostCall };
// Same as instantiateHelper, but with the mock realm's Function so guest
// TypeErrors are the realm's TypeError (instanceof checks in cases).
const instantiate = source => new R.Function(...Object.keys(bindings), `"use strict";return (${source});`)(...Object.values(bindings));
// Minimal host versions of worker 1's get/set/has against the same intrinsics.
const coreSources = {
  get: 'function mapGetBootstrap(key){"use strict";if(__lanesCollectionBrand(this)!==1)throw new TypeError("get");return __lanesMapGet(this,key);}',
  set: 'function mapSetBootstrap(key,value){"use strict";if(__lanesCollectionBrand(this)!==1)throw new TypeError("set");if(key===0)key=0;__lanesMapSet(this,key,value);return this;}',
  has: 'function mapHasBootstrap(key){"use strict";if(__lanesCollectionBrand(this)!==1)throw new TypeError("has");return __lanesCollectionHas(this,key);}',
};
const P = MockMap.prototype;
const defineFn = (fn, name, length) => { R.Object.defineProperty(fn, 'name', { value: name, configurable: true }); R.Object.defineProperty(fn, 'length', { value: length, configurable: true }); return fn; };
for (const [name, source] of Object.entries(coreSources)) R.Object.defineProperty(P, name, { value: defineFn(instantiate(source), name, name === 'set' ? 2 : 1), writable: true, enumerable: false, configurable: true });
for (const m of mapExtraMethods) {
  const fn = instantiate(m.source);
  if (m.kind === 'getter') R.Object.defineProperty(P, m.name, { get: defineFn(fn, m.functionName, m.length), set: undefined, enumerable: false, configurable: true });
  else R.Object.defineProperty(P, m.name, { value: defineFn(fn, m.name, m.length), writable: true, enumerable: false, configurable: true });
}
R.Object.defineProperty(P, R.Symbol.toStringTag, { value: 'Map', configurable: true });
R.Object.defineProperty(mockContext, 'Map', { value: MockMap, writable: true, configurable: true, enumerable: false });
// Sanity: mock exposes the same shape as native for the owned members.
for (const name of ['size', 'delete', 'clear', 'forEach']) {
  const a = R.Object.getOwnPropertyDescriptor(P, name), b = Object.getOwnPropertyDescriptor(Map.prototype, name);
  for (const k of ['enumerable', 'configurable', 'writable']) assert.equal(a[k], b[k], name + k);
  const fa = a.get || a.value, fb = b.get || b.value; assert.equal(fa.name, fb.name); assert.equal(fa.length, fb.length); metadataChecks++;
}

// ---- differential cases ----------------------------------------------------
let exactChecks = 0;
const same = (actual, expected, label) => { assert.ok(Object.is(actual, expected), `${label}: ${String(actual)} vs ${String(expected)}`); exactChecks++; };
const primitive = v => v === null || ['number', 'boolean', 'string', 'undefined'].includes(typeof v);
const nativeContext = vm.createContext({});
const features = new Set();
for (const item of mapExtraCases) {
  assert.ok(!features.has(item.feature), 'duplicate ' + item.feature); features.add(item.feature);
  assert.equal(entrySource(item.source), 'f');
  assert.ok(item.source.length <= 1000 && item.inputs.length > 0);
  const mockFn = new vm.Script('(' + item.source + ')').runInContext(mockContext);
  const nativeFn = new vm.Script('(' + item.source + ')').runInContext(nativeContext);
  for (const input of item.inputs) {
    const expected = nativeFn(input);
    assert.ok(primitive(expected), item.feature + ' returns a primitive');
    if (typeof expected === 'string') assert.ok(expected.length <= 256, item.feature + ' string limit');
    same(mockFn(input), expected, `${item.feature}(${String(input)})`);
  }
}
assert.ok(mapExtraCases.length >= 30);
const resumptionNative = new vm.Script('(' + mapExtraResumptionSource + ')').runInContext(nativeContext)(3);
same(resumptionNative, mapExtraResumptionExpected, 'resumption native');
same(new vm.Script('(' + mapExtraResumptionSource + ')').runInContext(mockContext)(3), mapExtraResumptionExpected, 'resumption mock');

// Host-model tombstone retention: the model has no GC, so this only checks
// the iteration logic of the churn cases; GPU reclamation is checked on device.
let unsupportedChecks = 0;
for (const item of mapExtraUnsupportedSources) {
  if (/^async/.test(item.source)) assert.throws(() => entrySource(item.source), SyntaxError);
  else assert.equal(entrySource(item.source), 'f');
  unsupportedChecks++;
}

// ---- compiler parity (native vs Wasm) for each helper ----------------------
const { default: create } = await import('./generated/compiler.mjs');
const wasm = await create();
const nativePath = fileURLToPath(new URL('./generated/compiler', import.meta.url));
let helperParity = 0;
for (const m of mapExtraMethods) {
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

// ---- case sources: native compile; packing pending until `Map` is wired ----
let nativeCompiled = 0, integratedPacked = 0, integrationPending = false; const pendingReasons = new Set();
for (const source of [...mapExtraCases.map(i => i.source), mapExtraResumptionSource]) {
  const native = JSON.parse(execFileSync(nativePath, [source], { encoding: 'utf8' }));
  assert.ok(!native.error, source + ': ' + native.error);
  nativeCompiled++;
  try { packProgram(native, entrySource(source)); integratedPacked++; }
  catch (error) {
    if (!/Map/.test(error.message)) throw error;
    integrationPending = true; pendingReasons.add(error.message);
  }
}

console.log(JSON.stringify({
  cases: mapExtraCases.length, exactChecks, metadataChecks, unsupportedChecks, helperParity,
  nativeCompiled, integratedPacked, integrationPending, pendingReasons: [...pendingReasons], gpuChecks: false,
}));
