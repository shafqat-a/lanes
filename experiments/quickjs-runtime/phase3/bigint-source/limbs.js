// Guest integer arithmetic on little-endian u32 limbs.
// Sign-magnitude, canonical, no negative zero. The host integer type is not used.
// MAX_LIMBS is 64 (2048 bits). ROADMAP states no tighter guest cap.
// A result that would exceed MAX_LIMBS returns RESOURCE_LIMIT. No wrap, no Number coercion.
// Tag 18 and heap kind 19 name the integration shape. This module allocates neither
// heap nodes, value tags, fixed nodes, nor builtin ids.

export const MAX_LIMBS = 64;
export const LIMB_BITS = 32;
export const BIGINT_TAG = 18;
export const BIGINT_HEAP_KIND = 19;
export const RESOURCE_LIMIT = Object.freeze({ kind: 'resource-limit', code: 'bigint-limbs' });
export const DIV_ZERO = Object.freeze({ kind: 'range-error', code: 'bigint-div-zero' });

const BASE = 4294967296;

export function isResourceLimit(value) {
  return !!value && typeof value === 'object' && value.kind === 'resource-limit' && value.code === 'bigint-limbs';
}

export function isDivZero(value) {
  return !!value && typeof value === 'object' && value.kind === 'range-error' && value.code === 'bigint-div-zero';
}

function limbArray(value) {
  return Array.isArray(value) || value instanceof Uint32Array;
}

function zero() {
  return { sign: 0, length: 0, limbs: [] };
}

function pack(sign, limbs) {
  let length = limbs.length;
  while (length > 0 && limbs[length - 1] === 0) length--;
  if (length === 0) return zero();
  if (length > MAX_LIMBS) return RESOURCE_LIMIT;
  const out = new Array(length);
  for (let i = 0; i < length; i++) out[i] = limbs[i] >>> 0;
  return { sign: sign < 0 ? -1 : 1, length, limbs: out };
}

// null means the stored length is above MAX_LIMBS (caller returns RESOURCE_LIMIT or throws).
function load(value, observe) {
  if (isResourceLimit(value)) {
    if (observe) throw new TypeError('expected a bigint limb value');
    return null;
  }
  if (isDivZero(value) || value === null || typeof value !== 'object') {
    throw new TypeError('expected a bigint limb value');
  }
  const sign = value.sign;
  const length = value.length;
  const limbs = value.limbs;
  if (!Number.isInteger(length) || length < 0) throw new TypeError('bigint length');
  if (length > MAX_LIMBS) {
    if (observe) throw new RangeError('bigint exceeds MAX_LIMBS');
    return null;
  }
  if (!limbArray(limbs) || limbs.length < length) throw new TypeError('bigint limbs');
  if (sign !== -1 && sign !== 0 && sign !== 1) throw new TypeError('bigint sign');
  const out = new Array(length);
  for (let i = 0; i < length; i++) {
    const word = limbs[i];
    if (!Number.isInteger(word) || word < 0 || word > 0xffffffff) throw new TypeError('bigint limb');
    out[i] = word >>> 0;
  }
  let n = length;
  while (n > 0 && out[n - 1] === 0) n--;
  out.length = n;
  if (n === 0) return zero();
  if (sign === 0) throw new TypeError('bigint sign');
  return { sign, length: n, limbs: out };
}

export function fromU32(n) {
  if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) {
    throw new RangeError('fromU32 expects an integer in 0..4294967295');
  }
  if (n === 0) return zero();
  return { sign: 1, length: 1, limbs: [n >>> 0] };
}

export function fromI32(n) {
  if (!Number.isInteger(n) || n < -0x80000000 || n > 0x7fffffff) {
    throw new RangeError('fromI32 expects an integer in -2147483648..2147483647');
  }
  if (n === 0) return zero();
  if (n > 0) return { sign: 1, length: 1, limbs: [n >>> 0] };
  // -2147483648 negates to 2147483648, which still fits in one u32 limb.
  return { sign: -1, length: 1, limbs: [(-n) >>> 0] };
}

