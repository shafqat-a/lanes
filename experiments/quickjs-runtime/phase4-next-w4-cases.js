// Phase 4 next wave, worker 4: adversarial fixtures for private instance /
// static fields and `#x in o`, on top of the lead's phase4-class-elements.js
// representation (kind 33 private name, kind 34 field, kind 35 brand, chained
// from a kind 2/8 holder's value.y). Same record shape as
// phase4-class-element-cases.js. Fixed expectations are ES2025 results;
// check-phase4-next-w4.mjs re-verifies them with V8 (node:vm) and a private
// native QuickJS built from vendor/. Every admitted value fixture changes with
// input + 1.
//
// Extra record fields:
//   quickjsDeviation: string  pinned QuickJS disagrees with ES2025 (reason).
//   regression: 'D1' | 'D2' | 'D3'  ordinary value fixture guarding an
//                             integrated fix (phase4-next-w4-notes.md): D1
//                             private-field function naming, D2 private-name
//                             slot read before its declaration, D3 setter-only
//                             `#s in o`. The check asserts the fix is present
//                             and that the fixture has the bytecode shape it
//                             handles.
//   gc: true                  heap-pressure fixture (forces collect() at the
//                             2048-node heap; proposed resumption/GC records).

const c = (area, feature, input, expected, source, extra = {}) => Object.freeze({ area, feature, input, expected, source, ...extra });
const K = 'w4-private-keys', B = 'w4-private-brand', T = 'w4-private-targets', N = 'w4-private-scope', G = 'w4-private-gc', S = 'w4-private-static';

