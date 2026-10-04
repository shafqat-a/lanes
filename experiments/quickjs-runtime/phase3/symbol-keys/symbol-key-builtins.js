// Builtin ids for symbol-key property operations.
// Range 1050..1099 only. 1051..1099 stay free.
// String paths that already exist are extended, not duplicated.

export const SYMBOL_KEY_BUILTIN_RANGE = Object.freeze({ min: 1050, max: 1099 });

// Kind 20 is the reserved sidecar. It is not allocated: the key is inline
// (tag + payload). See packSymbolCellKey for the live Node.key word.
export const SYMBOL_KEY_SIDECAR_KIND = 20;
export const SYMBOL_KEY_SIDECAR_USED = false;

// Live Node.key is one u32. Bits 31 and 30 are already taken
// (shader.js keyOf / keyText / arrayIndex):
//   bit 31 set: integer index n in 0..2^31-1, word = n | 0x80000000
//   bits 31..30 == 01: dynamic string, word = heapId | 0x40000000, heapId < L.heap
//   otherwise: image atom
// 0xC0000000 | id collides with integer indices >= 2^30.
// uniqueIdentity is a full u32 (symbol-cell.js MAX_UNIQUE_SYMBOL_ID) and does
// not fit beside a tag. The inline word stores the kind-17 cell node instead.
// uniqueIdentity is heap[node].value.x (symbol_cell_from_node id). Node indices
// are < L.heap (2048), so bit 29 is free inside the dynamic-string subspace.
export const SYMBOL_KEY_PACK = 0x60000000;
export const SYMBOL_KEY_TAG_MASK = 0xe0000000;
export const SYMBOL_KEY_PAYLOAD_MASK = 0x1fffffff;

export const VALUE_TAG_SYMBOL = 17;
export const VALUE_TAG_BIGINT = 18;

export function packSymbolCellKey(cellNode) {
  if (!Number.isInteger(cellNode) || cellNode < 1 || cellNode > SYMBOL_KEY_PAYLOAD_MASK) {
    throw new TypeError("symbol cell node does not fit the inline key word");
  }
  return (SYMBOL_KEY_PACK | cellNode) >>> 0;
}

export function isPackedSymbolKey(key) {
  return Number.isInteger(key) && key >= 0 && key <= 0xffffffff
    && (key & SYMBOL_KEY_TAG_MASK) === SYMBOL_KEY_PACK
    && (key & SYMBOL_KEY_PAYLOAD_MASK) !== 0;
}

export function packedSymbolCellNode(key) {
  if (!isPackedSymbolKey(key)) return 0;
  return key & SYMBOL_KEY_PAYLOAD_MASK;
}

// shader.js keyOf fast path. null when the index is not stored with bit 31
// (indices >= 2^31 are decimal strings; arrayIndex parses those).
export function integerIndexKeyWord(index) {
  if (!Number.isInteger(index) || index < 0 || index >= 0x80000000) return null;
  return (index | 0x80000000) >>> 0;
}

export const symbolKeyBuiltins = Object.freeze([
  Object.freeze({
    name: "Object.getOwnPropertySymbols",
    id: 1050,
    length: 1,
    guestName: "__lanesOwnPropertySymbols",
    spec: "ES2025 Object.getOwnPropertySymbols. OrdinaryOwnPropertyKeys, symbol step only.",
    note: "New WGSL arm in objectMethod, before the status-6 fallthrough at the end of objectMethod. No string-path builtin exists. Return an array of tag-17 values V(cellNode, 0, 17, 0) in insertion order, including non-enumerable symbols. Do not include strings. Do not sort by description. Length 1.",
  }),
  Object.freeze({
    name: "Reflect.ownKeys",
    id: null,
    length: 1,
    extends: 1240,
    spec: "ES2025 Reflect.ownKeys / OrdinaryOwnPropertyKeys (10.1.11.1).",
    note: "extend opcode 1240 (__lanesOwnPropertyKeys). Do not allocate a second walker and do not take a new id. 1240 must return integer indices, then other strings, then symbols. See CONTRACT.md for the split from builtin 710.",
  }),
  Object.freeze({
    name: "HasProperty",
    id: null,
    length: 2,
    extends: 96,
    spec: "ES2025 [[HasProperty]] / RelationalExpression `in` / Reflect.has. Own or inherited. Enumerable is irrelevant.",
    note: "extend opcode 96 (`in`, shader.js cases('in')). keyOf must accept tag 17 and sameKey must use symbol identity. Also extend own-has builtin 107 (private 902 remapped in objectMethod) and method 151 so HasOwn and `in` both see symbols. 107 is own-only; opcode 96 walks [[Prototype]]. Do not duplicate the string walk.",
  }),
  Object.freeze({
    name: "DefineOwnProperty",
    id: null,
    length: 3,
    extends: 110,
    spec: "ES2025 [[DefineOwnProperty]] / OrdinaryDefineOwnProperty. Reflect.defineProperty and Object.defineProperty share it.",
    note: "extend opcode 34 (define_field) and builtin 110 (__lanesDefine → descriptor). Also builtin 101 (__lanesDefineProperty), which calls the same descriptor(). SameValue on the symbol id. Defining a symbol must not move string nodes. Rejected definitions stay status 4. No second define implementation.",
  }),
  Object.freeze({
    name: "DeleteProperty",
    id: null,
    length: 2,
    extends: 95,
    spec: "ES2025 [[Delete]] / delete / Reflect.deleteProperty. Own only.",
    note: "extend opcode 95 (`delete`). Absent symbol key succeeds. Non-configurable symbol key fails (strict: status 4). Unlink the node; do not reorder surviving string keys. Integer indices are still re-sorted at enumeration, not stored in numeric order.",
  }),
]);

const seen = new Set();
for (const entry of symbolKeyBuiltins) {
  if (entry.id != null) {
    if (entry.id < SYMBOL_KEY_BUILTIN_RANGE.min || entry.id > SYMBOL_KEY_BUILTIN_RANGE.max) {
      throw new Error(`symbol-key builtin ${entry.id} is outside 1050..1099`);
    }
    if (seen.has(entry.id)) throw new Error(`duplicate symbol-key builtin ${entry.id}`);
    seen.add(entry.id);
  }
  if (typeof entry.length !== "number" || !entry.spec || !entry.note) {
    throw new Error(`symbol-key builtin ${entry.name} is missing length or spec notes`);
  }
}
