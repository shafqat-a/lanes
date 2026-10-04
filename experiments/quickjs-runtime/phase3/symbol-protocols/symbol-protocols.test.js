import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { arrayBuiltins } from "../../array-source.js";
import {
  ARRAY_UNSCOPABLE_NAMES,
  intrinsicIteratorFastPath,
  resolveIteratorMethod,
} from "./iterator-protocol.js";
import {
  ToPrimitive,
  Unsupported,
  symbolToPrimitive,
  toNumberBigIntThrows,
  toNumberSymbolThrows,
} from "./to-primitive.js";
import { builtinTag, mathAndJsonTags, objectToString } from "./to-string-tag.js";
import {
  ARRAY_VALUES_BUILTIN_ID,
  DISPATCH,
  PROTOCOL_BUILTINS,
  WELL_KNOWN_ID,
  WELL_KNOWN_NAMES,
  WELL_KNOWN_TABLE_NODE,
  createWellKnownTable,
  sameSymbolValue,
  symbolKeyFor,
} from "./well-known.js";

const table = createWellKnownTable();

test("well-known symbols are pairwise distinct and keyFor-equivalent undefined", () => {
  assert.equal(table.cells.length, 15);
  assert.equal(WELL_KNOWN_NAMES.includes("metadata"), false);
  for (let i = 0; i < table.cells.length; i++) {
    const cell = table.cells[i];
    assert.equal(cell.registryKey, null);
    assert.equal(symbolKeyFor(cell), undefined);
    assert.equal(cell.description, `Symbol.${cell.name}`);
    assert.equal(cell.nodeId, 31 + i);
    assert.equal(cell.uniqueIdentity, cell.nodeId);
    assert.equal(DISPATCH[cell.name].length > 0, true);
    for (let j = i + 1; j < table.cells.length; j++) {
      assert.notEqual(cell.uniqueIdentity, table.cells[j].uniqueIdentity);
      assert.equal(sameSymbolValue(cell, table.cells[j]), false);
    }
  }
  const hostNames = WELL_KNOWN_NAMES;
  const host = hostNames.map(name => Symbol[name]);
  for (let i = 0; i < host.length; i++) {
    assert.equal(typeof host[i], "symbol");
    assert.equal(Symbol.keyFor(host[i]), undefined);
    assert.equal(host[i].description, table.byName[hostNames[i]].description);
    for (let j = i + 1; j < host.length; j++) assert.notEqual(host[i], host[j]);
  }
  const registered = Symbol.for("iterator");
  assert.equal(Symbol.keyFor(registered), "iterator");
  assert.notEqual(registered, Symbol.iterator);
  assert.equal(symbolKeyFor(table.byName.iterator), undefined);
  assert.throws(() => { table.byName.extra = 1; }, TypeError);
  assert.throws(() => { table.cells[0].registryKey = "iterator"; }, TypeError);
});

test("ToPrimitive number/string/default order", () => {
  const log = [];
  const numberOrder = {
    tag: "object",
    brand: "Object",
    methods: {
      toString() { log.push("toString"); return { tag: "object", brand: "Object" }; },
      valueOf() { log.push("valueOf"); return 1; },
    },
  };
  assert.equal(ToPrimitive(numberOrder, "number"), 1);
  assert.deepEqual(log, ["valueOf"]);
  log.length = 0;
  assert.equal(ToPrimitive(numberOrder, "default"), 1);
  assert.deepEqual(log, ["valueOf"]);
  log.length = 0;
  const stringOrder = {
    tag: "object",
    brand: "Object",
    methods: {
      toString() { log.push("toString"); return "s"; },
      valueOf() { log.push("valueOf"); return { tag: "object" }; },
    },
  };
  assert.equal(ToPrimitive(stringOrder, "string"), "s");
  assert.deepEqual(log, ["toString"]);
  log.length = 0;
  assert.equal(ToPrimitive(stringOrder, "number"), "s");
  assert.deepEqual(log, ["valueOf", "toString"]);
  log.length = 0;
  const bothObjects = {
    tag: "object",
    brand: "Object",
    methods: {
      toString() { log.push("toString"); return { tag: "object" }; },
      valueOf() { log.push("valueOf"); return { tag: "object" }; },
    },
  };
  assert.throws(() => ToPrimitive(bothObjects, "default"), TypeError);
  assert.deepEqual(log, ["valueOf", "toString"]);
  assert.equal(ToPrimitive(null, "number"), null);
  assert.equal(ToPrimitive(undefined, "string"), undefined);
  assert.equal(ToPrimitive(true, "default"), true);
  assert.equal(ToPrimitive("z", "number"), "z");
  assert.equal(Object.is(ToPrimitive(-0, "number"), -0), true);
  assert.equal(Object.is(ToPrimitive(NaN, "string"), NaN), true);
  const boxed = { tag: "number", value: -0 };
  assert.equal(ToPrimitive(boxed, "default"), boxed);
  assert.equal(Object.is(boxed.value, -0), true);
});

