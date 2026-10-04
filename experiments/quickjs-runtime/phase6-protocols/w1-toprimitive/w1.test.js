import assert from "node:assert/strict";
import test from "node:test";
import { continuations, hintContract, primitiveSource } from "./index.js";
import { simulateToPrimitive } from "./simulate.js";

const TYPE_ERROR = "Cannot convert object to primitive value";

const primitiveBootstrap = new Function(
  "__lanesCall",
  `${primitiveSource}\nreturn primitiveBootstrap;`,
)((fn, thisArg, ...args) => Reflect.apply(fn, thisArg, args));

function guestToPrimitive(value, preferred) {
  if (preferred === "string") return primitiveBootstrap(value, true);
  if (preferred === "number") return primitiveBootstrap(value, false);
  if (preferred === "default") return primitiveBootstrap(value);
  throw new Error(`unexpected preferred ${preferred}`);
}

function forBoth(preferred, make, run) {
  for (const kind of ["simulate", "guest"]) {
    const box = make();
    const result = kind === "simulate"
      ? simulateToPrimitive(box.value, preferred)
      : guestToPrimitive(box.value, preferred);
    run(result, box, kind);
  }
}

function forBothThrow(preferred, make, run) {
  for (const kind of ["simulate", "guest"]) {
    const box = make();
    let caught;
    try {
      if (kind === "simulate") simulateToPrimitive(box.value, preferred);
      else guestToPrimitive(box.value, preferred);
    } catch (error) {
      caught = error;
    }
    assert.ok(caught, `${kind} should throw`);
    run(caught, box, kind);
  }
}

test("continuations 72-75 are reserved and the guest source calls the hook", () => {
  assert.deepEqual(continuations, [72, 73, 74, 75]);
  assert.deepEqual(hintContract.omitted, { hint: "default", ordinaryOrder: ["valueOf", "toString"] });
  assert.deepEqual(hintContract.undefined, hintContract.omitted);
  assert.deepEqual(hintContract.false, { hint: "number", ordinaryOrder: ["valueOf", "toString"] });
  assert.deepEqual(hintContract.true, { hint: "string", ordinaryOrder: ["toString", "valueOf"] });
  assert.equal(primitiveSource.startsWith("function primitiveBootstrap(value, stringHint)"), true);
  assert.equal(primitiveSource.includes("__lanesUnsupported"), false);
  assert.equal(primitiveSource.includes("try"), false);
  assert.equal(primitiveSource.match(/Symbol/g).length, 1);
  assert.match(primitiveSource, /value\[Symbol\.toPrimitive\]/);
  assert.match(primitiveSource, /__lanesCall\(exotic, value, hint\)/);
  assert.equal(primitiveSource.match(/__lanesCall\(method, value\)/g).length, 2);
  const nested = primitiveSource.match(/function object\(v\) \{[^}]*\}/)[0];
  assert.equal(/Symbol|__lanes/.test(nested), false);
});

test("default vs number vs string hint strings", () => {
  const expected = { default: "default", number: "number", string: "string" };
  for (const preferred of ["default", "number", "string"]) {
    forBoth(preferred, () => {
      const seen = [];
      const value = {
        [Symbol.toPrimitive](hint) {
          seen.push({ hint, receiver: this });
          return hint;
        },
      };
      return { value, seen };
    }, (result, box) => {
      assert.equal(result, expected[preferred]);
      assert.equal(box.seen.length, 1);
      assert.equal(box.seen[0].hint, expected[preferred]);
      assert.equal(box.seen[0].receiver, box.value);
    });
  }
  const omitted = [];
  assert.equal(primitiveBootstrap({
    [Symbol.toPrimitive](hint) { omitted.push(hint); return 1; },
  }), 1);
  assert.equal(primitiveBootstrap({
    [Symbol.toPrimitive](hint) { omitted.push(hint); return 2; },
  }, undefined), 2);
  assert.equal(primitiveBootstrap({
    [Symbol.toPrimitive](hint) { omitted.push(hint); return 3; },
  }, false), 3);
  assert.equal(primitiveBootstrap({
    [Symbol.toPrimitive](hint) { omitted.push(hint); return 4; },
  }, true), 4);
  assert.deepEqual(omitted, ["default", "default", "number", "string"]);
});

