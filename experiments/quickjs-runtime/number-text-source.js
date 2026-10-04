// Exact-rational shortest decimal formatting for binary64. Track the exact
// rounding interval, including asymmetric power-of-two boundaries, and select
// the shortest decimal inside it, nearest/ties-even when both candidates fit.
export const numberTextSource = `function numberTextBootstrap(value) {
  function words() { const a = __lanesDescriptor(); a.length = 1; a[0] = 0; return a; }
  function trim(a) { while (a.length > 1 && a[a.length - 1] === 0) a.length--; return a; }
  function multiply(a, factor) {
    let carry = 0;
    for (let i = 0; i < a.length; i++) {
      const product = a[i] * factor + carry;
      a[i] = product >>> 0;
      carry = (product / 4294967296) >>> 0;
    }
    if (carry) { a[a.length] = carry; a.length++; }
  }
  function scale(a, power) {
    // A limb times 10^6 plus carry stays below 2^52, hence remains exact.
    while (power >= 6) { multiply(a, 1000000); power -= 6; }
    while (power > 0) { multiply(a, 10); power--; }
  }
  function copyInto(a, b) {
    b.length = a.length;
    for (let i = 0; i < a.length; i++) b[i] = a[i];
    return b;
  }
  function copy(a) { return copyInto(a, words()); }
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
    for (let i = a.length - 1; i >= 0; i--) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
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
  function increment(digits) {
    let i = digits.length - 1;
    while (i >= 0 && digits[i] === "9") i--;
    let result = i < 0 ? "1" : __lanesSlice(digits, 0, i) + "0123456789"[__lanesCharCodeAt(digits, i) - 47];
    for (let j = i + 1; j < digits.length; j++) result += "0";
    return result;
  }
  // Exponents are small signed integers. Emit their digits directly so this
  // formatter never re-enters numeric ToString through a helper intrinsic.
  function exponentText(value) {
    const negative = value < 0;
    if (negative) value = -value;
    let result = "";
    do {
      const quotient = (value / 10) >>> 0;
      result = "0123456789"[value - quotient * 10] + result;
      value = quotient;
    } while (value);
    return negative ? "-" + result : result;
  }
  function format(digits, position, negative) {
    while (digits.length > 1 && digits[digits.length - 1] === "0") digits = __lanesSlice(digits, 0, digits.length - 1);
    let result = "";
    if (position > 0 && position <= 21) {
      if (digits.length <= position) {
        result = digits;
        while (result.length < position) result += "0";
      } else result = __lanesSlice(digits, 0, position) + "." + __lanesSlice(digits, position);
    } else if (position <= 0 && position > -6) {
      result = "0.";
      for (let i = 0; i < -position; i++) result += "0";
      result += digits;
    } else {
      result = digits[0];
      if (digits.length > 1) result += "." + __lanesSlice(digits, 1);
      result += "e" + (position > 0 ? "+" : "") + exponentText(position - 1);
    }
    return negative ? "-" + result : result;
  }
  if (value !== value) return "NaN";
  if (value === Infinity) return "Infinity";
  if (value === -Infinity) return "-Infinity";
  if (value === 0) return "0";
  const negative = value < 0;
  const magnitude = negative ? -value : value;
  const low = __lanesNumberWord(magnitude, 0), high = __lanesNumberWord(magnitude, 1);
  const biased = (high >>> 20) & 2047;
  let n = words(), d = words(), lower = words(), upperMargin = words();
  n[0] = low; n[1] = (high & 1048575) | (biased ? 1048576 : 0); n.length = 2; trim(n);
  d[0] = 1;
  const asymmetric = biased > 1 && low === 0 && (high & 1048575) === 0;
  const extra = asymmetric ? 2 : 1;
  n = shift(n, extra); lower[0] = 1; upperMargin[0] = asymmetric ? 2 : 1;
  const exponent = (biased ? biased - 1075 : -1074) - extra;
  if (exponent >= 0) {
    n = shift(n, exponent); lower = shift(lower, exponent); upperMargin = shift(upperMargin, exponent);
  } else d = shift(d, -exponent);
  const inclusive = (low & 1) === 0;
  // Fixed-point log10(2) estimate; exact comparisons correct either direction.
  let binaryExponent = biased - 1023;
  if (!biased) {
    // Subnormals do not all have exponent -1074: use their highest set bit.
    let leading = high & 1048575;
    binaryExponent = -1042;
    if (!leading) { leading = low; binaryExponent = -1074; }
    while (leading > 1) { leading = leading >>> 1; binaryExponent++; }
  }
  let power = (binaryExponent * 78913) >> 18;
  if (power < 0) { scale(n, -power); scale(lower, -power); scale(upperMargin, -power); }
  else scale(d, power);
  if (compare(n, d) < 0) {
    while (compare(n, d) < 0) { multiply(n, 10); multiply(lower, 10); multiply(upperMargin, 10); power--; }
  } else {
    let next = copy(d); multiply(next, 10);
    while (compare(n, next) >= 0) { d = next; power++; next = copy(d); multiply(next, 10); }
  }
  let digits = "";
  const twice = words(), above = words();
  for (let precision = 1; precision <= 17; precision++) {
    let digit = 0;
    while (compare(n, d) >= 0) { subtract(n, d); digit++; }
    digits += "0123456789"[digit];
    copyInto(n, twice); multiply(twice, 2);
    const rounding = compare(twice, d);
    const upFirst = rounding > 0 || (rounding === 0 && (digit & 1));
    const lowerDistance = compare(n, lower);
    copyInto(d, above); subtract(above, n);
    const upperDistance = compare(above, upperMargin);
    const lowerFits = lowerDistance < 0 || (inclusive && lowerDistance === 0);
    const upperFits = upperDistance < 0 || (inclusive && upperDistance === 0);
    if (lowerFits || upperFits) {
      const selected = upperFits && (!lowerFits || upFirst) ? increment(digits) : digits;
      return format(selected, selected.length + power - precision + 1, negative);
    }
    multiply(n, 10); multiply(lower, 10); multiply(upperMargin, 10);
  }
  throw new RangeError("Number formatting failed");
}`;
