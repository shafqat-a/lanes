// Guest integer limb fragment. Parent splices these functions into shader.js.
// Not a complete shader: no bindings, no @compute, no entry point.
// Same rules as limbs.js: little-endian u32 limbs, sign -1/0/1, no negative zero,
// canonical (no leading zero limb), MAX_LIMBS 64. Overflow is status BI_LIMIT,
// never a wrap and never a Number coercion.
//
// Status: BI_OK 0; BI_LIMIT 1 means { kind: "resource-limit", code: "bigint-limbs" };
// BI_DIV0 2 means { kind: "range-error", code: "bigint-div-zero" }; BI_FAULT 3 is an
// internal invariant failure, not a guest outcome. JS throws on that fault instead.
//
// JS stores a dense limb array whose length is exactly `length`. This fragment stores
// a fixed array<u32, 64>. Words at indices >= len must be 0. bi_trim enforces that.
//
// INTEGRATION_GAPS:
// shader.js value is vec4<u32> (V). Observed tags in .z: 0 number, 1 boolean, 2 null,
// 3 undefined, 4 object, 5 function, 6 non-wrapper sentinel, 7 string, 11 builtin,
// 12 accessor/callback. Tag 18 is not read or marked.
// shader.js Node is { value: V, next: u32, key: u32, kind: u32, marked: u32 }.
// value holds four u32 words, not 64 limbs. Strings chain nodes through next and
// store four u32s per node (unit()). This fragment does not pack that chain.
// Suggested packing, not applied here:
//   tag-18 value: V(headerIndex, 0u, 18u, 0u)
//   kind-19 header value: x = sign as u32 (0u, 1u, or 0xffffffffu for -1),
//     y = length, z = first limb-chain node, w = 0u
//   each chain node holds four little-endian limbs in value and links via next.
//   64 limbs need 16 chain nodes plus the header.
// markValue marks only tags 4, 5, and string tag 7 with w==0. collect() roots fixed
// nodes 1..25, env, result, frame receivers, and stack slots through markValue.
// A live tag-18 must be added to markValue, and kind 19 must mark its limb chain.
// status 3u is a generic resource limit with no code channel. Do not collapse
// BI_LIMIT into status 3 unless the host can still report code "bigint-limbs".
// Heap capacity is 2048 nodes (program.js LIMITS.heap). A limb chain that cannot
// be allocated is the same resource-limit code; it does not lower MAX_LIMBS.
// ROADMAP states no tighter guest bit cap, so the arithmetic bound stays 64.
// Node id 18 is the Array intrinsic and node id 19 is the Object intrinsic
// (objectValue). Those ids are not value tag 18 and not heap kind 19.
// Kinds referenced by shader.js: 1..9 and 11..16. Kind 19 is not referenced.
// This fragment does not use kinds 17, 18, or 20..39, does not claim fixed nodes
// 29 or 30, and does not allocate builtin ids 1150..1179.
// Division is restoring binary long division, truncating toward zero, matching
// limbs.js. Remainder sign follows the dividend.

const BIGINT_MAX_LIMBS: u32 = 64u;
const BIGINT_TAG: u32 = 18u;
const BIGINT_HEAP_KIND: u32 = 19u;
const BI_OK: u32 = 0u;
const BI_LIMIT: u32 = 1u;
const BI_DIV0: u32 = 2u;
const BI_FAULT: u32 = 3u;

struct BiValue {
  sign: i32,
  len: u32,
  limbs: array<u32, 64>,
}

struct BiResult {
  status: u32,
  value: BiValue,
}

fn bi_zero() -> BiValue {
  var v: BiValue;
  v.sign = 0;
  v.len = 0u;
  for (var i = 0u; i < BIGINT_MAX_LIMBS; i++) { v.limbs[i] = 0u; }
  return v;
}

fn bi_ok(v: BiValue) -> BiResult {
  var r: BiResult;
  r.status = BI_OK;
  r.value = v;
  return r;
}

