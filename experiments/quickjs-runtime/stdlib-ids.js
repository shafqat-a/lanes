// Standard-library wave (Map/Set/iterators/Reflect/numeric) shared reservations.
// Parent-owned single source of truth; workers import, never edit.
// Reserved for this job: builtin ids 2200..2399, heap kinds 40..47,
// continuations 88..103, fixed nodes 66..73 (already excluded from the free
// list 26..79 by phase4-fixed-nodes.js). Grok's generic iterator protocol owns
// 1270..1273 and 2400..2499 and is NOT touched here.

// Fixed nodes (initialized in place in main(); kind != 0 makes collect() root them).
export const STDLIB_NODES = Object.freeze({
  mapCtor: 66,          // kind 2, proto Function.prototype; objectView(V(2200,11)) <-> node 66
  mapProto: 67,         // kind 2, proto Object.prototype
  setCtor: 68,          // kind 2, proto Function.prototype; objectView(V(2220,11)) <-> node 68
  setProto: 69,         // kind 2, proto Object.prototype
  mapIteratorProto: 70, // kind 2, %MapIteratorPrototype% (proto Object.prototype until Grok's %IteratorPrototype% lands)
  setIteratorProto: 71, // kind 2, %SetIteratorPrototype% (same note)
  // 72, 73: parent spare (unused).
});

// Heap kinds. Brand objects keep the generic object layout
// value=(prototype, 0, collectionHeader, extensible) and a property chain in `next`.
export const STDLIB_KINDS = Object.freeze({
  mapObject: 40,      // Map instance (tag-4 guest value)
  setObject: 41,      // Set instance
  header: 42,         // value=(firstEntry, lastEntry, liveCount, 0)
  entry: 43,          // live entry: value=key (−0 normalized to +0), key=Map value-cell id (0 for Set), next=next entry
  deleted: 44,        // tombstone: kept linked so live iterators/forEach continue; unlinked by collect() when unpinned
  valueCell: 45,      // Map value: value=V
  iterator: 46,       // value=(prototype, collectionObj|0 when exhausted, currentEntry|0 before first, extensible), key=iterKind (0 keys,1 values,2 entries)
  spare: 47,
});

// Public builtin ids (tag-11 function values).
export const MAP_IDS = Object.freeze({
  ctor: 2200, construct: 2201, get: 2202, set: 2203, has: 2204, delete: 2205, clear: 2206,
  forEach: 2207, size: 2208, entries: 2209, keys: 2210, values: 2211, groupBy: 2212,
});
export const SET_IDS = Object.freeze({
  ctor: 2220, construct: 2221, add: 2222, has: 2223, delete: 2224, clear: 2225, forEach: 2226,
  size: 2227, values: 2228, entries: 2229, union: 2230, intersection: 2231, difference: 2232,
  symmetricDifference: 2233, isSubsetOf: 2234, isSupersetOf: 2235, isDisjointFrom: 2236,
});
export const ITERATOR_IDS = Object.freeze({ mapNext: 2240, setNext: 2241 });

// Private WGSL intrinsics callable only from trusted bootstrap helpers.
// Every intrinsic that receives a collection requires the right brand; a wrong
// brand is an internal error (status 2) — helpers MUST brand-check first and
// throw a guest TypeError themselves.
export const collectionIntrinsics = Object.freeze({
  __lanesCollectionCreate: 2260,     // (brand 1 Map | 2 Set) -> new empty Map/Set with intrinsic prototype
  __lanesCollectionBrand: 2261,      // (value) -> 1 Map, 2 Set, 0 otherwise (never throws)
  __lanesCollectionHas: 2262,        // (c, key) -> boolean, SameValueZero
  __lanesMapGet: 2263,               // (map, key) -> value | undefined
  __lanesMapSet: 2264,               // (map, key, value) -> map; update in place or append (−0 key -> +0)
  __lanesSetAdd: 2265,               // (set, key) -> set; append if absent (−0 -> +0)
  __lanesCollectionDelete: 2266,     // (c, key) -> boolean; live entry becomes tombstone (kind 44)
  __lanesCollectionClear: 2267,      // (c) -> undefined; every live entry becomes a tombstone
  __lanesCollectionSize: 2268,       // (c) -> number of live entries
  __lanesCollectionIterator: 2269,   // (c, kind 0 keys|1 values|2 entries) -> iterator object (kind 46, proto node 70/71)
  __lanesCollectionStep: 2270,       // (it) -> boolean; advance to next live entry after current, false (and exhausted) at end
  __lanesCollectionIterKey: 2271,    // (it) -> key of current entry
  __lanesCollectionIterValue: 2272,  // (it) -> Map value of current entry (Set: key)
  __lanesCollectionIterBrand: 2273,  // (value) -> 1 Map iterator, 2 Set iterator, 0 otherwise
  __lanesCollectionIterKind: 2274,   // (it) -> 0 keys, 1 values, 2 entries
});

// Remaining ranges (owners): Reflect 2300..2319 (worker 6; 2300..2311 public,
// 2312..2319 optional new WGSL intrinsics), numeric 2320..2379 (worker 7),
// conformance/parent spare 2380..2399.
export const REFLECT_ID_FIRST = 2300, REFLECT_ID_LAST = 2319;
export const NUMERIC_ID_FIRST = 2320, NUMERIC_ID_LAST = 2379;

// Continuations 88..103: 88..91 collections, 92..95 Reflect, 96..99 numeric,
// 100..103 parent. None are required by the guest-helper design.
export const STDLIB_CONTINUATIONS = Object.freeze({ first: 88, last: 103 });

// Well-known symbol property keys (phase3 contract: key = 0x60000000 | cellNode).
export const SYMBOL_KEY = Object.freeze({ species: 0x60000000 | 39, iterator: 0x60000000 | 34, toStringTag: 0x60000000 | 42 });