export const w4Cases = Object.freeze([
  // --- Hidden storage is immune to every ordinary-key path -------------------
  c(K, 'ordinary key paths never see private fields', 1, 'q|q|{"q":1}|q|false|false|q|1',
    `function f(x){ class A { #p = x; q = 1; static p(o){ return o.#p; } } const o = new A(); let s = ''; for (const k in o) s += k; const copy = { ...o }; return [Object.keys(o).join(), Object.getOwnPropertyNames(o).join(), JSON.stringify(o), s, o.hasOwnProperty('#p'), '#p' in o, Object.keys(copy).join(), A.p(o)].join('|'); }`),
  c(K, 'object spread copy carries no private field', 2, 'false:true:TypeError:2',
    `function f(x){ class A { #p = x; static has(o){ return #p in o; } static get(o){ return o.#p; } } const o = new A(); const copy = { ...o }; let e = ''; try { A.get(copy); } catch (err) { e = err.constructor.name; } return A.has(copy) + ':' + A.has(o) + ':' + e + ':' + A.get(o); }`),
  c(K, 'sealed and non-extensible instances keep writable private fields', 3, '4:4:true:false',
    `function f(x){ class A { #v = x; bump(){ return ++this.#v; } } const a = new A(), b = new A(); Object.seal(a); Object.preventExtensions(b); return a.bump() + ':' + b.bump() + ':' + Object.isSealed(a) + ':' + Object.isExtensible(b); }`),
  c(K, 'return override adds a private field to a frozen object', 4, '4:true:k:1',
    `function f(x){ const o = Object.freeze({ k: 1 }); class B { constructor(t){ return t; } } class S extends B { #t = x; static t(o){ return o.#t; } } new S(o); return S.t(o) + ':' + Object.isFrozen(o) + ':' + Object.keys(o).join() + ':' + Object.getOwnPropertyNames(o).length; }`),
  c(K, 'return override brands a non-extensible object', 5, '10:false',
    `function f(x){ const o = Object.preventExtensions({}); class B { constructor(t){ return t; } } class S extends B { #n = x; #m(){ return this.#n * 2; } static run(o){ return o.#m(); } } new S(o); return S.run(o) + ':' + Object.isExtensible(o); }`),
  c(K, 'public field TypeError on a frozen override keeps earlier private fields only', 6, 'TypeError:true,false,6',
    `function f(x){ const o = Object.freeze({}); class B { constructor(t){ return t; } } class S extends B { #a = x; b = 1; #c = 2; static probe(o){ return (#a in o) + ',' + (#c in o) + ',' + o.#a; } } let e = ''; try { new S(o); } catch (err) { e = err.constructor.name; } return e + ':' + S.probe(o); }`),
  c(K, 'private, public and string "#x" keys are distinct', 7, '7|8|9|x,#x',
    `function f(x){ class A { #x = x; x = x + 1; ['#x'] = x + 2; read(){ return this.#x + '|' + this.x + '|' + this['#x'] + '|' + Object.keys(this).join(); } } return new A().read(); }`),
  c(K, 'private methods are not prototype own keys', 8, 'constructor,run:8',
    `function f(x){ class A { #m(){ return x; } static #s(){} get #g(){ return 0; } run(){ return this.#m(); } } return Object.getOwnPropertyNames(A.prototype).join() + ':' + new A().run(); }`),

  // --- Brand checks: get / set / in on wrong objects -------------------------
  c(B, '#x in throws TypeError for every primitive right operand', 9, '5:9',
    `function f(x){ class A { #x; static has(o){ return #x in o; } } let n = 0; for (const v of [1, 's', true, null, undefined]) { try { A.has(v); } catch (e) { if (e instanceof TypeError) n++; } } return n + ':' + x; }`),
  c(B, '#x in on functions, prototypes and the class', 10, 'truefalse,falsetrue,falsefalse,falsefalse:10',
    `function f(x){ class A { #x; static #s; static t(o){ return (#x in o) + '' + (#s in o); } } return [A.t(new A()), A.t(A), A.t(A.prototype), A.t(function(){})].join(',') + ':' + x; }`),
  c(B, 'private fields are own: never found through the prototype chain', 11, 'TypeError:TypeError:false:11',
    `function f(x){ class A { #x = 1; static g(o){ return o.#x; } static s(o){ o.#x = 2; } static h(o){ return #x in o; } } const r = []; try { A.g(Object.create(new A())); } catch (e) { r.push(e.constructor.name); } try { A.s(A.prototype); } catch (e) { r.push(e.constructor.name); } r.push(A.h(Object.create(new A()))); return r.join(':') + ':' + x; }`),
  c(B, 'private field stamped on Object.prototype is not inherited', 12, 'true:false:TypeError:12',
    `function f(x){ class B { constructor(t){ return t; } } class S extends B { #x = x; static h(o){ return #x in o; } static g(o){ return o.#x; } } new S(Object.prototype); let e = ''; try { S.g({}); } catch (err) { e = err.constructor.name; } return S.h(Object.prototype) + ':' + S.h({}) + ':' + e + ':' + S.g(Object.prototype); }`),
  c(B, 'private set on a primitive and on null throws TypeError', 13, 'TypeError,TypeError,TypeError:13',
    `function f(x){ class A { #x = 0; static s(o){ o.#x = 1; } static g(o){ return o.#x; } } const r = []; try { A.s(5); } catch (e) { r.push(e.constructor.name); } try { A.s(null); } catch (e) { r.push(e.constructor.name); } try { A.g('str'); } catch (e) { r.push(e.constructor.name); } return r.join() + ':' + x; }`),
  c(B, 'in-operator precedence and negation', 14, 'true:true:14',
    `function f(x){ class A { #x; static t(o){ return (#x in o === true) + ':' + !(#x in {}); } } return A.t(new A()) + ':' + x; }`),

  // --- Initialization order ---------------------------------------------------
  c(B, 'reading a later private field during initialization throws TypeError', 15, 'false:TypeError:TypeError:15',
    `function f(x){ class A { #a = (#b in this); #b = x; static a(o){ return o.#a; } } class C { #c = this.#d; #d = 1; } class D { #e = this.#e; } const r = [A.a(new A())]; try { new C(); } catch (e) { r.push(e.constructor.name); } try { new D(); } catch (e) { r.push(e.constructor.name); } return r.join(':') + ':' + x; }`),
  c(B, 'brand failure on re-stamp precedes field initializers', 16, 'TypeError:1:16',
    `function f(x){ let n = 0; class B { constructor(t){ return t; } } class S extends B { #m(){} #a = ++n; } const o = {}; new S(o); let e = ''; try { new S(o); } catch (err) { e = err.constructor.name; } return e + ':' + n + ':' + x; }`),
  c(B, 'field re-stamp evaluates the initializer before throwing', 17, 'TypeError:2:17',
    `function f(x){ let n = 0; class B { constructor(t){ return t; } } class S extends B { #a = ++n; } const o = {}; new S(o); let e = ''; try { new S(o); } catch (err) { e = err.constructor.name; } return e + ':' + n + ':' + x; }`),
  c(B, 'two class evaluations stamp the same object independently', 18, '18:19:true:true',
    `function f(x){ class B { constructor(t){ return t; } } const make = v => class extends B { #t = v; static t(o){ return o.#t; } static h(o){ return #t in o; } }; const P = make(x), Q = make(x + 1); const o = {}; new P(o); new Q(o); return P.t(o) + ':' + Q.t(o) + ':' + P.h(o) + ':' + Q.h(o); }`),
  c(B, 'initializer throw leaves the earlier private field installed', 19, 'boom:true:false:19',
    `function f(x){ class B { constructor(t){ return t; } } class S extends B { #a = x; #b = (() => { throw new Error('boom'); })(); static probe(o){ return (#a in o) + ':' + (#b in o) + ':' + o.#a; } } const o = {}; let e = ''; try { new S(o); } catch (err) { e = err.message; } return e + ':' + S.probe(o); }`),
  c(B, 'private access on this before super() is a ReferenceError', 20, 'ReferenceError20',
    `function f(x){ class P {} class D extends P { #x = 1; constructor(){ let r; try { this.#x; } catch (e) { r = e.constructor.name; } super(); this.r = r; } } return new D().r + x; }`),
  c(B, 'arrow created before super() reads the field after super()', 21, 21,
    `function f(x){ class P {} class D extends P { #x = x; constructor(){ const g = () => this.#x; super(); this.v = g(); } } return new D().v; }`),

  // --- Assignment targets -----------------------------------------------------
  c(T, 'compound assignment operators on a private field', 2, '6!',
    `function f(x){ class A { #v = x; run(){ this.#v **= 2; this.#v -= 1; this.#v <<= 1; this.#v %= 7; this.#v += ''; this.#v += '!'; return this.#v; } } return new A().run(); }`),
  c(T, 'update expressions apply ToNumeric to a string field', 22, '22,number,22,22,21,number',
    `function f(x){ class A { #v = '' + x; run(){ const a = this.#v++; const b = typeof a; const c = --this.#v; const d = this.#v--; return [a, b, c, d, this.#v, typeof this.#v].join(','); } } return new A().run(); }`),
  c(T, 'array and object destructuring into private fields', 23, '23,46,24,d',
    `function f(x){ class A { #a; #b; #c; #d; run(){ [this.#a, this.#b = x * 2] = [x]; ({ p: this.#c, q: this.#d = 'd' } = { p: x + 1 }); return [this.#a, this.#b, this.#c, this.#d].join(); } } return new A().run(); }`),
  c(T, 'rest destructuring into private fields', 24, '24:2,3:24',
    `function f(x){ class A { #a; #r; #o; run(){ [this.#a, ...this.#r] = [x, 2, 3]; ({ ...this.#o } = { k: x }); return this.#a + ':' + this.#r.join() + ':' + this.#o.k; } } return new A().run(); }`),
  c(T, 'for-of and for-in heads targeting a private field', 25, '28:25:b',
    `function f(x){ class A { #v; #k; run(){ let sum = 0; for (this.#v of [1, 2, x]) sum += this.#v; for (this.#k in { a: 1, b: 2 }); return sum + ':' + this.#v + ':' + this.#k; } } return new A().run(); }`),
  c(T, 'destructuring into a foreign private field throws TypeError', 26, 'TypeError:TypeError:26',
    `function f(x){ class A { #v; static arr(o){ [o.#v] = [1]; } static obj(o){ ({ a: o.#v } = { a: 1 }); } } const r = []; try { A.arr({}); } catch (e) { r.push(e.constructor.name); } try { A.obj({}); } catch (e) { r.push(e.constructor.name); } return r.join(':') + ':' + x; }`),
  c(T, 'logical assignment operators on private fields', 27, '27,28,keep27',
    `function f(x){ class A { #n = null; #z = 0; #s = 'keep'; run(){ this.#n ??= x; this.#z ||= x + 1; this.#s &&= this.#s + x; return [this.#n, this.#z, this.#s].join(); } } return new A().run(); }`),
  c(T, 'short-circuited logical assignment never writes a getter-only accessor or method', 28, '28,28,function,TypeError:3',
    `function f(x){ let calls = 0; class A { get #g(){ calls++; return x; } #m(){} run(){ const r = [this.#g ||= 0, this.#g ??= 0, typeof (this.#m ??= 1)]; try { this.#g &&= 1; r.push('no'); } catch (e) { r.push(e.constructor.name); } return r.join() + ':' + calls; } } return new A().run(); }`),
  c(T, 'getter/setter pair under compound, update and destructuring writes', 29, 'g,s30,g,s31,s0:30',
    `function f(x){ let log = []; class A { #raw = 1; get #v(){ log.push('g'); return this.#raw; } set #v(n){ log.push('s' + n); this.#raw = n; } run(){ this.#v += x; const old = this.#v++; [this.#v] = [0]; return log.join() + ':' + old; } } return new A().run(); }`),
  c(T, 'optional chains through private names', 30, 'v30/v30/v30/3|///|TypeError',
    `function f(x){ class A { #x = 'v' + x; #m(){ return this.#x; } static t(o){ return [o?.#x, o?.#m(), o?.inner?.#x, o?.#x.length].join('/'); } static bad(o){ try { return o?.#x; } catch (e) { return e.constructor.name; } } } const a = new A(); a.inner = new A(); return A.t(a) + '|' + A.t(null) + '|' + A.bad({}); }`),
  c(T, 'calls through private fields bind this', 31, 'true:true:k31',
    `function f(x){ class A { #f = function(){ return this; }; #t = function(s, v){ return this instanceof A ? s[0] + v : 'bad'; }; run(){ return (this.#f() === this) + ':' + (this.#f?.() === this) + ':' + this.#t\`k\${x}\`; } } return new A().run(); }`,
    { regression: 'D1' }),
  c(T, 'anonymous functions in private field initializers are named by the private name', 32, '#f,#a,#c,:32',
    `function f(x){ class A { #f = function(){}; #a = () => 0; #c = class {}; #late; run(){ this.#late = function(){}; return [this.#f.name, this.#a.name, this.#c.name, this.#late.name].join() + ':' + x; } } return new A().run(); }`,
    { regression: 'D1' }),
  c(T, 'static private arrow field is named by the private name', 33, '#h:33',
    `function f(x){ class A { static #h = () => x; static n(){ return A.#h.name + ':' + A.#h(); } } return A.n(); }`,
    { regression: 'D1' }),

  // --- Scope: nesting, shadowing, closures, evaluations ----------------------
  c(N, 'nested class shadows an outer private name', 33, 'outer33:inner:TypeError:TypeError',
    `function f(x){ class Outer { #x = 'outer' + x; static Inner = class { #x = 'inner'; static read(o){ return o.#x; } }; static read(o){ return o.#x; } } const I = Outer.Inner; const r = [Outer.read(new Outer()), I.read(new I())]; try { I.read(new Outer()); } catch (e) { r.push(e.constructor.name); } try { Outer.read(new I()); } catch (e) { r.push(e.constructor.name); } return r.join(':'); }`),
  c(N, 'nested class mixes outer and inner private names', 34, 136,
    `function f(x){ class Outer { #x = x; static make(){ return new (class { #y = 2; sum(o){ return o.#x + this.#y + (#x in this ? 1000 : 100); } })(); } } return Outer.make().sum(new Outer()); }`),
  c(N, 'closures capture the private name of their own class evaluation', 35, '35:36:TypeError',
    `function f(x){ const make = v => class { #p = v; static getter(){ return o => o.#p; } }; const A = make(x), B = make(x + 1); const ga = A.getter(), gb = B.getter(); const r = [ga(new A()), gb(new B())]; try { ga(new B()); } catch (e) { r.push(e.constructor.name); } return r.join(':'); }`),
  c(N, 'a class body evaluated in a loop has a distinct brand per iteration', 36, 'TypeError:37:false',
    `function f(x){ const cs = []; for (let i = 0; i < 2; i++) cs.push(class { #m(){ return x + i; } #p; static call(o){ return o.#m(); } static has(o){ return #p in o; } }); let e = ''; try { cs[0].call(new cs[1]()); } catch (err) { e = err.constructor.name; } return e + ':' + cs[1].call(new cs[1]()) + ':' + cs[0].has(new cs[1]()); }`),
  c(N, 'static initializers and blocks reach instance private names', 37, '37:37:TypeError',
    `function f(x){ let r; class A { #v = x; static inst = new this(); static v = this.inst.#v; static { r = new A().#v; try { this.#v; } catch (e) { r += ':' + e.constructor.name; } } } return A.v + ':' + r; }`),
  c(N, '#x in from a computed key before the declaration answers false', 38, 'false:38',
    `function f(x){ let r; class A { static [(r = #x in {}, 'k')] = 1; #x; } return r + ':' + x; }`,
    { regression: 'D2' }),
  c(N, '#x in before the declaration ignores an ordinary "undefined" key', 39, 'false:39',
    `function f(x){ let r; class A { static [(r = #x in { undefined: 1 }, 'k')] = 1; #x; } return r + ':' + x; }`,
    { regression: 'D2' }),
  c(N, 'private read from a computed key before the declaration throws TypeError', 40, 'TypeError:40',
    `function f(x){ class A { static [(() => { try { return ({}).#x; } catch (e) { return e.constructor.name; } })()] = 1; #x; } return Object.keys(A).join() + ':' + x; }`,
    { regression: 'D2' }),
  c(B, 'setter-only private accessor answers #s in o by brand', 52, 'true:false:true:52',
    `function f(x){ class A { set #s(v){} static set #t(v){} static has(o){ return #s in o; } static hasT(o){ return #t in o; } } return A.has(new A()) + ':' + A.has({ undefined: 1 }) + ':' + A.hasT(A) + ':' + x; }`,
    { regression: 'D3' }),

  // --- Static privates and private storage on function objects --------------
  c(S, 'static private field on the class constructor', 41, '42:true:false:TypeError',
    `function f(x){ class A { static #count = x; static inc(){ return ++this.#count; } static has(o){ return #count in o; } } const r = [A.inc(), A.has(A), A.has(Object.create(A))]; try { A.inc.call(A.bind(null)); } catch (e) { r.push(e.constructor.name); } return r.join(':'); }`),
  c(S, 'return override stamps arrow, bound and class functions', 42, '42,42,42,true,true,false,0,0',
    `function f(x){ class B { constructor(t){ return t; } } class S extends B { #t = x; static t(o){ return o.#t; } static h(o){ return #t in o; } } class Z {} const fn = () => 0; const bound = fn.bind(null); new S(fn); new S(bound); new S(Z); return [S.t(fn), S.t(bound), S.t(Z), S.h(fn), S.h(bound), S.h(function(){}), fn.length, Object.keys(fn).length].join(); }`),
  c(S, 'return override stamps an Error object', 43, '43:m:0:true',
    `function f(x){ class B { constructor(t){ return t; } } class S extends B { #t = x; static t(o){ return o.#t; } } const e = new TypeError('m'); new S(e); return S.t(e) + ':' + e.message + ':' + Object.keys(e).length + ':' + (e instanceof TypeError); }`),
  c(S, 'return override stamps intrinsic objects (Math, Object)', 44, '44:45:false',
    `function f(x){ class B { constructor(t){ return t; } } class S extends B { #t; constructor(t, v){ super(t); this.#t = v; } static t(o){ return o.#t; } static h(o){ return #t in o; } } new S(Math, x); new S(Object, x + 1); return S.t(Math) + ':' + S.t(Object) + ':' + S.h({}); }`),
  c(S, 'static private field holds the only reference to a function', 45, 'S45',
    `function f(x){ class A { static #fn = (() => { const tag = 'S' + x; return () => tag; })(); static call(){ return A.#fn(); } } return A.call(); }`),

  // --- GC: values reachable only through private storage --------------------
  c(G, 'object graph reachable only from a private field survives collections', 46, '46,47:v46:1200',
    `function f(x){ class A { #data; constructor(n){ this.#data = { list: [n, n + 1], text: 'v' + n }; } static d(o){ return o.#data; } } const keep = new A(x); let junk = 0; for (let i = 0; i < 400; i++) { junk += [i, 'j' + i, { i }].length; } const d = A.d(keep); return d.list.join() + ':' + d.text + ':' + junk; }`,
    { gc: true }),
  c(G, 'static private value of a closure-only class survives collections', 47, 'S47:2000',
    `function f(x){ const get = (() => { class A { static #s = { v: 'S' + x }; static read(){ return A.#s.v; } } return () => A.read(); })(); let junk = 0; for (let i = 0; i < 1000; i++) { junk += [i, 'j' + i].length; } return get() + ':' + junk; }`,
    { gc: true }),
  c(G, 'linked list threaded only through private fields survives collections', 48, '868:2000',
    `function f(x){ class Node { #next; #v; constructor(v, next){ this.#v = v; this.#next = next; } static sum(n){ let s = 0; while (n) { s += n.#v; n = n.#next; } return s; } } let head = null; for (let i = 1; i <= 40; i++) head = new Node(i, head); let junk = 0; for (let i = 0; i < 1000; i++) junk += ['j' + i, i].length; return (Node.sum(head) + x) + ':' + junk; }`,
    { gc: true }),
  c(G, 'brand survives collections after the prototype is detached', 49, 'm49:true:null',
    `function f(x){ class A { #m(){ return 'm' + x; } static call(o){ return o.#m(); } static has(o){ return #m in o; } } const a = new A(); Object.setPrototypeOf(a, null); let junk = 0; for (let i = 0; i < 1000; i++) { junk += [i, 'j' + i].length; } return A.call(a) + ':' + A.has(a) + ':' + Object.getPrototypeOf(a); }`,
    { gc: true }),
  c(G, 'private names of many class evaluations stay distinct across collections', 50, '50:TypeError:50',
    `function f(x){ class B { constructor(t){ return t; } } const make = () => class extends B { #t = x; static t(o){ return o.#t; } }; const first = make(); const o = {}; new first(o); let last; for (let i = 0; i < 150; i++) last = make(); let e = ''; try { last.t(o); } catch (err) { e = err.constructor.name; } return first.t(o) + ':' + e + ':' + x; }`,
    { gc: true }),
  c(G, 'stale private name and brand ids are never reused while an instance holds them', 51, '0:51',
    `function f(x){ const make = () => class { #p = 1; #m(){} static hasP(o){ return #p in o; } static hasM(o){ return #m in o; } }; const a = new (make())(); Object.setPrototypeOf(a, null); let hits = 0; for (let i = 0; i < 150; i++) { const C = make(); if (C.hasP(a) || C.hasM(a)) hits++; } return hits + ':' + x; }`,
    { gc: true }),
]);

