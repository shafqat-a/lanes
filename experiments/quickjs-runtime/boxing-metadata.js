import { stringCaseMetadata } from './string-case-metadata.js';
import { stringPhase5Metadata, stringPhase5Aliases } from './string-phase5-metadata.js';
// Primitive wrapper objects and the String/Number/Boolean prototype objects.
// Builtin identities 920-949 are reserved for this module; public
// Object.prototype identities stay at 151-162.
//
// Heap kind 16 is a primitive wrapper: value = (prototype, holder, 0,
// extensible). The holder is a kind-13 node whose value is the wrapped
// primitive. String wrappers expose virtual read-only, non-configurable index
// properties (enumerable) and length (non-enumerable).
export const WRAPPER_KIND = 16;
// Fixed intrinsic heap nodes, allocated after the Object constructor (19).
export const wrapperPrototypes = Object.freeze({ string: 20, number: 21, boolean: 22 });

export const boxingBuiltins = Object.freeze({
  stringToString: 920, stringValueOf: 921,
  numberToString: 922, numberValueOf: 923,
  booleanToString: 924, booleanValueOf: 925,
  // Internal [[Construct]] identities; they never escape as guest values.
  constructString: 928, constructNumber: 929, constructBoolean: 930,
});

// Private intrinsics visible only to compiled bootstrap roots.
export const boxingIntrinsics = Object.freeze({
  __lanesToObject: 926,     // ToObject: TypeError for null/undefined.
  __lanesThisNumber: 927,   // thisNumberValue: TypeError unless Number/Number wrapper.
  __lanesCharCodeAt: 931,   // (primitive string, number) -> code unit or NaN.
  __lanesCharAt: 932,       // (primitive string, number) -> "" or one unit.
  __lanesSlice: 933,        // (primitive string, number, number|undefined).
  __lanesWrap: 934,         // Primitive string/number/boolean -> new wrapper.
});

// Existing native string method identities 1-3 keep their fast path for
// primitive string receivers and primitive arguments. Other calls run guest
// helpers that perform the ES2025 conversions first.
export const stringPrototypeMethods = Object.freeze([
  { name: 'charCodeAt', id: 1, length: 1, field: 'stringCharCodeAt' },
  { name: 'charAt', id: 2, length: 1, field: 'stringCharAt' },
  { name: 'slice', id: 3, length: 2, field: 'stringSlice' },
  { name: 'toString', id: 920, length: 0 },
  { name: 'valueOf', id: 921, length: 0 },
].map(Object.freeze));
export const numberPrototypeMethods = Object.freeze([
  { name: 'toString', id: 922, length: 1, field: 'numberToString' },
  { name: 'valueOf', id: 923, length: 0 },
].map(Object.freeze));
export const booleanPrototypeMethods = Object.freeze([
  { name: 'toString', id: 924, length: 0 },
  { name: 'valueOf', id: 925, length: 0 },
].map(Object.freeze));

// ES2025 (including Annex B) prototype names that are not implemented. When a
// lookup reaches that prototype without finding a guest-defined own property,
// the result is an uncatchable unsupported completion, never undefined or an
// inherited Object.prototype value. Own-key enumeration of the three
// prototype objects is unsupported for the same reason.
const stringPrototypeReservedFields = Object.freeze([
  'at', 'codePointAt', 'isWellFormed', 'localeCompare', 'match', 'matchAll',
  'normalize', 'padEnd', 'padStart', 'repeat', 'replace', 'replaceAll', 'search', 'split',
  'toLocaleLowerCase', 'toLocaleUpperCase', 'toLowerCase', 'toUpperCase',
  'toWellFormed', 'trim', 'trimEnd', 'trimStart', 'anchor', 'big', 'blink', 'bold',
  'fixed', 'fontcolor', 'fontsize', 'italics', 'link', 'small', 'strike', 'sub', 'sup',
  'trimLeft', 'trimRight',
].filter(name=>![...stringPhase5Metadata,...stringPhase5Aliases].some(m=>m.name===name)));
// Preserve the historical image-field order while implemented methods leave
// the runtime gap list. Field IDs are append-only across implementation waves.
export const stringPrototypeUnsupported=Object.freeze(stringPrototypeReservedFields.filter(name=>!stringCaseMetadata.some(method=>method.name===name)));
export const numberPrototypeUnsupported = Object.freeze(['toExponential', 'toFixed', 'toLocaleString', 'toPrecision']);
// Field names appended to program.js FIELDS. Every name must be new there.
export const boxingFields = Object.freeze([
  'valueOf', 'charCodeAt', 'charAt', 'slice',
  'stringCharCodeAt', 'stringCharAt', 'stringSlice', 'numberToString', 'stringConstruct', 'numberConstruct',
  ...stringPrototypeReservedFields, ...numberPrototypeUnsupported, 'concat', 'substring', 'substr',
]);
