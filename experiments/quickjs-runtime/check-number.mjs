// Independent host-side algorithm validation, not a runtime execution backend.
import assert from 'node:assert/strict';
import { numberSource } from './number-source.js';
import { numberCases } from './number-cases.js';

// Stand-ins for the private string intrinsics. They capture the host methods,
// so guest-visible String.prototype mutation cannot reach them, and assert the
// native contract: primitive string text, primitive integer positions.
const hostCharCodeAt = String.prototype.charCodeAt, hostSlice = String.prototype.slice;
const position = n => { assert.equal(typeof n, 'number'); assert(Number.isInteger(n), `position ${n}`); };
let intrinsicReads = 0;
const charCodeAtStandIn = (text, n) => {
  assert.equal(typeof text, 'string'); position(n); intrinsicReads++;
  return Reflect.apply(hostCharCodeAt, text, [n]);
};
const sliceStandIn = (text, from, to) => {
  assert.equal(typeof text, 'string'); position(from); if (to !== undefined) position(to); intrinsicReads++;
  return Reflect.apply(hostSlice, text, [from, to]);
};
const parse = new Function('__lanesDescriptor', '__lanesCall', '__lanesFromBits', '__lanesCharCodeAt', '__lanesSlice', `return (${numberSource})`)(
  () => Object.create(null), (fn, receiver) => Reflect.apply(fn, receiver, []),
  (low, high) => {
    const bytes = new DataView(new ArrayBuffer(8));
    bytes.setUint32(0, low, true); bytes.setUint32(4, high, true);
    return bytes.getFloat64(0, true);
  },
  charCodeAtStandIn, sliceStandIn,
);
assert.equal(numberSource.includes('.charCodeAt('), false);
assert.equal(numberSource.includes('.slice('), false);
const strings = numberCases();
for (const value of strings) assert(Object.is(parse(value), Number(value)), `Numeric conversion: ${JSON.stringify(value)}`);
assert(intrinsicReads > 0);
// Poisoned public methods must not change any result.
const savedCharCodeAt = String.prototype.charCodeAt, savedSlice = String.prototype.slice;
let poisoned = 0;
try {
  String.prototype.charCodeAt = () => { throw new Error('numberSource read String.prototype.charCodeAt'); };
  String.prototype.slice = () => { throw new Error('numberSource read String.prototype.slice'); };
  for (const value of strings) { assert(Object.is(parse(value), Reflect.apply(Number, undefined, [value]))); poisoned++; }
} finally {
  String.prototype.charCodeAt = savedCharCodeAt; String.prototype.slice = savedSlice;
}
for (const value of [0, -0, true, false, null, undefined, NaN, Infinity]) assert(Object.is(parse(value), Number(value)));
assert.equal(parse(), 0);
assert.equal(parse({ valueOf() { return '0.1'; } }), 0.1);
assert.equal(parse({ valueOf() { return {}; }, toString() { return '0x10'; } }), 16);
assert.throws(() => parse({ valueOf() { return {}; }, toString() { return {}; } }), TypeError);
console.log(JSON.stringify({ hostAlgorithmChecks: strings.length + 12, poisonedChecks: poisoned, gpuChecks: false }));
