// Phase 4 next wave, worker 5: adversarial fixtures for private methods,
// private accessors and static private brands (on top of the lead's
// phase4-class-elements.js representation: kind 33 name, 34 field, 35 brand
// keyed by [[HomeObject]]). Same record shape as phase4-class-element-cases.js.
// Fixed expectations are ES2025 results; check-phase4-next-w5.mjs re-verifies
// them with V8 (node:vm) and a private native QuickJS built from vendor/.
// Every admitted value fixture changes with input + 1.
//
// Extra record fields:
//   quickjsDeviation: string  pinned QuickJS disagrees with ES2025 (reason; none
//                             are recorded since the vendor setter-only fix).
//   setterOnlyIn / tdzRead:   regression markers (see w5RegressionCases).
//   rejectBy: 'gate' | 'kind' | 'both'  which front end rejects.

const c = (area, feature, input, expected, source, extra = {}) => Object.freeze({ area, feature, input, expected, source, ...extra });
const A = 'w5-private-methods', S = 'w5-static-private', R = 'w5-early-errors';

export const w5Cases = Object.freeze([
  c(A, 'private async method', 1, 1, `function f(x){ class A { async #a(){ return x; } } return 1; }`, { fixedAcrossInputs: true }),
  c(A, 'static private async method', 1, 1, `function f(x){ class A { static async #a(){ return x; } } return 1; }`, { fixedAcrossInputs: true }),
  c(A, 'async arrow inside a private getter', 1, 1, `function f(x){ class A { get #g(){ return async () => x; } } return 1; }`, { fixedAcrossInputs: true }),
  // Former rejection sources retained verbatim; their bodies intentionally return 1.
  c(A, 'private generator method', 1, 1, `function f(x){ class A { *#g(){ yield x; } } return 1; }`, { fixedAcrossInputs: true }),
  c(A, 'static private generator method', 1, 1, `function f(x){ class A { static *#g(){ yield x; } } return 1; }`, { fixedAcrossInputs: true }),
  c(A, 'generator function expression inside a private method', 1, 1, `function f(x){ class A { #m(){ return function*(){ yield x; }; } } return 1; }`, { fixedAcrossInputs: true }),
  c(A, 'generator function as a private field initializer', 1, 1, `function f(x){ class A { #g = function*(){ yield x; }; } return 1; }`, { fixedAcrossInputs: true }),
  // Brand installation order.
  c(A, 'brand and accessors precede public field initializers', 1, '1:2:3',
    `function f(x){ class A { a = this.#g; b = this.#m(); c = #m in this ? x + 2 : 0; get #g(){ return x; } #m(){ return x * 2; } } const o = new A(); return o.a + ':' + o.b + ':' + o.c; }`),
  c(A, 'brand precedes private field initializers', 2, '3:true',
    `function f(x){ class A { #f = this.#m() + 1; #m(){ return x; } read(){ return this.#f + ':' + (#f in this); } } return new A().read(); }`),
  c(A, 'derived brand is added right after super() returns', 3, '4:true',
    `function f(x){ class B {} class D extends B { v; constructor(){ super(); this.v = this.#m(); } #m(){ return x + 1; } static has(o){ return #m in o; } } const d = new D(); return d.v + ':' + D.has(d); }`),
  c(A, 'base constructor body already carries the brand', 4, 'm4',
    `function f(x){ class A { r; #m(){ return 'm' + x; } constructor(){ this.r = this.#m(); } } return new A().r; }`),
  c(A, 'base constructor calling a derived private method throws TypeError', 5, 'TypeError:false:5',
    `function f(x){ let seen; class B { constructor(){ seen = D.has(this); this.init(); } } class D extends B { #m(){ return 1; } init(){ this.#m(); } static has(o){ return #m in o; } } try { new D(); } catch (e) { return e.constructor.name + ':' + seen + ':' + x; } return 'no'; }`),

  // Identity, name, length, extraction.
  c(A, 'private method identity is shared per class evaluation', 6, 'true:false:false:6',
    `function f(x){ const make = () => class { #m(){} static get(o){ return o.#m; } }; const A = make(), B = make(); const a1 = new A(), a2 = new A(), b = new B(); return (A.get(a1) === A.get(a2)) + ':' + (A.get(a1) === B.get(b)) + ':' + (A.get(a1) === A.prototype.m) + ':' + x; }`),
  c(A, 'private and static private method name and length', 7, '#m:1:#sm:0:7',
    `function f(x){ class A { #m(a, b = 1, ...c){} static #sm(){} static info(o){ return [o.#m.name, o.#m.length, A.#sm.name, A.#sm.length, x].join(':'); } } return A.info(new A()); }`),
  c(A, 'extracted private method called on a foreign receiver', 8, '8:object',
    `function f(x){ class A { #m(){ return this.v + ':' + typeof this; } get(){ return this.#m; } } const fn = new A().get(); return fn.call({ v: x }); }`),
  c(A, 'extracted private method touching a private field brand-checks its receiver', 9, 'TypeError:9',
    `function f(x){ class A { #v = x; #m(){ return this.#v; } get(){ return this.#m; } } const fn = new A().get(); try { fn.call({}); } catch (e) { return e.constructor.name + ':' + fn.call(new A()); } return 'no'; }`),
  c(A, 'private method passed as a callback with thisArg', 10, '11,12,13',
    `function f(x){ class A { k = x; #add(v){ return v + this.k; } run(){ return [1, 2, 3].map(this.#add, this).join(); } } return new A().run(); }`),

  // Writes to methods and accessors.
  c(A, 'assignment to a private method throws after evaluating the RHS', 11, 'TypeError:rhs:11',
    `function f(x){ let log = []; class A { #m(){} run(){ this.#m = (log.push('rhs'), x); } } try { new A().run(); } catch (e) { return e.constructor.name + ':' + log.join() + ':' + x; } return 'no'; }`),
  c(A, 'logical assignment to a private method', 12, 'true:true:TypeError:12',
    `function f(x){ class A { #m(){} run(){ const r = []; r.push((this.#m ??= 1) === this.#m); r.push((this.#m ||= 1) === this.#m); try { this.#m &&= 1; } catch (e) { r.push(e.constructor.name); } return r.join(':'); } } return new A().run() + ':' + x; }`),
  c(A, 'destructuring into a private method throws TypeError', 13, 'TypeError:TypeError:13',
    `function f(x){ class A { #m(){} a(){ [this.#m] = [x]; } b(){ ({ k: this.#m } = { k: x }); } } const r = []; try { new A().a(); } catch (e) { r.push(e.constructor.name); } try { new A().b(); } catch (e) { r.push(e.constructor.name); } return r.join(':') + ':' + x; }`),
  c(A, 'getter-only write throws without calling the getter', 14, 'TypeError:0:14',
    `function f(x){ let calls = 0; class A { get #g(){ calls++; return 1; } run(){ this.#g = x; } } try { new A().run(); } catch (e) { return e.constructor.name + ':' + calls + ':' + x; } return 'no'; }`),
  c(A, 'getter-only compound assignment reads once then throws', 15, 'TypeError:1:15',
    `function f(x){ let calls = 0; class A { get #g(){ calls++; return 1; } run(){ this.#g += x; } } try { new A().run(); } catch (e) { return e.constructor.name + ':' + calls + ':' + x; } return 'no'; }`),
  c(A, 'setter-only read, compound and update throw without calling the setter', 16, 'TypeError,TypeError,TypeError:0:16',
    `function f(x){ let calls = 0; class A { set #s(v){ calls++; } a(){ return this.#s; } b(){ this.#s += 1; } c(){ this.#s++; } } const r = []; for (const k of ['a', 'b', 'c']) { try { new A()[k](); } catch (e) { r.push(e.constructor.name); } } return r.join() + ':' + calls + ':' + x; }`),
  c(A, 'setter assignment evaluates to the RHS, not the setter result', 17, '17:34',
    `function f(x){ class A { #raw = 0; set #s(v){ this.#raw = v * 2; return 'ignored'; } run(){ const r = (this.#s = x); return r + ':' + this.#raw; } } return new A().run(); }`),
  c(A, 'getter/setter pair update and exponent assignment order', 18, 'g,s,g,s:18:361',
    `function f(x){ const log = []; class A { #raw = x; get #v(){ log.push('g'); return this.#raw; } set #v(n){ log.push('s'); this.#raw = n; } run(){ const old = this.#v++; this.#v **= 2; return log.join() + ':' + old + ':' + this.#raw; } } return new A().run(); }`),
  c(A, 'setter declared before getter, separated by other members', 19, 'S19|G38',
    `function f(x){ class A { #raw = ''; set #p(v){ this.#raw = 'S' + v; } m(){ return 0; } #other(){} get #p(){ return this.#raw + '|G' + 2 * x; } run(){ this.#p = x; return this.#p; } } return new A().run(); }`),
  c(A, 'destructuring and for-of targets call a private setter', 20, '20,21,22',
    `function f(x){ class A { #log = []; set #v(n){ this.#log.push(n); } run(){ [this.#v] = [x]; ({ k: this.#v } = { k: x + 1 }); for (this.#v of [x + 2]); return this.#log.join(); } } return new A().run(); }`),
  c(A, 'getter runs once per read with this bound to the receiver', 21, '2:true:21',
    `function f(x){ let calls = 0, self; class A { get #g(){ calls++; self = this; return x; } run(){ return this.#g + this.#g; } } const a = new A(); const v = a.run(); return calls + ':' + (self === a) + ':' + v / 2; }`),

  // `#name in o`.
  c(A, 'private in for methods and accessors ignores the prototype chain', 22, 'true:true:false:false:false:22',
    `function f(x){ class A { #m(){} get #g(){ return 0; } static t(o){ return [#m in o, #g in o].join(':'); } static u(o){ return #m in o; } } const a = new A(); return [A.t(a), A.u(Object.create(a)), A.u(A.prototype), A.u(A), x].join(':'); }`),
  c(A, 'private in does not invoke the getter', 23, 'true:0:23',
    `function f(x){ let calls = 0; class A { get #g(){ calls++; return 1; } static t(o){ return #g in o; } } return A.t(new A()) + ':' + calls + ':' + x; }`),
  c(A, 'private in with a primitive right operand throws TypeError', 24, 'TypeError:TypeError:24',
    `function f(x){ class A { #m(){} static t(o){ return #m in o; } static s(o){ return #s in o; } static #s(){} } const r = []; try { A.t('str'); } catch (e) { r.push(e.constructor.name); } try { A.s(1); } catch (e) { r.push(e.constructor.name); } return r.join(':') + ':' + x; }`),

  c(A, 'primitive receivers fail the brand check; function objects answer false', 47, 'TypeError,TypeError,TypeError:false:true:47',
    `function f(x){ class A { #m(){ return 1; } get #g(){ return 2; } call(){ return this.#m(); } read(){ return this.#g; } static has(o){ return #m in o; } } const r = []; for (const [k, v] of [['call', 5], ['read', 'str'], ['call', undefined]]) { try { A.prototype[k].call(v); } catch (e) { r.push(e.constructor.name); } } return r.join() + ':' + A.has(function(){}) + ':' + A.has(new A()) + ':' + x; }`),
  c(A, 'function object stamped through a return override carries the brand', 48, 'true:48:false',
    `function f(x){ class Base { constructor(o){ return o; } } class S extends Base { #m(){ return x; } static call(o){ return o.#m(); } static has(o){ return #m in o; } } const fn = function(){}; new S(fn); return S.has(fn) + ':' + S.call(fn) + ':' + S.has(function(){}); }`),

  // Evaluation order of brand checks.
  c(A, 'brand check precedes argument evaluation', 25, 'TypeError::25',
    `function f(x){ const log = []; class A { #m(v){ return v; } static call(o){ return o.#m(log.push('arg')); } } try { A.call({}); } catch (e) { return e.constructor.name + ':' + log.join() + ':' + x; } return 'no'; }`),
  c(A, 'setter brand check follows RHS evaluation', 26, 'TypeError:rhs:26',
    `function f(x){ const log = []; class A { set #s(v){} static put(o){ o.#s = (log.push('rhs'), x); } } try { A.put({}); } catch (e) { return e.constructor.name + ':' + log.join() + ':' + x; } return 'no'; }`),

  // Body semantics.
  c(A, 'super property inside a private getter and setter', 27, 'B27:B28',
    `function f(x){ class B { tag(){ return 'B'; } } class D extends B { #last = ''; get #g(){ return super.tag() + x; } set #g(v){ this.#last = super.tag() + v; } run(){ this.#g = x + 1; return this.#g + ':' + this.#last; } } return new D().run(); }`),
  c(A, 'arguments object inside private methods and accessors', 28, '3:28:0',
    `function f(x){ class A { #m(){ return arguments.length + ':' + arguments[1]; } get #g(){ return arguments.length; } run(){ return this.#m(1, x, 3) + ':' + this.#g; } } return new A().run(); }`),
  c(A, 'recursive private method', 5, 120,
    `function f(x){ class A { #fact(n){ return n <= 1 ? 1 : n * this.#fact(n - 1); } run(n){ return this.#fact(n); } } return new A().run(x); }`),
  c(A, 'default parameter and arrow calling private methods', 30, '31:31',
    `function f(x){ class A { #one(){ return 1; } #m(a = this.#one() + x){ return a; } #arrow(){ return () => this.#m(); } run(){ return this.#m() + ':' + this.#arrow()(); } } return new A().run(); }`),
  c(A, 'optional chaining with private methods', 31, 'undefined:31:undefined',
    `function f(x){ class A { #m(){ return x; } static call(o){ return o?.#m(); } static ref(o){ return o?.#m; } } return A.call(null) + ':' + A.call(new A()) + ':' + A.ref(undefined); }`),
  c(A, 'nested class shadows an outer private method name', 32, 'inner32:TypeError',
    `function f(x){ class Outer { #m(){ return 'outer'; } static Inner = class { #m(){ return 'inner' + x; } static call(o){ return o.#m(); } }; } const I = Outer.Inner; let r = I.call(new I()); try { I.call(new Outer()); } catch (e) { r += ':' + e.constructor.name; } return r; }`),
  c(A, 'nested class calls the outer private method and accessor', 33, 'o33:g33',
    `function f(x){ class Outer { #m(){ return 'o' + x; } get #g(){ return 'g' + x; } static Inner = class { read(o){ return o.#m() + ':' + o.#g; } }; } return new Outer.Inner().read(new Outer()); }`),
  c(A, 'return override stamps the brand on a frozen object once', 34, 'true:m34:true:TypeError',
    `function f(x){ class Base { constructor(o){ return o; } } class S extends Base { #m(){ return 'm' + x; } static call(o){ return o.#m(); } static has(o){ return #m in o; } } const o = Object.freeze({}); new S(o); let again = ''; try { new S(o); } catch (e) { again = e.constructor.name; } return S.has(o) + ':' + S.call(o) + ':' + Object.isFrozen(o) + ':' + again; }`),
  c(A, 'brands survive collections', 35, 'true:400:35',
    `function f(x){ class A { #id; constructor(i){ this.#id = i; } #m(){ return this.#id; } static m(o){ return o.#m(); } static has(o){ return #m in o; } } const keep = new A(x); let n = 0; for (let i = 0; i < 400; i++) { const t = new A([i, 'p' + i]); if (A.has(t) && A.m(t)[0] === i) n++; } return A.has(keep) + ':' + n + ':' + A.m(keep); }`),
  c(A, 'private method on a class expression and distinct brands per evaluation', 36, 'true:false:TypeError:36',
    `function f(x){ const make = () => class { #m(){ return x; } static has(o){ return #m in o; } static call(o){ return o.#m(); } }; const A = make(), B = make(); const a = new A(); let e = ''; try { B.call(a); } catch (err) { e = err.constructor.name; } return A.has(a) + ':' + B.has(a) + ':' + e + ':' + A.call(a); }`),

  // Static private brands.
  c(S, 'Sub.#sm() from the base class body throws TypeError', 37, '38:TypeError:true:false',
    `function f(x){ class A { static #sm(v){ return v + 1; } static call(C){ return C.#sm(x); } static has(C){ return #sm in C; } } class Sub extends A {} let r = A.call(A) + ''; try { A.call(Sub); } catch (e) { r += ':' + e.constructor.name; } return r + ':' + A.has(A) + ':' + A.has(Sub); }`),
  c(S, 'inherited static method using this.#sg on a subclass throws TypeError', 38, 'S38:TypeError:TypeError',
    `function f(x){ class A { static get #sg(){ return 'S' + x; } static set #sg(v){} static read(){ return this.#sg; } static write(){ this.#sg = 1; } } class Sub extends A {} let r = A.read(); try { Sub.read(); } catch (e) { r += ':' + e.constructor.name; } try { Sub.write(); } catch (e) { r += ':' + e.constructor.name; } return r; }`),
  c(S, 'static and instance brands are distinct', 39, 'TypeError:TypeError:false:false:39',
    `function f(x){ class A { #m(){} static #sm(){} static callS(o){ return o.#sm(); } static callI(o){ return o.#m(); } static hasS(o){ return #sm in o; } static hasI(o){ return #m in o; } } const r = []; try { A.callS(new A()); } catch (e) { r.push(e.constructor.name); } try { A.callI(A); } catch (e) { r.push(e.constructor.name); } r.push(A.hasS(new A()), A.hasI(A)); return r.join(':') + ':' + x; }`),
  c(S, 'static brand precedes static fields and blocks', 40, '41:42:43',
    `function f(x){ let blk; class A { static #inc(v){ return v + 1; } static a = this.#inc(x); static b = A.#inc(this.a); static { blk = this.#inc(A.b); } } return A.a + ':' + A.b + ':' + blk; }`),
  c(S, 'extracted static private method with arbitrary this', 41, 'undefined:41:true',
    `function f(x){ class A { static #sm(v){ return typeof this + ':' + v; } static get(){ return A.#sm; } } const fn = A.get(); return fn.call(undefined, x) + ':' + (fn === A.get()); }`),
  c(S, 'super inside a static private method', 42, 'P42:Q',
    `function f(x){ class P { static n(){ return 'P'; } static q = 'Q'; } class A extends P { static #s(){ return super.n() + x + ':' + super.q; } static run(){ return A.#s(); } } return A.run(); }`),
  c(S, 'static private accessor pair with a static private field', 43, '43:44:true',
    `function f(x){ class A { static #n = 0; static get #v(){ return A.#n; } static set #v(n){ A.#n = n; } static run(){ A.#v = x; const a = A.#v; A.#v++; return a + ':' + A.#v + ':' + (#v in A); } } return A.run(); }`),
  c(S, 'static private method reachable from instance methods via the class binding', 44, 'i44',
    `function f(x){ class A { static #fmt(v){ return 'i' + v; } show(){ return A.#fmt(x); } } return new A().show(); }`),
]);

