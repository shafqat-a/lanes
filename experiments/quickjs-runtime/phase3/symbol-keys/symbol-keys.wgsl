// Symbol-key property fragment. NOT spliced into shader.js.
// Paste the functions next to keyOf / ownKeys / forInKeys. No second @compute.
// No recursion. Every loop is capped by SYM_PROPS or SYM_OBJECTS.
//
// INTEGRATION_GAPS
// 1. Live storage is states[l].heap: Node { value: V, next, key: u32, kind, marked }
//    (shader.js struct Node). This fragment uses sym_objects / sym_props /
//    sym_out_* at @group(1) because Node.key is one u32 and Node has no created
//    field. Drop these bindings when integrating; do not add a second heap.
// 2. Inline key, sidecar unused. SYMBOL_KEY_SIDECAR_KIND 20 is never allocated.
//    uniqueIdentity does not fit in Node.key: it is a full u32, bit 31 is the
//    integer-index tag, and 0xC0000000|id aliases indices >= 2^30
//    (n|0x80000000 for n>=0x40000000). Bit 30 tags dynamic strings
//    (heapId|0x40000000, heapId < L.heap). The free pattern is bit 29 inside
//    that subspace, and it holds the kind-17 CELL NODE (symbol_value V.x),
//    not uniqueIdentity:
//      packed = 0x60000000 | cellNode
//      cellNode = packed & 0x1fffffff, must be in 1..L.heap-1 and kind 17
//      uniqueIdentity = states[l].heap[cellNode].value.x, must be != 0
//    SameValue compares that id, never description text and never the node
//    index alone. Well-known ids 31..45 equal their node ids only for those
//    cells (protocols worker). Ordinary cells do not.
// 3. keyOf (shader.js) must, before status 6: if value.z==17 and value.x!=0
//    and heap[value.x].kind==17, return pack(value.x). Id 0 is invalid.
// 4. arrayIndex must return 0xffffffff for a packed symbol key before keyText.
//    sameKey must return false when the tags differ and compare uniqueIdentity
//    when both are symbols, before textEqual. keyName / unsignedText must not
//    run on a symbol key (that prints a decimal and sorts it with indices).
// 5. ownKeys (shader.js fn ownKeys, dispatch id 140 / 710 / 716, and phase-4
//    builtin 1240 which calls ownKeys(..., false)) shares one boolean.
//    1240 and 140 with enumerableOnly false must append symbols after strings.
//    710 getOwnPropertyNames and 716 Object.keys and 140 with enumerableOnly
//    true (JSON.stringify) must stay string-only. forInKeys (builtin 1353)
//    must skip symbol keys even when marked enumerable. Do not route for-in
//    through 1240.
// 6. created is explicit here. Live list order is the same metadata if define
//    and set leave an existing node in place and delete only unlinks it
//    (descriptor and putProperty already do). That list lives in guest heap
//    and survives resumption. Do not rebuild it on the host.
// 7. GC: collect must mark(l, cellNode) for a packed symbol key, and markValue
//    still marks a tag-17 property value. symbol_mark_value in the identity
//    fragment marks V.x when z==17. Kind 3 already marks node.value. Both the
//    cell and the value stay rooted. Kind 20 is not a root.
// 8. Output layout of own_property_keys_out: keys [0, string_count) then
//    [string_count, string_count+symbol_count). Integer indices occupy the
//    front of the string region, ascending. Other strings and symbols are
//    oldest-first (the prop list is newest-first, same as shader alloc).
//    Integer payload is the numeric index. Other string payload is the caller's
//    string token. Symbol payload is uniqueIdentity.
// 9. Accessors (kind 9) are not written. Caller reports status 6.
// 10. Parent mutation is sym_objects[obj].parent only. It does not rewrite head,
//    so symbol keys on the child survive. No fixed node is claimed.
// 11. Identity fragment gap 9 says symbol keys are kind 20. That is stale.
//    This worker owns kind 20 and leaves it unused.

const SYM_OBJECTS: u32 = 32u;
const SYM_PROPS: u32 = 128u;
const SYM_OUT: u32 = 128u;
const SYM_NONE: u32 = 0xffffffffu;
const SYM_KEY_STRING: u32 = 1u;
const SYM_KEY_SYMBOL: u32 = 2u;
const SYM_PACK: u32 = 0x60000000u;
const SYM_PACK_MASK: u32 = 0xe0000000u;
const SYM_PACK_PAYLOAD: u32 = 0x1fffffffu;
const SYMBOL_KEY_SIDECAR_KIND: u32 = 20u; // unused

alias V = vec4<u32>;

struct SymObject {
  parent: u32,
  head: u32,
  clock: u32,
  extensible: u32,
}

