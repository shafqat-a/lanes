import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import * as pk from "./property-key.js";
import {
  SYMBOL_KEY_SIDECAR_KIND,
  SYMBOL_KEY_SIDECAR_USED,
  integerIndexKeyWord,
  isPackedSymbolKey,
  packSymbolCellKey,
  packedSymbolCellNode,
  symbolKeyBuiltins,
} from "./symbol-key-builtins.js";
import { WELL_KNOWN_ID, stringPropertyKey, symbolPropertyKey } from "../symbol-protocols/well-known.js";

const symbolIds = new Map();
let nextSymbolId = 1;

function toKey(key) {
  if (typeof key === "symbol") {
    let id = symbolIds.get(key);
    if (id === undefined) {
      id = nextSymbolId++;
      symbolIds.set(key, id);
    }
    return pk.symbolKey(id);
  }
  if (typeof key !== "string") throw new Error("test key must be a string or a host symbol");
  return pk.stringKey(key);
}

function expectSameKeys(guestKeys, hostKeys) {
  assert.equal(guestKeys.length, hostKeys.length);
  for (let i = 0; i < hostKeys.length; i++) {
    const hostKey = hostKeys[i];
    const guestKey = guestKeys[i];
    if (typeof hostKey === "symbol") {
      assert.equal(guestKey.kind, "symbol");
      assert.equal(guestKey.id, symbolIds.get(hostKey));
    } else {
      assert.equal(typeof hostKey, "string");
      assert.equal(guestKey.kind, "string");
      assert.equal(guestKey.value, hostKey);
    }
  }
}

function dual(parentPair = null) {
  const host = parentPair ? Object.create(parentPair.host) : {};
  const guest = { entries: [], parent: parentPair ? parentPair.guest : null };
  const pair = {
    host,
    guest,
    define(key, desc) {
      const ok = pk.defineOwn(guest.entries, toKey(key), desc);
      Object.defineProperty(host, key, desc);
      assert.equal(ok, true);
    },
    set(key, value) {
      const guestSet = pk.set(guest, toKey(key), value);
      const hostSet = Reflect.set(host, key, value);
      assert.equal(guestSet, hostSet);
      return guestSet;
    },
    del(key) {
      const guestDeleted = pk.deleteOwn(guest.entries, toKey(key));
      const hostDeleted = Reflect.deleteProperty(host, key);
      assert.equal(guestDeleted, hostDeleted);
      return guestDeleted;
    },
  };
  return pair;
}

function expectOwn(pair) {
  expectSameKeys(pk.ownPropertyKeys(pair.guest.entries), Reflect.ownKeys(pair.host));
  expectSameKeys(pk.ownSymbols(pair.guest.entries), Object.getOwnPropertySymbols(pair.host));
  assert.deepEqual(
    pk.enumerableOwnStrings(pair.guest.entries).map(key => key.value),
    Object.keys(pair.host),
  );
}

function guestForIn(object) {
  const seen = new Set();
  const out = [];
  const lowers = [];
  let current = object;
  for (let guard = 0; current != null && guard < 64; guard++) {
    const keys = pk.enumerableOwnStrings(current.entries);
    for (const key of keys) {
      if (seen.has(key.value)) continue;
      let shadowed = false;
      for (const lower of lowers) {
        if (pk.getOwn(lower.entries, key)) {
          shadowed = true;
          break;
        }
      }
      const own = pk.getOwn(current.entries, key);
      if (!own || !own.enumerable || shadowed) continue;
      seen.add(key.value);
      out.push(key.value);
    }
    lowers.push(current);
    current = current.parent;
  }
  return out;
}

function hostForIn(object) {
  const out = [];
  for (const key in object) out.push(key);
  return out;
}

function expectForIn(pair) {
  assert.deepEqual(guestForIn(pair.guest), hostForIn(pair.host));
}

