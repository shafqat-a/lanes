// Fixture validator for phase-3 GC pressure. Sources are data: acorn only checks
// that they are ES text. Resumption is the existing budget safepoint, not a new
// continuation. The numeric bytecode index is pending because program.js rejects
// Symbol and BigInt globals, so no pc is claimed.
import * as acorn from "acorn";
import { assertConsistent, liveRoots } from "./root-model.js";

// Not stated in ROADMAP.md or shader.js. 64 u32 limbs is the phase-3 bound.
export const MAX_LIMBS = 64;

export const SUSPEND_AFTER = "after guest instruction at bytecode index pending (source anchor // SUSPEND). Existing mechanism: shader.js fn main budget loop (experiments/quickjs-runtime/shader.js) yields with status 0 between instructions; collect() runs only at that boundary when freeCount<192; runtime.js start().step resumes the lane from State.pc, reported as Snapshot.pad. Not a Frame.tail continuation (finish() tails 2, 3, 4, 5, 6, and 7 are unrelated). Numeric pc is proposed-pending: program.js rejects Symbol and BigInt globals, so no bytecode index is claimed.";

const SUSPEND_MARK = "// SUSPEND";
const FIXTURE_KEYS = ["id", "description", "source", "rootsRequired", "suspend", "pressure", "expect", "notes"];
const PRESSURE_KEYS = ["symbols", "bigints", "objects", "limbs"];
const EXPECT_KEYS = ["type", "value", "name", "messageIncludes"];
const EXPECT_TYPES = new Set(["value", "throw", "unsupported", "resource-limit"]);

export function limbCount(magnitude) {
  let value = magnitude < 0n ? -magnitude : magnitude;
  if (value === 0n) return 1;
  let count = 0;
  while (value > 0n) {
    value >>= 32n;
    count++;
  }
  return count;
}

function unknownKeys(value, allowed) {
  return Object.keys(value).filter(key => !allowed.includes(key));
}