test("call order is exotic getter, exotic call, then no ordinary methods", () => {
  for (const preferred of ["default", "number", "string"]) {
    forBoth(preferred, () => {
      const order = [];
      const value = {};
      Object.defineProperty(value, Symbol.toPrimitive, {
        configurable: true,
        get() {
          order.push("getter");
          return function exotic(hint) {
            order.push(`exotic:${hint}`);
            return 4;
          };
        },
      });
      Object.defineProperty(value, "valueOf", {
        configurable: true,
        get() { order.push("valueOf"); return () => 1; },
      });
      Object.defineProperty(value, "toString", {
        configurable: true,
        get() { order.push("toString"); return () => "x"; },
      });
      return { value, order };
    }, (result, box) => {
      assert.equal(result, 4);
      assert.deepEqual(box.order, ["getter", `exotic:${preferred === "string" ? "string" : preferred === "number" ? "number" : "default"}`]);
    });
  }

  const proto = {};
  Object.defineProperty(proto, Symbol.toPrimitive, {
    configurable: true,
    get() {
      return function inherited() { return "inherited"; };
    },
  });
  const child = Object.create(proto);
  child.valueOf = () => { throw new Error("ordinary"); };
  assert.equal(simulateToPrimitive(child, "number"), "inherited");
  assert.equal(guestToPrimitive(Object.create(proto), "string"), "inherited");
});

test("non-callable exotic does not call valueOf", () => {
  for (const exotic of [true, 0, "no", Symbol("no"), {}]) {
    forBothThrow("string", () => {
      const order = [];
      const value = {};
      Object.defineProperty(value, Symbol.toPrimitive, { configurable: true, value: exotic });
      Object.defineProperty(value, "valueOf", {
        configurable: true,
        get() { order.push("valueOf"); return () => 1; },
      });
      Object.defineProperty(value, "toString", {
        configurable: true,
        get() { order.push("toString"); return () => "s"; },
      });
      return { value, order };
    }, (error, box) => {
      assert.equal(error instanceof TypeError, true);
      assert.equal(error.message, TYPE_ERROR);
      assert.deepEqual(box.order, []);
    });
  }
});

test("exotic returning an object throws", () => {
  const samples = [{ marker: "object" }, function objectResult() {}, [1]];
  for (const sample of samples) {
    forBothThrow("default", () => {
      const order = [];
      const value = {
        [Symbol.toPrimitive]() { order.push("exotic"); return sample; },
        valueOf() { order.push("valueOf"); return 1; },
        toString() { order.push("toString"); return "s"; },
      };
      return { value, order };
    }, (error, box) => {
      assert.equal(error instanceof TypeError, true);
      assert.equal(error.message, TYPE_ERROR);
      assert.notEqual(error, sample);
      assert.deepEqual(box.order, ["exotic"]);
    });
  }
});

test("exotic primitive results are returned", () => {
  const symbol = Symbol("result");
  const samples = [null, undefined, false, true, 0, -0, NaN, "", "s", symbol, 9n];
  for (const sample of samples) {
    forBoth("number", () => ({
      value: {
        [Symbol.toPrimitive]() { return sample; },
        valueOf() { throw new Error("ordinary"); },
      },
    }), (result) => {
      assert.equal(Object.is(result, sample), true);
    });
  }
});

test("exotic throw identity", () => {
  forBothThrow("number", () => {
    const error = new Error("hook-call");
    const order = [];
    const value = {
      [Symbol.toPrimitive]() { throw error; },
      valueOf() { order.push("valueOf"); return 1; },
    };
    return { value, order, error };
  }, (caught, box) => {
    assert.equal(caught, box.error);
    assert.deepEqual(box.order, []);
  });

  forBothThrow("string", () => {
    const error = new TypeError("hook-getter");
    const order = [];
    const value = {};
    Object.defineProperty(value, Symbol.toPrimitive, {
      configurable: true,
      get() { throw error; },
    });
    Object.defineProperty(value, "valueOf", {
      configurable: true,
      get() { order.push("valueOf"); return () => 1; },
    });
    return { value, order, error };
  }, (caught, box) => {
    assert.equal(caught, box.error);
    assert.deepEqual(box.order, []);
  });

  forBothThrow("default", () => {
    const error = Object.create(null);
    error.marker = "raw";
    const value = { valueOf() { throw error; }, toString() { return "later"; } };
    return { value, error };
  }, (caught, box) => {
    assert.equal(caught, box.error);
  });
});

