// Mark closure for phase-3 GC fixtures. Mirrors shader.js collect(): fixed nodes
// 1..25, stack, frame envs, then property and prototype edges. Tag 17 (symbol)
// and tag 18 (BigInt limb) are not marked by markValue today; this model is the
// closure the parent must implement. It does not run guest code.

const ROLE = /^(fixed|wellknown|symbol|limb|object):[A-Za-z0-9_:#-]+$/;

function assertRole(role, label) {
  if (typeof role !== "string" || !ROLE.test(role)) throw new Error(`${label} is not a role: ${role}`);
}

function checkScenario(scenario) {
  if (!scenario || typeof scenario !== "object") throw new Error("scenario must be an object");
  if (typeof scenario.standardEnv !== "boolean") throw new Error("standardEnv must be boolean");
  if (typeof scenario.symbolGlobal !== "boolean") throw new Error("symbolGlobal must be boolean");
  if (typeof scenario.bigintGlobal !== "boolean") throw new Error("bigintGlobal must be boolean");
  if (!Array.isArray(scenario.stack)) throw new Error("stack must be an array");
  if (!Array.isArray(scenario.registry)) throw new Error("registry must be an array");
  if (!scenario.objects || typeof scenario.objects !== "object") throw new Error("objects must be an object");
  for (const member of scenario.registry) {
    assertRole(member, "registry member");
    if (!member.startsWith("symbol:")) throw new Error(`registry member is not a symbol: ${member}`);
  }
  for (const [role, record] of Object.entries(scenario.objects)) {
    assertRole(role, "object");
    if (!role.startsWith("object:")) throw new Error(`object map key is not an object role: ${role}`);
    if (!record || typeof record !== "object") throw new Error(`missing record for ${role}`);
    if (record.prototype !== null) {
      assertRole(record.prototype, `${role} prototype`);
      if (record.prototype.startsWith("object:") && !Object.hasOwn(scenario.objects, record.prototype)) {
        throw new Error(`${role} prototype ${record.prototype} is not in objects`);
      }
    }
    if (!Array.isArray(record.keys) || !Array.isArray(record.values)) throw new Error(`${role} keys/values must be arrays`);
    for (const key of record.keys) {
      assertRole(key, `${role} key`);
      if (!key.startsWith("symbol:")) throw new Error(`${role} key is not a symbol: ${key}`);
    }
    for (const value of record.values) {
      assertRole(value, `${role} value`);
      if (value.startsWith("object:") && !Object.hasOwn(scenario.objects, value)) {
        throw new Error(`${role} value ${value} is not in objects`);
      }
    }
  }
  for (const item of scenario.stack) {
    if (!item || typeof item !== "object") throw new Error("stack entry must be an object");
    if (item.type === "primitive" || item.type === "null") continue;
    if (item.type === "symbol") {
      assertRole(item.role, "stack symbol");
      if (!item.role.startsWith("symbol:")) throw new Error(`stack symbol role ${item.role}`);
    } else if (item.type === "bigint") {
      assertRole(item.role, "stack bigint");
      if (!item.role.startsWith("limb:")) throw new Error(`tag-18 value must name a limb role, got ${item.role}`);
    } else if (item.type === "object") {
      assertRole(item.role, "stack object");
      if (item.role.startsWith("object:") && !Object.hasOwn(scenario.objects, item.role)) {
        throw new Error(`stack object ${item.role} is not in objects`);
      }
    } else {
      throw new Error(`unknown stack type ${item.type}`);
    }
  }
}

export function liveRoots(scenario) {
  checkScenario(scenario);
  const registry = new Set(scenario.registry);
  const live = new Set();
  const queue = [];
  let steps = 0;
  const add = role => {
    if (typeof role !== "string" || live.has(role)) return;
    live.add(role);
    queue.push(role);
  };
  const drain = () => {
    while (queue.length) {
      if (++steps > 100000) throw new Error("root closure did not terminate");
      const role = queue.shift();
      const record = scenario.objects[role];
      if (!record) continue;
      if (record.prototype) add(record.prototype);
      for (const key of record.keys) add(key);
      for (const value of record.values) add(value);
    }
  };
  if (scenario.standardEnv) {
    add("fixed:Math");
    add("fixed:Number");
    add("fixed:JSON");
  }
  if (scenario.symbolGlobal) {
    add("fixed:Symbol");
    add("fixed:SymbolPrototype");
    add("fixed:SymbolRegistry");
    add("wellknown:iterator");
    add("wellknown:toStringTag");
    add("wellknown:toPrimitive");
    for (const member of registry) add(member);
  }
  if (scenario.bigintGlobal) {
    add("fixed:BigInt");
    add("fixed:BigIntPrototype");
  }
  for (const item of scenario.stack) {
    if (item.type === "symbol" || item.type === "bigint" || item.type === "object") add(item.role);
  }
  drain();
  // A reachable registered symbol keeps the registry, and the registry keeps every member.
  let registryLive = live.has("fixed:SymbolRegistry");
  if (!registryLive) {
    for (const role of live) if (registry.has(role)) registryLive = true;
  }
  if (registryLive) {
    add("fixed:SymbolRegistry");
    for (const member of registry) add(member);
    drain();
  }
  return [...live].sort();
}

export function assertConsistent(scenario) {
  checkScenario(scenario);
  const live = new Set(liveRoots(scenario));
  for (const role of live) {
    const record = scenario.objects[role];
    if (!record) continue;
    if (record.prototype && !live.has(record.prototype)) {
      throw new Error(`live ${role} prototype ${record.prototype} is not live`);
    }
    for (const key of record.keys) {
      if (!live.has(key)) throw new Error(`live ${role} drops symbol key ${key}`);
    }
    for (const value of record.values) {
      if (!live.has(value)) throw new Error(`live ${role} drops value ${value}`);
    }
  }
  if (scenario.expectedRoots) {
    const expected = [...scenario.expectedRoots].sort();
    const actual = [...live].sort();
    if (expected.length !== actual.length || expected.some((role, i) => role !== actual[i])) {
      throw new Error(`expected roots ${expected.join(",")} but live are ${actual.join(",")}`);
    }
  }
  return true;
}