function expectSpread(pair, excluded = []) {
  const target = { entries: [], parent: null };
  pk.copyDataProperties(target, pair.guest, excluded.map(toKey));
  const hostCopy = {};
  for (const key of Reflect.ownKeys(pair.host)) {
    if (excluded.some(item => Object.is(item, key))) continue;
    const desc = Object.getOwnPropertyDescriptor(pair.host, key);
    if (desc && desc.enumerable) hostCopy[key] = pair.host[key];
  }
  expectSameKeys(pk.ownPropertyKeys(target.entries), Reflect.ownKeys(hostCopy));
  for (const key of Reflect.ownKeys(hostCopy)) {
    assert.equal(pk.getOwn(target.entries, toKey(key)).value, hostCopy[key]);
  }
  return { guest: target, host: hostCopy };
}

function hostArrayIndex(string) {
  if (typeof string !== "string") return false;
  const index = string >>> 0;
  return String(index) === string && index !== 0xffffffff;
}

test("isIntegerIndex matches the canonical array-index oracle", () => {
  const samples = [
    "0", "1", "2", "10", "4294967294", "4294967295", "4294967296",
    "-1", "01", "1.0", "-0", "00", "+1", "1e2", "", "1.", " 1", "1 ",
    "0.0", "000", "9007199254740992", "08", "1a", "-0", "0",
  ];
  for (const sample of samples) {
    assert.equal(pk.isIntegerIndex(sample), hostArrayIndex(sample), sample);
  }
  assert.equal(pk.isIntegerIndex(1), false);
  assert.equal(pk.isIntegerIndex("-0"), false);
});

test("integer indices sort numerically ahead of other strings and symbols", () => {
  const pair = dual();
  pair.set("2", "a");
  pair.set("10", "b");
  pair.set("1", "c");
  const symbol = Symbol("s");
  pair.set(symbol, "sym");
  pair.set("b", "bee");
  assert.deepEqual(Reflect.ownKeys(pair.host), ["1", "2", "10", "b", symbol]);
  expectOwn(pair);
  const index1 = pk.getOwn(pair.guest.entries, pk.stringKey("1"));
  const index2 = pk.getOwn(pair.guest.entries, pk.stringKey("2"));
  const index10 = pk.getOwn(pair.guest.entries, pk.stringKey("10"));
  assert.ok(index2.created < index10.created && index10.created < index1.created);
  assert.ok(pk.compareOwnPropertyKeyOrder(index1, index2) < 0);
  assert.ok(pk.compareOwnPropertyKeyOrder(index2, index10) < 0);
  assert.ok(pk.compareOwnPropertyKeyOrder(index10, pk.getOwn(pair.guest.entries, pk.stringKey("b"))) < 0);
  assert.ok(pk.compareOwnPropertyKeyOrder(
    pk.getOwn(pair.guest.entries, pk.stringKey("b")),
    pk.getOwn(pair.guest.entries, toKey(symbol)),
  ) < 0);
});

test('"-1", "01", and "1.0" are not integer indices', () => {
  const pair = dual();
  pair.set("2", 1);
  pair.set("10", 2);
  pair.set("1", 3);
  pair.set("-1", 4);
  pair.set("01", 5);
  pair.set("1.0", 6);
  pair.set("-0", 7);
  assert.deepEqual(Reflect.ownKeys(pair.host), ["1", "2", "10", "-1", "01", "1.0", "-0"]);
  expectOwn(pair);
  assert.equal(pk.isIntegerIndex("-1"), false);
  assert.equal(pk.isIntegerIndex("01"), false);
  assert.equal(pk.isIntegerIndex("1.0"), false);
  assert.equal(pk.isIntegerIndex("-0"), false);
  assert.equal(pk.isIntegerIndex("0"), true);
  assert.equal(pk.isIntegerIndex("4294967294"), true);
  assert.equal(pk.isIntegerIndex("4294967295"), false);
});

test("delete and readd appends a string key and re-sorts an integer index", () => {
  const strings = dual();
  strings.set("a", 1);
  strings.set("b", 2);
  strings.set("c", 3);
  strings.del("b");
  strings.set("b", 4);
  assert.deepEqual(Reflect.ownKeys(strings.host), ["a", "c", "b"]);
  expectOwn(strings);
  assert.ok(pk.getOwn(strings.guest.entries, pk.stringKey("b")).created
    > pk.getOwn(strings.guest.entries, pk.stringKey("c")).created);

  const indices = dual();
  indices.set("1", "a");
  indices.set("3", "b");
  indices.set("2", "c");
  indices.set("z", 1);
  indices.del("2");
  indices.set("2", "d");
  assert.deepEqual(Reflect.ownKeys(indices.host), ["1", "2", "3", "z"]);
  expectOwn(indices);
});

