// Standard-library wave, worker 2: Map.prototype.size (getter), delete, clear,
// forEach. Guest code only: strict helpers compiled by QuickJS as intrinsic
// roots and executed on the GPU. ES2025 24.1.3.2 clear, 24.1.3.3 delete,
// 24.1.3.5 forEach, 24.1.3.10 get size.
// Storage, SameValueZero, -0 normalization, tombstones and GC pinning belong to
// the WGSL collection core (STDLIB-WAVE-CONTRACT.md). These helpers only
// brand-check (guest TypeError; intrinsics treat a wrong brand as status 2),
// order the observable steps and call the private intrinsics.
//
// forEach never holds a raw entry id: it walks a kind-46 iterator object
// (__lanesCollectionIterator(map, 2)). The iterator is a guest value kept in a
// local, so GC marks it, and it pins its current entry; a tombstone created by
// deleting the current entry inside the callback therefore stays linked and
// __lanesCollectionStep continues from its `next`. This yields the ES2025 List
// semantics: appended entries are visited, entries deleted before being
// reached are skipped, delete+re-insert of a visited key appends a new entry
// that is visited again, and clear followed by set continues with the new
// entries.
//
// Helpers declare no nested functions: only functions[0] is an intrinsic root,
// so the private intrinsics are visible only in the helper body itself.
import { MAP_IDS, collectionIntrinsics } from './stdlib-ids.js';

const brand = method => `if (__lanesCollectionBrand(this) !== 1) throw new TypeError("Method Map.prototype.${method} called on incompatible receiver");`;

export const mapExtraSources = Object.freeze({
  // 24.1.3.10: RequireInternalSlot(M, [[MapData]]); count of non-empty entries.
  mapSize: `function mapSizeBootstrap(){
  "use strict";
  ${brand('size')}
  return __lanesCollectionSize(this);
}`,
  // 24.1.3.3: SameValueZero lookup (no CanonicalizeKeyedCollectionKey needed
  // for lookup: +0 and -0 compare equal); entry becomes a tombstone.
  mapDelete: `function mapDeleteBootstrap(key){
  "use strict";
  ${brand('delete')}
  return __lanesCollectionDelete(this, key);
}`,
  // 24.1.3.2: every live entry becomes a tombstone; returns undefined.
  mapClear: `function mapClearBootstrap(){
  "use strict";
  ${brand('clear')}
  __lanesCollectionClear(this);
  return undefined;
}`,
  // 24.1.3.5: brand check, then IsCallable(callbackfn) before any iteration,
  // then Call(callbackfn, thisArg, << value, key, M >>) per live entry in List
  // order, re-reading the list after every callback. thisArg is passed as-is
  // (OrdinaryCallBindThis applies sloppy-mode coercion inside the callee).
  // length is 1: thisArg is read from `arguments`.
  mapForEach: `function mapForEachBootstrap(callbackfn){
  "use strict";
  const map = this;
  ${brand('forEach')}
  if (typeof callbackfn !== "function") throw new TypeError("Map.prototype.forEach callback is not a function");
  const thisArg = arguments.length > 1 ? arguments[1] : undefined;
  const it = __lanesCollectionIterator(map, 2);
  while (__lanesCollectionStep(it)) {
    const value = __lanesCollectionIterValue(it);
    const key = __lanesCollectionIterKey(it);
    __lanesCall(callbackfn, thisArg, value, key, map);
  }
  return undefined;
}`,
});

export const mapExtraMethods = Object.freeze([
  { owner: 'Map.prototype', name: 'delete', id: MAP_IDS.delete, length: 1, field: 'mapDelete', kind: 'method', source: mapExtraSources.mapDelete },
  { owner: 'Map.prototype', name: 'clear', id: MAP_IDS.clear, length: 0, field: 'mapClear', kind: 'method', source: mapExtraSources.mapClear },
  { owner: 'Map.prototype', name: 'forEach', id: MAP_IDS.forEach, length: 1, field: 'mapForEach', kind: 'method', source: mapExtraSources.mapForEach },
  // Accessor { get: <function "get size", length 0>, set: undefined,
  // enumerable: false, configurable: true } on Map.prototype.
  { owner: 'Map.prototype', name: 'size', id: MAP_IDS.size, length: 0, field: 'mapSize', kind: 'getter', functionName: 'get size', source: mapExtraSources.mapSize },
].map(Object.freeze));

const used = ['__lanesCollectionBrand', '__lanesCollectionSize', '__lanesCollectionDelete', '__lanesCollectionClear',
  '__lanesCollectionIterator', '__lanesCollectionStep', '__lanesCollectionIterKey', '__lanesCollectionIterValue'];
// Names used by the sources (besides __lanesCall, 113, from bootstrap.js privateBuiltins).
export const mapExtraIntrinsics = Object.freeze(Object.fromEntries(used.map(name => [name, collectionIntrinsics[name]])));

export const mapExtraPending = Object.freeze([
  'GPU execution of every case (coordinator-owned M1/Safari run after stdlib-registry.js integration)',
  'integrated packing of case sources: needs the parent to bind the `Map` global and install these helpers (stdlib-registry.js)',
  'Map.prototype.forEach called on a Set / Set.prototype.forEach on a Map: brand check is in place, oracle case needs worker 3 Set in the mock',
  'iteration of a Map with for-of / spread / new Map(map): depends on the generic iterator protocol (1270..1273 / 2400..2499), outside this worker',
]);