// Copies and canonicalizes. An array longer than MAX_LIMBS is RESOURCE_LIMIT
// even when the extra limbs are zero: the bound is on the stored word count.
export function fromLimbs(sign, limbs) {
  if (sign !== -1 && sign !== 0 && sign !== 1) throw new RangeError('bigint sign');
  if (!limbArray(limbs)) throw new TypeError('bigint limbs');
  if (limbs.length > MAX_LIMBS) return RESOURCE_LIMIT;
  return load({ sign, length: limbs.length, limbs }, false);
}

export function isCanonical(value) {
  if (value === null || typeof value !== 'object') return false;
  if (value.sign !== -1 && value.sign !== 0 && value.sign !== 1) return false;
  if (!Number.isInteger(value.length) || value.length < 0 || value.length > MAX_LIMBS) return false;
  if (!limbArray(value.limbs) || value.limbs.length !== value.length) return false;
  if (value.sign === 0 || value.length === 0) return value.sign === 0 && value.length === 0;
  for (let i = 0; i < value.length; i++) {
    const word = value.limbs[i];
    if (!Number.isInteger(word) || word < 0 || word > 0xffffffff) return false;
  }
  return value.limbs[value.length - 1] !== 0;
}

export function toSign(value) {
  return load(value, true).sign;
}

export function isZero(value) {
  return toSign(value) === 0;
}

export function limbCount(value) {
  return load(value, true).length;
}

export function clone(value) {
  const loaded = load(value, false);
  if (loaded === null) return RESOURCE_LIMIT;
  return { sign: loaded.sign, length: loaded.length, limbs: loaded.limbs.slice() };
}