test("a symbol definition does not change string order", () => {
  const pair = dual();
  pair.set("a", 1);
  pair.set("b", 2);
  const before = pk.getOwn(pair.guest.entries, pk.stringKey("b")).created;
  const symbol = Symbol("mid");
  pair.set(symbol, 3);
  pair.set("c", 4);
  assert.equal(pk.getOwn(pair.guest.entries, pk.stringKey("b")).created, before);
  assert.deepEqual(Reflect.ownKeys(pair.host), ["a", "b", "c", symbol]);
  expectOwn(pair);
});

test("non-enumerable symbol is omitted from spread and for-in but stays in ownKeys", () => {
  const symbol = Symbol("hid");
  const pair = dual();
  pair.set("a", 1);
  pair.define(symbol, { value: 9, writable: true, enumerable: false, configurable: true });
  expectOwn(pair);
  assert.deepEqual(Object.getOwnPropertySymbols(pair.host), [symbol]);
  assert.deepEqual(Reflect.ownKeys(pair.host), ["a", symbol]);
  expectForIn(pair);
  assert.deepEqual(hostForIn(pair.host), ["a"]);
  const spread = expectSpread(pair);
  assert.deepEqual(Reflect.ownKeys(spread.host), ["a"]);
  assert.equal(symbol in spread.host, false);
  assert.equal(pk.has(spread.guest, toKey(symbol)), false);
});

test("enumerable symbol is copied by spread and not by for-in", () => {
  const symbol = Symbol("vis");
  const pair = dual();
  pair.set("a", 2);
  pair.set("1", 3);
  pair.define(symbol, { value: 9, writable: true, enumerable: true, configurable: true });
  expectOwn(pair);
  expectForIn(pair);
  assert.deepEqual(hostForIn(pair.host), ["1", "a"]);
  const spread = expectSpread(pair);
  expectSameKeys(pk.ownPropertyKeys(spread.guest.entries), Reflect.ownKeys(spread.host));
  assert.equal(spread.host[symbol], 9);
  assert.deepEqual(hostForIn(spread.host), ["1", "a"]);
  const literal = { ...pair.host };
  expectSameKeys(pk.ownPropertyKeys(spread.guest.entries), Reflect.ownKeys(literal));
});

test("in sees a symbol key on the prototype", () => {
  const symbol = Symbol("p");
  const proto = dual();
  proto.set(symbol, 1);
  proto.set("a", 2);
  proto.define("hidden", { value: 3, writable: true, enumerable: false, configurable: true });
  const child = dual(proto);
  assert.equal(symbol in child.host, true);
  assert.equal(pk.has(child.guest, toKey(symbol)), true);
  assert.equal(pk.getOwn(child.guest.entries, toKey(symbol)), undefined);
  assert.equal("a" in child.host, true);
  assert.equal(pk.has(child.guest, pk.stringKey("a")), true);
  assert.equal("hidden" in child.host, true);
  assert.equal(pk.has(child.guest, pk.stringKey("hidden")), true);
  assert.equal("missing" in child.host, false);
  assert.equal(pk.has(child.guest, pk.stringKey("missing")), false);
  expectForIn(child);
  assert.deepEqual(hostForIn(child.host), ["a"]);
  const spread = expectSpread(child);
  assert.deepEqual(Reflect.ownKeys(spread.host), []);
});

test("two symbols with the same description are different keys", () => {
  const left = Symbol("d");
  const right = Symbol("d");
  assert.equal(left.description, right.description);
  assert.notEqual(left, right);
  const pair = dual();
  pair.set(left, 1);
  pair.set(right, 2);
  pair.set("a", 3);
  assert.equal(pair.host[left], 1);
  assert.equal(pair.host[right], 2);
  assert.equal(pk.getOwn(pair.guest.entries, toKey(left)).value, 1);
  assert.equal(pk.getOwn(pair.guest.entries, toKey(right)).value, 2);
  assert.notEqual(toKey(left).id, toKey(right).id);
  expectOwn(pair);
  assert.deepEqual(Object.getOwnPropertySymbols(pair.host), [left, right]);
  pair.del(left);
  assert.equal(pk.getOwn(pair.guest.entries, toKey(left)), undefined);
  assert.equal(pk.getOwn(pair.guest.entries, toKey(right)).value, 2);
  expectOwn(pair);
});

