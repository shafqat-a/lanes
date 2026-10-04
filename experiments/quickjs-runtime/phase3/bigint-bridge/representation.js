// Guest BigInt value layout. Matches shader.js `alias V = vec4<u32>` and
// program.js numberWords: four little-endian u32 lanes, tag in lane 2.
// Not NaN-boxed. QuickJS JSBigInt (vendor/quickjs.c) is two's complement and
// is not this layout; see fromTwosComplementLimbs.

export const TAG_BIGINT = 18;
export const HEAP_KIND_BIGINT_LIMBS = 19;
export const MAX_LIMBS = 64;
// program.js LIMITS.heap. Index 0 is the empty reference.
export const HEAP_LIMIT = 2048;

// Pool header lane 2. Low 2 bits are the sign code. Not a value tag.
export const BIGINT_POOL_SENTINEL = 0x42490000;
// Kind-19 header Node.key. Limb chunks use the limb base instead.
export const BIGINT_HEADER_KEY = 0x42490000;
export const BIGINT_STORAGE_HEAP = 0;
export const BIGINT_STORAGE_IMAGE = 1;

export const VALUE_WORD = Object.freeze({
  lanes: 4,
  payloadLane: 0,
  tagLane: 2,
  endian: 'little',
  // shader.js:36 alias V; program.js:48 numberWords sets lane 2 to the tag.
  tagShift: 0,
  tagMask: 0xffffffff,
});

const LIMIT = () => ({ kind: 'resource-limit', code: 'bigint-limbs' });

function copyLimbs(u32Array) {
  if (ArrayBuffer.isView(u32Array)) {
    if (u32Array instanceof DataView) throw new TypeError('bigint limbs');
    return Array.from(u32Array);
  }
  if (!Array.isArray(u32Array)) throw new TypeError('bigint limbs');
  return u32Array.slice();
}

function limbU32(value) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new TypeError('bigint limb');
  }
  return value >>> 0;
}

export function signCode(sign) {
  if (sign === 0) return 0;
  if (sign === 1) return 1;
  if (sign === -1) return 2;
  throw new TypeError('bigint sign');
}

export function signFromCode(code) {
  if (code === 0) return 0;
  if (code === 1) return 1;
  if (code === 2) return -1;
  throw new TypeError('bigint sign code');
}

// Node.value.x bit pattern. -1 is 0xffffffff, not a negative zero.
export function signBits(sign) {
  if (sign === 0) return 0;
  if (sign === 1) return 1;
  if (sign === -1) return 0xffffffff;
  throw new TypeError('bigint sign');
}

export function signFromBits(bits) {
  const u = bits >>> 0;
  if (u === 0) return 0;
  if (u === 1) return 1;
  if (u === 0xffffffff) return -1;
  throw new TypeError('bigint sign bits');
}

export function makeBigIntValue(heapIndex) {
  if (!Number.isInteger(heapIndex) || heapIndex < 1 || heapIndex >= HEAP_LIMIT) {
    throw new RangeError('bigint heap index');
  }
  return [heapIndex, 0, TAG_BIGINT, 0];
}

export function decodeBigIntValue(word) {
  if (!Array.isArray(word) || word.length !== 4 || word[2] !== TAG_BIGINT || word[1] !== 0 || word[3] !== 0) {
    throw new TypeError('value tag is not bigint');
  }
  const heapIndex = word[0];
  if (!Number.isInteger(heapIndex) || heapIndex < 1 || heapIndex >= HEAP_LIMIT) {
    throw new TypeError('value tag is not bigint');
  }
  return heapIndex;
}

