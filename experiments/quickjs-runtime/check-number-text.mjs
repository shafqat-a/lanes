// Host algorithm check only; this is not an execution backend.
import assert from 'node:assert/strict';
import { numberTextSource } from './number-text-source.js';
import { numberTextCases } from './number-text-cases.js';
const bytes = new DataView(new ArrayBuffer(8));
let descriptors = 0;
// Stand-ins for the private string intrinsics. They capture the host methods,
// so guest-visible String.prototype mutation cannot reach them, and assert the
// native contract: primitive string text, primitive integer positions.
const hostCharCodeAt = String.prototype.charCodeAt, hostSlice = String.prototype.slice;
const position = n => { assert.equal(typeof n, 'number'); assert(Number.isInteger(n), `position ${n}`); };
const format = new Function('__lanesDescriptor', '__lanesNumberWord', '__lanesCharCodeAt', '__lanesSlice', `return (${numberTextSource})`)(
  () => { descriptors++; return Object.create(null); },
  (value, index) => { bytes.setFloat64(0, value, true); return bytes.getUint32(index * 4, true); },
  (text, n) => { assert.equal(typeof text, 'string'); position(n); return Reflect.apply(hostCharCodeAt, text, [n]); },
  (text, from, to) => {
    assert.equal(typeof text, 'string'); position(from); if (to !== undefined) position(to);
    return Reflect.apply(hostSlice, text, [from, to]);
  },
);
assert.equal(numberTextSource.includes('.charCodeAt('), false);
assert.equal(numberTextSource.includes('.slice('), false);
const randomCount = Number(process.env.LANES_NUMBER_TEXT_RANDOM ?? 10000);
assert(Number.isSafeInteger(randomCount) && randomCount >= 0 && randomCount <= 1000000,
  'LANES_NUMBER_TEXT_RANDOM must be an integer from 0 to 1000000');
const cases = numberTextCases(randomCount);
// Powers of two have asymmetric rounding intervals. Check both neighbors,
// signs and the halfway region within every normal exponent bin.
for (let exponent = 1; exponent < 2047; exponent++) {
  const high = exponent << 20;
  for (const [low, top] of [[0, high], [1, high], [0xffffffff, high - 1],
    [0xffffffff, high | 0x7ffff], [0, high | 0x80000], [1, high | 0x80000]]) {
    bytes.setUint32(0, low, true); bytes.setUint32(4, top, true);
    const value = bytes.getFloat64(0, true);
    cases.push(value, -value);
  }
}
let maxDescriptors = 0;
for (const value of cases) {
  descriptors = 0;
  assert.equal(format(value), String(value), `Number formatting: ${value}`);
  maxDescriptors = Math.max(maxDescriptors, descriptors);
}
// Scratch descriptors must remain bounded independently of significand length.
assert(maxDescriptors <= 12, `Unexpected formatter descriptor churn: ${maxDescriptors}`);
// Poisoned public methods must not change any result. Expected text is
// computed before poisoning because String(number) is unaffected anyway.
const savedCharCodeAt = String.prototype.charCodeAt, savedSlice = String.prototype.slice;
const poisonCases = cases.slice(0, 2000);
const poisonExpected = poisonCases.map(value => String(value));
try {
  String.prototype.charCodeAt = () => { throw new Error('numberTextSource read String.prototype.charCodeAt'); };
  String.prototype.slice = () => { throw new Error('numberTextSource read String.prototype.slice'); };
  for (let i = 0; i < poisonCases.length; i++) assert.equal(format(poisonCases[i]), poisonExpected[i]);
} finally {
  String.prototype.charCodeAt = savedCharCodeAt; String.prototype.slice = savedSlice;
}
console.log(JSON.stringify({ hostAlgorithmChecks: cases.length, poisonedChecks: poisonCases.length, randomCount, maxDescriptors, gpuChecks: false }));
