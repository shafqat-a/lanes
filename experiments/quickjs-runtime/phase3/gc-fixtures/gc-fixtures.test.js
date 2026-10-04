import test from "node:test";
import assert from "node:assert/strict";
import { FIXTURES } from "./fixtures.js";
import { MAX_LIMBS, SUSPEND_AFTER, limbCount, validateFixture } from "./schema.js";
import { assertConsistent, liveRoots } from "./root-model.js";

const PRESSURE_KEYS = ["symbols", "bigints", "objects", "limbs"];

function scenario(partial) {
  return {
    standardEnv: true,
    symbolGlobal: false,
    bigintGlobal: false,
    stack: [],
    registry: [],
    objects: {},
    ...partial,
  };
}

test("every fixture validates, ids are unique, and claimed pressure is positive", () => {
  const ids = new Set();
  assert.ok(FIXTURES.length >= 16);
  for (const fixture of FIXTURES) {
    const result = validateFixture(fixture);
    assert.equal(result.ok, true, `${fixture.id}: ${result.errors.join("\n")}`);
    assert.equal(ids.has(fixture.id), false, fixture.id);
    ids.add(fixture.id);
    const claimed = /claims pressure: ([^\n]+)/.exec(fixture.notes);
    assert.ok(claimed, fixture.id);
    const kinds = claimed[1].split(",").map(part => part.trim()).filter(kind => kind && kind !== "none");
    for (const kind of kinds) assert.ok(fixture.pressure[kind] > 0, `${fixture.id} ${kind}`);
    for (const kind of PRESSURE_KEYS) {
      if (fixture.pressure[kind] > 0) assert.ok(kinds.includes(kind), `${fixture.id} unclaimed ${kind}`);
    }
    if (fixture.suspend !== null) assert.equal(fixture.suspend.after, SUSPEND_AFTER);
  }
});

test("fixture outcomes stay the normative ones", () => {
  const expected = {
    "symbol-identity-across-suspend": { type: "value", value: "distinct" },
    "symbol-for-registry-across-suspend": { type: "value", value: "same" },
    "symbol-key-keeps-cell": { type: "value", value: "kept" },
    "unreachable-symbol-collectable": { type: "value", value: 1 },
    "bigint-limb-local-across-suspend": { type: "value", value: "9007199254740993" },
    "bigint-max-limbs-resource-limit": { type: "resource-limit" },
    "bigint-add-after-suspend": { type: "value", value: "18014398509481986" },
    "ownkeys-order-after-suspend": { type: "value", value: "0,2,z,a,Sb,Sa," },
    "for-in-excludes-symbols-after-suspend": { type: "value", value: "1,b,a," },
    "object-spread-enumerable-symbols-after-suspend": { type: "value", value: "spread" },
    "prototype-swap-inherited-in": { type: "value", value: "inherited" },
    "fixed-math-json-tostring": { type: "value", value: "[object Math][object JSON]" },
    "descriptor-writable-keeps-symbol-key": { type: "value", value: "held" },
    "unique-symbols-same-description-under-pressure": { type: "value", value: "distinct" },
    "keyfor-unique-and-registered-after-suspend": { type: "value", value: "undef:k" },
    "bigint-json-stringify-unsupported": { type: "unsupported" },
  };
  assert.equal(FIXTURES.length, Object.keys(expected).length);
  for (const [id, expect] of Object.entries(expected)) {
    const fixture = FIXTURES.find(item => item.id === id);
    assert.ok(fixture, id);
    assert.equal(fixture.expect.type, expect.type);
    if ("value" in expect) assert.equal(fixture.expect.value, expect.value);
  }
  const boundary = FIXTURES.find(item => item.id === "bigint-max-limbs-resource-limit");
  const magnitude = 1n << (32n * BigInt(MAX_LIMBS) - 1n);
  assert.equal(limbCount(magnitude), MAX_LIMBS);
  assert.equal(limbCount(9007199254740993n), 2);
  assert.ok(boundary.source.includes(`${magnitude}n`));
  assert.equal(boundary.suspend, null);
  assert.equal(boundary.rootsRequired.some(role => role.startsWith("limb:")), false);
  const collectable = FIXTURES.find(item => item.id === "unreachable-symbol-collectable");
  assert.equal(collectable.rootsRequired.includes("symbol:s"), false);
  assert.ok(collectable.rootsRequired.includes("object:obj"));
  const keyed = FIXTURES.find(item => item.id === "symbol-key-keeps-cell");
  assert.ok(keyed.rootsRequired.includes("symbol:key"));
  const fixed = FIXTURES.find(item => item.id === "fixed-math-json-tostring");
  for (const role of ["fixed:Math", "fixed:Number", "fixed:JSON"]) assert.ok(fixed.rootsRequired.includes(role));
});