function cmpMag(a, aLen, b, bLen) {
  if (aLen !== bLen) return aLen < bLen ? -1 : 1;
  for (let i = aLen - 1; i >= 0; i--) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

export function compare(a, b) {
  const left = load(a, true);
  const right = load(b, true);
  if (left.sign !== right.sign) return left.sign < right.sign ? -1 : 1;
  if (left.sign === 0) return 0;
  const mag = cmpMag(left.limbs, left.length, right.limbs, right.length);
  if (mag === 0) return 0;
  return left.sign < 0 ? -mag : mag;
}

export function equal(a, b) {
  return compare(a, b) === 0;
}

export function neg(value) {
  const loaded = load(value, false);
  if (loaded === null) return RESOURCE_LIMIT;
  if (loaded.sign === 0) return zero();
  return { sign: -loaded.sign, length: loaded.length, limbs: loaded.limbs.slice() };
}

export function abs(value) {
  const loaded = load(value, false);
  if (loaded === null) return RESOURCE_LIMIT;
  if (loaded.sign === 0) return zero();
  return { sign: 1, length: loaded.length, limbs: loaded.limbs.slice() };
}

function addMag(a, aLen, b, bLen) {
  const n = aLen > bLen ? aLen : bLen;
  const out = new Array(n + 1);
  let carry = 0;
  for (let i = 0; i < n; i++) {
    const sum = (i < aLen ? a[i] : 0) + (i < bLen ? b[i] : 0) + carry;
    out[i] = sum >>> 0;
    carry = Math.floor(sum / BASE);
  }
  if (carry !== 0) {
    if (n >= MAX_LIMBS) return null;
    out[n] = carry;
    out.length = n + 1;
    return out;
  }
  out.length = n;
  return out;
}

function subMag(a, aLen, b, bLen) {
  const out = new Array(aLen);
  let borrow = 0;
  for (let i = 0; i < aLen; i++) {
    let word = a[i] - (i < bLen ? b[i] : 0) - borrow;
    if (word < 0) {
      word += BASE;
      borrow = 1;
    } else {
      borrow = 0;
    }
    out[i] = word;
  }
  if (borrow !== 0) throw new Error('bigint magnitude underflow');
  let length = aLen;
  while (length > 0 && out[length - 1] === 0) length--;
  out.length = length;
  return out;
}

export function add(a, b) {
  const left = load(a, false);
  const right = load(b, false);
  if (left === null || right === null) return RESOURCE_LIMIT;
  if (left.sign === 0) return pack(right.sign, right.limbs);
  if (right.sign === 0) return pack(left.sign, left.limbs);
  if (left.sign === right.sign) {
    const sum = addMag(left.limbs, left.length, right.limbs, right.length);
    if (sum === null) return RESOURCE_LIMIT;
    return pack(left.sign, sum);
  }
  const mag = cmpMag(left.limbs, left.length, right.limbs, right.length);
  if (mag === 0) return zero();
  if (mag > 0) return pack(left.sign, subMag(left.limbs, left.length, right.limbs, right.length));
  return pack(right.sign, subMag(right.limbs, right.length, left.limbs, left.length));
}

export function sub(a, b) {
  const right = load(b, false);
  if (right === null) return RESOURCE_LIMIT;
  if (right.sign === 0) return add(a, zero());
  return add(a, { sign: -right.sign, length: right.length, limbs: right.limbs });
}

// 32x32 -> 64. Inputs are u32. The wide partial sum stays below 2^53.
function mul32(a, b) {
  const a0 = a & 65535;
  const a1 = a >>> 16;
  const b0 = b & 65535;
  const b1 = b >>> 16;
  const p00 = a0 * b0;
  const p01 = a0 * b1;
  const p10 = a1 * b0;
  const p11 = a1 * b1;
  const mid = p01 + p10;
  const midLo = mid % 65536;
  const midHi = Math.floor(mid / 65536);
  const low = p00 + midLo * 65536;
  return {
    lo: low % BASE,
    hi: p11 + midHi + Math.floor(low / BASE),
  };
}

function mulMag(a, aLen, b, bLen) {
  const acc = new Array(MAX_LIMBS);
  for (let i = 0; i < MAX_LIMBS; i++) acc[i] = 0;
  for (let i = 0; i < aLen; i++) {
    let carry = 0;
    for (let j = 0; j < bLen; j++) {
      const p = mul32(a[i], b[j]);
      const sum = acc[i + j] + p.lo + carry;
      acc[i + j] = sum >>> 0;
      // carry stays below 2^33 while sum stays below 2^34. Both are exact.
      carry = p.hi + Math.floor(sum / BASE);
    }
    let slot = i + bLen;
    let spill = carry;
    for (let step = 0; step < 4; step++) {
      if (spill === 0) break;
      if (slot >= MAX_LIMBS) return null;
      const combined = acc[slot] + spill;
      acc[slot] = combined >>> 0;
      spill = Math.floor(combined / BASE);
      slot += 1;
    }
    if (spill !== 0) return null;
  }
  let length = MAX_LIMBS;
  while (length > 0 && acc[length - 1] === 0) length--;
  acc.length = length;
  return acc;
}

export function mul(a, b) {
  const left = load(a, false);
  const right = load(b, false);
  if (left === null || right === null) return RESOURCE_LIMIT;
  if (left.sign === 0 || right.sign === 0) return zero();
  // Canonical high limbs are nonzero, so the product occupies at least this many limbs.
  if (left.length + right.length - 1 > MAX_LIMBS) return RESOURCE_LIMIT;
  const prod = mulMag(left.limbs, left.length, right.limbs, right.length);
  if (prod === null) return RESOURCE_LIMIT;
  return pack(left.sign === right.sign ? 1 : -1, prod);
}

function bitLength(limbs, length) {
  if (length === 0) return 0;
  let top = limbs[length - 1];
  let bits = 0;
  for (let i = 0; i < LIMB_BITS; i++) {
    if (top === 0) break;
    top >>>= 1;
    bits++;
  }
  return (length - 1) * LIMB_BITS + bits;
}

function shl1(rem, rLen, hi) {
  let carry = 0;
  for (let i = 0; i < rLen; i++) {
    const word = rem[i];
    rem[i] = ((word << 1) | carry) >>> 0;
    carry = word >>> 31;
  }
  if (carry !== 0) {
    if (rLen >= MAX_LIMBS) hi = carry;
    else {
      rem[rLen] = carry;
      rLen += 1;
    }
  }
  return { rLen, hi };
}

function addBit(rem, rLen, hi, bit) {
  if (bit === 0) return { rLen, hi };
  let carry = 1;
  for (let i = 0; i < rLen && carry !== 0; i++) {
    const sum = rem[i] + carry;
    rem[i] = sum >>> 0;
    carry = sum > 0xffffffff ? 1 : 0;
  }
  if (carry !== 0) {
    if (rLen >= MAX_LIMBS) hi = 1;
    else {
      rem[rLen] = 1;
      rLen += 1;
    }
  }
  return { rLen, hi };
}

// rem >= v. One subtraction restores rem < v. hi is the 2^(32*MAX_LIMBS) place.
function subV(rem, rLen, hi, v, vLen) {
  const width = hi !== 0 ? MAX_LIMBS : (rLen > vLen ? rLen : vLen);
  let borrow = 0;
  for (let i = 0; i < width; i++) {
    let word = (i < rLen ? rem[i] : 0) - (i < vLen ? v[i] : 0) - borrow;
    if (word < 0) {
      word += BASE;
      borrow = 1;
    } else {
      borrow = 0;
    }
    rem[i] = word;
  }
  if (borrow !== 0) {
    if (hi === 0) throw new Error('bigint div invariant');
    hi = 0;
  }
  if (hi !== 0) throw new Error('bigint div invariant');
  let len = width;
  while (len > 0 && rem[len - 1] === 0) len--;
  for (let i = len; i < width; i++) rem[i] = 0;
  return { rLen: len, hi: 0 };
}

function divModMag(u, uLen, v, vLen) {
  const rem = new Array(MAX_LIMBS);
  for (let i = 0; i < MAX_LIMBS; i++) rem[i] = 0;
  const quot = new Array(uLen);
  for (let i = 0; i < uLen; i++) quot[i] = 0;
  let rLen = 0;
  let hi = 0;
  const bits = bitLength(u, uLen);
  for (let limb = uLen - 1; limb >= 0; limb--) {
    for (let b = LIMB_BITS - 1; b >= 0; b--) {
      const bitIndex = limb * LIMB_BITS + b;
      if (bitIndex >= bits) continue;
      if (hi !== 0) throw new Error('bigint div invariant');
      let shifted = shl1(rem, rLen, hi);
      rLen = shifted.rLen;
      hi = shifted.hi;
      const bit = (u[limb] & ((1 << b) >>> 0)) !== 0 ? 1 : 0;
      shifted = addBit(rem, rLen, hi, bit);
      rLen = shifted.rLen;
      hi = shifted.hi;
      const mag = hi !== 0 ? 1 : cmpMag(rem, rLen, v, vLen);
      if (mag >= 0) {
        shifted = subV(rem, rLen, hi, v, vLen);
        rLen = shifted.rLen;
        hi = shifted.hi;
        quot[limb] = (quot[limb] | ((1 << b) >>> 0)) >>> 0;
      }
    }
  }
  let qLen = quot.length;
  while (qLen > 0 && quot[qLen - 1] === 0) qLen--;
  quot.length = qLen;
  return { quot, rem: rem.slice(0, rLen) };
}

function divParts(a, b) {
  const left = load(a, false);
  const right = load(b, false);
  if (left === null || right === null) return { limit: true };
  if (right.length === 0) return { divZero: true };
  if (left.length === 0) return { quot: [], rem: [], sign: 0, remSign: 0 };
  const parts = divModMag(left.limbs, left.length, right.limbs, right.length);
  return {
    quot: parts.quot,
    rem: parts.rem,
    sign: left.sign === right.sign ? 1 : -1,
    remSign: left.sign,
  };
}

// Truncates toward zero. Remainder sign matches the dividend. Both match ES.
export function divTrunc(a, b) {
  const parts = divParts(a, b);
  if (parts.limit) return RESOURCE_LIMIT;
  if (parts.divZero) return DIV_ZERO;
  return pack(parts.sign, parts.quot);
}

export function remTrunc(a, b) {
  const parts = divParts(a, b);
  if (parts.limit) return RESOURCE_LIMIT;
  if (parts.divZero) return DIV_ZERO;
  return pack(parts.remSign, parts.rem);
}
