// Host fixtures for String.prototype.concat, substring, and Annex B substr.
// These strings are not a GPU pass. Results are primitives so a realm can
// compare them. Native methods are the oracle. BigInt and Symbol programs are
// host-only: the compiler does not admit those literals here.

export const stringExtractKnown = Object.freeze([
  ["concat", "ab", [], "ab"],
  ["concat", "a", ["b", "c"], "abc"],
  ["concat", "a", ["b", 1, null, undefined, true, false], "ab1nullundefinedtruefalse"],
  ["concat", -0, [-0], "00"],
  ["concat", "", ["", ""], ""],
  ["concat", 1.25, ["x"], "1.25x"],
  ["substring", "abcd", [3, 1], "bc"],
  ["substring", "abcd", [-2], "abcd"],
  ["substring", "abcd", [1, undefined], "bcd"],
  ["substring", "abcd", [undefined, 1], "a"],
  ["substring", "abcd", [1, null], "a"],
  ["substring", "abcd", [NaN, 2], "ab"],
  ["substring", "abcd", [Infinity, 2], "cd"],
  ["substring", "abcd", [-Infinity, NaN], ""],
  ["substring", "abcd", [1.9, 3.2], "bc"],
  ["substring", "abcd", [-10, 1], "a"],
  ["substring", "abcd", [10, 2], "cd"],
  ["substring", "abcd", [2, 2], ""],
  ["substring", "abcd", [10, 100], ""],
  ["substring", "", [0, 1], ""],
  ["substr", "abcd", [-2], "cd"],
  ["substr", "abcd", [-2, 1], "c"],
  ["substr", "abcd", [-2, 2], "cd"],
  ["substr", "abcd", [-10, 2], "ab"],
  ["substr", "abcd", [1, undefined], "bcd"],
  ["substr", "abcd", [1], "bcd"],
  ["substr", "abcd", [1, 0], ""],
  ["substr", "abcd", [1, -1], ""],
  ["substr", "abcd", [1, NaN], ""],
  ["substr", "abcd", [1, Infinity], "bcd"],
  ["substr", "abcd", [1, -Infinity], ""],
  ["substr", "abcd", [-Infinity, 2], "ab"],
  ["substr", "abcd", [Infinity, 1], ""],
  ["substr", "abcd", [-1.9, 1.2], "d"],
  ["substr", "abcd", [1.9, 2.2], "bc"],
  ["substr", "abcd", [-2.2, 1.8], "c"],
  ["substr", "abcd", [10, 5], ""],
  ["substr", "abcd", [-3, 10], "bcd"],
  ["substring", "a\uD83D\uDE00b", [1, 2], "\uD83D"],
  ["substring", "a\uD83D\uDE00b", [1, 3], "\uD83D\uDE00"],
  ["substr", "a\uD83D\uDE00b", [2, 1], "\uDE00"],
  ["concat", "\u0000", ["\uFFFF"], "\u0000\uFFFF"],
  ["concat", "e\u0301", ["\u00e9"], "e\u0301\u00e9"],
].map(row => Object.freeze(row)));

