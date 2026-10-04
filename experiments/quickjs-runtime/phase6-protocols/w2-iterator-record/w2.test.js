import assert from "node:assert/strict";
import test from "node:test";
import { compileGuestIterators, simulateOpenOrder, simulateStepOrder } from "./simulate.js";
import { iteratorOpenBootstrapSource, iteratorStepBootstrapSource } from "./sources.js";

function eachEngine(check) {
  check({ mode: "sim", open: simulateOpenOrder, step: simulateStepOrder });
  const guest = compileGuestIterators();
  check({
    mode: "guest",
    open(value) { return guest.open(value); },
    step(record) { return guest.step(record); },
  });
}

function typeError(message) {
  return error => {
    assert.equal(error instanceof TypeError, true);
    assert.equal(error.message, message);
    return true;
  };
}

function iterableOf(iterator) {
  return {
    [Symbol.iterator]() { return iterator; },
  };
}

test("null TypeError before get", () => {
  const nullCheck = iteratorOpenBootstrapSource.indexOf("value === null");
  const symbolGet = iteratorOpenBootstrapSource.indexOf("Symbol.iterator");
  assert.ok(nullCheck !== -1 && symbolGet !== -1 && nullCheck < symbolGet);
  eachEngine(({ mode, open }) => {
    for (const value of [null, undefined]) {
      const log = [];
      assert.throws(() => open(value, log), typeError("Value is not iterable"));
      if (mode === "sim") assert.deepEqual(log, []);
    }
  });
});

test("getter throw identity", () => {
  eachEngine(({ mode, open }) => {
    const marker = { reason: "iterator-getter" };
    let gets = 0;
    const value = {};
    Object.defineProperty(value, Symbol.iterator, {
      configurable: true,
      get() {
        gets += 1;
        throw marker;
      },
    });
    const log = [];
    assert.throws(() => open(value, log), error => error === marker);
    assert.equal(gets, 1);
    if (mode === "sim") assert.deepEqual(log, [{ op: "get", key: "@@iterator" }]);

    const callMarker = { reason: "iterator-call" };
    let calls = 0;
    const calling = {
      [Symbol.iterator]() {
        calls += 1;
        throw callMarker;
      },
    };
    const callLog = [];
    assert.throws(() => open(calling, callLog), error => error === callMarker);
    assert.equal(calls, 1);
    if (mode === "sim") {
      assert.deepEqual(callLog, [
        { op: "get", key: "@@iterator" },
        { op: "call", key: "@@iterator", receiver: calling },
      ]);
    }
  });
});

test("null method TypeError", () => {
  eachEngine(({ mode, open }) => {
    for (const method of [null, undefined]) {
      let calls = 0;
      const value = {
        [Symbol.iterator]: method,
        next() { calls += 1; },
      };
      const log = [];
      assert.throws(() => open(value, log), typeError("Value is not iterable"));
      assert.equal(calls, 0);
      if (mode === "sim") assert.deepEqual(log, [{ op: "get", key: "@@iterator" }]);
    }
  });
});

test("non-callable TypeError", () => {
  eachEngine(({ mode, open }) => {
    for (const method of [1, true, "nope", { call() { return {}; } }]) {
      const value = { [Symbol.iterator]: method };
      const log = [];
      assert.throws(() => open(value, log), typeError("Value is not iterable"));
      if (mode === "sim") assert.deepEqual(log, [{ op: "get", key: "@@iterator" }]);
    }
  });
});

test("call receiver is the iterable", () => {
  eachEngine(({ mode, open }) => {
    let receiver;
    let nextCalls = 0;
    const iterator = {
      next() {
        nextCalls += 1;
        return { done: true };
      },
    };
    const value = {
      [Symbol.iterator]() {
        receiver = this;
        return iterator;
      },
    };
    const log = [];
    const record = open(value, log);
    assert.equal(receiver, value);
    assert.equal(nextCalls, 0);
    assert.equal(Object.getPrototypeOf(record), null);
    assert.equal(record.kind, 3);
    assert.equal(record.iterator, iterator);
    assert.equal(record.next, iterator.next);
    assert.equal(record.object, undefined);
    assert.equal(record.index, 0);
    assert.deepEqual(Object.keys(record).sort(), ["index", "iterator", "kind", "next", "object"]);
    if (mode === "sim") {
      assert.deepEqual(log, [
        { op: "get", key: "@@iterator" },
        { op: "call", key: "@@iterator", receiver: value },
        { op: "get", key: "next" },
      ]);
    }
  });
});

