// Ordinary own-property table for string and symbol keys.
// ES2025 OrdinaryOwnPropertyKeys: integer indices, then other strings, then
// symbols. Key shape matches the protocols seam:
//   { kind: "string", value } | { kind: "symbol", id }
// `id` is symbol uniqueIdentity (u32, 0 invalid), never the description.
// No host Object, Reflect, or Symbol. Descriptor field presence uses `in`
// on the already-normalized descriptor record (ToPropertyDescriptor's
// [[HasProperty]]), not a guest object walk.

export class Unsupported extends Error {
  constructor(message) {
    super(message);
    this.name = "Unsupported";
  }
}

export const MAX_SYMBOL_ID = 0xffffffff;
const MAX_CHAIN = 1024;
const NOT_INDEX = 0xffffffff;

export function stringKey(value) {
  if (typeof value !== "string") throw new TypeError("Property key is not a string");
  return { kind: "string", value };
}

export function symbolKey(id) {
  if (!isSymbolId(id)) throw new TypeError("Property key is not a symbol");
  return { kind: "symbol", id };
}

export function isIntegerIndex(string) {
  if (typeof string !== "string") return false;
  const n = string.length;
  if (n === 0 || n > 10) return false;
  let i = 0;
  for (; i < n; i++) {
    const c = string.charCodeAt(i);
    if (c < 48 || c > 57) return false;
  }
  // "0" is an index. Any other leading zero, "-0", and non-canonical forms are not.
  if (n > 1 && string.charCodeAt(0) === 48) return false;
  if (n < 10) return true;
  return string <= "4294967294";
}

function isSymbolId(id) {
  return Number.isInteger(id) && id >= 1 && id <= MAX_SYMBOL_ID;
}

function assertKey(key) {
  if (key && key.kind === "string" && typeof key.value === "string") return;
  if (key && key.kind === "symbol" && isSymbolId(key.id)) return;
  throw new TypeError("Invalid property key");
}

function assertEntries(entries) {
  if (!Array.isArray(entries)) throw new TypeError("Property table is not a list");
}

function assertObject(object) {
  if (object === null || typeof object !== "object" || !Array.isArray(object.entries)) {
    throw new TypeError("Property object is not a record");
  }
}

export function samePropertyKey(a, b) {
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === "string") return typeof a.value === "string" && a.value === b.value;
  if (a.kind === "symbol") return isSymbolId(a.id) && a.id === b.id;
  return false;
}

function sameValue(a, b) {
  if (a === b) return a !== 0 || 1 / a === 1 / b;
  return a !== a && b !== b;
}

function cloneKey(key) {
  if (key.kind === "string") return { kind: "string", value: key.value };
  return { kind: "symbol", id: key.id };
}

function findIndex(entries, key) {
  for (let i = 0; i < entries.length; i++) {
    if (samePropertyKey(entries[i].key, key)) return i;
  }
  return -1;
}

function classOf(key) {
  if (key.kind === "symbol") return 2;
  if (isIntegerIndex(key.value)) return 0;
  return 1;
}

function indexNumber(key) {
  return key.kind === "string" && isIntegerIndex(key.value) ? Number(key.value) : NOT_INDEX;
}

// `a` and `b` are property entries { key, created }. Integer indices sort
// numerically. Other strings and symbols sort by the explicit created stamp.
// A created tie keeps chronological order only because Array.prototype.sort is stable.
export function compareOwnPropertyKeyOrder(a, b) {
  if (!a || !b) throw new TypeError("property entry required");
  assertKey(a.key);
  assertKey(b.key);
  if (typeof a.created !== "number" || typeof b.created !== "number") {
    throw new TypeError("property entry is missing created");
  }
  const ca = classOf(a.key);
  const cb = classOf(b.key);
  if (ca !== cb) return ca - cb;
  if (ca === 0) return indexNumber(a.key) - indexNumber(b.key);
  if (a.created !== b.created) return a.created - b.created;
  return 0;
}

function stamp(entries) {
  const created = entries.clock === undefined ? 0 : entries.clock >>> 0;
  entries.clock = (created + 1) >>> 0;
  return created;
}

function fieldPresent(desc, name) {
  return name in desc;
}

