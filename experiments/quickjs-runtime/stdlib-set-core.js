// Standard-library wave, worker 3: Set constructor and Set.prototype.add/has/delete.
// Guest code only (strict helpers compiled by QuickJS as intrinsic roots and
// executed on the GPU). ES2025 24.2.2.1 Set(iterable), 24.2.4.1 add,
// 24.2.4.6 delete, 24.2.4.8 has. Storage, SameValueZero, -0 normalization and
// insertion order (append-only entry chain with tombstones) belong to the WGSL
// collection core (STDLIB-WAVE-CONTRACT.md); these helpers only brand-check,
// order the observable operations and call the private intrinsics.
import { SET_IDS, collectionIntrinsics } from './stdlib-ids.js';

// Route of `new Set(iterable)` (id 2221, no receiver). NewTarget handling
// (call without `new` -> TypeError, subclass NewTarget -> status 6) is done by
// the parent's construct dispatch before this helper is entered.
// Order (spec 24.2.2.1): OrdinaryCreateFromConstructor; return if iterable is
// undefined/null (no Get of "add"); Get(set, "add") (observable: getters and a
// patched Set.prototype.add are used); IsCallable(adder) else TypeError;
// GetIterator(iterable); per value: Call(adder, set, value), result ignored.
// Abrupt completions inside the loop close the iterator (for-of semantics).
// Iterables with @@iterator (incl. Map/Set instances) reach the existing
// explicit __lanesUnsupported guard of the language for-of (status 6).
export const setConstructSource = `function setConstructBootstrap(iterable){
  "use strict";
  const set = __lanesCollectionCreate(2);
  if (iterable === undefined || iterable === null) return set;
  const adder = set.add;
  if (typeof adder !== "function") throw new TypeError("Set.prototype.add is not a function");
  for (const value of iterable) __lanesCall(adder, set, value);
  return set;
}`;

const brand = method => `if (__lanesCollectionBrand(this) !== 2) throw new TypeError("Method Set.prototype.${method} called on incompatible receiver");`;

export const setCoreSources = Object.freeze({
  setConstruct: setConstructSource,
  // Spec step 3 (-0 -> +0) is done here as well as in the intrinsic, so the
  // stored value is +0 regardless of the core's own normalization.
  setAdd: `function setAddBootstrap(value){
  "use strict";
  ${brand('add')}
  if (value === 0) value = 0;
  __lanesSetAdd(this, value);
  return this;
}`,
  setHas: `function setHasBootstrap(value){
  "use strict";
  ${brand('has')}
  return __lanesCollectionHas(this, value);
}`,
  setDelete: `function setDeleteBootstrap(value){
  "use strict";
  ${brand('delete')}
  return __lanesCollectionDelete(this, value);
}`,
});

export const setConstructEntry = Object.freeze({
  owner: 'Set', name: 'Set', id: SET_IDS.construct, ctorId: SET_IDS.ctor, length: 0,
  field: 'setConstruct', kind: 'construct', source: setConstructSource,
});

export const setCoreMethods = Object.freeze([
  Object.freeze({ owner: 'Set.prototype', name: 'add', id: SET_IDS.add, length: 1, field: 'setAdd', kind: 'method', source: setCoreSources.setAdd }),
  Object.freeze({ owner: 'Set.prototype', name: 'has', id: SET_IDS.has, length: 1, field: 'setHas', kind: 'method', source: setCoreSources.setHas }),
  Object.freeze({ owner: 'Set.prototype', name: 'delete', id: SET_IDS.delete, length: 1, field: 'setDelete', kind: 'method', source: setCoreSources.setDelete }),
]);

const used = ['__lanesCollectionCreate', '__lanesCollectionBrand', '__lanesCollectionHas', '__lanesSetAdd', '__lanesCollectionDelete'];
export const setCoreIntrinsics = Object.freeze({
  ...Object.fromEntries(used.map(name => [name, collectionIntrinsics[name]])),
  __lanesCall: 113, // existing privateBuiltins entry (bootstrap.js)
  __lanesIterationKind: 1273, // existing phase4-iteration.js builtin (1 array-like, 2 string, 4 nullish, 0 otherwise)
});

export const setCorePending = Object.freeze([
  'new Set(iterable) for iterables with a callable @@iterator (Map/Set instances, user iterables, generators) reaches the explicit __lanesUnsupported guard (status 6) until the generic iterator protocol (1270-1273 / 2400-2499) is merged.',
  'Temporary constructor pre-check (__lanesIterationKind(iterable)===0 -> Get(iterable,@@iterator), TypeError when nullish or non-callable) makes new Set(5) / new Set({}) / non-callable @@iterator catchable spec TypeErrors today. It MUST be removed once the generic protocol merges: GetIterator then performs the Get itself and the pre-check would add one extra observable Get of @@iterator.',
  'Subclass construction (class X extends Set, Reflect.construct with another NewTarget) keeps the status 6 boundary (parent construct dispatch).',
  'Set ctor/prototype metadata (Set.length 0, Set.name, Set.prototype descriptor, constructor link, @@toStringTag "Set", method name/length/descriptors) is installed by the parent registry; this module only supplies values.',
  'Cases tagged requires:[...] (setForEach, setSize, setToStringTag, mapConstruct) depend on other workers / the parent and must be gated until those land.',
]);
