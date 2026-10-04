// Host fixtures for indexOf, lastIndexOf, includes, startsWith, and endsWith.
// Every case returns a primitive. These strings are not a GPU pass.
// Object search values are covered only for indexOf and lastIndexOf.
// includes, startsWith, and endsWith reject objects because @@match is absent;
// those differences are host-only and are not in this native-differential list.
export const stringSearchCases = [
  'function f(x) { const s = String(x); return "".indexOf.call(x, s) === 0 && "".lastIndexOf.call(x, s) === 0 && "".includes.call(x, s) === true && "".startsWith.call(x, s) === true && "".endsWith.call(x, s) === true; }',
  'function f(x) { const s = "abcd"; return "" + s.indexOf("cd", 1.2) + "," + s.indexOf("bcd", 0.9) + "," + s.lastIndexOf("bc", 2.8) + "," + s.indexOf("", 1.9) + "," + s.lastIndexOf("", 2.9) + "," + s.indexOf("", Infinity) + "," + s.lastIndexOf("", NaN) + "," + Object.is(s.indexOf("", -0.4), 0); }',
  'function f(x) { const s = "abc"; return "" + s.indexOf("a", NaN) + "," + s.indexOf("a", Infinity) + "," + s.indexOf("a", -Infinity) + "," + s.indexOf("a", undefined) + "," + s.indexOf("a", null) + "," + s.lastIndexOf("a", NaN) + "," + s.lastIndexOf("a", undefined) + "," + s.lastIndexOf("a", Infinity) + "," + s.lastIndexOf("a", -Infinity) + "," + s.lastIndexOf("b", -1.9) + "," + s.lastIndexOf("", -Infinity); }',
  'function f(x) { const s = "abc"; return s.startsWith("a", NaN) && s.startsWith("abc", -Infinity) && s.startsWith("", Infinity) && !s.startsWith("a", Infinity) && s.startsWith("bc", 1.1) && s.endsWith("c", undefined) && s.endsWith("c") && !s.endsWith("c", NaN) && s.endsWith("c", Infinity) && !s.endsWith("c", -Infinity) && s.endsWith("", 0) && s.endsWith("ab", 2) && !s.endsWith("abc", 2) && s.endsWith("", NaN) && s.includes("", Infinity) && !s.includes("a", Infinity) && s.includes("a", -Infinity) && s.includes("b", NaN) && s.includes("b", undefined); }',
  'function f(x) { const pair = "\\uD83D\\uDE00"; const s = "a" + pair + "b" + pair; return s.indexOf("\\uD83D") === 1 && s.indexOf("\\uDE00") === 2 && s.indexOf(pair) === 1 && s.indexOf(pair, 2) === 4 && s.lastIndexOf("\\uDE00") === 5 && s.lastIndexOf(pair) === 4 && s.startsWith("a\\uD83D") && s.endsWith("\\uDE00") && s.includes(pair, 2) && !s.includes("\\uDE00\\uD83D") && "\\uDE00\\uD83D".indexOf(pair) === -1 && "\\u00e9".indexOf("e\\u0301") === -1 && "e\\u0301".indexOf("\\u0301") === 1 && "\\u0000a".indexOf("\\u0000") === 0 && "\\uFFFF".endsWith("\\uFFFF"); }',
  'function f(x) { return "aaa".indexOf("aa") === 0 && "aaa".lastIndexOf("aa") === 1 && "aaa".indexOf("aa", 1) === 1 && "aaaa".lastIndexOf("aa", 2) === 2 && "aaaa".lastIndexOf("aa", 1) === 1 && "aaaa".lastIndexOf("aa", 0) === 0 && "abcbc".lastIndexOf("bc", 2) === 1 && "abcbc".lastIndexOf("bc", 3) === 3 && "abcbc".lastIndexOf("bc", 0) === -1 && "".indexOf("") === 0 && "".lastIndexOf("") === 0 && "".indexOf("a") === -1 && "".includes("") && "".startsWith("") && "".endsWith("") && "abc".indexOf("abcd") === -1 && !"abc".endsWith("abcd"); }',
  'function f(x) { return "A".indexOf("a") === -1 && "123".indexOf(23) === 1 && "true".startsWith(true) && "NaN".indexOf(NaN) === 0 && "Infinity".endsWith(Infinity) && "-Infinity".includes(-Infinity) && "null".indexOf(null) === 0 && "undefined".indexOf(undefined) === 0 && !"abc".includes(null) && "false".endsWith(false) && "abc".indexOf("c", " 2 ") === 2 && "abcd".indexOf("d", "0b11") === 3 && "abc".indexOf("c", "0x2") === 2 && "abc".indexOf("a", "") === 0 && "abc".indexOf("b", true) === 1 && "abc".lastIndexOf("c", true) === -1 && "abc".endsWith("a", true) && "zz".lastIndexOf("z", null) === 0 && "zz".indexOf("z", true) === 1; }',
  'function f(x) { return "".indexOf.call(12345, "23") === 1 && "".indexOf.call(true, "ru") === 1 && "".endsWith.call(false, "se") && "".includes.call(100.5, "00.5") && "".startsWith.call(-0, "0") && "".indexOf.call(NaN, "N") === 1 && "".startsWith.call(-Infinity, "-") && "".includes.call(-Infinity, "Infinity") && "".indexOf.call(1.25, ".") === 1; }',
  'function f(x) { const at = "".indexOf.call({ toString() { return "xyz"; }, valueOf() { return "no"; } }, "y"); const num = "".indexOf.call({ toString() { return 123; }, valueOf() { return 999; } }, "2"); const fallback = "".lastIndexOf.call({ toString() { return {}; }, valueOf() { return 12; } }, "1"); return at === 1 && num === 1 && fallback === 0; }',
  'function f(x) { let order = ""; const at = "".indexOf.call({ toString() { order += "t"; return "abca"; }, valueOf() { order += "T"; return "no"; } }, { toString() { order += "s"; return "a"; }, valueOf() { order += "S"; return "b"; } }, { valueOf() { order += "p"; return 3; }, toString() { order += "P"; return "0"; } }); return order + at; }',
  'function f(x) { let n = 0; const pos = { valueOf() { n++; return 2.2; }, toString() { n += 10; return "0"; } }; const last = "abcd".lastIndexOf("c", pos); const at = "abcd".indexOf("c", pos); let m = 0; "".indexOf.call({ toString() { m++; return "abc"; }, valueOf() { m += 10; return "z"; } }, "b"); return "" + n + ":" + last + ":" + at + ":" + m; }',
  'function f(x) { let order = ""; const pos = { valueOf() { order += "v"; return {}; }, toString() { order += "t"; return "2"; } }; const at = "abc".indexOf("c", pos); let inherited = ""; const proto = { toString() { inherited += "t"; return "b"; } }; const search = Object.create(proto); const found = "abc".indexOf(search); return order + at + ":" + inherited + found; }',
  'function f(x) { let n = 0; const ended = "abc".endsWith("c", undefined); const omitted = "".endsWith.call("abc", "abc"); const poisoned = "abc".endsWith("c", { valueOf() { n++; return 0; }, toString() { n += 10; return "3"; } }); const nan = "abc".endsWith("abc", NaN); return ended === true && omitted === true && poisoned === false && nan === false && n === 1; }',
  'function f(x) { let order = ""; try { "".startsWith.call({ toString() { order += "t"; return "abc"; }, valueOf() { order += "T"; return "no"; } }, "b", { valueOf() { order += "p"; throw x; }, toString() { order += "P"; return "1"; } }); } catch (e) { return order + (e === x ? "E" : "?"); } return order + "no"; }',
  'function f(x) { let order = ""; try { "".lastIndexOf.call({ toString() { order += "t"; return "abc"; } }, { toString() { order += "s"; throw x; }, valueOf() { order += "S"; return "a"; } }, { valueOf() { order += "p"; return 0; } }); } catch (e) { return order + (e === x ? "E" : "?"); } return "no"; }',
  'function f(x) { let order = ""; let n = 0; try { "".indexOf.call(null, { toString() { order += "s"; return "a"; } }, { valueOf() { order += "p"; return 0; } }); } catch (e) { if (e instanceof TypeError) n++; } try { "".lastIndexOf.call(undefined, { toString() { order += "s"; return "a"; } }); } catch (e) { if (e instanceof TypeError) n++; } try { "".includes.call(null, "a"); } catch (e) { if (e instanceof TypeError) n++; } try { "".startsWith.call(undefined, "a", 1); } catch (e) { if (e instanceof TypeError) n++; } try { "".endsWith.call(null, "a", { valueOf() { order += "p"; return 1; } }); } catch (e) { if (e instanceof TypeError) n++; } return order + n; }',
  'function f(x) { let n = 0; try { "".includes.call({ toString() { throw x; } }, { toString() { n++; return "a"; } }, { valueOf() { n++; return 0; } }); } catch (e) { return e === x && n === 0; } return false; }',
  'function f(x) { let order = ""; try { "".indexOf.call({ toString() { order += "t"; throw x; }, valueOf() { order += "v"; return "abc"; } }, { toString() { order += "s"; return "a"; } }); } catch (e) { if (e !== x || order !== "t") return false; } order = ""; try { "".endsWith.call("ab", "b", { valueOf() { order += "p"; throw x; }, toString() { order += "t"; return "2"; } }); } catch (e) { return e === x && order === "p"; } return false; }',
];