// Canonical sign-magnitude. Zero is sign 0 and no limbs. No negative zero.
// A high zero limb is non-canonical. Over-long input is a resource limit,
// not a second value format.
export function encodeLimbs(sign, u32Array) {
  if (sign !== -1 && sign !== 0 && sign !== 1) throw new TypeError('non-canonical bigint limbs');
  const limbs = copyLimbs(u32Array).map(limbU32);
  if (limbs.length > MAX_LIMBS) return LIMIT();
  if (sign === 0) {
    if (limbs.length !== 0) throw new TypeError('non-canonical bigint limbs');
  } else if (limbs.length === 0 || limbs[limbs.length - 1] === 0) {
    throw new TypeError('non-canonical bigint limbs');
  }
  return { sign, length: limbs.length, limbs };
}

export function sameValueBigInt(left, right) {
  const a = encodeLimbs(left.sign, left.limbs);
  const b = encodeLimbs(right.sign, right.limbs);
  if (a.kind || b.kind) throw new RangeError('bigint limbs');
  if (a.sign !== b.sign || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a.limbs[i] !== b.limbs[i]) return false;
  return true;
}

// Strict equality is false across tags. Number tag 0 never equals tag 18.
// Two tag-18 words compare mathematically when both sides carry limbs;
// otherwise only the heap index (not a substitute for mathematical equality).
export function strictEqualTag(left, right) {
  const lw = Array.isArray(left) ? left : left && left.word;
  const rw = Array.isArray(right) ? right : right && right.word;
  if (!Array.isArray(lw) || !Array.isArray(rw) || lw.length !== 4 || rw.length !== 4) {
    throw new TypeError('value word');
  }
  if (lw[2] !== rw[2]) return false;
  if (lw[2] !== TAG_BIGINT) return false;
  const leftLimbs = !Array.isArray(left) && left.sign !== undefined;
  const rightLimbs = !Array.isArray(right) && right.sign !== undefined;
  if (!leftLimbs || !rightLimbs) return lw[0] === rw[0] && lw[1] === rw[1] && lw[3] === rw[3];
  return sameValueBigInt(left, right);
}

// Tag 18 compared with tag 0 is false. Two canonical zeros compare equal.
export const STRICT_EQUALITY_TABLE = Object.freeze([
  Object.freeze({ left: '1', leftTag: TAG_BIGINT, right: '1', rightTag: 0, equal: false }),
  Object.freeze({ left: '1', leftTag: TAG_BIGINT, right: '1', rightTag: TAG_BIGINT, equal: true }),
  Object.freeze({ left: '1', leftTag: TAG_BIGINT, right: '2', rightTag: TAG_BIGINT, equal: false }),
  Object.freeze({ left: '-0', leftTag: TAG_BIGINT, right: '0', rightTag: TAG_BIGINT, equal: true }),
]);

export function bigintLimbRecords(limbs) {
  const records = [];
  for (let i = 0; i < limbs.length; i += 4) {
    records.push([
      limbs[i] >>> 0,
      i + 1 < limbs.length ? limbs[i + 1] >>> 0 : 0,
      i + 2 < limbs.length ? limbs[i + 2] >>> 0 : 0,
      i + 3 < limbs.length ? limbs[i + 3] >>> 0 : 0,
    ]);
  }
  return records;
}

// String-style pool header: [offset, length, meta, selfIndex]. Meta is the
// sentinel, not tag 18. The tag-18 word is created only after heap alloc.
export function bigintPoolHeader(offset, length, sign, selfIndex) {
  return [offset >>> 0, length >>> 0, (BIGINT_POOL_SENTINEL | signCode(sign)) >>> 0, selfIndex >>> 0];
}

export function appendBigIntPool(image, sign, limbs) {
  if (!Array.isArray(image)) throw new TypeError('image');
  const encoded = encodeLimbs(sign, limbs);
  if (encoded.kind) return encoded;
  const payload = bigintLimbRecords(encoded.limbs);
  const offset = payload.length === 0 ? 0 : image.length;
  for (const record of payload) image.push(record);
  const self = image.length;
  image.push(bigintPoolHeader(offset, encoded.length, encoded.sign, self));
  return self;
}

