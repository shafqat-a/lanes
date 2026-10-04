// Guest replacements for phase4-iteration.js `iterationBootstrapSources`
// keys `iteratorOpen` and `iteratorStep`. Parent splices the strings in
// place. Names stay iteratorOpenBootstrap / iteratorStepBootstrap so the
// existing intrinsic-root capture (first function only) still binds
// __lanes* (113 __lanesCall, 112 __lanesDescriptor), Symbol (builtin 1000),
// and TypeError. No nested function: those captures do not resolve there.
// No new helper builtin. Continuations 76-79 are not referenced.

export const GENERIC_ITERATOR_KIND = 3;
export const ITERATOR_OPEN_ID = 1270;
export const ITERATOR_STEP_ID = 1271;

// Phase-4 kind 1 (array / arguments) and kind 2 (UTF-16 code point) bodies,
// copied so records already opened that way still step. Kind 3 never falls
// through to them: a generic record stores object: undefined, and the old
// exhausted check would otherwise treat it as done.
const intrinsicStepBody = `  const object = record.object;
  if (object === undefined) return record;
  const index = record.index;
  record.object = undefined;
  if (record.kind === 1) {
    let length = object.length;
    if (typeof length !== "number") length = __lanesNumber(length);
    if (!(length > 0)) length = 0;
    else if (length > 9007199254740991) length = 9007199254740991;
    else length = length - length % 1;
    if (index >= length) return record;
    const value = object[index];
    record.index = index + 1;
    record.object = object;
    return value;
  }
  const length = object.length;
  if (index >= length) return record;
  let end = index + 1;
  const first = __lanesCharCodeAt(object, index);
  if (first >= 55296 && first <= 56319 && end < length) {
    const second = __lanesCharCodeAt(object, end);
    if (second >= 56320 && second <= 57343) end = end + 1;
  }
  record.index = end;
  record.object = object;
  return __lanesSlice(object, index, end);
`;

export const iteratorOpenBootstrapSource = `function iteratorOpenBootstrap(value) {
  "use strict";
  if (value === null || value === undefined) throw new TypeError("Value is not iterable");
  const method = value[Symbol.iterator];
  if (method === null || method === undefined) throw new TypeError("Value is not iterable");
  if (typeof method !== "function") throw new TypeError("Value is not iterable");
  const iterator = __lanesCall(method, value);
  if (iterator === null || (typeof iterator !== "object" && typeof iterator !== "function")) throw new TypeError("Iterator is not an object");
  const next = iterator.next;
  const record = __lanesDescriptor();
  record.kind = 3;
  record.iterator = iterator;
  record.next = next;
  record.object = undefined;
  record.index = 0;
  return record;
}`;

export const iteratorStepBootstrapSource = `function iteratorStepBootstrap(record) {
  "use strict";
  if (record.kind === 3) {
    if (record.iterator === undefined) return record;
    const next = record.next;
    const iterator = record.iterator;
    if (typeof next !== "function") throw new TypeError("Iterator next is not a function");
    const result = __lanesCall(next, iterator);
    if (result === null || (typeof result !== "object" && typeof result !== "function")) throw new TypeError("Iterator result is not an object");
    const done = result.done;
    if (done) {
      record.iterator = undefined;
      return record;
    }
    const value = result.value;
    return value;
  }
${intrinsicStepBody}}`;

export const iteratorBootstrapSources = Object.freeze({
  iteratorOpen: iteratorOpenBootstrapSource,
  iteratorStep: iteratorStepBootstrapSource,
});
