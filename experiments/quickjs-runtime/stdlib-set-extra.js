// Standard-library wave, worker 4: Set.prototype.size/clear/forEach and the
// ES2025 Set composition methods (24.2.4.2 clear, 24.2.4.5 difference,
// 24.2.4.7 forEach, 24.2.4.9 intersection, 24.2.4.10 isDisjointFrom,
// 24.2.4.11 isSubsetOf, 24.2.4.12 isSupersetOf, 24.2.4.14 get size,
// 24.2.4.15 symmetricDifference, 24.2.4.16 union; 24.2.1.2 GetSetRecord).
// Guest code only: strict helpers compiled by QuickJS as intrinsic roots and
// executed on the GPU. Storage, SameValueZero, -0 normalization, tombstones and
// GC pinning belong to the WGSL collection core (STDLIB-WAVE-CONTRACT.md).
//
// Helpers declare no nested functions (only functions[0] is an intrinsic root,
// so private intrinsics are visible only in the helper body); shared spec
// operations are textual fragments expanded into each helper.
//
// Iteration over `this` (forEach and the "this" branches of intersection,
// difference-free predicates) walks a kind-46 iterator object
// (__lanesCollectionIterator(set, 1)) kept in a local: GC marks it and it pins
// its current entry, so raw entry ids are never held. The core's entry chain
// with tombstones is exactly the spec's [[SetData]] List with ~empty~ slots, so
// "index < thisSize, re-read thisSize after each Call" equals "step the live
// iterator": appended entries are visited, deleted unvisited entries skipped,
// delete+re-add of a visited value revisits it at the end, clear+add continues.
//
// Result Sets are created with __lanesCollectionCreate(2) (%Set.prototype%,
// spec OrdinaryObjectCreateFromConstructor(%Set%)) and populated with the
// internal __lanesSetAdd / __lanesCollectionDelete, never the public methods.
// The result is not guest-reachable before it is returned, so building it
// incrementally is indistinguishable from building a List and wrapping it.
import { SET_IDS, collectionIntrinsics } from './stdlib-ids.js';

const brand = method => `if (__lanesCollectionBrand(this) !== 2) throw new TypeError("Method Set.prototype.${method} called on incompatible receiver");`;

// GetSetRecord(other), 24.2.1.2, in spec order:
// object check; Get size; ToNumber (ToPrimitive hint number, BigInt/Symbol ->
// TypeError); NaN -> TypeError; ToIntegerOrInfinity; < 0 -> RangeError;
// Get has; IsCallable; Get keys; IsCallable.
// ToIntegerOrInfinity: finite n -> n - (n % 1) (fmod is exact in binary64, so
// this is truncation toward zero); -0 -> +0; infinities unchanged.
const setRecord = method => `
  if (other === null || (typeof other !== "object" && typeof other !== "function")) throw new TypeError("Set.prototype.${method} argument is not an object");
  const rawSize = other.size;
  const sizePrimitive = __lanesPrimitive(rawSize, false);
  if (typeof sizePrimitive === "bigint" || typeof sizePrimitive === "symbol") throw new TypeError("Cannot convert set-like size to a number");
  const numSize = __lanesNumber(sizePrimitive);
  if (numSize !== numSize) throw new TypeError("Set-like size is NaN");
  let otherSize = numSize;
  if (otherSize !== Infinity && otherSize !== -Infinity) otherSize = otherSize - otherSize % 1;
  if (otherSize === 0) otherSize = 0;
  if (otherSize < 0) throw new RangeError("Set-like size is negative");
  const otherHas = other.has;
  if (typeof otherHas !== "function") throw new TypeError("Set-like has is not a function");
  const otherKeys = other.keys;
  if (typeof otherKeys !== "function") throw new TypeError("Set-like keys is not a function");`;

// GetIteratorFromMethod(otherRec.[[SetObject]], otherRec.[[Keys]]) (7.4.4):
// Call(keys, other); non-Object -> TypeError; Get(iterator, "next") once.
const openKeys = `
  const keysIter = __lanesCall(otherKeys, other);
  if (keysIter === null || (typeof keysIter !== "object" && typeof keysIter !== "function")) throw new TypeError("Set-like keys() result is not an object");
  const keysNext = keysIter.next;`;

// IteratorStepValue (7.4.10): Call(next, iterator) (non-callable next is the
// TypeError of Call); non-Object result -> TypeError; ToBoolean(Get done);
// done -> `onDone`; otherwise Get value into `next`.
const stepValue = onDone => `
    if (typeof keysNext !== "function") throw new TypeError("Set-like iterator next is not a function");
    const step = __lanesCall(keysNext, keysIter);
    if (step === null || (typeof step !== "object" && typeof step !== "function")) throw new TypeError("Iterator result is not an object");
    if (step.done) ${onDone}
    let next = step.value;`;

// CanonicalizeKeyedCollectionKey (24.5.1): -0 -> +0.
const canonical = `if (next === 0) next = 0;`;