struct SymProp {
  value: V,
  next: u32,
  key_tag: u32,
  key_payload: u32,
  index_value: u32,
  created: u32,
  kind: u32,
  marked: u32,
  cell_node: u32,
  pad: u32,
}

struct SymControl {
  free_head: u32,
  status: u32,
  string_count: u32,
  symbol_count: u32,
}

@group(1) @binding(0) var<storage, read_write> sym_control: SymControl;
@group(1) @binding(1) var<storage, read_write> sym_objects: array<SymObject, SYM_OBJECTS>;
@group(1) @binding(2) var<storage, read_write> sym_props: array<SymProp, SYM_PROPS>;
@group(1) @binding(3) var<storage, read_write> sym_out_tag: array<u32, SYM_OUT>;
@group(1) @binding(4) var<storage, read_write> sym_out_payload: array<u32, SYM_OUT>;

fn sym_undef() -> V { return V(0u, 0x7ff80000u, 3u, 0u); }

fn pack_symbol_cell_key(cell_node: u32) -> u32 {
  if (cell_node == 0u || cell_node > SYM_PACK_PAYLOAD) { return 0u; }
  return SYM_PACK | cell_node;
}

fn is_packed_symbol_key(key: u32) -> bool {
  return (key & SYM_PACK_MASK) == SYM_PACK && (key & SYM_PACK_PAYLOAD) != 0u;
}

fn packed_symbol_cell_node(key: u32) -> u32 {
  if (!is_packed_symbol_key(key)) { return 0u; }
  return key & SYM_PACK_PAYLOAD;
}

fn sym_writable(marked: u32) -> bool { return (marked & 2u) != 0u; }
fn sym_enumerable(marked: u32) -> bool { return (marked & 4u) != 0u; }
fn sym_configurable(marked: u32) -> bool { return (marked & 8u) != 0u; }

fn sym_keys_init() {
  sym_control.free_head = 0u;
  sym_control.status = 0u;
  sym_control.string_count = 0u;
  sym_control.symbol_count = 0u;
  for (var i = 0u; i < SYM_PROPS; i++) {
    sym_props[i].next = i + 1u;
    sym_props[i].key_tag = 0u;
    sym_props[i].key_payload = 0u;
    sym_props[i].index_value = SYM_NONE;
    sym_props[i].kind = 0u;
    sym_props[i].marked = 0u;
    sym_props[i].created = 0u;
    sym_props[i].cell_node = 0u;
    sym_props[i].value = sym_undef();
  }
  sym_props[SYM_PROPS - 1u].next = SYM_NONE;
  for (var o = 0u; o < SYM_OBJECTS; o++) {
    sym_objects[o].parent = SYM_NONE;
    sym_objects[o].head = SYM_NONE;
    sym_objects[o].clock = 0u;
    sym_objects[o].extensible = 1u;
  }
}

fn sym_find(obj: u32, tag: u32, payload: u32) -> u32 {
  if (obj >= SYM_OBJECTS) { return SYM_NONE; }
  var id = sym_objects[obj].head;
  for (var n = 0u; n < SYM_PROPS && id != SYM_NONE; n++) {
    if (id >= SYM_PROPS) { return SYM_NONE; }
    if (sym_props[id].kind == 3u && sym_props[id].key_tag == tag && sym_props[id].key_payload == payload) {
      return id;
    }
    id = sym_props[id].next;
  }
  return SYM_NONE;
}

// Class 0 integer index, 1 other string, 2 symbol. Negative means a is first.
fn key_order(a: u32, b: u32) -> i32 {
  if (a >= SYM_PROPS || b >= SYM_PROPS) { return 0; }
  let A = sym_props[a];
  let B = sym_props[b];
  var class_a: u32 = 1u;
  var class_b: u32 = 1u;
  if (A.key_tag == SYM_KEY_SYMBOL) { class_a = 2u; }
  else if (A.index_value != SYM_NONE) { class_a = 0u; }
  if (B.key_tag == SYM_KEY_SYMBOL) { class_b = 2u; }
  else if (B.index_value != SYM_NONE) { class_b = 0u; }
  if (class_a != class_b) {
    if (class_a < class_b) { return -1; }
    return 1;
  }
  if (class_a == 0u) {
    if (A.index_value < B.index_value) { return -1; }
    if (A.index_value > B.index_value) { return 1; }
    return 0;
  }
  if (A.created < B.created) { return -1; }
  if (A.created > B.created) { return 1; }
  return 0;
}

fn sym_alloc(value: V, tag: u32, payload: u32, index_value: u32, created: u32, marked: u32, cell_node: u32, next: u32) -> u32 {
  let id = sym_control.free_head;
  if (id == SYM_NONE || id >= SYM_PROPS) {
    sym_control.status = 3u;
    return SYM_NONE;
  }
  sym_control.free_head = sym_props[id].next;
  sym_props[id].value = value;
  sym_props[id].next = next;
  sym_props[id].key_tag = tag;
  sym_props[id].key_payload = payload;
  sym_props[id].index_value = index_value;
  sym_props[id].created = created;
  sym_props[id].kind = 3u;
  sym_props[id].marked = marked;
  sym_props[id].cell_node = cell_node;
  return id;
}

