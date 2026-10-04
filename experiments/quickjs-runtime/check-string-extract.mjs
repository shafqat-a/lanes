// Host algorithm/reference and compiler parity only. Not a CPU backend and not
// a GPU run. Native String.prototype methods are the oracle. The generated
// native and wasm compilers are read-only; this file does not rebuild them.
import assert from "node:assert/strict";
import { Script } from "node:vm";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { attachBootstrap, bootstrapSources, privateBuiltins } from "./bootstrap.js";
import { entrySource, packProgram, objectStaticPlaceholders } from "./program.js";
import { stringSearchMetadata } from "./string-search-metadata.js";
import { arrayMethods } from "./array-source.js";
import {
  stringExtractSources, stringExtractIntrinsics, stringExtractIndirectIntrinsics,
  stringExtractMethodLengths, stringExtractCompiledLengths, stringExtractMetadata,
  stringExtractMessages, stringExtractGaps, stringExtractIntegration,
} from "./string-extract-source.js";
import {
  stringExtractCases, stringExtractKnown, stringExtractResumptionSource,
  stringExtractResumptionExpected, stringExtractResumptionBudget,
  stringExtractNegativeSources, stringExtractHostGapSources, stringExtractTaggedTemplateSources, stringExtractCompilerGapCases, stringExtractUnsupportedCases,
} from "./string-extract-cases.js";

const names = ["concat", "substring", "substr"];
assert.deepEqual(Object.keys(stringExtractSources), names);
assert.deepEqual(Object.keys(stringExtractMethodLengths), names);
assert.deepEqual(Object.keys(stringExtractCompiledLengths), names);
assert.deepEqual(stringExtractMetadata.map(item => item.name), names);
assert.equal(stringExtractResumptionBudget, 1);
assert.equal(stringExtractIntegration.resumption.budget, 1);
assert.equal(stringExtractIntegration.gpuChecks, false);
assert.equal(stringExtractIntegration.cpuFallback, false);
assert.deepEqual(stringExtractIntegration.expectedArity, stringExtractMethodLengths);
assert.deepEqual(stringExtractIntegration.ids, Object.fromEntries(stringExtractMetadata.map(item => [item.name, item.id])));
assert.equal(stringExtractIntegration.unusedFusedToText, "__lanesToText");
assert.deepEqual(stringExtractIntegration.stringOps, ["slice"]);

const reservedIds = new Set([
  ...Object.values(privateBuiltins),
  ...stringSearchMetadata.map(item => item.id),
  ...Object.keys(arrayMethods).map(Number),
  ...objectStaticPlaceholders.map(item => item.id),
  1, 2, 3,
]);
for (const item of stringExtractMetadata) {
  assert.equal(reservedIds.has(item.id), false, item.name);
  assert.ok(item.id >= 805 && item.id <= 807, item.name);
  assert.equal(item.expectedArity, item.length, item.name);
  assert.equal(item.expectedArity, stringExtractMethodLengths[item.name], item.name);
  assert.equal(item.expectedArity, String.prototype[item.name].length, item.name);
  assert.equal(item.field, "string" + item.name[0].toUpperCase() + item.name.slice(1));
  assert.equal(item.legacy, item.name === "substr", item.name);
  assert.equal(item.annex, item.legacy ? "B" : null, item.name);
  assert.equal(String.prototype[item.name].name, item.name);
}
assert.deepEqual(stringExtractMetadata.map(item => item.id), [805, 806, 807]);
for (const [name, id] of Object.entries(stringExtractIntrinsics)) assert.equal(privateBuiltins[name], id);
for (const [name, id] of Object.entries(stringExtractIndirectIntrinsics)) assert.equal(privateBuiltins[name], id);
assert.equal(privateBuiltins.__lanesToText, 134);
assert.equal(stringExtractMessages.symbolString, "Cannot convert a Symbol value to a string");
assert.equal(stringExtractMessages.bigintNumber, "Cannot convert a BigInt value to a number");