// Uncaught guest errors (outcome error:<Name>).
export const w4ErrorCases = Object.freeze([
  c(B, 'uncaught #x in a primitive', 1, 'TypeError',
    `function f(x){ class A { #x; static has(o){ return #x in o; } } return A.has(x); }`, { throws: true }),
  c(B, 'uncaught read of a later private field', 1, 'TypeError',
    `function f(x){ class A { #a = this.#b + x; #b = 1; } return new A(); }`, { throws: true }),
  c(B, 'uncaught double initialization through return override', 1, 'TypeError',
    `function f(x){ class B { constructor(t){ return t; } } class S extends B { #t = x; } const o = {}; new S(o); new S(o); return 1; }`, { throws: true }),
]);

// Declared runtime boundaries (status 6), with the ES2025 result recorded.
export const w4UnsupportedCases = Object.freeze([
  c(K, 'private field on an arguments-object return override', 1, 'unsupported',
    `function f(x){ class B { constructor(){ return (function(){ return arguments; })(); } } class D extends B { #p = x; static p(o){ return o.#p; } } return D.p(new D()); }`, { normative: 1 }),
  c(K, 'private field on a primitive-wrapper return override', 1, 'unsupported',
    `function f(x){ class B { constructor(){ return Object(1); } } class D extends B { #p = x; static p(o){ return o.#p; } } return D.p(new D()); }`, { normative: 1 }),
]);

