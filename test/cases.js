export const cases = [
  ['identity', 'function f(x) { return x; }', x => x],
  ['arithmetic', 'function f(x) { return x * 17 + 3; }', x => (Math.imul(x, 17) + 3) | 0],
  ['branch', 'function f(x) { if (x < 0) { return -x; } else { return x + 1; } }', x => x < 0 ? -x | 0 : x + 1 | 0],
  ['loop', 'function f(x) { let sum = 0; for (let i = 0; i < 10; i++) { sum += x ^ i; } return sum; }', x => { let s = 0; for (let i = 0; i < 10; i++) s = (s + (x ^ i)) | 0; return s; }],
  ['while', 'function f(x) { let n = x & 15; while (n > 0) { n--; } return n; }', () => 0],
  ['side effects', 'function f(x) { return x++ + ++x; }', x => { const old = x; x = x + 2 | 0; return old + x | 0; }],
  ['evaluation order', 'function f(x) { return x + (x = 2); }', x => x + 2 | 0],
  ['compound assignment', 'function f(x) { x += (x = 2); return x; }', x => x + 2 | 0],
  ['shift', 'function f(x) { return (x << 33) ^ (x >> 34); }', x => (x << 33) ^ (x >> 34)],
  ['logic', 'function f(x) { return !(x !== 0); }', x => +(x === 0)],
  ['minimum integer', 'function f(x) { return -2147483648; }', () => -2147483648],
];
export const inputs = Int32Array.from([-2147483648, -16777217, -123, -1, 0, 1, 7, 16777217, 2147483647,
  ...Array.from({ length: 260 }, (_, i) => Math.imul(i, 1664525))]);
