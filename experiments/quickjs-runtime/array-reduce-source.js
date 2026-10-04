// Self-hosted ES2025 Array.prototype.reduce / reduceRight (23.1.3.24, 23.1.3.25).
// These strings are compiled to guest bytecode; production never evaluates them on the CPU.
// Order: ToObject (private receiver guard), LengthOfArrayLike, IsCallable, then the
// empty/all-holes TypeError. initialValue is "present" iff arguments.length >= 2, so an
// explicit undefined counts as present. Holes are found with HasProperty (`in`), which
// sees inherited indices; Get happens only for present indices. The callback is called
// with an undefined this value and exactly four arguments (accumulator, value, index, O).
// Known limits kept from array-source.js: non-null primitive receivers fail as unsupported
// (no boxing; null/undefined throw TypeError), and indices at or above 2^31 are unsupported by the numeric key path.
const setup = `
  "use strict";
  const object = __lanesArrayObject(this);
  let length = __lanesNumber(object.length);
  if (!(length > 0)) length = 0;
  else if (length > 9007199254740991) length = 9007199254740991;
  else length = length - length % 1;
`;
export const arrayReduceSources = Object.freeze({
  arrayReduce: `function reduceBootstrap(callback, initialValue) {${setup}
    if (typeof callback !== "function") throw new TypeError("Callback is not callable");
    let index = 0;
    let accumulator = undefined;
    if (arguments.length > 1) {
      accumulator = initialValue;
    } else {
      let present = false;
      while (!present && index < length) {
        present = index in object;
        if (present) accumulator = object[index];
        index++;
      }
      if (!present) throw new TypeError("Reduce of empty array with no initial value");
    }
    for (; index < length; index++) {
      if (index in object) {
        const element = object[index];
        accumulator = __lanesCall(callback, undefined, accumulator, element, index, object);
      }
    }
    return accumulator;
  }`,
  arrayReduceRight: `function reduceRightBootstrap(callback, initialValue) {${setup}
    if (typeof callback !== "function") throw new TypeError("Callback is not callable");
    let index = length - 1;
    let accumulator = undefined;
    if (arguments.length > 1) {
      accumulator = initialValue;
    } else {
      let present = false;
      while (!present && index >= 0) {
        present = index in object;
        if (present) accumulator = object[index];
        index--;
      }
      if (!present) throw new TypeError("Reduce of empty array with no initial value");
    }
    for (; index >= 0; index--) {
      if (index in object) {
        const element = object[index];
        accumulator = __lanesCall(callback, undefined, accumulator, element, index, object);
      }
    }
    return accumulator;
  }`,
});
