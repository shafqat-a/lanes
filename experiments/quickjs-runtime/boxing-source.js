// Guest sources for primitive-wrapper methods and constructors. Each value is
// compiled as an intrinsic root (attachBootstrap); production must not
// evaluate these strings on the CPU. Every helper is strict, so a primitive
// receiver stays a primitive and is never boxed on entry.
//
// ES2025 sections:
//   22.1.3.2  String.prototype.charAt(pos)
//   22.1.3.3  String.prototype.charCodeAt(pos)
//   22.1.3.23 String.prototype.slice(start, end)
//   21.1.3.6  Number.prototype.toString([radix])
//   22.1.1.1  String(value), [[Construct]] path only (new String)
//   21.1.1.1  Number(value), [[Construct]] path only (new Number)
//
// Each step order follows the spec: RequireObjectCoercible(this), ToString of
// the receiver, then ToIntegerOrInfinity of each argument left to right. For
// slice, an undefined end is not converted. For Number.prototype.toString,
// thisNumberValue runs before the radix is converted.
//
// Direct private intrinsics (ids in bootstrap.js privateBuiltins and
// boxing-metadata.js boxingIntrinsics) are listed per field in
// boxingSourceIntrinsics below. The code-unit reads go through
// __lanesCharCodeAt / __lanesCharAt / __lanesSlice, never through the
// guest-visible (and mutable) String.prototype methods.
//
// Known gaps:
//   - Symbol and BigInt are not admitted by the runtime. A symbol receiver or
//     argument throws TypeError (as the spec does for ToString/ToNumber); a
//     bigint receiver exits with an unsupported completion instead of being
//     formatted. new String(symbol) / new Number(bigint) go through the fused
//     __lanesToText / __lanesNumber intrinsics, which do not implement the
//     spec's SymbolDescriptiveString or BigInt-to-Number special cases.
//   - Custom @@toPrimitive is not observed. Object conversion uses
//     OrdinaryToPrimitive (__lanesPrimitive).
//   - Number.prototype.toString with a radix other than 10 (after the range
//     check) is an uncatchable unsupported completion.
//   - new String / new Number ignore NewTarget; subclassing is unsupported.

import { boxingIntrinsics } from './boxing-metadata.js';

export const boxingMessages = Object.freeze({
  symbolString: "Cannot convert a Symbol value to a string",
  symbolNumber: "Cannot convert a Symbol value to a number",
  bigintString: "BigInt to string is unsupported",
  bigintNumber: "Cannot convert a BigInt value to a number",
  radixRange: "toString() radix argument must be between 2 and 36",
  radixUnsupported: "Number.prototype.toString radix other than 10 is unsupported",
});

const messages = boxingMessages;
const q = JSON.stringify;

const objectLike = `
  function objectLike(value) {
    return value !== null && (typeof value === "object" || typeof value === "function");
  }`;
const asText = `
  function asText(value) {
    let primitive = value;
    if (objectLike(value)) primitive = __lanesPrimitive(value, true);
    if (typeof primitive === "symbol") throw new TypeError(${q(messages.symbolString)});
    
    return __lanesText(primitive);
  }`;
const asNumber = `
  function asNumber(value) {
    let primitive = value;
    if (objectLike(value)) primitive = __lanesPrimitive(value, false);
    if (typeof primitive === "symbol") throw new TypeError(${q(messages.symbolNumber)});
    if (typeof primitive === "bigint") throw new TypeError(${q(messages.bigintNumber)});
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
  }`;

const coercible = name => `
  if (this === null || this === undefined) throw new TypeError(${q(`String.prototype.${name} called on null or undefined`)});`;

export const boxingSources = Object.freeze({
  stringCharCodeAt: `function charCodeAtBootstrap(pos) {
  "use strict";${objectLike}${asText}${asNumber}${coercible('charCodeAt')}
  const text = asText(this);
  const position = toIntegerOrInfinity(pos);
  return __lanesCharCodeAt(text, position);
}`,
  stringCharAt: `function charAtBootstrap(pos) {
  "use strict";${objectLike}${asText}${asNumber}${coercible('charAt')}
  const text = asText(this);
  const position = toIntegerOrInfinity(pos);
  return __lanesCharAt(text, position);
}`,
  stringSlice: `function sliceBootstrap(start, end) {
  "use strict";${objectLike}${asText}${asNumber}${coercible('slice')}
  const text = asText(this);
  const from = toIntegerOrInfinity(start);
  const to = end === undefined ? undefined : toIntegerOrInfinity(end);
  return __lanesSlice(text, from, to);
}`,
  numberToString: `function numberToStringBootstrap(radix) {
  "use strict";${objectLike}${asNumber}
  const value = __lanesThisNumber(this);
  if (radix === undefined) return __lanesText(value);
  const base = toIntegerOrInfinity(radix);
  if (base < 2 || base > 36) throw new RangeError(${q(messages.radixRange)});
  if (base === 10) return __lanesText(value);
  return __lanesUnsupported(${q(messages.radixUnsupported)});
}`,
  stringConstruct: `function stringConstructBootstrap(value) {
  "use strict";
  const text = arguments.length === 0 ? "" : __lanesToText(value);
  return __lanesWrap(text);
}`,
  numberConstruct: `function numberConstructBootstrap(value) {
  "use strict";
  const number = arguments.length === 0 ? 0 : __lanesNumberConstructor(value);
  return __lanesWrap(number);
}`,
});

const conversion = ['__lanesPrimitive', '__lanesUnsupported', '__lanesText', '__lanesNumber'];
export const boxingSourceIntrinsics = Object.freeze({
  stringCharCodeAt: Object.freeze([...conversion, '__lanesCharCodeAt']),
  stringCharAt: Object.freeze([...conversion, '__lanesCharAt']),
  stringSlice: Object.freeze([...conversion, '__lanesSlice']),
  numberToString: Object.freeze(['__lanesPrimitive', '__lanesUnsupported', '__lanesText', '__lanesNumber', '__lanesThisNumber']),
  stringConstruct: Object.freeze(['__lanesToText', '__lanesWrap']),
  numberConstruct: Object.freeze(['__lanesNumberConstructor', '__lanesWrap']),
});

// Private builtin ids for every intrinsic named above.
export const boxingSourceIntrinsicIds = Object.freeze({
  __lanesUnsupported: 141,
  __lanesPrimitive: 129,
  __lanesText: 111,
  __lanesNumber: 122,
  __lanesToText: 134,
  __lanesThisNumber: boxingIntrinsics.__lanesThisNumber,
  __lanesCharCodeAt: boxingIntrinsics.__lanesCharCodeAt,
  __lanesCharAt: boxingIntrinsics.__lanesCharAt,
  __lanesSlice: boxingIntrinsics.__lanesSlice,
  __lanesWrap: boxingIntrinsics.__lanesWrap,
});

// Compiled function lengths equal the spec lengths for every field:
// charCodeAt 1, charAt 1, slice 2, Number.prototype.toString 1, String 1, Number 1.
export const boxingSourceLengths = Object.freeze({
  stringCharCodeAt: 1, stringCharAt: 1, stringSlice: 2, numberToString: 1, stringConstruct: 1, numberConstruct: 1,
});