// IteratorClose(keysIter, NormalCompletion) (7.4.11): GetMethod(iterator,
// "return") (undefined/null -> nothing, non-callable -> TypeError); Call;
// non-Object result -> TypeError.
const closeKeys = `
      const returnMethod = keysIter.return;
      if (returnMethod !== undefined && returnMethod !== null) {
        if (typeof returnMethod !== "function") throw new TypeError("Iterator return is not a function");
        const closed = __lanesCall(returnMethod, keysIter);
        if (closed === null || (typeof closed !== "object" && typeof closed !== "function")) throw new TypeError("Iterator return() result is not an object");
      }`;

// resultSetData = copy of O.[[SetData]] (empty slots carry no observable
// meaning in the result, so only live values are copied, in order).
const copyThis = `
  const result = __lanesCollectionCreate(2);
  const copy = __lanesCollectionIterator(this, 1);
  while (__lanesCollectionStep(copy)) __lanesSetAdd(result, __lanesCollectionIterValue(copy));`;

const header = (name, method) => `function ${name}Bootstrap(other){
  "use strict";
  ${brand(method)}${setRecord(method)}`;

export const setExtraSources = Object.freeze({
  // 24.2.4.14 get Set.prototype.size: RequireInternalSlot; live count.
  setSize: `function setSizeBootstrap(){
  "use strict";
  ${brand('size')}
  return __lanesCollectionSize(this);
}`,
  // 24.2.4.2 clear: every live entry becomes a tombstone (live iterators and
  // forEach continue with entries appended afterwards).
  setClear: `function setClearBootstrap(){
  "use strict";
  ${brand('clear')}
  __lanesCollectionClear(this);
  return undefined;
}`,
  // 24.2.4.7 forEach(callbackfn [, thisArg]): brand, IsCallable (before any
  // visit), then Call(callbackfn, thisArg, «e, e, S») per live entry.
  setForEach: `function setForEachBootstrap(callbackfn){
  "use strict";
  ${brand('forEach')}
  if (typeof callbackfn !== "function") throw new TypeError("Set.prototype.forEach callback is not a function");
  const thisArg = arguments.length > 1 ? arguments[1] : undefined;
  const set = this;
  const it = __lanesCollectionIterator(set, 1);
  while (__lanesCollectionStep(it)) {
    const value = __lanesCollectionIterValue(it);
    __lanesCall(callbackfn, thisArg, value, value, set);
  }
  return undefined;
}`,
  // 24.2.4.16 union: GetSetRecord; GetIteratorFromMethod; copy of this (after
  // keys()/next Get, so mutations made by keys() are included and mutations made
  // by next() are not); append canonicalized absent values.
  setUnion: `${header('setUnion', 'union')}${openKeys}${copyThis}
  for (;;) {${stepValue('break;')}
    ${canonical}
    __lanesSetAdd(result, next);
  }
  return result;
}`,
  // 24.2.4.9 intersection: SetDataSize(O) <= otherRec.[[Size]] -> Call has for
  // each live element of this (live iteration, already-in-result check);
  // otherwise iterate other's keys and keep canonicalized values present in
  // this (SetDataHas on the live O), skipping duplicates.
  setIntersection: `${header('setIntersection', 'intersection')}
  const result = __lanesCollectionCreate(2);
  if (__lanesCollectionSize(this) <= otherSize) {
    const it = __lanesCollectionIterator(this, 1);
    while (__lanesCollectionStep(it)) {
      const e = __lanesCollectionIterValue(it);
      if (__lanesCall(otherHas, other, e)) __lanesSetAdd(result, e);
    }
  } else {${openKeys}
    for (;;) {${stepValue('break;')}
      ${canonical}
      if (__lanesCollectionHas(this, next)) __lanesSetAdd(result, next);
    }
  }
  return result;
}`,
  // 24.2.4.5 difference: resultSetData = copy of O (after GetSetRecord).
  // thisSize <= otherSize: walk the copy (fixed; this's later mutations are
  // invisible) calling has, removing hits from the copy. Otherwise remove each
  // of other's keys from the copy.
  setDifference: `${header('setDifference', 'difference')}${copyThis}
  if (__lanesCollectionSize(this) <= otherSize) {
    const it = __lanesCollectionIterator(result, 1);
    while (__lanesCollectionStep(it)) {
      const e = __lanesCollectionIterValue(it);
      if (__lanesCall(otherHas, other, e)) __lanesCollectionDelete(result, e);
    }
  } else {${openKeys}
    for (;;) {${stepValue('break;')}
      ${canonical}
      __lanesCollectionDelete(result, next);
    }
  }
  return result;
}`,
  // 24.2.4.15 symmetricDifference: GetIteratorFromMethod, then copy of O; for
  // each canonicalized key: in (live) O -> remove from result if present;
  // otherwise append if absent.
  setSymmetricDifference: `${header('setSymmetricDifference', 'symmetricDifference')}${openKeys}${copyThis}
  for (;;) {${stepValue('break;')}
    ${canonical}
    const alreadyInResult = __lanesCollectionHas(result, next);
    if (__lanesCollectionHas(this, next)) {
      if (alreadyInResult) __lanesCollectionDelete(result, next);
    } else if (!alreadyInResult) __lanesSetAdd(result, next);
  }
  return result;
}`,
  // 24.2.4.11 isSubsetOf: SetDataSize(O) > size -> false (no has/keys calls);
  // otherwise live iteration of this calling has; first falsy -> false.
  setIsSubsetOf: `${header('setIsSubsetOf', 'isSubsetOf')}
  if (__lanesCollectionSize(this) > otherSize) return false;
  const it = __lanesCollectionIterator(this, 1);
  while (__lanesCollectionStep(it)) {
    if (!__lanesCall(otherHas, other, __lanesCollectionIterValue(it))) return false;
  }
  return true;
}`,
  // 24.2.4.12 isSupersetOf: SetDataSize(O) < size -> false; iterate other's
  // keys; a key absent from this -> IteratorClose(normal) and false.
  setIsSupersetOf: `${header('setIsSupersetOf', 'isSupersetOf')}
  if (__lanesCollectionSize(this) < otherSize) return false;${openKeys}
  for (;;) {${stepValue('return true;')}
    if (!__lanesCollectionHas(this, next)) {${closeKeys}
      return false;
    }
  }
}`,
  // 24.2.4.10 isDisjointFrom: SetDataSize(O) <= size -> live iteration of this
  // calling has (truthy -> false); otherwise iterate other's keys, a key in this
  // -> IteratorClose(normal) and false.
  setIsDisjointFrom: `${header('setIsDisjointFrom', 'isDisjointFrom')}
  if (__lanesCollectionSize(this) <= otherSize) {
    const it = __lanesCollectionIterator(this, 1);
    while (__lanesCollectionStep(it)) {
      if (__lanesCall(otherHas, other, __lanesCollectionIterValue(it))) return false;
    }
  } else {${openKeys}
    for (;;) {${stepValue('break;')}
      if (__lanesCollectionHas(this, next)) {${closeKeys}
        return false;
      }
    }
  }
  return true;
}`,
});

