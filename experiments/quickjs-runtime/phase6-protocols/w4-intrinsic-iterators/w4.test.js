import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "acorn";
import { arrayBuiltins } from "../../array-source.js";
import {
  ARRAY_ENTRIES_ID,
  ARRAY_ITERATOR_KIND,
  ARRAY_ITERATOR_NEXT_ID,
  ARRAY_ITERATOR_PROTOTYPE,
  ARRAY_KEYS_ID,
  ARRAY_VALUES_ID,
  HEAP_KIND_ARRAY_ITERATOR,
  HEAP_KIND_STRING_ITERATOR,
  ITERATOR_IDENTITY_ID,
  ITERATOR_PROTOTYPE,
  STRING_ITERATOR_ID,
  STRING_ITERATOR_NEXT_ID,
  STRING_ITERATOR_PROTOTYPE,
  fixedNodes,
  iteratorBuiltinFields,
  iteratorPrivateBuiltins,
  sources,
  unusedHeapKinds,
} from "./index.js";
import { arrayIteratorMethodSources, iteratorBootstrapSources } from "./sources.js";
import {
  arrayIteratorNext,
  createArrayIterator,
  createStringIterator,
  iteratorIdentity,
  next,
  readCodePoint,
  stringIteratorDone,
  stringIteratorNext,
  stringIteratorTake,
  toLength,
} from "./simulate.js";
import {
  iteratorMarkText,
  iteratorObjectMethodText,
  iteratorObjectMethodWGSL,
  iteratorWgslFunctionText,
  iteratorWgslFunctions,
} from "./wgsl.js";

function assertResult(result, value, done) {
  assert.deepEqual(result, { value, done });
  assert.equal(Object.getPrototypeOf(result), Object.prototype);
  for (const key of ["value", "done"]) {
    const desc = Object.getOwnPropertyDescriptor(result, key);
    assert.equal(desc.writable, true);
    assert.equal(desc.enumerable, true);
    assert.equal(desc.configurable, true);
  }
}

function drain(iterator, step) {
  const values = [];
  for (;;) {
    const result = step(iterator);
    if (result.done) {
      assertResult(result, undefined, true);
      return values;
    }
    values.push(result.value);
  }
}

test("fixed nodes and builtin ids", () => {
  assert.deepEqual(fixedNodes, {
    iteratorPrototype: 77,
    arrayIteratorPrototype: 78,
    stringIteratorPrototype: 79,
  });
  assert.equal(ITERATOR_PROTOTYPE, 77);
  assert.equal(ARRAY_ITERATOR_PROTOTYPE, 78);
  assert.equal(STRING_ITERATOR_PROTOTYPE, 79);
  assert.equal(300 + arrayBuiltins.indexOf("values"), ARRAY_VALUES_ID);
  assert.equal(300 + arrayBuiltins.indexOf("keys"), ARRAY_KEYS_ID);
  assert.equal(300 + arrayBuiltins.indexOf("entries"), ARRAY_ENTRIES_ID);
  assert.equal(ARRAY_VALUES_ID, 334);
  assert.equal(ARRAY_KEYS_ID, 317);
  assert.equal(ARRAY_ENTRIES_ID, 303);
  assert.equal(STRING_ITERATOR_ID, 1103);
  assert.equal(ARRAY_ITERATOR_NEXT_ID, 2460);
  assert.equal(STRING_ITERATOR_NEXT_ID, 2461);
  assert.equal(ITERATOR_IDENTITY_ID, 2463);
  assert.equal(HEAP_KIND_ARRAY_ITERATOR, 51);
  assert.equal(HEAP_KIND_STRING_ITERATOR, 52);
  assert.deepEqual(unusedHeapKinds, [53, 54, 55]);
  assert.deepEqual(ARRAY_ITERATOR_KIND, { keys: 0, values: 1, entries: 2 });
  const privateIds = Object.values(iteratorPrivateBuiltins);
  assert.equal(new Set(privateIds).size, privateIds.length);
  for (const id of privateIds) assert.ok(id >= 2420 && id <= 2439);
  for (const id of [2460, 2461, 2463]) assert.ok(id >= 2460 && id <= 2479);
  assert.equal(iteratorBuiltinFields[1103], "stringIterator");
  assert.equal(iteratorBuiltinFields[2460], "arrayIteratorNext");
  assert.equal(iteratorBuiltinFields[2461], "stringIteratorNext");
  assert.equal(iteratorBuiltinFields[2463], "iteratorIdentity");
  assert.equal(Object.hasOwn(sources, "iteratorIdentity"), false);
});