for (const name of names) {
  const source = stringExtractSources[name];
  assert.equal(typeof source, "string", name);
  assert.equal(source.startsWith(`function ${name}Bootstrap(`), true, name);
  assert.equal(source.includes('"use strict";'), true, name);
  assert.equal(source.includes("__lanesToText"), false, name);
  assert.equal(source.includes("__lanesCall"), false, name);
  assert.equal(source.includes(".concat("), false, name);
  assert.equal(source.includes(".substring("), false, name);
  assert.equal(source.includes(".substr("), false, name);
  assert.equal(source.includes("charAt"), false, name);
  assert.equal(source.includes("charCodeAt"), false, name);
  assert.equal(source.includes("codePointAt"), false, name);
  const nullAt = source.indexOf("this === null");
  const receiverAt = source.indexOf("asText(this)");
  assert.ok(nullAt > 0 && nullAt < receiverAt, name);
  if (name === "concat") {
    assert.equal(source.includes("__lanesNumber"), false, name);
    assert.equal(source.includes("arguments.length"), true, name);
    assert.equal(source.includes(".slice("), false, name);
    const countAt = source.indexOf("arguments.length");
    const argAt = source.indexOf("asText(arguments[i])");
    assert.ok(receiverAt < countAt && countAt < argAt, name);
  } else {
    assert.equal(source.includes("__lanesNumber"), true, name);
    assert.equal(source.includes("arguments"), false, name);
    assert.equal(source.includes("__lanesSlice("), true, name);
  }
  if (name === "substring") {
    const startAt = source.indexOf("toIntegerOrInfinity(start)");
    const undefinedAt = source.indexOf("end === undefined");
    const endAt = source.indexOf("toIntegerOrInfinity(end)");
    const sliceAt = source.indexOf("__lanesSlice");
    assert.ok(receiverAt < startAt && startAt < undefinedAt && undefinedAt < endAt && endAt < sliceAt, name);
    assert.equal(source.includes("from > to"), true, name);
  }
  if (name === "substr") {
    assert.equal(source.includes("Optional Annex B legacy"), true, name);
    const startAt = source.indexOf("toIntegerOrInfinity(start)");
    const undefinedAt = source.indexOf("length === undefined");
    const firstSlice = source.indexOf("__lanesSlice");
    const lengthAt = source.indexOf("toIntegerOrInfinity(length)");
    const emptyAt = source.indexOf("!(intLength > 0)");
    const secondSlice = source.indexOf("__lanesSlice", firstSlice + 1);
    assert.ok(receiverAt < startAt && startAt < undefinedAt, name);
    assert.ok(undefinedAt < firstSlice && firstSlice < lengthAt, name);
    assert.ok(lengthAt < emptyAt && emptyAt < secondSlice, name);
    assert.equal(source.includes("intStart === -Infinity"), true, name);
  }
}

function objectLike(value) {
  return value !== null && (typeof value === "object" || typeof value === "function");
}
function lanesPrimitive(value, stringHint) {
  if (!objectLike(value)) return value;
  let method = stringHint ? value.toString : value.valueOf;
  if (typeof method === "function") {
    const result = method.call(value);
    if (!objectLike(result)) return result;
  }
  method = stringHint ? value.valueOf : value.toString;
  if (typeof method === "function") {
    const result = method.call(value);
    if (!objectLike(result)) return result;
  }
  throw new TypeError(stringExtractMessages.primitive);
}
function lanesText(value) {
  if (typeof value === "symbol" || typeof value === "bigint") throw new TypeError("Unsupported primitive text");
  if (objectLike(value)) throw new TypeError("Unsupported object text");
  return String(value);
}
function lanesNumber(value) {
  if (typeof value === "symbol" || typeof value === "bigint") throw new TypeError("Unsupported primitive number");
  if (objectLike(value)) throw new TypeError("Unsupported object number");
  return Number(value);
}
function lanesUnsupported(message) {
  const error = new Error(message);
  error.name = "UnsupportedOperation";
  throw error;
}