test("non-object iterator TypeError", () => {
  eachEngine(({ mode, open, step }) => {
    for (const produced of [null, undefined, 0, false, "x", Symbol("s"), 1n]) {
      const value = {
        [Symbol.iterator]() { return produced; },
      };
      const log = [];
      assert.throws(() => open(value, log), typeError("Iterator is not an object"));
      if (mode === "sim") {
        assert.deepEqual(log, [
          { op: "get", key: "@@iterator" },
          { op: "call", key: "@@iterator", receiver: value },
        ]);
      }
    }
    function iterator() {}
    iterator.next = function next() { return { done: true }; };
    const record = open(iterableOf(iterator), []);
    assert.equal(record.iterator, iterator);
    assert.equal(record.kind, 3);
    assert.equal(step(record, []), record);
  });
});

test("next getter runs at open not step", () => {
  eachEngine(({ mode, open, step }) => {
    let gets = 0;
    let calls = 0;
    const iterator = {};
    const next = function next() {
      calls += 1;
      return { done: false, value: 5 };
    };
    Object.defineProperty(iterator, "next", {
      configurable: true,
      get() {
        gets += 1;
        return next;
      },
    });
    const value = iterableOf(iterator);
    const openLog = [];
    const record = open(value, openLog);
    assert.equal(gets, 1);
    assert.equal(calls, 0);
    assert.equal(record.next, next);
    const stepLog = [];
    assert.equal(step(record, stepLog), 5);
    assert.equal(gets, 1);
    assert.equal(calls, 1);
    if (mode === "sim") {
      assert.deepEqual(openLog, [
        { op: "get", key: "@@iterator" },
        { op: "call", key: "@@iterator", receiver: value },
        { op: "get", key: "next" },
      ]);
      assert.deepEqual(stepLog, [
        { op: "call", key: "next", receiver: iterator },
        { op: "get", key: "done" },
        { op: "get", key: "value" },
      ]);
    }
  });
});

test("next snapshot ignores later writes", () => {
  eachEngine(({ open, step }) => {
    const seen = [];
    const first = function first() {
      seen.push("first");
      return { done: false, value: 1 };
    };
    const iterator = { next: first };
    const record = open(iterableOf(iterator), []);
    iterator.next = function second() {
      seen.push("second");
      return { done: false, value: 2 };
    };
    assert.equal(step(record, []), 1);
    assert.deepEqual(seen, ["first"]);
    assert.equal(record.next, first);
    assert.equal(record.iterator, iterator);
  });
});

test("done getter before value getter", () => {
  eachEngine(({ mode, open, step }) => {
    const order = [];
    const result = {};
    Object.defineProperty(result, "done", {
      configurable: true,
      get() {
        order.push("done");
        return false;
      },
    });
    Object.defineProperty(result, "value", {
      configurable: true,
      get() {
        order.push("value");
        return 9;
      },
    });
    const iterator = { next() { order.push("next"); return result; } };
    const record = open(iterableOf(iterator), []);
    order.length = 0;
    const log = [];
    assert.equal(step(record, log), 9);
    assert.deepEqual(order, ["next", "done", "value"]);
    assert.equal(record.iterator, iterator);
    if (mode === "sim") {
      assert.deepEqual(log, [
        { op: "call", key: "next", receiver: iterator },
        { op: "get", key: "done" },
        { op: "get", key: "value" },
      ]);
    }

    const marker = { reason: "done-getter" };
    let valueReads = 0;
    const bad = {};
    Object.defineProperty(bad, "done", {
      configurable: true,
      get() { throw marker; },
    });
    Object.defineProperty(bad, "value", {
      configurable: true,
      get() {
        valueReads += 1;
        return 1;
      },
    });
    const live = { next() { return bad; } };
    const liveRecord = open(iterableOf(live), []);
    assert.throws(() => step(liveRecord, []), error => error === marker);
    assert.equal(valueReads, 0);
    assert.equal(liveRecord.iterator, live);
  });
});

test("done true does not read value", () => {
  eachEngine(({ mode, open, step }) => {
    let valueReads = 0;
    const result = {};
    Object.defineProperty(result, "done", {
      configurable: true,
      get() { return true; },
    });
    Object.defineProperty(result, "value", {
      configurable: true,
      get() {
        valueReads += 1;
        return 123;
      },
    });
    const iterator = { next() { return result; } };
    const record = open(iterableOf(iterator), []);
    const captured = record.next;
    const log = [];
    const out = step(record, log);
    assert.equal(out, record);
    assert.equal(valueReads, 0);
    assert.equal(record.iterator, undefined);
    assert.equal(record.next, captured);
    if (mode === "sim") {
      assert.deepEqual(log, [
        { op: "call", key: "next", receiver: iterator },
        { op: "get", key: "done" },
      ]);
    }
  });
});