test("NOTES documents the required fixed nodes", () => {
  const notes = readFileSync(new URL("./NOTES.md", import.meta.url), "utf8");
  assert.match(notes, /77.*%IteratorPrototype%/s);
  assert.match(notes, /78.*%ArrayIteratorPrototype%/s);
  assert.match(notes, /79.*%StringIteratorPrototype%/s);
  assert.match(notes, /Object\.prototype \(node 1\)/);
  assert.match(notes, /node 77/);
  assert.match(notes, /Do not `alloc` them/);
  assert.match(notes, /Kinds 53, 54, and 55 are unused/);
  assert.match(notes, /not reported with `__lanesUnsupported`/);
});

test("guest sources are strict functions arrayMethods can merge", () => {
  for (const name of ["values", "keys", "entries"]) {
    const field = "array" + name[0].toUpperCase() + name.slice(1);
    assert.equal(Object.hasOwn(arrayIteratorMethodSources, field), true);
    assert.match(arrayIteratorMethodSources[field], /"use strict"/);
    assert.match(arrayIteratorMethodSources[field], /__lanesToObject\(this\)/);
    assert.match(arrayIteratorMethodSources[field], /__lanesCreateArrayIterator\(object, [012]\)/);
    assert.equal(arrayIteratorMethodSources[field].includes("object["), false);
  }
  assert.match(arrayIteratorMethodSources.arrayValues, /__lanesCreateArrayIterator\(object, 1\)/);
  assert.match(arrayIteratorMethodSources.arrayKeys, /__lanesCreateArrayIterator\(object, 0\)/);
  assert.match(arrayIteratorMethodSources.arrayEntries, /__lanesCreateArrayIterator\(object, 2\)/);
  const nextSource = iteratorBootstrapSources.arrayIteratorNext;
  const setAt = nextSource.indexOf("__lanesArrayIteratorSetIndex");
  const getAt = nextSource.indexOf("object[index]");
  const keyReturn = nextSource.indexOf("kind === 0");
  assert.ok(setAt !== -1 && getAt !== -1 && setAt < getAt);
  assert.ok(keyReturn !== -1 && keyReturn < getAt);
  assert.equal(nextSource.indexOf("object[index]"), nextSource.lastIndexOf("object[index]"));
  assert.match(nextSource, /TypeError\("Array iterator expected"\)/);
  assert.match(nextSource, /9007199254740991/);
  assert.match(iteratorBootstrapSources.stringIterator, /__lanesPrimitive\(value, true\)/);
  assert.ok(!iteratorBootstrapSources.stringIterator.includes("BigInt to string is unsupported"));
  assert.match(iteratorBootstrapSources.stringIterator, /Cannot convert a Symbol value to a string/);
  assert.match(iteratorBootstrapSources.stringIteratorNext, /TypeError\("String iterator expected"\)/);
  assert.match(iteratorBootstrapSources.stringIteratorNext, /__lanesStringIteratorTake\(this\)/);
  assert.equal(nextSource.includes("__lanesUnsupported"), false);
  assert.equal(iteratorBootstrapSources.stringIteratorNext.includes("__lanesUnsupported"), false);
  for (const source of Object.values(sources)) {
    const ast = parse(source, { ecmaVersion: 2025 });
    const fn = ast.body[0];
    assert.equal(ast.body.length, 1);
    assert.equal(fn.type, "FunctionDeclaration");
    assert.equal(fn.async, false);
    assert.equal(fn.generator, false);
    assert.equal(fn.body.body[0].directive, "use strict");
  }
});

