import { MAX_LIMBS, SUSPEND_AFTER } from "./schema.js";

// 2^2047: bit 2047, exactly MAX_LIMBS u32 limbs. Host text only; not a guest run.
const BOUNDARY = 1n << (32n * BigInt(MAX_LIMBS) - 1n);
const BIG = 9007199254740993n;
const SUM = (BIG + BIG).toString();

const STANDARD = ["fixed:JSON", "fixed:Math", "fixed:Number"];
const SYMBOL_REALM = ["fixed:Symbol", "fixed:SymbolPrototype", "fixed:SymbolRegistry", "wellknown:iterator", "wellknown:toPrimitive", "wellknown:toStringTag"];
const BIGINT_REALM = ["fixed:BigInt", "fixed:BigIntPrototype"];

function roots(...groups) {
  return [...new Set(groups.flat())].sort();
}

function indexedSymbols(name, count) {
  return Array.from({ length: count }, (_, index) => `symbol:${name}#${index}`);
}

function pressure(symbols, bigints, objects, limbs) {
  return { symbols, bigints, objects, limbs };
}

function note(claims, text) {
  return `${text}\nSafepoint: shader.js fn main budget loop, resumed by runtime.js start().step. collect() sees env cells and the operand stack; a binding still in scope is a root even if the next instruction has not read it yet.\nclaims pressure: ${claims}\n`;
}

const suspend = Object.freeze({ after: SUSPEND_AFTER });

