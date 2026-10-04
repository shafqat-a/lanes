const fixed = [
  '', ' ', '\ufeff\u2028-0\u3000', '1', '-17', '+1.25', '.5', '1.', '1e2', '1e-2',
  'Infinity', '-Infinity', '+Infinity', 'NaN', '1e', '.', '1.2.3', '0x', '+0x1', '-0b1',
  '0x10', '0Xffffffffffffffff', '0b101', '0o777', '0b2', '0o8', '123_456', '1n', '\u00851',
  '0.1', '9007199254740993', '9007199254740995',
  '1.7976931348623157e308', '1.7976931348623158e308', '1.7976931348623159e308',
  '2.2250738585072014e-308', '2.2250738585072011e-308', '5e-324', '2.4703282292062327e-324',
  '2.4703282292062328e-324', '-2.4703282292062327e-324', '1e-99999', '-0e99999',
  '1.00000000000000011102230246251565404236316680908203125',
  '1.00000000000000011102230246251565404236316680908203126',
  '9'.repeat(250) + 'e-250', '0x' + 'f'.repeat(254),
];

export function numberCases(count = 1000) {
let state = 123456789;
  const strings = [...fixed];
const random = n => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state % n; };
for (let i = 0; i < count; i++) {
  let mantissa = '';
  const size = 1 + random(100);
  for (let j = 0; j < size; j++) mantissa += String(random(10));
  const point = random(size + 1);
  strings.push((random(2) ? '-' : '') + mantissa.slice(0, point) + '.' + mantissa.slice(point) + 'e' + (random(800) - 400));
}
  return strings;
}
