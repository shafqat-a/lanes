import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { numberWords } from '../../program.js';
import {
  BIGINT_HEADER_KEY, BIGINT_POOL_SENTINEL, HEAP_KIND_BIGINT_LIMBS, HEAP_LIMIT, MAX_LIMBS, TAG_BIGINT,
  STRICT_EQUALITY_TABLE, appendBigIntPool, decodeBigIntValue, encodeLimbs, fromTwosComplementLimbs,
  limbChunkNode, limbHeaderNode, makeBigIntValue, readBigIntPool, sameValueBigInt, signBits, strictEqualTag,
} from './representation.js';
import { packBigIntLiteral, unpackToDecimal } from './pack-literal.js';
import {
  BIGINT_CALL_ID, BIGINT_CONSTRUCTOR_NODE, BIGINT_LENGTH, BIGINT_NAME, BIGINT_PROTOTYPE_NODE,
  bigintBuiltinOutcome, bigintBuiltins, bigintPending, bigintPropertyDescriptors, equalityNotes,
  jsonStringifyBigInt, nextFreeBigIntBuiltinId, typeofBigInt,
} from './builtins.js';

const MASK = (1n << 32n) - 1n;

function oracleLimbs(value) {
  if (value === 0n) return { sign: 0, limbs: [] };
  const sign = value < 0n ? -1 : 1;
  let mag = value < 0n ? -value : value;
  const limbs = [];
  while (mag > 0n) {
    limbs.push(Number(mag & MASK));
    mag >>= 32n;
  }
  return { sign, limbs };
}

function toTwos(value) {
  if (value === 0n) return [0];
  const negative = value < 0n;
  let mag = negative ? -value : value;
  const limbs = [];
  while (mag > 0n) {
    limbs.push(Number(mag & MASK));
    mag >>= 32n;
  }
  if (!negative) {
    if (limbs[limbs.length - 1] & 0x80000000) limbs.push(0);
    return limbs;
  }
  let carry = 1;
  const out = limbs.map(limb => {
    const sum = (limb ^ 0xffffffff) + carry;
    carry = sum > 0xffffffff ? 1 : 0;
    return sum >>> 0;
  });
  if ((out[out.length - 1] & 0x80000000) === 0) out.push(0xffffffff);
  return out;
}

function canonicalDecimal(token) {
  let text = token.endsWith('n') ? token.slice(0, -1) : token;
  text = text.replaceAll('_', '');
  if (text === '-0' || text === '-0x0' || text === '-0b0' || text === '-0o0') return '0';
  return BigInt(text).toString();
}

test('value word uses the engine tag lane and preserves the heap index', () => {
  assert.deepEqual(numberWords(1), [0, 0x3ff00000, 0, 0]);
  assert.equal(numberWords(1, 0)[2], 0);
  const word = makeBigIntValue(29);
  assert.deepEqual(word, [29, 0, TAG_BIGINT, 0]);
  assert.equal(decodeBigIntValue(word), 29);
  assert.equal(decodeBigIntValue(makeBigIntValue(HEAP_LIMIT - 1)), HEAP_LIMIT - 1);
  assert.throws(() => decodeBigIntValue(numberWords(1)), /not bigint/);
  assert.throws(() => decodeBigIntValue([4, 0, 4, 0]), /not bigint/);
  assert.throws(() => makeBigIntValue(0), RangeError);
  assert.throws(() => makeBigIntValue(HEAP_LIMIT), RangeError);
});

test('literal roundtrip matches the host oracle inside the limb bound', () => {
  const forty = '9'.repeat(40);
  const samples = ['0', '1', '-1', '4294967295', '4294967296', '9007199254740993', forty, '-0', '0n', '-1n', '-0n'];
  for (const token of samples) {
    const packed = packBigIntLiteral(token);
    assert.equal(packed.tag, TAG_BIGINT, token);
    assert.equal(packed.kind, undefined, token);
    const expected = oracleLimbs(BigInt(canonicalDecimal(token)));
    assert.deepEqual({ sign: packed.sign, limbs: packed.limbs }, expected, token);
    assert.equal(unpackToDecimal(packed.sign, packed.limbs), canonicalDecimal(token), token);
  }
  assert.equal(packBigIntLiteral('-0').sign, 0);
  assert.deepEqual(packBigIntLiteral('-0').limbs, []);
  assert.equal(unpackToDecimal(0, []), '0');
  const safe = packBigIntLiteral('9007199254740993');
  assert.deepEqual(safe.limbs, [1, 0x200000]);
  assert.deepEqual(packBigIntLiteral('4294967296').limbs, [0, 1]);
});