const originals = Object.fromEntries(names.map(name => [name, String.prototype[name]]));
const factories = Object.fromEntries(names.map(name => [name, new Function(
  "__lanesPrimitive", "__lanesText", "__lanesNumber", "__lanesUnsupported", "__lanesSlice",
  `return (${stringExtractSources[name]});`,
)(lanesPrimitive, lanesText, lanesNumber, lanesUnsupported, Function.prototype.call.bind(String.prototype.slice))]));
for (const name of names) {
  assert.equal(factories[name].length, stringExtractCompiledLengths[name], name);
  assert.equal(factories[name].name, `${name}Bootstrap`, name);
}

function outcome(run) {
  try {
    return { threw: false, value: run() };
  } catch (error) {
    return {
      threw: true,
      name: error !== null && typeof error === "object" ? error.name : undefined,
      message: error !== null && typeof error === "object" ? error.message : undefined,
      value: error,
    };
  }
}
let checks = 0;
function same(name, receiver, args, label) {
  const expected = outcome(() => originals[name].apply(receiver, args));
  const actual = outcome(() => factories[name].apply(receiver, args));
  const where = label || name;
  assert.equal(actual.threw, expected.threw, where);
  if (expected.threw) {
    assert.equal(actual.name, expected.name, where);
    if (expected.name === "TypeError") assert.equal(actual.message, expected.message, where);
    else if (!(expected.value instanceof Error)) assert.equal(actual.value, expected.value, where);
  } else {
    assert.equal(actual.value, expected.value, where);
  }
  checks++;
}

for (const [name, receiver, args, want] of stringExtractKnown) {
  assert.equal(originals[name].apply(receiver, args), want, `${name} native pin`);
  assert.equal(factories[name].apply(receiver, args), want, `${name} guest pin`);
  checks += 2;
}
const pair = factories.substring.call("a\uD83D\uDE00b", 1, 3);
assert.equal(pair.length, 2);
assert.equal(pair.charCodeAt(0), 0xD83D);
assert.equal(pair.charCodeAt(1), 0xDE00);
assert.equal(factories.substring.call("a\uD83D\uDE00b", 1, 2).charCodeAt(0), 0xD83D);
assert.equal(factories.substr.call("a\uD83D\uDE00b", 2, 1).charCodeAt(0), 0xDE00);
assert.equal(factories.concat.call("\u0000", "\uFFFF").charCodeAt(1), 0xFFFF);
assert.equal(factories.substring.call("e\u0301", 0, 1), "e");
assert.equal(factories.substr.call("e\u0301", 1, 1).charCodeAt(0), 0x0301);
checks += 7;

const texts = ["", "a", "abcd", "abcbc", "aaaa", "a\uD83D\uDE00b", "\uD83D\uDE00", "\uDE00\uD83D", "\u0000", "\uFFFF", "\u00e9", "e\u0301", "NaN", "Infinity", "-Infinity", "1.25"];
const positions = [undefined, null, NaN, Infinity, -Infinity, 0, -0, 1, -1, 1.9, 2.2, -1.2, -1.9, 3.2, -2.2, 100, -100, "", "2", " 2 ", "0x2", "0b11", "1e0", "foo", true, false];
const pieces = ["", "a", "bc", "\uD83D", "\uDE00", "\u0000", "\uFFFF", 0, -0, 1, -1, 1.25, NaN, Infinity, -Infinity, true, false, null, undefined];
for (const text of texts) {
  for (const piece of pieces) {
    same("concat", text, [piece]);
    same("concat", text, [piece, "z", 2]);
  }
  same("concat", text, []);
  for (const start of positions) {
    for (const end of positions) {
      same("substring", text, [start, end]);
      same("substr", text, [start, end]);
    }
    same("substring", text, [start]);
    same("substr", text, [start]);
  }
}
for (const name of names) {
  for (const receiver of [0, -0, 1.25, 10, NaN, Infinity, -Infinity, true, false]) {
    same(name, receiver, name === "concat" ? [receiver] : [0, 2]);
  }
  same(name, null, ["a"]);
  same(name, undefined, ["a", 1]);
  const error = outcome(() => factories[name].call(null));
  assert.equal(error.threw && error.name, "TypeError", name);
  assert.equal(error.message, `String.prototype.${name} called on null or undefined`, name);
  checks++;
}

