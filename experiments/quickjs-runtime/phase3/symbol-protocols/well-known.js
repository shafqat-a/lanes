// Well-known symbols (ES2025), host model. Does not call host Symbol.
//
// Seam — assignment 1 (symbol identity), duplicated so this module runs alone:
//   A symbol cell is { tag: "symbol", uniqueIdentity: integer >= 1,
//   description: string|null, registryKey: string|null }.
//   sameSymbolValue compares uniqueIdentity only.
//   Well-known cells use registryKey null. symbolKeyFor returns undefined.
//   They are not registry keys. uniqueIdentity is the fixed node id (31..45).
//   Assignment 1 must not mint those identities for Symbol() or Symbol.for.
//
// Seam — assignment 2 (symbol keys), duplicated locally:
//   A property key is { kind: "string", value } or { kind: "symbol", id }
//   where id is uniqueIdentity. OwnPropertyKeys order is integer indices,
//   then strings, then symbols. @@toStringTag and @@iterator are symbol keys.

export const TAG_SYMBOL = 17;
export const TAG_BIGINT = 18;

// Heap kind 21 is free in shader.js (kinds 0..16 are used; 17..20 and 22..23
// are other phase-3 reservations). One table node, not one kind per cell.
export const HEAP_KIND_WELL_KNOWN_TABLE = 21;
export const WELL_KNOWN_TABLE_NODE = 46;

// Occupied fixed nodes. 23..25 stay. 26..30 belong to other workers.
export const FIXED_NODE = Object.freeze({
  math: 23,
  numberConstructor: 24,
  json: 25,
  symbolConstructor: 26,
  symbolPrototype: 27,
  symbolRegistry: 28,
  bigIntConstructor: 29,
  bigIntPrototype: 30,
  wellKnownFirst: 31,
  wellKnownLast: 45,
  wellKnownTable: WELL_KNOWN_TABLE_NODE,
});

// Pinned QuickJS (vendor/quickjs-atom.h) has no dispose / asyncDispose atoms.
// Cells still exist. Symbol.metadata is intentionally absent (not ES2025).
export const WELL_KNOWN_NAMES = Object.freeze([
  "asyncIterator",
  "hasInstance",
  "isConcatSpreadable",
  "iterator",
  "match",
  "matchAll",
  "replace",
  "search",
  "species",
  "split",
  "toPrimitive",
  "toStringTag",
  "unscopables",
  "dispose",
  "asyncDispose",
]);

export const WELL_KNOWN = Object.freeze(Object.fromEntries(
  WELL_KNOWN_NAMES.map(name => [name, name]),
));

const FIRST_NODE = FIXED_NODE.wellKnownFirst;

export const WELL_KNOWN_ID = Object.freeze(Object.fromEntries(
  WELL_KNOWN_NAMES.map((name, index) => [name, FIRST_NODE + index]),
));

// Builtin ids 1100..1149. 334 is the existing Array.prototype.values id
// (arrayBuiltins index 34, base 300), reused as Array.prototype[@@iterator].
export const PROTOCOL_BUILTINS = Object.freeze({
  symbolToPrimitive: 1100,
  functionHasInstance: 1101,
  arraySpeciesGetter: 1102,
  stringIterator: 1103,
});

export const ARRAY_VALUES_BUILTIN_ID = 334;

export const DISPATCH = Object.freeze({
  asyncIterator: "defined but not yet dispatched",
  hasInstance: "defined but not yet dispatched",
  isConcatSpreadable: "defined but not yet dispatched",
  iterator: "algorithm implemented; engine dispatch is parent wiring (opcodes 1273 and 1270)",
  match: "defined but not yet dispatched",
  matchAll: "defined but not yet dispatched",
  replace: "defined but not yet dispatched",
  search: "defined but not yet dispatched",
  species: "defined but not yet dispatched",
  split: "defined but not yet dispatched",
  toPrimitive: "algorithm implemented; engine dispatch is parent wiring (__lanesPrimitive 129)",
  toStringTag: "algorithm implemented; engine dispatch is parent wiring (objectMethod id 155)",
  unscopables: "defined but not yet dispatched",
  dispose: "defined but not yet dispatched",
  asyncDispose: "defined but not yet dispatched",
});

export function isSymbolCell(value) {
  return !!value
    && value.tag === "symbol"
    && Number.isInteger(value.uniqueIdentity)
    && value.uniqueIdentity >= 1
    && (value.description === null || typeof value.description === "string")
    && (value.registryKey === null || typeof value.registryKey === "string");
}

export function sameSymbolValue(left, right) {
  return isSymbolCell(left) && isSymbolCell(right) && left.uniqueIdentity === right.uniqueIdentity;
}

// Symbol.keyFor equivalent. Undefined when registryKey is null.
export function symbolKeyFor(cell) {
  if (!isSymbolCell(cell)) throw new TypeError("Symbol.keyFor requires a symbol");
  return cell.registryKey === null ? undefined : cell.registryKey;
}

export function stringPropertyKey(value) {
  if (typeof value !== "string") throw new TypeError("Property key is not a string");
  return Object.freeze({ kind: "string", value });
}

export function symbolPropertyKey(id) {
  if (!Number.isInteger(id) || id < 1) throw new TypeError("Property key is not a symbol");
  return Object.freeze({ kind: "symbol", id });
}

export function isPropertyKey(key) {
  if (!key) return false;
  if (key.kind === "string") return typeof key.value === "string";
  if (key.kind === "symbol") return Number.isInteger(key.id) && key.id >= 1;
  return false;
}

function cellFor(name, index) {
  const uniqueIdentity = FIRST_NODE + index;
  return Object.freeze({
    tag: "symbol",
    uniqueIdentity,
    nodeId: uniqueIdentity,
    localId: index + 1,
    name,
    description: `Symbol.${name}`,
    registryKey: null,
    dispatch: DISPATCH[name],
  });
}

// Frozen table: cells, name -> cell, uniqueIdentity -> cell, node assignment.
export function createWellKnownTable() {
  const cells = WELL_KNOWN_NAMES.map(cellFor);
  const byName = Object.create(null);
  const byId = Object.create(null);
  const fixedNodes = Object.create(null);
  for (const cell of cells) {
    byName[cell.name] = cell;
    byId[cell.uniqueIdentity] = cell;
    fixedNodes[cell.name] = cell.nodeId;
  }
  return Object.freeze({
    cells: Object.freeze(cells),
    byName: Object.freeze(byName),
    byId: Object.freeze(byId),
    fixedNodes: Object.freeze(fixedNodes),
    tableNode: WELL_KNOWN_TABLE_NODE,
    heapKind: HEAP_KIND_WELL_KNOWN_TABLE,
  });
}
