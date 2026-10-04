// Phase 4 next wave, worker 7: function/class builtin metadata and
// constructor / new.target / super property-semantics audit.
// Fixed expectations are ES2025 results (re-verified with V8 and a private
// native QuickJS interpreter by check-phase4-next-w7.mjs); each changes with
// input + 1. Same record shape as phase4-class-element-cases.js. Own-key
// fixtures use strict code: sloppy functions carry implementation-defined own
// `caller`/`arguments` keys, which the runtime keeps at status 6 (functionKey).

const c = (area, feature, input, expected, source, extra = {}) => Object.freeze({ area, feature, input, expected, source, ...extra });

export const w7NextCases = Object.freeze([
  // Ordinary function metadata.
  c('fn-meta', 'ordinary function own keys and descriptors', 1, 'length,name,prototype|length:falsefalsetrue,name:falsefalsetrue,prototype:truefalsefalse|2g1',
    `function f(x){ 'use strict'; function g(a, b){} const d = k => { const p = Object.getOwnPropertyDescriptor(g, k); return k + ':' + p.writable + p.enumerable + p.configurable; }; return Object.getOwnPropertyNames(g).join() + '|' + ['length', 'name', 'prototype'].map(d).join() + '|' + g.length + g.name + x; }`),
  c('fn-meta', 'function prototype object and constructor descriptor', 2, 'constructor|true|true|truefalsetrue|2',
    `function f(x){ 'use strict'; function g(){} const p = Object.getOwnPropertyDescriptor(g.prototype, 'constructor'); return Object.getOwnPropertyNames(g.prototype).join() + '|' + (g.prototype.constructor === g) + '|' + (Object.getPrototypeOf(g.prototype) === Object.prototype) + '|' + p.writable + p.enumerable + p.configurable + '|' + x; }`),
  c('fn-meta', 'function length counts parameters before the first default or rest', 3, '1,0,2,0,1:3',
    `function f(x){ function g(a, b = 1, c){} function h({ a }, [b]){} function k(...r){} return [g.length, ((...r) => 0).length, h.length, k.length, ((a, b = 2) => 0).length].join() + ':' + x; }`),
  c('fn-meta', 'deleting name and length falls back to Function.prototype', 4, 'false::false:0:prototype,name:z4',
    `function f(x){ 'use strict'; function g(a){} delete g.name; delete g.length; const r = Object.hasOwn(g, 'name') + ':' + g.name + ':' + Object.hasOwn(g, 'length') + ':' + g.length; Object.defineProperty(g, 'name', { value: 'z' + x, configurable: true }); return r + ':' + Object.getOwnPropertyNames(g).join() + ':' + g.name; }`),
  c('fn-meta', 'function prototype is writable but not configurable', 5, 'true:false:5',
    `function f(x){ function g(){} const p = { v: x }; g.prototype = p; return (g.prototype === p) + ':' + delete g.prototype + ':' + new g().v; }`),
  c('fn-meta', 'name and length are read-only but redefinable', 6, 'g:2:TypeError:n6',
    `function f(x){ 'use strict'; function g(a, b){} let r = ''; try { g.name = 'q'; } catch (e) { r = e.constructor.name; } Object.defineProperty(g, 'name', { value: 'n' + x }); return 'g:' + g.length + ':' + r + ':' + g.name; }`),

  // Class metadata.
  c('class-meta', 'class own keys and descriptors', 1, 'length,name,prototype,s|3|falsefalsefalse|constructor,m|truefalsetrue|false|1',
    `function f(x){ class A { constructor(a, b, c){} static s(){} m(){} } const d = (o, k) => { const p = Object.getOwnPropertyDescriptor(o, k); return '' + p.writable + p.enumerable + p.configurable; }; return [Object.getOwnPropertyNames(A).join(), A.length, d(A, 'prototype'), Object.getOwnPropertyNames(A.prototype).join(), d(A.prototype, 'constructor'), Object.getOwnPropertyDescriptor(A.prototype, 'm').enumerable, x].join('|'); }`),
  c('class-meta', 'class prototype is non-writable and non-configurable', 2, 'true:false:TypeError2',
    `function f(x){ class A {} const p = A.prototype; A.prototype = {}; let r = (A.prototype === p) + ':' + delete A.prototype; try { (() => { 'use strict'; A.prototype = 1; })(); } catch (e) { r += ':' + e.constructor.name; } return r + x; }`),
  c('class-meta', 'class names: declaration, expression binding and anonymous', 3, 'A|Inner|D||true|3',
    `function f(x){ class A {} const C = class Inner {}; var D = class {}; const anon = [class {}][0]; return [A.name, C.name, D.name, anon.name, Object.hasOwn(anon, 'name'), x].join('|'); }`),
  c('class-meta', 'class name descriptor and redefinition', 4, 'falsefalsetrue:Z4',
    `function f(x){ class A {} const p = Object.getOwnPropertyDescriptor(A, 'name'); Object.defineProperty(A, 'name', { value: 'Z' + x }); return '' + p.writable + p.enumerable + p.configurable + ':' + A.name; }`),
  c('class-meta', 'static name method suppresses contextual naming', 5, 'function:m5',
    `function f(x){ var C = class { static name(){ return 'm'; } }; return typeof C.name + ':' + C.name() + x; }`),
  c('class-meta', 'class length and default derived constructor length', 6, '2,0,0:6',
    `function f(x){ class B { constructor(a, b){} } class D extends B {} class E {} return [B.length, D.length, E.length].join() + ':' + x; }`),
  c('class-meta', 'computed, numeric and string-literal method names', 7, 'm7|1|q r|get g7',
    `function f(x){ const k = 'm' + x; class A { [k](){} 1(){} static 'q r'(){} get ['g' + x](){ return 0; } } return [A.prototype[k].name, A.prototype[1].name, A['q r'].name, Object.getOwnPropertyDescriptor(A.prototype, 'g' + x).get.name].join('|'); }`),
  c('class-meta', 'computed static prototype method throws TypeError', 8, 'TypeError8',
    `function f(x){ try { class A { static ['proto' + 'type'](){} } } catch (e) { return e.constructor.name + x; } return 'no'; }`),
  c('class-meta', 'static length method replaces length in place', 9, 'length,name,prototype:function:9',
    `function f(x){ class A { static length(){ return x; } } return Object.getOwnPropertyNames(A).join() + ':' + typeof A.length + ':' + A.length(); }`),

  // Methods, accessors and arrows are not constructors.
  c('non-ctor', 'object literal method has no prototype and is not a constructor', 1, 'false:m:TypeError1',
    `function f(x){ const o = { m(){} }; let r = Object.hasOwn(o.m, 'prototype') + ':' + o.m.name; try { new o.m(); } catch (e) { r += ':' + e.constructor.name; } return r + x; }`),
  c('non-ctor', 'class methods, static methods and accessors are not constructors', 2, 'TypeError,TypeError,TypeError,TypeError:2',
    `function f(x){ class A { m(){} static s(){} get g(){ return 1; } set g(v){} } const d = Object.getOwnPropertyDescriptor(A.prototype, 'g'); const t = F => { try { new F(); return 'ok'; } catch (e) { return e.constructor.name; } }; return [t(A.prototype.m), t(A.s), t(d.get), t(d.set)].join() + ':' + x; }`),
  c('non-ctor', 'arrow has no prototype, own name/length, not constructible', 3, 'false:a:2:TypeError3',
    `function f(x){ const a = (p, q) => 0; let r = Object.hasOwn(a, 'prototype') + ':' + a.name + ':' + a.length; try { new a(); } catch (e) { r += ':' + e.constructor.name; } return r + x; }`),
  c('non-ctor', 'Function.prototype is callable but not a constructor', 4, 'function::0:undefined:TypeError4',
    `function f(x){ let r = typeof Function.prototype + ':' + Function.prototype.name + ':' + Function.prototype.length + ':' + Function.prototype(); try { new Function.prototype(); } catch (e) { r += ':' + e.constructor.name; } return r + x; }`),
  c('non-ctor', 'Function.prototype links and name descriptor', 5, 'true,true,true,true:falsefalsetrue:5',
    `function f(x){ const p = Object.getOwnPropertyDescriptor(Function.prototype, 'name'); return [Object.getPrototypeOf(Function.prototype) === Object.prototype, Function.prototype.constructor === Function, Object.getPrototypeOf(function(){}) === Function.prototype, Object.getPrototypeOf(class {}) === Function.prototype].join() + ':' + p.writable + p.enumerable + p.configurable + ':' + x; }`),

  // Bound functions.
  c('bound', 'bound name and length', 1, 'bound g:2:0:bound bound g:1',
    `function f(x){ function g(a, b, c){} const b = g.bind(null, 1); const bb = b.bind(null, 1, 2, 3); return b.name + ':' + b.length + ':' + bb.length + ':' + bb.name + ':' + x; }`),
  c('bound', 'bound own keys, descriptors and no prototype', 2, 'length,name|falsefalsetrue|false|2',
    `function f(x){ 'use strict'; function g(a){} const b = g.bind(null); const p = Object.getOwnPropertyDescriptor(b, 'name'); return [Object.getOwnPropertyNames(b).join(), '' + p.writable + p.enumerable + p.configurable, Object.hasOwn(b, 'prototype'), x].join('|'); }`),
  c('bound', 'bound length from unusual target lengths', 3, 'Infinity,0,0,1,0:3',
    `function f(x){ const mk = len => { function g(){} Object.defineProperty(g, 'length', { value: len }); return g; }; function h(){} delete h.length; return [mk(Infinity).bind().length, mk(-5).bind().length, mk('3').bind().length, mk(2.7).bind(null, 0).length, h.bind().length].join() + ':' + x; }`),
  c('bound', 'bound name from non-string or inherited target names', 4, 'bound |bound |4',
    `function f(x){ function g(){} Object.defineProperty(g, 'name', { value: 42 }); function h(){} delete h.name; return [g.bind().name, h.bind().name, x].join('|'); }`),
  c('bound', 'bound class constructs with partial arguments and rejects calls', 5, '6:true:TypeError',
    `function f(x){ class A { constructor(a, b){ this.s = a + b; } } const B = A.bind(null, x); const o = new B(1); let r = o.s + ':' + (o instanceof A); try { B(1); } catch (e) { r += ':' + e.constructor.name; } return r; }`),

  // Anonymous function name inference (NamedEvaluation).
  c('naming', 'var, let and const bindings', 1, 'a|b|c|1',
    `function f(x){ var a = function(){}; let b = () => 0; const c = class {}; return [a.name, b.name, c.name, x].join('|'); }`),
  c('naming', 'default parameter initializers', 2, 'h|k|C|2',
    `function f(x){ function g(h = function(){}, k = () => 0, C = class {}){ return [h.name, k.name, C.name]; } return [...g(), x].join('|'); }`),
  c('naming', 'destructuring defaults (object, array, assignment pattern)', 3, 'p|q|r|s|3',
    `function f(x){ const { p = function(){} } = {}; const [q = () => 0] = []; let r, s; ({ r = class {} } = {}); [s = function(){}] = []; return [p.name, q.name, r.name, s.name, x].join('|'); }`),
  c('naming', 'object literal property values', 4, 'a|b|c|d4|1|4',
    `function f(x){ const o = { a: function(){}, b: () => 0, c: class {}, ['d' + x]: function(){}, 1: () => 0 }; return [o.a.name, o.b.name, o.c.name, o['d' + x].name, o[1].name, x].join('|'); }`),
  c('naming', 'assignment expressions: identifier, member, parenthesized, comma', 5, 'v||w||5',
    `function f(x){ let v, w, z; const o = {}; v = function(){}; o.p = function(){}; w = (function(){}); z = (0, function(){}); return [v.name, o.p.name, w.name, z.name, x].join('|'); }`),
  c('naming', 'logical assignment operators', 6, 'a|b|c|6',
    `function f(x){ let a, b = null, c = 1; a ||= function(){}; b ??= () => 0; c &&= class {}; return [a.name, b.name, c.name, x].join('|'); }`),
  c('naming', 'named function and class expressions keep their own names', 7, 'inner|n|K|7',
    `function f(x){ var a = function inner(){}; const o = { m: function n(){} }; let k = class K {}; return [a.name, o.m.name, k.name, x].join('|'); }`),
  c('naming', 'getter and setter names', 8, 'get x|set x|get 1|set k8|get s',
    `function f(x){ const o = { get x(){ return 0; }, set x(v){}, get 1(){ return 0; }, set ['k' + x](v){} }; class A { static get s(){ return 0; } } const d = k => Object.getOwnPropertyDescriptor(o, k); return [d('x').get.name, d('x').set.name, d(1).get.name, d('k' + x).set.name, Object.getOwnPropertyDescriptor(A, 's').get.name].join('|'); }`),
  c('naming', 'computed object literal anonymous names', 9, 'k9|get k9|9',
    `function f(x){ const k = 'k' + x; const o = { [k]: () => 0 }; const p = { get [k](){ return 0; } }; return [o[k].name, Object.getOwnPropertyDescriptor(p, k).get.name, x].join('|'); }`),

  // Class constructor [[Call]] and new.target.
  c('ctor', 'class constructor called without new throws TypeError', 1, 'TypeError,TypeError,TypeError:1',
    `function f(x){ class B {} class D extends B {} class E extends B { constructor(){ super(); } } const t = F => { try { F(); return 'ok'; } catch (e) { return e.constructor.name; } }; return [t(B), t(D), t(E.bind(null))].join() + ':' + x; }`),
  c('ctor', 'class constructor via call also throws TypeError', 2, 'TypeError2',
    `function f(x){ class A {} try { A.call({}); } catch (e) { return e.constructor.name + x; } return 'no'; }`),
  c('ctor', 'new.target in ordinary functions', 3, 'true:true:true:3',
    `function f(x){ function G(){ return new.target; } return (G() === undefined) + ':' + (new G() === G) + ':' + (G.call({}) === undefined) + ':' + x; }`),
  c('ctor', 'new.target through a bound function is the target', 4, 'true4',
    `function f(x){ let seen; function G(){ seen = new.target; } const B = G.bind(null); new B(); return (seen === G) + '' + x; }`),
  c('ctor', 'new.target in base sees the derived constructor', 5, 'false:true:true5',
    `function f(x){ class A { constructor(){ this.t = new.target; } } class B extends A {} return (new B().t === A) + ':' + (new B().t === B) + ':' + (new A().t === A) + x; }`),
  c('ctor', 'arrow functions capture new.target lexically', 6, 'true:true:6',
    `function f(x){ function F(){ const a = () => new.target; return { t: a() }; } return (new F().t === F) + ':' + (F().t === undefined) + ':' + x; }`),
  c('ctor', 'new.target is undefined in methods called normally', 7, 'undefined:undefined:7',
    `function f(x){ class A { m(){ return typeof new.target; } static s(){ return typeof new.target; } } return new A().m() + ':' + A.s() + ':' + x; }`),
  c('ctor', 'constructor prototype fallback when prototype is not an object', 8, 'true:true:8',
    `function f(x){ function G(){} G.prototype = 1; function H(){} H.prototype = null; return (Object.getPrototypeOf(new G()) === Object.prototype) + ':' + (Object.getPrototypeOf(new H()) === Object.prototype) + ':' + x; }`),

  // Derived constructors.
  c('derived', 'derived constructor without super throws ReferenceError at return', 1, 'ReferenceError1',
    `function f(x){ class B {} class D extends B { constructor(){} } try { new D(); } catch (e) { return e.constructor.name + x; } return 'no'; }`),
  c('derived', 'derived constructor return values', 2, 'true:TypeError:ReferenceError:2',
    `function f(x){ class B {} const o = { v: x }; class D1 extends B { constructor(){ return o; } } class D2 extends B { constructor(){ return 1; } } class D3 extends B { constructor(){ return undefined; } } const t = F => { try { new F(); return 'ok'; } catch (e) { return e.constructor.name; } }; return (new D1() === o) + ':' + t(D2) + ':' + t(D3) + ':' + x; }`),
  c('derived', 'this before super throws ReferenceError', 3, 'ReferenceError:3',
    `function f(x){ class B {} class D extends B { constructor(){ this.a = 1; super(); } } try { new D(); } catch (e) { return e.constructor.name + ':' + x; } return 'no'; }`),
  c('derived', 'base constructor primitive return is ignored', 4, 'true:4',
    `function f(x){ class B { constructor(){ this.v = x; return 7; } } return (new B() instanceof B) + ':' + new B().v; }`),

  // super property semantics.
  c('super', 'super.x = v defines on this, not on the home prototype', 1, 'true:1::',
    `function f(x){ class B {} class D extends B { m(){ super.x = x; return [this.hasOwnProperty('x'), this.x, B.prototype.x, super.x].join(':'); } } return new D().m(); }`),
  c('super', 'super assignment runs an inherited setter with this', 2, '2:false:false',
    `function f(x){ class B { set v(n){ this.seen = n; } } class D extends B { m(){ super.v = x; return this.seen + ':' + Object.hasOwn(this, 'v') + ':' + Object.hasOwn(B.prototype, 'seen'); } } return new D().m(); }`),
  c('super', 'super getter receives this', 3, 'd3:d3',
    `function f(x){ class B { get who(){ return this.tag; } who2(){ return this.tag; } } class D extends B { constructor(){ super(); this.tag = 'd' + x; } m(){ return super.who + ':' + super.who2(); } } return new D().m(); }`),
  c('super', 'super assignment to non-writable inherited data throws TypeError', 4, 'TypeError:false:4',
    `function f(x){ class B {} Object.defineProperty(B.prototype, 'k', { value: 1 }); class D extends B { m(){ super.k = 2; } } const d = new D(); try { d.m(); } catch (e) { return e.constructor.name + ':' + Object.hasOwn(d, 'k') + ':' + x; } return 'no'; }`),
  c('super', 'super assignment on a frozen receiver throws TypeError', 5, 'TypeError5',
    `function f(x){ class B {} class D extends B { m(){ super.z = 1; } } const d = Object.freeze(new D()); try { d.m(); } catch (e) { return e.constructor.name + x; } return 'no'; }`),
  c('super', 'object literal super follows [[HomeObject]] and setPrototypeOf', 6, 'abb6',
    `function f(x){ const o = { m(){ return super.v; } }; Object.setPrototypeOf(o, { v: 'a' }); const r1 = o.m(); Object.setPrototypeOf(o, { v: 'b' }); const other = { m: o.m }; Object.setPrototypeOf(other, { v: 'z' }); return r1 + o.m() + other.m() + x; }`),
  c('super', 'object literal super method call keeps this', 7, 'hi:7',
    `function f(x){ const base = { hi(){ return 'hi:' + this.n; } }; const o = { n: x, hi(){ return super.hi(); } }; Object.setPrototypeOf(o, base); return o.hi(); }`),
  c('super', 'super inside an arrow in a method', 8, 'b8',
    `function f(x){ class B { v(){ return 'b'; } } class D extends B { m(){ const a = () => super.v(); return a() + x; } } return new D().m(); }`),
  c('super', 'object literal getter uses super', 9, 9,
    `function f(x){ const o = { get g(){ return super.k; } }; Object.setPrototypeOf(o, { k: x }); return o.g; }`),
  c('super', 'static super getter uses the derived constructor as receiver', 10, 'D10',
    `function f(x){ class B { static get id(){ return this.tag; } } class D extends B { static m(){ return super.id + x; } } D.tag = 'D'; return D.m(); }`),
  c('super', 'super property after the class prototype parent changes', 11, 'p2:11',
    `function f(x){ class B { v(){ return 'p1'; } } class D extends B { m(){ return super.v(); } } Object.setPrototypeOf(D.prototype, { v(){ return 'p2'; } }); return new D().m() + ':' + x; }`),

  // extends.
  c('extends', 'class extends null prototypes and construction TypeError', 1, 'true:true:TypeError1',
    `function f(x){ class A extends null {} let r = (Object.getPrototypeOf(A.prototype) === null) + ':' + (Object.getPrototypeOf(A) === Function.prototype); try { new A(); } catch (e) { r += ':' + e.constructor.name; } return r + x; }`),
  c('extends', 'class extends null with an object-returning constructor', 2, 'true:false:2',
    `function f(x){ class A extends null { constructor(){ return Object.create(A.prototype); } } const a = new A(); return (a instanceof A) + ':' + ('toString' in a) + ':' + x; }`),
  c('extends', 'extends non-constructors throws TypeError', 3, 'TypeError,TypeError,TypeError,TypeError,TypeError,TypeError,TypeError:3',
    `function f(x){ const t = P => { try { class X extends P {} return 'ok'; } catch (e) { return e.constructor.name; } }; const o = { m(){} }; return [t(() => 0), t(o.m), t({}), t(undefined), t(3), t(Math.max), t((() => 0).bind(null))].join() + ':' + x; }`),
  c('extends', 'extends with an invalid prototype property throws TypeError', 4, 'TypeError,TypeError,TypeError,ok:true:4',
    `function f(x){ const t = v => { function P(){} P.prototype = v; try { class X extends P {} return 'ok'; } catch (e) { return e.constructor.name; } }; function N(){} N.prototype = null; class Y extends N {} return [t(3), t('s'), t(undefined), t(null)].join() + ':' + (Object.getPrototypeOf(Y.prototype) === null) + ':' + x; }`),
  c('extends', 'extends a bound function without and with a prototype', 5, 'TypeError:true:true:5',
    `function f(x){ function P(){ this.p = x; } const bp = P.bind(null); let r; try { class X extends bp {} r = 'ok'; } catch (e) { r = e.constructor.name; } bp.prototype = P.prototype; class D extends bp {} const d = new D(); return r + ':' + (d instanceof P) + ':' + (Object.getPrototypeOf(D) === bp) + ':' + d.p; }`),

  // Second, more adversarial batch.
  c('naming', 'static initializers already see the inferred class name', 10, 'v|p|d|q|r|k10|10',
    `function f(x){ const k = 'k' + x; var v = class { static n = this.name; }; const o = { p: class { static n = this.name; }, [k]: class { static n = this.name; } }; function g(d = class { static n = this.name; }){ return d; } const { q = class { static n = this.name; } } = {}; let r; r ||= class { static n = this.name; }; return [v.n, o.p.n, g().n, q.n, r.n, o[k].n, x].join('|'); }`),
  c('class-meta', 'duplicate and merged class elements keep first-definition order', 11, 'length,name,prototype,a,b|constructor,x,m|falsetrue|function,function:11',
    `function f(x){ class A { static a(){ return 1; } static b(){} static a(){ return 2; } get x(){ return 0; } m(){} set x(v){} } const d = Object.getOwnPropertyDescriptor(A.prototype, 'x'); return [Object.getOwnPropertyNames(A).join(), Object.getOwnPropertyNames(A.prototype).join(), '' + d.enumerable + d.configurable, typeof d.get + ',' + typeof d.set].join('|') + ':' + (A.a() === 2 ? x : -x); }`),
  c('derived', 'super() inside an arrow initializes this', 5, 'true:5',
    `function f(x){ class B { constructor(v){ this.v = v; } } class D extends B { constructor(){ const s = () => super(x); s(); } } const d = new D(); return (d instanceof D) + ':' + d.v; }`),
  c('derived', 'second super() runs the base constructor, then throws ReferenceError', 6, 'ReferenceError:2:6',
    `function f(x){ let runs = 0; class B { constructor(){ runs++; } } class D extends B { constructor(){ super(); super(); } } try { new D(); } catch (e) { return e.constructor.name + ':' + runs + ':' + x; } return 'no'; }`),
  c('ctor', 'new.target through two derived levels and in a parameter initializer', 9, 'true:true:9',
    `function f(x){ let seen; class A { constructor(){ seen = new.target; } } class B extends A {} class C extends B {} new C(); function F(a = new.target){ return { a }; } return (seen === C) + ':' + (new F().a === F) + ':' + x; }`),
  c('ctor', 'constructor tail-calls keep construct return semantics', 10, 'true:10:true',
    `function f(x){ function prim(){ return 1; } const obj = { v: x }; function objF(){ return obj; } function F(){ this.v = x; return prim(); } function G(){ return objF(); } const a = new F(); return (a instanceof F) + ':' + a.v + ':' + (new G() === obj); }`),
  c('super', 'super with a null home prototype throws TypeError', 12, 'TypeError,TypeError:12',
    `function f(x){ class A extends null { get(){ return super.v; } put(){ super.v = 1; } } const o = {}; const t = m => { try { A.prototype[m].call(o); return 'ok'; } catch (e) { return e.constructor.name; } }; return [t('get'), t('put')].join() + ':' + x; }`),
  c('super', 'object literal __proto__ and super', 13, 'base13',
    `function f(x){ const base = { v(){ return 'base'; } }; const o = { __proto__: base, m(){ return super.v() + x; } }; return o.m(); }`),

  c('bound', 'bound function [[Prototype]] is the target [[Prototype]]', 6, 'true:true:bound :6',
    `function f(x){ class B {} class D extends B { static name(){} } const b = D.bind(null); return (Object.getPrototypeOf(b) === B) + ':' + (Object.getPrototypeOf((function(){}).bind()) === Function.prototype) + ':' + b.name + ':' + x; }`),
  c('naming', '__proto__ literal values are not named', 11, '::true:11',
    `function f(x){ const o = { __proto__: function(){} }; const p = { '__proto__': () => 0 }; return Object.getPrototypeOf(o).name + ':' + Object.getPrototypeOf(p).name + ':' + (typeof Object.getPrototypeOf(o) === 'function') + ':' + x; }`),

  // instanceof.
  c('instanceof', 'functions, classes, bound and built-in callables are Function instances', 4, 'true,true,true,true,true,true:4',
    `function f(x){ class A {} return [(function(){}) instanceof Function, A instanceof Function, A.bind() instanceof Object, Math.max instanceof Function, Function.prototype instanceof Object, (() => 0) instanceof Object].join() + ':' + x; }`),
  c('instanceof', 'instanceof with bound functions', 1, 'true,false,true,true,false:1',
    `function f(x){ function P(){} const bp = P.bind(null); const bbp = bp.bind(null); return [new P() instanceof bp, ({}) instanceof bp, new bp() instanceof P, new P() instanceof bbp, 1 instanceof bp].join() + ':' + x; }`),
  c('instanceof', 'instanceof primitives and non-prototype callables', 2, 'false:TypeError:TypeError:2',
    `function f(x){ const a = () => 0; let r = (1 instanceof a) + ''; try { ({}) instanceof a; } catch (e) { r += ':' + e.constructor.name; } try { ({}) instanceof {}; } catch (e) { r += ':' + e.constructor.name; } return r + ':' + x; }`),
  c('instanceof', 'instanceof walks a changed prototype chain', 3, 'false:true:3',
    `function f(x){ class A {} class B {} const o = new A(); const r = (o instanceof B) + ''; Object.setPrototypeOf(o, B.prototype); return r + ':' + (o instanceof B) + ':' + x; }`),
]);

