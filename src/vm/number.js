// Software IEEE-754 binary64, round-to-nearest ties-to-even. No WGSL floats.
// Pairs are little-endian words. NaN payloads are canonicalized.
export const numberWGSL = `
alias Pair = vec2<u32>;
fn zero(a: Pair) -> bool { return (a.x | (a.y & 0x7fffffffu)) == 0u; }
fn nan(a: Pair) -> bool { return (a.y & 0x7ff00000u) == 0x7ff00000u && ((a.y & 0xfffffu) | a.x) != 0u; }
fn inf(a: Pair) -> bool { return (a.y & 0x7fffffffu) == 0x7ff00000u && a.x == 0u; }
fn qnan() -> Pair { return Pair(0u, 0x7ff80000u); }
fn less64(a: Pair, b: Pair) -> bool { return a.y < b.y || (a.y == b.y && a.x < b.x); }
fn add64(a: Pair, b: Pair) -> Pair { let lo = a.x + b.x; return Pair(lo, a.y + b.y + select(0u, 1u, lo < a.x)); }
fn sub64(a: Pair, b: Pair) -> Pair { return Pair(a.x - b.x, a.y - b.y - select(0u, 1u, a.x < b.x)); }
fn left(a: Pair, n: u32) -> Pair {
  if (n == 0u) { return a; }
  if (n < 32u) { return Pair(a.x << n, (a.y << n) | (a.x >> (32u - n))); }
  if (n < 64u) { return Pair(0u, a.x << (n - 32u)); }
  return Pair(0u);
}
fn right(a: Pair, n: u32) -> Pair {
  if (n == 0u) { return a; }
  if (n < 32u) { return Pair((a.x >> n) | (a.y << (32u - n)), a.y >> n); }
  if (n < 64u) { return Pair(a.y >> (n - 32u), 0u); }
  return Pair(0u);
}
fn jam(a: Pair, n: u32) -> Pair {
  let shifted = right(a, n);
  let restored = left(shifted, n);
  return Pair(shifted.x | select(0u, 1u, any(restored != a)), shifted.y);
}
fn sig(a: Pair) -> Pair { return Pair(a.x, (a.y & 0xfffffu) | select(0u, 0x100000u, (a.y & 0x7ff00000u) != 0u)); }
fn exponent(a: Pair) -> i32 { return i32(max(1u, (a.y >> 20u) & 2047u)); }
// significand has its leading bit at 55 and three guard/round/sticky bits.
fn pack(sign: u32, exponentIn: i32, significand: Pair) -> Pair {
  var e = exponentIn; var s = significand;
  if (e <= 0) { s = jam(s, u32(1 - e)); e = 1; }
  let rounding = s.x & 7u;
  s = right(s, 3u);
  if (rounding > 4u || (rounding == 4u && (s.x & 1u) != 0u)) { s = add64(s, Pair(1u, 0u)); }
  if ((s.y & 0x200000u) != 0u) { s = right(s, 1u); e++; }
  if (e >= 2047) { return Pair(0u, sign | 0x7ff00000u); }
  if ((s.y & 0x100000u) == 0u) { e = 0; }
  return Pair(s.x, sign | (u32(e) << 20u) | (s.y & 0xfffffu));
}
fn plus(a: Pair, b: Pair) -> Pair {
  if (nan(a) || nan(b)) { return qnan(); }
  if (inf(a)) { if (inf(b) && ((a.y ^ b.y) & 0x80000000u) != 0u) { return qnan(); } return a; }
  if (inf(b)) { return b; }
  var sa = left(sig(a), 3u); var sb = left(sig(b), 3u);
  var ea = exponent(a); let eb = exponent(b);
  var sign = a.y & 0x80000000u;
  if (ea < eb) { sa = jam(sa, u32(eb - ea)); ea = eb; }
  else { sb = jam(sb, u32(ea - eb)); }
  var sum: Pair;
  if (((a.y ^ b.y) & 0x80000000u) == 0u) {
    sum = add64(sa, sb);
    if ((sum.y & 0x1000000u) != 0u) { sum = jam(sum, 1u); ea++; }
  } else {
    if (less64(sa, sb)) { sum = sub64(sb, sa); sign = b.y & 0x80000000u; }
    else { sum = sub64(sa, sb); }
    if (all(sum == Pair(0u))) { return Pair(0u); }
    while ((sum.y & 0x800000u) == 0u && ea > 1) { sum = left(sum, 1u); ea--; }
  }
  return pack(sign, ea, sum);
}
fn times(a: Pair, b: Pair) -> Pair {
  let sign = (a.y ^ b.y) & 0x80000000u;
  if (nan(a) || nan(b) || (inf(a) && zero(b)) || (zero(a) && inf(b))) { return qnan(); }
  if (inf(a) || inf(b)) { return Pair(0u, sign | 0x7ff00000u); }
  if (zero(a) || zero(b)) { return Pair(0u, sign); }
  var sa = sig(a); var sb = sig(b); var e = exponent(a) + exponent(b) - 1023;
  while ((sa.y & 0x100000u) == 0u) { sa = left(sa, 1u); e--; }
  while ((sb.y & 0x100000u) == 0u) { sb = left(sb, 1u); e--; }
  // Shift/add exact 106-bit product in four limbs.
  var p = vec4<u32>(0u); var m = vec4<u32>(sa, 0u, 0u);
  for (var bit = 0u; bit < 53u; bit++) {
    if ((sb.x & 1u) != 0u) {
      var carry = 0u;
      for (var j = 0u; j < 4u; j++) {
        let t = p[j] + m[j]; let c = select(0u, 1u, t < p[j]);
        let v = t + carry; carry = c | select(0u, 1u, v < t); p[j] = v;
      }
    }
    sb = right(sb, 1u);
    m = vec4<u32>(m.x << 1u, (m.y << 1u) | (m.x >> 31u), (m.z << 1u) | (m.y >> 31u), (m.w << 1u) | (m.z >> 31u));
  }
  var shift = 49u;
  if ((p.w & 0x200u) != 0u) { shift = 50u; e++; }
  var sticky = 0u;
  for (var bit = 0u; bit < shift; bit++) {
    sticky |= p.x & 1u;
    p = vec4<u32>((p.x >> 1u) | (p.y << 31u), (p.y >> 1u) | (p.z << 31u), (p.z >> 1u) | (p.w << 31u), p.w >> 1u);
  }
  return pack(sign, e, Pair(p.x | sticky, p.y));
}
fn divide(a: Pair, b: Pair) -> Pair {
  let sign = (a.y ^ b.y) & 0x80000000u;
  if (nan(a) || nan(b) || (zero(a) && zero(b)) || (inf(a) && inf(b))) { return qnan(); }
  if (inf(a) || zero(b)) { return Pair(0u, sign | 0x7ff00000u); }
  if (zero(a) || inf(b)) { return Pair(0u, sign); }
  var sa = sig(a); var sb = sig(b); var e = exponent(a) - exponent(b) + 1023;
  while ((sa.y & 0x100000u) == 0u) { sa = left(sa, 1u); e--; }
  while ((sb.y & 0x100000u) == 0u) { sb = left(sb, 1u); e++; }
  if (less64(sa, sb)) { sa = left(sa, 1u); e--; }
  var q = Pair(0u);
  for (var bit = 0u; bit < 56u; bit++) {
    q = left(q, 1u);
    if (!less64(sa, sb)) { sa = sub64(sa, sb); q.x |= 1u; }
    sa = left(sa, 1u);
  }
  if (any(sa != Pair(0u))) { q.x |= 1u; }
  return pack(sign, e, q);
}
fn equalNumber(a: Pair, b: Pair) -> bool { return !nan(a) && !nan(b) && (all(a == b) || (zero(a) && zero(b))); }
fn lessNumber(a: Pair, b: Pair) -> bool {
  if (nan(a) || nan(b) || (zero(a) && zero(b))) { return false; }
  if (((a.y ^ b.y) & 0x80000000u) != 0u) { return (a.y & 0x80000000u) != 0u; }
  if ((a.y & 0x80000000u) != 0u) { return less64(b, a); }
  return less64(a, b);
}
fn toBits(a: Pair) -> u32 {
  let e = i32((a.y >> 20u) & 2047u) - 1023;
  if (e < 0 || e >= 84) { return 0u; }
  var s = sig(a);
  if (e < 52) { s = right(s, u32(52 - e)); } else { s = left(s, u32(e - 52)); }
  return select(s.x, 0u - s.x, (a.y & 0x80000000u) != 0u);
}
fn fromUnsigned(a: u32) -> Pair {
  if (a == 0u) { return Pair(0u); }
  let e = 31u - countLeadingZeros(a); let s = left(Pair(a, 0u), 52u - e);
  return Pair(s.x, ((e + 1023u) << 20u) | (s.y & 0xfffffu));
}
fn fromSigned(a: u32) -> Pair {
  if ((a & 0x80000000u) == 0u) { return fromUnsigned(a); }
  let n = fromUnsigned(0u - a); return Pair(n.x, n.y | 0x80000000u);
}
`;