fn bi_failed(status: u32) -> BiResult {
  var r: BiResult;
  r.status = status;
  r.value = bi_zero();
  return r;
}

fn bi_over(v: BiValue) -> bool { return v.len > BIGINT_MAX_LIMBS; }

fn bi_trim(v: ptr<function, BiValue>) {
  var n = (*v).len;
  if (n > BIGINT_MAX_LIMBS) { n = BIGINT_MAX_LIMBS; }
  for (var k = 0u; k < BIGINT_MAX_LIMBS; k++) {
    if (n == 0u) { break; }
    if ((*v).limbs[n - 1u] != 0u) { break; }
    n = n - 1u;
  }
  (*v).len = n;
  if (n == 0u) { (*v).sign = 0; }
  for (var i = 0u; i < BIGINT_MAX_LIMBS; i++) {
    if (i >= n) { (*v).limbs[i] = 0u; }
  }
}

fn bi_from_u32(n: u32) -> BiValue {
  var v = bi_zero();
  if (n == 0u) { return v; }
  v.sign = 1;
  v.len = 1u;
  v.limbs[0] = n;
  return v;
}

fn bi_from_i32(n: i32) -> BiValue {
  let bits = u32(n);
  if (bits == 0u) { return bi_zero(); }
  var v = bi_zero();
  v.len = 1u;
  if ((bits & 0x80000000u) == 0u) {
    v.sign = 1;
    v.limbs[0] = bits;
    return v;
  }
  // Two's-complement magnitude of a negative i32, including the min i32.
  v.sign = -1;
  v.limbs[0] = 0u - bits;
  return v;
}

fn bi_is_canonical(v: BiValue) -> bool {
  if (v.sign != -1 && v.sign != 0 && v.sign != 1) { return false; }
  if (v.len > BIGINT_MAX_LIMBS) { return false; }
  if (v.len == 0u) { return v.sign == 0; }
  if (v.sign == 0) { return false; }
  if (v.limbs[v.len - 1u] == 0u) { return false; }
  for (var i = 0u; i < BIGINT_MAX_LIMBS; i++) {
    if (i >= v.len && v.limbs[i] != 0u) { return false; }
  }
  return true;
}

fn bi_limb_count(v: BiValue) -> u32 {
  if (bi_over(v)) { return v.len; }
  var c = v;
  bi_trim(&c);
  return c.len;
}

fn bi_to_sign(v: BiValue) -> i32 {
  if (bi_over(v)) { return v.sign; }
  var c = v;
  bi_trim(&c);
  return c.sign;
}

fn bi_is_zero(v: BiValue) -> bool { return bi_to_sign(v) == 0; }

fn bi_clone(v: BiValue) -> BiResult {
  if (bi_over(v)) { return bi_failed(BI_LIMIT); }
  var c = v;
  bi_trim(&c);
  return bi_ok(c);
}

fn bi_cmp_mag(a: ptr<function, array<u32, 64>>, a_len: u32, b: ptr<function, array<u32, 64>>, b_len: u32) -> i32 {
  if (a_len != b_len) {
    if (a_len < b_len) { return -1; }
    return 1;
  }
  for (var rev = 0u; rev < BIGINT_MAX_LIMBS; rev++) {
    if (rev >= a_len) { break; }
    let i = a_len - 1u - rev;
    if ((*a)[i] != (*b)[i]) {
      if ((*a)[i] < (*b)[i]) { return -1; }
      return 1;
    }
  }
  return 0;
}

fn bi_compare(a: BiValue, b: BiValue) -> i32 {
  if (bi_over(a) || bi_over(b)) { return -2; }
  var aa = a;
  var bb = b;
  bi_trim(&aa);
  bi_trim(&bb);
  if (aa.sign != bb.sign) {
    if (aa.sign < bb.sign) { return -1; }
    return 1;
  }
  if (aa.sign == 0) { return 0; }
  let mag = bi_cmp_mag(&aa.limbs, aa.len, &bb.limbs, bb.len);
  if (mag == 0) { return 0; }
  if (aa.sign < 0) { return -mag; }
  return mag;
}