test("@@toPrimitive override and TypeError when it returns an object", () => {
  let ordinary = 0;
  const obj = {
    tag: "object",
    brand: "Object",
    symbols: {
      [WELL_KNOWN_ID.toPrimitive](receiver, hint) {
        assert.equal(hint, "number");
        return { tag: "object", brand: "Object" };
      },
    },
    methods: { valueOf() { ordinary++; return 1; } },
  };
  assert.throws(() => ToPrimitive(obj, "number"), /Cannot convert object to primitive value/);
  assert.equal(ordinary, 0);
  const uncallable = {
    tag: "object",
    brand: "Object",
    methods: { toPrimitive: { callable: false }, valueOf() { ordinary++; return 1; } },
  };
  assert.throws(() => ToPrimitive(uncallable, "string"), /@@toPrimitive is not a function/);
  assert.equal(ordinary, 0);
});

test("hint default vs string", () => {
  const hints = [];
  const obj = {
    tag: "object",
    brand: "Object",
    methods: {
      toPrimitive(receiver, hint) { hints.push(hint); return hint; },
    },
  };
  assert.equal(ToPrimitive(obj, "default"), "default");
  assert.equal(ToPrimitive(obj), "default");
  assert.equal(ToPrimitive(obj, "string"), "string");
  assert.equal(ToPrimitive(obj, "number"), "number");
  assert.deepEqual(hints, ["default", "default", "string", "number"]);
  // No engine Date brand. A caller-supplied Date brand still uses number order
  // for hint default; only preferredType "string" selects toString first.
  const dateLog = [];
  const date = {
    tag: "object",
    brand: "Date",
    methods: {
      valueOf() { dateLog.push("valueOf"); return 1; },
      toString() { dateLog.push("toString"); return "d"; },
    },
  };
  assert.equal(ToPrimitive(date, "default"), 1);
  assert.deepEqual(dateLog, ["valueOf"]);
  dateLog.length = 0;
  assert.equal(ToPrimitive(date, "string"), "d");
  assert.deepEqual(dateLog, ["toString"]);
});

test("symbol primitive ToPrimitive returns the same identity", () => {
  const cell = table.byName.iterator;
  assert.equal(ToPrimitive(cell, "number"), cell);
  assert.equal(ToPrimitive(cell, "string"), cell);
  assert.equal(ToPrimitive(cell, "default"), cell);
  assert.equal(symbolToPrimitive(cell, "string"), cell);
  assert.equal(toNumberSymbolThrows(cell), true);
  assert.equal(toNumberSymbolThrows("iterator"), false);
  const wrapped = { tag: "object", brand: "Symbol", symbolData: cell };
  assert.equal(ToPrimitive(wrapped, "default"), cell);
  const limbs = { tag: "bigint", limbs: [1, 0] };
  assert.equal(ToPrimitive(limbs, "number"), limbs);
  assert.equal(toNumberBigIntThrows(limbs), true);
  assert.equal(toNumberBigIntThrows(wrapped), false);
  assert.throws(
    () => ToPrimitive({ tag: "object", brand: "BigInt", bigintData: limbs }, "default"),
    Unsupported,
  );
});

