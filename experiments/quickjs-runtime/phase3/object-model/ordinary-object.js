// Pure ES2025 ordinary object. Correctness reference for this assignment.
// Not a heap object: no kind 22, no builtin id, no opcode.
//
// [[OwnPropertyKeys]] for strings: canonical integer indices ascending
// (0 .. 2^32-2, no leading zero), then other strings in insertion order.
// Extension point: a key {kind:"symbol", id} has kind "symbol". Symbol-kind
// keys sort after every string and keep their own insertion order. The id is
// not a sort key. The symbol-keys worker owns real symbols; do not import it.
// String keys are plain strings here. {kind:"string", value} is accepted so
// the same character sequence is the same property as the plain string.
//
// defineProperty is DefinePropertyOrThrow. set is strict OrdinarySet.
// Both throw TypeError("Invalid operation"), the runtime's status-4 identity.
// ToPropertyDescriptor failures use the guest bootstrap's TypeError strings.

const BRAND = Symbol("ordinaryObject");
const MAX_CHAIN = 1024;
const MAX_SYMBOL_ID = 0xffffffff;

function typeError(message = "Invalid operation") {
  return new TypeError(message);
}

function isOrdinary(value) {
  return value !== null && typeof value === "object" && value[BRAND] === true;
}

function assertObject(value) {
  if (!isOrdinary(value)) throw typeError();
}

function isSymbolId(id) {
  return Number.isInteger(id) && id >= 1 && id <= MAX_SYMBOL_ID;
}

// Same cutoff as arrayIndex in shader.js and the symbol-key table:
// "0" and "4294967294" are indices; "01" and "4294967295" are not.
export function isIntegerIndex(string) {
  if (typeof string !== "string") return false;
  const n = string.length;
  if (n === 0 || n > 10) return false;
  for (let i = 0; i < n; i++) {
    const c = string.charCodeAt(i);
    if (c < 48 || c > 57) return false;
  }
  if (n > 1 && string.charCodeAt(0) === 48) return false;
  if (n < 10) return true;
  return string <= "4294967294";
}

function classifyString(text) {
  if (isIntegerIndex(text)) return { cls: 0, token: `int:${text}`, text };
  return { cls: 1, token: `str:${text}`, text };
}

function canonicalize(key) {
  if (typeof key === "string") return classifyString(key);
  if (key && typeof key === "object") {
    if (key.kind === "symbol") {
      if (!isSymbolId(key.id)) throw new TypeError("Invalid property key");
      return { cls: 2, token: `symbol:${key.id}`, symbolId: key.id };
    }
    if (key.kind === "string" && typeof key.value === "string") return classifyString(key.value);
  }
  throw new TypeError("Invalid property key");
}

function exportKey(entry) {
  if (entry.cls === 2) return { kind: "symbol", id: entry.symbolId };
  return entry.text;
}

function readDescriptor(desc) {
  if (desc === null || (typeof desc !== "object" && typeof desc !== "function")) {
    throw new TypeError("Descriptor is not an object");
  }
  const hasGet = "get" in desc;
  const hasSet = "set" in desc;
  const hasValue = "value" in desc;
  const hasWritable = "writable" in desc;
  if ((hasGet || hasSet) && (hasValue || hasWritable)) throw new TypeError("Mixed property descriptor");
  let get;
  let set;
  if (hasGet) {
    get = desc.get;
    if (get !== undefined && typeof get !== "function") throw new TypeError("Invalid getter");
  }
  if (hasSet) {
    set = desc.set;
    if (set !== undefined && typeof set !== "function") throw new TypeError("Invalid setter");
  }
  return {
    hasGet, hasSet, hasValue, hasWritable,
    hasEnumerable: "enumerable" in desc,
    hasConfigurable: "configurable" in desc,
    get, set,
    value: hasValue ? desc.value : undefined,
    writable: desc.writable,
    enumerable: desc.enumerable,
    configurable: desc.configurable,
  };
}

function cloneDesc(desc) {
  if (desc.type === "data") {
    return {
      type: "data",
      value: desc.value,
      writable: desc.writable,
      enumerable: desc.enumerable,
      configurable: desc.configurable,
    };
  }
  return {
    type: "accessor",
    get: desc.get,
    set: desc.set,
    enumerable: desc.enumerable,
    configurable: desc.configurable,
  };
}