const long = "ab".repeat(150);
assert.equal(long.length, 300);
assert.equal(factories.substring.call(long, 298, 1), originals.substring.call(long, 298, 1));
assert.equal(factories.substr.call(long, -3, 2), originals.substr.call(long, -3, 2));
assert.equal(factories.concat.call(long, "Z").length, 301);
const many = Array.from({ length: 20 }, (_, index) => String(index));
assert.equal(factories.concat.call("s", ...many), "s" + many.join(""));
assert.equal(originals.concat.call("s", ...many), factories.concat.call("s", ...many));
checks += 5;

let order = "";
const reset = () => { order = ""; };
const receiver = { toString() { order += "t"; return "abca"; }, valueOf() { order += "T"; return "xxxx"; } };
const piece = { toString() { order += "s"; return "YZ"; }, valueOf() { order += "S"; return 0; } };
reset();
assert.equal(factories.concat.call(receiver, piece, "-", 17), "abcaYZ-17");
assert.equal(order, "ts");
checks++;
reset();
assert.equal(factories.substring.call(receiver, { valueOf() { order += "a"; return 1.9; }, toString() { order += "A"; return "0"; } }, { valueOf() { order += "b"; return 3.2; }, toString() { order += "B"; return "9"; } }), "bc");
assert.equal(order, "tab");
checks++;
reset();
assert.equal(factories.substr.call(receiver, { valueOf() { order += "n"; return -2.2; }, toString() { order += "N"; return "0"; } }, { valueOf() { order += "c"; return 1.8; }, toString() { order += "C"; return "9"; } }), "c");
assert.equal(order, "tnc");
checks++;
let poison = 0;
assert.equal(factories.substring.call("abcd", 1, undefined), "bcd");
assert.equal(factories.substring.call("abcd", { valueOf() { poison++; return 1; }, toString() { poison += 10; return "0"; } }, undefined), "bcd");
assert.equal(poison, 1);
assert.equal(factories.substr.call("abcd", 1, undefined), "bcd");
assert.equal(factories.substr.call("abcd", 1), "bcd");
poison = 0;
assert.equal(factories.substr.call("abcd", -2, { valueOf() { poison++; return 1.8; }, toString() { poison += 10; return "9"; } }), "c");
assert.equal(poison, 1);
checks += 6;

const box = { value: "abcd", toString() { return this.value; }, valueOf() { return "WRONG"; } };
const moved = { valueOf() { box.value = "ZZZZ"; return 1; }, toString() { return "0"; } };
assert.equal(factories.substring.call(box, moved, 3), "bc");
assert.equal(box.value, "ZZZZ");
const again = { value: "abcd", toString() { return this.value; } };
assert.equal(factories.concat.call(again, { toString() { again.value = "NO"; return "Z"; } }), "abcdZ");
checks += 2;

reset();
const viaGetter = {
  get toString() { order += "g"; return function () { order += "c"; return "XY"; }; },
  get valueOf() { order += "v"; return function () { order += "d"; return "NO"; }; },
};
assert.equal(factories.concat.call(viaGetter, "z"), "XYz");
assert.equal(order, "gc");
reset();
const startGetter = {
  get valueOf() { order += "a"; return function () { order += "b"; return 1.2; }; },
  get toString() { order += "A"; return function () { order += "B"; return "0"; }; },
};
assert.equal(factories.substring.call("abcd", startGetter, 3), "bc");
assert.equal(order, "ab");
checks += 2;

const token = { boom: true };
reset();
let caught = outcome(() => factories.concat.call(null, { toString() { order += "z"; return "no"; } }));
assert.equal(caught.name, "TypeError");
assert.equal(order, "");
caught = outcome(() => factories.substring.call({ toString() { order += "e"; throw token; }, valueOf() { order += "E"; return "ab"; } }, { valueOf() { order += "p"; return 0; } }));
assert.equal(caught.value, token);
assert.equal(order, "e");
caught = outcome(() => factories.substr.call("abca", { valueOf() { order += "q"; return 1; } }, { valueOf() { order += "r"; throw token; }, toString() { order += "R"; return "1"; } }));
assert.equal(caught.value, token);
assert.equal(order, "eqr");
caught = outcome(() => factories.concat.call({ get toString() { order += "G"; throw token; }, valueOf() { order += "V"; return "no"; } }, { toString() { order += "h"; return "no"; } }));
assert.equal(caught.value, token);
assert.equal(order, "eqrG");
checks += 4;

