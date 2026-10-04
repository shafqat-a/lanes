// @@iterator / @@hasInstance / @@unscopables / @@species / @@isConcatSpreadable.
// GetIterator always calls the method it finds. Phase 4 numeric kinds are not
// a mode this module returns. No iterator-result helper: the engine's step
// record is { kind, index, object } (phase4-iteration.js), not { value, done }.
// A guest-visible iterator result, when one exists, is an ordinary object
// with string keys "value" and "done".

import {
  ARRAY_VALUES_BUILTIN_ID,
  FIXED_NODE,
  PROTOCOL_BUILTINS,
  WELL_KNOWN_ID,
  symbolPropertyKey,
} from "./well-known.js";

export const ITERATOR_KEY = symbolPropertyKey(WELL_KNOWN_ID.iterator);

function isCallable(method) {
  if (typeof method === "function") return true;
  return !!method && method.callable === true && Number.isInteger(method.id) && method.id >= 1;
}

function methodIdOf(method) {
  if (Number.isInteger(method.id) && method.id >= 1) return method.id;
  if (typeof method === "function" && Number.isInteger(method.methodId) && method.methodId >= 1) return method.methodId;
  return 0;
}

// getMethod(obj, key) is Get. This applies the GetMethod callable check.
// Null and undefined are TypeError and do not call getMethod.
export function resolveIteratorMethod(obj, getMethod) {
  if (obj === null || obj === undefined || obj.tag === "null" || obj.tag === "undefined") {
    return { mode: "type-error", message: "Value is not iterable" };
  }
  if (typeof getMethod !== "function") throw new TypeError("getMethod must be callable");
  let method;
  try {
    method = getMethod(obj, ITERATOR_KEY);
  } catch (error) {
    if (error instanceof TypeError) return { mode: "type-error", message: error.message || "@@iterator is not a function" };
    throw error;
  }
  if (method === undefined || method === null) return { mode: "type-error", message: "Value is not iterable" };
  if (!isCallable(method)) return { mode: "type-error", message: "@@iterator is not a function" };
  const methodId = methodIdOf(method);
  if (methodId === 0) return { mode: "type-error", message: "@@iterator is not a function" };
  return { mode: "call-method", methodId };
}

// Fast path ONLY after GetMethod has already returned this id. Not a lookup.
// "array" matches phase-4 kind 1 (array exotic or arguments). "string" matches
// kind 2. Any other id, including an override on an array, returns null.
// Map and Set have no heap brand here; there is no fast path for them.
export function intrinsicIteratorFastPath(methodId, brand) {
  if (methodId === ARRAY_VALUES_BUILTIN_ID && (brand === "Array" || brand === "Arguments")) return "array";
  if (methodId === PROTOCOL_BUILTINS.stringIterator && brand === "String") return "string";
  return null;
}

// ES2025 Array.prototype[@@unscopables] names. Host Node and pinned QuickJS
// both omit "with". The `with` opcode is not in program.js OP. Array.prototype
// (node 2) is materialized, so the data property is still specified.
export const ARRAY_UNSCOPABLE_NAMES = Object.freeze([
  "at", "copyWithin", "entries", "fill", "find", "findIndex", "findLast",
  "findLastIndex", "flat", "flatMap", "includes", "keys", "toReversed",
  "toSorted", "toSpliced", "values",
]);

