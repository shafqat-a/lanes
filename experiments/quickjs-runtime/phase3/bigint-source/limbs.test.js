import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MAX_LIMBS,
  BIGINT_TAG,
  BIGINT_HEAP_KIND,
  RESOURCE_LIMIT,
  DIV_ZERO,
  fromU32,
  fromI32,
  fromLimbs,
  toSign,
  compare,
  equal,
  neg,
  abs,
  add,
  sub,
  mul,
  divTrunc,
  remTrunc,
  isZero,
  isCanonical,
  clone,
  limbCount,
  isResourceLimit,
  isDivZero,
} from './limbs.js';

// Host oracle. Conversions live only in this file.
function toHost(value) {
  assert.equal(isCanonical(value), true);
  let n = 0n;
  for (let i = value.length - 1; i >= 0; i--) n = (n << 32n) + BigInt(value.limbs[i]);
  return value.sign < 0 ? -n : n;
}

function fromHost(n) {
  if (n === 0n) return fromU32(0);
  const sign = n < 0n ? -1 : 1;
  let m = n < 0n ? -n : n;
  const limbs = [];
  while (m > 0n) {
    limbs.push(Number(m & 0xffffffffn));
    m >>= 32n;
  }
  return fromLimbs(sign, limbs);
}

function hostLimbs(n) {
  let m = n < 0n ? -n : n;
  let count = 0;
  while (m > 0n) {
    m >>= 32n;
    count++;
  }
  return count;
}

function expectValue(actual, host) {
  if (hostLimbs(host) > MAX_LIMBS) {
    assert.equal(actual, RESOURCE_LIMIT);
    return;
  }
  assert.equal(isResourceLimit(actual), false);
  assert.equal(toHost(actual), host);
  assert.equal(actual.sign, host === 0n ? 0 : host < 0n ? -1 : 1);
  assert.equal(Object.is(actual.sign, -0), false);
}

function xorshift32(x) {
  x >>>= 0;
  x ^= (x << 13) >>> 0;
  x >>>= 0;
  x ^= x >>> 17;
  x ^= (x << 5) >>> 0;
  return x >>> 0;
}

test('constants and constructors', () => {
  assert.equal(MAX_LIMBS, 64);
  assert.equal(BIGINT_TAG, 18);
  assert.equal(BIGINT_HEAP_KIND, 19);
  assert.deepEqual(RESOURCE_LIMIT, { kind: 'resource-limit', code: 'bigint-limbs' });
  assert.deepEqual(DIV_ZERO, { kind: 'range-error', code: 'bigint-div-zero' });

  const z = fromU32(0);
  const one = fromU32(1);
  const negOne = fromI32(-1);
  assert.deepEqual(z, { sign: 0, length: 0, limbs: [] });
  assert.equal(isZero(z), true);
  assert.equal(toSign(z), 0);
  assert.equal(limbCount(z), 0);
  assert.equal(isCanonical(z), true);
  assert.deepEqual(one, { sign: 1, length: 1, limbs: [1] });
  assert.deepEqual(negOne, { sign: -1, length: 1, limbs: [1] });
  assert.deepEqual(fromI32(0), z);
  assert.deepEqual(fromU32(4294967295), { sign: 1, length: 1, limbs: [4294967295] });
  assert.deepEqual(fromI32(2147483647), { sign: 1, length: 1, limbs: [2147483647] });
  assert.deepEqual(fromI32(-2147483648), { sign: -1, length: 1, limbs: [2147483648] });
  assert.equal(toHost(fromI32(-2147483648)), -2147483648n);
  assert.throws(() => fromU32(-1), RangeError);
  assert.throws(() => fromU32(4294967296), RangeError);
  assert.throws(() => fromU32(1.5), RangeError);
  assert.throws(() => fromI32(2147483648), RangeError);
  assert.throws(() => fromI32(-2147483649), RangeError);
  assert.throws(() => fromLimbs(0, [1]), TypeError);

  const words = [1, 2];
  const owned = fromLimbs(1, words);
  words[0] = 9;
  assert.equal(owned.limbs[0], 1);
  assert.deepEqual(fromLimbs(1, [0]), z);
  assert.deepEqual(fromLimbs(-1, [0, 0]), z);
  assert.equal(fromLimbs(1, new Array(65).fill(0)), RESOURCE_LIMIT);
});

test('powers of two and values past the binary64 exact range', () => {
  const two32 = fromLimbs(1, [0, 1]);
  const two32m1 = fromU32(4294967295);
  const two53 = fromLimbs(1, [0, 2097152]);
  const two53p1 = fromLimbs(1, [1, 2097152]);
  const negTwo53m1 = fromLimbs(-1, [1, 2097152]);
  expectValue(two32, 1n << 32n);
  expectValue(two32m1, (1n << 32n) - 1n);
  expectValue(two53, 1n << 53n);
  expectValue(two53p1, (1n << 53n) + 1n);
  expectValue(negTwo53m1, -((1n << 53n) + 1n));
  assert.equal(Number((1n << 53n) + 1n), Number(1n << 53n));
  assert.equal(equal(two53, two53p1), false);
  assert.notEqual(toHost(two53p1), BigInt(Number(toHost(two53p1))));
  assert.equal(compare(two53, two53p1), -1);
  assert.equal(compare(negTwo53m1, fromI32(-1)), -1);
  assert.equal(compare(two32, two32m1), 1);
});

