// Host-only mirror of the guest ToPrimitive rules. Not used in production.
// preferred is "default", "number", or "string".

const TYPE_ERROR = "Cannot convert object to primitive value";

function isObject(value) {
  return value !== null && (typeof value === "object" || typeof value === "function");
}

function plan(preferred) {
  if (preferred === "string") return { hint: "string", names: ["toString", "valueOf"] };
  if (preferred === "number") return { hint: "number", names: ["valueOf", "toString"] };
  if (preferred === "default") return { hint: "default", names: ["valueOf", "toString"] };
  throw new TypeError("Invalid ToPrimitive preferred type");
}

export function simulateToPrimitive(value, preferred) {
  if (!isObject(value)) return value;
  const { hint, names } = plan(preferred);
  const exotic = value[Symbol.toPrimitive];
  if (exotic !== undefined && exotic !== null) {
    if (typeof exotic !== "function") throw new TypeError(TYPE_ERROR);
    const result = Reflect.apply(exotic, value, [hint]);
    if (isObject(result)) throw new TypeError(TYPE_ERROR);
    return result;
  }
  for (const name of names) {
    const method = value[name];
    if (typeof method === "function") {
      const result = Reflect.apply(method, value, []);
      if (!isObject(result)) return result;
    }
  }
  throw new TypeError(TYPE_ERROR);
}