fn bi_equal(a: BiValue, b: BiValue) -> bool { return bi_compare(a, b) == 0; }

fn bi_neg_value(v: BiValue) -> BiValue {
  var c = v;
  bi_trim(&c);
  if (c.len == 0u) { return bi_zero(); }
  c.sign = -c.sign;
  return c;
}

fn bi_neg(v: BiValue) -> BiResult {
  if (bi_over(v)) { return bi_failed(BI_LIMIT); }
  return bi_ok(bi_neg_value(v));
}

fn bi_abs(v: BiValue) -> BiResult {
  if (bi_over(v)) { return bi_failed(BI_LIMIT); }
  var c = v;
  bi_trim(&c);
  if (c.len == 0u) { return bi_ok(bi_zero()); }
  c.sign = 1;
  return bi_ok(c);
}

fn bi_pack(sign: i32, limbs: ptr<function, array<u32, 64>>, len: u32) -> BiResult {
  if (len > BIGINT_MAX_LIMBS) { return bi_failed(BI_LIMIT); }
  var n = len;
  for (var k = 0u; k < BIGINT_MAX_LIMBS; k++) {
    if (n == 0u) { break; }
    if ((*limbs)[n - 1u] != 0u) { break; }
    n = n - 1u;
  }
  if (n == 0u || sign == 0) { return bi_ok(bi_zero()); }
  var v = bi_zero();
  v.sign = select(-1, 1, sign > 0);
  v.len = n;
  for (var i = 0u; i < BIGINT_MAX_LIMBS; i++) {
    if (i < n) { v.limbs[i] = (*limbs)[i]; }
  }
  return bi_ok(v);
}

fn bi_add_mag(a: ptr<function, array<u32, 64>>, a_len: u32, b: ptr<function, array<u32, 64>>, b_len: u32, out: ptr<function, array<u32, 64>>, out_len: ptr<function, u32>) -> u32 {
  var n = a_len;
  if (b_len > n) { n = b_len; }
  var carry = 0u;
  for (var i = 0u; i < BIGINT_MAX_LIMBS; i++) {
    if (i < n) {
      let av = select(0u, (*a)[i], i < a_len);
      let bv = select(0u, (*b)[i], i < b_len);
      let sum1 = av + bv;
      let wrap1 = select(0u, 1u, sum1 < av);
      let sum2 = sum1 + carry;
      let wrap2 = select(0u, 1u, sum2 < sum1);
      (*out)[i] = sum2;
      carry = wrap1 | wrap2;
    } else {
      (*out)[i] = 0u;
    }
  }
  if (carry != 0u) {
    if (n >= BIGINT_MAX_LIMBS) { return BI_LIMIT; }
    (*out)[n] = carry;
    *out_len = n + 1u;
    return BI_OK;
  }
  *out_len = n;
  return BI_OK;
}

fn bi_sub_mag(a: ptr<function, array<u32, 64>>, a_len: u32, b: ptr<function, array<u32, 64>>, b_len: u32, out: ptr<function, array<u32, 64>>, out_len: ptr<function, u32>) -> u32 {
  var borrow = 0u;
  for (var i = 0u; i < BIGINT_MAX_LIMBS; i++) {
    if (i < a_len) {
      let av = (*a)[i];
      let bv = select(0u, (*b)[i], i < b_len);
      let diff1 = av - bv;
      let wrap1 = select(0u, 1u, av < bv);
      let diff2 = diff1 - borrow;
      let wrap2 = select(0u, 1u, diff1 < borrow);
      (*out)[i] = diff2;
      borrow = wrap1 | wrap2;
    } else {
      (*out)[i] = 0u;
    }
  }
  if (borrow != 0u) { return BI_FAULT; }
  var n = a_len;
  for (var k = 0u; k < BIGINT_MAX_LIMBS; k++) {
    if (n == 0u) { break; }
    if ((*out)[n - 1u] != 0u) { break; }
    n = n - 1u;
  }
  *out_len = n;
  return BI_OK;
}

