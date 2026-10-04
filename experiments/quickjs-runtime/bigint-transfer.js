// API serialization only: these operations marshal host input/output values.
// Every guest operation, including arithmetic and conversion, still runs on GPU.
const MAX_LIMBS = 64;
export function packBigIntInput(value, image) {
  if (typeof value !== 'bigint') throw new TypeError('Expected BigInt input');
  const negative = value < 0n;
  let remaining = negative ? -value : value;
  const limbs = [];
  for (let i = 0; i < MAX_LIMBS && remaining !== 0n; i++) {
    limbs.push(Number(remaining & 0xffffffffn)); remaining >>= 32n;
  }
  if (remaining !== 0n) throw new RangeError('GPU bigint limit: 64 limbs');
  const start = image.length / 4;
  for (let i = 0; i < limbs.length; i += 4)
    image.push(limbs[i], limbs[i+1] ?? 0, limbs[i+2] ?? 0, limbs[i+3] ?? 0);
  const pool = image.length / 4;
  const sign = limbs.length === 0 ? 0 : negative ? 2 : 1;
  image.push(limbs.length === 0 ? 0 : start, limbs.length, 0x42490000 | sign, pool);
  // Before the first dispatch this is a pool reference. Initialization
  // materializes it into the normal tag-18 heap representation exactly once.
  return [pool, Number(limbs.length !== 0), 18, 0];
}
export function unpackBigIntOutput(words, offset) {
  const sign = words[offset], length = words[offset+1];
  if (!Number.isInteger(length) || length < 0 || length > MAX_LIMBS ||
      offset+4+length > words.length || words[offset+2] !== 18 || words[offset+3] !== 0 ||
      (length === 0 ? sign !== 0 : sign !== 1 && sign !== 0xffffffff) ||
      (length > 0 && words[offset+3+length] === 0))
    throw new TypeError('Invalid GPU BigInt output encoding');
  let value = 0n;
  for (let i = length; i > 0; i--) value = (value << 32n) | BigInt(words[offset+3+i]);
  return sign === 0xffffffff ? -value : value;
}