// Uncaught guest errors (outcome error:<Name>).
export const w7NextErrorCases = Object.freeze([
  c('ctor', 'uncaught class constructor call', 1, 'TypeError',
    `function f(x){ class A { constructor(){ this.v = x; } } return A().v; }`, { throws: true }),
  c('derived', 'uncaught missing super()', 1, 'ReferenceError',
    `function f(x){ class B {} class D extends B { constructor(){ if (x > 100) super(); } } return new D(); }`, { throws: true }),
]);

// Declared runtime boundaries (status 6), with the ES2025 result recorded.
export const w7NextUnsupportedCases = Object.freeze([
  c('ctor', 'Reflect.construct new.target stays rejected', 1, 'unsupported',
    `function f(x){ function G(){ this.t = new.target; } function H(){} return Reflect.construct(G, [], H).t === H ? x : 0; }`, { normative: 1 }),
  c('instanceof', 'Symbol.hasInstance stays rejected', 1, true,
    `function f(x){ const C = { [Symbol.hasInstance](v){ return v === x; } }; return x instanceof C; }`, { normative: true, outcome: 'value' }),

  c('fn-meta', 'own caller/arguments query on a strict function', 1, 'unsupported',
    `function f(x){ 'use strict'; function g(){} return Object.hasOwn(g, 'caller') ? 0 : x; }`, { normative: 1 }),
  c('fn-meta', 'Function.prototype.call name/length metadata', 1, 1,
    `function f(x){ return Function.prototype.call.length === 1 && Function.prototype.call.name === 'call' ? x : 0; }`, { normative: 1, outcome: 'value' }),
  c('fn-meta', 'own keys of a sloppy function', 1, 'unsupported',
    `function f(x){ function g(){} return Object.getOwnPropertyNames(g).indexOf('length') === 0 ? x : 0; }`, { normative: 1 }),
]);

// Reflect.construct and custom @@hasInstance remain runtime protocol gaps.
export const w7NextRejectedCases = Object.freeze([]);
