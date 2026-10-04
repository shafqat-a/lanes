// Builtin ids and fixed nodes for intrinsic Array and String iterators.
// Parent allocates nodes 77..79. Nodes 66..76 are reserved elsewhere. This module only names them.
// Kinds 53..55 and the unused ids in 2420..2439 and 2460..2479 stay free.

export const ITERATOR_PROTOTYPE = 77;
export const ARRAY_ITERATOR_PROTOTYPE = 78;
export const STRING_ITERATOR_PROTOTYPE = 79;
export const OBJECT_PROTOTYPE = 1;

export const fixedNodes = Object.freeze({
  iteratorPrototype: ITERATOR_PROTOTYPE,
  arrayIteratorPrototype: ARRAY_ITERATOR_PROTOTYPE,
  stringIteratorPrototype: STRING_ITERATOR_PROTOTYPE,
});

export const HEAP_KIND_ARRAY_ITERATOR = 51;
export const HEAP_KIND_STRING_ITERATOR = 52;
export const unusedHeapKinds = Object.freeze([53, 54, 55]);

// value.w on a kind-51 iterator. Keys do not Get the element.
export const ARRAY_ITERATOR_KIND = Object.freeze({ keys: 0, values: 1, entries: 2 });

// 2422 second argument. Brand is the only selector that accepts a bad receiver.
export const ARRAY_ITERATOR_SLOT = Object.freeze({ brand: 0, object: 1, index: 2, kind: 3 });

export const MAX_LENGTH = 9007199254740991;

// Existing arrayBuiltins identities. array-source.js: 300 + index.
// entries index 3, keys index 17, values index 34.
export const ARRAY_ENTRIES_ID = 303;
export const ARRAY_KEYS_ID = 317;
export const ARRAY_VALUES_ID = 334;
export const STRING_ITERATOR_ID = 1103;

export const ARRAY_ITERATOR_NEXT_ID = 2460;
export const STRING_ITERATOR_NEXT_ID = 2461;
export const ITERATOR_IDENTITY_ID = 2463;

export const CREATE_ARRAY_ITERATOR_ID = 2420;
export const CREATE_STRING_ITERATOR_ID = 2421;
export const ARRAY_ITERATOR_SLOT_ID = 2422;
export const ARRAY_ITERATOR_CLEAR_ID = 2423;
export const ARRAY_ITERATOR_SET_INDEX_ID = 2424;
export const STRING_ITERATOR_TAKE_ID = 2425;
export const STRING_ITERATOR_DONE_ID = 2426;
export const STRING_ITERATOR_BRAND_ID = 2427;

export const iteratorPrivateBuiltins = Object.freeze({
  __lanesCreateArrayIterator: CREATE_ARRAY_ITERATOR_ID,
  __lanesCreateStringIterator: CREATE_STRING_ITERATOR_ID,
  __lanesArrayIteratorSlot: ARRAY_ITERATOR_SLOT_ID,
  __lanesArrayIteratorClear: ARRAY_ITERATOR_CLEAR_ID,
  __lanesArrayIteratorSetIndex: ARRAY_ITERATOR_SET_INDEX_ID,
  __lanesStringIteratorTake: STRING_ITERATOR_TAKE_ID,
  __lanesStringIteratorDone: STRING_ITERATOR_DONE_ID,
  __lanesStringIteratorBrand: STRING_ITERATOR_BRAND_ID,
});

// 2463 is not a bootstrap body. objectMethod returns the receiver.
// A non-zero helper image for iteratorIdentity would skip that path.
export const iteratorBuiltinFields = Object.freeze({
  [STRING_ITERATOR_ID]: "stringIterator",
  [ARRAY_ITERATOR_NEXT_ID]: "arrayIteratorNext",
  [STRING_ITERATOR_NEXT_ID]: "stringIteratorNext",
  [ITERATOR_IDENTITY_ID]: "iteratorIdentity",
});

export const referencedBuiltins = Object.freeze({
  __lanesToObject: 926,
  __lanesNumber: 122,
  __lanesPrimitive: 129,
  __lanesText: 111,
  __lanesUnsupported: 141,
});

// Well-known iterator cell is node 34. @@toStringTag cell is node 42.
// flags: bit0 writable, bit1 enumerable, bit2 configurable.
export const prototypeProperties = Object.freeze([
  Object.freeze({ node: ITERATOR_PROTOTYPE, keyNode: 34, key: "@@iterator", builtinId: ITERATOR_IDENTITY_ID, flags: 5 }),
  Object.freeze({ node: ARRAY_ITERATOR_PROTOTYPE, keyNode: null, key: "next", builtinId: ARRAY_ITERATOR_NEXT_ID, flags: 5 }),
  Object.freeze({ node: STRING_ITERATOR_PROTOTYPE, keyNode: null, key: "next", builtinId: STRING_ITERATOR_NEXT_ID, flags: 5 }),
  Object.freeze({ node: ARRAY_ITERATOR_PROTOTYPE, keyNode: 42, key: "@@toStringTag", builtinId: null, flags: 4, dataString: "Array Iterator" }),
  Object.freeze({ node: STRING_ITERATOR_PROTOTYPE, keyNode: 42, key: "@@toStringTag", builtinId: null, flags: 4, dataString: "String Iterator" }),
]);