export const stringExtractCases = [
  'function f(x) { const s = "abcd"; return s.concat() + "|" + s.concat("Z", x, null) + "|" + s.substring(3, 1) + "|" + s.substring(-2) + "|" + s.substr(-2, 1) + "|" + s.substr(-2); }',
  'function f(x) { const s = "abcd"; return s.substring(1, undefined) + "|" + s.substring(undefined, 1) + "|" + s.substr(1, undefined) + "|" + s.substr(undefined, 1) + "|" + s.substring(1, null) + "|" + s.substr(1, null) + "|" + s.substring(NaN, 2) + "|" + s.substring(Infinity, 2) + "|" + s.substr(1, NaN) + "|" + s.substr(1, Infinity) + "|" + s.substr(-Infinity, 2) + "|" + s.substr(1, -Infinity); }',
  'function f(x) { const s = "a\\uD83D\\uDE00b"; const pair = s.substring(1, 3); const high = s.substring(1, 2); const low = s.substr(2, 1); const joined = s.concat("\\u0000", "\\uFFFF"); return pair.length + ":" + pair.charCodeAt(0) + ":" + pair.charCodeAt(1) + ":" + high.charCodeAt(0) + ":" + low.charCodeAt(0) + ":" + joined.charCodeAt(4) + ":" + joined.charCodeAt(5) + ":" + "e\\u0301".substring(1).charCodeAt(0) + ":" + "\\u00e9".substr(0, 1).charCodeAt(0); }',
  'function f(x) { const s = "abcd"; return s.substring(" 2 ", "0x10") + "|" + s.substring(true, "0x3") + "|" + s.substr("1.9", "2.2") + "|" + s.substr(false, "0b11") + "|" + s.substring("", "foo") + "|" + s.substr("0x2", "1e0"); }',
  'function f(x) { return "".concat.call(1.25, "x") + "|" + "".concat.call(true, false) + "|" + "".concat.call(-0, -0) + "|" + "".substring.call(100, 1, 3) + "|" + "".substr.call(false, 1, 2) + "|" + "".concat.call(-Infinity, 0); }',
  'function f(x) { const box = new String("abcd"); return box.concat("Z") + "|" + "".substring.call(box, 3, 1) + "|" + "".substr.call(box, -2, 2); }',
  'function f(x) { let n = 0; const receiver = { toString() { n += 1; return "abca"; }, valueOf() { n += 10; return "NO"; } }; const arg = { toString() { n += 1; return "YZ"; }, valueOf() { n += 10; return 0; } }; const text = "".concat.call(receiver, arg, "-"); const cut = "".substring.call(receiver, { valueOf() { n += 1; return 1.9; }, toString() { n += 10; return "0"; } }, { valueOf() { n += 1; return 3.2; }, toString() { n += 10; return "9"; } }); return n + ":" + text + ":" + cut; }',
  'function f(x) { const box = { value: "abcd", toString() { return this.value; }, valueOf() { return "WRONG"; } }; const start = { valueOf() { box.value = "ZZZZ"; return 1.9; }, toString() { return "0"; } }; const end = { valueOf() { box.value = "YYYY"; return 3.2; }, toString() { return "9"; } }; const cut = "".substring.call(box, start, end); const again = { value: "abcd", toString() { return this.value; } }; const arg = { toString() { again.value = "NO"; return "Z"; } }; return cut + "|" + "".concat.call(again, arg) + "|" + again.value; }',
  'function f(x) { let n = 0; const tail = "abcd".substring(1, undefined); const omitted = "abcd".substr(1); const poisoned = "abcd".substring({ valueOf() { n += 1; return 1; }, toString() { n += 10; return "0"; } }, undefined); const counted = "abcd".substr(1, undefined); const read = "abcd".substr({ valueOf() { n += 1; return -2.2; }, toString() { n += 10; return "0"; } }, { valueOf() { n += 1; return 1.8; }, toString() { n += 10; return "9"; } }); return n + ":" + tail + ":" + omitted + ":" + poisoned + ":" + counted + ":" + read; }',
  'function f(x) { let order = ""; const object = { get toString() { order += "g"; return function () { order += "c"; return "XY"; }; }, get valueOf() { order += "v"; return function () { order += "d"; return "NO"; }; } }; const text = "".concat.call(object, "z"); const start = { get valueOf() { order += "a"; return function () { order += "b"; return 1.2; }; }, get toString() { order += "A"; return function () { return "0"; }; } }; const cut = "abcd".substring(start, 3); return order + ":" + text + ":" + cut; }',
  'function f(x) { const proto = { toString() { return "abca"; }, valueOf() { return "NO"; } }; const receiver = Object.create(proto); const found = "".substr.call(receiver, 1, 2); const bare = Object.create(null); bare.toString = function () { return "ok"; }; return found + "|" + "".concat.call(bare, "!"); }',
  'function f(x) { let order = ""; try { "".concat.call(null, { toString() { order += "a"; return "x"; } }); } catch (e) { if (e instanceof TypeError) order += "N"; } try { "".substring.call(undefined, { valueOf() { order += "b"; return 1; } }); } catch (e) { if (e instanceof TypeError) order += "U"; } try { "".substr.call({ toString() { order += "t"; throw x; }, valueOf() { order += "v"; return "ab"; } }, { valueOf() { order += "p"; return 0; } }); } catch (e) { if (e === x) order += "E"; } return order; }',
  'function f(x) { let order = ""; try { "".substring.call("abcd", { valueOf() { order += "s"; throw x; }, toString() { order += "S"; return "1"; } }, { valueOf() { order += "e"; return 3; } }); } catch (e) { if (e !== x || order !== "s") return "bad-start"; } order = ""; try { "".substr.call("abcd", { valueOf() { order += "s"; return 1; } }, { valueOf() { order += "n"; throw x; }, toString() { order += "N"; return "1"; } }); } catch (e) { return e === x && order === "sn"; } return "no"; }',
  'function f(x) { const parts = ["b", 2, "c", null, true]; let text = "a"; for (let i = 0; i < parts.length; i++) text = text.concat(parts[i]); const swapped = "abcbc".substring(4, 1); const rest = "abcbc".substr(-3, 2); return text + "|" + swapped + "|" + rest + "|" + "".concat.length + "," + "".substring.length + "," + "".substr.length; }',
  'function f(x) { return `p${x}q`; }',
  'function f(x) { let n = 0; const piece = { toString() { n += 1; return "Z"; }, valueOf() { n += 10; return "NO"; } }; return n + ":" + `a${piece}b${piece}c`; }',
  'function f(x) { const s = `A\\uD83D${x}\\uDE00`; return s.charCodeAt(1) + ":" + s.substring(2, 2 + String(x).length) + ":" + s.charCodeAt(s.length - 1) + ":" + s.substr(1, 1).charCodeAt(0); }',
  'function f(x) { return "ab".concat("c", x) === "abc" + x && "abcd".substring(3, 1) === "bc" && "abcd".substr(-2, 1) === "c" && "abcd".substring(1, undefined) === "bcd" && "abcd".substr(1, -1.2) === ""; }',
];

