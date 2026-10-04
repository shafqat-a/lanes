// Decimal / 0x / 0b / 0o literal to canonical little-endian u32 limbs.
// Schoolbook mul-add and div-by-10 only. No host BigInt and no binary64.

import { MAX_LIMBS, TAG_BIGINT, encodeLimbs } from './representation.js';

const syntaxError = () => ({ kind: 'syntax', code: 'bigint-literal' });
const limitError = () => ({ kind: 'resource-limit', code: 'bigint-limbs' });

function digitValue(ch, radix) {
  const c = ch.charCodeAt(0);
  let value = -1;
  if (c >= 48 && c <= 57) value = c - 48;
  else if (c >= 97 && c <= 122) value = c - 97 + 10;
  else if (c >= 65 && c <= 90) value = c - 65 + 10;
  if (value < 0 || value >= radix) return -1;
  return value;
}

// base is 2, 8, 10, or 16. base * (2^32-1) + digit is below 2^53.
function mulAdd(limbs, base, digit) {
  let carry = digit;
  for (let i = 0; i < limbs.length; i++) {
    const product = limbs[i] * base + carry;
    limbs[i] = product >>> 0;
    carry = Math.floor(product / 4294967296);
  }
  while (carry > 0) {
    if (limbs.length >= MAX_LIMBS) return true;
    limbs.push(carry >>> 0);
    carry = Math.floor(carry / 4294967296);
  }
  return false;
}

export function packBigIntLiteral(tokenString) {
  if (typeof tokenString !== 'string' || tokenString.length === 0) return syntaxError();
  let text = tokenString;
  if (text.charCodeAt(text.length - 1) === 110) text = text.slice(0, -1);
  if (text.length === 0 || text.includes('+') || text.includes('.') || /\s/.test(text)) return syntaxError();
  let sign = 1;
  if (text[0] === '-') {
    sign = -1;
    text = text.slice(1);
    if (text.length === 0 || text[0] === '-') return syntaxError();
  }
  let radix = 10;
  if (text.length >= 2 && text[0] === '0') {
    const mark = text[1];
    if (mark === 'x' || mark === 'X') { radix = 16; text = text.slice(2); }
    else if (mark === 'b' || mark === 'B') { radix = 2; text = text.slice(2); }
    else if (mark === 'o' || mark === 'O') { radix = 8; text = text.slice(2); }
  }
  if (text.length === 0) return syntaxError();
  if (radix === 10 && /[^0-9_]/.test(text)) return syntaxError();
  const limbs = [];
  let prevDigit = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '_') {
      if (!prevDigit || i + 1 === text.length || text[i + 1] === '_') return syntaxError();
      prevDigit = false;
      continue;
    }
    const digit = digitValue(ch, radix);
    if (digit < 0) return syntaxError();
    prevDigit = true;
    if (mulAdd(limbs, radix, digit)) return limitError();
  }
  if (!prevDigit) return syntaxError();
  while (limbs.length > 0 && limbs[limbs.length - 1] === 0) limbs.pop();
  if (limbs.length === 0) sign = 0;
  if (limbs.length > MAX_LIMBS) return limitError();
  const encoded = encodeLimbs(sign, limbs);
  if (encoded.kind) return encoded;
  return { tag: TAG_BIGINT, sign: encoded.sign, limbs: encoded.limbs };
}

export function unpackToDecimal(sign, limbs) {
  const encoded = encodeLimbs(sign, limbs);
  if (encoded.kind) throw new RangeError('bigint limbs');
  if (encoded.sign === 0) return '0';
  const work = encoded.limbs.slice();
  const digits = [];
  while (work.length > 0) {
    let rem = 0;
    for (let i = work.length - 1; i >= 0; i--) {
      const cur = rem * 4294967296 + work[i];
      const quot = Math.floor(cur / 10);
      work[i] = quot;
      rem = cur - quot * 10;
    }
    digits.push(String(rem));
    while (work.length > 0 && work[work.length - 1] === 0) work.pop();
  }
  digits.reverse();
  const body = digits.join('');
  return encoded.sign < 0 ? `-${body}` : body;
}
