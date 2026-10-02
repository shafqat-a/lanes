export const stringCases = [
  ['string identity', 'function f(x) { return x; }', ['', 'hello', '😀', '\ud800', 'a\0b', 'e\u0301']],
  ['concatenation', 'function f(x) { return "<" + x + ">"; }', ['', 'hello', '😀', '\ud800']],
  ['length', 'function f(x) { return x.length; }', ['', 'hello', '😀', '\ud800', 'e\u0301']],
  ['code unit', 'function f(x) { return x.charCodeAt(0); }', ['', 'A', '😀', '\ud800']],
  ['code unit index coercion', 'function f(x) { return "abc".charCodeAt(x); }', [NaN, null, undefined, -0, -0.5, -1, 0.5, 1.9, 3, Infinity, -Infinity]],
  ['character', 'function f(x) { return "😀ab".charAt(x); }', [-1, 0, 1, 2, 4, NaN]],
  ['index', 'function f(x) { return "abc"[x]; }', [-0, 0, 1, 1.1, -1, 4294967295, '1', '01', 'length', null, undefined]],
  ['string strict equality', 'function f(x) { return (x + "") === x; }', ['', 'a', '😀']],
  ['string loose equality', 'function f(x) { return x == (x + "") && x != null; }', ['', 'a']],
  ['string ordering', 'function f(x) { return x < "b"; }', ['', 'a', 'b', 'ba', '\ud800', '😀']],
  ['string ordering inclusive', 'function f(x) { return x >= "b"; }', ['', 'a', 'b', 'ba', '\ud800']],
  ['string truthiness', 'function f(x) { return !x; }', ['', 'a']],
  ['string closure and throw', 'function f(x) { function make(s) { return () => s + "!"; } const get = make(x); try { throw get(); } catch(e) { return e; } }', ['', 'hi']],
  ['string return survives collection', 'function f(x) { function make(s) { return () => s; } function get() { try { return x + "!"; } finally { for(let i = 0; i < 600; i++) { make("temporary" + "value"); } } } return get(); }', ['kept']],
  ['string input survives collection', 'function f(x) { let s = ""; for(let i = 0; i < 600; i++) { s = x + "!"; } return s; }', ['root']],
  ['function length', 'function f(x) { function g(a,b,c) { return a; } return g.length; }', [0]],
  ['method error evaluation order', 'function f(x) { let y = 0; try { null.charAt(y++); } catch(e) { return y; } }', [0]],
  ['strict named function binding', 'function f(x) { "use strict"; const g = function inner() { inner = 0; return 1; }; try { return g(); } catch(e) { return 2; } }', [0]],
];
export async function runStringConformance(vm, signal) {
  let checked = 0;
  for (const [name, source, inputs] of stringCases) {
    const native = new Function(`return (${source})`)();
    const result = await vm.run(vm.compile(source), inputs, { signal, budget: 4096 });
    inputs.forEach((value, i) => { if (!Object.is(result.values[i], native(value))) throw new Error(`String mismatch: ${name}, input ${i}`); checked++; });
  }
  return { programs: stringCases.length, checked };
}
