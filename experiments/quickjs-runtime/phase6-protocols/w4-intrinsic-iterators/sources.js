// Guest sources. Compiled as intrinsic roots; production does not eval them.
// Array.prototype.values/keys/entries merge into arraySources under these
// names so arrayMethods (300 + arrayBuiltins index) picks them up.
// Do not install @@iterator. The parent points 334, 1103, and arguments at these.

import { ARRAY_ITERATOR_KIND, ARRAY_ITERATOR_SLOT, MAX_LENGTH } from "./ids.js";

const kind = ARRAY_ITERATOR_KIND;
const slot = ARRAY_ITERATOR_SLOT;

function arrayFactory(name, iteratorKind) {
  return `function ${name}Bootstrap() {
  "use strict";
  const object = __lanesToObject(this);
  return __lanesCreateArrayIterator(object, ${iteratorKind});
}`;
}

export const arrayIteratorMethodSources = Object.freeze({
  arrayValues: arrayFactory("arrayValues", kind.values),
  arrayKeys: arrayFactory("arrayKeys", kind.keys),
  arrayEntries: arrayFactory("arrayEntries", kind.entries),
});

export const iteratorBootstrapSources = Object.freeze({
  // RequireObjectCoercible by reading this, then ToString. A string primitive
  // is kept. Objects use ToPrimitive(string); BigInt uses decimal guest text.
  stringIterator: `function stringIteratorBootstrap() {
  "use strict";
  const value = this;
  if (value === null || value === undefined) throw new TypeError("Cannot convert undefined or null to object");
  let text = value;
  if (typeof value !== "string") {
    let primitive = value;
    if (typeof value === "object" || typeof value === "function") primitive = __lanesPrimitive(value, true);
    if (typeof primitive === "symbol") throw new TypeError("Cannot convert a Symbol value to a string");
    text = __lanesText(primitive);
  }
  return __lanesCreateStringIterator(text);
}`,
  // ES2025: index advances before the element Get. A throw leaves the iterator
  // usable at the next index and does not clear the iterated object.
  // ToLength matches phase4-iteration.js (non-number via __lanesNumber 122).
  arrayIteratorNext: `function arrayIteratorNextBootstrap() {
  "use strict";
  if (!__lanesArrayIteratorSlot(this, ${slot.brand})) throw new TypeError("Array iterator expected");
  const object = __lanesArrayIteratorSlot(this, ${slot.object});
  if (object === undefined) return { value: undefined, done: true };
  const index = __lanesArrayIteratorSlot(this, ${slot.index});
  const kind = __lanesArrayIteratorSlot(this, ${slot.kind});
  let length = object.length;
  if (typeof length !== "number") length = __lanesNumber(length);
  if (!(length > 0)) length = 0;
  else if (length > ${MAX_LENGTH}) length = ${MAX_LENGTH};
  else length = length - length % 1;
  if (index >= length) {
    __lanesArrayIteratorClear(this);
    return { value: undefined, done: true };
  }
  __lanesArrayIteratorSetIndex(this, index + 1);
  if (kind === 0) return { value: index, done: false };
  const element = object[index];
  if (kind === 2) return { value: [index, element], done: false };
  return { value: element, done: false };
}`,
  stringIteratorNext: `function stringIteratorNextBootstrap() {
  "use strict";
  if (!__lanesStringIteratorBrand(this)) throw new TypeError("String iterator expected");
  if (__lanesStringIteratorDone(this)) return { value: undefined, done: true };
  const value = __lanesStringIteratorTake(this);
  return { value: value, done: false };
}`,
});

export const sources = Object.freeze({
  ...arrayIteratorMethodSources,
  ...iteratorBootstrapSources,
});
