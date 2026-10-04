// Builtin factory for symbol identity. IDs 1000..1006 are the first free IDs in
// the phase-3 range 1000..1049. No earlier ID in that range is allocated.
// 1007..1049 stay unused. Guest code must not reach these through a host Symbol.

import {
  SYMBOL_VALUE_TAG,
  symbolDescriptiveString,
  symbolKeyFor,
  symbolPrimitiveValue,
  typeError,
  typeofSymbol,
  unsupported,
  assertCallableAsConstructor,
} from './symbol-cell.js';

const writableConfigurable = Object.freeze({
  writable: true,
  enumerable: false,
  configurable: true,
  accessor: false,
  // shader.js dataProperty flag argument: writable|configurable.
  dataPropertyFlags: 5,
});

const descriptionAccessor = Object.freeze({
  writable: false,
  enumerable: false,
  configurable: true,
  accessor: true,
  setter: null,
  dataPropertyFlags: 4,
  // Kind-9 getter id is stored with the native-builtin high bit.
  getterBuiltinHighBit: true,
});

const dispatchOnly = Object.freeze({
  writable: false,
  enumerable: false,
  configurable: false,
  accessor: false,
  dataPropertyFlags: null,
});

export const SYMBOL_BUILTIN_RANGE = Object.freeze({ min: 1000, max: 1049 });

export const symbolBuiltins = Object.freeze([
  Object.freeze({
    id: 1000,
    name: 'Symbol',
    length: 0,
    arity: 1,
    attributes: writableConfigurable,
    wgslHookName: 'symbol_construct',
    specNote: 'Call, not [[Construct]]. Missing or undefined description is an absent description (null on the cell). Any other non-string fails; ToString is the caller. new Symbol sets NewTarget and throws TypeError "Symbol is not a constructor" (shader construct() currently turns unknown builtin ids into status 6; it must call this hook with new_target_defined). Capture is type 4 id 1000, not type 6. objectView maps id 1000 to fixed node 26; objectValue maps node 26 back to V(1000,0,11,0). Node 26 is an ordinary object whose [[Prototype]] is Function.prototype (node 3), with name "Symbol", length 0, and prototype node 27 stored non-writable, non-enumerable, non-configurable. The prototype constructor property reuses id 1000.',
  }),
  Object.freeze({
    id: 1001,
    name: 'for',
    length: 1,
    arity: 1,
    attributes: writableConfigurable,
    wgslHookName: 'symbol_for',
    specNote: 'Symbol.for. Own data property of node 26. The argument is already a string. Returns the canonical registered cell for that key. The registered description is the key, including "". Unique cells are never reused. A full registry or a full identity space throws a resource-limit outcome (status 3) without inserting a partial record.',
  }),
  Object.freeze({
    id: 1002,
    name: 'keyFor',
    length: 1,
    arity: 1,
    attributes: writableConfigurable,
    wgslHookName: 'symbol_key_for',
    specNote: 'Symbol.keyFor. Own data property of node 26. Non-symbol throws TypeError "not a symbol". A unique symbol returns null (spec undefined). A registered symbol returns its key string, including "".',
  }),
  Object.freeze({
    id: 1003,
    name: 'toString',
    length: 0,
    arity: 0,
    attributes: writableConfigurable,
    wgslHookName: 'symbol_prototype_to_string',
    specNote: 'Symbol.prototype.toString. Own data property of node 27. thisSymbolValue then SymbolDescriptiveString. A non-symbol throws TypeError. Symbol wrappers are not recognized and are not approximated. Result longer than 256 UTF-16 units is a resource limit, not a truncated string.',
  }),
  Object.freeze({
    id: 1004,
    name: 'valueOf',
    length: 0,
    arity: 0,
    attributes: writableConfigurable,
    wgslHookName: 'symbol_prototype_value_of',
    specNote: 'Symbol.prototype.valueOf. Own data property of node 27. Returns the symbol cell. A non-symbol throws TypeError. @@toPrimitive is the same operation but the well-known symbol key belongs to the protocols worker; wire symbolPrimitiveValue / symbol_primitive_value when that key exists. Do not install a string-named stand-in.',
  }),
  Object.freeze({
    id: 1005,
    name: 'description',
    length: 0,
    arity: 0,
    attributes: descriptionAccessor,
    wgslHookName: 'symbol_prototype_description',
    specNote: 'Symbol.prototype.description getter. Kind-9 accessor on node 27: value.x = 0x80000000 | 1005, value.y = 0 (no setter), marked flags from dataPropertyFlags 4 (configurable only). Absent description returns undefined. The empty string returns "". Non-writable in the spec sense because it is an accessor without a setter.',
  }),
  Object.freeze({
    id: 1006,
    name: 'typeof',
    length: 0,
    arity: 1,
    attributes: dispatchOnly,
    wgslHookName: 'symbol_typeof',
    specNote: 'Opcode hook, not a guest property. Tag 17 returns the string "symbol". Other tags throw Unsupported (status 6) so this hook cannot be used as a stand-in typeof. The six-entry type-name table in packProgram has no symbol slot; do not insert one in the middle.',
  }),
]);

