import test from "node:test";
import assert from "node:assert/strict";
import {
  createObject,
  defineProperty,
  deleteProperty,
  get,
  getOwnPropertyDescriptor,
  getPrototypeOf,
  has,
  ownKeys,
  preventExtensions,
  set,
  setPrototypeOf,
} from "./ordinary-object.js";
import { defects, checked } from "./defects.js";

const data = (value, extra = {}) => ({
  value,
  writable: true,
  enumerable: true,
  configurable: true,
  ...extra,
});

function typeError() {
  return { name: "TypeError", message: "Invalid operation" };
}

test("prototype cycle throws and does not change either object", () => {
  const a = createObject(null);
  const b = createObject(a);
  const c = createObject(b);
  assert.throws(() => setPrototypeOf(a, a), typeError());
  assert.throws(() => setPrototypeOf(a, c), typeError());
  assert.equal(getPrototypeOf(a), null);
  assert.equal(getPrototypeOf(b), a);
  assert.equal(getPrototypeOf(c), b);
});

test("null prototype has no inherited properties", () => {
  const o = createObject(null);
  assert.equal(getPrototypeOf(o), null);
  assert.equal(has(o, "toString"), false);
  assert.equal(get(o, "toString"), undefined);
  assert.deepEqual(ownKeys(o), []);
});

test("inherited get and has see the property; ownKeys does not", () => {
  const parent = createObject(null);
  defineProperty(parent, "v", data(7));
  const child = createObject(parent);
  assert.equal(get(child, "v"), 7);
  assert.equal(has(child, "v"), true);
  assert.equal(getOwnPropertyDescriptor(child, "v"), undefined);
  assert.deepEqual(ownKeys(child), []);
  assert.deepEqual(ownKeys(parent), ["v"]);
});

test("integer indices sort numerically ahead of strings", () => {
  const o = createObject(null);
  for (const key of ["10", "2", "1", "b", "a"]) defineProperty(o, key, data(key));
  assert.deepEqual(ownKeys(o), ["1", "2", "10", "b", "a"]);
});

test("redefine of a non-configurable property throws and keeps the value", () => {
  const o = createObject(null);
  defineProperty(o, "a", { value: 1, writable: false, enumerable: true, configurable: false });
  assert.throws(() => defineProperty(o, "a", { value: 2 }), typeError());
  assert.equal(get(o, "a"), 1);
  defineProperty(o, "a", { value: 1 });
  assert.equal(get(o, "a"), 1);
});

test("writable false rejects [[Set]] even for the same value", () => {
  const o = createObject(null);
  defineProperty(o, "a", { value: 1, writable: false, enumerable: true, configurable: true });
  assert.throws(() => set(o, "a", 1), typeError());
  assert.throws(() => set(o, "a", 2), typeError());
  assert.equal(get(o, "a"), 1);
  defineProperty(o, "a", { value: 2 });
  assert.equal(get(o, "a"), 2);
});

test("non-extensible object rejects a new key and still allows a configurable change", () => {
  const o = createObject(null);
  defineProperty(o, "a", data(1));
  preventExtensions(o);
  assert.throws(() => defineProperty(o, "b", data(2)), typeError());
  assert.equal(has(o, "b"), false);
  defineProperty(o, "a", { value: 3 });
  assert.equal(get(o, "a"), 3);
  assert.deepEqual(ownKeys(o), ["a"]);
  assert.throws(() => setPrototypeOf(o, createObject(null)), typeError());
});

test("name and length stay non-enumerable, non-writable, and configurable", () => {
  const fn = createObject(null);
  defineProperty(fn, "length", { value: 2, writable: false, enumerable: false, configurable: true });
  defineProperty(fn, "name", { value: "g", writable: false, enumerable: false, configurable: true });
  defineProperty(fn, "extra", data(1));
  for (const key of ["name", "length"]) {
    const desc = getOwnPropertyDescriptor(fn, key);
    assert.equal(desc.enumerable, false);
    assert.equal(desc.writable, false);
    assert.equal(desc.configurable, true);
  }
  assert.deepEqual(ownKeys(fn).filter(key => getOwnPropertyDescriptor(fn, key).enumerable), ["extra"]);
  assert.throws(() => set(fn, "name", "changed"), typeError());
  assert.equal(get(fn, "name"), "g");
  defineProperty(fn, "name", { value: "changed" });
  assert.equal(get(fn, "name"), "changed");
});

test("a symbol-kind key stays after strings and does not change their order", () => {
  const o = createObject(null);
  const first = { kind: "symbol", id: 1 };
  const second = { kind: "symbol", id: 2 };
  defineProperty(o, first, data("s1"));
  defineProperty(o, "b", data("b"));
  defineProperty(o, second, data("s2"));
  defineProperty(o, "10", data("10"));
  defineProperty(o, "a", data("a"));
  defineProperty(o, "2", data("2"));
  assert.deepEqual(ownKeys(o), ["2", "10", "b", "a", { kind: "symbol", id: 1 }, { kind: "symbol", id: 2 }]);
  assert.equal(get(o, { kind: "symbol", id: 1 }), "s1");
});