test('carry, borrow, growth, negation, and canonical zero', () => {
  const ones = fromU32(4294967295);
  expectValue(add(ones, fromU32(1)), 1n << 32n);
  expectValue(add(ones, ones), (1n << 33n) - 2n);
  const two256 = fromLimbs(1, [0, 0, 0, 0, 0, 0, 0, 0, 1]);
  const borrowed = sub(two256, fromU32(1));
  expectValue(borrowed, (1n << 256n) - 1n);
  assert.equal(borrowed.length, 8);
  assert.ok(borrowed.limbs.every(word => word === 4294967295));

  const two32 = fromLimbs(1, [0, 1]);
  const squared = mul(two32, two32);
  expectValue(squared, 1n << 64n);
  assert.equal(squared.length, 3);
  // (2^32-1)^2 = 2^64 - 2^33 + 1.
  expectValue(mul(ones, ones), ((1n << 64n) - (1n << 33n) + 1n));

  for (const sample of [fromU32(0), fromU32(1), fromI32(-1), two256, neg(two256), ones]) {
    const back = neg(neg(sample));
    assert.deepEqual(back, isZero(sample) ? fromU32(0) : sample);
    assert.equal(isCanonical(back), true);
    assert.equal(equal(abs(neg(sample)), abs(sample)), true);
    assert.equal(toSign(abs(sample)), isZero(sample) ? 0 : 1);
  }

  const x = fromLimbs(-1, [7, 8, 9]);
  const zx = sub(x, x);
  const zy = add(x, neg(x));
  assert.equal(zx.sign, 0);
  assert.equal(zx.length, 0);
  assert.deepEqual(zx.limbs, []);
  assert.deepEqual(zy, zx);
  assert.equal(isZero(zx), true);
  assert.equal(Object.is(zx.sign, -0), false);
  assert.equal(compare(x, x), 0);
  assert.equal(Object.is(compare(x, x), 0), true);
  assert.equal(compare(x, abs(x)), -1);
  assert.equal(compare(abs(x), x), 1);
  assert.equal(compare(fromU32(0), fromI32(-1)), 1);
  assert.equal(compare(fromI32(-2), fromI32(-1)), -1);
  assert.equal(compare(fromLimbs(1, [0, 1]), fromU32(1)), 1);

  const bogus = { sign: 1, length: 2, limbs: [1, 0] };
  assert.equal(isCanonical(bogus), false);
  assert.equal(isCanonical(fromU32(1)), true);
  assert.equal(isCanonical({ sign: 1, length: 1, limbs: [1, 0] }), false);
  assert.equal(isCanonical({ sign: -1, length: 0, limbs: [] }), false);
  assert.equal(isCanonical({ sign: 0, length: 1, limbs: [0] }), false);
  const normalized = add(bogus, fromU32(0));
  assert.equal(isCanonical(normalized), true);
  assert.equal(equal(normalized, fromU32(1)), true);
  assert.deepEqual(bogus, { sign: 1, length: 2, limbs: [1, 0] });

  const copy = clone(x);
  copy.limbs[0] = 1;
  assert.equal(x.limbs[0], 7);
  assert.equal(limbCount(borrowed), 8);
  assert.equal(toSign(x), -1);
});

test('resource limit at the 64-limb boundary', () => {
  const full = fromLimbs(1, new Array(MAX_LIMBS).fill(0xffffffff));
  assert.equal(full.length, MAX_LIMBS);
  assert.equal(isCanonical(full), true);
  assert.equal(add(full, fromU32(1)), RESOURCE_LIMIT);
  assert.equal(add(full, full), RESOURCE_LIMIT);
  assert.equal(mul(full, fromU32(2)), RESOURCE_LIMIT);
  assert.equal(isResourceLimit(mul(full, fromU32(2))), true);
  const wide = fromLimbs(1, new Array(33).fill(1));
  assert.equal(mul(wide, wide), RESOURCE_LIMIT);
  assert.equal(sub(full, full).sign, 0);
  expectValue(sub(full, fromU32(1)), (1n << 2048n) - 2n);
  const fits = mul(fromLimbs(1, [0xffffffff, 0xffffffff]), fromU32(2));
  expectValue(fits, ((1n << 64n) - 1n) * 2n);
  assert.notEqual(fits, RESOURCE_LIMIT);
  // 32-limb * 33-limb minimum width is exactly 64; the high product limb fits.
  const a = fromLimbs(1, Array.from({ length: 32 }, (_, i) => (i === 31 ? 1 : 0)));
  const b = fromLimbs(1, Array.from({ length: 33 }, (_, i) => (i === 32 ? 1 : 0)));
  const product = mul(a, b);
  expectValue(product, 1n << (32n * 63n));
  assert.equal(product.length, 64);
  assert.equal(mul(fromLimbs(1, new Array(33).fill(0xffffffff)), fromLimbs(1, new Array(33).fill(0xffffffff))), RESOURCE_LIMIT);
  assert.equal(neg(full).sign, -1);
  assert.equal(neg(full).length, MAX_LIMBS);
  assert.equal(add(RESOURCE_LIMIT, fromU32(1)), RESOURCE_LIMIT);
  assert.equal(mul(fromU32(2), RESOURCE_LIMIT), RESOURCE_LIMIT);
  assert.equal(divTrunc(RESOURCE_LIMIT, fromU32(1)), RESOURCE_LIMIT);
  assert.throws(() => compare(RESOURCE_LIMIT, fromU32(1)), TypeError);
  assert.throws(() => toSign(RESOURCE_LIMIT), TypeError);
});