test("WGSL is shader text with no host oracle", () => {
  assert.equal(iteratorWgslFunctionText.includes("${"), false);
  assert.equal(iteratorObjectMethodText.includes("${"), false);
  assert.match(iteratorWgslFunctionText, /alloc\(l,51u,V\(78u,/);
  assert.match(iteratorWgslFunctionText, /alloc\(l,52u,V\(79u,/);
  assert.match(iteratorWgslFunctionText, /alloc\(l,13u,/);
  assert.match(iteratorWgslFunctionText, /unit\(l,text,index\)/);
  assert.match(iteratorWgslFunctionText, /first>=55296u&&first<=56319u/);
  assert.match(iteratorWgslFunctionText, /second>=56320u&&second<=57343u/);
  assert.match(iteratorWgslFunctionText, /makeText\(l,text,undef\(\),index,end-index\)/);
  assert.match(iteratorWgslFunctionText, /states\[l\]\.heap\[id\]\.value\.z=end/);
  assert.match(iteratorObjectMethodText, /if\(id==2420u\)/);
  assert.match(iteratorObjectMethodText, /if\(id==2421u\)/);
  assert.match(iteratorObjectMethodText, /if\(id==2425u\)/);
  assert.ok(iteratorObjectMethodText.includes('if(id==2463u){return receiver;}'));
  assert.equal(iteratorMarkText, "if(node.kind==51u||node.kind==52u){mark(l,node.value.x);mark(l,node.value.y);}");
  assert.equal(iteratorWgslFunctionText.includes("kind==53"), false);
  assert.equal(iteratorWgslFunctions.length, 0);
  assert.equal(iteratorObjectMethodWGSL.length, 0);
});

test("ToLength matches the phase4 clamp", () => {
  assert.equal(toLength(0), 0);
  assert.equal(toLength(-1), 0);
  assert.equal(toLength(-0), 0);
  assert.equal(toLength(NaN), 0);
  assert.equal(toLength(0.5), 0);
  assert.equal(toLength(1.9), 1);
  assert.equal(toLength("2"), 2);
  assert.equal(toLength(Infinity), 9007199254740991);
  assert.equal(toLength(9007199254740992), 9007199254740991);
  const boxed = { valueOf() { return 3.2; } };
  assert.equal(toLength(boxed), 3);
});

test("values, keys, and entries", () => {
  const object = ["a", "b"];
  assert.deepEqual(drain(createArrayIterator(object, 1), arrayIteratorNext), ["a", "b"]);
  assert.deepEqual(drain(createArrayIterator(object, 0), arrayIteratorNext), [0, 1]);
  const entries = drain(createArrayIterator(object, 2), arrayIteratorNext);
  assert.deepEqual(entries, [[0, "a"], [1, "b"]]);
  assert.equal(Array.isArray(entries[0]), true);
  assert.equal(Object.getPrototypeOf(entries[0]), Array.prototype);
  const fresh = createArrayIterator(["only"], 1);
  assertResult(arrayIteratorNext(fresh), "only", false);
  assertResult(arrayIteratorNext(fresh), undefined, true);
  assertResult(next(fresh), undefined, true);
});

test("empty array yields one done result and stays cleared", () => {
  let reads = 0;
  const object = { get length() { reads++; return 0; }, 0: "late" };
  const iterator = createArrayIterator(object, 1);
  assertResult(arrayIteratorNext(iterator), undefined, true);
  assert.equal(reads, 1);
  object[0] = "still late";
  assertResult(arrayIteratorNext(iterator), undefined, true);
  assert.equal(reads, 1);
  assert.equal(iterator.object, undefined);
});

test("hole versus prototype is just Get, and the factory does not Get", () => {
  let created = false;
  const proto = {
    1: "from-proto",
    get 2() { return "proto-getter"; },
  };
  const object = Object.create(proto);
  Object.defineProperty(object, "0", {
    get() { created = true; return "own"; },
    enumerable: true,
    configurable: true,
  });
  object.length = 4;
  const iterator = createArrayIterator(object, 1);
  assert.equal(created, false);
  assert.deepEqual(drain(iterator, arrayIteratorNext), ["own", "from-proto", "proto-getter", undefined]);
  const hole = [1, , 3];
  assert.deepEqual(drain(createArrayIterator(hole, 1), arrayIteratorNext), [1, undefined, 3]);
});

test("keys do not Get and entries Get once", () => {
  let gets = 0;
  const object = {
    length: 1,
    get 0() { gets++; return "x"; },
  };
  assert.deepEqual(drain(createArrayIterator(object, 0), arrayIteratorNext), [0]);
  assert.equal(gets, 0);
  gets = 0;
  const entries = drain(createArrayIterator(object, 2), arrayIteratorNext);
  assert.deepEqual(entries, [[0, "x"]]);
  assert.equal(gets, 1);
});

test("getter throw advances the index and leaves the object", () => {
  let observed = -1;
  let lengthReads = 0;
  let iterator;
  const object = {
    get length() { lengthReads++; return 2; },
    get 0() {
      observed = iterator.index;
      throw new Error("boom");
    },
    1: "ok",
  };
  iterator = createArrayIterator(object, 1);
  assert.throws(() => arrayIteratorNext(iterator), /boom/);
  assert.equal(observed, 1);
  assert.equal(iterator.index, 1);
  assert.equal(iterator.object, object);
  assertResult(arrayIteratorNext(iterator), "ok", false);
  assert.equal(lengthReads, 2);
  assertResult(arrayIteratorNext(iterator), undefined, true);
});

test("a length getter throw does not advance", () => {
  let reads = 0;
  const object = {
    get length() {
      reads++;
      if (reads === 1) throw new Error("len");
      return 1;
    },
    0: "a",
  };
  const iterator = createArrayIterator(object, 1);
  assert.throws(() => arrayIteratorNext(iterator), /len/);
  assert.equal(iterator.index, 0);
  assert.equal(iterator.object, object);
  assertResult(arrayIteratorNext(iterator), "a", false);
});

test("string code points, pairs, and lone surrogates", () => {
  assert.deepEqual(readCodePoint("\uD800\uDC00", 0), { value: "\uD800\uDC00", end: 2 });
  assert.deepEqual(readCodePoint("\uDBFF\uDFFF", 0), { value: "\uDBFF\uDFFF", end: 2 });
  assert.deepEqual(readCodePoint("\uD800", 0), { value: "\uD800", end: 1 });
  assert.deepEqual(readCodePoint("\uDC00", 0), { value: "\uDC00", end: 1 });
  assert.deepEqual(readCodePoint("\uD800\uDBFF", 0), { value: "\uD800", end: 1 });
  assert.deepEqual(readCodePoint("\uD7FF\uDC00", 0), { value: "\uD7FF", end: 1 });
  const pairs = createStringIterator("a\uD800\uDC00b\uD800\uD800\uDC00");
  assert.equal(stringIteratorDone(pairs), false);
  assert.deepEqual(drain(pairs, stringIteratorNext), ["a", "\uD800\uDC00", "b", "\uD800", "\uD800\uDC00"]);
  assert.equal(pairs.index, 7);
  assert.deepEqual(drain(createStringIterator("\uDC00\uD800"), stringIteratorNext), ["\uDC00", "\uD800"]);
  assert.deepEqual(drain(createStringIterator("\uDBFF\uE000"), stringIteratorNext), ["\uDBFF", "\uE000"]);
  const empty = createStringIterator("");
  assert.equal(stringIteratorTake(empty), undefined);
  assertResult(stringIteratorNext(empty), undefined, true);
  assertResult(next(empty), undefined, true);
  assert.throws(() => stringIteratorNext({}), /String iterator expected/);
  assert.throws(() => arrayIteratorNext({}), /Array iterator expected/);
  assert.throws(() => next({}), /Iterator expected/);
});

test("identity returns the same object", () => {
  const iterator = createArrayIterator([1], 1);
  assert.equal(iteratorIdentity(iterator), iterator);
  const plain = { next() {} };
  assert.equal(iteratorIdentity(plain), plain);
  assert.equal(iteratorIdentity(1), 1);
  assert.equal(iterator.prototype, 78);
  assert.equal(createStringIterator("a").prototype, 79);
  assert.throws(() => iteratorIdentity(null), TypeError);
  assert.throws(() => iteratorIdentity(undefined), TypeError);
});

function compileGuest(source, mocks) {
  const name = /^function\s+([A-Za-z0-9_]+)/.exec(source)[1];
  const keys = Object.keys(mocks);
  const factory = new Function(...keys, `${source}\nreturn ${name};`);
  return factory(...keys.map(key => mocks[key]));
}

function ordinaryPrimitive(value, stringHint) {
  if (value === null || value === undefined) throw new TypeError("Cannot convert undefined or null to object");
  if (typeof value !== "object" && typeof value !== "function") return value;
  const names = stringHint ? ["toString", "valueOf"] : ["valueOf", "toString"];
  for (const name of names) {
    const method = value[name];
    if (typeof method !== "function") continue;
    const result = method.call(value);
    if (result === null || (typeof result !== "object" && typeof result !== "function")) return result;
  }
  throw new TypeError("Cannot convert object to primitive value");
}

function guestHarness() {
  const arrayMocks = {
    __lanesToObject(value) {
      if (value === null || value === undefined) throw new TypeError("ToObject");
      return Object(value);
    },
    __lanesNumber(value) { return Number(value); },
    __lanesCreateArrayIterator(object, kind) { return createArrayIterator(object, kind); },
    __lanesArrayIteratorSlot(iterator, op) {
      const branded = !!iterator && iterator.brand === 51;
      if (op === 0) return branded;
      if (!branded) throw new TypeError("Array iterator expected");
      if (op === 1) return iterator.object;
      if (op === 2) return iterator.index;
      if (op === 3) return iterator.kind;
      throw new TypeError("bad slot");
    },
    __lanesArrayIteratorClear(iterator) { iterator.object = undefined; },
    __lanesArrayIteratorSetIndex(iterator, index) { iterator.index = index; },
  };
  const unsupported = message => {
    const error = new Error(message);
    error.unsupported = true;
    throw error;
  };
  const stringMocks = {
    __lanesPrimitive: ordinaryPrimitive,
    __lanesText(value) { return String(value); },
    __lanesUnsupported: unsupported,
    __lanesCreateStringIterator: createStringIterator,
    __lanesStringIteratorBrand(iterator) { return !!iterator && iterator.brand === 52; },
    __lanesStringIteratorDone: stringIteratorDone,
    __lanesStringIteratorTake: stringIteratorTake,
  };
  return {
    values: compileGuest(arrayIteratorMethodSources.arrayValues, arrayMocks),
    keys: compileGuest(arrayIteratorMethodSources.arrayKeys, arrayMocks),
    entries: compileGuest(arrayIteratorMethodSources.arrayEntries, arrayMocks),
    arrayNext: compileGuest(iteratorBootstrapSources.arrayIteratorNext, arrayMocks),
    stringIterator: compileGuest(iteratorBootstrapSources.stringIterator, stringMocks),
    stringNext: compileGuest(iteratorBootstrapSources.stringIteratorNext, stringMocks),
  };
}

test("guest factories and next match the host model", () => {
  const guest = guestHarness();
  assert.throws(() => guest.values.call(null), TypeError);
  assert.throws(() => guest.values.call(undefined), TypeError);
  let created = false;
  const object = {
    length: 2,
    get 0() { created = true; return "a"; },
    1: "b",
  };
  const values = guest.values.call(object);
  assert.equal(created, false);
  assert.equal(values.kind, 1);
  assert.equal(values.prototype, 78);
  const stepArray = iterator => guest.arrayNext.call(iterator);
  assert.deepEqual(drain(values, stepArray), ["a", "b"]);
  assert.deepEqual(drain(guest.keys.call(["a", "b"]), stepArray), [0, 1]);
  assert.deepEqual(drain(guest.entries.call(["a", "b"]), stepArray), [[0, "a"], [1, "b"]]);

  let observed = -1;
  let iterator;
  const throwing = {
    length: 2,
    get 0() {
      observed = iterator.index;
      throw new Error("boom");
    },
    1: "ok",
  };
  iterator = guest.values.call(throwing);
  assert.throws(() => guest.arrayNext.call(iterator), /boom/);
  assert.equal(observed, 1);
  assertResult(guest.arrayNext.call(iterator), "ok", false);

  const proto = { 1: "from-proto" };
  const holes = Object.create(proto);
  holes.length = 2;
  holes[0] = "own";
  assert.deepEqual(drain(guest.values.call(holes), stepArray), ["own", "from-proto"]);

  const empty = guest.values.call([]);
  assertResult(guest.arrayNext.call(empty), undefined, true);
  assert.throws(() => guest.arrayNext.call({}), /Array iterator expected/);

  const stepString = iterator => guest.stringNext.call(iterator);
  const text = guest.stringIterator.call("a\uD800\uDC00b\uD800");
  assert.deepEqual(drain(text, stepString), ["a", "\uD800\uDC00", "b", "\uD800"]);
  assert.deepEqual(drain(guest.stringIterator.call(65), stepString), ["6", "5"]);
  const viaToString = { toString() { return "xy"; }, valueOf() { throw new Error("valueOf"); } };
  assert.deepEqual(drain(guest.stringIterator.call(viaToString), stepString), ["x", "y"]);
  assert.throws(() => guest.stringIterator.call(null), /undefined or null/);
  assert.throws(() => guest.stringIterator.call(Symbol("s")), /Symbol/);
  assert.deepEqual(drain(guest.stringIterator.call(1n), stepString), ["1"]);
  assert.deepEqual(drain(guest.stringIterator.call({ toString() { return 1n; } }), stepString), ["1"]);
  assert.throws(() => guest.stringNext.call({}), /String iterator expected/);
});