fn bi_add(a: BiValue, b: BiValue) -> BiResult {
  if (bi_over(a) || bi_over(b)) { return bi_failed(BI_LIMIT); }
  var aa = a;
  var bb = b;
  bi_trim(&aa);
  bi_trim(&bb);
  if (aa.len == 0u) { return bi_ok(bb); }
  if (bb.len == 0u) { return bi_ok(aa); }
  var out: array<u32, 64>;
  var out_len = 0u;
  if (aa.sign == bb.sign) {
    let status = bi_add_mag(&aa.limbs, aa.len, &bb.limbs, bb.len, &out, &out_len);
    if (status != BI_OK) { return bi_failed(status); }
    return bi_pack(aa.sign, &out, out_len);
  }
  let mag = bi_cmp_mag(&aa.limbs, aa.len, &bb.limbs, bb.len);
  if (mag == 0) { return bi_ok(bi_zero()); }
  var status = BI_OK;
  var sign = aa.sign;
  if (mag > 0) {
    status = bi_sub_mag(&aa.limbs, aa.len, &bb.limbs, bb.len, &out, &out_len);
  } else {
    sign = bb.sign;
    status = bi_sub_mag(&bb.limbs, bb.len, &aa.limbs, aa.len, &out, &out_len);
  }
  if (status != BI_OK) { return bi_failed(status); }
  return bi_pack(sign, &out, out_len);
}

fn bi_sub(a: BiValue, b: BiValue) -> BiResult {
  if (bi_over(b)) { return bi_failed(BI_LIMIT); }
  return bi_add(a, bi_neg_value(b));
}

// 32x32 -> lo, hi. Partial sums that exceed 2^32 are recovered from wrap.
fn bi_mul32(a: u32, b: u32) -> vec2<u32> {
  let a0 = a & 0xFFFFu;
  let a1 = a >> 16u;
  let b0 = b & 0xFFFFu;
  let b1 = b >> 16u;
  let p00 = a0 * b0;
  let p01 = a0 * b1;
  let p10 = a1 * b0;
  let p11 = a1 * b1;
  let mid = p01 + p10;
  let mid_wrap = select(0u, 1u, mid < p01);
  let mid_lo = mid & 0xFFFFu;
  let mid_hi = (mid >> 16u) + (mid_wrap << 16u);
  let cross = mid_lo << 16u;
  let low = p00 + cross;
  let low_wrap = select(0u, 1u, low < p00);
  let hi = p11 + mid_hi + low_wrap;
  return vec2<u32>(low, hi);
}

fn bi_mul(a: BiValue, b: BiValue) -> BiResult {
  if (bi_over(a) || bi_over(b)) { return bi_failed(BI_LIMIT); }
  var aa = a;
  var bb = b;
  bi_trim(&aa);
  bi_trim(&bb);
  if (aa.len == 0u || bb.len == 0u) { return bi_ok(bi_zero()); }
  if (aa.len + bb.len - 1u > BIGINT_MAX_LIMBS) { return bi_failed(BI_LIMIT); }
  var acc: array<u32, 64>;
  for (var z = 0u; z < BIGINT_MAX_LIMBS; z++) { acc[z] = 0u; }
  for (var i = 0u; i < BIGINT_MAX_LIMBS; i++) {
    if (i >= aa.len) { break; }
    var carry_lo = 0u;
    var carry_hi = 0u;
    for (var j = 0u; j < BIGINT_MAX_LIMBS; j++) {
      if (j >= bb.len) { break; }
      let idx = i + j;
      if (idx >= BIGINT_MAX_LIMBS) { return bi_failed(BI_LIMIT); }
      let p = bi_mul32(aa.limbs[i], bb.limbs[j]);
      let cur = acc[idx];
      let s1 = cur + p.x;
      let c1 = select(0u, 1u, s1 < cur);
      let s2 = s1 + carry_lo;
      let c2 = select(0u, 1u, s2 < s1);
      acc[idx] = s2;
      let h1 = p.y + c1;
      let w1 = select(0u, 1u, h1 < p.y);
      let h2 = h1 + c2;
      let w2 = select(0u, 1u, h2 < h1);
      let h3 = h2 + carry_hi;
      let w3 = select(0u, 1u, h3 < h2);
      carry_lo = h3;
      carry_hi = w1 + w2 + w3;
    }
    var slot = i + bb.len;
    var spill_lo = carry_lo;
    var spill_hi = carry_hi;
    for (var step = 0u; step < 4u; step++) {
      if (spill_lo == 0u && spill_hi == 0u) { break; }
      if (slot >= BIGINT_MAX_LIMBS) { return bi_failed(BI_LIMIT); }
      let cur = acc[slot];
      let s1 = cur + spill_lo;
      let c1 = select(0u, 1u, s1 < cur);
      acc[slot] = s1;
      spill_lo = spill_hi + c1;
      spill_hi = 0u;
      slot = slot + 1u;
    }
    if (spill_lo != 0u || spill_hi != 0u) { return bi_failed(BI_LIMIT); }
  }
  var n = BIGINT_MAX_LIMBS;
  for (var k = 0u; k < BIGINT_MAX_LIMBS; k++) {
    if (n == 0u) { break; }
    if (acc[n - 1u] != 0u) { break; }
    n = n - 1u;
  }
  let sign = select(-1, 1, aa.sign == bb.sign);
  return bi_pack(sign, &acc, n);
}

