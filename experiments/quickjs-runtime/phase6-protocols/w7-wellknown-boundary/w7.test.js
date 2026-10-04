import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { arrayBuiltins } from "../../array-source.js";
import { PHASE4_FIXED_ROOTS } from "../../phase4-fixed-nodes.js";
import { globalUnimplementedNames } from "../../phase4-global.js";
import { phase3WellKnownNames } from "../../phase3-values.js";
import {
  jsonInvariant,
  propertiesToInstall,
  prototypeGapRemovals,
  symbolExposures,
} from "./patches.js";

const here = dirname(fileURLToPath(import.meta.url));
const runtime = join(here, "../..");
const shader = readFileSync(join(runtime, "shader.js"), "utf8");
const jsonSource = readFileSync(join(runtime, "json-stringify-source.js"), "utf8");
const boundary = readFileSync(join(here, "BOUNDARY.md"), "utf8");

const exposed = ["iterator", "hasInstance", "toPrimitive", "toStringTag"];

test("init loop installs only the four well-known Symbol data properties", () => {
  const loops = shader.split("for(var i=0u;i<15u;i++){");
  assert.equal(loops.length, 3);
  const install = loops[2].slice(0, loops[2].indexOf("dataProperty(l,symbolProto"));
  const names = [...install.matchAll(/phase3WellKnownNames\.indexOf\('([A-Za-z]+)'\)/g)].map(match => match[1]);
  assert.deepEqual(names, exposed);
  assert.equal(install.includes("dataProperty(l,symbolCtor"), true);
  assert.equal((install.match(/dataProperty\(/g) || []).length, 1);
  const gap = "phase3WellKnownNames.filter(name=>!['iterator','hasInstance','toPrimitive','toStringTag'].includes(name))";
  assert.equal(shader.includes(gap), true);
  assert.deepEqual([...symbolExposures], exposed);
  for (const name of phase3WellKnownNames) {
    if (!exposed.includes(name)) assert.equal(symbolExposures.includes(name), false);
  }
});

test("JSON stringify does not pass includeSymbols true", () => {
  assert.equal(jsonSource.includes("__lanesOwnKeys(item,true)"), true);
  assert.equal(jsonSource.includes("includeSymbols"), false);
  assert.equal(shader.includes("let includeSymbols=id==140u&&!truth(b);return ownKeys(l,original,enumerableOnly,includeSymbols);"), true);
  assert.equal(shader.includes("if(includeSymbols){"), true);
  assert.equal(shader.includes("if(includeSymbols&&(!enumerableOnly||(node.marked&4u)!=0u)){symbolCount++;}"), true);
  assert.equal(jsonInvariant.explanation.includes("__lanesOwnKeys(item,true)"), true);
  assert.equal(jsonInvariant.explanation.includes("includeSymbols"), true);
  assert.equal(jsonInvariant.assertJsonOmitsSymbolKeys(jsonSource), true);
  assert.equal(jsonInvariant.assertJsonOmitsSymbolKeys(shader), true);
  assert.throws(() => jsonInvariant.assertJsonOmitsSymbolKeys("const names=__lanesOwnKeys(item,false);"), /enumerable strings only/);
  assert.throws(() => jsonInvariant.assertJsonOmitsSymbolKeys("let includeSymbols=id==140u&&truth(b);if(includeSymbols){"), /includeSymbols true/);
});

test("BOUNDARY.md names every phase3 well-known symbol and the required gaps", () => {
  for (const name of phase3WellKnownNames) {
    assert.equal(boundary.includes(name), true, name);
  }
  for (const name of ["metadata", "RegExp", "Map", "Set", "Promise", "Proxy", "Iterator"]) {
    assert.equal(boundary.includes(name), true, name);
  }
  assert.equal(boundary.includes("status 6"), true);
  assert.equal(boundary.includes("includeSymbols=id==140u&&!truth(b)"), true);
  assert.equal(globalUnimplementedNames.includes("Iterator"), true);
  assert.equal(globalUnimplementedNames.includes("RegExp"), true);
  assert.equal(PHASE4_FIXED_ROOTS.includes(77), true);
  assert.equal(PHASE4_FIXED_ROOTS.includes(78), true);
  assert.equal(PHASE4_FIXED_ROOTS.includes(79), true);
});

test("prototypeGap removals are the iterator and hasInstance lines only", () => {
  assert.equal(prototypeGapRemovals.length, 2);
  for (const line of prototypeGapRemovals) {
    assert.equal(shader.includes(line), false, line);
    assert.equal(line.includes("id==26u"), false);
  }
  const kept = "if(id==26u){return ${phase3WellKnownNames.filter(name=>!['iterator','hasInstance','toPrimitive','toStringTag'].includes(name))";
  assert.equal(shader.includes(kept), true);
  assert.equal(prototypeGapRemovals.some(line => line.includes("id==26u")), false);
  assert.equal(shader.includes("if(id==47u){return field(l,key,"), true);
});

test("propertiesToInstall matches the allow-list and flag bits", () => {
  assert.equal(shader.includes("states[l].heap[property].marked=flags<<1u;"), true);
  assert.equal(shader.includes("boolean((flags&1u)!=0u)"), true);
  assert.equal(shader.includes("boolean((flags&2u)!=0u)"), true);
  assert.equal(shader.includes("boolean((flags&4u)!=0u)"), true);
  assert.equal(shader.includes("states[l].heap[property].marked=10u;"), true);
  assert.equal(300 + arrayBuiltins.indexOf("values"), 334);
  assert.equal(shader.includes("if(id==155u)"), true);
  assert.equal(shader.includes("if(tagValue.z==7u)"), true);

  const by = (node, keyNode) => propertiesToInstall.find(item => item.node === node && item.keyNode === keyNode && item.builtinId != null);
  assert.deepEqual(by(2, 34), { node: 2, keyNode: 34, builtinId: 334, flags: 5 });
  assert.deepEqual(by(20, 34), { node: 20, keyNode: 34, builtinId: 1103, flags: 5 });
  assert.deepEqual(by(3, 32), { node: 3, keyNode: 32, builtinId: 1101, flags: 0 });
  assert.deepEqual(by(77, 34), { node: 77, keyNode: 34, builtinId: 2463, flags: 5 });
  const nexts = propertiesToInstall.filter(item => item.key === "next");
  assert.deepEqual(nexts.map(item => [item.node, item.builtinId, item.flags, item.keyNode]), [[78, 2460, 5, null], [79, 2461, 5, null]]);
  const tags = propertiesToInstall.filter(item => item.dataString);
  assert.deepEqual(tags, [
    { node: 78, keyNode: 42, builtinId: null, flags: 4, dataString: "Array Iterator" },
    { node: 79, keyNode: 42, builtinId: null, flags: 4, dataString: "String Iterator" },
  ]);
  assert.equal(propertiesToInstall.some(item => item.node === 26), false);
  assert.equal((5 & 1) !== 0 && (5 & 2) === 0 && (5 & 4) !== 0, true);
  assert.equal(5 << 1, 10);
  assert.equal((4 & 1) === 0 && (4 & 2) === 0 && (4 & 4) !== 0, true);
});