// One program for single-instruction resumption. Order is concat receiver then
// argument ToString (ts), substring receiver and both indexes (tab), substr
// start then length (nc), a toString getter (gu), then throws e, qr, and G.
// Input 17 is the pinned oracle in stringExtractResumptionExpected.
export const stringExtractResumptionSource = `function f(x) {
  let order = "";
  const receiver = {
    toString() { order += "t"; return "abca"; },
    valueOf() { order += "T"; return "xxxx"; }
  };
  const piece = {
    toString() { order += "s"; return "YZ"; },
    valueOf() { order += "S"; return 0; }
  };
  const start = {
    valueOf() { order += "a"; return 1.9; },
    toString() { order += "A"; return "0"; }
  };
  const end = {
    valueOf() { order += "b"; return 3.2; },
    toString() { order += "B"; return "9"; }
  };
  const joined = "".concat.call(receiver, piece, "-", x);
  const cut = "".substring.call(receiver, start, end);
  const tail = "".substr.call("abca", {
    valueOf() { order += "n"; return -2.2; },
    toString() { order += "N"; return "0"; }
  }, {
    valueOf() { order += "c"; return 1.8; },
    toString() { order += "C"; return "9"; }
  });
  const boxed = Object.create({
    get toString() { order += "g"; return function () { order += "u"; return "abca"; }; },
    valueOf() { order += "U"; return 0; }
  });
  const viaGetter = "".substring.call(boxed, 1, 3);
  const rest = "abca".substr(1, undefined);
  const swapped = "abca".substring(3, 1);
  const whole = "abca".substring(0, undefined);
  const emptyLen = "abca".substr(1, -1.2);
  const pair = "a\\uD83D\\uDE00b".substring(1, 3);
  const lone = "a\\uD83D\\uDE00b".substr(2, 1);
  let thrown = 0;
  try {
    "".concat.call(null, { toString() { order += "z"; return "no"; } });
  } catch (e) {
    if (e instanceof TypeError) thrown += 1;
  }
  try {
    "".substring.call({
      toString() { order += "e"; throw x; },
      valueOf() { order += "E"; return "ab"; }
    }, { valueOf() { order += "p"; return 0; } });
  } catch (e) {
    if (e === x) thrown += 1;
  }
  try {
    "".substr.call("abca", {
      valueOf() { order += "q"; return 1; },
      toString() { order += "Q"; return "0"; }
    }, {
      valueOf() { order += "r"; throw x; },
      toString() { order += "R"; return "1"; }
    });
  } catch (e) {
    if (e === x) thrown += 1;
  }
  try {
    "".concat.call({
      get toString() { order += "G"; throw x; },
      valueOf() { order += "V"; return "no"; }
    }, { toString() { order += "h"; return "no"; } });
  } catch (e) {
    if (e === x) thrown += 1;
  }
  return order + ":" + joined + ":" + cut + ":" + tail + ":" + viaGetter + ":" + rest + ":" + swapped + ":" + whole + ":" + emptyLen + ":" + pair + ":" + lone + ":" + thrown;
}`;

export const stringExtractResumptionExpected = "tstabncgueqrG:abcaYZ-17:bc:c:bc:bca:bc:abca::\uD83D\uDE00:\uDE00:4";

// The GPU harness steps this program one instruction at a time.
export const stringExtractResumptionBudget = 1;

export const stringExtractNegativeSources = [
  'function f(x) { return "".concat.call(null, "a"); }',
  'function f(x) { return "".concat.call(undefined); }',
  'function f(x) { return "".substring.call(null, 0, 1); }',
  'function f(x) { return "".substr.call(undefined, 0, 1); }',
  'function f(x) { return "".concat.call({ toString() { throw x; } }, "a"); }',
  'function f(x) { return "".concat.call("a", { toString() { throw x; } }); }',
  'function f(x) { return "".substring.call("ab", { valueOf() { throw x; } }, 1); }',
  'function f(x) { return "".substr.call("ab", 0, { valueOf() { throw x; } }); }',
  'function f(x) { return `a${{ toString() { throw x; } }}b`; }',
];