// Create or update in place. flags is writable|enumerable|configurable (1|2|4),
// stored as flags<<1 in marked, matching shader.js descriptor().
// Symbol payload is uniqueIdentity. index_value is ignored for symbols.
fn sym_define(obj: u32, tag: u32, payload: u32, index_value: u32, value: V, flags: u32, cell_node: u32) -> u32 {
  if (obj >= SYM_OBJECTS || (tag != SYM_KEY_STRING && tag != SYM_KEY_SYMBOL)) {
    sym_control.status = 4u;
    return SYM_NONE;
  }
  var stored_index = index_value;
  var stored_payload = payload;
  var stored_cell = cell_node;
  if (tag == SYM_KEY_SYMBOL) {
    if (payload == 0u) { sym_control.status = 4u; return SYM_NONE; }
    stored_index = SYM_NONE;
    if (stored_cell != 0u && pack_symbol_cell_key(stored_cell) == 0u) {
      sym_control.status = 4u;
      return SYM_NONE;
    }
  } else if (stored_index != SYM_NONE && stored_index > 4294967294u) {
    sym_control.status = 4u;
    return SYM_NONE;
  }
  let existing = sym_find(obj, tag, stored_payload);
  let marked = (flags & 7u) << 1u;
  if (existing != SYM_NONE) {
    sym_props[existing].value = value;
    sym_props[existing].marked = marked;
    if (tag == SYM_KEY_STRING) { sym_props[existing].index_value = stored_index; }
    if (stored_cell != 0u) { sym_props[existing].cell_node = stored_cell; }
    return existing;
  }
  if (sym_objects[obj].extensible == 0u) { return SYM_NONE; }
  let created = sym_objects[obj].clock;
  sym_objects[obj].clock = created + 1u;
  let id = sym_alloc(value, tag, stored_payload, stored_index, created, marked, stored_cell, sym_objects[obj].head);
  if (id == SYM_NONE) { return SYM_NONE; }
  sym_objects[obj].head = id;
  return id;
}

fn sym_take(node: SymProp, enumerable_only: u32) -> bool {
  if (node.kind != 3u) { return false; }
  if (enumerable_only != 0u && !sym_enumerable(node.marked)) { return false; }
  return node.key_tag == SYM_KEY_STRING || node.key_tag == SYM_KEY_SYMBOL;
}

// Strings region then symbols region. include_symbols 0 is getOwnPropertyNames
// / Object.keys / for-in shape. 1240 passes include_symbols 1 and
// enumerable_only 0.
fn own_property_keys_out(obj: u32, include_symbols: u32, enumerable_only: u32) {
  sym_control.string_count = 0u;
  sym_control.symbol_count = 0u;
  if (obj >= SYM_OBJECTS) { sym_control.status = 4u; return; }
  var indexes = 0u;
  var named = 0u;
  var symbols = 0u;
  var current = sym_objects[obj].head;
  for (var n = 0u; n < SYM_PROPS && current != SYM_NONE; n++) {
    if (current >= SYM_PROPS) { sym_control.status = 3u; return; }
    let node = sym_props[current];
    if (sym_take(node, enumerable_only)) {
      if (node.key_tag == SYM_KEY_SYMBOL) {
        if (include_symbols != 0u) { symbols++; }
      } else if (node.index_value != SYM_NONE) { indexes++; }
      else { named++; }
    }
    current = node.next;
  }
  let string_count = indexes + named;
  if (string_count + symbols > SYM_OUT) { sym_control.status = 3u; return; }
  var next_name = string_count;
  current = sym_objects[obj].head;
  for (var n = 0u; n < SYM_PROPS && current != SYM_NONE; n++) {
    if (current >= SYM_PROPS) { sym_control.status = 3u; return; }
    let node = sym_props[current];
    if (sym_take(node, enumerable_only) && node.key_tag == SYM_KEY_STRING && node.index_value == SYM_NONE) {
      next_name--;
      sym_out_tag[next_name] = SYM_KEY_STRING;
      sym_out_payload[next_name] = node.key_payload;
    }
    current = node.next;
  }
  var minimum = 0u;
  for (var i = 0u; i < indexes; i++) {
    var found = SYM_NONE;
    var found_payload = 0u;
    current = sym_objects[obj].head;
    for (var n = 0u; n < SYM_PROPS && current != SYM_NONE; n++) {
      if (current >= SYM_PROPS) { sym_control.status = 3u; return; }
      let node = sym_props[current];
      if (sym_take(node, enumerable_only) && node.key_tag == SYM_KEY_STRING && node.index_value != SYM_NONE && node.index_value >= minimum && node.index_value < found) {
        found = node.index_value;
        found_payload = node.key_payload;
      }
      current = node.next;
    }
    if (found == SYM_NONE) { sym_control.status = 6u; return; }
    sym_out_tag[i] = SYM_KEY_STRING;
    sym_out_payload[i] = found_payload;
    if (found == 4294967294u) { minimum = SYM_NONE; } else { minimum = found + 1u; }
  }
  if (include_symbols != 0u) {
    var next_sym = string_count + symbols;
    current = sym_objects[obj].head;
    for (var n = 0u; n < SYM_PROPS && current != SYM_NONE; n++) {
      if (current >= SYM_PROPS) { sym_control.status = 3u; return; }
      let node = sym_props[current];
      if (sym_take(node, enumerable_only) && node.key_tag == SYM_KEY_SYMBOL) {
        next_sym--;
        sym_out_tag[next_sym] = SYM_KEY_SYMBOL;
        sym_out_payload[next_sym] = node.key_payload;
      }
      current = node.next;
    }
  }
  sym_control.string_count = string_count;
  if (include_symbols != 0u) { sym_control.symbol_count = symbols; }
}

