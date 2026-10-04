// Standard-library wave, worker 1: Map constructor and Map.prototype.get/set/has.
// Guest code only (strict helpers compiled by QuickJS as intrinsic roots and
// executed on the GPU). ES2025 24.1.1.1 Map(iterable), 24.1.1.2
// AddEntriesFromIterable, 24.1.3.6 get, 24.1.3.7 has, 24.1.3.9 set.
// Storage, SameValueZero and -0 normalization belong to the WGSL collection
// core (STDLIB-WAVE-CONTRACT.md); these helpers only brand-check, order the
// observable operations and call the private intrinsics.
import { MAP_IDS, collectionIntrinsics } from './stdlib-ids.js';

// Route of `new Map(iterable)` (id 2201, no receiver). NewTarget handling
// (call without `new` -> TypeError, subclass NewTarget -> status 6) is done by
// the parent's construct dispatch before this helper is entered.
// Order (spec): OrdinaryCreateFromConstructor; return if iterable is
// undefined/null; Get(map, "set") (observable: a patched Map.prototype.set is
// used); IsCallable(adder); GetIterator(iterable); per entry: non-Object ->
// TypeError + IteratorClose; Get(entry, "0"); Get(entry, "1"); Call(adder,
// map, k, v). Abrupt completions inside the loop close the iterator (for-of).
export const mapConstructSource = `function mapConstructBootstrap(iterable){
  "use strict";
  const map = __lanesCollectionCreate(1);
  if (iterable === undefined || iterable === null) return map;
  const adder = map.set;
  if (typeof adder !== "function") throw new TypeError("Map.prototype.set is not a function");
  for (const entry of iterable) {
    if (entry === null || (typeof entry !== "object" && typeof entry !== "function")) throw new TypeError("Iterator value is not an entry object");
    const k = entry[0];
    const v = entry[1];
    __lanesCall(adder, map, k, v);
  }
  return map;
}`;

const brand = method => `if (__lanesCollectionBrand(this) !== 1) throw new TypeError("Method Map.prototype.${method} called on incompatible receiver");`;

export const mapCoreSources = Object.freeze({
  mapConstruct: mapConstructSource,
  mapGet: `function mapGetBootstrap(key){
  "use strict";
  ${brand('get')}
  return __lanesMapGet(this, key);
}`,
  // -0 is normalized here as well as in the intrinsic (spec step 3), so the
  // stored key is +0 regardless of the core's own normalization.
  mapSet: `function mapSetBootstrap(key, value){
  "use strict";
  ${brand('set')}
  if (key === 0) key = 0;
  __lanesMapSet(this, key, value);
  return this;
}`,
  mapHas: `function mapHasBootstrap(key){
  "use strict";
  ${brand('has')}
  return __lanesCollectionHas(this, key);
}`,
});

export const mapConstructEntry = Object.freeze({
  owner: 'Map', name: 'Map', id: MAP_IDS.construct, ctorId: MAP_IDS.ctor, length: 0,
  field: 'mapConstruct', kind: 'construct', source: mapConstructSource,
});

export const mapCoreMethods = Object.freeze([
  Object.freeze({ owner: 'Map.prototype', name: 'get', id: MAP_IDS.get, length: 1, field: 'mapGet', kind: 'method', source: mapCoreSources.mapGet }),
  Object.freeze({ owner: 'Map.prototype', name: 'set', id: MAP_IDS.set, length: 2, field: 'mapSet', kind: 'method', source: mapCoreSources.mapSet }),
  Object.freeze({ owner: 'Map.prototype', name: 'has', id: MAP_IDS.has, length: 1, field: 'mapHas', kind: 'method', source: mapCoreSources.mapHas }),
]);

const used = ['__lanesCollectionCreate', '__lanesCollectionBrand', '__lanesCollectionHas', '__lanesMapGet', '__lanesMapSet'];
export const mapCoreIntrinsics = Object.freeze({
  ...Object.fromEntries(used.map(name => [name, collectionIntrinsics[name]])),
  __lanesCall: 113, // existing privateBuiltins entry (bootstrap.js)
  __lanesIterationKind: 1273, // existing phase4-iteration.js builtin: 1 array/arguments, 2 string/String wrapper, 4 null/undefined, 0 otherwise
});

export const mapCorePending = Object.freeze([
  'new Map(iterable) for iterables with a callable @@iterator (Map/Set instances, user iterables, generators) reaches the explicit __lanesUnsupported guard (status 6) until the generic iterator protocol (1270-1273 / 2400-2499) is merged.',
  'TEMPORARY: the constructor pre-check (__lanesIterationKind(iterable) === 0 -> Get(iterable, @@iterator), TypeError if undefined/null or not callable) makes new Map(5) / new Map({}) / new Map(true) spec TypeErrors today. It performs one extra observable Get of @@iterator before the for-of GetIterator, so it MUST be removed when the generic iterator protocol merges.',
  'Subclass construction (class X extends Map, Reflect.construct with another NewTarget) keeps the status 6 boundary (parent construct dispatch).',
  'Map ctor/prototype metadata (Map.length 0, Map.name, Map.prototype descriptor, constructor link, @@toStringTag "Map", method name/length/descriptors) is installed by the parent registry; this module only supplies values.',
]);