function isAccessorFields(fields) {
  return fields.hasGet || fields.hasSet;
}

function isDataFields(fields) {
  return fields.hasValue || fields.hasWritable;
}

function isGeneric(fields) {
  return !isAccessorFields(fields) && !isDataFields(fields);
}

function anyField(fields) {
  return fields.hasGet || fields.hasSet || fields.hasValue || fields.hasWritable
    || fields.hasEnumerable || fields.hasConfigurable;
}

// ValidateAndApplyPropertyDescriptor. Returns the next own descriptor, or
// false when OrdinaryDefineOwnProperty would reject. Does not mutate.
function validateAndApply(extensible, fields, current) {
  if (current === undefined) {
    if (!extensible) return false;
    if (isAccessorFields(fields)) {
      return {
        type: "accessor",
        get: fields.hasGet ? fields.get : undefined,
        set: fields.hasSet ? fields.set : undefined,
        enumerable: fields.hasEnumerable ? !!fields.enumerable : false,
        configurable: fields.hasConfigurable ? !!fields.configurable : false,
      };
    }
    return {
      type: "data",
      value: fields.hasValue ? fields.value : undefined,
      writable: fields.hasWritable ? !!fields.writable : false,
      enumerable: fields.hasEnumerable ? !!fields.enumerable : false,
      configurable: fields.hasConfigurable ? !!fields.configurable : false,
    };
  }
  if (!anyField(fields)) return cloneDesc(current);
  if (!current.configurable) {
    if (fields.hasConfigurable && !!fields.configurable) return false;
    if (fields.hasEnumerable && !!fields.enumerable !== current.enumerable) return false;
  }
  const next = cloneDesc(current);
  if (!isGeneric(fields) && (current.type === "data") !== isDataFields(fields)) {
    if (!current.configurable) return false;
    if (current.type === "data") {
      next.type = "accessor";
      delete next.value;
      delete next.writable;
      next.get = fields.hasGet ? fields.get : undefined;
      next.set = fields.hasSet ? fields.set : undefined;
    } else {
      next.type = "data";
      delete next.get;
      delete next.set;
      next.value = fields.hasValue ? fields.value : undefined;
      next.writable = fields.hasWritable ? !!fields.writable : false;
    }
  } else if (current.type === "data" && isDataFields(fields)) {
    if (!current.configurable && !current.writable) {
      if (fields.hasWritable && !!fields.writable) return false;
      if (fields.hasValue && !Object.is(fields.value, current.value)) return false;
    }
    if (fields.hasValue) next.value = fields.value;
    if (fields.hasWritable) next.writable = !!fields.writable;
  } else if (current.type === "accessor" && isAccessorFields(fields)) {
    if (!current.configurable) {
      if (fields.hasGet && !Object.is(fields.get, current.get)) return false;
      if (fields.hasSet && !Object.is(fields.set, current.set)) return false;
    }
    if (fields.hasGet) next.get = fields.get;
    if (fields.hasSet) next.set = fields.set;
  }
  if (fields.hasEnumerable) next.enumerable = !!fields.enumerable;
  if (fields.hasConfigurable) next.configurable = !!fields.configurable;
  return next;
}

function commit(obj, canon, next, isNew) {
  if (isNew) {
    const entry = {
      cls: canon.cls,
      token: canon.token,
      text: canon.text,
      symbolId: canon.symbolId,
      created: obj.clock,
    };
    obj.clock += 1;
    obj.order.push(entry);
  }
  obj.props.set(canon.token, next);
}

export function createObject(proto) {
  if (proto !== null && !isOrdinary(proto)) throw typeError();
  return {
    [BRAND]: true,
    proto,
    extensible: true,
    clock: 0,
    order: [],
    props: new Map(),
  };
}

export function getPrototypeOf(obj) {
  assertObject(obj);
  return obj.proto;
}

