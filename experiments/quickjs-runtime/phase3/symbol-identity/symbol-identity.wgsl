// Symbol identity fragment. NOT spliced into shader.js.
// Paste the functions before main(). Do not add another compute entry point.
//
// INTEGRATION_GAPS
// 1. Expects the surrounding shader: alias V, struct Node, states[l].heap,
//    alloc, mark, unit, makeText, undef, and status codes 3 (resource),
//    4 (TypeError), 6 (Unsupported). Bindings stay @group(0) @binding(0..4);
//    this fragment adds no buffer.
// 2. SymbolCell is a logical view of a kind-17 Node, not a second allocation
//    array. Node.value is V(id, desc, registry_key, flags). Node.next is the
//    newer-to-older registry link. Node.key is unused (0).
// 3. desc and registry_key are kind-10 heap heads. Node.key of that head is
//    the UTF-16 length, the same convention makeText writes. 0 means absent.
//    An empty description still allocates a length-0 kind-10 node so it is not
//    confused with absent. Image strings (V.w != 0) are copied onto the heap
//    before they are stored. The registry does not point at the read-only image.
// 4. Fixed nodes: constructor 26 (kind 2), prototype 27 (kind 2), registry 28
//    (kind 18). Current init allocates kind-13 holders in slots 26, 27 and 28
//    immediately after jsonObject (node 25). Insert the three symbol allocs
//    before those holders. Nothing in shader.js hardcodes 26/27/28. Extend
//    `for(var root=1u;root<=25u;root++)` to `root<=28u`.
// 5. equal() returns true for any matching tag that is not a number, a string,
//    or an object/function id. Call symbol_same_value before that `return true`
//    or distinct tag-17 values compare equal. sameValue delegates to equal.
//    SameValueZero is not modified; for symbols it is the same identity test.
// 6. markValue must call symbol_mark_value. collect must call symbol_mark_cell
//    for kinds 17 and 18. node.next is already marked for every node, so the
//    registry list and kind-10 chains stay live once the head is marked.
//    Description strings are not marked unless symbol_mark_cell runs.
// 7. typeof indexes a 6-string table (number, boolean, object, undefined,
//    function, string). Tag 17 must push symbol_typeof(l, v) instead of that
//    table. Do not insert "symbol" in the middle of the table.
// 8. construct() sends an unknown builtin id, including 1000, to status 6.
//    new Symbol must call symbol_construct(l, true, description) so the result
//    is status 4. The status-4 epilogue replaces the message with
//    "Invalid operation"; this fragment does not bypass makeError.
// 9. keyOf sets status 6 for a non-string, non-index key. Symbol property keys
//    are heap kind 20 (another worker). This fragment does not intern keys.
// 10. Arguments that are not already strings (tag 7), or undefined (tag 3) for
//    symbol_construct, set status 6. ToString is a resumable guest step. This
//    fragment does not approximate it and does not read a host symbol table.
// 11. @@toPrimitive and @@toStringTag are not installed. The id-155 toStringTag
//    bridge is unchanged. symbol_primitive_value is the hook for @@toPrimitive.
//    Symbol wrappers are not unwrapped; a non-symbol receiver is status 4.
// 12. Registry capacity is SYMBOL_MAX_REGISTRY_ENTRIES (1024). The identity
//    counter lives in node 28 value.y, starts at 1, and becomes 0 when
//    0xFFFFFFFFu has been issued. 0 is exhausted, not a wrap to 1. Every
//    registry mutation writes guest heap words on node 28 and the cell.
// 13. ownKeys of nodes 26 and 27 would omit well-known symbol properties.
//    Keep those enumerations Unsupported until the protocols worker installs
//    them. Node 28 is not a guest object.

const SYMBOL_VALUE_TAG: u32 = 17u;
const SYMBOL_CELL_KIND: u32 = 17u;
const SYMBOL_REGISTRY_KIND: u32 = 18u;
const SYMBOL_NODE_CONSTRUCTOR: u32 = 26u;
const SYMBOL_NODE_PROTOTYPE: u32 = 27u;
const SYMBOL_NODE_REGISTRY: u32 = 28u;
const SYMBOL_MAX_REGISTRY_ENTRIES: u32 = 1024u;
const SYMBOL_STRING_LIMIT: u32 = 256u;
const SYMBOL_FLAG_HAS_DESCRIPTION: u32 = 1u;
const SYMBOL_FLAG_IN_REGISTRY: u32 = 2u;