// OrdinaryDefineOwnProperty for data descriptors. Missing attributes on a new
// property are false; missing value is undefined. Accessors are rejected.
// Returns false when the definition is rejected. Does not move an existing entry.
export function defineOwn(entries, key, desc) {
  assertEntries(entries);
  assertKey(key);
  if (desc === null || typeof desc !== "object") throw new TypeError("Descriptor is not an object");
  if (fieldPresent(desc, "get") || fieldPresent(desc, "set")) {
    throw new Unsupported("accessor descriptors are not supported");
  }
  const hasValue = fieldPresent(desc, "value");
  const hasWritable = fieldPresent(desc, "writable");
  const hasEnumerable = fieldPresent(desc, "enumerable");
  const hasConfigurable = fieldPresent(desc, "configurable");
  const index = findIndex(entries, key);
  if (index < 0) {
    if (entries.extensible === false) return false;
    entries.push({
      key: cloneKey(key),
      value: hasValue ? desc.value : undefined,
      writable: hasWritable ? !!desc.writable : false,
      enumerable: hasEnumerable ? !!desc.enumerable : false,
      configurable: hasConfigurable ? !!desc.configurable : false,
      created: stamp(entries),
    });
    return true;
  }
  const current = entries[index];
  if (!current.configurable) {
    if (hasConfigurable && !!desc.configurable) return false;
    if (hasEnumerable && !!desc.enumerable !== current.enumerable) return false;
    if (!current.writable) {
      if (hasWritable && !!desc.writable) return false;
      if (hasValue && !sameValue(desc.value, current.value)) return false;
    }
  }
  if (hasValue) current.value = desc.value;
  if (hasWritable) current.writable = !!desc.writable;
  if (hasEnumerable) current.enumerable = !!desc.enumerable;
  if (hasConfigurable) current.configurable = !!desc.configurable;
  return true;
}

export function getOwn(entries, key) {
  assertEntries(entries);
  assertKey(key);
  const index = findIndex(entries, key);
  if (index < 0) return undefined;
  const entry = entries[index];
  return {
    key: cloneKey(entry.key),
    value: entry.value,
    writable: entry.writable,
    enumerable: entry.enumerable,
    configurable: entry.configurable,
    created: entry.created,
  };
}

function walk(object, visit) {
  let current = object;
  for (let depth = 0; depth <= MAX_CHAIN; depth++) {
    if (current == null) return undefined;
    if (depth === MAX_CHAIN) throw new TypeError("prototype cycle");
    const stop = visit(current);
    if (stop !== undefined) return stop;
    current = current.parent;
  }
  throw new TypeError("prototype cycle");
}

// [[HasProperty]]. Own or inherited. Enumerable does not matter. Symbols included.
export function has(object, key) {
  assertObject(object);
  assertKey(key);
  const found = walk(object, current => (findIndex(current.entries, key) >= 0 ? true : undefined));
  return found === true;
}

// OrdinarySet for data properties. A new own property is writable, enumerable,
// and configurable. An inherited non-writable data property refuses the set.
export function set(object, key, value) {
  assertObject(object);
  assertKey(key);
  const ownIndex = findIndex(object.entries, key);
  if (ownIndex >= 0) {
    const own = object.entries[ownIndex];
    if (!own.writable) return false;
    own.value = value;
    return true;
  }
  const blocked = walk(object, current => {
    if (current === object) return undefined;
    const index = findIndex(current.entries, key);
    if (index < 0) return undefined;
    return current.entries[index].writable ? false : true;
  });
  if (blocked === true) return false;
  return defineOwn(object.entries, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

// [[Delete]]. Own only. Absent is success. Non-configurable is failure.
export function deleteOwn(entries, key) {
  assertEntries(entries);
  assertKey(key);
  const index = findIndex(entries, key);
  if (index < 0) return true;
  if (!entries[index].configurable) return false;
  entries.splice(index, 1);
  return true;
}

export function ownPropertyKeys(entries) {
  assertEntries(entries);
  const copy = [];
  for (let i = 0; i < entries.length; i++) copy.push(entries[i]);
  copy.sort(compareOwnPropertyKeyOrder);
  const keys = [];
  for (let i = 0; i < copy.length; i++) keys.push(cloneKey(copy[i].key));
  return keys;
}

export function enumerableOwnStrings(entries) {
  const keys = ownPropertyKeys(entries);
  const out = [];
  for (let i = 0; i < keys.length; i++) {
    if (keys[i].kind !== "string") continue;
    const own = getOwn(entries, keys[i]);
    if (own && own.enumerable) out.push(keys[i]);
  }
  return out;
}

// Object.getOwnPropertySymbols: every own symbol, insertion order, any attributes.
export function ownSymbols(entries) {
  assertEntries(entries);
  const out = [];
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].key.kind === "symbol") out.push(cloneKey(entries[i].key));
  }
  return out;
}

// CopyDataProperties. `excludedIds` is a list of property keys (not bare ids).
// Symbol exclusion is SameValue on uniqueIdentity. Own enumerable keys only.
export function copyDataProperties(target, source, excludedIds) {
  if (source == null) return target;
  assertObject(target);
  assertObject(source);
  const excluded = excludedIds == null ? [] : excludedIds;
  if (!Array.isArray(excluded)) throw new TypeError("excludedIds is not a list");
  for (let i = 0; i < excluded.length; i++) assertKey(excluded[i]);
  const keys = ownPropertyKeys(source.entries);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    let skip = false;
    for (let j = 0; j < excluded.length; j++) {
      if (samePropertyKey(excluded[j], key)) {
        skip = true;
        break;
      }
    }
    if (skip) continue;
    const own = getOwn(source.entries, key);
    if (own !== undefined && own.enumerable) {
      const created = defineOwn(target.entries, key, {
        value: own.value,
        writable: true,
        enumerable: true,
        configurable: true,
      });
      if (!created) throw new TypeError("Cannot create data property");
    }
  }
  return target;
}
