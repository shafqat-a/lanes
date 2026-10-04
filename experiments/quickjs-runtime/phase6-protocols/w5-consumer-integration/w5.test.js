import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { parse } from "acorn";
import { fixtures, notesPath, spreadAppendSource } from "./index.js";

const REQUIRED = [
  "array-spread-elements",
  "string-spread-code-points",
  "custom-iterator-spread-get-log",
  "overridden-array-iterator",
  "for-of-break-calls-return",
  "destructuring-stops-early-calls-return",
  "destructuring-exhaustion-skips-return",
  "rest-parameter-custom-iterable",
  "null-spread-typeerror",
  "symbol-spread-typeerror",
];

test("spreadAppend opens and steps and does not pre-check iteration kind", () => {
  assert.match(spreadAppendSource, /function spreadAppendBootstrap\(array, position, iterable\)/);
  assert.match(spreadAppendSource, /const record = __lanesIteratorOpen\(iterable\)/);
  assert.match(spreadAppendSource, /const value = __lanesIteratorStep\(record\)/);
  assert.match(spreadAppendSource, /if \(value === record\) return index/);
  assert.match(spreadAppendSource, /__lanesDefine\(array, index, desc\)/);
  assert.equal(spreadAppendSource.includes("__lanesIterationKind"), false);
  assert.equal(spreadAppendSource.includes("__lanesUnsupported"), false);
  assert.equal(spreadAppendSource.includes("__lanesIteratorClose"), false);
  assert.equal(/\bcatch\s*\(/.test(spreadAppendSource), false);
});

test("each fixture is one named function and does not report unsupported", () => {
  const ids = new Set();
  assert.ok(fixtures.length >= REQUIRED.length);
  for (const fixture of fixtures) {
    assert.equal(typeof fixture.id, "string");
    assert.equal(typeof fixture.source, "string");
    assert.equal(typeof fixture.expect, "string");
    assert.equal(ids.has(fixture.id), false, fixture.id);
    ids.add(fixture.id);
    assert.equal(fixture.source.includes("__lanesUnsupported"), false, fixture.id);
    const ast = parse(fixture.source, { ecmaVersion: 2025 });
    assert.equal(ast.body.length, 1, fixture.id);
    const fn = ast.body[0];
    assert.equal(fn.type, "FunctionDeclaration", fixture.id);
    assert.equal(fn.id.name, "f", fixture.id);
    assert.equal(fn.async, false, fixture.id);
    assert.equal(fn.generator, false, fixture.id);
    const value = vm.runInNewContext(`${fixture.source}\nf();`);
    assert.equal(value, fixture.expect, fixture.id);
  }
  for (const id of REQUIRED) assert.equal(ids.has(id), true, id);
});

test("notes list every consumer and the spread close rule", () => {
  const notes = readFileSync(notesPath, "utf8");
  for (const phrase of [
    "spreadAppend",
    "for-of",
    "iterator_close",
    "destructuring",
    "OP_rest",
    "append",
    "copy_data_properties",
    "__lanesIteratorOpen",
    "does not throw",
  ]) {
    assert.equal(notes.includes(phrase), true, phrase);
  }
  assert.equal(notes.includes("__lanesIterationKind"), true);
  assert.match(notes, /spreadAppend does not call __lanesIteratorClose|does not call `__lanesIteratorClose`/);
});