function isRole(value) {
  return typeof value === "string" && /^(fixed|wellknown|symbol|limb|object):[A-Za-z0-9_:#-]+$/.test(value);
}

function methodCall(callee, objectName, method) {
  return callee.type === "MemberExpression" && !callee.computed
    && callee.object.type === "Identifier" && callee.object.name === objectName
    && callee.property.type === "Identifier" && callee.property.name === method;
}

function analyze(source) {
  const errors = [];
  const pressure = { symbols: 0, bigints: 0, objects: 0, limbs: 0 };
  let ast;
  try {
    ast = acorn.parse(source, { ecmaVersion: "latest", sourceType: "script" });
  } catch (error) {
    return { errors: [`source is not valid ECMAScript: ${error.message}`], pressure, live: [], readRoles: new Set(), oversizeRead: false, sawOversize: false, sawSuspend: false };
  }
  if (ast.body.length !== 1 || ast.body[0].type !== "FunctionDeclaration") {
    errors.push("source must be a single function declaration");
    return { errors, pressure, live: [], readRoles: new Set(), oversizeRead: false, sawOversize: false, sawSuspend: source.includes(SUSPEND_MARK) };
  }
  const fn = ast.body[0];
  if (fn.async || fn.generator || fn.params.length !== 1 || fn.params[0].type !== "Identifier") {
    errors.push("source must be one sync function with one parameter");
  }
  const marks = source.split(SUSPEND_MARK).length - 1;
  if (marks > 1) errors.push("source has more than one // SUSPEND");
  const suspendAt = marks === 1 ? source.indexOf(SUSPEND_MARK) : -1;
  if (suspendAt >= 0 && (suspendAt < fn.body.start || suspendAt > fn.body.end)) {
    errors.push("// SUSPEND must sit inside the function body");
  }
  const before = [];
  const after = [];
  for (const stmt of fn.body.body) {
    if (suspendAt < 0) before.push(stmt);
    else if (stmt.end <= suspendAt) before.push(stmt);
    else if (stmt.start > suspendAt) after.push(stmt);
    else errors.push("suspend splits a statement");
  }

  const scopes = [new Map([[fn.params[0].name, { kind: "primitive" }]])];
  const objects = new Map();
  const registry = new Set();
  const pushCounts = new Map();
  let symbolGlobal = false;
  let bigintGlobal = false;
  let sawOversize = false;
  let symbolSeq = 0;
  let objectSeq = 0;
  let limbSeq = 0;

  const lookup = name => {
    for (let i = scopes.length - 1; i >= 0; i--) if (scopes[i].has(name)) return scopes[i].get(name);
    return null;
  };
  const assign = (name, desc) => {
    for (let i = scopes.length - 1; i >= 0; i--) {
      if (scopes[i].has(name)) {
        scopes[i].set(name, desc);
        return;
      }
    }
    errors.push(`assignment to unbound ${name}`);
  };
  const moveMap = (map, oldRole, next) => {
    if (!map.has(oldRole)) return;
    map.set(next, map.get(oldRole));
    map.delete(oldRole);
  };
  const rename = (oldRole, next) => {
    if (!oldRole || oldRole === next) return;
    moveMap(objects, oldRole, next);
    if (registry.has(oldRole)) {
      registry.delete(oldRole);
      registry.add(next);
    }
    for (const scope of scopes) {
      for (const desc of scope.values()) if (desc.role === oldRole) desc.role = next;
    }
    for (const record of objects.values()) {
      if (record.prototype === oldRole) record.prototype = next;
      for (const entry of record.entries) {
        if (entry.key === oldRole) entry.key = next;
        if (entry.value === oldRole) entry.value = next;
      }
    }
  };
  const prefixOf = kind => (kind === "symbol" ? "symbol" : kind === "bigint" ? "limb" : kind === "object" ? "object" : null);
  const declare = (name, desc) => {
    if (desc?.fresh && desc.role) {
      const prefix = prefixOf(desc.kind);
      if (!prefix) errors.push(`cannot bind ${desc.kind}`);
      else {
        rename(desc.role, `${prefix}:${name}`);
        desc.role = `${prefix}:${name}`;
        desc.fresh = false;
      }
    }
    scopes.at(-1).set(name, desc);
  };
  const heapRole = desc => (desc && (desc.kind === "symbol" || desc.kind === "object" || (desc.kind === "bigint" && !desc.oversize)) ? desc.role : null);

  function evalExpr(node) {
    switch (node.type) {
      case "Identifier": {
        const found = lookup(node.name);
        if (found) return found;
        if (node.name === "Math") return { kind: "object", role: "fixed:Math", fresh: false };
        if (node.name === "JSON") return { kind: "object", role: "fixed:JSON", fresh: false };
        if (node.name === "Number") return { kind: "object", role: "fixed:Number", fresh: false };
        if (node.name === "Symbol") {
          symbolGlobal = true;
          return { kind: "primitive" };
        }
        if (node.name === "BigInt") {
          bigintGlobal = true;
          return { kind: "primitive" };
        }
        return { kind: "primitive" };
      }
      case "Literal": {
        if (node.bigint != null) {
          bigintGlobal = true;
          const limbs = limbCount(BigInt(node.bigint));
          const role = `limb:#${limbSeq++}`;
          const oversize = limbs >= MAX_LIMBS;
          if (oversize) sawOversize = true;
          pressure.bigints++;
          pressure.limbs += limbs;
          return { kind: "bigint", role, fresh: true, oversize, limbs };
        }
        if (node.value === null) return { kind: "empty" };
        return { kind: "primitive" };
      }
      case "ArrayExpression": {
        const role = `object:#${objectSeq++}`;
        const record = { prototype: null, entries: [] };
        objects.set(role, record);
        pressure.objects++;
        for (const element of node.elements) {
          if (!element) continue;
          const value = evalExpr(element);
          const valueRole = heapRole(value);
          if (valueRole) record.entries.push({ key: null, value: valueRole });
        }
        return { kind: "object", role, fresh: true };
      }
      case "ObjectExpression": {
        if (node.properties.some(prop => prop.type === "SpreadElement")) errors.push("object spread before suspend is outside the analyzed subset");
        const role = `object:#${objectSeq++}`;
        const record = { prototype: null, entries: [] };
        objects.set(role, record);
        pressure.objects++;
        for (const prop of node.properties) {
          if (prop.type !== "Property") {
            errors.push(`unanalyzable property ${prop.type}`);
            continue;
          }
          const key = prop.computed ? evalExpr(prop.key) : { kind: "primitive" };
          const value = evalExpr(prop.value);
          const keyRole = key.kind === "symbol" ? key.role : null;
          const valueRole = heapRole(value);
          if (keyRole || valueRole) record.entries.push({ key: keyRole, value: valueRole });
        }
        return { kind: "object", role, fresh: true };
      }
      case "UnaryExpression": {
        if (node.operator === "delete" && node.argument.type === "MemberExpression" && node.argument.computed) {
          const obj = evalExpr(node.argument.object);
          const key = evalExpr(node.argument.property);
          if (obj.kind === "object" && key.kind === "symbol" && objects.has(obj.role)) {
            const record = objects.get(obj.role);
            record.entries = record.entries.filter(entry => entry.key !== key.role);
          }
          return { kind: "primitive" };
        }
        errors.push(`unanalyzable unary ${node.operator}`);
        return { kind: "primitive" };
      }
      case "AssignmentExpression": {
        if (node.operator !== "=") {
          errors.push("only plain assignment is analyzed before suspend");
          return { kind: "primitive" };
        }
        if (node.left.type === "Identifier") {
          const previous = lookup(node.left.name);
          const right = evalExpr(node.right);
          const desc = right.kind === "empty" ? { kind: "empty", dropped: previous?.role } : right;
          assign(node.left.name, desc);
          return desc;
        }
        if (node.left.type === "MemberExpression") {
          const obj = evalExpr(node.left.object);
          const key = node.left.computed ? evalExpr(node.left.property) : { kind: "primitive" };
          const value = evalExpr(node.right);
          if (obj.kind === "object" && objects.has(obj.role)) {
            const keyRole = key.kind === "symbol" ? key.role : null;
            const valueRole = heapRole(value);
            if (keyRole || valueRole) objects.get(obj.role).entries.push({ key: keyRole, value: valueRole });
          }
          return value;
        }
        errors.push("unanalyzable assignment");
        return { kind: "primitive" };
      }
      case "CallExpression":
        return evalCall(node);
      case "MemberExpression":
        evalExpr(node.object);
        if (node.computed) evalExpr(node.property);
        return { kind: "primitive" };
      default:
        errors.push(`unanalyzable expr ${node.type}`);
        return { kind: "primitive" };
    }
  }

  function evalCall(node) {
    if (node.callee.type === "Identifier" && node.callee.name === "Symbol") {
      symbolGlobal = true;
      for (const arg of node.arguments) evalExpr(arg);
      const role = `symbol:#${symbolSeq++}`;
      pressure.symbols++;
      return { kind: "symbol", role, fresh: true };
    }
    if (methodCall(node.callee, "Symbol", "for")) {
      symbolGlobal = true;
      const arg = node.arguments[0];
      if (arg?.type !== "Literal" || typeof arg.value !== "string") {
        errors.push("Symbol.for argument must be a string literal");
        return { kind: "primitive" };
      }
      const role = `symbol:for:${arg.value}`;
      if (!registry.has(role)) {
        registry.add(role);
        pressure.symbols++;
      }
      return { kind: "symbol", role, fresh: false };
    }
    if (methodCall(node.callee, "Object", "create")) {
      const arg = node.arguments[0];
      const proto = arg ? evalExpr(arg) : { kind: "primitive" };
      if (proto.kind !== "object") errors.push("Object.create expects an object prototype");
      const role = `object:#${objectSeq++}`;
      objects.set(role, { prototype: proto.kind === "object" ? proto.role : null, entries: [] });
      pressure.objects++;
      return { kind: "object", role, fresh: true };
    }
    if (methodCall(node.callee, "Object", "defineProperty")) {
      if (node.arguments[2]?.type !== "ObjectExpression") errors.push("defineProperty descriptor must be an object literal");
      else pressure.objects++;
      const obj = evalExpr(node.arguments[0]);
      const key = evalExpr(node.arguments[1]);
      if (obj.kind === "object" && key.kind === "symbol" && objects.has(obj.role)) {
        objects.get(obj.role).entries.push({ key: key.role, value: null });
      }
      return { kind: "primitive" };
    }
    if (node.callee.type === "MemberExpression" && !node.callee.computed
      && node.callee.property.type === "Identifier" && node.callee.property.name === "push"
      && node.callee.object.type === "Identifier") {
      const arr = evalExpr(node.callee.object);
      const arg = node.arguments[0] ? evalExpr(node.arguments[0]) : { kind: "primitive" };
      if (arr.kind === "object" && objects.has(arr.role)) {
        let valueRole = heapRole(arg);
        if (arg.fresh && arg.kind === "symbol" && arr.role.startsWith("object:")) {
          const index = pushCounts.get(arr.role) || 0;
          pushCounts.set(arr.role, index + 1);
          const renamed = `symbol:${arr.role.slice("object:".length)}#${index}`;
          rename(arg.role, renamed);
          arg.role = renamed;
          arg.fresh = false;
          valueRole = renamed;
        }
        if (valueRole) objects.get(arr.role).entries.push({ key: null, value: valueRole });
      }
      return { kind: "primitive" };
    }
    evalExpr(node.callee);
    for (const arg of node.arguments) evalExpr(arg);
    return { kind: "primitive" };
  }

  function loopBound(node) {
    const init = node.init;
    const test = node.test;
    const update = node.update;
    const name = init?.type === "VariableDeclaration" && init.declarations.length === 1 ? init.declarations[0].id.name : null;
    const zero = init?.declarations?.[0]?.init?.type === "Literal" && init.declarations[0].init.value === 0;
    const bound = test?.type === "BinaryExpression" && test.operator === "<" && test.left.type === "Identifier"
      && test.left.name === name && test.right.type === "Literal" && Number.isInteger(test.right.value);
    const bump = update?.type === "UpdateExpression" && update.operator === "++" && update.argument.type === "Identifier" && update.argument.name === name;
    if (init?.kind !== "let" || !zero || !bound || !bump || test.right.value < 0 || test.right.value > 10000) {
      errors.push("before-suspend for-loop must be for (let i = 0; i < N; i++) with a literal N");
      return 0;
    }
    return test.right.value;
  }

  function execStmt(stmt) {
    if (stmt.type === "ExpressionStatement") {
      evalExpr(stmt.expression);
      return;
    }
    if (stmt.type === "VariableDeclaration") {
      if (stmt.kind === "var") errors.push("var is not analyzed");
      for (const declarator of stmt.declarations) {
        if (declarator.id.type !== "Identifier") {
          errors.push("only identifier bindings are analyzed");
          continue;
        }
        declare(declarator.id.name, declarator.init ? evalExpr(declarator.init) : { kind: "empty" });
      }
      return;
    }
    if (stmt.type === "BlockStatement") {
      scopes.push(new Map());
      for (const inner of stmt.body) execStmt(inner);
      scopes.pop();
      return;
    }
    if (stmt.type === "ForStatement") {
      const count = loopBound(stmt);
      for (let i = 0; i < count; i++) {
        scopes.push(new Map());
        execStmt(stmt.body);
        scopes.pop();
      }
      return;
    }
    if (stmt.type === "ReturnStatement") {
      errors.push("return before suspend is not a safepoint");
      return;
    }
    errors.push(`unanalyzable stmt ${stmt.type}`);
  }

  for (const stmt of before) {
    if (suspendAt < 0 && stmt.type === "ReturnStatement") continue;
    execStmt(stmt);
  }
  if (scopes.length !== 1) errors.push("scope leaked out of a before-suspend loop");

  const scenarioObjects = {};
  for (const [role, record] of objects) {
    if (!role.startsWith("object:")) continue;
    scenarioObjects[role] = {
      prototype: record.prototype,
      keys: [...new Set(record.entries.map(entry => entry.key).filter(Boolean))],
      values: [...new Set(record.entries.map(entry => entry.value).filter(Boolean))],
    };
  }
  const stack = [];
  for (const desc of scopes[0].values()) {
    if (desc.kind === "symbol") stack.push({ type: "symbol", role: desc.role });
    else if (desc.kind === "object") stack.push({ type: "object", role: desc.role });
    else if (desc.kind === "bigint" && !desc.oversize) stack.push({ type: "bigint", role: desc.role });
  }
  const scenario = {
    standardEnv: true,
    symbolGlobal,
    bigintGlobal,
    stack,
    registry: [...registry],
    objects: scenarioObjects,
  };
  let live = [];
  try {
    assertConsistent(scenario);
    live = liveRoots(scenario);
  } catch (error) {
    errors.push(`root scenario: ${error.message}`);
  }
  const liveSet = new Set(live);
  const preScopes = scopes.map(scope => new Map(scope));
  const lookupPre = name => {
    for (let i = preScopes.length - 1; i >= 0; i--) if (preScopes[i].has(name)) return preScopes[i].get(name);
    return null;
  };

  const afterScopes = [new Set()];
  const readRoles = new Set();
  let oversizeRead = false;
  const noteRead = name => {
    if (afterScopes.some(scope => scope.has(name))) return;
    const pre = lookupPre(name);
    if (!pre) return;
    if (pre.kind === "bigint" && pre.oversize) {
      oversizeRead = true;
      return;
    }
    if (pre.kind === "empty" && pre.dropped && !liveSet.has(pre.dropped)) {
      errors.push(`expects a collected value to still be readable: ${pre.dropped}`);
      return;
    }
    if (pre.role && liveSet.has(pre.role)) readRoles.add(pre.role);
    if (pre.role && (pre.kind === "symbol" || pre.kind === "object" || pre.kind === "bigint") && !liveSet.has(pre.role)) {
      errors.push(`expects a collected value to still be readable: ${pre.role}`);
    }
  };

  function scan(node) {
    if (!node || typeof node !== "object") return;
    switch (node.type) {
      case "Identifier":
        noteRead(node.name);
        return;
      case "Literal":
        if (node.bigint != null) {
          bigintGlobal = true;
          const limbs = limbCount(BigInt(node.bigint));
          pressure.bigints++;
          pressure.limbs += limbs;
          if (limbs >= MAX_LIMBS) sawOversize = true;
        }
        return;
      case "MemberExpression":
        scan(node.object);
        if (node.computed) scan(node.property);
        return;
      case "CallExpression":
        countLateCall(node);
        scan(node.callee);
        for (const arg of node.arguments) scan(arg);
        return;
      case "BinaryExpression":
      case "LogicalExpression":
        scan(node.left);
        scan(node.right);
        return;
      case "ConditionalExpression":
        scan(node.test);
        scan(node.consequent);
        scan(node.alternate);
        return;
      case "UnaryExpression":
      case "UpdateExpression":
        scan(node.argument);
        return;
      case "AssignmentExpression":
        scan(node.right);
        if (node.left.type === "Identifier") noteRead(node.left.name);
        else scan(node.left);
        return;
      case "ObjectExpression":
        pressure.objects++;
        for (const prop of node.properties) {
          if (prop.type === "SpreadElement") scan(prop.argument);
          else if (prop.type === "Property") {
            if (prop.computed) scan(prop.key);
            scan(prop.value);
          } else errors.push(`unanalyzable property ${prop.type}`);
        }
        return;
      case "ArrayExpression":
        pressure.objects++;
        for (const element of node.elements) if (element) scan(element);
        return;
      case "ExpressionStatement":
        scan(node.expression);
        return;
      case "ReturnStatement":
        if (node.argument) scan(node.argument);
        return;
      case "VariableDeclaration":
        for (const declarator of node.declarations) {
          if (declarator.init) scan(declarator.init);
          if (declarator.id.type === "Identifier") afterScopes.at(-1).add(declarator.id.name);
          else errors.push("only identifier bindings are analyzed");
        }
        return;
      case "BlockStatement":
        afterScopes.push(new Set());
        for (const stmt of node.body) scan(stmt);
        afterScopes.pop();
        return;
      case "ForStatement":
        afterScopes.push(new Set());
        if (node.init) scan(node.init);
        if (node.test) scan(node.test);
        if (node.update) scan(node.update);
        scan(node.body);
        afterScopes.pop();
        return;
      case "ForInStatement":
        afterScopes.push(new Set());
        scan(node.right);
        if (node.left.type === "VariableDeclaration") {
          const id = node.left.declarations[0]?.id;
          if (id?.type === "Identifier") afterScopes.at(-1).add(id.name);
          else errors.push("for-in binding must be an identifier");
        } else scan(node.left);
        scan(node.body);
        afterScopes.pop();
        return;
      case "TryStatement":
        scan(node.block);
        if (node.handler) {
          afterScopes.push(new Set());
          if (node.handler.param?.type === "Identifier") afterScopes.at(-1).add(node.handler.param.name);
          scan(node.handler.body);
          afterScopes.pop();
        }
        if (node.finalizer) scan(node.finalizer);
        return;
      case "FunctionDeclaration":
      case "FunctionExpression":
      case "ArrowFunctionExpression":
        errors.push("nested functions are outside the analyzed subset");
        return;
      default:
        errors.push(`unanalyzable ${node.type}`);
    }
  }

  function countLateCall(node) {
    if (node.callee.type === "Identifier" && node.callee.name === "Symbol") {
      symbolGlobal = true;
      pressure.symbols++;
      return;
    }
    if (methodCall(node.callee, "Symbol", "for")) {
      symbolGlobal = true;
      const arg = node.arguments[0];
      if (arg?.type === "Literal" && typeof arg.value === "string") {
        const role = `symbol:for:${arg.value}`;
        // A first registry insert after the safepoint is not a root at the safepoint.
        if (!registry.has(role)) {
          registry.add(role);
          pressure.symbols++;
        }
      }
    }
    if (methodCall(node.callee, "Symbol", "keyFor") || methodCall(node.callee, "Symbol", "for")) symbolGlobal = true;
  }

  const late = suspendAt < 0 ? before.filter(stmt => stmt.type === "ReturnStatement") : after;
  for (const stmt of late) scan(stmt);

  return { errors, pressure, live, readRoles, oversizeRead, sawOversize, sawSuspend: suspendAt >= 0, symbolGlobal, bigintGlobal };
}

function checkExpect(expect, errors) {
  if (!expect || typeof expect !== "object") {
    errors.push("expect must be an object");
    return;
  }
  const extra = unknownKeys(expect, EXPECT_KEYS);
  if (extra.length) errors.push(`unexpected expect fields: ${extra.join(",")}`);
  if (!EXPECT_TYPES.has(expect.type)) errors.push("expect.type must be value, throw, unsupported, or resource-limit");
  if (expect.type === "value") {
    if (!("value" in expect)) errors.push("value expectation needs value");
    else if (!["string", "number", "boolean"].includes(typeof expect.value) && expect.value !== null) {
      errors.push("expect.value must be a deterministic JSON value");
    }
    if ("name" in expect) errors.push("value expectation must not name an exception");
  } else if ("value" in expect) {
    errors.push(`${expect.type} expectation must not carry a value`);
  }
  if (expect.type === "throw" && typeof expect.name !== "string") errors.push("throw expectation needs name");
  if (expect.type !== "throw" && "name" in expect) errors.push("only throw expectations have name");
  if ("messageIncludes" in expect && typeof expect.messageIncludes !== "string") errors.push("messageIncludes must be a string");
}

export function validateFixture(fixture) {
  const errors = [];
  if (!fixture || typeof fixture !== "object") return { ok: false, errors: ["fixture must be an object"] };
  const extra = unknownKeys(fixture, FIXTURE_KEYS);
  if (extra.length) errors.push(`unexpected fixture fields: ${extra.join(",")}`);
  if (typeof fixture.id !== "string" || !/^[a-z0-9-]+$/.test(fixture.id)) errors.push("id must be a kebab-case string");
  if (typeof fixture.description !== "string" || fixture.description.length < 8) errors.push("description must be a string");
  if (typeof fixture.notes !== "string" || fixture.notes.length < 8) errors.push("notes must be a string");
  if (typeof fixture.source !== "string") errors.push("source must be a string");
  if (!Array.isArray(fixture.rootsRequired) || fixture.rootsRequired.some(role => !isRole(role))) {
    errors.push("rootsRequired must be an array of roles");
  } else if (new Set(fixture.rootsRequired).size !== fixture.rootsRequired.length) {
    errors.push("rootsRequired has a duplicate");
  }
  if (fixture.suspend !== null && (!fixture.suspend || typeof fixture.suspend !== "object" || unknownKeys(fixture.suspend, ["after"]).length || fixture.suspend.after !== SUSPEND_AFTER)) {
    errors.push("suspend must be null or { after: SUSPEND_AFTER }");
  }
  if (!fixture.pressure || typeof fixture.pressure !== "object" || unknownKeys(fixture.pressure, PRESSURE_KEYS).length) {
    errors.push("pressure must have symbols, bigints, objects, and limbs");
  } else {
    for (const key of PRESSURE_KEYS) {
      if (!Number.isInteger(fixture.pressure[key]) || fixture.pressure[key] < 0) errors.push(`pressure.${key} must be a non-negative integer`);
    }
  }
  checkExpect(fixture.expect, errors);
  if (typeof fixture.source !== "string" || !fixture.pressure || !Array.isArray(fixture.rootsRequired)) {
    return { ok: errors.length === 0, errors };
  }
  const analysis = analyze(fixture.source);
  errors.push(...analysis.errors);
  if (analysis.sawSuspend !== (fixture.suspend !== null)) {
    errors.push(fixture.suspend ? "suspend is set but source has no // SUSPEND" : "source has // SUSPEND but suspend is null");
  }
  if (fixture.suspend !== null && !fixture.notes.includes("shader.js fn main")) {
    errors.push("notes must cite the shader.js fn main safepoint");
  }
  const claim = /claims pressure: ([^\n]+)/.exec(fixture.notes || "");
  if (!claim) errors.push("notes must include claims pressure: ...");
  else if (fixture.pressure && PRESSURE_KEYS.every(key => Number.isInteger(fixture.pressure[key]))) {
    const kinds = claim[1].split(",").map(part => part.trim()).filter(Boolean);
    const named = kinds.filter(kind => kind !== "none");
    if (kinds.includes("none") && named.length) errors.push("pressure claim mixes none with kinds");
    for (const kind of named) {
      if (!PRESSURE_KEYS.includes(kind)) errors.push(`unknown pressure claim ${kind}`);
      else if (fixture.pressure[kind] <= 0) errors.push(`claimed pressure ${kind} is not positive`);
    }
    for (const key of PRESSURE_KEYS) {
      if (fixture.pressure[key] !== analysis.pressure[key]) errors.push(`pressure.${key} is ${fixture.pressure[key]} but the source allocates ${analysis.pressure[key]}`);
      if (fixture.pressure[key] > 0 && !named.includes(key)) errors.push(`pressure.${key} is positive but not claimed`);
    }
  }
  const live = new Set(analysis.live);
  for (const role of live) {
    if (!fixture.rootsRequired.includes(role)) {
      errors.push(analysis.readRoles.has(role)
        ? `omits a root for a value used after suspend: ${role}`
        : `omits a live root: ${role}`);
    }
  }
  for (const role of fixture.rootsRequired) {
    if (!live.has(role)) errors.push(`requires a root for a collectable value: ${role}`);
  }
  if (fixture.expect?.type === "value" && typeof fixture.expect.value === "number" && analysis.pressure.bigints > 0) {
    errors.push("do not expect a silently coerced Number");
  }
  if (fixture.expect?.type === "value" && typeof fixture.expect.value === "string" && fixture.expect.value.includes("9007199254740992")) {
    errors.push("do not expect a silently coerced Number");
  }
  if (analysis.sawOversize) {
    if (fixture.expect?.type !== "resource-limit") errors.push("a bigint at the MAX_LIMBS boundary must expect resource-limit, not a truncated value");
    if (fixture.rootsRequired.some(role => role.startsWith("limb:"))) errors.push("an over-limit bigint must not stay rooted as a readable limb");
  } else if (fixture.expect?.type === "resource-limit") {
    errors.push("resource-limit is only the MAX_LIMBS boundary in this schema");
  }
  if (fixture.expect?.type === "unsupported") {
    if (!fixture.source.includes("JSON.stringify")) errors.push("unsupported fixture must be the explicit JSON.stringify bigint admission");
    if (!fixture.notes.includes("BigInt serialization pending")) errors.push("notes must cite the JSON bigint unsupported admission");
  }
  return { ok: errors.length === 0, errors };
}