test("value getter throw leaves iterator in place", () => {
  eachEngine(({ open, step }) => {
    const marker = { reason: "value-getter" };
    const result = {};
    Object.defineProperty(result, "done", {
      configurable: true,
      get() { return false; },
    });
    Object.defineProperty(result, "value", {
      configurable: true,
      get() { throw marker; },
    });
    const iterator = { next() { return result; } };
    const record = open(iterableOf(iterator), []);
    assert.throws(() => step(record, []), error => error === marker);
    assert.equal(record.iterator, iterator);
    assert.equal(typeof record.next, "function");

    const callMarker = { reason: "next-call" };
    const throwing = {
      next() { throw callMarker; },
    };
    const again = open(iterableOf(throwing), []);
    assert.throws(() => step(again, []), error => error === callMarker);
    assert.equal(again.iterator, throwing);
  });
});

test("step returns record sentinel when done", () => {
  eachEngine(({ mode, open, step }) => {
    const produced = { done: true, value: "hidden" };
    let calls = 0;
    const iterator = {
      next() {
        calls += 1;
        return produced;
      },
    };
    const record = open(iterableOf(iterator), []);
    const log = [];
    const out = step(record, log);
    assert.equal(out, record);
    assert.notEqual(out, produced);
    assert.equal(out.done, undefined);
    assert.equal(record.iterator, undefined);
    assert.equal(calls, 1);
    if (mode === "sim") {
      assert.deepEqual(log, [
        { op: "call", key: "next", receiver: iterator },
        { op: "get", key: "done" },
      ]);
    }
    const againLog = [];
    record.next = function replaced() {
      calls += 1;
      return { done: false, value: "no" };
    };
    assert.equal(step(record, againLog), record);
    assert.equal(calls, 1);
    if (mode === "sim") assert.deepEqual(againLog, []);

    const yielding = {
      next() { return { done: false, value: undefined }; },
    };
    const live = open(iterableOf(yielding), []);
    const value = step(live, []);
    assert.equal(value, undefined);
    assert.notEqual(value, live);
    assert.equal(live.iterator, yielding);
  });
});

test("missing @@iterator is TypeError not unsupported", () => {
  const samples = [0, NaN, false, true, 0n, 2n, Symbol("s"), Symbol.iterator, {}, Object.create(null), function bare() {}];
  eachEngine(({ mode, open }) => {
    for (const value of samples) {
      const log = [];
      let returned = false;
      assert.throws(() => {
        const record = open(value, log);
        returned = record;
      }, typeError("Value is not iterable"));
      assert.equal(returned, false);
      if (mode === "sim") assert.deepEqual(log, [{ op: "get", key: "@@iterator" }]);
    }
  });
  eachEngine(({ open, step }) => {
    const text = open("a\uD83D\uDE00b");
    assert.equal(text.kind, 3);
    assert.equal(text.object, undefined);
    assert.equal(step(text), "a");
    assert.equal(step(text), "\uD83D\uDE00");
    assert.equal(step(text), "b");
    assert.equal(step(text), text);
    const array = open(["p", "q"]);
    assert.equal(array.kind, 3);
    assert.equal(step(array), "p");
    assert.equal(step(array), "q");
    assert.equal(step(array), array);
  });
});

test("non-object iterator result TypeError leaves iterator", () => {
  eachEngine(({ mode, open, step }) => {
    for (const produced of [null, undefined, 1, false, "z", Symbol("r"), 3n]) {
      const iterator = { next() { return produced; } };
      const record = open(iterableOf(iterator), []);
      const log = [];
      assert.throws(() => step(record, log), typeError("Iterator result is not an object"));
      assert.equal(record.iterator, iterator);
      if (mode === "sim") assert.deepEqual(log, [{ op: "call", key: "next", receiver: iterator }]);
    }
    function result() {}
    result.done = false;
    result.value = 7;
    const iterator = { next() { return result; } };
    const record = open(iterableOf(iterator), []);
    assert.equal(step(record, []), 7);
    assert.equal(record.iterator, iterator);
  });
});

test("non-callable next throws at step and leaves iterator", () => {
  eachEngine(({ mode, open, step }) => {
    let gets = 0;
    const iterator = {};
    Object.defineProperty(iterator, "next", {
      configurable: true,
      get() {
        gets += 1;
        return 1;
      },
    });
    const record = open(iterableOf(iterator), []);
    assert.equal(gets, 1);
    assert.equal(record.next, 1);
    assert.equal(record.iterator, iterator);
    const log = [];
    assert.throws(() => step(record, log), typeError("Iterator next is not a function"));
    assert.equal(gets, 1);
    assert.equal(record.iterator, iterator);
    if (mode === "sim") assert.deepEqual(log, []);
  });
});

