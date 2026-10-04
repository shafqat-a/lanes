// Guest sources for String.prototype.concat, String.prototype.substring, and
// the optional Annex B legacy String.prototype.substr. Each value is compiled
// as an intrinsic root (attachBootstrap). Production must not evaluate these
// strings on the CPU, and this module does not route them.
//
// The helpers are strict so a primitive receiver stays a primitive string.
// RequireObjectCoercible(this) runs before ToString(this). Later arguments are
// not read when that check throws.
//
// Direct private intrinsics, same split as the string-search helpers:
//   __lanesUnsupported 141  Uncatchable unsupported runtime completion.
//   __lanesPrimitive 129  OrdinaryToPrimitive. true = string hint, false = number hint.
//   __lanesText      111  ToString of a primitive. Non-integer numbers redirect
//                         to the existing numberText bootstrap.
//   __lanesNumber    122  ToNumber of a primitive, including StringToNumber.
//                         concat does not use it. substring and substr do.
// __lanesToText (134) is not used. It fuses OrdinaryToPrimitive and ToString,
// so a symbol or bigint from ToPrimitive becomes one unsupported completion
// instead of the TypeError / unsupported split below.
//
// Indirect, because __lanesPrimitive and __lanesNumber call them: __lanesCall
// 113, plus __lanesDescriptor 112, __lanesFromBits 123, and __lanesNumberWord 135.
//
// Copied spans use the private __lanesSlice intrinsic (933) after both edges are already integers in 0..length. charAt (id 2) and
// charCodeAt (id 1) stay the unit intrinsics; these helpers do not call them
// and do not call concat, substring, or substr (that would recurse once the
// names are routed). concat appends with +, which is the existing string add.
//
// concat's single formal exists so the compiled length is 1. Every argument is
// read from the arguments object, left to right. Phase 4 patched untagged
// templates to immediate ToString plus string addition, independently of this
// public concat helper. Tagged templates now use cached frozen template objects from phase4-templates.js.
//
// Proposed routing ids continue after the string-search block 800..804.
// String.prototype integration is provided by the boxing module. The coordinator wires
// string property lookup, the name/length metadata, and the bootstrap field.

export const stringExtractMessages = Object.freeze({
  symbolString: "Cannot convert a Symbol value to a string",
  symbolNumber: "Cannot convert a Symbol value to a number",
  bigintString: "BigInt to string is unsupported",
  bigintNumber: "Cannot convert a BigInt value to a number",
  primitive: "Cannot convert object to primitive value",
});

export const stringExtractIntrinsics = Object.freeze({
  __lanesUnsupported: 141,
  __lanesPrimitive: 129,
  __lanesText: 111,
  __lanesNumber: 122,
  __lanesSlice: 933,
});

export const stringExtractIndirectIntrinsics = Object.freeze({
  __lanesCall: 113,
  __lanesDescriptor: 112,
  __lanesFromBits: 123,
  __lanesNumberWord: 135,
});

// Spec length. concat names one formal and reads the rest from arguments, so
// its compiled length matches. substring and substr name both formals.
export const stringExtractMethodLengths = Object.freeze({
  concat: 1,
  substring: 2,
  substr: 2,
});

export const stringExtractCompiledLengths = Object.freeze({
  concat: 1,
  substring: 2,
  substr: 2,
});

export const stringExtractMetadata = Object.freeze([
  ["concat", 805, 1, false],
  ["substring", 806, 2, false],
  ["substr", 807, 2, true],
].map(([name, id, expectedArity, legacy]) => Object.freeze({
  name,
  id,
  length: expectedArity,
  expectedArity,
  field: "string" + name[0].toUpperCase() + name.slice(1),
  legacy,
  annex: legacy ? "B" : null,
})));

export const stringExtractGaps = Object.freeze([
  "BigInt ToString exits with an uncatchable unsupported runtime completion, not a guest TypeError. The spec formats the decimal digits; __lanesText cannot. ToNumber(bigint) still throws TypeError, which matches the spec. The host shim throws Error named UnsupportedOperation so the message is visible; that shim is not a TypeError, and on the GPU the completion does not enter a guest catch.",
  "Symbol ToString and ToNumber throw TypeError, including when OrdinaryToPrimitive yields a symbol. The runtime does not admit symbols today.",
  "Custom @@toPrimitive is not observed. Conversions use OrdinaryToPrimitive through __lanesPrimitive.",
  "__lanesToText is not used. It would collapse the symbol TypeError and the bigint unsupported completion into one path.",
  "Null and undefined receivers throw TypeError inside the helper before any argument or index conversion. Do not pre-box. Primitive receivers stay primitive because the functions are strict. String.prototype methods are installed by the boxing integration; preserve the original receiver for strict guest helpers.",
  "Template substitutions are compiler-rejected: pinned QuickJS lowers them through mutable concat and delays substitution conversions. Explicit concat remains supported.",
  "Dispatch must enter the guest bootstrap with the full argument list and the original receiver. stringMethod only forwards two values and requires an already-primitive receiver, so it cannot implement concat or this coercion order.",
  "slice and string + share the existing makeText limit: a result longer than 256 code units is a runtime failure. The helpers do not clamp to that limit.",
  "A call frame admits at most 16 arguments (LIMITS.args). The concat loop itself is not capped; a template with more pieces than the frame still cannot be called.",
  "Object ToString is only as correct as that object's toString/valueOf plus __lanesText. RegExp.prototype.toString, Function.prototype.toString, and Array.prototype.toString are not part of this module.",
  "substr is optional Annex B legacy and has its own source, so concat and substring can be wired without it.",
]);