let reads = 0;
caught = outcome(() => factories.concat.call("a", Symbol("s"), { toString() { reads++; return "b"; } }));
assert.equal(caught.message, stringExtractMessages.symbolString);
assert.equal(reads, 0);
reads = 0;
caught = outcome(() => factories.substring.call("abc", Symbol("s"), { valueOf() { reads++; return 1; } }));
assert.equal(caught.message, stringExtractMessages.symbolNumber);
assert.equal(reads, 0);
reads = 0;
caught = outcome(() => factories.concat.call(10n, { toString() { reads++; return "z"; } }));
assert.equal(caught.name, "UnsupportedOperation");
assert.equal(caught.message, stringExtractMessages.bigintString);
assert.equal(caught.value instanceof TypeError, false);
assert.equal(reads, 0);
assert.equal(originals.concat.call(10n, "a"), "10a");
assert.equal(originals.concat.call("a", 10n), "a10");
caught = outcome(() => factories.substring.call("abc", 1n, { valueOf() { reads++; return 1; } }));
assert.equal(caught.message, stringExtractMessages.bigintNumber);
assert.equal(outcome(() => originals.substring.call("abc", 1n, 2)).message, stringExtractMessages.bigintNumber);
assert.equal(reads, 0);
caught = outcome(() => factories.concat.call({ toString() { return 2n; }, valueOf() { return "no"; } }, "x"));
assert.equal(caught.message, stringExtractMessages.bigintString);
assert.equal(originals.concat.call({ toString() { return 2n; }, valueOf() { return "no"; } }, "x"), "2x");
checks += 8;

let seen = "";
const primitiveHook = {
  [Symbol.toPrimitive](hint) { seen += "p" + hint; return "no"; },
  toString() { seen += "t"; return "abc"; },
  valueOf() { seen += "v"; return 1; },
};
assert.equal(factories.concat.call(primitiveHook), "abc");
assert.equal(seen, "t");
seen = "";
assert.equal(originals.concat.call(primitiveHook), "no");
assert.equal(seen, "pstring");
seen = "";
const numberHook = {
  [Symbol.toPrimitive](hint) { seen += hint; return 1; },
  valueOf() { seen += "v"; return 9; },
  toString() { seen += "t"; return "0"; },
};
assert.equal(factories.substring.call("abcd", numberHook, 3), "d");
assert.equal(seen, "v");
seen = "";
assert.equal(originals.substring.call("abcd", numberHook, 3), "bc");
assert.equal(seen, "number");
checks += 4;

const savedToString = String.prototype.toString;
try {
  let calls = 0;
  String.prototype.toString = function () { calls++; return savedToString.call(this); };
  assert.equal(factories.concat.call("ab", "c"), "abc");
  assert.equal(factories.substring.call("abcd", 3, 1), "bc");
  assert.equal(factories.substr.call("abcd", -2, 1), "c");
  assert.equal(calls, 0);
  checks += 3;
} finally {
  String.prototype.toString = savedToString;
}