// Host-only. packProgram rejects 10n (push_bigint_i32) and Symbol (unsupported
// global), so these are not compiler-parity programs. kind bigint-string:
// native ToString succeeds and the guest completion is unsupported. kind
// symbol-string, symbol-number, and bigint-number: both sides throw TypeError.
export const stringExtractHostGapSources = Object.freeze([
  ["bigint-string", 'function f(x) { return "".concat.call(10n, "a"); }'],
  ["bigint-string", 'function f(x) { return "a".concat(10n); }'],
  ["bigint-string", 'function f(x) { return "".substring.call(10n, 0, 1); }'],
  ["bigint-string", 'function f(x) { return "".substr.call(1n, 0, 1); }'],
  ["bigint-string", 'function f(x) { return "".concat.call({ toString() { return 2n; }, valueOf() { return "no"; } }, "x"); }'],
  ["bigint-number", 'function f(x) { return "abc".substring(1n, 2); }'],
  ["bigint-number", 'function f(x) { return "abc".substr(0, 1n); }'],
  ["symbol-string", 'function f(x) { return "".concat.call(Symbol("s"), "a"); }'],
  ["symbol-string", 'function f(x) { return "a".concat(Symbol("s")); }'],
  ["symbol-string", 'function f(x) { return "".substring.call(Symbol("s"), 0, 1); }'],
  ["symbol-string", 'function f(x) { return "".concat.call({ toString() { return Symbol("s"); }, valueOf() { return "no"; } }); }'],
  ["symbol-number", 'function f(x) { return "abc".substring(Symbol("s"), 1); }'],
  ["symbol-number", 'function f(x) { return "abc".substr(0, Symbol("s")); }'],
].map(([kind, source]) => Object.freeze({ kind, source })));

// Builtins must copy spans through private intrinsics, never mutable .slice.
stringExtractCases.push(
  'function f(x){String.prototype.slice=function(){throw x;};return "abcd".substring(1,3)+":"+"abcd".substr(-2,1)+":"+x;}',
  'function f(x){Object.defineProperty(String.prototype,"slice",{get:function(){throw x;},configurable:true});return "abcd".substring(3,1)+":"+"abcd".substr(1,2)+":"+x;}',
  'function f(x){return String.prototype.concat.call(new String("a"),x)+":"+new String("abcd").substring(1,3)+":"+new String("abcd").substr(-2,1);}'
);

// Former pinned-compiler gaps, fixed by the Phase 4 to_string template
// lowering: substitutions ignore mutable public concat and each ToString runs
// before the next substitution is evaluated. Fixed ES2025 expectations.
export const stringExtractCompilerGapCases = Object.freeze([
  {feature:'template-concat-override',source:'function f(x){String.prototype.concat=function(){return "wrong";};return `a${x}b`;}',input:17,expected:'a17b'},
  {feature:'template-conversion-order',source:'function f(x){let log="";let a={toString(){log+="a";return x;}};function next(){log+="b";return x+1;}let value=`${a}${next()}`;return log+":"+value;}',input:17,expected:'ab:1718'},
]);

// Untagged template fixtures (formerly compiler-rejected) stay in the
// positive and negative lists. Tagged templates (formerly compiler-rejected)
// are admitted since the Phase 4 tagged-template lowering and run as ordinary
// positive programs.
export const stringExtractTaggedTemplateSources = Object.freeze([
  'function f(x){return String.raw`a${x}`.substring(1);}',
]);
stringExtractCases.push(...stringExtractTaggedTemplateSources);
// Compatibility alias (phase4-template-tagged-cases.js taggedTemplateFormerlyRejected):
// these sources are now ADMITTED, not rejected.
export const stringExtractCompilerRejectedSources = stringExtractTaggedTemplateSources;

// Former unsupported Array coercions now use phase5 Array toString/join.
export const stringExtractArrayBoundaryCases = Object.freeze([
 {source:'function f(x){return "".concat.call([1,2],3);}',input:17,expected:'1,23',reason:'Array.prototype.toString/join'},
 {source:'function f(x){return "".substring.call([1,2,3],1,4);}',input:17,expected:',2,',reason:'Array.prototype.toString/join'},
]);

stringExtractCases.push(...stringExtractArrayBoundaryCases.map(item => item.source));
export const stringExtractUnsupportedCases = Object.freeze([]);