struct SymbolCell {
  id: u32,
  desc: u32,
  registry_key: u32,
  flags: u32,
}

fn symbol_cell_from_node(l: u32, node: u32) -> SymbolCell {
  let v = states[l].heap[node].value;
  return SymbolCell(v.x, v.y, v.z, v.w);
}

fn symbol_mark_value(l: u32, v: V) {
  if (v.z == SYMBOL_VALUE_TAG && v.x != 0u) { mark(l, v.x); }
}

fn symbol_mark_cell(l: u32, node: Node) {
  if (node.kind == SYMBOL_CELL_KIND) {
    if (node.value.y != 0u) { mark(l, node.value.y); }
    if (node.value.z != 0u && node.value.z != node.value.y) { mark(l, node.value.z); }
  }
  if (node.kind == SYMBOL_REGISTRY_KIND && node.value.z != 0u) { mark(l, node.value.z); }
}

// Call once, after node 28 has been allocated and before any symbol exists.
// Resets the counter and drops the list head. Not idempotent after use.
fn symbol_init_registry_fields(l: u32) {
  states[l].heap[SYMBOL_NODE_REGISTRY].kind = SYMBOL_REGISTRY_KIND;
  states[l].heap[SYMBOL_NODE_REGISTRY].value = V(0u, 1u, 0u, SYMBOL_MAX_REGISTRY_ENTRIES);
  states[l].heap[SYMBOL_NODE_REGISTRY].next = 0u;
  states[l].heap[SYMBOL_NODE_REGISTRY].key = 0u;
}

fn symbol_stored_unit(l: u32, node: u32, index: u32) -> u32 {
  var id = node;
  let steps = index / 4u;
  for (var i = 0u; i < 64u && i < steps; i++) {
    id = states[l].heap[id].next;
  }
  return states[l].heap[id].value[index % 4u];
}

fn symbol_text_equals_node(l: u32, node: u32, key: V) -> bool {
  if (node == 0u || key.z != 7u) { return false; }
  let length = states[l].heap[node].key;
  if (length != key.y || length > SYMBOL_STRING_LIMIT) { return false; }
  var same = true;
  for (var i = 0u; i < SYMBOL_STRING_LIMIT && i < length && same; i++) {
    same = symbol_stored_unit(l, node, i) == unit(l, key, i);
  }
  return same;
}

// Copy a guest string onto a kind-10 chain the registry can root.
// Empty input still allocates a node so desc 0 remains "absent".
fn symbol_copy_text(l: u32, text: V) -> u32 {
  if (text.z != 7u) { states[l].status = 6u; return 0u; }
  if (text.y > SYMBOL_STRING_LIMIT) { states[l].status = 3u; return 0u; }
  if (text.y == 0u) {
    return alloc(l, 10u, V(0u), 0u, 0u);
  }
  let copied = makeText(l, text, undef(), 0u, text.y);
  if (states[l].status != 0u) { return 0u; }
  return copied.x;
}

fn symbol_alloc_cell(l: u32, desc: u32, registry_key: u32, flags: u32) -> u32 {
  let next_id = states[l].heap[SYMBOL_NODE_REGISTRY].value.y;
  if (next_id == 0u) { states[l].status = 3u; return 0u; }
  let node = alloc(l, SYMBOL_CELL_KIND, V(next_id, desc, registry_key, flags), 0u, 0u);
  if (node == 0u || states[l].status != 0u) { return 0u; }
  if (next_id == 0xffffffffu) {
    states[l].heap[SYMBOL_NODE_REGISTRY].value.y = 0u;
  } else {
    states[l].heap[SYMBOL_NODE_REGISTRY].value.y = next_id + 1u;
  }
  return node;
}

fn symbol_value(node: u32) -> V {
  return V(node, 0u, SYMBOL_VALUE_TAG, 0u);
}