test("getOwnPropertySymbols and Reflect.ownKeys keep insertion order", () => {
  const first = Symbol("a");
  const second = Symbol("b");
  const pair = dual();
  pair.set(first, 1);
  pair.set("z", 2);
  pair.set(second, 3);
  pair.set("2", 4);
  pair.set("10", 5);
  assert.deepEqual(Object.getOwnPropertySymbols(pair.host), [first, second]);
  assert.deepEqual(Reflect.ownKeys(pair.host), ["2", "10", "z", first, second]);
  expectOwn(pair);
  assert.deepEqual(pk.ownSymbols(pair.guest.entries).map(key => key.id), [
    symbolIds.get(first),
    symbolIds.get(second),
  ]);
});

test("rest exclusion of a symbol key uses SameValue, not the description", () => {
  const dropped = Symbol("d");
  const kept = Symbol("d");
  const pair = dual();
  pair.set("a", 1);
  pair.set(dropped, 2);
  pair.set("b", 3);
  pair.set(kept, 4);
  const { [dropped]: removed, ...rest } = pair.host;
  assert.equal(removed, 2);
  assert.deepEqual(Reflect.ownKeys(rest), ["a", "b", kept]);
  const copied = expectSpread(pair, [dropped]);
  expectSameKeys(pk.ownPropertyKeys(copied.guest.entries), Reflect.ownKeys(rest));
  assert.equal(pk.getOwn(copied.guest.entries, toKey(kept)).value, 4);
  assert.equal(pk.getOwn(copied.guest.entries, toKey(dropped)), undefined);
});

test("prototype mutation does not drop symbol keys on the child", () => {
  const symbol = Symbol("k");
  const proto = dual();
  const child = dual(proto);
  child.set(symbol, 1);
  child.set("a", 2);
  const replacement = dual();
  replacement.set("b", 3);
  child.guest.parent = replacement.guest;
  Object.setPrototypeOf(child.host, replacement.host);
  expectOwn(child);
  assert.equal(child.host[symbol], 1);
  assert.equal(pk.getOwn(child.guest.entries, toKey(symbol)).value, 1);
  assert.equal(pk.has(child.guest, pk.stringKey("b")), true);
  assert.equal("b" in child.host, true);
  assert.equal(pk.has(child.guest, pk.stringKey("a")), true);
});

test("assignment and define defaults match the host", () => {
  const pair = dual();
  pair.set("a", 1);
  const hostDesc = Object.getOwnPropertyDescriptor(pair.host, "a");
  const guestDesc = pk.getOwn(pair.guest.entries, pk.stringKey("a"));
  assert.equal(guestDesc.writable, hostDesc.writable);
  assert.equal(guestDesc.enumerable, hostDesc.enumerable);
  assert.equal(guestDesc.configurable, hostDesc.configurable);
  pair.define("b", { value: 2 });
  const bare = Object.getOwnPropertyDescriptor(pair.host, "b");
  const guestBare = pk.getOwn(pair.guest.entries, pk.stringKey("b"));
  assert.equal(guestBare.value, bare.value);
  assert.equal(guestBare.writable, false);
  assert.equal(guestBare.enumerable, false);
  assert.equal(guestBare.configurable, false);
  pair.define("c", { value: 1, writable: true, enumerable: false, configurable: true });
  pair.set("c", 5);
  assert.equal(pair.host.c, 5);
  assert.equal(Object.getOwnPropertyDescriptor(pair.host, "c").enumerable, false);
  assert.equal(pk.getOwn(pair.guest.entries, pk.stringKey("c")).enumerable, false);
  assert.equal(pk.getOwn(pair.guest.entries, pk.stringKey("c")).value, 5);
});

