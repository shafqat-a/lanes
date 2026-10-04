// Guest algorithms for relational, equality, and addition. ToPrimitive
// (ES2025 7.1.1) is the phase-6 helper: @@toPrimitive lookup, hint selection,
// abrupt identity, and OrdinaryToPrimitive. Date stays outside this helper.
// ES2025 7.2.12, 7.2.13 and 13.10.1.
export { primitiveSource } from './phase6-protocols/w1-toprimitive/index.js';

export const relationalSource = `function relationalBootstrap(left, right, operation) {
  let a = __lanesPrimitive(left);
  let b = __lanesPrimitive(right);
  if (typeof a !== "string" || typeof b !== "string") {
    a = __lanesNumber(a);
    b = __lanesNumber(b);
  }
  if (operation === 0) return a < b;
  if (operation === 1) return a <= b;
  if (operation === 2) return a > b;
  return a >= b;
}`;

export const equalitySource = `function equalityBootstrap(left, right, negate) {
  function object(v) { return v !== null && (typeof v === "object" || typeof v === "function"); }
  let a = left, b = right, equal = false;
  while (true) {
    if (typeof a === typeof b) { equal = a === b; break; }
    if (a === null || a === undefined || b === null || b === undefined) {
      equal = (a === null || a === undefined) && (b === null || b === undefined);
      break;
    }
    if (typeof a === "boolean") { a = __lanesNumber(a); continue; }
    if (typeof b === "boolean") { b = __lanesNumber(b); continue; }
    if (typeof a === "number" && typeof b === "string") { b = __lanesNumber(b); continue; }
    if (typeof a === "string" && typeof b === "number") { a = __lanesNumber(a); continue; }
    if (object(a) && !object(b)) { a = __lanesPrimitive(a); continue; }
    if (!object(a) && object(b)) { b = __lanesPrimitive(b); continue; }
    break;
  }
  return negate ? !equal : equal;
}`;

// String conversion currently accepts the native primitiveText subset.
// Unsupported Number formatting fails explicitly after primitive conversion.
export const additionSource = `function additionBootstrap(left, right) {
  const a = __lanesPrimitive(left);
  const b = __lanesPrimitive(right);
  if (typeof a === "string" || typeof b === "string") {
    return __lanesText(a) + __lanesText(b);
  }
  return __lanesNumber(a) + __lanesNumber(b);
}`;
