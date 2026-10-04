// ES2025 ToPrimitive (7.1.1) and OrdinaryToPrimitive (7.1.1.1).
// Does not call host Symbol. No Date special case: the engine has no Date brand
// (no Date global, no Date heap kind). preferredType "string" is the only way
// to request the string hint. Ordinary objects, including a caller-supplied
// Date brand, use the number order when the hint is default.
//
// BigInt.prototype[@@toPrimitive] is not installed. A bigint primitive is
// returned unchanged. A bigint wrapper with no own @@toPrimitive throws
// Unsupported instead of coercing to a number.

import { WELL_KNOWN_ID, isSymbolCell } from "./well-known.js";

export class Unsupported extends Error {
  constructor(message = "Unsupported runtime operation") {
    super(message);
    this.name = "Unsupported";
  }
}

// Abstract ToNumber(symbol) is a TypeError. This does not coerce.
export function toNumberSymbolThrows(value) {
  return isSymbolCell(value);
}

// Abstract ToNumber(bigint) is a TypeError. Wrappers are Unsupported, not this.
export function toNumberBigIntThrows(value) {
  return isBigIntPrimitive(value);
}

export function isBigIntPrimitive(value) {
  return !!value && value.tag === "bigint";
}

function isCallable(method) {
  if (typeof method === "function") return true;
  return !!method && method.callable === true;
}

function isObjectValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value !== "object" && typeof value !== "function") return false;
  const tag = value.tag;
  if (tag === "number" || tag === "string" || tag === "boolean" || tag === "bigint" || tag === "symbol" || tag === "null" || tag === "undefined") return false;
  return true;
}

function readOwnMethod(object, name) {
  const methods = object.methods;
  if (!methods || !Object.hasOwn(methods, name)) return undefined;
  return methods[name];
}

// methods.toPrimitive and symbols[@@toPrimitive id] are the exotic method.
// They are not the string property "toPrimitive". String keys toString and
// valueOf are the ordinary methods.
function readExoticToPrimitive(object) {
  const symbols = object.symbols;
  const id = WELL_KNOWN_ID.toPrimitive;
  if (symbols && Object.hasOwn(symbols, String(id))) return symbols[id];
  return readOwnMethod(object, "toPrimitive");
}

function invoke(method, receiver, args) {
  if (typeof method === "function") return method(receiver, ...args);
  if (typeof method.invoke === "function") return method.invoke(receiver, ...args);
  if (Object.hasOwn(method, "returns")) {
    return typeof method.returns === "function" ? method.returns(receiver, ...args) : method.returns;
  }
  throw new TypeError("Method is not callable");
}

function hintFor(preferredType) {
  if (preferredType === undefined || preferredType === "default") return "default";
  if (preferredType === "number" || preferredType === "string") return preferredType;
  throw new TypeError("Invalid ToPrimitive preferred type");
}

// Symbol.prototype[@@toPrimitive]. Hint is ignored. Same cell identity.
export function symbolToPrimitive(cell, hint) {
  void hint;
  if (isSymbolCell(cell)) return cell;
  if (isObjectValue(cell) && cell.brand === "Symbol" && isSymbolCell(cell.symbolData)) return cell.symbolData;
  throw new TypeError("Symbol.prototype[@@toPrimitive] requires a symbol");
}

function ordinaryToPrimitive(object, hint) {
  const names = hint === "string" ? ["toString", "valueOf"] : ["valueOf", "toString"];
  for (const name of names) {
    const method = readOwnMethod(object, name);
    if (method === undefined || method === null || !isCallable(method)) continue;
    const result = invoke(method, object, []);
    if (!isObjectValue(result)) return result;
  }
  throw new TypeError("Cannot convert object to primitive value");
}

export function ToPrimitive(value, preferredType) {
  const hint = hintFor(preferredType);
  if (!isObjectValue(value)) return value;
  const exotic = readExoticToPrimitive(value);
  if (exotic !== undefined && exotic !== null) {
    if (!isCallable(exotic)) throw new TypeError("@@toPrimitive is not a function");
    const result = invoke(exotic, value, [hint]);
    if (isObjectValue(result)) throw new TypeError("Cannot convert object to primitive value");
    return result;
  }
  // Inherited Symbol.prototype method when the wrapper has no own method.
  if (value.brand === "Symbol") return symbolToPrimitive(value, hint);
  if (value.brand === "BigInt") throw new Unsupported("BigInt wrapper @@toPrimitive is unsupported");
  return ordinaryToPrimitive(value, hint === "string" ? "string" : "number");
}