// Uncaught guest errors (outcome error:<Name>).
export const w5ErrorCases = Object.freeze([
  c(S, 'uncaught Sub.#sm()', 1, 'TypeError',
    `function f(x){ class A { static #sm(){ return x; } static call(C){ return C.#sm(); } } class Sub extends A {} return A.call(Sub); }`, { throws: true }),
  c(A, 'uncaught getter-only private write', 1, 'TypeError',
    `function f(x){ class A { get #g(){ return x; } run(){ this.#g = x; } } new A().run(); return 0; }`, { throws: true }),
  c(A, 'uncaught derived private call before super()', 1, 'ReferenceError',
    `function f(x){ class B {} class D extends B { #m(){ return x; } constructor(){ this.#m(); super(); } } new D(); return 0; }`, { throws: true }),
]);

// Regression fixtures for the two defects found by worker 5 and fixed by the
// lead (passing expectations; same oracles and packing checks as w5Cases):
//   setterOnlyIn: `#x in o` for a setter-only accessor. Fixed in
//     vendor/quickjs.c (OP_scope_in_private_field loads `#x<set>`); the check
//     asserts the packed private_in never reads a never-written slot.
//   tdzRead: a private slot read in a computed key before its element
//     definition. Fixed by program.js privateSlotLoad (b=1 on the load),
//     shader.js get case (`ins.z==0u`) and privateNameOrAbsent / privateBrand;
//     the check asserts the TDZ read is still present in the bytecode and that
//     its load is packed with b=1.
export const w5RegressionCases = Object.freeze([
  c(A, 'update expression on a private method needs function source text', 1, 'TypeError',
    `function f(x){ class A { #m(){} run(){ try { this.#m++; } catch (e) { return e.constructor.name; } return 'no'; } } return new A().run(); }`, { normative: 'TypeError' }),
  c(A, 'compound string assignment on a private method needs function source text', 1, 'TypeError',
    `function f(x){ class A { #m(){} run(){ try { this.#m += ''; } catch (e) { return e.constructor.name; } return 'no'; } } return new A().run(); }`, { normative: 'TypeError' }),

  c(A, 'setter-only private accessor in #s in o', 45, 'true:false:false:45',
    `function f(x){ class A { set #s(v){} static t(o){ return #s in o; } } return [A.t(new A()), A.t({}), A.t({ undefined: 1 }), x].join(':'); }`, { setterOnlyIn: true }),
  c(S, 'static setter-only private accessor in #s in C', 46, 'true:false:46',
    `function f(x){ class A { static set #s(v){} static t(o){ return #s in o; } } class Sub extends A {} return [A.t(A), A.t(Sub), x].join(':'); }`, { setterOnlyIn: true }),
  c(A, 'setter-only #s in o inside a nested class that shadows the name', 47, 'true:false:47',
    `function f(x){ class A { set #s(v){} static Inner = class { get #s(){ return 1; } static t(o){ return #s in o; } }; } const I = A.Inner; return [I.t(new I()), I.t(new A()), x].join(':'); }`),
  c(A, 'private method in a computed key before its definition', 50, 'false:50',
    `function f(x){ let r; class A { static [(r = (o => #m in o)({}), 'k')](){} #m(){} } return r + ':' + x; }`, { tdzRead: true }),
  c(A, 'private field in a computed key before its definition', 51, 'false:51',
    `function f(x){ let r; class A { static [(r = (o => #p in o)({}), 'k')](){} #p; } return r + ':' + x; }`, { tdzRead: true }),
  c(A, 'private field read in a computed key before its definition', 52, 'TypeError:52',
    `function f(x){ let r; class A { static [(r = (o => { try { return o.#p; } catch (e) { return e.constructor.name; } })({}), 'k')](){} #p; } return r + ':' + x; }`, { tdzRead: true }),
  c(A, 'private method call in a computed key before its definition', 53, 'TypeError:53',
    `function f(x){ let r; class A { static [(r = (o => { try { return o.#m(); } catch (e) { return e.constructor.name; } })({}), 'k')](){} #m(){} } return r + ':' + x; }`, { tdzRead: true }),
  c(A, 'private setter write in a computed key before its definition', 54, 'TypeError:54',
    `function f(x){ let r; class A { static [(r = (o => { try { o.#s = 1; } catch (e) { return e.constructor.name; } })({}), 'k')](){} set #s(v){} } return r + ':' + x; }`, { tdzRead: true }),
  c(A, 'direct private in inside a computed key before the definition', 55, 'false:55',
    `function f(x){ let r; class A { [(r = #p in {}, 'k')](){} #p = 1; } return r + ':' + x; }`, { tdzRead: true }),
  c(A, 'private field written in a computed key before its definition', 56, 'TypeError:56',
    `function f(x){ let r; class A { static [(r = (o => { try { o.#p = 1; } catch (e) { return e.constructor.name; } })({}), 'k')](){} #p; } return r + ':' + x; }`, { tdzRead: true }),
  c(A, 'private getter read in a computed key before its definition', 57, 'TypeError:57',
    `function f(x){ let r; class A { static [(r = (o => { try { return o.#g; } catch (e) { return e.constructor.name; } })({}), 'k')](){} get #g(){ return 1; } } return r + ':' + x; }`, { tdzRead: true }),
  c(A, 'computed key arrow called after the class is defined sees the brand', 58, 'true:58',
    `function f(x){ let t; class A { [(t = o => #m in o, 'k')](){} #m(){} } return t(new A()) + ':' + x; }`),
]);

