// Symbol-protocol WGSL fragment. Paste into shader.js after struct Node / State.
// Bounds: every heap index is checked against heapLimit (LIMITS.heap is 2048).
// No recursion. Loops are capped by heapLimit.
//
// INTEGRATION_GAPS:
// - Symbol property-key bits are assignment 2. Callers pass the encoded u32
//   as symbolKey. This fragment does not invent a key encoding.
// - Tag 17 (symbol) and tag 18 (bigint) are consumed, not allocated here.
// - Heap kind 21 is the well-known table node (46), a GC root. Cells are
//   fixed nodes 31..45 and must also be GC roots. collect() currently marks
//   only root<=25u. Extending that loop before nodes 26..46 exist would pin
//   free-list slots; allocate the fixed nodes first.
// - objectView is not applied here. Walk kind 2/7/8/14/16 only. Closures
//   (kind 5) and builtin ids (tag 11) must be viewed before the walk.
// - A found accessor (kind 9) is returned, not called. value.x may include
//   the 0x80000000 builtin bit from callbackId (shader.js). Mask before compare.
// - iterationKind (1273) must follow ITERATION_KIND_RULE in
//   iterator-protocol.js. Kind 1/2 only when methodId is 334 or 1103 and the
//   brand matches. This loader does not return those kinds.
// - objectMethod id 155 must stop special-casing nodes 23 and 25 once
//   @@toStringTag data properties are installed (mathAndJsonTags).

const WK_ASYNC_ITERATOR: u32 = 31u;
const WK_HAS_INSTANCE: u32 = 32u;
const WK_IS_CONCAT_SPREADABLE: u32 = 33u;
const WK_ITERATOR: u32 = 34u;
const WK_MATCH: u32 = 35u;
const WK_MATCH_ALL: u32 = 36u;
const WK_REPLACE: u32 = 37u;
const WK_SEARCH: u32 = 38u;
const WK_SPECIES: u32 = 39u;
const WK_SPLIT: u32 = 40u;
const WK_TO_PRIMITIVE: u32 = 41u;
const WK_TO_STRING_TAG: u32 = 42u;
const WK_UNSCOPABLES: u32 = 43u;
const WK_DISPOSE: u32 = 44u;
const WK_ASYNC_DISPOSE: u32 = 45u;
const WK_TABLE: u32 = 46u;
const HEAP_KIND_WELL_KNOWN_TABLE: u32 = 21u;
const TAG_SYMBOL: u32 = 17u;
const TAG_BIGINT: u32 = 18u;
const BUILTIN_SYMBOL_TO_PRIMITIVE: u32 = 1100u;
const BUILTIN_FUNCTION_HAS_INSTANCE: u32 = 1101u;
const BUILTIN_ARRAY_SPECIES: u32 = 1102u;
const BUILTIN_STRING_ITERATOR: u32 = 1103u;
const BUILTIN_ARRAY_VALUES: u32 = 334u;
const NODE_MATH: u32 = 23u;
const NODE_JSON: u32 = 25u;

fn isWellKnownNode(node: u32) -> bool {
  return node >= 31u && node <= 45u;
}

fn wellKnownTableLive(l: u32, heapLimit: u32) -> bool {
  if (WK_TABLE == 0u || WK_TABLE >= heapLimit) { return false; }
  return states[l].heap[WK_TABLE].kind == HEAP_KIND_WELL_KNOWN_TABLE;
}

fn symbolProtocolPrototype(l: u32, node: u32, heapLimit: u32) -> u32 {
  if (node == 0u || node >= heapLimit) { return 0u; }
  let kind = states[l].heap[node].kind;
  let walks = kind == 2u || kind == 7u || kind == 8u || kind == 14u || kind == 16u;
  if (!walks) { return 0u; }
  let proto = states[l].heap[node].value.x;
  if (proto >= heapLimit) { return 0u; }
  return proto;
}

// Property node id, or 0 when the symbol key is absent. Accessor or data.
fn findSymbolProperty(l: u32, start: u32, symbolKey: u32, heapLimit: u32) -> u32 {
  if (heapLimit == 0u || start == 0u || start >= heapLimit) { return 0u; }
  var current = start;
  for (var depth = 0u; depth < heapLimit; depth = depth + 1u) {
    if (current == 0u || current >= heapLimit) { return 0u; }
    var prop = states[l].heap[current].next;
    for (var n = 0u; n < heapLimit; n = n + 1u) {
      if (prop == 0u || prop >= heapLimit) { break; }
      if (states[l].heap[prop].key == symbolKey) { return prop; }
      let nextProp = states[l].heap[prop].next;
      if (nextProp == prop) { break; }
      prop = nextProp;
    }
    let proto = symbolProtocolPrototype(l, current, heapLimit);
    if (proto == 0u || proto == current) { return 0u; }
    current = proto;
  }
  return 0u;
}

struct SymbolProtocolTagLookup {
  found: u32,
  property: u32,
  accessor: u32,
}

// @@toStringTag lookup. found 0 means use the builtin brand. A string value
// (tag 7) on a data property wins over that brand; the caller formats it.
fn lookupToStringTag(l: u32, start: u32, toStringTagKey: u32, heapLimit: u32) -> SymbolProtocolTagLookup {
  let prop = findSymbolProperty(l, start, toStringTagKey, heapLimit);
  if (prop == 0u || prop >= heapLimit) { return SymbolProtocolTagLookup(0u, 0u, 0u); }
  let accessor = select(0u, 1u, states[l].heap[prop].kind == 9u);
  return SymbolProtocolTagLookup(1u, prop, accessor);
}

struct SymbolProtocolIteratorMethod {
  found: u32,
  methodId: u32,
  tag: u32,
}

// Loads the @@iterator method id. found 0 -> TypeError (missing).
// tag 11 is a builtin id (334 or 1103 may fast-path). tag 5 is a closure.
// Any other tag is a non-callable TypeError. Does not call the method.
fn loadIteratorMethod(l: u32, start: u32, iteratorKey: u32, heapLimit: u32) -> SymbolProtocolIteratorMethod {
  let prop = findSymbolProperty(l, start, iteratorKey, heapLimit);
  if (prop == 0u || prop >= heapLimit) { return SymbolProtocolIteratorMethod(0u, 0u, 0u); }
  if (states[l].heap[prop].kind == 9u) {
    let getter = states[l].heap[prop].value.x;
    return SymbolProtocolIteratorMethod(1u, getter, 11u);
  }
  let value = states[l].heap[prop].value;
  return SymbolProtocolIteratorMethod(1u, value.x, value.z);
}