const fuzzSeed = 0xC0FFEE17;
let seed = fuzzSeed;
const rand = () => seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
const alphabet = ["a", "b", "c", "\uD83D", "\uDE00", "\u0000", "\u0301", "\u00e9", "\uFFFF"];
const randString = () => {
  let text = "";
  const size = rand() % 8;
  for (let i = 0; i < size; i++) text += alphabet[rand() % alphabet.length];
  return text;
};
const randPosition = () => {
  const mode = rand() % 8;
  if (mode === 0) return undefined;
  if (mode === 1) return null;
  if (mode === 2) return NaN;
  if (mode === 3) return Infinity;
  if (mode === 4) return -Infinity;
  if (mode === 5) return (rand() % 24) - 8 + (rand() % 10) / 10;
  if (mode === 6) {
    const chosen = (rand() % 15) - 5;
    return { valueOf() { return chosen; }, toString() { return "999"; } };
  }
  return String((rand() % 12) - 4);
};
for (let i = 0; i < 200; i++) {
  const text = randString();
  const head = randString();
  const tail = rand() % 5 === 0 ? null : randString();
  const textValue = i % 3 === 0 ? { toString() { return text; }, valueOf() { return "WRONG-VALUE"; } } : text;
  const first = i % 4 === 0 ? { toString() { return head; }, valueOf() { return "NO"; } } : head;
  same("concat", textValue, [first, tail, i], `fuzz ${i} concat`);
  same("substring", textValue, [randPosition(), i % 5 === 0 ? undefined : randPosition()], `fuzz ${i} substring`);
  same("substr", textValue, [randPosition(), i % 5 === 0 ? undefined : randPosition()], `fuzz ${i} substr`);
}

const intrinsicSource = `const __lanesSlice=Function.prototype.call.bind(String.prototype.slice);
function __lanesUnsupported(message) { const error = new Error(message); error.name = "UnsupportedOperation"; throw error; }
function __lanesPrimitive(value, stringHint) {
  function objectLike(v) { return v !== null && (typeof v === "object" || typeof v === "function"); }
  if (!objectLike(value)) return value;
  let method = stringHint ? value.toString : value.valueOf;
  if (typeof method === "function") {
    const result = method.call(value);
    if (!objectLike(result)) return result;
  }
  method = stringHint ? value.valueOf : value.toString;
  if (typeof method === "function") {
    const result = method.call(value);
    if (!objectLike(result)) return result;
  }
  throw new TypeError(${JSON.stringify(stringExtractMessages.primitive)});
}
function __lanesText(value) {
  if (typeof value === "symbol" || typeof value === "bigint") throw new TypeError("Unsupported primitive text");
  if (value !== null && (typeof value === "object" || typeof value === "function")) throw new TypeError("Unsupported object text");
  return String(value);
}
function __lanesNumber(value) {
  if (typeof value === "symbol" || typeof value === "bigint") throw new TypeError("Unsupported primitive number");
  if (value !== null && (typeof value === "object" || typeof value === "function")) throw new TypeError("Unsupported object number");
  return Number(value);
}
${names.map(name => `String.prototype[${JSON.stringify(name)}] = (${stringExtractSources[name]});`).join("\n")}
`;
function call(source, input, prelude) {
  try {
    return { threw: false, value: new Script(`${prelude || ""}(${source})(${input})`).runInNewContext({}, { timeout: 1000 }) };
  } catch (error) {
    const named = error !== null && typeof error === "object" && typeof error.name === "string";
    return {
      threw: true,
      value: named ? error.name : error,
      message: named ? error.message : undefined,
    };
  }
}
assert.equal(new Script(intrinsicSource + 'String.prototype.concat.name + String.prototype.substring.length + String.prototype.substr.length').runInNewContext({}), "concatBootstrap22");
assert.equal(new Script("String.prototype.concat.name").runInNewContext({}), "concat");
checks += 2;

