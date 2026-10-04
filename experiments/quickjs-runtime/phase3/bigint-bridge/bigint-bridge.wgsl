// Paste-in fragment for experiments/quickjs-runtime/shader.js.
// Value word is V = vec4<u32> (shader.js:36). Tag is V.z. Tag 18 payload is
// the heap index in V.x, same lane as an object id. Kind 19 header:
//   value.x sign bits (0, 1, or 0xffffffff)
//   value.y limb count
//   value.z storage (0 heap chain, 1 image)
//   value.w image offset when storage is 1, else 0
//   key     0x42490000
//   next    first limb chunk when storage is 0, else 0
// Limb chunks are also kind 19. key is the limb base (multiple of 4).
// value holds four little-endian u32 limbs. Do not markValue those words.
//
// Pool header in the image is NOT a tag-18 word. Lane 2 is 0x42490000|signCode
// (0 zero, 1 positive, 2 negative). Lanes match text(): offset, length, meta, self.

const BIGINT_TAG: u32 = 18u;
const BIGINT_KIND: u32 = 19u;
const BIGINT_SENTINEL: u32 = 0x42490000u;
const BIGINT_MAX_LIMBS: u32 = 64u;
const BIGINT_HEAP_LIMIT: u32 = 2048u;

fn bigint_undef() -> V { return V(0u, 0x7ff80000u, 3u, 0u); }

fn bigint_header(l: u32, value: V) -> u32 {
  if (value.z != BIGINT_TAG || value.y != 0u || value.w != 0u) {
    states[l].status = 2u;
    return 0u;
  }
  let id = value.x;
  if (id == 0u || id >= BIGINT_HEAP_LIMIT) {
    states[l].status = 2u;
    return 0u;
  }
  let node = states[l].heap[id];
  if (node.kind != BIGINT_KIND || node.key != BIGINT_SENTINEL) {
    states[l].status = 2u;
    return 0u;
  }
  if (node.value.y > BIGINT_MAX_LIMBS) {
    states[l].status = 3u;
    return 0u;
  }
  return id;
}

fn bigint_limb(l: u32, id: u32, index: u32) -> u32 {
  let node = states[l].heap[id];
  if (index >= node.value.y) { return 0u; }
  if (node.value.z == 1u) {
    return image[node.value.w + (index >> 2u)][index & 3u];
  }
  var chunk = node.next;
  let base = index & ~3u;
  let slot = index & 3u;
  for (var n = 0u; n < 16u && chunk != 0u; n = n + 1u) {
    let part = states[l].heap[chunk];
    if (part.kind != BIGINT_KIND) {
      states[l].status = 2u;
      return 0u;
    }
    if (part.key == base) { return part.value[slot]; }
    chunk = part.next;
  }
  states[l].status = 2u;
  return 0u;
}

fn bigint_same(l: u32, a: V, b: V) -> bool {
  let left = bigint_header(l, a);
  let right = bigint_header(l, b);
  if (left == 0u || right == 0u || states[l].status != 0u) { return false; }
  let ls = states[l].heap[left].value;
  let rs = states[l].heap[right].value;
  if (ls.x != rs.x || ls.y != rs.y) { return false; }
  for (var i = 0u; i < ls.y; i = i + 1u) {
    if (bigint_limb(l, left, i) != bigint_limb(l, right, i)) { return false; }
  }
  return true;
}

fn materialize_bigint(l: u32, pool: u32) -> V {
  let header = image[pool];
  if ((header.z & 0xffff0000u) != BIGINT_SENTINEL) {
    states[l].status = 2u;
    return bigint_undef();
  }
  let sign_code = header.z & 3u;
  var sign_bits = 0u;
  if (sign_code == 1u) { sign_bits = 1u; }
  else if (sign_code == 2u) { sign_bits = 0xffffffffu; }
  else if (sign_code != 0u) {
    states[l].status = 2u;
    return bigint_undef();
  }
  let length = header.y;
  if (length > BIGINT_MAX_LIMBS) {
    states[l].status = 3u;
    return bigint_undef();
  }
  if ((sign_code == 0u) != (length == 0u)) {
    states[l].status = 2u;
    return bigint_undef();
  }
  if (length != 0u) {
    let top = image[header.x + ((length - 1u) >> 2u)][(length - 1u) & 3u];
    if (top == 0u) {
      states[l].status = 2u;
      return bigint_undef();
    }
  }
  let id = alloc(l, BIGINT_KIND, V(sign_bits, length, 1u, header.x), BIGINT_SENTINEL, 0u);
  if (id == 0u) { return bigint_undef(); }
  return V(id, 0u, BIGINT_TAG, 0u);
}

// INTEGRATION_GAPS
// 1. push (shader.js cases 'push') loads image[arg] as a finished value.
//    A pool header must call materialize_bigint instead of pushing lane 2
//    through as a tag. Do not store a heap index in the read-only image.
// 2. markValue (shader.js:108) ignores tag 18, so limb headers are not rooted.
// 3. collect roots only 1..25 (shader.js:110). Nodes 29 and 30 must be rooted.
// 4. equal (shader.js:78) returns true for any matching tag other than
//    0/1, 7, 4/5/11. Two tag-18 values would compare equal without limbs.
//    Call bigint_same. Do not coerce either side with num().
// 5. truth (shader.js:58) is false for every tag 18, including non-zero.
// 6. typeof (shader.js:1556) falls through to type index 2 ("object").
//    typeNames (program.js:85) has no "bigint" word, and image[typeTable+1].z
//    is builtins.length. Do not reuse that lane. Add a new record.
// 7. objectView / objectValue (shader.js:255, :263) do not map builtin 1150
//    to node 29. Mirror the Number pair 122 <-> 24.
// 8. construct() already returns status 4 for an unknown builtin id. Keep
//    1150 off the status-6 list (shader.js:831). new BigInt is TypeError.
// 9. BigInt() call must be status 6 before any ToNumber path. objectMethod's
//    id>=150 fall-through happens to be status 6; make 1150 explicit so a
//    later numeric clause cannot coerce the argument.
// 10. JSON.stringify of a bigint is a pending TypeError (status 4), not an
//    omitted value and not the current unsupported ToString completion.
// 11. Abstract equality and mixed relational comparison stay unsupported.
//    Do not approximate them with Number().
// 12. No BigInt wrapper object. instanceOf already returns false when the
//    left tag is not 4, 5, or 11; leave that path alone.