fn bi_bit_length(v: BiValue) -> u32 {
  if (v.len == 0u) { return 0u; }
  var top = v.limbs[v.len - 1u];
  var bits = 0u;
  for (var i = 0u; i < 32u; i++) {
    if (top == 0u) { break; }
    top = top >> 1u;
    bits = bits + 1u;
  }
  return (v.len - 1u) * 32u + bits;
}

fn bi_shl1(rem: ptr<function, array<u32, 64>>, r_len: ptr<function, u32>, hi: ptr<function, u32>) {
  var carry = 0u;
  let n = *r_len;
  for (var i = 0u; i < BIGINT_MAX_LIMBS; i++) {
    if (i < n) {
      let word = (*rem)[i];
      (*rem)[i] = (word << 1u) | carry;
      carry = word >> 31u;
    }
  }
  if (carry != 0u) {
    if (n >= BIGINT_MAX_LIMBS) { *hi = carry; }
    else {
      (*rem)[n] = carry;
      *r_len = n + 1u;
    }
  }
}

fn bi_add_bit(rem: ptr<function, array<u32, 64>>, r_len: ptr<function, u32>, hi: ptr<function, u32>, bit: u32) {
  if (bit == 0u) { return; }
  var carry = 1u;
  let n = *r_len;
  for (var i = 0u; i < BIGINT_MAX_LIMBS; i++) {
    if (i < n && carry != 0u) {
      let word = (*rem)[i];
      let sum = word + carry;
      (*rem)[i] = sum;
      carry = select(0u, 1u, sum < word);
    }
  }
  if (carry != 0u) {
    if (n >= BIGINT_MAX_LIMBS) { *hi = 1u; }
    else {
      (*rem)[n] = 1u;
      *r_len = n + 1u;
    }
  }
}

fn bi_sub_v(rem: ptr<function, array<u32, 64>>, r_len: ptr<function, u32>, hi: ptr<function, u32>, v: ptr<function, array<u32, 64>>, v_len: u32) -> u32 {
  var width = *r_len;
  if (v_len > width) { width = v_len; }
  if (*hi != 0u) { width = BIGINT_MAX_LIMBS; }
  var borrow = 0u;
  for (var i = 0u; i < BIGINT_MAX_LIMBS; i++) {
    if (i < width) {
      let av = select(0u, (*rem)[i], i < *r_len);
      let bv = select(0u, (*v)[i], i < v_len);
      let diff1 = av - bv;
      let wrap1 = select(0u, 1u, av < bv);
      let diff2 = diff1 - borrow;
      let wrap2 = select(0u, 1u, diff1 < borrow);
      (*rem)[i] = diff2;
      borrow = wrap1 | wrap2;
    }
  }
  if (borrow != 0u) {
    if (*hi == 0u) { return BI_FAULT; }
    *hi = 0u;
  }
  if (*hi != 0u) { return BI_FAULT; }
  var n = width;
  for (var k = 0u; k < BIGINT_MAX_LIMBS; k++) {
    if (n == 0u) { break; }
    if ((*rem)[n - 1u] != 0u) { break; }
    n = n - 1u;
  }
  for (var i = 0u; i < BIGINT_MAX_LIMBS; i++) {
    if (i >= n && i < width) { (*rem)[i] = 0u; }
  }
  *r_len = n;
  return BI_OK;
}