test('prefixed literals and separators', () => {
  for (const token of ['0xff', '0XFF', '0xffn', '0b1010', '0B1010', '0o755', '0O755', '1_000', '0xff_ff']) {
    const packed = packBigIntLiteral(token);
    assert.equal(packed.kind, undefined, token);
    assert.equal(unpackToDecimal(packed.sign, packed.limbs), canonicalDecimal(token), token);
    assert.deepEqual(packed.limbs, oracleLimbs(BigInt(canonicalDecimal(token))).limbs, token);
  }
  assert.equal(unpackToDecimal(packBigIntLiteral('0o755').sign, packBigIntLiteral('0o755').limbs), '493');
  assert.equal(packBigIntLiteral('-0x0').sign, 0);
});

test('syntax rejects and limb overflow', () => {
  for (const token of ['', '+', '0x', '0b', '0o', '+1', '1e2', '1.5', '0x_1', '--1', '0xg', 'n', '1n2', '1__0', '1_']) {
    const packed = packBigIntLiteral(token);
    assert.equal(packed.kind, 'syntax', token);
    assert.equal(packed.code, 'bigint-literal', token);
  }
  const over = (1n << 2048n).toString();
  const fit = ((1n << 2048n) - 1n).toString();
  const overflow = packBigIntLiteral(over);
  assert.deepEqual({ kind: overflow.kind, code: overflow.code }, { kind: 'resource-limit', code: 'bigint-limbs' });
  const max = packBigIntLiteral(fit);
  assert.equal(max.kind, undefined);
  assert.equal(max.limbs.length, MAX_LIMBS);
  assert.equal(unpackToDecimal(max.sign, max.limbs), fit);
  assert.equal(packBigIntLiteral('9'.repeat(700)).kind, 'resource-limit');
});

test('canonical limb checks and two\'s complement import', () => {
  assert.throws(() => encodeLimbs(0, [0]), /non-canonical/);
  assert.throws(() => encodeLimbs(1, [1, 0]), /non-canonical/);
  assert.throws(() => encodeLimbs(-1, []), /non-canonical/);
  assert.throws(() => encodeLimbs(2, [1]), /non-canonical/);
  assert.equal(encodeLimbs(1, new Array(MAX_LIMBS + 1).fill(1)).code, 'bigint-limbs');
  const values = [0n, 1n, -1n, 4294967296n, -4294967296n, 9007199254740993n, -(1n << 31n), 1n << 31n, (1n << 2048n) - 1n];
  for (const value of values) {
    const converted = fromTwosComplementLimbs(toTwos(value));
    assert.deepEqual({ sign: converted.sign, limbs: converted.limbs }, oracleLimbs(value), value.toString());
  }
  assert.equal(fromTwosComplementLimbs(new Array(MAX_LIMBS + 2).fill(0)).kind, 'resource-limit');
});

test('constant-pool records use four-lane headers and roundtrip', () => {
  const image = [[0, 0, 0, 0], [0, 0, 0, 0]];
  const zero = appendBigIntPool(image, 0, []);
  assert.equal(image[zero][3], zero);
  assert.equal(image[zero][2] & 0xffff0000, BIGINT_POOL_SENTINEL);
  assert.notEqual(image[zero][2], TAG_BIGINT);
  assert.deepEqual(readBigIntPool(image, zero), { tag: TAG_BIGINT, sign: 0, length: 0, limbs: [] });
  const packed = packBigIntLiteral('0x1_0000_0005');
  const index = appendBigIntPool(image, packed.sign, packed.limbs);
  const again = readBigIntPool(image, index);
  assert.equal(unpackToDecimal(again.sign, again.limbs), canonicalDecimal('0x100000005'));
  assert.equal(image[index][0] + Math.ceil(packed.limbs.length / 4), index);
  const wide = packBigIntLiteral('0x' + 'ff'.repeat(20));
  const wideIndex = appendBigIntPool(image, wide.sign, wide.limbs);
  assert.equal(readBigIntPool(image, wideIndex).limbs.length, 5);
  assert.equal(image[wideIndex - 1][0], 0xffffffff);
  assert.equal(image[wideIndex - 1][1], 0);
  const node = limbHeaderNode(encodeLimbs(wide.sign, wide.limbs), 1, image[wideIndex][0]);
  assert.equal(node.kind, HEAP_KIND_BIGINT_LIMBS);
  assert.equal(node.key, BIGINT_HEADER_KEY);
  assert.equal(node.value[0], signBits(1));
  assert.equal(node.value[2], 1);
  const chunk = limbChunkNode(0, wide.limbs.slice(0, 4), 0);
  assert.equal(chunk.kind, HEAP_KIND_BIGINT_LIMBS);
  assert.notEqual(chunk.key, BIGINT_HEADER_KEY);
});