test("ordinary valueOf then toString", () => {
  for (const preferred of ["default", "number"]) {
    forBoth(preferred, () => {
      const order = [];
      const value = {
        valueOf() { order.push("valueOf"); return {}; },
        toString() { order.push("toString"); return "from-string"; },
      };
      return { value, order };
    }, (result, box) => {
      assert.equal(result, "from-string");
      assert.deepEqual(box.order, ["valueOf", "toString"]);
    });
  }
  forBoth("string", () => {
    const order = [];
    const value = {
      toString() { order.push("toString"); return {}; },
      valueOf() { order.push("valueOf"); return 6; },
    };
    return { value, order };
  }, (result, box) => {
    assert.equal(result, 6);
    assert.deepEqual(box.order, ["toString", "valueOf"]);
  });
});

test("ordinary skip when valueOf returns object", () => {
  forBoth("default", () => {
    const objectResult = { skipped: true };
    const order = [];
    const value = {
      valueOf() { order.push(objectResult); return objectResult; },
      toString() { order.push("toString"); return 5; },
    };
    return { value, order, objectResult };
  }, (result, box) => {
    assert.equal(result, 5);
    assert.notEqual(result, box.objectResult);
    assert.deepEqual(box.order, [box.objectResult, "toString"]);
  });

  forBoth("number", () => {
    const order = [];
    const value = {
      valueOf() { order.push("valueOf"); return function skipped() {}; },
      toString() { order.push("toString"); return "after-function"; },
    };
    return { value, order };
  }, (result, box) => {
    assert.equal(result, "after-function");
    assert.deepEqual(box.order, ["valueOf", "toString"]);
  });

  forBoth("default", () => {
    const order = [];
    const value = {};
    Object.defineProperty(value, "valueOf", {
      configurable: true,
      get() { order.push("valueOf"); return () => 11; },
    });
    Object.defineProperty(value, "toString", {
      configurable: true,
      get() { order.push("toString"); return () => "unused"; },
    });
    return { value, order };
  }, (result, box) => {
    assert.equal(result, 11);
    assert.deepEqual(box.order, ["valueOf"]);
  });

  forBothThrow("number", () => ({
    value: { valueOf() { return {}; }, toString() { return function stillObject() {}; } },
  }), (error) => {
    assert.equal(error instanceof TypeError, true);
    assert.equal(error.message, TYPE_ERROR);
  });
});

test("symbol primitive returned unchanged", () => {
  const symbol = Symbol("kept");
  for (const preferred of ["default", "number", "string"]) {
    assert.equal(simulateToPrimitive(symbol, preferred), symbol);
    assert.equal(guestToPrimitive(symbol, preferred), symbol);
    assert.equal(simulateToPrimitive(Symbol.iterator, preferred), Symbol.iterator);
    assert.equal(guestToPrimitive(Symbol.iterator, preferred), Symbol.iterator);
  }
  const big = 12n;
  assert.equal(simulateToPrimitive(big, "default"), big);
  assert.equal(guestToPrimitive(big, "number"), big);
  assert.equal(simulateToPrimitive(null, "string"), null);
  assert.equal(guestToPrimitive(undefined, "default"), undefined);
  assert.equal(guestToPrimitive(false, "string"), false);
  assert.equal(simulateToPrimitive("a", "number"), "a");
  assert.equal(Object.is(guestToPrimitive(-0, "default"), -0), true);
  assert.equal(Object.is(simulateToPrimitive(NaN, "string"), NaN), true);
});

test("missing hook ordinary success", () => {
  forBoth("default", () => ({
    value: { valueOf() { return 42; }, toString() { throw new Error("toString"); } },
  }), (result) => {
    assert.equal(result, 42);
  });
  forBoth("number", () => ({
    value: { [Symbol.toPrimitive]: undefined, valueOf() { return 7; }, toString() { throw new Error("toString"); } },
  }), (result) => {
    assert.equal(result, 7);
  });
  forBoth("string", () => ({
    value: { [Symbol.toPrimitive]: null, toString() { return "ok"; }, valueOf() { throw new Error("valueOf"); } },
  }), (result) => {
    assert.equal(result, "ok");
  });
  forBoth("default", () => {
    const value = { valueOf() { return 8; } };
    Object.defineProperty(value, Symbol.toPrimitive, {
      configurable: true,
      get() { return undefined; },
    });
    return { value };
  }, (result) => {
    assert.equal(result, 8);
  });
  assert.equal(simulateToPrimitive({}, "number"), "[object Object]");
  assert.equal(guestToPrimitive({}, "default"), "[object Object]");
  forBothThrow("string", () => ({ value: Object.create(null) }), (error) => {
    assert.equal(error instanceof TypeError, true);
    assert.equal(error.message, TYPE_ERROR);
  });
});