test("inherited set and non-writable refusal", () => {
  const proto = dual();
  proto.set("a", 1);
  proto.define("c", { value: 1, writable: false, enumerable: true, configurable: true });
  const child = dual(proto);
  assert.equal(child.set("a", 2), true);
  assert.equal(child.host.a, 2);
  assert.equal(proto.host.a, 1);
  assert.equal(Object.hasOwn(child.host, "a"), true);
  assert.notEqual(pk.getOwn(child.guest.entries, pk.stringKey("a")), undefined);
  assert.equal(child.set("c", 5), false);
  assert.equal(child.host.c, 1);
  assert.equal(Object.hasOwn(child.host, "c"), false);
  assert.equal(pk.getOwn(child.guest.entries, pk.stringKey("c")), undefined);
});

test("non-configurable delete fails and SameValue keeps NaN and -0", () => {
  const pair = dual();
  pair.define("a", { value: 1, writable: false, enumerable: true, configurable: false });
  assert.equal(pair.del("a"), false);
  assert.equal(pair.host.a, 1);
  pair.define("n", { value: NaN, writable: false, enumerable: false, configurable: false });
  assert.equal(pk.defineOwn(pair.guest.entries, pk.stringKey("n"), { value: NaN }), true);
  Object.defineProperty(pair.host, "n", { value: NaN });
  assert.equal(pk.defineOwn(pair.guest.entries, pk.stringKey("n"), { value: 1 }), false);
  assert.throws(() => Object.defineProperty(pair.host, "n", { value: 1 }), TypeError);
  pair.define("z", { value: -0, writable: false, enumerable: false, configurable: false });
  assert.equal(pk.defineOwn(pair.guest.entries, pk.stringKey("z"), { value: 0 }), false);
  assert.throws(() => Object.defineProperty(pair.host, "z", { value: 0 }), TypeError);
  assert.equal(pk.defineOwn(pair.guest.entries, pk.stringKey("z"), { value: -0 }), true);
});

test("name and length stay ordinary string keys", () => {
  const pair = dual();
  pair.define("name", { value: "f", writable: false, enumerable: false, configurable: true });
  pair.define("length", { value: 1, writable: false, enumerable: false, configurable: true });
  pair.set("a", 1);
  const symbol = Symbol("m");
  pair.set(symbol, 2);
  assert.deepEqual(Reflect.ownKeys(pair.host), ["name", "length", "a", symbol]);
  expectOwn(pair);
  assert.equal(pk.isIntegerIndex("name"), false);
  assert.equal(pk.isIntegerIndex("length"), false);
});

test("accessor descriptors throw Unsupported and are not stored as data", () => {
  const entries = [];
  assert.throws(
    () => pk.defineOwn(entries, pk.stringKey("a"), { get() { return 1; } }),
    pk.Unsupported,
  );
  assert.throws(
    () => pk.defineOwn(entries, pk.symbolKey(1), { set() {} }),
    pk.Unsupported,
  );
  assert.equal(entries.length, 0);
});

test("symbol id 0 is invalid and id 0xffffffff is a real key", () => {
  assert.throws(() => pk.symbolKey(0), TypeError);
  assert.throws(() => pk.symbolKey(0x100000000), TypeError);
  const entries = [];
  const key = pk.symbolKey(0xffffffff);
  assert.equal(pk.defineOwn(entries, key, { value: 7, writable: true, enumerable: true, configurable: true }), true);
  assert.equal(pk.getOwn(entries, { kind: "symbol", id: 0xffffffff }).value, 7);
  assert.equal(pk.ownSymbols(entries).length, 1);
});

test("same symbol id is one key even when the key records differ", () => {
  const entries = [];
  pk.defineOwn(entries, { kind: "symbol", id: 5 }, {
    value: 1, writable: true, enumerable: true, configurable: true,
  });
  assert.equal(pk.getOwn(entries, { kind: "symbol", id: 5 }).value, 1);
  assert.equal(pk.set({ entries, parent: null }, { kind: "symbol", id: 5 }, 4), true);
  assert.equal(entries.length, 1);
  assert.equal(pk.getOwn(entries, pk.symbolKey(5)).value, 4);
});

