// Object.prototype.toString (ES2025 20.1.3.6) via Get(O, @@toStringTag).
// A string tag wins over the builtin brand. Null and undefined do not Get.
// The engine has no Date or RegExp brand. Those tags are used only when the
// caller sets brand "Date" or "RegExp". Math and JSON are ordinary objects;
// "[object Math]" / "[object JSON]" come from the data properties below, not
// from a brand switch.

import { FIXED_NODE, WELL_KNOWN_ID, symbolPropertyKey } from "./well-known.js";

// dataProperty flags: bit0 writable, bit1 enumerable, bit2 configurable.
// shader.js stores marked = flags << 1. Math/JSON use flags 4 (marked 8).
const CONFIGURABLE = 4;

export function mathAndJsonTags() {
  const key = symbolPropertyKey(WELL_KNOWN_ID.toStringTag);
  const descriptor = value => Object.freeze({
    key,
    value,
    writable: false,
    enumerable: false,
    configurable: true,
    flags: CONFIGURABLE,
  });
  return Object.freeze({
    math: Object.freeze({ nodeId: FIXED_NODE.math, descriptor: descriptor("Math") }),
    json: Object.freeze({ nodeId: FIXED_NODE.json, descriptor: descriptor("JSON") }),
  });
}

function nullishTag(value) {
  if (value === null) return "Null";
  if (value === undefined) return "Undefined";
  if (value.tag === "null") return "Null";
  if (value.tag === "undefined") return "Undefined";
  if (value.z === 2 && value.tag !== "object" && value.tag !== "function") return "Null";
  if (value.z === 3 && value.tag !== "object" && value.tag !== "function") return "Undefined";
  return "";
}

function primitiveString(tag) {
  if (typeof tag === "string") return tag;
  if (tag && tag.tag === "string" && typeof tag.value === "string") return tag.value;
  return null;
}

// Builtin tag after a missing or non-string @@toStringTag.
export function builtinTag(value) {
  if (typeof value === "number" || value.tag === "number" || (value.z === 0 && value.tag !== "object")) return "Number";
  if (typeof value === "boolean" || value.tag === "boolean" || (value.z === 1 && value.tag !== "object")) return "Boolean";
  if (typeof value === "string" || value.tag === "string" || (value.z === 7 && value.tag !== "object")) return "String";
  if (value.tag === "function" || value.z === 5 || value.z === 11 || value.brand === "Function") return "Function";
  if (value.brand === "Array" || value.kind === 7) return "Array";
  if (value.brand === "Arguments" || value.kind === 14) return "Arguments";
  if (value.brand === "Error" || value.kind === 8) return "Error";
  if (value.brand === "Boolean" || value.brand === "Number" || value.brand === "String") return value.brand;
  if (value.brand === "Date") return "Date";
  if (value.brand === "RegExp") return "RegExp";
  if (value.kind === 16 && value.wrapped) return builtinTag(value.wrapped);
  return "Object";
}

// getProperty(value, symbolKey) is Get, including the prototype walk.
// A returned string replaces the builtin brand. Any other result falls back.
export function objectToString(value, getProperty) {
  const early = nullishTag(value);
  if (early) return `[object ${early}]`;
  if (typeof getProperty !== "function") throw new TypeError("getProperty must be callable");
  const key = symbolPropertyKey(WELL_KNOWN_ID.toStringTag);
  const tag = primitiveString(getProperty(value, key));
  if (tag !== null) return `[object ${tag}]`;
  return `[object ${builtinTag(value)}]`;
}