const method = (name, field, length) => Object.freeze({ owner: 'Set.prototype', name, id: SET_IDS[name], length, field, kind: 'method', source: setExtraSources[field] });

export const setExtraMethods = Object.freeze([
  // Accessor { get: <function "get size", length 0>, set: undefined,
  // enumerable: false, configurable: true } on Set.prototype.
  Object.freeze({ owner: 'Set.prototype', name: 'size', id: SET_IDS.size, length: 0, field: 'setSize', kind: 'getter', functionName: 'get size', source: setExtraSources.setSize }),
  method('clear', 'setClear', 0),
  method('forEach', 'setForEach', 1),
  method('union', 'setUnion', 1),
  method('intersection', 'setIntersection', 1),
  method('difference', 'setDifference', 1),
  method('symmetricDifference', 'setSymmetricDifference', 1),
  method('isSubsetOf', 'setIsSubsetOf', 1),
  method('isSupersetOf', 'setIsSupersetOf', 1),
  method('isDisjointFrom', 'setIsDisjointFrom', 1),
]);

const used = ['__lanesCollectionCreate', '__lanesCollectionBrand', '__lanesCollectionHas', '__lanesSetAdd',
  '__lanesCollectionDelete', '__lanesCollectionClear', '__lanesCollectionSize', '__lanesCollectionIterator',
  '__lanesCollectionStep', '__lanesCollectionIterValue'];
export const setExtraIntrinsics = Object.freeze({
  ...Object.fromEntries(used.map(name => [name, collectionIntrinsics[name]])),
  // Existing privateBuiltins entries (bootstrap.js).
  __lanesCall: 113, __lanesNumber: 122, __lanesPrimitive: 129,
});

export const setExtraPending = Object.freeze([
  'Composition methods with a Set argument read other.keys = Set.prototype.keys (alias of values, id 2228, collection-iterator worker) and %SetIteratorPrototype%.next (2241); until those land, Set-argument cases fail with "keys is not a function" (TypeError) instead of the spec result. Plain set-like objects need nothing else.',
  'Set.prototype.size accessor shape (get name "get size", set undefined, enumerable false, configurable true) and all name/length/descriptor metadata are installed by the parent registry from setExtraMethods.',
  'Helper function values are tag-11 builtins on the GPU; the host oracle uses ordinary functions, so `new Set.prototype.union()` / own "prototype" checks are not covered by cases.',
  'Subclass receivers (class X extends Set) keep the status 6 construct boundary; composition results are always plain %Set.prototype% Sets (spec: OrdinaryObjectCreateFromConstructor(%Set%)), no species lookup.',
]);