test("kind 1 and kind 2 records still step", () => {
  eachEngine(({ step }) => {
    const array = { 0: "a", 1: "b" };
    let reads = 0;
    Object.defineProperty(array, "length", {
      configurable: true,
      get() {
        reads += 1;
        return 2;
      },
    });
    const kind1 = Object.create(null);
    kind1.kind = 1;
    kind1.index = 0;
    kind1.object = array;
    assert.equal(step(kind1, []), "a");
    assert.equal(kind1.index, 1);
    assert.equal(kind1.object, array);
    assert.equal(reads, 1);
    assert.equal(step(kind1, []), "b");
    assert.equal(step(kind1, []), kind1);
    assert.equal(kind1.object, undefined);
    assert.equal(reads, 3);

    const lengthError = { reason: "length" };
    const broken = {};
    Object.defineProperty(broken, "length", {
      configurable: true,
      get() { throw lengthError; },
    });
    broken[0] = 1;
    const abrupt = Object.create(null);
    abrupt.kind = 1;
    abrupt.index = 0;
    abrupt.object = broken;
    assert.throws(() => step(abrupt, []), error => error === lengthError);
    assert.equal(abrupt.object, undefined);
    assert.equal(step(abrupt, []), abrupt);

    const kind2 = Object.create(null);
    kind2.kind = 2;
    kind2.index = 0;
    kind2.object = "a\uD83D\uDE00\uDE00\uD83D";
    assert.equal(step(kind2, []), "a");
    assert.equal(step(kind2, []), "\uD83D\uDE00");
    assert.equal(step(kind2, []), "\uDE00");
    assert.equal(step(kind2, []), "\uD83D");
    assert.equal(step(kind2, []), kind2);
    assert.equal(kind2.object, undefined);

    const empty = Object.create(null);
    empty.kind = 2;
    empty.index = 0;
    empty.object = "";
    assert.equal(step(empty, []), empty);
    assert.equal(empty.object, undefined);
  });
});

test("guest sources are root functions without unsupported or a fast path", () => {
  const guest = compileGuestIterators();
  assert.equal(guest.open.name, "iteratorOpenBootstrap");
  assert.equal(guest.step.name, "iteratorStepBootstrap");
  for (const source of [iteratorOpenBootstrapSource, iteratorStepBootstrapSource]) {
    assert.equal(source.includes("=>"), false);
    assert.equal(source.includes("__lanesUnsupported"), false);
    assert.equal(source.includes("__lanesIterationKind"), false);
    const declarations = source.match(/function\s+\w+/g);
    assert.deepEqual(declarations, [declarations[0]]);
    assert.equal(declarations.length, 1);
  }
  assert.match(iteratorOpenBootstrapSource, /^function iteratorOpenBootstrap\(value\)/);
  assert.match(iteratorStepBootstrapSource, /^function iteratorStepBootstrap\(record\)/);
  assert.match(iteratorOpenBootstrapSource, /TypeError\("Value is not iterable"\)/);
  assert.match(iteratorOpenBootstrapSource, /TypeError\("Iterator is not an object"\)/);
  assert.match(iteratorOpenBootstrapSource, /__lanesCall\(method, value\)/);
  assert.match(iteratorOpenBootstrapSource, /__lanesDescriptor\(\)/);
  assert.match(iteratorOpenBootstrapSource, /record\.kind = 3/);
  assert.match(iteratorStepBootstrapSource, /TypeError\("Iterator next is not a function"\)/);
  assert.match(iteratorStepBootstrapSource, /TypeError\("Iterator result is not an object"\)/);
  assert.match(iteratorStepBootstrapSource, /__lanesNumber\(length\)/);
  assert.match(iteratorStepBootstrapSource, /__lanesCharCodeAt\(object, index\)/);
  assert.match(iteratorStepBootstrapSource, /__lanesSlice\(object, index, end\)/);
  assert.match(iteratorStepBootstrapSource, /9007199254740991/);
  const openOrder = [
    "value === null",
    "Symbol.iterator",
    "__lanesCall(method, value)",
    "Iterator is not an object",
    "iterator.next",
    "record.kind = 3",
  ];
  let cursor = -1;
  for (const part of openOrder) {
    const at = iteratorOpenBootstrapSource.indexOf(part);
    assert.ok(at > cursor, part);
    cursor = at;
  }
  const stepOrder = [
    "record.kind === 3",
    "record.iterator === undefined",
    "record.next",
    "Iterator next is not a function",
    "__lanesCall(next, iterator)",
    "Iterator result is not an object",
    "result.done",
    "record.iterator = undefined",
    "result.value",
    "__lanesCharCodeAt(object, index)",
  ];
  cursor = -1;
  for (const part of stepOrder) {
    const at = iteratorStepBootstrapSource.indexOf(part);
    assert.ok(at > cursor, part);
    cursor = at;
  }
});
