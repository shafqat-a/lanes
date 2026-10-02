export const jitFixtures = [
  ['identity', 'function identity(x) { return x; }', x => x],
  ['wrap', 'function wrap(x) { return x * 17 + 2147483647; }', x => Math.imul(x, 17) + 2147483647 | 0],
  ['shifts', 'function shifts(x) { return (x << 35) ^ (x >> -2); }', x => (x << 35) ^ (x >> -2)],
  ['unary', 'function unary(x) { return ~(-x); }', x => ~(-x | 0)],
  ['comparisons', 'function comparisons(x) { return (x >= 7) + (x !== 0) + !x; }', x => +(x >= 7) + +(x !== 0) + +!x],
  ['branch snapshot', 'function choose(x) { if (x > 0) { x = -x; x += 3; } else { x -= 4; } return x; }', x => x > 0 ? (-x + 3) | 0 : (x - 4) | 0],
  ['nested branches', 'function nested(x) { let y = x; if (x < 0) { y = -x; if (y > 10) { y -= 2; } else { y += 5; } } else { y *= 3; } return y; }', x => { let y = x; if (x < 0) { y = -x | 0; y = y > 10 ? y - 2 | 0 : y + 5 | 0; } else y = Math.imul(y, 3); return y; }],
  ['scoped locals', 'function scoped(x) { let y = x; if (x & 1) { let z = x + 3; y = z * z; } else { const z = 7; y -= z; } return y; }', x => x & 1 ? Math.imul(x + 3 | 0, x + 3 | 0) : x - 7 | 0],
  ['loop', 'function loop(x) { let y = x; for (let i = 0; i < 32; i++) { y ^= y << 13; y ^= y >> 17; y ^= y << 5; if ((y & 7) === 0) { y += i; } } return y; }', x => { let y = x; for (let i = 0; i < 32; i++) { y ^= y << 13; y ^= y >> 17; y ^= y << 5; if (!(y & 7)) y = y + i | 0; } return y; }],
  ['conditional loop', 'function conditional(x) { let y = x; if (x > 0) { for (let i = -2; i <= 5; i++) { y += i; } } return y; }', x => x > 0 ? x + 12 | 0 : x],
  ['nested loops', 'function nestedLoop(x) { for (let i = 0; i < 3; i++) { for (let j = 0; j < 4; j++) { x += i * j; } } return x; }', x => x + 18 | 0],
  ['zero loop', 'function emptyLoop(x) { for (let i = 5; i < 0; i++) { x = 1; } return x; }', x => x],
  ['constant fold', 'function folded(x) { return (2147483647 + 1) * 3 + x; }', x => Math.imul(-2147483648, 3) + x | 0],
];
let seed = 918273;
export const jitInputs = Int32Array.from([-2147483648, 2147483647, -16777217, 16777217, -1, 0, 1, 7,
  ...Array.from({ length: 261 }, () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed; })]);