export function setPrototypeOf(obj, proto) {
  assertObject(obj);
  if (proto !== null && !isOrdinary(proto)) throw typeError();
  if (obj.proto === proto) return obj;
  if (!obj.extensible) throw typeError();
  let current = proto;
  for (let depth = 0; current !== null; depth++) {
    if (current === obj || depth > MAX_CHAIN) throw typeError();
    current = current.proto;
  }
  obj.proto = proto;
  return obj;
}

export function preventExtensions(obj) {
  assertObject(obj);
  obj.extensible = false;
  return obj;
}

export function defineProperty(obj, key, desc) {
  assertObject(obj);
  const canon = canonicalize(key);
  const fields = readDescriptor(desc);
  const existing = obj.props.get(canon.token);
  const next = validateAndApply(obj.extensible, fields, existing);
  if (next === false) throw typeError();
  commit(obj, canon, next, existing === undefined);
  return obj;
}

export function getOwnPropertyDescriptor(obj, key) {
  assertObject(obj);
  const own = obj.props.get(canonicalize(key).token);
  if (own === undefined) return undefined;
  if (own.type === "data") {
    return {
      value: own.value,
      writable: own.writable,
      enumerable: own.enumerable,
      configurable: own.configurable,
    };
  }
  return {
    get: own.get,
    set: own.set,
    enumerable: own.enumerable,
    configurable: own.configurable,
  };
}

function getWith(obj, canon, receiver, depth) {
  if (depth > MAX_CHAIN) throw typeError();
  const own = obj.props.get(canon.token);
  if (own === undefined) {
    if (obj.proto === null) return undefined;
    return getWith(obj.proto, canon, receiver, depth + 1);
  }
  if (own.type === "data") return own.value;
  if (own.get === undefined) return undefined;
  return own.get.call(receiver);
}

export function get(obj, key, receiver = obj) {
  assertObject(obj);
  return getWith(obj, canonicalize(key), receiver, 0);
}

function setWith(obj, canon, value, receiver, depth) {
  if (depth > MAX_CHAIN) throw typeError();
  const own = obj.props.get(canon.token);
  if (own === undefined) {
    if (obj.proto !== null) return setWith(obj.proto, canon, value, receiver, depth + 1);
    if (!isOrdinary(receiver)) throw typeError();
    if (!receiver.extensible) throw typeError();
    commit(receiver, canon, {
      type: "data",
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    }, true);
    return true;
  }
  if (own.type === "data") {
    if (!own.writable) throw typeError();
    if (!isOrdinary(receiver)) throw typeError();
    const existing = receiver.props.get(canon.token);
    if (existing !== undefined) {
      if (existing.type !== "data" || !existing.writable) throw typeError();
      const next = validateAndApply(receiver.extensible, { hasValue: true, value }, existing);
      if (next === false) throw typeError();
      receiver.props.set(canon.token, next);
      return true;
    }
    if (!receiver.extensible) throw typeError();
    commit(receiver, canon, {
      type: "data",
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    }, true);
    return true;
  }
  if (own.set === undefined) throw typeError();
  own.set.call(receiver, value);
  return true;
}

export function set(obj, key, value, receiver = obj) {
  assertObject(obj);
  return setWith(obj, canonicalize(key), value, receiver, 0);
}

function hasWith(obj, canon, depth) {
  if (depth > MAX_CHAIN) throw typeError();
  if (obj.props.has(canon.token)) return true;
  if (obj.proto === null) return false;
  return hasWith(obj.proto, canon, depth + 1);
}

export function has(obj, key) {
  assertObject(obj);
  return hasWith(obj, canonicalize(key), 0);
}

export function deleteProperty(obj, key) {
  assertObject(obj);
  const canon = canonicalize(key);
  const own = obj.props.get(canon.token);
  if (own === undefined) return true;
  if (!own.configurable) throw typeError();
  obj.props.delete(canon.token);
  obj.order = obj.order.filter(entry => entry.token !== canon.token);
  return true;
}

// cls 0 integer, cls 1 string, cls 2 symbol. Symbols stay last.
export function ownKeys(obj) {
  assertObject(obj);
  const entries = obj.order.slice();
  entries.sort((a, b) => {
    if (a.cls !== b.cls) return a.cls - b.cls;
    if (a.cls === 0) return Number(a.text) - Number(b.text);
    return a.created - b.created;
  });
  return entries.map(exportKey);
}
