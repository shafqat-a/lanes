// Guest sources for String.prototype indexOf, lastIndexOf, includes,
// startsWith, and endsWith. Each value is compiled as an intrinsic root
// (attachBootstrap); production must not evaluate these strings on the CPU.
// The helpers are strict so a primitive receiver stays a primitive string.
//
// Direct private intrinsics assigned in privateBuiltins:
//   __lanesUnsupported 141  Uncatchable unsupported runtime completion.
//   __lanesPrimitive 129  OrdinaryToPrimitive. true = string hint, false = number hint.
//   __lanesText      111  ToString of a primitive. Non-integer numbers redirect
//                         to the existing numberText bootstrap.
//   __lanesNumber    122  ToNumber of a primitive, including StringToNumber.
//   __lanesCharCodeAt 931 Code unit of a primitive string at an integer index
//                         (NaN out of range). See boxing-metadata.js.
// __lanesToText (134) is not used. It fuses those two steps, so a symbol or
// bigint returned by ToPrimitive becomes an unsupported intrinsic completion
// instead of the explicit rejection below.
//
// Indirect, because those three call them: __lanesCall 113, plus the existing
// numberSource / numberText requirements __lanesDescriptor 112,
// __lanesFromBits 123, and __lanesNumberWord 135.
//
// Code-unit reads use the primitive-string length and __lanesCharCodeAt.
// String.prototype.charCodeAt is a mutable guest-visible property, so the
// helpers never consult it. The helpers coerce first, then read the primitive
// result.
//
// Compiled length is 2 because position is a named parameter. Spec length is 1.

export const stringSearchMessages = Object.freeze({
  pattern: "RegExp and Symbol.match are unsupported",
  symbolString: "Cannot convert a Symbol value to a string",
  symbolNumber: "Cannot convert a Symbol value to a number",
  bigintString: "BigInt to string is unsupported",
  bigintNumber: "Cannot convert a BigInt value to a number",
});

export const stringSearchIntrinsics = Object.freeze({
  __lanesUnsupported: 141,
  __lanesPrimitive: 129,
  __lanesText: 111,
  __lanesNumber: 122,
  __lanesCharCodeAt: 931,
});

export const stringSearchIndirectIntrinsics = Object.freeze({
  __lanesCall: 113,
  __lanesDescriptor: 112,
  __lanesFromBits: 123,
  __lanesNumberWord: 135,
});

// Spec property descriptors the root should publish. The compiled functions
// currently report length 2.
export const stringSearchMethodLengths = Object.freeze({
  indexOf: 1,
  lastIndexOf: 1,
  includes: 1,
  startsWith: 1,
  endsWith: 1,
});

export const stringSearchGaps = Object.freeze([
  "includes, startsWith, and endsWith reject every object and function search value before ToString. IsRegExp needs Get(@@match) and the [[RegExpMatcher]] internal slot; neither exists here. Plain objects, boxed strings, objects with @@match false, and RegExp instances are all rejected with uncatchable unsupported runtime status, not a guest TypeError. They are not treated as supported non-patterns.",
  "indexOf and lastIndexOf do not consult @@match. Object search values go through OrdinaryToPrimitive with a string hint. A RegExp search is only as correct as that object's toString; RegExp.prototype.toString is not part of this module.",
  "Custom @@toPrimitive is not observed. Conversions use the existing OrdinaryToPrimitive helper.",
  "BigInt ToString exits with an unsupported runtime completion, not a guest exception. The spec would produce its decimal digits; __lanesText cannot format a bigint. ToNumber(bigint) also throws TypeError, which matches the spec.",
  "Symbol ToString and ToNumber throw TypeError, including when ToPrimitive itself yields a symbol. The runtime does not admit symbols today.",
  "Method IDs 800 through 804 route these names on primitive strings to guest sources. String.prototype exists as an object with these methods installed as writable, configurable, non-enumerable properties. The helpers read code units through the private __lanesCharCodeAt intrinsic, so reassigning String.prototype.charCodeAt does not affect them. Null and undefined fail in the helper; do not pre-box the receiver and do not require the receiver to already be a string.",
]);

