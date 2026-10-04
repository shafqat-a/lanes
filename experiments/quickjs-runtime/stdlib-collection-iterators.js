// Standard-library wave, worker 5: Map/Set iterator creators and
// %MapIteratorPrototype%.next / %SetIteratorPrototype%.next.
// Guest code only (strict helpers compiled by QuickJS as intrinsic roots and
// executed on the GPU). Mutation semantics (deleted-unvisited skipped,
// appended visited, clear+add continues, exhausted stays done) come from the
// kind-43/44/46 storage contract in STDLIB-WAVE-CONTRACT.md; the helpers only
// brand-check, step and build CreateIterResultObject results.
//
// Spec: ES2025 24.1.3.4/24.1.3.8/24.1.3.11/24.1.3.12 (Map.prototype.entries,
// keys, values, @@iterator), 24.1.5 (%MapIteratorPrototype%), 24.2.4.5/
// 24.2.4.12/24.2.4.16/24.2.4.17 (Set.prototype.entries, keys, values,
// @@iterator), 24.2.6 (%SetIteratorPrototype%).
//
// Method record conventions (STDLIB-WAVE-CONTRACT.md "Worker module format"):
// * A record with `source` defines the function value `id` (FIELDS `field`).
//   `name` is both the property key and the reported function name.
// * A record with `alias` installs the existing function value `alias` (no
//   new identity, no source). The key is `symbol` (well-known symbol) when
//   present, otherwise `name` (Set.prototype.keys). For symbol-keyed alias
//   records `name` is informational (the aliased function's own name). The
//   function value is shared, so its name is never re-assigned:
//   Set.prototype.keys.name === "values",
//   Map.prototype[Symbol.iterator].name === "entries".
// * Property attributes are the ordinary builtin-method ones: writable,
//   non-enumerable, configurable.
import { MAP_IDS, SET_IDS, ITERATOR_IDS, collectionIntrinsics } from './stdlib-ids.js';

const creator = (field, owner, brand, kind) => `function ${field}Bootstrap() {
  "use strict";
  if (__lanesCollectionBrand(this) !== ${brand}) throw new TypeError("${owner} called on incompatible receiver");
  return __lanesCollectionIterator(this, ${kind});
}`;

// %XIteratorPrototype%.next: GeneratorValidate-equivalent brand check, then
// one step. Kind 2 builds a fresh [key, value] Array each step (CreateArrayFromList).
const next = (field, owner, brand) => `function ${field}Bootstrap() {
  "use strict";
  if (__lanesCollectionIterBrand(this) !== ${brand}) throw new TypeError("${owner} called on incompatible receiver");
  if (!__lanesCollectionStep(this)) return { value: undefined, done: true };
  const kind = __lanesCollectionIterKind(this);
  let value;
  if (kind === 0) value = __lanesCollectionIterKey(this);
  else if (kind === 1) value = __lanesCollectionIterValue(this);
  else value = [__lanesCollectionIterKey(this), __lanesCollectionIterValue(this)];
  return { value: value, done: false };
}`;

export const collectionIteratorMethods = Object.freeze([
  { owner: 'Map.prototype', name: 'entries', id: MAP_IDS.entries, length: 0, field: 'mapEntries', kind: 'method',
    source: creator('mapEntries', 'Map.prototype.entries', 1, 2) },
  { owner: 'Map.prototype', name: 'entries', symbol: 'iterator', alias: MAP_IDS.entries, length: 0, kind: 'method' },
  { owner: 'Map.prototype', name: 'keys', id: MAP_IDS.keys, length: 0, field: 'mapKeys', kind: 'method',
    source: creator('mapKeys', 'Map.prototype.keys', 1, 0) },
  { owner: 'Map.prototype', name: 'values', id: MAP_IDS.values, length: 0, field: 'mapValues', kind: 'method',
    source: creator('mapValues', 'Map.prototype.values', 1, 1) },
  { owner: 'Set.prototype', name: 'values', id: SET_IDS.values, length: 0, field: 'setValues', kind: 'method',
    source: creator('setValues', 'Set.prototype.values', 2, 1) },
  { owner: 'Set.prototype', name: 'keys', alias: SET_IDS.values, length: 0, kind: 'method' },
  { owner: 'Set.prototype', name: 'values', symbol: 'iterator', alias: SET_IDS.values, length: 0, kind: 'method' },
  { owner: 'Set.prototype', name: 'entries', id: SET_IDS.entries, length: 0, field: 'setEntries', kind: 'method',
    source: creator('setEntries', 'Set.prototype.entries', 2, 2) },
  { owner: 'MapIterator.prototype', name: 'next', id: ITERATOR_IDS.mapNext, length: 0, field: 'mapIteratorNext', kind: 'method',
    source: next('mapIteratorNext', '%MapIteratorPrototype%.next', 1) },
  { owner: 'SetIterator.prototype', name: 'next', id: ITERATOR_IDS.setNext, length: 0, field: 'setIteratorNext', kind: 'method',
    source: next('setIteratorNext', '%SetIteratorPrototype%.next', 2) },
].map(Object.freeze));

// @@toStringTag data properties (key 0x60000000|42), installed by the parent
// on fixed nodes 70 / 71: { writable:false, enumerable:false, configurable:true }.
export const iteratorToStringTags = Object.freeze([
  { owner: 'MapIterator.prototype', node: 70, value: 'Map Iterator', writable: false, enumerable: false, configurable: true },
  { owner: 'SetIterator.prototype', node: 71, value: 'Set Iterator', writable: false, enumerable: false, configurable: true },
].map(Object.freeze));

const used = ['__lanesCollectionBrand', '__lanesCollectionIterator', '__lanesCollectionStep', '__lanesCollectionIterKey',
  '__lanesCollectionIterValue', '__lanesCollectionIterBrand', '__lanesCollectionIterKind'];
export const collectionIteratorIntrinsics = Object.freeze(Object.fromEntries(used.map(name => [name, collectionIntrinsics[name]])));

export const collectionIteratorPending = Object.freeze([
  'for-of / spread / Array.from / destructuring / yield* over Map, Set and their iterator objects: Map.prototype and Set.prototype carry @@iterator, so iterationKind returns 0 and __lanesIteratorOpen reports Unsupported (status 6). Iterator objects (kind 46) have no @@iterator until %MapIteratorPrototype%/%SetIteratorPrototype% (nodes 70/71) are relinked to %IteratorPrototype%; they are also kind 0 / Unsupported today. Owner: Grok generic iterator protocol (1270-1273, 2400-2499). See stdlib-iterator-handoff.md.',
  'new Map(map) / new Set(set) (copy construction) reach the same Unsupported guard through the constructor helper\'s for-of.',
  '%MapIteratorPrototype% / %SetIteratorPrototype% [[Prototype]] is Object.prototype (no Iterator.prototype helpers such as map/filter/toArray, no @@iterator) until Grok\'s %IteratorPrototype% lands.',
  'No GPU execution in this wave from worker 5: all checks are host oracles plus native/Wasm compiler parity. Case programs reference the Map/Set globals, which pack only after the parent registry wires them (integrationPending).',
]);