export const FIXTURES = Object.freeze([
  Object.freeze({
    id: "symbol-identity-across-suspend",
    description: "Distinct Symbol() values with one description stay distinct across a safepoint.",
    source: `function f(x) {
  const a = Symbol("same");
  const b = Symbol("same");
  const extras = [];
  for (let i = 0; i < 32; i++) extras.push(Symbol("pressure"));
  // SUSPEND
  let distinct = a !== b;
  for (let i = 0; i < 32; i++) {
    const s = extras[i];
    distinct = distinct && s !== a && s !== b;
    for (let j = 0; j < 32; j++) distinct = distinct && (j === i || extras[j] !== s);
  }
  return distinct ? "distinct" : "collapsed";
}
`,
    rootsRequired: roots(STANDARD, SYMBOL_REALM, ["object:extras", "symbol:a", "symbol:b"], indexedSymbols("extras", 32)),
    suspend,
    pressure: pressure(34, 0, 1, 0),
    expect: { type: "value", value: "distinct" },
    notes: note("symbols, objects", "Symbol() with the same description is not interned. a, b, and all 32 array elements are tag-17 cells and must still be distinct after the safepoint. Collapsing them by description, or dropping the array's elements, is a collection bug."),
  }),
  Object.freeze({
    id: "symbol-for-registry-across-suspend",
    description: "Symbol.for returns the same registry cell before and after a safepoint.",
    source: `function f(x) {
  const a = Symbol.for("reg");
  const b = Symbol.for("reg");
  // SUSPEND
  const c = Symbol.for("reg");
  return a === b && a === c && Symbol.keyFor(a) === "reg" ? "same" : "lost";
}
`,
    rootsRequired: roots(STANDARD, SYMBOL_REALM, ["symbol:for:reg"]),
    suspend,
    pressure: pressure(1, 0, 0, 0),
    expect: { type: "value", value: "same" },
    notes: note("symbols", "One symbol cell is allocated for the key \"reg\". Later Symbol.for calls must return that cell, and Symbol.keyFor must return the string. The registry is rooted because the Symbol constructor is reachable, not because the string is an intern key for Symbol()."),
  }),
  Object.freeze({
    id: "symbol-key-keeps-cell",
    description: "A symbol held only as a property key of a live object stays rooted.",
    source: `function f(x) {
  let key = Symbol("k");
  const obj = {};
  obj[key] = "kept";
  key = null;
  // SUSPEND
  const symbols = Reflect.ownKeys(obj);
  let found = false;
  for (let i = 0; i < symbols.length; i++) found = found || typeof symbols[i] === "symbol";
  return found && obj[symbols[0]] === "kept" ? "kept" : "lost";
}
`,
    rootsRequired: roots(STANDARD, SYMBOL_REALM, ["object:obj", "symbol:key"]),
    suspend,
    pressure: pressure(1, 0, 1, 0),
    expect: { type: "value", value: "kept" },
    notes: note("symbols, objects", "The local is cleared before the safepoint, so the stack and the env cell do not hold the symbol. It stays live only as the property key. shader.js collect() already marks a key whose high bits are 0x40000000 on kinds 3, 9, and 15; the kind-17 cell and its description must remain reachable from that id. Kind 20 is not required."),
  }),
  Object.freeze({
    id: "unreachable-symbol-collectable",
    description: "A symbol that is not reachable and not registered is not a root.",
    source: `function f(x) {
  const obj = { ok: 1 };
  let s = Symbol("gone");
  obj[s] = 1;
  delete obj[s];
  s = null;
  // SUSPEND
  return obj.ok;
}
`,
    rootsRequired: roots(STANDARD, SYMBOL_REALM, ["object:obj"]),
    suspend,
    pressure: pressure(1, 0, 1, 0),
    expect: { type: "value", value: 1 },
    notes: note("symbols, objects", "delete removes the only property edge and the local is then cleared. The symbol is not a Symbol.for key, so it must not appear in rootsRequired. The object and its string data property still work. Expecting to read s after this point would be expecting a collected value."),
  }),
  Object.freeze({
    id: "bigint-limb-local-across-suspend",
    description: "A two-limb bigint local survives a safepoint without Number coercion.",
    source: `function f(x) {
  const n = 9007199254740993n;
  // SUSPEND
  return n.toString();
}
`,
    rootsRequired: roots(STANDARD, BIGINT_REALM, ["limb:n"]),
    suspend,
    pressure: pressure(0, 1, 0, 2),
    expect: { type: "value", value: "9007199254740993" },
    notes: note("bigints, limbs", "9007199254740993 is 2^53+1 and occupies two u32 limbs. Number(9007199254740993) is 9007199254740992, so a coerced Number is visible. The tag-18 local must keep the kind-19 limb object alive across the safepoint, and toString must be the exact decimal."),
  }),
  Object.freeze({
    id: "bigint-max-limbs-resource-limit",
    description: "A bigint of MAX_LIMBS u32 limbs is a resource limit, not a truncated value.",
    source: `function f(x) {
  // MAX_LIMBS is 64 u32 limbs. ROADMAP.md states no other bound.
  // 2^2047 sets bit 2047 and fills exactly 64 limbs. Do not truncate.
  const n = ${BOUNDARY}n;
  return n.toString();
}
`,
    rootsRequired: roots(STANDARD, BIGINT_REALM),
    suspend: null,
    pressure: pressure(0, 1, 0, 64),
    expect: { type: "resource-limit", messageIncludes: "Resource limit" },
    notes: note("bigints, limbs", "MAX_LIMBS is 64 u32 limbs. ROADMAP.md and shader.js do not document a different bound, so this fixture uses 64. The literal is 2^2047, exactly 64 limbs. Materializing it must set shader status 3 (host message \"Resource limit\") and must not publish a shorter limb vector or a Number. The allocating instruction does not complete, so there is no safepoint at which the limb is a root. A returned decimal is a truncated value and is rejected."),
  }),
  Object.freeze({
    id: "bigint-add-after-suspend",
    description: "Adding two live bigints after a safepoint yields their mathematical sum.",
    source: `function f(x) {
  const a = 9007199254740993n;
  const b = 9007199254740993n;
  // SUSPEND
  return (a + b).toString();
}
`,
    rootsRequired: roots(STANDARD, BIGINT_REALM, ["limb:a", "limb:b"]),
    suspend,
    pressure: pressure(0, 2, 0, 4),
    expect: { type: "value", value: SUM },
    notes: note("bigints, limbs", `Both tag-18 locals stay rooted, so each kind-19 vector is still the two-limb value 9007199254740993. Their sum is ${SUM}. Routing the add through the number-addition helper would round; that result is not acceptable.`),
  }),
  Object.freeze({
    id: "ownkeys-order-after-suspend",
    description: "Reflect.ownKeys after a safepoint is integers, then strings, then symbols.",
    source: `function f(x) {
  const symB = Symbol("b");
  const symA = Symbol("a");
  const obj = {};
  obj.z = 1;
  obj[2] = 2;
  obj[symB] = 3;
  obj[0] = 4;
  obj.a = 5;
  obj[symA] = 6;
  // SUSPEND
  const keys = Reflect.ownKeys(obj);
  let out = "";
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const tag = k === symB ? "Sb" : k === symA ? "Sa" : String(k);
    out += tag + ",";
  }
  return out;
}
`,
    rootsRequired: roots(STANDARD, SYMBOL_REALM, ["object:obj", "symbol:symA", "symbol:symB"]),
    suspend,
    pressure: pressure(2, 0, 1, 0),
    expect: { type: "value", value: "0,2,z,a,Sb,Sa," },
    notes: note("symbols, objects", "Creation order is z, index 2, symB, index 0, a, symA. ES2025 OrdinaryOwnPropertyKeys reorders to ascending integer indices, then strings in creation order, then symbols in creation order: 0, 2, z, a, symB, symA. phase4-object-spread.js ownKeys() is the choke point that must append symbol keys after strings. String(symbol) is not used; identity selects the symbol tags."),
  }),
  Object.freeze({
    id: "for-in-excludes-symbols-after-suspend",
    description: "for-in after a safepoint visits enumerable string keys and skips symbols.",
    source: `function f(x) {
  const sym = Symbol("hidden");
  const obj = {};
  obj.b = 1;
  obj[1] = 2;
  obj.a = 3;
  obj[sym] = 4;
  // SUSPEND
  let names = "";
  for (const k in obj) names += k + ",";
  return names;
}
`,
    rootsRequired: roots(STANDARD, SYMBOL_REALM, ["object:obj", "symbol:sym"]),
    suspend,
    pressure: pressure(1, 0, 1, 0),
    expect: { type: "value", value: "1,b,a," },
    notes: note("symbols, objects", "The symbol key stays live because the local and the property still point at it, but for-in enumerates only enumerable string keys: integer index \"1\", then \"b\", then \"a\". Object.prototype's built-in methods are non-enumerable, so they do not appear. A result that contains the symbol, or that drops \"1\", is wrong."),
  }),
  Object.freeze({
    id: "object-spread-enumerable-symbols-after-suspend",
    description: "Object spread after a safepoint copies enumerable symbol keys only.",
    source: `function f(x) {
  const sym = Symbol("s");
  const hidden = Symbol("h");
  const src = { b: 1, 1: 2 };
  src[sym] = 3;
  Object.defineProperty(src, hidden, { value: 4, enumerable: false, writable: true, configurable: true });
  // SUSPEND
  const copy = { ...src };
  const keys = Reflect.ownKeys(copy);
  let sawSym = false;
  let sawHidden = false;
  for (let i = 0; i < keys.length; i++) {
    sawSym = sawSym || keys[i] === sym;
    sawHidden = sawHidden || keys[i] === hidden;
  }
  return sawSym && !sawHidden && copy.b === 1 && copy[1] === 2 && copy[sym] === 3 ? "spread" : "bad";
}
`,
    rootsRequired: roots(STANDARD, SYMBOL_REALM, ["object:src", "symbol:hidden", "symbol:sym"]),
    suspend,
    pressure: pressure(2, 0, 3, 0),
    expect: { type: "value", value: "spread" },
    notes: note("symbols, objects", "CopyDataProperties copies enumerable own keys, including the symbol created by ordinary assignment, and skips the non-enumerable symbol. Index \"1\" and string \"b\" are copied too. Both symbols remain roots through their locals and through src's keys. The descriptor object and the copy are allocated; only src is live at the safepoint. Kind 20 is not used."),
  }),
  Object.freeze({
    id: "prototype-swap-inherited-in",
    description: "A prototype swap across a safepoint is visible to in for a string and a symbol.",
    source: `function f(x) {
  const sym = Symbol("inh");
  const proto = { str: "s" };
  proto[sym] = "p";
  const obj = Object.create(proto);
  // SUSPEND
  const other = { str: "other" };
  other[sym] = "other-sym";
  Object.setPrototypeOf(obj, other);
  const strIn = "str" in obj;
  const symIn = sym in obj;
  const ownStr = Object.hasOwn(obj, "str");
  const ownSym = Object.hasOwn(obj, sym);
  return strIn && symIn && !ownStr && !ownSym && obj.str === "other" && obj[sym] === "other-sym" ? "inherited" : "lost";
}
`,
    rootsRequired: roots(STANDARD, SYMBOL_REALM, ["object:obj", "object:proto", "symbol:sym"]),
    suspend,
    pressure: pressure(1, 0, 3, 0),
    expect: { type: "value", value: "inherited" },
    notes: note("symbols, objects", "At the safepoint, obj's [[Prototype]] is proto, so both the object and the symbol key are live. setPrototypeOf then installs other. in must see other's string and symbol, hasOwn must be false for both, and the values must be other's. The old prototype remains rooted by its local."),
  }),
  Object.freeze({
    id: "fixed-math-json-tostring",
    description: "Fixed Math and JSON nodes stay rooted and keep their toString tags.",
    source: `function f(x) {
  const math = Math;
  const json = JSON;
  for (let i = 0; i < 40; i++) {
    const dead = {};
  }
  // SUSPEND
  return Object.prototype.toString.call(math) + Object.prototype.toString.call(json);
}
`,
    rootsRequired: roots(STANDARD, ["fixed:Math", "fixed:JSON"]),
    suspend,
    pressure: pressure(0, 0, 40, 0),
    expect: { type: "value", value: "[object Math][object JSON]" },
    notes: note("objects", "collect() marks nodes 1..25 before the guest stack. Node 23 is Math and node 25 is JSON; objectMethod id 155 returns [object Math] and [object JSON] when the prototype walk hits those ids. Node 24 is the Number constructor object and is pre-rooted even though this source does not read Number. The global Number binding is builtin id 122, not node 24. Forty dead objects are garbage and are not roots."),
  }),
  Object.freeze({
    id: "descriptor-writable-keeps-symbol-key",
    description: "A writable flip across a safepoint is visible and does not drop a symbol key.",
    source: `function f(x) {
  "use strict";
  const sym = Symbol("d");
  const obj = {};
  obj.name = "v";
  obj[sym] = "sym";
  // SUSPEND
  Object.defineProperty(obj, "name", { writable: false });
  const desc = Object.getOwnPropertyDescriptor(obj, "name");
  let wrote = "no";
  try {
    obj.name = "changed";
    wrote = obj.name === "v" ? "rejected-sloppy" : "changed";
  } catch (e) {
    wrote = e instanceof TypeError ? "threw" : "other";
  }
  return desc.writable === false && obj[sym] === "sym" && wrote === "threw" ? "held" : wrote;
}
`,
    rootsRequired: roots(STANDARD, SYMBOL_REALM, ["object:obj", "symbol:sym"]),
    suspend,
    pressure: pressure(1, 0, 2, 0),
    expect: { type: "value", value: "held" },
    notes: note("symbols, objects", "The data property stays configurable, so defineProperty with only writable:false clears [[Writable]] and leaves the value. Strict assignment then throws TypeError. The symbol key is not part of that descriptor update and must still read \"sym\". A missing symbol key, or a writable property that accepts the write, fails the fixture."),
  }),
  Object.freeze({
    id: "unique-symbols-same-description-under-pressure",
    description: "Two Symbol values with one description stay distinct after short-lived symbols.",
    source: `function f(x) {
  const a = Symbol("d");
  const b = Symbol("d");
  for (let i = 0; i < 64; i++) {
    const dead = Symbol("d");
  }
  // SUSPEND
  return a !== b ? "distinct" : "collapsed";
}
`,
    rootsRequired: roots(STANDARD, SYMBOL_REALM, ["symbol:a", "symbol:b"]),
    suspend,
    pressure: pressure(66, 0, 0, 0),
    expect: { type: "value", value: "distinct" },
    notes: note("symbols", "Sixty-four Symbol(\"d\") allocations die with the loop scope and are not roots. a and b remain in the function env and must not be interned onto one cell by the shared description. The registry is still rooted because Symbol itself is, but neither survivor is a registry member."),
  }),
  Object.freeze({
    id: "keyfor-unique-and-registered-after-suspend",
    description: "keyFor is undefined for a unique symbol and the string for a registered one.",
    source: `function f(x) {
  const unique = Symbol("u");
  const registered = Symbol.for("k");
  // SUSPEND
  const a = Symbol.keyFor(unique);
  const b = Symbol.keyFor(registered);
  return (a === undefined ? "undef" : "bad") + ":" + b;
}
`,
    rootsRequired: roots(STANDARD, SYMBOL_REALM, ["symbol:for:k", "symbol:unique"]),
    suspend,
    pressure: pressure(2, 0, 0, 0),
    expect: { type: "value", value: "undef:k" },
    notes: note("symbols", "Symbol.keyFor on a Symbol() cell is undefined. Symbol.keyFor on the Symbol.for(\"k\") cell is \"k\". Both cells are live from locals. Only symbol:for:k is a registry member; collecting either cell, or returning the description \"u\" for the unique symbol, is wrong."),
  }),
  Object.freeze({
    id: "bigint-json-stringify-unsupported",
    description: "JSON.stringify of a live bigint is an explicit unsupported admission, not a Number.",
    source: `function f(x) {
  const n = 9007199254740993n;
  // SUSPEND
  return JSON.stringify(n);
}
`,
    rootsRequired: roots(STANDARD, BIGINT_REALM, ["limb:n"]),
    suspend,
    pressure: pressure(0, 1, 0, 2),
    expect: { type: "unsupported", messageIncludes: "Unsupported" },
    notes: note("bigints, limbs", "The limb stays rooted so the value that reaches JSON.stringify is still the two-limb bigint, not a Number. json-stringify-source.js returns __lanesUnsupported(\"BigInt serialization pending\") for typeof bigint, and shader.js objectMethod id 141 sets status 6 without keeping that string. The host classification is \"Unsupported runtime operation\". The spec TypeError is not what that helper does. A decimal string or a coerced Number is a silent success and is rejected. BigInt serialization pending."),
  }),
]);