test('strict equality is by tag, then by mathematical limbs', () => {
  let next = 40;
  function side(text, tag) {
    if (tag === 0) return { word: numberWords(Number(text)) };
    const packed = packBigIntLiteral(text);
    const word = makeBigIntValue(next++);
    return { word, sign: packed.sign, limbs: packed.limbs };
  }
  for (const row of STRICT_EQUALITY_TABLE) {
    const left = side(row.left, row.leftTag);
    const right = side(row.right, row.rightTag);
    assert.equal(strictEqualTag(left, right), row.equal, `${row.left}:${row.leftTag} ${row.right}:${row.rightTag}`);
  }
  assert.equal(strictEqualTag(makeBigIntValue(9), numberWords(1)), false);
  assert.equal(strictEqualTag(makeBigIntValue(9), makeBigIntValue(9)), true);
  assert.equal(strictEqualTag(makeBigIntValue(9), makeBigIntValue(10)), false);
  const one = packBigIntLiteral('1');
  const numberOne = numberWords(1);
  assert.equal(strictEqualTag({ word: makeBigIntValue(3), sign: one.sign, limbs: one.limbs }, { word: numberOne, sign: 1, limbs: [1] }), false);
  assert.equal(strictEqualTag(
    { word: makeBigIntValue(29), sign: one.sign, limbs: one.limbs },
    { word: makeBigIntValue(80), sign: one.sign, limbs: one.limbs },
  ), true);
  assert.equal(sameValueBigInt(one, packBigIntLiteral('0x1')), true);
  assert.equal(sameValueBigInt(one, packBigIntLiteral('2')), false);
  assert.equal(equalityNotes.strictMixedNumber, false);
});

test('constructor factory is incomplete on purpose', () => {
  assert.equal(bigintBuiltins.length, 1);
  assert.equal(BIGINT_CALL_ID, 1150);
  assert.equal(nextFreeBigIntBuiltinId, 1151);
  assert.equal(BIGINT_CONSTRUCTOR_NODE, 29);
  assert.equal(BIGINT_PROTOTYPE_NODE, 30);
  assert.equal(BIGINT_NAME, 'BigInt');
  assert.equal(BIGINT_LENGTH, 1);
  assert.deepEqual(bigintBuiltinOutcome(1150, 'construct', 1), { kind: 'type-error', code: 'bigint-new', status: 4 });
  assert.deepEqual(bigintBuiltinOutcome(1150, 'call', '1'), { kind: 'unsupported', code: 'bigint-tobigint', status: 6 });
  assert.notEqual(typeof bigintBuiltinOutcome(1150, 'call', 1), 'number');
  assert.equal(bigintBuiltins[0].constructable, false);
  assert.deepEqual(bigintBuiltins[0].value, [1150, 0, 11, 0]);
  const names = bigintPropertyDescriptors.map(item => `${item.ownerName}.${item.key}`);
  assert.deepEqual(names, ['BigInt.length', 'BigInt.name', 'BigInt.prototype', 'BigInt.prototype.constructor']);
  assert.equal(bigintPropertyDescriptors[0].flags, 4);
  assert.equal(bigintPropertyDescriptors[0].valueKind, 'number');
  assert.equal(bigintPending.some(item => item.name === 'toString' && item.outcome === 'unsupported'), true);
  assert.equal(bigintPending.some(item => item.name === 'valueOf'), true);
  assert.equal(bigintPending.some(item => item.name === 'asString'), false);
  assert.equal(jsonStringifyBigInt.outcome, 'type-error');
  assert.equal(jsonStringifyBigInt.pending, true);
  assert.equal(typeofBigInt.result, 'bigint');
  assert.equal(typeofBigInt.tag, 18);
  for (const item of [...bigintBuiltins, ...bigintPending]) {
    const id = item.id;
    if (id !== undefined) assert.ok(id >= 1150 && id <= 1179);
  }
});

test('implementation files do not call host BigInt', () => {
  for (const file of ['representation.js', 'pack-literal.js', 'builtins.js']) {
    const text = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
    assert.equal(/\bBigInt\s*\(/.test(text), false, file);
    assert.equal(/\d+n\b/.test(text), false, file);
  }
});

test('wgsl fragment rejects a wrong kind and records integration gaps', () => {
  const text = readFileSync(new URL('./bigint-bridge.wgsl', import.meta.url), 'utf8');
  assert.match(text, /value\.z != BIGINT_TAG/);
  assert.match(text, /node\.kind != BIGINT_KIND/);
  assert.match(text, /INTEGRATION_GAPS/);
  assert.match(text, /0x42490000u/);
  assert.match(text, /materialize_bigint/);
  assert.equal(TAG_BIGINT, 18);
  assert.equal(HEAP_KIND_BIGINT_LIMBS, 19);
  assert.equal(MAX_LIMBS, 64);
});