// Former source-text boundaries are now positive regression fixtures above.
export const w5UnsupportedCases = Object.freeze([]);

// Must stay compiler-rejected (never silently admitted).
const r = (feature, source, rejectBy, extra = {}) => c(R, feature, 1, undefined, source, { rejectBy, ...extra });
export const w5RejectedCases = Object.freeze([
  r('private async generator method', `function f(x){ class A { async *#ag(){ yield x; } } return 1; }`, 'gate', { reason: /^Unsupported async generator class method/ }),
  r('duplicate private method', `function f(x){ class A { #m(){} #m(){} } return x; }`, 'both'),
  r('private field and method with the same name', `function f(x){ class A { #m; #m(){} } return x; }`, 'both'),
  r('duplicate private getter', `function f(x){ class A { get #a(){} get #a(){} } return x; }`, 'both'),
  r('getter, setter and a second setter', `function f(x){ class A { get #a(){} set #a(v){} set #a(v){} } return x; }`, 'both'),
  r('static getter with instance setter', `function f(x){ class A { static get #a(){} set #a(v){} } return x; }`, 'both'),
  r('instance getter with static setter', `function f(x){ class A { get #a(){} static set #a(v){} } return x; }`, 'both'),
  r('static and instance private methods with the same name', `function f(x){ class A { static #a(){} #a(){} } return x; }`, 'both'),
  r('private accessor and method with the same name', `function f(x){ class A { get #a(){} #a(){} } return x; }`, 'both'),
  r('#constructor private method', `function f(x){ class A { #constructor(){} } return x; }`, 'both'),
  r('delete of a private method reference', `function f(x){ class A { #m(){} d(){ return delete this.#m; } } return x; }`, 'both'),
  r('super private reference', `function f(x){ class B {} class A extends B { #m(){} d(){ return super.#m(); } } return x; }`, 'both'),
  r('undeclared private method call', `function f(x){ class A { d(){ return this.#nope(); } } return x; }`, 'both'),
  r('private name outside any class', `function f(x){ return x.#m(); }`, 'both'),
  r('bare private name expression', `function f(x){ class A { #m(){} d(){ return #m; } } return x; }`, 'both'),
  r('private name in an object literal method', `function f(x){ return { #m(){ return x; } }; }`, 'both'),
  r('private in as a non-leading relational operand', `function f(x){ class A { #m(){} static t(o){ return 1 + #m in o; } } return x; }`, 'both'),
  r('undeclared private name inside a nested function', `function f(x){ class A { m(){ return function(){ return this.#later; }; } } return x; }`, 'both'),
]);
