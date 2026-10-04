// Host model of Array Iterator and String Iterator next. Not the GPU path.
// Array index advances before the element Get. A throw leaves the object in
// place and the next call continues at the following index.
// String steps are UTF-16 code points: a lead surrogate (U+D800..U+DBFF)
// followed by a trail (U+DC00..U+DFFF) is one element; a lone surrogate is one.

import {
  ARRAY_ITERATOR_KIND,
  ARRAY_ITERATOR_PROTOTYPE,
  HEAP_KIND_ARRAY_ITERATOR,
  HEAP_KIND_STRING_ITERATOR,
  MAX_LENGTH,
  STRING_ITERATOR_PROTOTYPE,
} from "./ids.js";

const LEAD_MIN = 0xD800;
const LEAD_MAX = 0xDBFF;
const TRAIL_MIN = 0xDC00;
const TRAIL_MAX = 0xDFFF;

export function toLength(value, toNumber = Number) {
  let length = value;
  if (typeof length !== "number") length = toNumber(length);
  if (!(length > 0)) return 0;
  if (length > MAX_LENGTH) return MAX_LENGTH;
  return length - (length % 1);
}

function iteratorResult(value, done) {
  return { value, done };
}

export function isArrayIterator(value) {
  return !!value
    && value.brand === HEAP_KIND_ARRAY_ITERATOR
    && (value.kind === ARRAY_ITERATOR_KIND.keys
      || value.kind === ARRAY_ITERATOR_KIND.values
      || value.kind === ARRAY_ITERATOR_KIND.entries);
}

export function isStringIterator(value) {
  return !!value && value.brand === HEAP_KIND_STRING_ITERATOR && typeof value.text === "string";
}

export function createArrayIterator(object, kind) {
  if (kind !== 0 && kind !== 1 && kind !== 2) throw new TypeError("Array iterator kind");
  return {
    brand: HEAP_KIND_ARRAY_ITERATOR,
    prototype: ARRAY_ITERATOR_PROTOTYPE,
    object,
    index: 0,
    kind,
  };
}

export function arrayIteratorNext(iterator) {
  if (!isArrayIterator(iterator)) throw new TypeError("Array iterator expected");
  if (iterator.object === undefined) return iteratorResult(undefined, true);
  const index = iterator.index;
  const kind = iterator.kind;
  const length = toLength(iterator.object.length);
  if (index >= length) {
    iterator.object = undefined;
    return iteratorResult(undefined, true);
  }
  iterator.index = index + 1;
  if (kind === ARRAY_ITERATOR_KIND.keys) return iteratorResult(index, false);
  const element = iterator.object[index];
  if (kind === ARRAY_ITERATOR_KIND.entries) return iteratorResult([index, element], false);
  return iteratorResult(element, false);
}

// One code point at a UTF-16 index. end is the index after the element.
export function readCodePoint(text, index) {
  const first = text.charCodeAt(index);
  let end = index + 1;
  if (first >= LEAD_MIN && first <= LEAD_MAX && end < text.length) {
    const second = text.charCodeAt(end);
    if (second >= TRAIL_MIN && second <= TRAIL_MAX) end = end + 1;
  }
  return { value: text.slice(index, end), end };
}

export function createStringIterator(text) {
  if (typeof text !== "string") throw new TypeError("String iterator expected a string");
  return {
    brand: HEAP_KIND_STRING_ITERATOR,
    prototype: STRING_ITERATOR_PROTOTYPE,
    text,
    index: 0,
  };
}

export function stringIteratorDone(iterator) {
  if (!isStringIterator(iterator)) throw new TypeError("String iterator expected");
  return iterator.index >= iterator.text.length;
}

export function stringIteratorTake(iterator) {
  if (!isStringIterator(iterator)) throw new TypeError("String iterator expected");
  if (iterator.index >= iterator.text.length) return undefined;
  const step = readCodePoint(iterator.text, iterator.index);
  iterator.index = step.end;
  return step.value;
}

export function stringIteratorNext(iterator) {
  if (!isStringIterator(iterator)) throw new TypeError("String iterator expected");
  if (stringIteratorDone(iterator)) return iteratorResult(undefined, true);
  return iteratorResult(stringIteratorTake(iterator), false);
}

export function iteratorIdentity(receiver) {
  if (receiver === null || receiver === undefined) {
    throw new TypeError("Iterator.prototype[@@iterator] called on null or undefined");
  }
  return receiver;
}

export function next(iterator) {
  if (isStringIterator(iterator)) return stringIteratorNext(iterator);
  if (isArrayIterator(iterator)) return arrayIteratorNext(iterator);
  throw new TypeError("Iterator expected");
}
