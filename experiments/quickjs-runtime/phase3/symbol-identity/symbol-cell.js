// Guest symbol cells and the global symbol registry.
// This module never calls the host Symbol constructor. Identity is a monotonic
// u32. 0 is not a symbol and is never issued. Description and registry-key
// strings are compared by UTF-16 code units; nothing is interned by description
// except symbolFor, which is the global registry.
//
// The Map/array below are the pure model's image of guest heap state. The GPU
// copy is the kind-18 registry node and kind-17 cells in symbol-identity.wgsl.
// Numeric SameValueZero is not defined here and must not be changed.

export const SYMBOL_VALUE_TAG = 17;
export const SYMBOL_CELL_KIND = 17;
export const SYMBOL_REGISTRY_KIND = 18;

// Fixed intrinsic reservations. Nodes 23 Math, 24 Number and 25 JSON stay put.
// Raw heap slots 26-28 are currently the kind-13 holders allocated immediately
// after node 25; see FIXED_NODE_ALLOC_CONFLICT. Do not claim nodes 29+.
export const SYMBOL_NODE_CONSTRUCTOR = 26;
export const SYMBOL_NODE_PROTOTYPE = 27;
export const SYMBOL_NODE_REGISTRY = 28;

export const FIXED_NODES = Object.freeze({
  symbolConstructor: SYMBOL_NODE_CONSTRUCTOR,
  symbolPrototype: SYMBOL_NODE_PROTOTYPE,
  symbolRegistry: SYMBOL_NODE_REGISTRY,
});

export const FIXED_NODE_ALLOC_CONFLICT = Object.freeze({
  occupiedByCurrentInit: Object.freeze({
    26: 'kind-13 holder of String.prototype (empty string)',
    27: 'kind-13 holder of Number.prototype (+0)',
    28: 'kind-13 holder of Boolean.prototype (false)',
  }),
  resolution: 'These indices are the next named fixed intrinsics (next free fixed node is 26). Allocate nodes 26, 27 and 28 immediately after jsonObject and before the three holder allocs, then root 1..28. Holder nodes move; shader.js does not hardcode 26, 27 or 28. Nodes 29+ are not claimed.',
});

// Ids 1..MAX_UNIQUE_SYMBOL_ID inclusive. The next id after MAX is the sentinel 0
// (exhausted), never 1. Registry entries are rooted for the realm lifetime.
// 1024 leaves heap room for description chunks under the 2048-node guest heap.
export const MAX_UNIQUE_SYMBOL_ID = 0xFFFFFFFF;
export const MAX_REGISTRY_ENTRIES = 1024;
// Input strings and SymbolDescriptiveString results share the GPU string cap.
export const MAX_DESCRIPTION_UNITS = 256;

// Packed into SymbolCell.flags in the WGSL fragment.
export const SYMBOL_FLAG_HAS_DESCRIPTION = 1;
export const SYMBOL_FLAG_IN_REGISTRY = 2;

export const OUTCOME_STATUS = Object.freeze({
  resourceLimit: 3,
  typeError: 4,
  unsupported: 6,
});

const liveCells = new WeakSet();

export function typeError(message) {
  return { tag: 'TypeError', name: 'TypeError', message, status: OUTCOME_STATUS.typeError };
}

export function resourceLimit(message) {
  return { tag: 'ResourceLimit', name: 'ResourceLimit', message, status: OUTCOME_STATUS.resourceLimit };
}

export function unsupported(message) {
  return { tag: 'Unsupported', name: 'Unsupported', message, status: OUTCOME_STATUS.unsupported };
}

function throwTypeError(message) {
  throw typeError(message);
}

function throwResourceLimit(message) {
  throw resourceLimit(message);
}

export function isSymbolCell(value) {
  return liveCells.has(value);
}

function assertU32(name, value) {
  if (!Number.isInteger(value) || value < 0 || value > MAX_UNIQUE_SYMBOL_ID) {
    throw new RangeError(`${name} is not a u32`);
  }
}