const programs = [...stringExtractCases, stringExtractResumptionSource];
const inputs = [0, 1, -1, 17];
for (const source of programs) {
  for (const input of inputs) {
    const expected = call(source, input);
    const actual = call(source, input, intrinsicSource);
    assert.equal(expected.threw, false, source);
    assert.equal(actual.threw, false, source);
    const kind = actual.value === null ? "null" : typeof actual.value;
    assert.ok(kind === "number" || kind === "string" || kind === "boolean", source);
    assert.equal(actual.value, expected.value, source);
    checks++;
  }
}
assert.equal(call(stringExtractResumptionSource, 17).value, stringExtractResumptionExpected);
assert.equal(call(stringExtractResumptionSource, 17, intrinsicSource).value, stringExtractResumptionExpected);
checks += 2;
for (const source of stringExtractNegativeSources) {
  for (const input of inputs) {
    const expected = call(source, input);
    const actual = call(source, input, intrinsicSource);
    assert.equal(expected.threw, true, source);
    assert.equal(actual.threw, true, source);
    assert.equal(actual.value, expected.value, source);
    checks++;
  }
}
for (const { kind, source } of stringExtractHostGapSources) {
  const expected = call(source, 17);
  const actual = call(source, 17, intrinsicSource);
  if (kind === "bigint-string") {
    assert.equal(expected.threw, false, source);
    assert.equal(typeof expected.value, "string", source);
    assert.equal(actual.threw, true, source);
    assert.equal(actual.value, "UnsupportedOperation", source);
    assert.equal(actual.message, stringExtractMessages.bigintString, source);
  } else if (kind === "bigint-number") {
    assert.equal(expected.value, "TypeError", source);
    assert.equal(actual.value, "TypeError", source);
    assert.equal(expected.message, stringExtractMessages.bigintNumber, source);
    assert.equal(actual.message, stringExtractMessages.bigintNumber, source);
  } else if (kind === "symbol-string") {
    assert.equal(expected.value, "TypeError", source);
    assert.equal(actual.value, "TypeError", source);
    assert.equal(expected.message, stringExtractMessages.symbolString, source);
    assert.equal(actual.message, stringExtractMessages.symbolString, source);
  } else if (kind === "symbol-number") {
    assert.equal(expected.value, "TypeError", source);
    assert.equal(actual.value, "TypeError", source);
    assert.equal(expected.message, stringExtractMessages.symbolNumber, source);
    assert.equal(actual.message, stringExtractMessages.symbolNumber, source);
  } else {
    assert.fail(kind);
  }
  checks++;
}

const { default: createWasm } = await import("./generated/compiler.mjs");
const wasm = await createWasm();
const wasmRaw = source => JSON.parse(wasm.ccall("lanes_compile", "string", ["string"], [source]));
const nativePath = fileURLToPath(new URL("./generated/compiler", import.meta.url));
const nativeRaw = source => JSON.parse(execFileSync(nativePath, [source], { encoding: "utf8", maxBuffer: 1 << 26 }));
const wasmBoot = Object.fromEntries(Object.entries(bootstrapSources).map(([key, source]) => [key, wasmRaw(source)]));
const nativeBoot = Object.fromEntries(Object.entries(bootstrapSources).map(([key, source]) => [key, nativeRaw(source)]));
for (const source of [...programs, ...stringExtractNegativeSources, ...stringExtractUnsupportedCases.map(item=>item.source)]) {
  const native = packProgram(attachBootstrap(nativeRaw(source), nativeBoot), entrySource(source));
  const compiled = packProgram(attachBootstrap(wasmRaw(source), wasmBoot), entrySource(source));
  assert.deepEqual(compiled.code, native.code, source);
  assert.deepEqual(compiled.image, native.image, source);
}
const allowed = {
  concat: new Set([...Object.keys(stringExtractIntrinsics), "TypeError", "undefined"]),
  substring: new Set([...Object.keys(stringExtractIntrinsics), "TypeError", "Infinity", "-Infinity", "undefined"]),
  substr: new Set([...Object.keys(stringExtractIntrinsics), "TypeError", "Infinity", "-Infinity", "undefined"]),
};
for (const [name, source] of Object.entries(stringExtractSources)) {
  const nativeHelper = nativeRaw(source);
  const wasmHelper = wasmRaw(source);
  assert.equal(nativeHelper.error, undefined, name);
  assert.equal(wasmHelper.error, undefined, name);
  assert.equal(wasmHelper.functions[0].name, `${name}Bootstrap`);
  assert.equal(wasmHelper.functions[0].length, stringExtractCompiledLengths[name], name);
  assert.equal(nativeHelper.functions[0].length, stringExtractCompiledLengths[name], name);
  const rootRefs = new Set();
  const allRefs = new Set();
  for (const fn of wasmHelper.functions) {
    assert.equal(fn.strict, 1, fn.name);
    assert.equal(fn.kind, 0, fn.name);
    for (const ref of fn.refs) {
      if (ref.type >= 3) {
        assert.ok(allowed[name].has(ref.name), `${name} ${fn.name} global ${ref.name}`);
        allRefs.add(ref.name);
        if (fn === wasmHelper.functions[0]) rootRefs.add(ref.name);
      }
    }
  }
  for (const intrinsic of ["__lanesUnsupported", "__lanesPrimitive", "__lanesText"]) {
    assert.ok(allRefs.has(intrinsic), `${name} ${intrinsic}`);
  }
  assert.equal(allRefs.has("__lanesNumber"), name !== "concat", name);
  assert.equal(allRefs.has("__lanesToText"), false, name);
  assert.equal(allRefs.has("__lanesCall"), false, name);
  assert.equal(rootRefs.has("__lanesToText"), false, name);
  const stamp = raw => ({ ...raw, functions: raw.functions.map((fn, index) => index === 0 ? { ...fn, intrinsicRoot: true } : fn) });
  const native = packProgram(stamp(nativeHelper), `${name}Bootstrap`);
  const compiled = packProgram(stamp(wasmHelper), `${name}Bootstrap`);
  assert.deepEqual(compiled.code, native.code, name);
  assert.deepEqual(compiled.image, native.image, name);
  // attachBootstrap into a new field cannot be packed until program.js FIELDS
  // contains that field. The coordinator does that when it wires routing.
}
function packError(raw, source) {
  try {
    packProgram(raw, entrySource(source));
    return "packed";
  } catch (error) {
    return `${error.name}: ${error.message}`;
  }
}
for (const kind of ["bigint-string", "symbol-string"]) {
  const source = stringExtractHostGapSources.find(item => item.kind === kind).source;
  const native = nativeRaw(source);
  const compiled = wasmRaw(source);
  assert.equal(native.error, undefined, source);
  assert.equal(compiled.error, undefined, source);
  const nativePack = packError(native, source);
  const wasmPack = packError(compiled, source);
  assert.equal(wasmPack, nativePack, source);
  assert.equal(nativePack, kind === "bigint-string"
    ? "SyntaxError: Unsupported QuickJS instruction: push_bigint_i32"
    : "SyntaxError: Unsupported global or module reference: Symbol", source);
}