test('truncating division matches the host oracle, including remainder sign', () => {
  const samples = [0n, 1n, -1n, 2n, -3n, 10n, -10n, 17n, (1n << 32n) - 1n, 1n << 32n, (1n << 53n) + 1n, -((1n << 53n) + 1n), (1n << 96n) - 3n];
  let checks = 0;
  for (const left of samples) {
    for (const right of samples) {
      if (right === 0n) {
        assert.equal(divTrunc(fromHost(left), fromHost(right)), DIV_ZERO);
        assert.equal(remTrunc(fromHost(left), fromHost(right)), DIV_ZERO);
        assert.equal(isDivZero(DIV_ZERO), true);
        checks += 2;
        continue;
      }
      const q = divTrunc(fromHost(left), fromHost(right));
      const r = remTrunc(fromHost(left), fromHost(right));
      expectValue(q, left / right);
      expectValue(r, left % right);
      assert.equal(toHost(q) * right + toHost(r), left);
      checks += 2;
    }
  }
  const full = fromLimbs(1, new Array(MAX_LIMBS).fill(0xffffffff));
  expectValue(divTrunc(full, fromU32(3)), ((1n << 2048n) - 1n) / 3n);
  expectValue(remTrunc(full, fromU32(3)), ((1n << 2048n) - 1n) % 3n);
  expectValue(divTrunc(full, full), 1n);
  expectValue(remTrunc(full, full), 0n);
  const half = fromLimbs(1, Array.from({ length: 64 }, (_, i) => (i === 63 ? 0x80000000 : 0)));
  expectValue(divTrunc(full, half), ((1n << 2048n) - 1n) / (1n << 2047n));
  expectValue(remTrunc(neg(full), fromI32(-3)), (-((1n << 2048n) - 1n)) % -3n);
  checks += 6;
  assert.equal(checks, 344);
  console.log(`div-oracle-checks=${checks}`);
});

test('deterministic xorshift oracle for add, sub, mul, and compare', () => {
  let state = 0xc0ffee01;
  const next = () => {
    state = xorshift32(state);
    return state;
  };
  const values = [0n, 1n, -1n];
  for (let i = 0; i < 12; i++) {
    const n = next() % 9;
    if (n === 0) {
      values.push(0n);
      continue;
    }
    let mag = 0n;
    let top = 0;
    for (let limb = 0; limb < n; limb++) {
      const word = limb === n - 1 ? (next() % 0xffffffff) + 1 : next();
      if (limb === n - 1) top = word;
      mag += BigInt(word) << (32n * BigInt(limb));
    }
    assert.ok(top !== 0);
    values.push((next() & 1) === 0 ? mag : -mag);
  }
  let checks = 0;
  for (let i = 0; i < values.length; i++) {
    for (let j = 0; j < values.length; j++) {
      const left = fromHost(values[i]);
      const right = fromHost(values[j]);
      expectValue(add(left, right), values[i] + values[j]);
      expectValue(sub(left, right), values[i] - values[j]);
      expectValue(mul(left, right), values[i] * values[j]);
      const hostOrder = values[i] < values[j] ? -1 : values[i] > values[j] ? 1 : 0;
      assert.equal(compare(left, right), hostOrder);
      assert.equal(equal(left, right), hostOrder === 0);
      checks += 4;
    }
  }
  // 15 values, 15*15*4 = 900 comparisons against the host integer.
  assert.equal(checks, 900);
  console.log(`oracle-checks=${checks}`);
});

test('guest sources do not use the host integer type', () => {
  for (const name of ['limbs.js', 'limbs.wgsl']) {
    const source = readFileSync(new URL(`./${name}`, import.meta.url), 'utf8');
    assert.equal(/BigInt/.test(source), false, name);
    assert.equal(/(^|[^\w.])\d+n\b/.test(source), false, name);
  }
});
