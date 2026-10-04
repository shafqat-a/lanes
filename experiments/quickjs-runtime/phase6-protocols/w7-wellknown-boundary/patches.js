// Allow-list for other workers in this job. Do not delete a prototypeGap
// unless the protocol is in this list. match/species/etc. stay gaps on node 26.
//
// dataProperty flags (shader.js): marked = flags << 1.
// bit0 writable, bit1 enumerable, bit2 configurable
// (descriptorObject tests flags&1u / flags&2u / flags&4u).
// Array methods set marked=10, which is flags 5 (writable, not enumerable, configurable).
// flags 4 is configurable only (same as @@toStringTag / Symbol.prototype[@@toPrimitive]).

export const prototypeGapRemovals = Object.freeze([
  "  if((id==2u||id==20u)&&key==(0x60000000u|${PHASE3_NODES.iterator}u)){return true;}",
  "  if(id==3u&&key==(0x60000000u|${phase3HasInstanceNode}u)){return true;}",
]);

// keyNode is the well-known cell when the key is a symbol. String keys use keyNode null and key.
// dataString entries are @@toStringTag data properties, not builtins. objectMethod id 155
// already returns "[object " + tag + "]" when the tag value is a string (tag 7).
// "next", "Array Iterator", and "String Iterator" are appended FIELDS names.
// Nodes 77..79 are initialized in place and are GC roots (phase4-fixed-nodes.js).
// 66..73 and 74..76 are reserved elsewhere and are not initialized here.
// 77 is %IteratorPrototype%, not the Iterator global.
export const propertiesToInstall = Object.freeze([
  Object.freeze({ node: 2, keyNode: 34, builtinId: 334, flags: 5 }),
  Object.freeze({ node: 20, keyNode: 34, builtinId: 1103, flags: 5 }),
  Object.freeze({ node: 3, keyNode: 32, builtinId: 1101, flags: 0 }),
  Object.freeze({ node: 77, keyNode: 34, builtinId: 2463, flags: 5 }),
  Object.freeze({ node: 78, keyNode: null, key: "next", builtinId: 2460, flags: 5 }),
  Object.freeze({ node: 79, keyNode: null, key: "next", builtinId: 2461, flags: 5 }),
  Object.freeze({ node: 78, keyNode: 42, builtinId: null, flags: 4, dataString: "Array Iterator" }),
  Object.freeze({ node: 79, keyNode: 42, builtinId: null, flags: 4, dataString: "String Iterator" }),
]);

// Only these well-known names are data properties of Symbol (node 26).
// Order matches the init-loop condition in shader.js.
export const symbolExposures = Object.freeze(["iterator", "hasInstance", "toPrimitive", "toStringTag"]);

// JSON.stringify key enumeration must keep symbol keys omitted.
// Filter: json-stringify-source.js calls __lanesOwnKeys(item, true) (builtin 140).
// shader.js objectMethod: includeSymbols=id==140u&&!truth(b), so a truthy second
// argument forces includeSymbols false. ownKeys counts and writes symbol keys
// only when includeSymbols is true. Reflect.ownKeys (1051) passes true on a
// different call; that is not the stringify path. Do not flip this filter.
export function assertJsonOmitsSymbolKeys(sourceText) {
  if (typeof sourceText !== "string" || sourceText.length === 0) {
    throw new TypeError("assertJsonOmitsSymbolKeys expects source text");
  }
  const problems = [];
  const calls = sourceText.match(/__lanesOwnKeys\s*\([^)]*\)/g) || [];
  const dispatch = /let includeSymbols=id==140u&&!truth\(b\);/.test(sourceText);
  const passesTrue = /includeSymbols\s*=\s*true/.test(sourceText) || /includeSymbols=id==140u&&truth\(b\)/.test(sourceText);
  if (calls.length === 0 && !dispatch && !passesTrue) {
    problems.push("no JSON key filter: expected __lanesOwnKeys(item,true) or includeSymbols=id==140u&&!truth(b)");
  }
  for (const call of calls) {
    if (call !== "__lanesOwnKeys(item,true)") {
      problems.push("stringify key enumeration is not enumerable strings only: " + call);
    }
  }
  if (dispatch && !sourceText.includes("if(includeSymbols){")) {
    problems.push("ownKeys emits symbol keys without an includeSymbols guard");
  }
  if (passesTrue) problems.push("stringify path can pass includeSymbols true");
  if (problems.length > 0) {
    throw new Error("JSON symbol-key invariant failed: " + problems.join("; "));
  }
  return true;
}

export const jsonInvariant = Object.freeze({
  explanation: "JSON.stringify lists object keys with __lanesOwnKeys(item,true) in json-stringify-source.js (serialize). Builtin 140 is __lanesOwnKeys. shader.js sets includeSymbols=id==140u&&!truth(b), so that true argument forces includeSymbols false. ownKeys increments symbolCount and writes symbol keys only under if(includeSymbols). Symbol keys stay omitted. Do not pass includeSymbols true for stringify, and do not enumerate symbol keys.",
  assertJsonOmitsSymbolKeys,
});