test("validator rejects a collected read, a missing root, and an over-limit value", () => {
  const collected = validateFixture({
    id: "bad-collected-read",
    description: "reads a symbol after its only reference was cleared",
    source: `function f(x) {
  let s = Symbol("gone");
  s = null;
  // SUSPEND
  return typeof s === "symbol" ? "alive" : "dead";
}
`,
    rootsRequired: ["fixed:JSON", "fixed:Math", "fixed:Number", "fixed:Symbol", "fixed:SymbolPrototype", "fixed:SymbolRegistry", "wellknown:iterator", "wellknown:toPrimitive", "wellknown:toStringTag"],
    suspend: { after: SUSPEND_AFTER },
    pressure: { symbols: 1, bigints: 0, objects: 0, limbs: 0 },
    expect: { type: "value", value: "alive" },
    notes: "expects the cleared symbol to still be a symbol.\nSafepoint: shader.js fn main budget loop, resumed by runtime.js start().step.\nclaims pressure: symbols\n",
  });
  assert.equal(collected.ok, false);
  assert.ok(collected.errors.some(error => error.includes("collected value") && error.includes("symbol:s")));

  const identity = FIXTURES.find(item => item.id === "symbol-identity-across-suspend");
  const omitted = validateFixture({ ...identity, rootsRequired: identity.rootsRequired.filter(role => role !== "symbol:a") });
  assert.equal(omitted.ok, false);
  assert.ok(omitted.errors.some(error => error.includes("omits a root for a value used after suspend: symbol:a")));

  const dead = FIXTURES.find(item => item.id === "unreachable-symbol-collectable");
  const extra = validateFixture({ ...dead, rootsRequired: [...dead.rootsRequired, "symbol:s"] });
  assert.equal(extra.ok, false);
  assert.ok(extra.errors.some(error => error.includes("collectable") && error.includes("symbol:s")));

  const boundary = FIXTURES.find(item => item.id === "bigint-max-limbs-resource-limit");
  const coerced = validateFixture({ ...boundary, expect: { type: "value", value: "1" } });
  assert.equal(coerced.ok, false);
  assert.ok(coerced.errors.some(error => error.includes("resource-limit") || error.includes("coerced") || error.includes("truncated")));
});

test("dropping the last reference removes the root", () => {
  const held = scenario({ stack: [{ type: "symbol", role: "symbol:a" }] });
  const dropped = scenario({ stack: [] });
  assert.equal(assertConsistent(held), true);
  assert.ok(liveRoots(held).includes("symbol:a"));
  assert.equal(liveRoots(dropped).includes("symbol:a"), false);
  assert.deepEqual(liveRoots(dropped), ["fixed:JSON", "fixed:Math", "fixed:Number"]);
});

test("registry membership keeps a symbol when the registry is live", () => {
  const kept = scenario({ symbolGlobal: true, registry: ["symbol:reg"], stack: [] });
  assert.equal(assertConsistent(kept), true);
  const roots = liveRoots(kept);
  assert.ok(roots.includes("symbol:reg"));
  assert.ok(roots.includes("fixed:SymbolRegistry"));
  const unreachableRegistry = scenario({ symbolGlobal: false, registry: ["symbol:reg"], stack: [] });
  assert.equal(liveRoots(unreachableRegistry).includes("symbol:reg"), false);
  assert.equal(liveRoots(unreachableRegistry).includes("fixed:SymbolRegistry"), false);
  const reached = scenario({ symbolGlobal: false, registry: ["symbol:reg", "symbol:other"], stack: [{ type: "symbol", role: "symbol:reg" }] });
  const reachedRoots = liveRoots(reached);
  assert.ok(reachedRoots.includes("fixed:SymbolRegistry"));
  assert.ok(reachedRoots.includes("symbol:other"));
});

test("a limb object follows the tag-18 value", () => {
  const onStack = scenario({ stack: [{ type: "bigint", role: "limb:n" }] });
  assert.ok(liveRoots(onStack).includes("limb:n"));
  assert.equal(liveRoots(scenario({ stack: [] })).includes("limb:n"), false);
  const viaProperty = scenario({
    stack: [{ type: "object", role: "object:o" }],
    objects: { "object:o": { prototype: null, keys: [], values: ["limb:n"] } },
  });
  assert.equal(assertConsistent(viaProperty), true);
  assert.ok(liveRoots(viaProperty).includes("limb:n"));
  assert.equal(liveRoots({ ...viaProperty, stack: [] }).includes("limb:n"), false);
});

test("fixed Math, Number, and JSON never disappear in a standard env", () => {
  const empty = scenario({});
  assert.equal(assertConsistent(empty), true);
  assert.deepEqual(liveRoots(empty), ["fixed:JSON", "fixed:Math", "fixed:Number"]);
  const busy = scenario({
    symbolGlobal: true,
    bigintGlobal: true,
    stack: [{ type: "object", role: "object:o" }],
    objects: { "object:o": { prototype: null, keys: ["symbol:k"], values: ["limb:n"] } },
  });
  const roots = liveRoots(busy);
  for (const role of ["fixed:Math", "fixed:Number", "fixed:JSON"]) assert.ok(roots.includes(role));
});

test("a symbol key keeps the symbol live when it is not on the stack", () => {
  const keyed = scenario({
    stack: [{ type: "object", role: "object:o" }],
    objects: { "object:o": { prototype: null, keys: ["symbol:k"], values: [] } },
  });
  assert.equal(assertConsistent(keyed), true);
  assert.ok(liveRoots(keyed).includes("symbol:k"));
  assert.equal(liveRoots(keyed).includes("symbol:k"), true);
  const dropped = liveRoots({ ...keyed, stack: [] });
  assert.equal(dropped.includes("symbol:k"), false);
  const inherited = scenario({
    stack: [{ type: "object", role: "object:child" }],
    objects: {
      "object:child": { prototype: "object:proto", keys: [], values: [] },
      "object:proto": { prototype: null, keys: ["symbol:k"], values: ["limb:n"] },
    },
  });
  const roots = liveRoots(inherited);
  assert.equal(assertConsistent(inherited), true);
  assert.ok(roots.includes("object:proto"));
  assert.ok(roots.includes("symbol:k"));
  assert.ok(roots.includes("limb:n"));
});

test("assertConsistent rejects a dangling object", () => {
  assert.throws(() => assertConsistent(scenario({
    stack: [{ type: "object", role: "object:missing" }],
  })), /object:missing/);
  assert.throws(() => liveRoots(scenario({
    stack: [{ type: "bigint", role: "symbol:not-a-limb" }],
  })), /limb/);
});