for(const fixture of stringExtractUnsupportedCases)assert.equal(call(fixture.source,fixture.input).value,fixture.expected,fixture.reason);
// Formerly rejected tagged templates are admitted positive programs: they are
// in stringExtractCases (native realm and native/Wasm parity checks above).
for (const source of stringExtractTaggedTemplateSources) assert.ok(programs.includes(source), `tagged template not admitted: ${source}`);
for (const fixture of stringExtractCompilerGapCases) assert.equal(call(fixture.source,fixture.input).value,fixture.expected,fixture.feature);

console.log(JSON.stringify({
  runtimeUnsupportedPrograms: stringExtractUnsupportedCases.length,
  taggedTemplatePrograms: stringExtractTaggedTemplateSources.length,
  helpers: names,
  metadata: stringExtractMetadata,
  directIntrinsics: stringExtractIntrinsics,
  indirectIntrinsics: stringExtractIndirectIntrinsics,
  numberIntrinsicOn: stringExtractIntegration.numberIntrinsicOn,
  unusedFusedToText: "__lanesToText",
  expectedArity: stringExtractMethodLengths,
  compiledLength: stringExtractCompiledLengths,
  stringOps: ["slice"],
  programs: programs.length,
  negativePrograms: stringExtractNegativeSources.length,
  hostGapPrograms: stringExtractHostGapSources.length,
  knownPins: stringExtractKnown.length,
  hostAlgorithmChecks: checks,
  fuzzSeed,
  nativeWasmAgreement: true,
  resumptionBudget: stringExtractResumptionBudget,
  resumptionExpected: stringExtractResumptionExpected,
  templateLiteral: stringExtractIntegration.templateLiteral,
  wiring: stringExtractIntegration.wiring,
  gaps: stringExtractGaps,
  gpuChecks: false,
  cpuFallback: false,
}, null, 2));