test("delete then readd appends, and an earlier index stays first", () => {
  const o = createObject(null);
  defineProperty(o, "a", data(1));
  defineProperty(o, "2", data(2));
  defineProperty(o, "b", data(3));
  assert.equal(deleteProperty(o, "a"), true);
  defineProperty(o, "a", data(4));
  assert.deepEqual(ownKeys(o), ["2", "b", "a"]);
});

test("setPrototypeOf to the current prototype succeeds", () => {
  const proto = createObject(null);
  const o = createObject(proto);
  assert.equal(setPrototypeOf(o, proto), o);
  assert.equal(getPrototypeOf(o), proto);
  preventExtensions(o);
  assert.equal(setPrototypeOf(o, getPrototypeOf(o)), o);
  assert.equal(getPrototypeOf(o), proto);
});

test("changing the prototype does not reorder own keys", () => {
  const o = createObject(null);
  defineProperty(o, "b", data(1));
  defineProperty(o, "10", data(2));
  defineProperty(o, "a", data(3));
  const before = ownKeys(o);
  setPrototypeOf(o, createObject(null));
  assert.deepEqual(ownKeys(o), before);
  assert.deepEqual(before, ["10", "b", "a"]);
});

test("high index, leading zero, and 2^32-1 stay in the ES buckets", () => {
  const o = createObject(null);
  for (const key of ["4294967295", "2", "4294967294", "01", "10", ""]) defineProperty(o, key, data(key));
  assert.deepEqual(ownKeys(o), ["2", "10", "4294967294", "4294967295", "01", ""]);
});

test("accessor get and set use the receiver and are not data properties", () => {
  const parent = createObject(null);
  let got;
  let setLog;
  defineProperty(parent, "a", {
    get() { got = this; return 1; },
    set(value) { setLog = [this, value]; },
    enumerable: true,
    configurable: true,
  });
  const child = createObject(parent);
  assert.equal(get(child, "a"), 1);
  assert.equal(got, child);
  assert.equal(set(child, "a", 5), true);
  assert.deepEqual(setLog, [child, 5]);
  assert.equal(getOwnPropertyDescriptor(child, "a"), undefined);
  const own = getOwnPropertyDescriptor(parent, "a");
  assert.equal("value" in own, false);
  assert.equal("writable" in own, false);
  assert.equal(typeof own.get, "function");
  assert.equal(typeof own.set, "function");
});

test("inherited non-writable data rejects [[Set]] without creating an own property", () => {
  const parent = createObject(null);
  defineProperty(parent, "a", { value: 1, writable: false, enumerable: true, configurable: true });
  const child = createObject(parent);
  assert.throws(() => set(child, "a", 4), typeError());
  assert.deepEqual(ownKeys(child), []);
  assert.equal(get(child, "a"), 1);
});

test("SameValue: NaN matches and negative zero does not", () => {
  const o = createObject(null);
  defineProperty(o, "n", { value: NaN, writable: false, configurable: false });
  defineProperty(o, "z", { value: 0, writable: false, configurable: false });
  defineProperty(o, "n", { value: NaN });
  assert.throws(() => defineProperty(o, "z", { value: -0 }), typeError());
  assert.equal(Object.is(get(o, "z"), 0), true);
});

test("non-configurable property cannot change enumerable or kind", () => {
  const o = createObject(null);
  defineProperty(o, "a", { value: 1, writable: true, enumerable: true, configurable: false });
  assert.throws(() => defineProperty(o, "a", { enumerable: false }), typeError());
  assert.throws(() => defineProperty(o, "a", { get() { return 1; } }), typeError());
  defineProperty(o, "a", { writable: false, value: 9 });
  assert.equal(get(o, "a"), 9);
  assert.equal(getOwnPropertyDescriptor(o, "a").writable, false);
  assert.throws(() => defineProperty(o, "a", { writable: true }), typeError());
});

test("invalid and mixed descriptors keep the bootstrap TypeError strings", () => {
  const o = createObject(null);
  assert.throws(() => defineProperty(o, "a", null), { name: "TypeError", message: "Descriptor is not an object" });
  assert.throws(() => defineProperty(o, "a", { get: 1 }), { name: "TypeError", message: "Invalid getter" });
  assert.throws(() => defineProperty(o, "a", { set: 1 }), { name: "TypeError", message: "Invalid setter" });
  assert.throws(() => defineProperty(o, "a", { get() {}, value: 1 }), { name: "TypeError", message: "Mixed property descriptor" });
  assert.deepEqual(ownKeys(o), []);
});

test("audit list is empty and records the checks", () => {
  assert.deepEqual(defects, []);
  assert.ok(checked.length >= 8);
  for (const item of checked) {
    assert.equal(typeof item.area, "string");
    assert.equal(typeof item.evidence, "string");
  }
});
