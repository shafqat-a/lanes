// ES2025 ToPrimitive / OrdinaryToPrimitive replacement for comparison-source.js
// primitiveSource. Symbol and __lanes* appear only in the root function.
// Nested helpers must not reference them. Gets and __lanesCall (builtin 113,
// __lanesCall(fn, thisArg, ...args)) suspend at instruction boundaries.

export const continuations = Object.freeze([72, 73, 74, 75]);

// Second argument stays the existing boolean. Omitted and undefined are not false.
export const hintContract = Object.freeze({
  omitted: Object.freeze({ hint: "default", ordinaryOrder: Object.freeze(["valueOf", "toString"]) }),
  undefined: Object.freeze({ hint: "default", ordinaryOrder: Object.freeze(["valueOf", "toString"]) }),
  false: Object.freeze({ hint: "number", ordinaryOrder: Object.freeze(["valueOf", "toString"]) }),
  true: Object.freeze({ hint: "string", ordinaryOrder: Object.freeze(["toString", "valueOf"]) }),
});

export const primitiveSource = `function primitiveBootstrap(value, stringHint) {
  function object(v) { return v !== null && (typeof v === "object" || typeof v === "function"); }
  if (!object(value)) return value;
  const exotic = value[Symbol.toPrimitive];
  if (exotic !== undefined && exotic !== null) {
    if (typeof exotic !== "function") throw new TypeError("Cannot convert object to primitive value");
    const hint = stringHint === true ? "string" : stringHint === false ? "number" : "default";
    const result = __lanesCall(exotic, value, hint);
    if (object(result)) throw new TypeError("Cannot convert object to primitive value");
    return result;
  }
  const stringOrder = stringHint === true;
  let method = stringOrder ? value.toString : value.valueOf;
  if (typeof method === "function") {
    const result = __lanesCall(method, value);
    if (!object(result)) return result;
  }
  method = stringOrder ? value.valueOf : value.toString;
  if (typeof method === "function") {
    const result = __lanesCall(method, value);
    if (!object(result)) return result;
  }
  throw new TypeError("Cannot convert object to primitive value");
}`;
