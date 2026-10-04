// Real programs. Each is one named function so program.js entrySource accepts it.
// expect is the value f() returns on a host that implements the iterator protocol.
// None of these are unsupported completions.

export const fixtures = Object.freeze([
  Object.freeze({
    id: "array-spread-elements",
    source: `function f(x) {
  const a = [9, 8];
  const b = [...a];
  const d = Object.getOwnPropertyDescriptor(b, "0");
  return (a !== b) + ":" + b.join(",") + ":" + d.writable + ":" + d.enumerable + ":" + d.configurable + ":" + d.value;
}`,
    expect: "true:9,8:true:true:true:9",
  }),
  Object.freeze({
    id: "string-spread-code-points",
    source: `function f(x) {
  const b = [..."a\\uD83D\\uDE00b"];
  return b.length + ":" + b[0] + ":" + b[1].length + ":" + b[1].charCodeAt(0) + ":" + b[1].charCodeAt(1) + ":" + b[2];
}`,
    expect: "3:a:2:55357:56832:b",
  }),
  Object.freeze({
    id: "custom-iterator-spread-get-log",
    source: `function f(x) {
  const log = [];
  const iterable = {};
  const iterator = {};
  let i = 0;
  Object.defineProperty(iterable, Symbol.iterator, {
    configurable: true,
    enumerable: false,
    get: function () {
      log.push("get-@@iterator");
      return function () {
        log.push("call-@@iterator");
        return iterator;
      };
    }
  });
  Object.defineProperty(iterator, "next", {
    configurable: true,
    get: function () {
      log.push("get-next");
      return function () {
        log.push("call-next");
        const n = i++;
        if (n >= 2) {
          return {
            get done() { log.push("get-done-end"); return true; },
            get value() { log.push("get-value-end"); return "no"; }
          };
        }
        return {
          get done() { log.push("get-done-" + n); return false; },
          get value() { log.push("get-value-" + n); return n; }
        };
      };
    }
  });
  Object.defineProperty(iterator, "return", {
    configurable: true,
    get: function () {
      log.push("get-return");
      return function () {
        log.push("call-return");
        return { done: true };
      };
    }
  });
  const out = [...iterable];
  log.push("out:" + out.join(","));
  return log.join("|");
}`,
    expect: "get-@@iterator|call-@@iterator|get-next|call-next|get-done-0|get-value-0|call-next|get-done-1|get-value-1|call-next|get-done-end|out:0,1",
  }),
  Object.freeze({
    id: "overridden-array-iterator",
    source: `function f(x) {
  const key = Symbol.iterator;
  const saved = Array.prototype[key];
  let calls = 0;
  Array.prototype[key] = function () {
    calls++;
    const inner = saved.call(this);
    return {
      next: function () {
        const r = inner.next();
        if (r.done) return r;
        return { done: false, value: r.value + 10 };
      }
    };
  };
  let result;
  try {
    const a = [...[1, 2, 3]];
    result = calls + ":" + a.join(",");
  } finally {
    Array.prototype[key] = saved;
  }
  return result;
}`,
    expect: "1:11,12,13",
  }),
  Object.freeze({
    id: "for-of-break-calls-return",
    source: `function f(x) {
  let code = "open";
  const iterable = {
    [Symbol.iterator]: function () {
      let n = 0;
      return {
        next: function () {
          n += 1;
          return { done: false, value: n };
        },
        return: function () {
          code = "return";
          return { done: true };
        }
      };
    }
  };
  for (const v of iterable) {
    if (v === 1) break;
  }
  return code;
}`,
    expect: "return",
  }),
  Object.freeze({
    id: "destructuring-stops-early-calls-return",
    source: `function f(x) {
  let code = "open";
  const iterable = {
    [Symbol.iterator]: function () {
      let n = 0;
      return {
        next: function () {
          n += 1;
          return { done: false, value: n * 3 };
        },
        return: function () {
          code = "return";
          return { done: true };
        }
      };
    }
  };
  const [a, b] = iterable;
  return a + "," + b + ":" + code;
}`,
    expect: "3,6:return",
  }),
  Object.freeze({
    id: "destructuring-exhaustion-skips-return",
    source: `function f(x) {
  let code = "open";
  const iterable = {
    [Symbol.iterator]: function () {
      const values = [7, 8];
      let n = 0;
      return {
        next: function () {
          if (n >= values.length) return { done: true, value: 99 };
          return { done: false, value: values[n++] };
        },
        return: function () {
          code = "return";
          return { done: true };
        }
      };
    }
  };
  const [...r] = iterable;
  return r.join(",") + ":" + code;
}`,
    expect: "7,8:open",
  }),
  Object.freeze({
    id: "rest-parameter-custom-iterable",
    source: `function f(x) {
  function g(...r) {
    return Array.isArray(r) + ":" + r.length + ":" + r[0] + ":" + r[1];
  }
  const iterable = {
    [Symbol.iterator]: function () {
      let n = 0;
      return {
        next: function () {
          n += 1;
          if (n > 2) return { done: true };
          return { done: false, value: n + 4 };
        }
      };
    }
  };
  return g(...iterable);
}`,
    expect: "true:2:5:6",
  }),
  Object.freeze({
    id: "null-spread-typeerror",
    source: `function f(x) {
  try {
    const a = [...null];
    return "values:" + a.length;
  } catch (e) {
    if (e instanceof TypeError) return "type";
    return "other";
  }
}`,
    expect: "type",
  }),
  Object.freeze({
    id: "symbol-spread-typeerror",
    source: `function f(x) {
  try {
    const a = [...Symbol()];
    return "values:" + a.length;
  } catch (e) {
    if (e instanceof TypeError) return "type";
    return "other";
  }
}`,
    expect: "type",
  }),
  Object.freeze({
    id: "object-spread-own-keys-not-iterator",
    source: `function f(x) {
  let calls = 0;
  const source = { p: 1, q: 2 };
  Object.defineProperty(source, Symbol.iterator, {
    configurable: true,
    value: function () {
      calls += 1;
      return { next: function () { return { done: true }; } };
    }
  });
  const out = { ...source, q: 9 };
  return calls + ":" + out.p + ":" + out.q + ":" + Object.keys(out).join(",");
}`,
    expect: "0:1:9:p,q",
  }),
]);