test("toStringTag string override", () => {
  const array = { tag: "object", brand: "Array", kind: 7 };
  assert.equal(objectToString(array, () => "List"), "[object List]");
  assert.equal(objectToString(array, () => ({ tag: "string", value: "List" })), "[object List]");
  assert.equal(objectToString(array, () => 1), "[object Array]");
  assert.equal(objectToString(array, () => table.byName.toStringTag), "[object Array]");
  let seen = null;
  objectToString(array, (value, key) => { seen = key; return "List"; });
  assert.deepEqual(seen, { kind: "symbol", id: WELL_KNOWN_ID.toStringTag });
});

test('Math and JSON tags "[object Math]" and "[object JSON]"', () => {
  const tags = mathAndJsonTags();
  assert.equal(tags.math.nodeId, 23);
  assert.equal(tags.json.nodeId, 25);
  assert.equal(tags.math.descriptor.value, "Math");
  assert.equal(tags.json.descriptor.value, "JSON");
  assert.equal(tags.math.descriptor.writable, false);
  assert.equal(tags.math.descriptor.enumerable, false);
  assert.equal(tags.math.descriptor.configurable, true);
  assert.equal(tags.math.descriptor.flags, 4);
  assert.equal(tags.json.descriptor.flags, 4);
  assert.equal(tags.math.descriptor.key.id, WELL_KNOWN_ID.toStringTag);
  const installed = new Map([
    [tags.math.nodeId, tags.math.descriptor],
    [tags.json.nodeId, tags.json.descriptor],
  ]);
  const getProperty = (value, key) => {
    assert.equal(key.kind, "symbol");
    assert.equal(key.id, WELL_KNOWN_ID.toStringTag);
    let current = value;
    while (current) {
      const desc = installed.get(current.nodeId);
      if (desc) return desc.value;
      current = current.proto;
    }
    return undefined;
  };
  const math = { tag: "object", brand: "Object", nodeId: 23 };
  const json = { tag: "object", brand: "Object", nodeId: 25 };
  const child = { tag: "object", brand: "Object", proto: json };
  assert.equal(objectToString(math, getProperty), "[object Math]");
  assert.equal(objectToString(json, getProperty), "[object JSON]");
  assert.equal(objectToString(child, getProperty), "[object JSON]");
  assert.equal(objectToString({ tag: "object", brand: "Math", nodeId: 23 }, () => undefined), "[object Object]");
});

test("absent tag falls back to [object Object]", () => {
  let called = 0;
  assert.equal(objectToString(null, () => { called++; return "Nope"; }), "[object Null]");
  assert.equal(objectToString(undefined, () => { called++; return "Nope"; }), "[object Undefined]");
  assert.equal(called, 0);
  assert.equal(objectToString({ tag: "object", brand: "Object" }, () => undefined), "[object Object]");
  assert.equal(objectToString({ tag: "object" }, () => null), "[object Object]");
  assert.equal(builtinTag({ tag: "object", brand: "Array" }), "Array");
  assert.equal(objectToString({ z: 7 }, () => undefined), "[object String]");
  assert.equal(objectToString({ tag: "boolean", value: false }, () => undefined), "[object Boolean]");
  assert.equal(objectToString({ tag: "number", value: 1 }, () => undefined), "[object Number]");
  assert.equal(objectToString({ tag: "function" }, () => undefined), "[object Function]");
  assert.equal(objectToString({ z: 11 }, () => undefined), "[object Function]");
  assert.equal(objectToString({ tag: "object", kind: 8 }, () => undefined), "[object Error]");
  assert.equal(objectToString({ tag: "object", kind: 14 }, () => undefined), "[object Arguments]");
  assert.equal(objectToString({ tag: "object", brand: "Date" }, () => undefined), "[object Date]");
  assert.equal(objectToString({ tag: "object", brand: "RegExp" }, () => undefined), "[object RegExp]");
  assert.equal(objectToString({ tag: "object", kind: 16, wrapped: { tag: "string", value: "a" } }, () => undefined), "[object String]");
});