export function readBigIntPool(image, index) {
  const header = image[index];
  if (!header || header.length !== 4 || header[3] !== index) throw new TypeError('bigint pool header');
  if ((header[2] & 0xffff0000) !== BIGINT_POOL_SENTINEL) throw new TypeError('bigint pool header');
  const sign = signFromCode(header[2] & 3);
  const length = header[1];
  const offset = header[0];
  if (!Number.isInteger(length) || length < 0 || length > MAX_LIMBS) throw new TypeError('bigint pool header');
  const limbs = [];
  if (length === 0) {
    if (offset !== 0 || sign !== 0) throw new TypeError('bigint pool header');
  } else {
    const records = Math.ceil(length / 4);
    if (!Number.isInteger(offset) || offset < 0 || offset + records > image.length) throw new TypeError('bigint pool header');
    for (let i = 0; i < length; i++) limbs.push(image[offset + (i >>> 2)][i & 3]);
    const rem = length & 3;
    if (rem !== 0) {
      const tail = image[offset + ((length - 1) >>> 2)];
      for (let lane = rem; lane < 4; lane++) if (tail[lane] !== 0) throw new TypeError('bigint pool padding');
    }
  }
  return { tag: TAG_BIGINT, ...encodeLimbs(sign, limbs) };
}

// storage 0: `link` is the first limb-chunk node. storage 1: `link` is the image offset.
export function limbHeaderNode(encoded, storage, link) {
  if (!encoded || encoded.kind) throw new TypeError('bigint limbs');
  if (storage !== BIGINT_STORAGE_HEAP && storage !== BIGINT_STORAGE_IMAGE) throw new TypeError('bigint storage');
  return {
    kind: HEAP_KIND_BIGINT_LIMBS,
    key: BIGINT_HEADER_KEY,
    next: storage === BIGINT_STORAGE_HEAP ? link >>> 0 : 0,
    marked: 0,
    value: [signBits(encoded.sign), encoded.length, storage, storage === BIGINT_STORAGE_IMAGE ? link >>> 0 : 0],
  };
}

export function limbChunkNode(limbBase, limbs, next) {
  if (!Number.isInteger(limbBase) || limbBase < 0 || (limbBase & 3) !== 0 || limbBase >= MAX_LIMBS) {
    throw new TypeError('bigint chunk');
  }
  const value = [0, 0, 0, 0];
  const part = copyLimbs(limbs);
  if (part.length > 4) throw new TypeError('bigint chunk');
  for (let i = 0; i < part.length; i++) value[i] = limbU32(part[i]);
  return { kind: HEAP_KIND_BIGINT_LIMBS, key: limbBase, next: next >>> 0, marked: 0, value };
}

// QuickJS cpool bigints are two's complement (JSBigInt.tab, len >= 1).
// A positive value that uses the top bit of a limb is stored with an extra
// 0 sign limb, so the input may be MAX_LIMBS+1 while the magnitude still fits.
export function fromTwosComplementLimbs(raw) {
  const src = copyLimbs(raw).map(limbU32);
  if (src.length === 0) throw new TypeError('empty twos-complement bigint');
  if (src.length > MAX_LIMBS + 1) return LIMIT();
  const negative = (src[src.length - 1] & 0x80000000) !== 0;
  if (!negative) {
    const mag = src.slice();
    while (mag.length > 1 && mag[mag.length - 1] === 0) mag.pop();
    if (mag.length === 1 && mag[0] === 0) return encodeLimbs(0, []);
    if (mag.length > MAX_LIMBS) return LIMIT();
    return encodeLimbs(1, mag);
  }
  const mag = [];
  let carry = 1;
  for (let i = 0; i < src.length; i++) {
    const sum = (src[i] ^ 0xffffffff) + carry;
    mag.push(sum >>> 0);
    carry = sum > 0xffffffff ? 1 : 0;
  }
  while (mag.length > 0 && mag[mag.length - 1] === 0) mag.pop();
  if (mag.length === 0) throw new TypeError('non-canonical twos-complement bigint');
  if (mag.length > MAX_LIMBS) return LIMIT();
  return encodeLimbs(-1, mag);
}