const messages = stringExtractMessages;

const textPrologue = `
  function objectLike(value) {
    return value !== null && (typeof value === "object" || typeof value === "function");
  }
  function asText(value) {
    let primitive = value;
    if (objectLike(value)) primitive = __lanesPrimitive(value, true);
    if (typeof primitive === "symbol") throw new TypeError(${JSON.stringify(messages.symbolString)});
    
    return __lanesText(primitive);
  }`;

const integerPrologue = `
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
  }`;

function source(name, params, prologue, operation) {
  return `function ${name}Bootstrap(${params}) {
  "use strict";${prologue}
  if (this === null || this === undefined) throw new TypeError(${JSON.stringify(`String.prototype.${name} called on null or undefined`)});
${operation}}`;
}

export const stringExtractSources = Object.freeze({
  // ToString(receiver), then ToString of each argument, appending left to right.
  concat: source("concat", "next", textPrologue, `  let result = asText(this);
  const count = arguments.length;
  for (let i = 0; i < count; i++) result += asText(arguments[i]);
  return result;
`),
  // ToIntegerOrInfinity(start) always. end is the length only when it is
  // undefined; otherwise ToIntegerOrInfinity(end). Clamp, then swap.
  substring: source("substring", "start, end", textPrologue + integerPrologue, `  const text = asText(this);
  const size = text.length;
  let from = clamp(toIntegerOrInfinity(start), size);
  let to = end === undefined ? size : clamp(toIntegerOrInfinity(end), size);
  if (from > to) {
    const swap = from;
    from = to;
    to = swap;
  }
  return __lanesSlice(text, from, to);
`),
  // Optional Annex B legacy. Negative start counts from the end and is then
  // clamped at 0. A positive start clamps at the length. An undefined length
  // means the remainder and is not converted. Any other length is
  // ToIntegerOrInfinity; a non-positive result is empty, otherwise it clamps
  // to the remainder.
  substr: source("substr", "start, length", textPrologue + integerPrologue, `  // Optional Annex B legacy. Separate source so it can be left unwired.
  const text = asText(this);
  const size = text.length;
  let intStart = toIntegerOrInfinity(start);
  if (intStart === -Infinity) intStart = 0;
  else if (intStart < 0) intStart = size + intStart > 0 ? size + intStart : 0;
  else if (intStart > size) intStart = size;
  if (length === undefined) return __lanesSlice(text, intStart, size);
  const intLength = toIntegerOrInfinity(length);
  if (!(intLength > 0)) return "";
  const remainder = size - intStart;
  const count = intLength < remainder ? intLength : remainder;
  return __lanesSlice(text, intStart, intStart + count);
`),
});

// What the coordinator wires later. This module does not edit shader,
// program, or bootstrap.
export const stringExtractIntegration = Object.freeze({
  sources: "stringExtractSources",
  metadata: "stringExtractMetadata",
  cases: "string-extract-cases.js",
  checker: "check-string-extract.mjs",
  methods: stringExtractMetadata.map(item => item.name),
  ids: Object.freeze(Object.fromEntries(stringExtractMetadata.map(item => [item.name, item.id]))),
  fields: Object.freeze(Object.fromEntries(stringExtractMetadata.map(item => [item.name, item.field]))),
  expectedArity: stringExtractMethodLengths,
  compiledLength: stringExtractCompiledLengths,
  directIntrinsics: stringExtractIntrinsics,
  numberIntrinsicOn: Object.freeze(["substring", "substr"]),
  indirectIntrinsics: stringExtractIndirectIntrinsics,
  unusedFusedToText: "__lanesToText",
  stringOps: Object.freeze(["slice"]),
  forbiddenSelfCalls: Object.freeze(["concat", "substring", "substr"]),
  templateLiteral: 'The patched compiler immediately converts each untagged template substitution with to_string, then adds string operands. Public concat mutation is not observed. Tagged templates now use cached frozen template objects from phase4-templates.js.',
  receiver: "RequireObjectCoercible before ToString. Strict function, so a primitive string receiver is not boxed.",
  wiring: Object.freeze([
    "Add each metadata field and name to program.js FIELDS, in that order, the way stringSearchMetadata is spread.",
    "Map bootstrapSources[field] to stringExtractSources[name].",
    "Install each method on String.prototype so primitive and boxed receivers share lookup.",
    "getProperty of the intrinsic id returns metadata.name and metadata.expectedArity.",
    "The call redirect loads the bootstrap closure from FIELDS[field] before stringMethod, same as ids 800 through 804.",
    "Do not handle these ids inside stringMethod. That path only receives two arguments and an already-primitive receiver.",
    "substr is annex B and may be left unwired without dropping concat or substring.",
  ]),
  resumption: Object.freeze({
    budget: 1,
    source: "stringExtractResumptionSource",
    expected: "stringExtractResumptionExpected",
    budgetExport: "stringExtractResumptionBudget",
  }),
  gpuChecks: false,
  cpuFallback: false,
});