// Property tables for parent installation. Dispatch stays in core.
export const PROTOCOL_PROPERTIES = Object.freeze([
  Object.freeze({
    symbol: "iterator",
    holder: "Array.prototype",
    holderNode: 2,
    present: true,
    descriptor: Object.freeze({
      writable: true, enumerable: false, configurable: true, flags: 5,
      valueBuiltinId: ARRAY_VALUES_BUILTIN_ID,
      sameFunctionAs: "Array.prototype.values",
    }),
    dispatch: "parent-wiring",
    note: "Arrays exist (heap kind 7, node 2). @@iterator is the same function object as values (builtin 334). The values body is not a real iterator yet.",
  }),
  Object.freeze({
    symbol: "iterator",
    holder: "String.prototype",
    holderNode: 20,
    present: true,
    descriptor: Object.freeze({
      writable: true, enumerable: false, configurable: true, flags: 5,
      valueBuiltinId: PROTOCOL_BUILTINS.stringIterator,
    }),
    dispatch: "parent-wiring",
    note: "Strings and kind-16 string wrappers exist. Builtin 1103 is defined but not yet dispatched (no string-iterator object).",
  }),
  Object.freeze({
    symbol: "iterator",
    holder: "arguments exotic object",
    holderNode: null,
    present: true,
    descriptor: Object.freeze({
      writable: true, enumerable: false, configurable: true, flags: 5,
      valueBuiltinId: ARRAY_VALUES_BUILTIN_ID,
      own: true,
    }),
    dispatch: "parent-wiring",
    note: "kind 14 argumentsObject (shader.js) does not install own @@iterator yet. Spec own value is %Array.prototype.values%. An own override wins over kind 1.",
  }),
  Object.freeze({
    symbol: "unscopables",
    holder: "Array.prototype",
    holderNode: 2,
    present: true,
    descriptor: Object.freeze({
      writable: false, enumerable: false, configurable: true, flags: 4,
      value: Object.freeze({ prototype: null, properties: ARRAY_UNSCOPABLE_NAMES, propertyValue: true }),
    }),
    dispatch: "defined but not yet dispatched",
    note: "No with opcode. Install the data property because node 2 exists. with-statement lookup is parent wiring.",
  }),
  Object.freeze({
    symbol: "hasInstance",
    holder: "Function.prototype",
    holderNode: 3,
    present: true,
    descriptor: Object.freeze({
      writable: false, enumerable: false, configurable: false, flags: 0,
      valueBuiltinId: PROTOCOL_BUILTINS.functionHasInstance,
    }),
    dispatch: "defined but not yet dispatched",
    note: "Functions exist (tag 5, tag 11, node 3). instanceOf (shader.js) does not Get @@hasInstance. Builtin 1101 is OrdinaryHasInstance. Parent: GetMethod, call an override, and run the current instanceOf body only when the method id is 1101.",
  }),
  Object.freeze({
    symbol: "isConcatSpreadable",
    holder: null,
    holderNode: null,
    present: false,
    descriptor: null,
    dispatch: "defined but not yet dispatched",
    note: "No intrinsic installs this property. IsConcatSpreadable: non-object is false; missing symbol on an array is true; otherwise ToBoolean of the property. Array.prototype.concat is named but not implemented (array-phase5-metadata.js).",
  }),
  Object.freeze({
    symbol: "species",
    holder: "Array",
    holderNode: 18,
    present: true,
    descriptor: Object.freeze({
      getBuiltinId: PROTOCOL_BUILTINS.arraySpeciesGetter,
      set: undefined,
      enumerable: false,
      configurable: true,
      flags: 4,
      accessor: true,
    }),
    dispatch: "defined but not yet dispatched",
    note: "Getter returns this. array-phase5-source.js create() returns Unsupported when constructor is not Array or undefined, before reading @@species. RegExp, Promise, Map, Set and TypedArray constructors are absent.",
  }),
  Object.freeze({
    symbol: "toPrimitive",
    holder: "Symbol.prototype",
    holderNode: FIXED_NODE.symbolPrototype,
    present: true,
    descriptor: Object.freeze({
      writable: false, enumerable: false, configurable: true, flags: 4,
      valueBuiltinId: PROTOCOL_BUILTINS.symbolToPrimitive,
    }),
    dispatch: "parent-wiring",
    note: "Node 27 is the symbol worker's prototype. Install this descriptor there. Algorithm is symbolToPrimitive in to-primitive.js. Builtin 1100.",
  }),
  Object.freeze({
    symbol: "toStringTag",
    holder: "Symbol.prototype",
    holderNode: FIXED_NODE.symbolPrototype,
    present: true,
    descriptor: Object.freeze({
      writable: false, enumerable: false, configurable: true, flags: 4,
      value: "Symbol",
    }),
    dispatch: "parent-wiring",
    note: "Symbol wrappers have no builtin toString tag. The string comes from this data property. Node 27 is owned by the symbol worker.",
  }),
]);

// Rule the parent applies to iterationKind (1273) and iterator open (1270).
// Do not edit phase4-iteration.js.
export const ITERATION_KIND_RULE = Object.freeze({
  opcodes: Object.freeze({ kind: 1273, open: 1270, step: 1271, close: 1272 }),
  rule: "GetIterator always calls the @@iterator method GetMethod found. Kind 1 or 2 is allowed only as a fast path when that method id is the original intrinsic (334 for Array and arguments, 1103 for String) and the brand matches intrinsicIteratorFastPath. An own or inherited override is call-method with the override id, never kind 1 or 2. A missing or non-callable @@iterator is TypeError, not an empty iteration and not status-6 silence. Null and undefined stay TypeError (today's kind 4) because Get throws before a method call. Map and Set are not fast paths.",
});