test("array with overridden @@iterator does not report the default mode", () => {
  assert.equal(300 + arrayBuiltins.indexOf("values"), ARRAY_VALUES_BUILTIN_ID);
  const array = { tag: "object", brand: "Array", kind: 7 };
  let seen = null;
  const resolved = resolveIteratorMethod(array, (value, key) => {
    seen = key;
    return { callable: true, id: 9001 };
  });
  assert.deepEqual(seen, { kind: "symbol", id: WELL_KNOWN_ID.iterator });
  assert.deepEqual(resolved, { mode: "call-method", methodId: 9001 });
  assert.equal(resolved.kind, undefined);
  assert.notEqual(resolved.mode, "array");
  assert.equal(intrinsicIteratorFastPath(resolved.methodId, "Array"), null);
  const intrinsic = resolveIteratorMethod(array, () => ({ callable: true, id: ARRAY_VALUES_BUILTIN_ID }));
  assert.equal(intrinsic.mode, "call-method");
  assert.equal(intrinsicIteratorFastPath(intrinsic.methodId, "Array"), "array");
  assert.equal(intrinsicIteratorFastPath(PROTOCOL_BUILTINS.stringIterator, "String"), "string");
  assert.equal(ARRAY_UNSCOPABLE_NAMES.includes("with"), false);
  assert.equal(ARRAY_UNSCOPABLE_NAMES.includes("values"), true);
});

test("missing @@iterator is TypeError", () => {
  const array = { tag: "object", brand: "Array", kind: 7 };
  const missing = resolveIteratorMethod(array, () => undefined);
  assert.equal(missing.mode, "type-error");
  assert.match(missing.message, /not iterable/);
  const uncallable = resolveIteratorMethod(array, () => ({ callable: false }));
  assert.equal(uncallable.mode, "type-error");
  let called = 0;
  const nil = resolveIteratorMethod(null, () => { called++; return { callable: true, id: 1 }; });
  assert.equal(nil.mode, "type-error");
  assert.equal(called, 0);
  const undef = resolveIteratorMethod(undefined, () => ({ callable: true, id: 1 }));
  assert.equal(undef.mode, "type-error");
});

test("wgsl constants match the fixed node and builtin ids", () => {
  const wgsl = readFileSync(new URL("./symbol-protocols.wgsl", import.meta.url), "utf8");
  assert.match(wgsl, /INTEGRATION_GAPS/);
  assert.match(wgsl, /heapLimit/);
  const constants = Object.fromEntries([...wgsl.matchAll(/^const (\w+): u32 = (\d+)u;$/gm)].map(match => [match[1], Number(match[2])]));
  for (const name of WELL_KNOWN_NAMES) {
    const wgslName = `WK_${name.replace(/[A-Z]/g, letter => `_${letter}`).toUpperCase()}`;
    assert.equal(constants[wgslName], WELL_KNOWN_ID[name], wgslName);
  }
  assert.equal(constants.WK_TABLE, WELL_KNOWN_TABLE_NODE);
  assert.equal(constants.HEAP_KIND_WELL_KNOWN_TABLE, 21);
  assert.equal(constants.TAG_SYMBOL, 17);
  assert.equal(constants.TAG_BIGINT, 18);
  assert.equal(constants.BUILTIN_SYMBOL_TO_PRIMITIVE, PROTOCOL_BUILTINS.symbolToPrimitive);
  assert.equal(constants.BUILTIN_FUNCTION_HAS_INSTANCE, PROTOCOL_BUILTINS.functionHasInstance);
  assert.equal(constants.BUILTIN_ARRAY_SPECIES, PROTOCOL_BUILTINS.arraySpeciesGetter);
  assert.equal(constants.BUILTIN_STRING_ITERATOR, PROTOCOL_BUILTINS.stringIterator);
  assert.equal(constants.BUILTIN_ARRAY_VALUES, ARRAY_VALUES_BUILTIN_ID);
  assert.equal(constants.NODE_MATH, 23);
  assert.equal(constants.NODE_JSON, 25);
  for (const id of Object.values(PROTOCOL_BUILTINS)) {
    assert.equal(id >= 1100 && id <= 1149, true);
  }
  for (const name of [...wgsl.matchAll(/^fn (\w+)/gm)].map(match => match[1])) {
    const body = wgsl.slice(wgsl.indexOf(`fn ${name}`));
    const next = body.indexOf("\nfn ", 1);
    const source = next === -1 ? body : body.slice(0, next);
    const rest = source.slice(source.indexOf("{") + 1);
    assert.equal(rest.includes(`${name}(`), false, name);
  }
});