test("null source spread leaves the target unchanged", () => {
  const target = { entries: [], parent: null };
  pk.defineOwn(target.entries, pk.stringKey("a"), {
    value: 1, writable: true, enumerable: true, configurable: true,
  });
  assert.equal(pk.copyDataProperties(target, null, []), target);
  assert.equal(pk.copyDataProperties(target, undefined, null), target);
  assert.equal(pk.ownPropertyKeys(target.entries).length, 1);
});

test("prototype cycle fails instead of looping", () => {
  const left = { entries: [], parent: null };
  const right = { entries: [], parent: left };
  left.parent = right;
  assert.throws(() => pk.has(left, pk.stringKey("a")), TypeError);
  assert.throws(() => pk.set(left, pk.symbolKey(3), 1), TypeError);
});

test("protocols @@iterator key is a non-enumerable symbol key", () => {
  const entries = [];
  const iterator = symbolPropertyKey(WELL_KNOWN_ID.iterator);
  assert.equal(pk.defineOwn(entries, stringPropertyKey("length"), {
    value: 0, writable: false, enumerable: false, configurable: true,
  }), true);
  assert.equal(pk.defineOwn(entries, iterator, {
    value: 334, writable: true, enumerable: false, configurable: true,
  }), true);
  assert.deepEqual(pk.ownPropertyKeys(entries), [
    { kind: "string", value: "length" },
    { kind: "symbol", id: WELL_KNOWN_ID.iterator },
  ]);
  assert.deepEqual(pk.enumerableOwnStrings(entries), []);
  assert.deepEqual(pk.ownSymbols(entries), [{ kind: "symbol", id: WELL_KNOWN_ID.iterator }]);
});

test("inline cell-node key does not collide with integer or string words", () => {
  assert.equal(SYMBOL_KEY_SIDECAR_KIND, 20);
  assert.equal(SYMBOL_KEY_SIDECAR_USED, false);
  assert.equal(packSymbolCellKey(1), 0x60000001);
  assert.equal(packedSymbolCellNode(0x60000001), 1);
  assert.equal(isPackedSymbolKey(1 | 0x80000000), false);
  assert.equal(isPackedSymbolKey(1 | 0x40000000), false);
  assert.equal(isPackedSymbolKey(0xc0000001), false);
  assert.throws(() => packSymbolCellKey(0), TypeError);
  assert.throws(() => packSymbolCellKey(0x20000000), TypeError);
  for (const index of [0, 1, 2, 10, 0x3fffffff, 0x40000000, 0x40000001, 0x7ffffffe, 0x7fffffff]) {
    assert.equal(isPackedSymbolKey(integerIndexKeyWord(index)), false);
  }
  assert.equal(integerIndexKeyWord(4294967294), null);
  const builtins = symbolKeyBuiltins.map(entry => entry.id).filter(id => id != null);
  assert.deepEqual(builtins, [1050]);
  for (const entry of symbolKeyBuiltins) {
    if (entry.id == null) assert.match(entry.note, /extend opcode/);
    assert.equal(typeof entry.length, "number");
    assert.equal(typeof entry.spec, "string");
  }
});

test("guest module does not call host Object, Reflect, or Symbol", () => {
  const source = readFileSync(new URL("./property-key.js", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(source, /\bReflect\b/);
  assert.doesNotMatch(source, /\bSymbol\b/);
  assert.doesNotMatch(source, /Object\.(keys|getOwnProperty|defineProperty|create|assign|freeze|is)/);
});

test("wgsl fragment keeps the inline key and an explicit sidecar gap", () => {
  const source = readFileSync(new URL("./symbol-keys.wgsl", import.meta.url), "utf8");
  assert.match(source, /INTEGRATION_GAPS/);
  assert.match(source, /SYMBOL_KEY_SIDECAR_KIND: u32 = 20u;/);
  assert.match(source, /0x60000000u/);
  assert.match(source, /fn own_property_keys_out/);
  assert.match(source, /fn symbol_get/);
  assert.match(source, /fn symbol_set/);
  assert.match(source, /fn symbol_delete/);
  assert.match(source, /fn key_order/);
  assert.doesNotMatch(source, /alloc\([^)]*20u/);
});