// One program for resumption across ToString, ToNumber, nullish rejection, and a throw.
// indexOf reads string-hint toString, then search toString, then position valueOf (1.9 -> 1).
// lastIndexOf reads the receiver again and treats NaN from valueOf as +∞.
// startsWith repeats that position valueOf. endsWith uses number-hint valueOf and a window of 2.
// The later throws stop before the next conversion.
export const stringSearchResumptionSource = `function f(x) {
  let order = "";
  const receiver = {
    toString() { order += "t"; return "abca"; },
    valueOf() { order += "T"; return "xxxx"; }
  };
  const search = {
    toString() { order += "s"; return "bc"; },
    valueOf() { order += "S"; return "no"; }
  };
  const pos = {
    valueOf() { order += "p"; return 1.9; },
    toString() { order += "P"; return "0"; }
  };
  const at = "".indexOf.call(receiver, search, pos);
  const last = "".lastIndexOf.call(receiver, "a", {
    valueOf() { order += "l"; return NaN; },
    toString() { order += "L"; return "0"; }
  });
  const started = "".startsWith.call({
    toString() { order += "u"; return "abca"; },
    valueOf() { order += "U"; return 0; }
  }, "bc", pos);
  const ended = "".endsWith.call("abca", "ab", {
    valueOf() { order += "z"; return 2; },
    toString() { order += "Z"; return "9"; }
  });
  const seen = "".includes.call("abca", "bc", NaN);
  const emptyAt = "".indexOf.call("", "", -1);
  const surrogate = "a\\uD83D\\uDE00b".indexOf("\\uD83D\\uDE00");
  let thrown = 0;
  try {
    "".indexOf.call(null, { toString() { order += "n"; return "a"; } }, { valueOf() { order += "N"; return 0; } });
  } catch (e) {
    if (e instanceof TypeError) thrown += 1;
  }
  try {
    "".lastIndexOf.call({ toString() { order += "e"; throw x; }, valueOf() { order += "E"; return "abca"; } }, { toString() { order += "s2"; return "a"; } });
  } catch (e) {
    if (e === x) thrown += 1;
  }
  try {
    "".indexOf.call(
      { toString() { order += "f"; return {}; }, valueOf() { order += "g"; return "abca"; } },
      { toString() { order += "h"; throw x; } },
      { valueOf() { order += "i"; return 0; } }
    );
  } catch (e) {
    if (e === x) thrown += 1;
  }
  return order + ":" + at + ":" + last + ":" + started + ":" + ended + ":" + seen + ":" + emptyAt + ":" + surrogate + ":" + thrown;
}`;

export const stringSearchResumptionExpected = "tsptlupzefgh:1:3:true:true:true:0:1:3";

// Uncaught completions. Host and guest both reject these on the supported path.
export const stringSearchNegativeSources = [
  'function f(x) { return "".indexOf.call(null, x); }',
  'function f(x) { return "".lastIndexOf.call(undefined, "a"); }',
  'function f(x) { return "".includes.call(null, "a"); }',
  'function f(x) { return "".startsWith.call(undefined, "a"); }',
  'function f(x) { return "".endsWith.call(null, "a", 1); }',
  'function f(x) { return "".indexOf.call({ toString() { throw x; } }, "a"); }',
  'function f(x) { return "".indexOf.call("a", { toString() { throw x; } }); }',
  'function f(x) { return "".lastIndexOf.call("a", "a", { valueOf() { throw x; } }); }',
  'function f(x) { return "".endsWith.call("ab", "b", { valueOf() { throw x; } }); }',
  'function f(x) { return "".startsWith.call({ toString() { return "ab"; } }, "a", { valueOf() { throw x; } }); }',
];