// Early errors: V8 must reject at parse time and the packing compiler must
// reject with SyntaxError.
export const w4RejectedCases = Object.freeze([
  c(N, 'delete of a private reference', 1, undefined, `function f(x){ class A { #x; m(){ delete this.#x; } } return 1; }`),
  c(N, 'delete of an optional private reference', 1, undefined, `function f(x){ class A { #x; m(){ delete this?.#x; } } return 1; }`),
  c(N, 'undeclared private name in a member access', 1, undefined, `function f(x){ class A { #x; m(){ return this.#y; } } return 1; }`),
  c(N, 'undeclared private name in #y in o', 1, undefined, `function f(x){ class A { #x; m(o){ return #y in o; } } return 1; }`),
  c(N, 'private name outside any class body', 1, undefined, `function f(x){ return #x in {}; }`),
  c(N, 'duplicate private field', 1, undefined, `function f(x){ class A { #x; #x; } return 1; }`),
  c(N, 'private field and private getter share a name', 1, undefined, `function f(x){ class A { #x; get #x(){ return 1; } } return 1; }`),
  c(N, 'static and instance halves of one private accessor', 1, undefined, `function f(x){ class A { static get #x(){ return 1; } set #x(v){} } return 1; }`),
  c(N, 'super private reference', 1, undefined, `function f(x){ class B {} class A extends B { #x; m(){ return super.#x; } } return 1; }`),
  c(N, '#constructor', 1, undefined, `function f(x){ class A { #constructor; } return 1; }`),
  c(N, 'private name in an object literal', 1, undefined, `function f(x){ return { #x: 1 }; }`),
  c(N, 'private name declared only in a nested class used by the outer class', 1, undefined, `function f(x){ class A { static I = class { #x; }; m(o){ return o.#x; } } return 1; }`),
  c(N, 'private name as a shorthand in-operand on the right', 1, undefined, `function f(x){ class A { #x; m(o){ return o in #x; } } return 1; }`),
]);
