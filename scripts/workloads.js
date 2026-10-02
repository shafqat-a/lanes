export const workloads = [
  {
    name: 'simulation',
    source: `function simulate(x) {
      let s = x;
      for (let i = 0; i < 256; i++) {
        s ^= s << 13; s ^= s >> 17; s ^= s << 5;
        if ((s & 7) === 0) { s += i; }
      }
      return s;
    }`,
    native(x) { let s = x; for (let i = 0; i < 256; i++) { s ^= s << 13; s ^= s >> 17; s ^= s << 5; if (!(s & 7)) s = s + i | 0; } return s; },
  },
  {
    name: 'integer-hash',
    source: `function hash(x) {
      let h = x;
      for (let i = 0; i < 64; i++) {
        h = (h ^ (h >> 16)) * 73244475;
        h = (h ^ (h >> 16)) * 73244475;
        h ^= h >> 16;
      }
      return h;
    }`,
    native(x) { let h = x; for (let i = 0; i < 64; i++) { h = Math.imul(h ^ (h >> 16), 73244475); h = Math.imul(h ^ (h >> 16), 73244475); h ^= h >> 16; } return h; },
  },
  {
    name: 'rule-evaluation',
    source: `function score(x) {
      let score = 0;
      for (let i = 0; i < 128; i++) {
        const value = (x ^ (i * 1103515245)) & 1023;
        if (value > 700) { score += value; } else { score -= 3; }
      }
      return score;
    }`,
    native(x) { let score = 0; for (let i = 0; i < 128; i++) { const value = (x ^ Math.imul(i, 1103515245)) & 1023; score = value > 700 ? score + value | 0 : score - 3 | 0; } return score; },
  },
];