fn bi_store(sign: i32, limbs: ptr<function, array<u32, 64>>, len: u32) -> BiValue {
  var n = len;
  for (var k = 0u; k < BIGINT_MAX_LIMBS; k++) {
    if (n == 0u) { break; }
    if ((*limbs)[n - 1u] != 0u) { break; }
    n = n - 1u;
  }
  if (n == 0u) { return bi_zero(); }
  var v = bi_zero();
  v.sign = sign;
  v.len = n;
  for (var i = 0u; i < BIGINT_MAX_LIMBS; i++) {
    if (i < n) { v.limbs[i] = (*limbs)[i]; }
  }
  return v;
}

fn bi_divmod(a: BiValue, b: BiValue, quot: ptr<function, BiValue>, rem: ptr<function, BiValue>) -> u32 {
  if (bi_over(a) || bi_over(b)) { return BI_LIMIT; }
  var u = a;
  var v = b;
  bi_trim(&u);
  bi_trim(&v);
  if (v.len == 0u) { return BI_DIV0; }
  if (u.len == 0u) {
    *quot = bi_zero();
    *rem = bi_zero();
    return BI_OK;
  }
  var acc: array<u32, 64>;
  var qlimbs: array<u32, 64>;
  for (var i = 0u; i < BIGINT_MAX_LIMBS; i++) { acc[i] = 0u; qlimbs[i] = 0u; }
  var r_len = 0u;
  var hi = 0u;
  let bits = bi_bit_length(u);
  for (var rev = 0u; rev < BIGINT_MAX_LIMBS; rev++) {
    if (rev >= u.len) { break; }
    let limb = u.len - 1u - rev;
    for (var brev = 0u; brev < 32u; brev++) {
      let bindex = 31u - brev;
      let bit_index = limb * 32u + bindex;
      if (bit_index < bits) {
        if (hi != 0u) { return BI_FAULT; }
        bi_shl1(&acc, &r_len, &hi);
        let bit = (u.limbs[limb] >> bindex) & 1u;
        bi_add_bit(&acc, &r_len, &hi, bit);
        var mag: i32 = 0;
        if (hi != 0u) { mag = 1; }
        else { mag = bi_cmp_mag(&acc, r_len, &v.limbs, v.len); }
        if (mag >= 0) {
          let status = bi_sub_v(&acc, &r_len, &hi, &v.limbs, v.len);
          if (status != BI_OK) { return status; }
          qlimbs[limb] = qlimbs[limb] | (1u << bindex);
        }
      }
    }
  }
  let qsign = select(-1, 1, u.sign == v.sign);
  *quot = bi_store(qsign, &qlimbs, u.len);
  *rem = bi_store(u.sign, &acc, r_len);
  return BI_OK;
}

fn bi_div_trunc(a: BiValue, b: BiValue) -> BiResult {
  var q: BiValue;
  var r: BiValue;
  let status = bi_divmod(a, b, &q, &r);
  if (status != BI_OK) { return bi_failed(status); }
  return bi_ok(q);
}

fn bi_rem_trunc(a: BiValue, b: BiValue) -> BiResult {
  var q: BiValue;
  var r: BiValue;
  let status = bi_divmod(a, b, &q, &r);
  if (status != BI_OK) { return bi_failed(status); }
  return bi_ok(r);
}