const byId = new Map(symbolBuiltins.map(entry => [entry.id, entry]));
if (byId.size !== symbolBuiltins.length) throw new Error('duplicate symbol builtin id');
for (const entry of symbolBuiltins) {
  if (entry.id < SYMBOL_BUILTIN_RANGE.min || entry.id > SYMBOL_BUILTIN_RANGE.max) {
    throw new Error(`symbol builtin id ${entry.id} is outside 1000..1049`);
  }
  for (const key of ['id', 'name', 'length', 'arity', 'attributes', 'wgslHookName', 'specNote']) {
    if (entry[key] === undefined || entry[key] === '') throw new Error(`symbol builtin ${entry.id} missing ${key}`);
  }
}

export const SYMBOL_BUILTIN_IDS = Object.freeze({
  construct: 1000,
  for: 1001,
  keyFor: 1002,
  toString: 1003,
  valueOf: 1004,
  description: 1005,
  typeof: 1006,
});

// Property of the constructor object, not a separate builtin id.
export const symbolPrototypePropertyAttributes = Object.freeze({
  writable: false,
  enumerable: false,
  configurable: false,
  accessor: false,
  dataPropertyFlags: 0,
});

function requireRealm(realm) {
  if (!realm || typeof realm.createSymbol !== 'function' || typeof realm.symbolFor !== 'function') {
    throw unsupported('symbol builtin dispatch requires a symbol realm');
  }
  return realm;
}

// undefined/missing description becomes null. Any other non-string is refused.
export function symbolConstruct(realm, description, newTarget) {
  requireRealm(realm);
  if (newTarget !== undefined) assertCallableAsConstructor();
  // Only undefined is the absent description. null still needs ToString ("null")
  // and is refused here rather than stored as an absent description.
  if (description === undefined) return realm.createSymbol(null);
  if (typeof description !== 'string') throw typeError('Symbol description must be a string or undefined');
  return realm.createSymbol(description);
}

export function symbolForBuiltin(realm, keyString) {
  requireRealm(realm);
  return realm.symbolFor(keyString);
}

export function symbolKeyForBuiltin(realm, value) {
  requireRealm(realm);
  return symbolKeyFor(value);
}

export function symbolPrototypeToString(realm, receiver) {
  requireRealm(realm);
  return symbolDescriptiveString(receiver);
}

export function symbolPrototypeValueOf(realm, receiver) {
  requireRealm(realm);
  return symbolPrimitiveValue(receiver);
}

// undefined when the cell has no description; "" when the description is empty.
export function symbolPrototypeDescription(realm, receiver) {
  requireRealm(realm);
  const cell = symbolPrimitiveValue(receiver);
  return cell.description === null ? undefined : cell.description;
}

export function symbolTypeofDispatch(tag) {
  if (tag !== SYMBOL_VALUE_TAG) {
    throw unsupported('typeof dispatch only implements symbol tag 17');
  }
  return 'symbol';
}

export function dispatchSymbolBuiltin(realm, id, call = {}) {
  const entry = byId.get(id);
  if (!entry) throw unsupported(`symbol builtin id ${id} is not allocated`);
  switch (id) {
    case 1000: return symbolConstruct(realm, call.argument, call.newTarget);
    case 1001: return symbolForBuiltin(realm, call.argument);
    case 1002: return symbolKeyForBuiltin(realm, call.argument);
    case 1003: return symbolPrototypeToString(realm, call.receiver);
    case 1004: return symbolPrototypeValueOf(realm, call.receiver);
    case 1005: return symbolPrototypeDescription(realm, call.receiver);
    case 1006: return symbolTypeofDispatch(call.tag);
    default: throw unsupported(entry.name);
  }
}

export { symbolPrimitiveValue, typeofSymbol, SYMBOL_VALUE_TAG };