fn symbol_get(obj: u32, id: u32) -> V {
  if (id == 0u || obj >= SYM_OBJECTS) { sym_control.status = 4u; return sym_undef(); }
  var current = obj;
  for (var depth = 0u; depth < SYM_OBJECTS && current != SYM_NONE; depth++) {
    if (current >= SYM_OBJECTS) { sym_control.status = 4u; return sym_undef(); }
    let found = sym_find(current, SYM_KEY_SYMBOL, id);
    if (found != SYM_NONE) { return sym_props[found].value; }
    current = sym_objects[current].parent;
  }
  return sym_undef();
}

fn symbol_has(obj: u32, id: u32) -> u32 {
  if (id == 0u || obj >= SYM_OBJECTS) { sym_control.status = 4u; return 0u; }
  var current = obj;
  for (var depth = 0u; depth < SYM_OBJECTS && current != SYM_NONE; depth++) {
    if (current >= SYM_OBJECTS) { sym_control.status = 4u; return 0u; }
    if (sym_find(current, SYM_KEY_SYMBOL, id) != SYM_NONE) { return 1u; }
    current = sym_objects[current].parent;
  }
  return 0u;
}

fn symbol_set(obj: u32, id: u32, value: V) -> u32 {
  if (id == 0u || obj >= SYM_OBJECTS) { sym_control.status = 4u; return 0u; }
  let own = sym_find(obj, SYM_KEY_SYMBOL, id);
  if (own != SYM_NONE) {
    if (!sym_writable(sym_props[own].marked)) { return 0u; }
    sym_props[own].value = value;
    return 1u;
  }
  var current = sym_objects[obj].parent;
  for (var depth = 0u; depth < SYM_OBJECTS && current != SYM_NONE; depth++) {
    if (current >= SYM_OBJECTS) { sym_control.status = 4u; return 0u; }
    let found = sym_find(current, SYM_KEY_SYMBOL, id);
    if (found != SYM_NONE) {
      if (!sym_writable(sym_props[found].marked)) { return 0u; }
      break;
    }
    current = sym_objects[current].parent;
  }
  if (sym_objects[obj].extensible == 0u) { return 0u; }
  let id_node = sym_define(obj, SYM_KEY_SYMBOL, id, SYM_NONE, value, 7u, 0u);
  if (id_node == SYM_NONE) { return 0u; }
  return 1u;
}

fn symbol_delete(obj: u32, id: u32) -> u32 {
  if (id == 0u || obj >= SYM_OBJECTS) { sym_control.status = 4u; return 0u; }
  var previous = SYM_NONE;
  var current = sym_objects[obj].head;
  for (var n = 0u; n < SYM_PROPS && current != SYM_NONE; n++) {
    if (current >= SYM_PROPS) { sym_control.status = 3u; return 0u; }
    if (sym_props[current].kind == 3u && sym_props[current].key_tag == SYM_KEY_SYMBOL && sym_props[current].key_payload == id) {
      if (!sym_configurable(sym_props[current].marked)) { return 0u; }
      let next = sym_props[current].next;
      if (previous == SYM_NONE) { sym_objects[obj].head = next; }
      else { sym_props[previous].next = next; }
      sym_props[current].kind = 0u;
      sym_props[current].key_tag = 0u;
      sym_props[current].key_payload = 0u;
      sym_props[current].cell_node = 0u;
      sym_props[current].next = sym_control.free_head;
      sym_control.free_head = current;
      return 1u;
    }
    previous = current;
    current = sym_props[current].next;
  }
  return 1u;
}
