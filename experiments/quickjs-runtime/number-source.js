// Guest implementation of StringNumericLiteral conversion. Unsigned 32-bit
// limbs hold an exact rational; division rounds once to nearest, ties to even.
// All loops execute as resumable QuickJS bytecode on the GPU. The only numeric
// primitive below assembles the final IEEE-754 words without host evaluation.
export const numberSource = `function numberBootstrap(value) {
  "use strict";
  function object(v) { return v !== null && (typeof v === "object" || typeof v === "function"); }
  function words() { const a = __lanesDescriptor(); a.length = 1; a[0] = 0; return a; }
  function trim(a) { while (a.length > 1 && a[a.length - 1] === 0) a.length--; return a; }
  function multiply(a, factor, digit) {
    let carry = digit;
    for (let i = 0; i < a.length; i++) {
      const product = a[i] * factor + carry;
      a[i] = product >>> 0;
      carry = (product / 4294967296) >>> 0;
    }
    if (carry) { a[a.length] = carry; a.length++; }
  }
  function bits(a) {
    let word = a[a.length - 1], n = 0;
    while (word) { word = word >>> 1; n++; }
    return (a.length - 1) * 32 + n;
  }
  function shift(a, amount) {
    const b = words(), whole = amount >>> 5, part = amount & 31;
    b.length = a.length + whole + (part ? 1 : 0);
    for (let i = 0; i < b.length; i++) b[i] = 0;
    for (let i = 0; i < a.length; i++) {
      b[i + whole] = (b[i + whole] | (a[i] << part)) >>> 0;
      if (part) b[i + whole + 1] = a[i] >>> (32 - part);
    }
    return trim(b);
  }
  function compare(a, b) {
    if (a.length !== b.length) return a.length < b.length ? -1 : 1;
    for (let i = a.length - 1; i >= 0; i--) {
      if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
    }
    return 0;
  }
  function subtract(a, b) {
    let borrow = 0;
    for (let i = 0; i < a.length; i++) {
      let word = a[i] - (i < b.length ? b[i] : 0) - borrow;
      borrow = word < 0 ? 1 : 0;
      if (borrow) word += 4294967296;
      a[i] = word;
    }
    trim(a);
  }
  function halve(a) {
    let carry = 0;
    for (let i = a.length - 1; i >= 0; i--) {
      const word = a[i];
      a[i] = ((word >>> 1) | (carry << 31)) >>> 0;
      carry = word & 1;
    }
    trim(a);
  }
  function encode(n, d, negative) {
    if (bits(n) === 0) return negative ? -0 : 0;
    let exponent = bits(n) - bits(d);
    if (exponent >= 0) {
      if (compare(n, shift(d, exponent)) < 0) exponent--;
    } else if (compare(shift(n, -exponent), d) < 0) exponent--;
    if (exponent > 1023) return negative ? -Infinity : Infinity;
    if (exponent < -1075) return negative ? -0 : 0;
    const quantum = exponent < -1022 ? -1074 : exponent - 52;
    let a = n, b = d;
    if (quantum < 0) a = shift(n, -quantum); else b = shift(d, quantum);
    let low = 0, high = 0;
    const difference = bits(a) - bits(b);
    if (difference >= 0) {
      const divisor = shift(b, difference);
      for (let i = difference; i >= 0; i--) {
        if (compare(a, divisor) >= 0) {
          subtract(a, divisor);
          if (i < 32) low = (low | (1 << i)) >>> 0;
          else high = (high | (1 << (i - 32))) >>> 0;
        }
        halve(divisor);
      }
    }
    const rounding = compare(shift(a, 1), b);
    if (rounding > 0 || (rounding === 0 && (low & 1))) {
      low = (low + 1) >>> 0;
      if (low === 0) high++;
    }
    const sign = negative ? 2147483648 : 0;
    if (exponent < -1022) return __lanesFromBits(low, (high | sign) >>> 0);
    if (high >= 2097152) {
      low = ((low >>> 1) | ((high & 1) << 31)) >>> 0;
      high = high >>> 1; exponent++;
    }
    if (exponent > 1023) return negative ? -Infinity : Infinity;
    return __lanesFromBits(low, (sign | ((exponent + 1023) << 20) | (high & 1048575)) >>> 0);
  }
  function space(c) {
    return c === 9 || c === 10 || c === 11 || c === 12 || c === 13 || c === 32 ||
      c === 160 || c === 5760 || (c >= 8192 && c <= 8202) || c === 8232 ||
      c === 8233 || c === 8239 || c === 8287 || c === 12288 || c === 65279;
  }
  function digit(c) {
    if (c >= 48 && c <= 57) return c - 48;
    if (c >= 65 && c <= 70) return c - 55;
    if (c >= 97 && c <= 102) return c - 87;
    return -1;
  }
  if (arguments.length === 0) return 0;
  if (typeof value === "number") return value;
  if (value === null) return 0;
  if (value === undefined) return NaN;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "symbol") throw new TypeError("Cannot convert Symbol to Number");
  if (typeof value === "bigint") return __lanesBigIntToNumber(value);
  if (object(value)) {
    const primitive = __lanesPrimitive(value, false);
    if (object(primitive)) throw new TypeError("Cannot convert object to number");
    return numberBootstrap(primitive);
  }
  let start = 0, end = value.length;
  while (start < end && space(__lanesCharCodeAt(value,start))) start++;
  while (end > start && space(__lanesCharCodeAt(value,end - 1))) end--;
  if (start === end) return 0;
  let negative = false, signed = false;
  if (__lanesCharCodeAt(value,start) === 43 || __lanesCharCodeAt(value,start) === 45) {
    negative = __lanesCharCodeAt(value,start) === 45; signed = true; start++;
  }
  if (__lanesSlice(value, start, end) === "Infinity") return negative ? -Infinity : Infinity;
  const n = words(), d = words(); d[0] = 1;
  if (!signed && __lanesCharCodeAt(value,start) === 48 && start + 1 < end) {
    const prefix = __lanesCharCodeAt(value,start + 1);
    let radix = 0;
    if (prefix === 120 || prefix === 88) radix = 16;
    if (prefix === 111 || prefix === 79) radix = 8;
    if (prefix === 98 || prefix === 66) radix = 2;
    if (radix) {
      start += 2;
      if (start === end) return NaN;
      for (let i = start; i < end; i++) {
        const v = digit(__lanesCharCodeAt(value,i));
        if (v < 0 || v >= radix) return NaN;
        multiply(n, radix, v);
      }
      return encode(n, d, false);
    }
  }
  let point = false, fractional = 0, count = 0, significant = 0, seen = false;
  while (start < end) {
    const c = __lanesCharCodeAt(value,start);
    if (c === 46 && !point) { point = true; start++; }
    else if (c >= 48 && c <= 57) {
      const v = c - 48; multiply(n, 10, v); count++;
      if (v !== 0) seen = true;
      if (seen) significant++;
      if (point) fractional++;
      start++;
    } else break;
  }
  if (count === 0) return NaN;
  let exponent = 0, exponentNegative = false;
  if (start < end && (__lanesCharCodeAt(value,start) === 101 || __lanesCharCodeAt(value,start) === 69)) {
    start++;
    if (__lanesCharCodeAt(value,start) === 43 || __lanesCharCodeAt(value,start) === 45) {
      exponentNegative = __lanesCharCodeAt(value,start) === 45; start++;
    }
    let digits = 0;
    while (start < end) {
      const c = __lanesCharCodeAt(value,start);
      if (c < 48 || c > 57) return NaN;
      if (exponent < 10000) exponent = exponent * 10 + c - 48;
      digits++; start++;
    }
    if (digits === 0) return NaN;
  }
  if (start !== end) return NaN;
  if (!seen) return negative ? -0 : 0;
  if (exponentNegative) exponent = -exponent;
  exponent -= fractional;
  const order = significant - 1 + exponent;
  if (order > 308) return negative ? -Infinity : Infinity;
  if (order < -324) return negative ? -0 : 0;
  if (exponent >= 0) for (let i = 0; i < exponent; i++) multiply(n, 10, 0);
  else for (let i = 0; i < -exponent; i++) multiply(d, 10, 0);
  return encode(n, d, negative);
}`;
