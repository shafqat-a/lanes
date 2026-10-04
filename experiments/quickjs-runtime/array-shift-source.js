// Self-hosted ES2025 Array.prototype.shift / unshift (23.1.3.27, 23.1.3.34).
// These strings are compiled to guest bytecode; production never evaluates them on the CPU.
// Strict mode makes `object[k] = v` behave as Set(O, k, v, true) and `delete object[k]`
// behave as DeletePropertyOrThrow, so failed writes/deletes throw TypeError and leave the
// partial effects already performed in place, as the spec requires.
// shift:   len 0 -> Set length +0, return undefined. Otherwise Get "0", then for k = 1..len-1
//          HasProperty(k) ? Get(k) + Set(k-1) : DeletePropertyOrThrow(k-1); then
//          DeletePropertyOrThrow(len-1), Set length len-1, return first.
// unshift: if argCount > 0: TypeError when len + argCount > 2^53-1 before any write; then for
//          k = len..1 HasProperty(k-1) ? Get(k-1) + Set(k+argCount-1) : Delete(k+argCount-1);
//          then Set 0..argCount-1. Set length len + argCount always (also for argCount 0).
// HasProperty is the `in` operator, so holes are skipped and inherited indices are visible.
// unshift declares one formal parameter so its function length is 1 like the builtin; all
// items are read through `arguments`.
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
export const arrayShiftSources = Object.freeze({
  arrayShift: `function shiftBootstrap() {${setup}
    if (length === 0) { object.length = 0; return undefined; }
    const first = object[0];
    for (let k = 1; k < length; k++) {
      if (k in object) {
        const value = object[k];
        object[k - 1] = value;
      } else {
        delete object[k - 1];
      }
    }
    delete object[length - 1];
    object.length = length - 1;
    return first;
  }`,
  arrayUnshift: `function unshiftBootstrap(item) {${setup}
    const count = arguments.length;
    if (count > 0) {
      if (length + count > 9007199254740991) throw new TypeError("Array-like length overflow");
      for (let k = length; k > 0; k--) {
        const from = k - 1;
        const to = k + count - 1;
        if (from in object) {
          const value = object[from];
          object[to] = value;
        } else {
          delete object[to];
        }
      }
      for (let j = 0; j < count; j++) object[j] = arguments[j];
    }
    object.length = length + count;
    return length + count;
  }`,
});