// has_description is false only for an absent description. The string was
// already copied, including the empty-string sentinel node.
fn symbol_create(l: u32, desc: u32, has_description: bool) -> V {
  var flags = 0u;
  var stored = 0u;
  if (has_description) {
    flags = SYMBOL_FLAG_HAS_DESCRIPTION;
    stored = desc;
  }
  let node = symbol_alloc_cell(l, stored, 0u, flags);
  if (node == 0u || states[l].status != 0u) { return undef(); }
  return symbol_value(node);
}

fn symbol_intern_lookup(l: u32, key: V) -> u32 {
  var cursor = states[l].heap[SYMBOL_NODE_REGISTRY].value.z;
  for (var n = 0u; n < SYMBOL_MAX_REGISTRY_ENTRIES && cursor != 0u; n++) {
    let cell = symbol_cell_from_node(l, cursor);
    if ((cell.flags & SYMBOL_FLAG_IN_REGISTRY) != 0u && symbol_text_equals_node(l, cell.registry_key, key)) {
      return cursor;
    }
    cursor = states[l].heap[cursor].next;
  }
  return 0u;
}

fn symbol_construct(l: u32, new_target_defined: bool, description: V) -> V {
  if (new_target_defined) { states[l].status = 4u; return undef(); }
  if (description.z == 3u) { return symbol_create(l, 0u, false); }
  if (description.z != 7u) { states[l].status = 6u; return undef(); }
  let copied = symbol_copy_text(l, description);
  if (states[l].status != 0u || (description.y == 0u && copied == 0u)) { return undef(); }
  return symbol_create(l, copied, true);
}

fn symbol_for(l: u32, key: V) -> V {
  if (key.z != 7u) { states[l].status = 6u; return undef(); }
  if (key.y > SYMBOL_STRING_LIMIT) { states[l].status = 3u; return undef(); }
  let found = symbol_intern_lookup(l, key);
  if (states[l].status != 0u) { return undef(); }
  if (found != 0u) { return symbol_value(found); }
  let count = states[l].heap[SYMBOL_NODE_REGISTRY].value.x;
  if (count >= SYMBOL_MAX_REGISTRY_ENTRIES) { states[l].status = 3u; return undef(); }
  let copied = symbol_copy_text(l, key);
  if (states[l].status != 0u || copied == 0u) { return undef(); }
  let flags = SYMBOL_FLAG_HAS_DESCRIPTION | SYMBOL_FLAG_IN_REGISTRY;
  let node = symbol_alloc_cell(l, copied, copied, flags);
  if (node == 0u || states[l].status != 0u) { return undef(); }
  // Prepend. Guest memory: the cell link and the registry head/count.
  states[l].heap[node].next = states[l].heap[SYMBOL_NODE_REGISTRY].value.z;
  states[l].heap[SYMBOL_NODE_REGISTRY].value.z = node;
  states[l].heap[SYMBOL_NODE_REGISTRY].value.x = count + 1u;
  return symbol_value(node);
}

fn symbol_key_for(l: u32, value: V) -> V {
  if (value.z != SYMBOL_VALUE_TAG || value.x == 0u || states[l].heap[value.x].kind != SYMBOL_CELL_KIND) {
    states[l].status = 4u;
    return undef();
  }
  let cell = symbol_cell_from_node(l, value.x);
  if ((cell.flags & SYMBOL_FLAG_IN_REGISTRY) == 0u || cell.registry_key == 0u) { return undef(); }
  return V(cell.registry_key, states[l].heap[cell.registry_key].key, 7u, 0u);
}

fn symbol_same_value(l: u32, a: V, b: V) -> bool {
  if (a.z != SYMBOL_VALUE_TAG || b.z != SYMBOL_VALUE_TAG || a.x == 0u || b.x == 0u) { return false; }
  if (states[l].heap[a.x].kind != SYMBOL_CELL_KIND || states[l].heap[b.x].kind != SYMBOL_CELL_KIND) { return false; }
  return a.x == b.x && states[l].heap[a.x].value.x == states[l].heap[b.x].value.x && states[l].heap[a.x].value.x != 0u;
}

