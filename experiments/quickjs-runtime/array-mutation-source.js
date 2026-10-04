// Self-hosted ES2025 Array.prototype.fill (23.1.3.7), copyWithin (23.1.3.4) and
// reverse (23.1.3.26). These strings are compiled to guest bytecode; production
// never evaluates them on the CPU. array-source.js includes these helpers and
// derives their callable IDs from the shared Array builtin metadata.
//
// Limitations kept from the existing helpers:
// - Primitive receivers are rejected by the private receiver guard
//   (__lanesArrayObject reports unsupported); null/undefined throw TypeError.
// - Indices at or above 2^31 stay on the existing numeric-key limit.
// - __lanesNumber is the guest ToNumber; any divergence from ToNumber (e.g. BigInt)
//   is inherited from that intrinsic.
// Strict mode makes `object[k] = v` behave as Set(O, k, v, true) and
// `delete object[k]` as DeletePropertyOrThrow(O, k).
const setup = `
  "use strict";
  const object = __lanesArrayObject(this);
  let length = __lanesNumber(object.length);
  if (!(length > 0)) length = 0;
  else if (length > 9007199254740991) length = 9007199254740991;
  else length = length - length % 1;
`;
// ToIntegerOrInfinity(argument) followed by the relative-index clamp used by
// fill/copyWithin: -Infinity -> 0, negative -> max(len + n, 0), else min(n, len).
// NaN, +0 and -0 all become +0.
const relative = (name, argument) => `
  let ${name} = __lanesNumber(${argument});
  if (${name} !== ${name}) ${name} = 0;
  else if (${name} !== Infinity && ${name} !== -Infinity) ${name} = ${name} - ${name} % 1;
  if (${name} === -Infinity) ${name} = 0;
  else if (${name} < 0) { ${name} = length + ${name}; if (${name} < 0) ${name} = 0; }
  else if (${name} > length) ${name} = length;
  else ${name} = ${name} + 0;
`;
// end === undefined -> len, otherwise the same relative clamp.
const relativeEnd = (name, argument) => `
  let ${name} = length;
  if (${argument} !== undefined) {${relative(name + 'Relative', argument)}
    ${name} = ${name}Relative;
  }
`;
export const arrayMutationSources = Object.freeze({
  arrayFill: `function fillBootstrap(value, start, end) {${setup}${relative('index', 'start')}${relativeEnd('final', 'end')}
    for (; index < final; index++) object[index] = value;
    return object;
  }`,
  arrayCopyWithin: `function copyWithinBootstrap(target, start, end) {${setup}${relative('to', 'target')}${relative('from', 'start')}${relativeEnd('final', 'end')}
    let count = final - from;
    if (length - to < count) count = length - to;
    let direction = 1;
    if (from < to && to < from + count) {
      direction = -1;
      from = from + count - 1;
      to = to + count - 1;
    }
    while (count > 0) {
      if (from in object) {
        const element = object[from];
        object[to] = element;
      } else {
        delete object[to];
      }
      from = from + direction;
      to = to + direction;
      count--;
    }
    return object;
  }`,
  arrayReverse: `function reverseBootstrap() {${setup}
    const middle = (length - length % 2) / 2;
    for (let lower = 0; lower !== middle; lower++) {
      const upper = length - lower - 1;
      const lowerExists = lower in object;
      let lowerValue;
      if (lowerExists) lowerValue = object[lower];
      const upperExists = upper in object;
      let upperValue;
      if (upperExists) upperValue = object[upper];
      if (lowerExists && upperExists) {
        object[lower] = upperValue;
        object[upper] = lowerValue;
      } else if (upperExists) {
        object[lower] = upperValue;
        delete object[upper];
      } else if (lowerExists) {
        delete object[lower];
        object[upper] = lowerValue;
      }
    }
    return object;
  }`,
});