export function createSymbolRealm(options = {}) {
  if (options === null || typeof options !== 'object') {
    throw new RangeError('symbol realm options must be an object');
  }
  const maxUnique = options.maxUniqueSymbols ?? MAX_UNIQUE_SYMBOL_ID;
  const maxRegistry = options.maxRegistryEntries ?? MAX_REGISTRY_ENTRIES;
  const initialNextId = options.initialNextId ?? 1;
  assertU32('maxUniqueSymbols', maxUnique);
  assertU32('maxRegistryEntries', maxRegistry);
  assertU32('initialNextId', initialNextId);
  if (maxUnique < 1) throw new RangeError('maxUniqueSymbols must be at least 1');
  if (maxRegistry > MAX_REGISTRY_ENTRIES) {
    throw new RangeError('maxRegistryEntries exceeds the guest registry bound');
  }

  const brand = Object.create(null);
  // Newest registered cell first, matching the WGSL prepend.
  const registryList = [];
  const registryIndex = new Map();
  const cells = [];
  let nextId = initialNextId;
  let issued = 0;

  function allocId() {
    // 0 means the u32 space is exhausted. Do not wrap to 1.
    if (nextId === 0 || nextId > maxUnique) {
      throwResourceLimit('symbol identity space exhausted');
    }
    const id = nextId;
    issued += 1;
    if (id === MAX_UNIQUE_SYMBOL_ID) nextId = 0;
    else nextId = id + 1;
    return id;
  }

  function checkUnits(text) {
    if (text.length > MAX_DESCRIPTION_UNITS) {
      throwResourceLimit('GPU string limit: 256 UTF-16 code units');
    }
  }

  function makeCell(description, registryKey) {
    const uniqueIdentity = allocId();
    const cell = { uniqueIdentity, description, registryKey };
    Object.defineProperty(cell, 'tag', { value: SYMBOL_VALUE_TAG, enumerable: true });
    Object.defineProperty(cell, 'brand', { value: brand });
    Object.freeze(cell);
    liveCells.add(cell);
    cells.push(cell);
    return cell;
  }

  // description is a string, or null when the caller already converted undefined.
  function createSymbol(description) {
    if (description !== null && typeof description !== 'string') {
      throwTypeError('Symbol description must be a string or null');
    }
    if (typeof description === 'string') checkUnits(description);
    return makeCell(description, null);
  }

  // keyString is the registry key after ToString. Canonical per key.
  function symbolFor(keyString) {
    if (typeof keyString !== 'string') throwTypeError('Symbol.for key must be a string');
    checkUnits(keyString);
    const existing = registryIndex.get(keyString);
    if (existing) return existing;
    if (registryList.length >= maxRegistry) {
      throwResourceLimit('symbol registry capacity exhausted');
    }
    // Description of a registered symbol is the key, including the empty string.
    const cell = makeCell(keyString, keyString);
    registryIndex.set(keyString, cell);
    registryList.unshift(cell);
    return cell;
  }

  function inspect() {
    return {
      nextIdentity: nextId,
      issued,
      registrySize: registryList.length,
      registryKeys: registryList.map(cell => cell.registryKey),
      identities: cells.map(cell => cell.uniqueIdentity),
      maxUniqueSymbols: maxUnique,
      maxRegistryEntries: maxRegistry,
      liveCells: cells.length,
    };
  }

  return Object.freeze({
    createSymbol,
    symbolFor,
    symbolKeyFor,
    sameValueSymbols,
    typeofSymbol,
    symbolDescriptiveString,
    assertCallableAsConstructor,
    symbolPrimitiveValue,
    inspect,
    limits: Object.freeze({
      maxUniqueSymbols: maxUnique,
      maxRegistryEntries: maxRegistry,
      maxDescriptionUnits: MAX_DESCRIPTION_UNITS,
    }),
  });
}

// null means the spec undefined result. The empty string is a real key.
export function symbolKeyFor(cell) {
  if (!isSymbolCell(cell)) throwTypeError('not a symbol');
  return cell.registryKey;
}

// SameValue and SameValueZero for symbols are both identity, not description.
export function sameValueSymbols(a, b) {
  if (!isSymbolCell(a) || !isSymbolCell(b)) return false;
  return a.uniqueIdentity !== 0 && a.uniqueIdentity === b.uniqueIdentity && a.brand === b.brand;
}

export function typeofSymbol(cell) {
  if (!isSymbolCell(cell)) throwTypeError('not a symbol');
  return 'symbol';
}

// ECMAScript SymbolDescriptiveString. No JSON escaping.
// Absent and empty descriptions both produce "Symbol()".
export function symbolDescriptiveString(cell) {
  if (!isSymbolCell(cell)) throwTypeError('not a symbol');
  const desc = cell.description === null ? '' : cell.description;
  if (desc.length + 8 > MAX_DESCRIPTION_UNITS) {
    throwResourceLimit('GPU string limit: 256 UTF-16 code units');
  }
  return 'Symbol(' + desc + ')';
}

export function assertCallableAsConstructor() {
  throwTypeError('Symbol is not a constructor');
}

// @@toPrimitive hook. Well-known symbols are not installed here.
export function symbolPrimitiveValue(cell) {
  if (!isSymbolCell(cell)) throwTypeError('not a symbol');
  return cell;
}

let defaultRealm = createSymbolRealm();

export function resetSymbolRealm(options) {
  defaultRealm = createSymbolRealm(options);
  return defaultRealm;
}

export function createSymbol(description) {
  return defaultRealm.createSymbol(description);
}

export function symbolFor(keyString) {
  return defaultRealm.symbolFor(keyString);
}