fn symbol_this_symbol(l: u32, receiver: V) -> V {
  if (receiver.z == SYMBOL_VALUE_TAG && receiver.x != 0u && states[l].heap[receiver.x].kind == SYMBOL_CELL_KIND) {
    return receiver;
  }
  states[l].status = 4u;
  return undef();
}

fn symbol_primitive_value(l: u32, receiver: V) -> V {
  return symbol_this_symbol(l, receiver);
}

fn symbol_prefix_unit(index: u32) -> u32 {
  // "Symbol("
  switch index {
    case 0u: { return 83u; }
    case 1u: { return 121u; }
    case 2u: { return 109u; }
    case 3u: { return 98u; }
    case 4u: { return 111u; }
    case 5u: { return 108u; }
    default: { return 40u; }
  }
}

fn symbol_descriptive_unit(l: u32, desc_node: u32, desc_len: u32, index: u32) -> u32 {
  if (index < 7u) { return symbol_prefix_unit(index); }
  if (index == 7u + desc_len) { return 41u; }
  return symbol_stored_unit(l, desc_node, index - 7u);
}

fn symbol_descriptive_string(l: u32, value: V) -> V {
  let sym = symbol_this_symbol(l, value);
  if (states[l].status != 0u) { return undef(); }
  let cell = symbol_cell_from_node(l, sym.x);
  var desc_len = 0u;
  if ((cell.flags & SYMBOL_FLAG_HAS_DESCRIPTION) != 0u && cell.desc != 0u) {
    desc_len = states[l].heap[cell.desc].key;
  }
  // 8u + desc_len wraps if a corrupt length is near the top of u32.
  let total = 8u + desc_len;
  if (desc_len > SYMBOL_STRING_LIMIT || total < desc_len || total > SYMBOL_STRING_LIMIT) {
    states[l].status = 3u;
    return undef();
  }
  var first = 0u;
  var previous = 0u;
  for (var chunk = 0u; chunk < 64u && chunk * 4u < total; chunk++) {
    var chars = V(0u);
    for (var j = 0u; j < 4u; j++) {
      let index = chunk * 4u + j;
      if (index < total) { chars[j] = symbol_descriptive_unit(l, cell.desc, desc_len, index); }
    }
    let id = alloc(l, 10u, chars, total, 0u);
    if (states[l].status != 0u) { return undef(); }
    if (first == 0u) { first = id; } else { states[l].heap[previous].next = id; }
    previous = id;
  }
  return V(first, total, 7u, 0u);
}

fn symbol_typeof(l: u32, value: V) -> V {
  if (value.z != SYMBOL_VALUE_TAG) { states[l].status = 6u; return undef(); }
  // "symbol" is six UTF-16 units. Built here so the 6-entry type table stays put.
  let first = alloc(l, 10u, V(115u, 121u, 109u, 98u), 6u, 0u);
  if (states[l].status != 0u) { return undef(); }
  let second = alloc(l, 10u, V(111u, 108u, 0u, 0u), 6u, 0u);
  if (states[l].status != 0u) { return undef(); }
  states[l].heap[first].next = second;
  return V(first, 6u, 7u, 0u);
}

fn symbol_prototype_to_string(l: u32, receiver: V) -> V {
  return symbol_descriptive_string(l, receiver);
}

fn symbol_prototype_value_of(l: u32, receiver: V) -> V {
  return symbol_primitive_value(l, receiver);
}

fn symbol_prototype_description(l: u32, receiver: V) -> V {
  let sym = symbol_this_symbol(l, receiver);
  if (states[l].status != 0u) { return undef(); }
  let cell = symbol_cell_from_node(l, sym.x);
  if ((cell.flags & SYMBOL_FLAG_HAS_DESCRIPTION) == 0u) { return undef(); }
  if (cell.desc == 0u) { return V(0u, 0u, 7u, 0u); }
  return V(cell.desc, states[l].heap[cell.desc].key, 7u, 0u);
}

// Nodes 26 and 27 are ordinary objects installed by shader init, not cells.
fn symbol_fixed_node(which: u32) -> u32 {
  if (which == 0u) { return SYMBOL_NODE_CONSTRUCTOR; }
  if (which == 1u) { return SYMBOL_NODE_PROTOTYPE; }
  return SYMBOL_NODE_REGISTRY;
}