const messages = stringSearchMessages;
const prologue = `
  function objectLike(value) {
    return value !== null && (typeof value === "object" || typeof value === "function");
  }
  function asText(value) {
    let primitive = value;
    if (objectLike(value)) primitive = __lanesPrimitive(value, true);
    if (typeof primitive === "symbol") throw new TypeError(${JSON.stringify(messages.symbolString)});
    
    return __lanesText(primitive);
  }
  function asNumber(value) {
    let primitive = value;
    if (objectLike(value)) primitive = __lanesPrimitive(value, false);
    if (typeof primitive === "symbol") throw new TypeError(${JSON.stringify(messages.symbolNumber)});
    if (typeof primitive === "bigint") throw new TypeError(${JSON.stringify(messages.bigintNumber)});
    return __lanesNumber(primitive);
  }
  function truncate(number) {
    if (number !== number || number === 0) return 0;
    if (number === Infinity || number === -Infinity) return number;
    const integer = number - number % 1;
    return integer === 0 ? 0 : integer;
  }
  function toIntegerOrInfinity(value) {
    return truncate(asNumber(value));
  }
  function clamp(pos, len) {
    if (pos <= 0) return 0;
    if (pos >= len) return len;
    return pos;
  }
  function sameUnits(text, start, search) {
    const count = search.length;
    if (start < 0 || start + count > text.length) return false;
    for (let i = 0; i < count; i++) {
      if (__lanesCharCodeAt(text, start + i) !== __lanesCharCodeAt(search, i)) return false;
    }
    return true;
  }`;

function source(name, operation) {
  return `function ${name}Bootstrap(searchString, position) {
  "use strict";${prologue}
  if (this === null || this === undefined) throw new TypeError(${JSON.stringify(`String.prototype.${name} called on null or undefined`)});
  const text = asText(this);
${operation}}`;
}

const rejectPattern = `  if (objectLike(searchString)) return __lanesUnsupported(${JSON.stringify(messages.pattern)});
`;

function forward(empty, found, missing) {
  return `  const len = text.length;
  const start = clamp(toIntegerOrInfinity(position), len);
  const count = search.length;
  if (count === 0) return ${empty};
  const last = len - count;
  for (let index = start; index <= last; index++) {
    if (sameUnits(text, index, search)) return ${found};
  }
  return ${missing};
`;
}

export const stringSearchSources = Object.freeze({
  indexOf: source("indexOf", `  const search = asText(searchString);
${forward("start", "index", "-1")}`),
  // ToNumber first. NaN, including a missing or undefined position, means +∞.
  // Other numbers then truncate toward zero. This is not ToIntegerOrInfinity
  // of the original argument: that would turn NaN into 0.
  lastIndexOf: source("lastIndexOf", `  const search = asText(searchString);
  const len = text.length;
  const number = asNumber(position);
  const start = clamp(number !== number ? Infinity : truncate(number), len);
  const count = search.length;
  if (count === 0) return start;
  let index = start;
  const limit = len - count;
  if (index > limit) index = limit;
  for (; index >= 0; index--) {
    if (sameUnits(text, index, search)) return index;
  }
  return -1;
`),
  includes: source("includes", `${rejectPattern}  const search = asText(searchString);
${forward("true", "true", "false")}`),
  startsWith: source("startsWith", `${rejectPattern}  const search = asText(searchString);
  const len = text.length;
  const start = clamp(toIntegerOrInfinity(position), len);
  const count = search.length;
  if (count === 0) return true;
  if (start + count > len) return false;
  return sameUnits(text, start, search);
`),
  // A missing or undefined end position selects the string length and does not
  // read valueOf. Any other value, including NaN, uses ToIntegerOrInfinity.
  endsWith: source("endsWith", `${rejectPattern}  const search = asText(searchString);
  const len = text.length;
  const pos = position === undefined ? len : toIntegerOrInfinity(position);
  const end = clamp(pos, len);
  const count = search.length;
  if (count === 0) return true;
  const start = end - count;
  if (start < 0) return false;
  return sameUnits(text, start, search);
`),
});
