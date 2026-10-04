// These values exercise formatting, not parsing: bit neighbors are constructed
// explicitly so the oracle cannot round a decimal fixture before the test.
export function numberTextCases(randomCount = 2000) {
  const cases = [0, -0, NaN, Infinity, -Infinity, 0.1, 1.25, 1e-6, 1e-7, 1e20, 1e21,
    1e23, 1000000000000000100, Number.MIN_VALUE, Number.MAX_VALUE, 2 ** -1022,
    2 ** 53, 2 ** 53 - 1, 1.0000000000000002, 0.9999999999999999,
    // Historical shortest-decimal and carry/nearest-choice cases.
    1.0000000000000001e18, 1.0000000000000003e18, 1000000000000000128,
    1000000000000000256, 2.225073858507201e-308, 2.2250738585072014e-308,
    2.9802322387695312e-8, 1.2345678901234567, 9.999999999999998,
    0.0000010000000000000002, 1.7976931348623155e308];
  const bytes = new DataView(new ArrayBuffer(8));
  const neighbors = value => {
    bytes.setFloat64(0, value, true);
    const bits = bytes.getBigUint64(0, true);
    for (const delta of [-1n, 0n, 1n]) {
      bytes.setBigUint64(0, bits + delta, true);
      const next = bytes.getFloat64(0, true);
      cases.push(next, -next);
    }
  };
  // Decimal presentation cutoffs, decade carries, and extreme exponents.
  for (const power of [-323, -308, -100, -7, -6, -5, -1, 0, 1, 15, 16, 20, 21, 22, 100, 307, 308]) {
    neighbors(10 ** power);
  }
  // Even/odd endpoints at the smallest subnormals and across limb boundaries.
  for (const bits of [1n, 2n, 3n, 7n, 8n, 9n, 0xffffffffn, 0x100000000n,
    0x100000001n, 0x7ffffffffffffn, 0x8000000000000n, 0xfffffffffffffn]) {
    bytes.setBigUint64(0, bits, true);
    const value = bytes.getFloat64(0, true);
    cases.push(value, -value);
  }
  let seed = 0x5ab12fed;
  const word = () => seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  for (let i = 0; i < randomCount; i++) {
    bytes.setUint32(0, word(), true); bytes.setUint32(4, word(), true);
    cases.push(bytes.getFloat64(0, true));
  }
  return cases;
}
