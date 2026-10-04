// Host model of iteratorOpenBootstrap / iteratorStepBootstrap.
// simulateOpenOrder(value, log) and simulateStepOrder(record, log) run the
// same order as the guest sources. `log` receives one entry per generic
// protocol operation that actually starts. Throws propagate with the same
// identity; on throw, `log` already holds the operations that started.
// Kind 1 and 2 do not append protocol entries (they are not GetIterator).
//
// Log entries:
//   { op: "get", key: "@@iterator" | "next" | "done" | "value" }
//   { op: "call", key: "@@iterator" | "next", receiver }

import { iteratorOpenBootstrapSource, iteratorStepBootstrapSource } from "./sources.js";

function isObjectOrFunction(value) {
  return value !== null && (typeof value === "object" || typeof value === "function");
}

function note(log, entry) {
  if (log) log.push(entry);
}

export function simulateOpenOrder(value, log = []) {
  if (value === null || value === undefined) throw new TypeError("Value is not iterable");
  note(log, { op: "get", key: "@@iterator" });
  const method = value[Symbol.iterator];
  if (method === null || method === undefined) throw new TypeError("Value is not iterable");
  if (typeof method !== "function") throw new TypeError("Value is not iterable");
  note(log, { op: "call", key: "@@iterator", receiver: value });
  const iterator = Reflect.apply(method, value, []);
  if (!isObjectOrFunction(iterator)) throw new TypeError("Iterator is not an object");
  note(log, { op: "get", key: "next" });
  const next = iterator.next;
  const record = Object.create(null);
  record.kind = 3;
  record.iterator = iterator;
  record.next = next;
  record.object = undefined;
  record.index = 0;
  return record;
}

function stepIntrinsic(record) {
  const object = record.object;
  if (object === undefined) return record;
  const index = record.index;
  record.object = undefined;
  if (record.kind === 1) {
    let length = object.length;
    if (typeof length !== "number") length = Number(length);
    if (!(length > 0)) length = 0;
    else if (length > 9007199254740991) length = 9007199254740991;
    else length = length - (length % 1);
    if (index >= length) return record;
    const value = object[index];
    record.index = index + 1;
    record.object = object;
    return value;
  }
  const length = object.length;
  if (index >= length) return record;
  let end = index + 1;
  const first = recordKind2Code(object, index);
  if (first >= 55296 && first <= 56319 && end < length) {
    const second = recordKind2Code(object, end);
    if (second >= 56320 && second <= 57343) end = end + 1;
  }
  record.index = end;
  record.object = object;
  return recordKind2Slice(object, index, end);
}

function recordKind2Code(text, index) {
  return text.charCodeAt(index);
}

function recordKind2Slice(text, start, end) {
  return text.slice(start, end);
}

export function simulateStepOrder(record, log = []) {
  if (record.kind !== 3) return stepIntrinsic(record);
  if (record.iterator === undefined) return record;
  const next = record.next;
  const iterator = record.iterator;
  if (typeof next !== "function") throw new TypeError("Iterator next is not a function");
  note(log, { op: "call", key: "next", receiver: iterator });
  const result = Reflect.apply(next, iterator, []);
  if (!isObjectOrFunction(result)) throw new TypeError("Iterator result is not an object");
  note(log, { op: "get", key: "done" });
  const done = result.done;
  if (done) {
    record.iterator = undefined;
    return record;
  }
  note(log, { op: "get", key: "value" });
  return result.value;
}

// Host stand-in for the spliced guest strings. __lanesCall is Reflect.apply;
// __lanesDescriptor is a null-prototype object; number/char/slice shims match
// the kind 1 and kind 2 formulas above. Not used by the GPU.
export function compileGuestIterators(hooks = {}) {
  const call = hooks.call || ((fn, receiver, ...args) => Reflect.apply(fn, receiver, args));
  const descriptor = hooks.descriptor || (() => Object.create(null));
  const number = hooks.number || (value => Number(value));
  const charCodeAt = hooks.charCodeAt || ((text, index) => text.charCodeAt(index));
  const slice = hooks.slice || ((text, start, end) => text.slice(start, end));
  const open = new Function(
    "__lanesCall",
    "__lanesDescriptor",
    "Symbol",
    "TypeError",
    `"use strict";\n${iteratorOpenBootstrapSource}\nreturn iteratorOpenBootstrap;`,
  )(call, descriptor, Symbol, TypeError);
  const step = new Function(
    "__lanesCall",
    "__lanesNumber",
    "__lanesCharCodeAt",
    "__lanesSlice",
    "TypeError",
    `"use strict";\n${iteratorStepBootstrapSource}\nreturn iteratorStepBootstrap;`,
  )(call, number, charCodeAt, slice, TypeError);
  return { open, step };
}
