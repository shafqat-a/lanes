// Phase 4 next wave, worker 8: independent ES2025 / test262-style conformance
// inventory for the seven next-wave areas. Pure data (browser-bundle safe).
//
// Areas: tagged-template, class-fields, class-static, class-private,
// class-private-methods, global, metadata, plus group 'probe' (GC pressure and
// resumption across step budgets).
//
// Every record: { area, feature, input, expected, source, status, ... }
//   status 'required'    ES2025 semantics the GPU must produce. A required case
//                        that is compiler-rejected or reaches runtime status 6
//                        is a GAP (reported by check-phase4-next-conformance.mjs),
//                        never a boundary.
//   status 'unsupported' declared runtime boundary (status 6). Only used where a
//                        status document explicitly declares it (`declaredBy`).
//   status 'rejected'    declared compiler rejection (SyntaxError), same rule.
// `expected` is the fixed ES2025 result for `input` (V8-verified by the check;
// input+1 must give a different value for value records). Uncaught-error
// records carry `throws: true` and the error constructor name. Early errors
// (spec-mandated SyntaxError) are conformance, not boundaries: `earlyError: true`.
// `predict6` / `predict2` (optional) are static-review predictions (from the
// packed bytecode and shader.js) that the current GPU run reaches status 6 /
// status 2 for a required case; they are reported as gaps, never declarations.
// `quickjsDeviation` records a pinned-QuickJS disagreement with ES2025.
// test262 references are directory hints (test/language/...), not file copies.

const c = (area, feature, input, expected, source, extra = {}) =>
  Object.freeze({ area, feature, input, expected, source, status: 'required', ...extra });

const PUSH_THIS_6 = 'shader.js push_this: sloppy receiver undefined/null -> status 6 (no global object yet)';
const GLOBAL_REF = 'program.js: free identifier -> "Unsupported global or module reference" (compiler rejection)';

export const conformanceCases = Object.freeze([
  c('metadata', 'class source text', 1, 'class1',
    `function f(x){ class A {} return A.toString().slice(0, 5) + x; }`),

  // ---------------------------------------------------------------- tagged templates
  // test262: language/expressions/tagged-template/{cache-*,template-object*,call-expression-*}
  c('tagged-template', 'template object shared across default-parameter evaluations', 1, 'true:d:1',
    `function f(x){ function tag(s){ return s; } function g(a = tag\`d\`){ return a; } const p = g(), q = g(); return (p === q) + ':' + p[0] + ':' + x; }`),
  c('tagged-template', 'class field initializer site is shared across instances', 2, 'true:f:2',
    `function f(x){ function tag(s){ return s; } class A { s = tag\`f\`; } const a = new A(), b = new A(); return (a.s === b.s) + ':' + a.s[0] + ':' + x; }`),
  c('tagged-template', 'tagged template inside a static block', 3, 'blk3:true',
    `function f(x){ let r, first; function tag(s, v){ first = first || s; return s[0] + v; } class A { static { r = tag\`blk\${x}\`; } } return r + ':' + Object.isFrozen(first); }`),
  c('tagged-template', 'empty template has one empty string', 4, '1::1:1:4',
    `function f(x){ function tag(s){ return s.length + ':' + s[0] + ':' + s.raw.length + ':' + arguments.length; } return tag\`\` + ':' + x; }`),
  c('tagged-template', 'abrupt substitution skips the call and keeps the site object', 5, 'boom:0:true:5',
    `function f(x){ let calls = 0; function tag(s){ calls++; return s; } function g(t){ return tag\`a\${t()}b\`; } let msg = ''; try { g(() => { throw new Error('boom'); }); } catch (e) { msg = e.message; } const before = calls; const s1 = g(() => 1), s2 = g(() => 2); return msg + ':' + before + ':' + (s1 === s2) + ':' + x; }`),
  c('tagged-template', 'frozen template object rejects Array.prototype.reverse', 6, 'TypeError:a,b:6',
    `function f(x){ function tag(s){ return s; } const s = tag\`a\${x}b\`; let r = ''; try { s.reverse(); } catch (e) { r = e.constructor.name; } return r + ':' + s.join() + ':' + x; }`),
  c('tagged-template', 'invalid escape cooked element is an own undefined', 7, 'true:true:7',
    `function f(x){ function tag(s){ return s; } const s = tag\`\\unicode\`; return (0 in s) + ':' + (s[0] === undefined) + ':' + x; }`),
  c('tagged-template', 'JSON.stringify of a template object', 8, '["a","b"]:["a","b"]:8',
    `function f(x){ function tag(s){ return s; } const s = tag\`a\${x}b\`; return JSON.stringify(s) + ':' + JSON.stringify(s.raw) + ':' + x; }`),
  c('tagged-template', 'String.raw stringifies numeric raw entries', 9, '1x2y3:9',
    `function f(x){ return String.raw({ raw: [1, 2, 3] }, 'x', 'y') + ':' + x; }`),
  c('tagged-template', 'tag call has undefined new.target', 10, 'true:10',
    `function f(x){ function tag(){ return new.target === undefined; } return tag\`a\` + ':' + x; }`),
  c('tagged-template', 'template object passed through a private field keeps identity', 11, 'true:p:11',
    `function f(x){ function tag(s){ return s; } class A { #t = tag\`p\${x}\`; static t(o){ return o.#t; } } const a = new A(), b = new A(); return (A.t(a) === A.t(b)) + ':' + A.t(a)[0] + ':' + x; }`),

  // ---------------------------------------------------------------- public instance fields
  // test262: language/statements/class/elements/{fields-*,*-field-*,init-*}, language/expressions/class/elements
  c('class-fields', 'instance field shadows a prototype method of the same name', 1, 'number:function:1',
    `function f(x){ class A { m = x; m(){ return 'method'; } } const a = new A(); return typeof a.m + ':' + typeof A.prototype.m + ':' + a.m; }`),
  c('class-fields', 'initializer sees the inner class binding', 2, 'true:2',
    `function f(x){ class C { self = C; v = x; } const o = new C(); return (o.self === C) + ':' + o.v; }`),
  c('class-fields', 'initializer does not see constructor parameters', 3, 'outer:inner:3',
    `function f(x){ const p = 'outer'; class A { v = p; constructor(p){ this.w = p; } } const a = new A('inner'); return a.v + ':' + a.w + ':' + x; }`),
  c('class-fields', 'super() inside an arrow initializes fields once', 4, '1:4:true',
    `function f(x){ let runs = 0; class B {} class D extends B { v = (runs++, x); constructor(){ const s = () => super(); s(); } } const d = new D(); return runs + ':' + d.v + ':' + (d instanceof D); }`),
  c('class-fields', 'second super() throws ReferenceError without re-running fields', 5, 'ReferenceError:2:1:5',
    `function f(x){ let base = 0, fields = 0; class B { constructor(){ base++; } } class D extends B { v = ++fields; constructor(){ super(); try { super(); } catch (e) { this.err = e.constructor.name; } } } const d = new D(); return d.err + ':' + base + ':' + fields + ':' + x; }`),
  c('class-fields', 'field named __proto__ is an own data property', 6, 'true:true:6',
    `function f(x){ class A { __proto__ = x; } const a = new A(); return Object.hasOwn(a, '__proto__') + ':' + (Object.getPrototypeOf(a) === A.prototype) + ':' + a.__proto__; }`),
  c('class-fields', 'computed key is converted at definition without instances', 7, '1:7',
    `function f(x){ let n = 0; const k = { toString(){ n++; return 'k'; } }; class A { [k] = 1; } return n + ':' + x; }`),
  c('class-fields', 'numeric computed field keys are canonical strings', 8, '8|1e+21:8',
    `function f(x){ class A { [x] = 'a'; [1e21] = 'b'; } return Object.keys(new A()).join('|') + ':' + x; }`),
  c('class-fields', 'super property assignment in an initializer targets the instance', 9, 'own:9:undefined',
    `function f(x){ class B {} class D extends B { v = (super.w = x, 0); } const d = new D(); return (Object.hasOwn(d, 'w') ? 'own' : 'none') + ':' + d.w + ':' + B.prototype.w; }`),
  c('class-fields', 'ordinary function in an initializer has strict call this', 10, 'true:undefined:10',
    `function f(x){ class A { g = function(){ return this; }; } const a = new A(); return (a.g() === a) + ':' + typeof (0, a.g)() + ':' + x; }`),
  c('class-fields', 'all computed keys are evaluated before any initializer', 11, 'k1,k2,i1,i2:11',
    `function f(x){ const log = []; const k = n => (log.push('k' + n), 'p' + n); class A { [k(1)] = log.push('i1'); [k(2)] = log.push('i2'); } new A(); return log.join(',') + ':' + x; }`),
  c('class-fields', 'base constructor sees derived fields uninitialised', 12, 'undefined:12',
    `function f(x){ class B { constructor(){ this.seen = this.get(); } get(){ return 'b'; } } class D extends B { v = x; get(){ return this.v; } } return String(new D().seen) + ':' + x; }`),
  // ES2025 15.7.1: only *static* fields named "prototype" are early errors.
  // Pinned QuickJS rejected instance ones; vendor patch "LANES phase4-next w2".
  c('class-fields', 'instance field named prototype is valid', 14, '14:true:object',
    `function f(x){ class A { prototype = x; } const a = new A(); return a.prototype + ':' + Object.hasOwn(a, 'prototype') + ':' + typeof A.prototype; }`),
  c('class-fields', 'string and numeric literal field function names', 13, 'a b|42|13',
    `function f(x){ class A { 'a b' = function(){}; 42 = () => 0; } const a = new A(); return a['a b'].name + '|' + a[42].name + '|' + x; }`),

  // ---------------------------------------------------------------- static fields / blocks
  // test262: language/statements/class/static-init-*, elements/static-*
  c('class-static', 'static field defines over an inherited non-writable property', 1, '1:true:0',
    `function f(x){ class B {} Object.defineProperty(B, 'v', { value: 0, writable: false, configurable: true }); class D extends B { static v = x; } return D.v + ':' + Object.hasOwn(D, 'v') + ':' + B.v; }`),
  c('class-static', 'static private method is installed before static fields', 2, 3,
    `function f(x){ class A { static v = A.#m(); static #m(){ return x + 1; } } return A.v; }`),
  c('class-static', 'static block sees private names', 3, 'true:false:3',
    `function f(x){ let r; class A { #p; static { r = (#p in new A()) + ':' + (#p in {}); } } return r + ':' + x; }`),
  c('class-static', 'closure created in a static block keeps block bindings', 4, 'blk4',
    `function f(x){ let g; class A { static { let v = 'blk' + x; g = () => v; } } return g(); }`),
  c('class-static', 'named class expression binding in static initializers', 5, 'Named:true:5',
    `function f(x){ const C = class Named { static n = Named.name; static same = Named; }; return C.n + ':' + (C.same === C) + ':' + x; }`),
  c('class-static', 'ordinary function in a static initializer has strict call this', 6, 'undefined:true:6',
    `function f(x){ class A { static g = function(){ return this; }; } return typeof (0, A.g)() + ':' + (A.g() === A) + ':' + x; }`),
  c('class-static', 'static initializer this reads inherited statics', 7, '1:8',
    `function f(x){ class B { static s = 1; } class D extends B { static t = this.s + x; } return D.s + ':' + D.t; }`),
  c('class-static', 'static fields run once per class evaluation', 8, '1,2:8',
    `function f(x){ let n = 0; const make = () => class { static id = ++n; }; const A = make(), B = make(); return A.id + ',' + B.id + ':' + x; }`),
  c('class-static', 'static field on a class extending null', 9, '9:true',
    `function f(x){ class N extends null { static s = x; } return N.s + ':' + (Object.getPrototypeOf(N.prototype) === null); }`),
  c('class-static', 'static field and method own key order', 10, 'length,name,prototype,b,a,c|a,c|10',
    `function f(x){ class A { static b(){} static a = 1; static c = 2; } return Object.getOwnPropertyNames(A).join() + '|' + Object.keys(A).join() + '|' + x; }`),

  // ---------------------------------------------------------------- private fields / #x in
  // test262: language/statements/class/elements/private-*, expressions/in/private-field-*
  c('class-private', 'inner class private name shadows the outer one', 1, 'TypeError:2:1',
    `function f(x){ class O { #x = 1; static I = class { #x = 2; static g(o){ return o.#x; } }; } let r; try { O.I.g(new O()); } catch (e) { r = e.constructor.name; } return r + ':' + O.I.g(new O.I()) + ':' + x; }`),
  c('class-private', 'reading a private field before it is added throws TypeError', 2, 'TypeError:2',
    `function f(x){ class A { a = this.#b; #b = 1; } try { new A(); } catch (e) { return e.constructor.name + ':' + x; } return 'no'; }`),
  c('class-private', 'logical assignment on private fields short-circuits', 3, '3,4,7,3',
    `function f(x){ let calls = 0; const g = v => (calls++, v); class A { #a = 0; #b = 5; #c = null; run(){ this.#a ||= g(x); this.#b &&= g(x + 1); this.#c ??= g(7); this.#a ??= g(99); return [this.#a, this.#b, this.#c, calls].join(','); } } return new A().run(); }`),
  c('class-private', 'exponent and shift compound assignment on private fields', 4, '16,4,8',
    `function f(x){ class A { #v = 2; run(){ this.#v **= x; const a = this.#v; this.#v >>= 2; const b = this.#v; this.#v <<= 1; return [a, b, this.#v].join(','); } } return new A().run(); }`),
  c('class-private', 'private fields as destructuring assignment targets', 5, '5,6,7',
    `function f(x){ class A { #a; #b; #c; run(){ [this.#a] = [x]; ({ k: this.#b } = { k: x + 1 }); [...this.#c] = [x + 2]; return [this.#a, this.#b, this.#c[0]].join(','); } } return new A().run(); }`),
  c('class-private', 'private field as a for-of target', 6, '6:3',
    `function f(x){ class A { #v = 0; run(){ let n = 0; for (this.#v of [1, 2, x]) n++; return this.#v + ':' + n; } } return new A().run(); }`),
  c('class-private', 'private access on null throws TypeError', 7, 'TypeError:TypeError:7',
    `function f(x){ class A { #p; static get(o){ return o.#p; } static has(o){ return #p in o; } } const r = []; try { A.get(null); } catch (e) { r.push(e.constructor.name); } try { A.has(null); } catch (e) { r.push(e.constructor.name); } return r.join(':') + ':' + x; }`),
  c('class-private', 'detached method uses the call receiver for private access', 8, '8:TypeError',
    `function f(x){ class A { #v = x; read(){ return this.#v; } } const a = new A(); const m = a.read; let r = m.call(a) + ':'; try { m.call({}); } catch (e) { r += e.constructor.name; } return r; }`),
  c('class-private', 'private field stamped on a function and an Error', 9, 'true:true:9:9',
    `function f(x){ class B { constructor(o){ return o; } } class S extends B { #t = x; static has(o){ return #t in o; } static t(o){ return o.#t; } } const fn = function(){}, err = new Error('e'); new S(fn); new S(err); return S.has(fn) + ':' + S.has(err) + ':' + S.t(fn) + ':' + S.t(err); }`),
  c('class-private', 'private field stamped on a bound function and a class', 10, 'true:true:10',
    `function f(x){ class B { constructor(o){ return o; } } class S extends B { #t = x; static has(o){ return #t in o; } static t(o){ return o.#t; } } const bound = function(){}.bind(null); class K {} new S(bound); new S(K); return S.has(bound) + ':' + S.has(K) + ':' + S.t(K); }`),
  c('class-private', 'private field stamped on an intrinsic object', 11, 'true:11:false',
    `function f(x){ class B { constructor(o){ return o; } } class S extends B { #t = x; static has(o){ return #t in o; } static t(o){ return o.#t; } } new S(Math); return S.has(Math) + ':' + S.t(Math) + ':' + S.has(JSON); }`),
  c('class-private', 'private field added to a frozen object', 12, 'true:12:true',
    `function f(x){ class B { constructor(o){ return o; } } class S extends B { #t = x; static has(o){ return #t in o; } static t(o){ return o.#t; } } const o = Object.freeze({}); new S(o); return S.has(o) + ':' + S.t(o) + ':' + Object.isFrozen(o); }`),
  c('class-private', 'optional chain continues through a private member', 13, 'undefined:13',
    `function f(x){ class A { #v = { w: x }; static g(o){ return o?.#v.w; } } return A.g(null) + ':' + A.g(new A()); }`),
  c('class-private', 'derived constructor sees private fields right after super()', 14, 'false:true:14',
    `function f(x){ class B { constructor(r){ r.push(D.has(this)); } } class D extends B { #p = x; static has(o){ return #p in o; } static v(o){ return o.#p; } constructor(){ const r = []; super(r); r.push(#p in this); this.r = r; } } const d = new D(); return d.r.join(':') + ':' + D.v(d); }`),
  c('class-private', 'private static access through a reassigned outer binding', 15, 'TypeError:15',
    `function f(x){ let A = class { static #s = x; static g(){ return A.#s; } }; const C = A; const ok = C.g(); A = {}; try { C.g(); } catch (e) { return e.constructor.name + ':' + ok; } return 'no'; }`),
  c('class-private', 'outer private name in a nested class computed key', 16, '16:16',
    `function f(x){ class O { #x = x; m(){ const self = this; return new (class { [self.#x] = 1; })(); } } return Object.keys(new O().m())[0] + ':' + x; }`),
  // ClassDefinitionEvaluation creates every private name before any computed
  // key is evaluated (ES2025 15.7.14 step 6); QuickJS emits private_symbol in
  // source order, so a computed key before the declaration sees an
  // uninitialized compiler local.
  c('class-private', 'private in inside a computed key before the declaration', 17, 'false:17',
    `function f(x){ let r; class A { static [(r = #p in {}, 'k')] = 1; #p; } return r + ':' + x; }`,
    { predict2: 'bytecode: object; get_loc3 (set_loc_uninitialized, tag 6); private_in -> privateName() status 2' }),
  c('class-private', 'private read inside a computed key before the declaration', 18, 'TypeError:18',
    `function f(x){ let r = 'none'; class A { static [(() => { try { ({}).#p; } catch (e) { r = e.constructor.name; } return 'k'; })()] = 1; #p; } return r + ':' + x; }`,
    { predict2: 'bytecode: object; get_var_ref0 (uninitialized #p cell); get_private_field -> privateName() status 2 (not a catchable TypeError)' }),

  // ---------------------------------------------------------------- private methods / accessors
  // test262: language/statements/class/elements/private-{method,getter,setter}-*, privatename-*
  c('class-private-methods', 'setter-only private accessor in operator', 1, 'true:false:1',
    `function f(x){ class A { set #s(v){} static t(o){ return #s in o; } } return A.t(new A()) + ':' + A.t({}) + ':' + x; }`,
    { quickjsDeviation: 'pinned QuickJS returns false:false (resolve_scope_private_field loads the never-initialized `#s` local instead of `#s<set>`)',
      predict2: 'bytecode: get_arg0; get_var_ref0 (uninitialized `#s` cell); private_in -> privateName() status 2' }),
  c('class-private-methods', 'compound assignment on a private method reads then throws', 2, 'TypeError:r:2',
    `function f(x){ let log = ''; class A { #m(){ return 1; } run(){ try { this.#m += (log += 'r', 1); } catch (e) { return e.constructor.name + ':' + log + ':' + x; } return 'no'; } } return new A().run(); }`),
  c('class-private-methods', 'assignment to a private method evaluates the right side first', 3, 'TypeError:r:3',
    `function f(x){ let log = ''; class A { #m(){} run(){ try { this.#m = (log += 'r', 1); } catch (e) { return e.constructor.name + ':' + log + ':' + x; } return 'no'; } } return new A().run(); }`),
  c('class-private-methods', 'getter-only compound assignment calls the getter then throws', 4, 'TypeError:gr:4',
    `function f(x){ let log = ''; class A { get #g(){ log += 'g'; return 1; } run(){ try { this.#g += (log += 'r', 1); } catch (e) { return e.constructor.name + ':' + log + ':' + x; } return 'no'; } } return new A().run(); }`),
  c('class-private-methods', 'setter-only compound assignment throws before the right side', 5, 'TypeError::5',
    `function f(x){ let log = ''; class A { set #s(v){ log += 's'; } run(){ try { this.#s += (log += 'r', 1); } catch (e) { return e.constructor.name + ':' + log + ':' + x; } return 'no'; } } return new A().run(); }`),
  c('class-private-methods', 'extracted private method has strict call this', 6, 'true:true:6',
    `function f(x){ class A { #m(){ return this; } run(){ const m = this.#m; return (m() === undefined) + ':' + (m.call(7) === 7) + ':' + x; } } return new A().run(); }`),
  c('class-private-methods', 'private method length and name', 7, '2:#m:7',
    `function f(x){ class A { #m(a, b){} static l(o){ return o.#m.length + ':' + o.#m.name; } } return A.l(new A()) + ':' + x; }`),
  c('class-private-methods', 'private method is not a constructor', 8, 'TypeError8',
    `function f(x){ class A { #m(){} static mk(o){ const M = o.#m; return new M(); } } try { A.mk(new A()); } catch (e) { return e.constructor.name + x; } return 'no'; }`),
  c('class-private-methods', 'brand is installed before the base constructor body', 9, 9,
    `function f(x){ class A { #m(){ return x; } constructor(){ this.v = this.#m(); } } return new A().v; }`),
  c('class-private-methods', 'derived private method before super() is a this ReferenceError', 10, 'ReferenceError:10',
    `function f(x){ class B {} class D extends B { #m(){ return 1; } constructor(){ let r; try { this.#m(); } catch (e) { r = e.constructor.name; } super(); this.r = r; } } return new D().r + ':' + x; }`),
  c('class-private-methods', 'private getter/setter pair through compound and update', 11, 23,
    `function f(x){ class A { #raw = 0; get #v(){ return this.#raw; } set #v(n){ this.#raw = n; } run(){ this.#v = x; this.#v += x; this.#v++; return this.#raw; } } return new A().run(); }`),
  c('class-private-methods', 'private methods are not own properties', 12, '0:0:12',
    `function f(x){ class A { #m(){} get #g(){ return 1; } } return Object.getOwnPropertyNames(A.prototype).length - 1 + ':' + Object.keys(new A()).length + ':' + x; }`),
  c('class-private-methods', 'super property inside a static private method', 13, 'P13',
    `function f(x){ class P { static n(){ return 'P'; } } class A extends P { static #m(){ return super.n() + x; } static run(){ return A.#m(); } } return A.run(); }`),
  c('class-private-methods', 'each class evaluation has a distinct method brand', 14, 'TypeError:1:14',
    `function f(x){ const make = () => class { #m(){ return 1; } static call(o){ return o.#m(); } }; const A = make(), B = make(); let e = ''; try { B.call(new A()); } catch (err) { e = err.constructor.name; } return e + ':' + A.call(new A()) + ':' + x; }`),

  // ---------------------------------------------------------------- sloppy global this / global object
  // test262: language/expressions/this/*, built-ins/global/*, language/global-code/*, built-ins/globalThis/*
  c('global', 'sloppy plain call this is the global object', 1, 'true:1',
    `function f(x){ function g(){ return this; } return (g() === globalThis) + ':' + x; }`, { predict6: GLOBAL_REF }),
  c('global', 'sloppy entry function this is an object', 2, 'object:2',
    `function f(x){ return typeof this + ':' + x; }`, { predict6: PUSH_THIS_6 }),
  c('global', 'call apply bind with null or undefined this', 3, 'true,true,true:3',
    `function f(x){ function g(){ return this === globalThis; } return [g.call(null), g.apply(undefined), g.bind(null)()].join() + ':' + x; }`, { predict6: GLOBAL_REF }),
  c('global', 'detached sloppy method this', 4, 'true:4',
    `function f(x){ const o = { m(){ return this; } }; const m = o.m; return (m() === globalThis) + ':' + x; }`, { predict6: GLOBAL_REF }),
  c('global', 'strict function this stays undefined (control)', 5, 'undefined:5',
    `function f(x){ function g(){ 'use strict'; return typeof this; } return g() + ':' + x; }`),
  c('global', 'globalThis self reference and descriptor', 6, 'true:true,false,true:6',
    `function f(x){ const d = Object.getOwnPropertyDescriptor(globalThis, 'globalThis'); return (globalThis.globalThis === globalThis) + ':' + [d.writable, d.enumerable, d.configurable].join() + ':' + x; }`, { predict6: GLOBAL_REF }),
  c('global', 'standard constructors are global object properties', 7, 'true:7',
    `function f(x){ return [globalThis.Math === Math, globalThis.JSON === JSON, globalThis.Object === Object, globalThis.Array === Array, globalThis.String === String, globalThis.Number === Number, globalThis.Boolean === Boolean, globalThis.TypeError === TypeError].every(Boolean) + ':' + x; }`, { predict6: GLOBAL_REF }),
  c('global', 'undefined NaN Infinity are non-writable non-configurable', 8, 'false,false,false|false,false,false|false,false,false|8',
    `function f(x){ const d = k => { const p = Object.getOwnPropertyDescriptor(globalThis, k); return [p.writable, p.enumerable, p.configurable].join(); }; return [d('undefined'), d('NaN'), d('Infinity')].join('|') + '|' + x; }`, { predict6: GLOBAL_REF }),
  c('global', 'sloppy write to global undefined is ignored', 9, 'undefined:9',
    `function f(x){ globalThis.undefined = 1; return typeof undefined + ':' + x; }`, { predict6: GLOBAL_REF }),
  c('global', 'strict write to global NaN throws TypeError', 10, 'TypeError10',
    `function f(x){ 'use strict'; try { globalThis.NaN = 1; } catch (e) { return e.constructor.name + x; } return 'no'; }`, { predict6: GLOBAL_REF }),
  c('global', 'global property is visible as an identifier', 11, '11:true',
    `function f(x){ globalThis.gv11 = x; return gv11 + ':' + ('gv11' in globalThis); }`, { predict6: GLOBAL_REF }),
  c('global', 'sloppy implicit global assignment creates a deletable property', 12, '12:true:true:false',
    `function f(x){ ig12 = x; const d = Object.getOwnPropertyDescriptor(globalThis, 'ig12'); const r = ig12 + ':' + d.enumerable + ':' + d.configurable; delete globalThis.ig12; return r + ':' + ('ig12' in globalThis); }`, { predict6: GLOBAL_REF }),
  c('global', 'strict implicit global assignment throws ReferenceError', 13, 'ReferenceError13',
    `function f(x){ 'use strict'; try { undeclared13 = 1; } catch (e) { return e.constructor.name + x; } return 'no'; }`, { predict6: GLOBAL_REF }),
  c('global', 'typeof an undeclared identifier', 14, 'undefined14',
    `function f(x){ return typeof undeclared14 + x; }`, { predict6: GLOBAL_REF }),
  c('global', 'reading an undeclared identifier throws ReferenceError', 15, 'ReferenceError15',
    `function f(x){ try { undeclared15; } catch (e) { return e.constructor.name + x; } return 'no'; }`, { predict6: GLOBAL_REF }),
  c('global', 'global object is an extensible object', 16, 'true:object:16',
    `function f(x){ return Object.isExtensible(globalThis) + ':' + typeof globalThis + ':' + x; }`, { predict6: GLOBAL_REF }),
  c('global', 'global this identity is stable', 17, 'true:true:17',
    `function f(x){ function g(){ return this; } return (g() === g()) + ':' + (g() === (() => this)()) + ':' + x; }`, { predict6: PUSH_THIS_6 }),
  c('global', 'sloppy tag function this is the global object', 18, 'true:18',
    `function f(x){ function tag(){ return this === globalThis; } return tag\`a\` + ':' + x; }`, { predict6: GLOBAL_REF }),
  c('global', 'sloppy callback this from a builtin is the global object', 19, 'true:19',
    `function f(x){ return [1].map(function(){ return this === globalThis; })[0] + ':' + x; }`, { predict6: GLOBAL_REF }),
  c('global', 'sloppy this property write lands on the global object', 20, '20:true',
    `function f(x){ function g(){ this.gp20 = x; } g(); return globalThis.gp20 + ':' + Object.hasOwn(globalThis, 'gp20'); }`, { predict6: GLOBAL_REF }),

  // ---------------------------------------------------------------- function/class metadata, new.target, super
  // test262: language/{statements,expressions}/class/{name,subclass,definition}*, expressions/new.target, expressions/super, built-ins/Function/prototype/bind
  c('metadata', 'class constructor own property order', 1, 'length,name,prototype,m,s|1',
    `function f(x){ class A { static m(){} static s = 1; } return Object.getOwnPropertyNames(A).join() + '|' + x; }`),
  c('metadata', 'class name and length descriptors', 2, 'A:1:false,false,true:false,false,true:2',
    `function f(x){ class A { constructor(a, b = 1, c){} } const n = Object.getOwnPropertyDescriptor(A, 'name'), l = Object.getOwnPropertyDescriptor(A, 'length'); return A.name + ':' + A.length + ':' + [n.writable, n.enumerable, n.configurable].join() + ':' + [l.writable, l.enumerable, l.configurable].join() + ':' + x; }`),
  c('metadata', 'anonymous class expression names', 3, 'C||true|3',
    `function f(x){ const C = class {}; const D = (0, class {}); return C.name + '|' + D.name + '|' + Object.hasOwn(D, 'name') + '|' + x; }`),
  c('metadata', 'class prototype property descriptor', 4, 'false,false,false:4',
    `function f(x){ class A {} const d = Object.getOwnPropertyDescriptor(A, 'prototype'); return [d.writable, d.enumerable, d.configurable].join() + ':' + x; }`),
  c('metadata', 'prototype constructor descriptor', 5, 'true,false,true:true:5',
    `function f(x){ class A {} const d = Object.getOwnPropertyDescriptor(A.prototype, 'constructor'); return [d.writable, d.enumerable, d.configurable].join() + ':' + (d.value === A) + ':' + x; }`),
  c('metadata', 'class methods and accessors are non-enumerable and named', 6, '0:get v:set v:6',
    `function f(x){ class A { m(){} get v(){ return 1; } set v(n){} static s(){} } const d = Object.getOwnPropertyDescriptor(A.prototype, 'v'); return Object.keys(A.prototype).length + Object.keys(A).length + ':' + d.get.name + ':' + d.set.name + ':' + x; }`),
  c('metadata', 'class methods have no prototype and are not constructors', 7, 'false:TypeError:7',
    `function f(x){ class A { m(){} } let e = ''; try { new A.prototype.m(); } catch (err) { e = err.constructor.name; } return Object.hasOwn(A.prototype.m, 'prototype') + ':' + e + ':' + x; }`),
  c('metadata', 'computed numeric method names', 8, '1|2.5|8',
    `function f(x){ class A { [1](){} static [2.5](){} } return A.prototype[1].name + '|' + A[2.5].name + '|' + x; }`),
  c('metadata', 'static method named name overrides the class name', 9, 'function:9',
    `function f(x){ class A { static name(){} } return typeof A.name + ':' + x; }`),
  c('metadata', 'bound class name length and construct new.target', 10, 'bound A:1:true:true:10',
    `function f(x){ class A { constructor(a, b){ this.t = new.target; } } const B = A.bind(null, 1); const o = new B(); return B.name + ':' + B.length + ':' + (o instanceof A) + ':' + (o.t === A) + ':' + x; }`),
  c('metadata', 'new.target in a base constructor is the most derived class', 11, 'true:true:11',
    `function f(x){ class B { constructor(){ this.t = new.target; } } class D extends B {} return (new D().t === D) + ':' + (new B().t === B) + ':' + x; }`),
  c('metadata', 'new.target inside an arrow', 12, 'true:undefined:12',
    `function f(x){ function F(){ this.t = (() => new.target)(); } const o = new F(); return (o.t === F) + ':' + typeof (function(){ return (() => new.target)(); })() + ':' + x; }`),
  c('metadata', 'super property lookup follows a changed home prototype', 13, '13:5',
    `function f(x){ class A { m(){ return super.v; } } Object.setPrototypeOf(A.prototype, { v: 5 }); return x + ':' + new A().m(); }`),
  c('metadata', 'detached method keeps its home object', 14, 'B14',
    `function f(x){ class B { n(){ return 'B'; } } class D extends B { m(){ return super.n() + x; } } const m = D.prototype.m; return m.call({}); }`),
  c('metadata', 'super in an object literal method with __proto__', 15, 'base15',
    `function f(x){ const base = { g(){ return 'base'; } }; const o = { __proto__: base, g(){ return super.g() + x; } }; return o.g(); }`),
  c('metadata', 'super property set defines on the receiver', 16, 'own:16:none',
    `function f(x){ class B {} class D extends B { m(){ super.p = x; return this; } } const d = new D().m(); return (Object.hasOwn(d, 'p') ? 'own' : 'none') + ':' + d.p + ':' + (Object.hasOwn(B.prototype, 'p') ? 'proto' : 'none'); }`),
  c('metadata', 'super in a static method is the parent constructor', 17, 'P17',
    `function f(x){ class P { static n(){ return 'P'; } } class C extends P { static n(){ return super.n() + x; } } return C.n(); }`),
  c('metadata', 'class extending null', 18, 'true:true:TypeError:18',
    `function f(x){ class N extends null {} let e = ''; try { new N(); } catch (err) { e = err.constructor.name; } return (Object.getPrototypeOf(N.prototype) === null) + ':' + (Object.getPrototypeOf(N) === Function.prototype) + ':' + e + ':' + x; }`),
  c('metadata', 'inner class binding is immutable', 19, 'TypeError19',
    `function f(x){ class A { static m(){ A = 1; } } try { A.m(); } catch (e) { return e.constructor.name + x; } return 'no'; }`),
  c('metadata', 'outer class declaration binding is mutable', 20, 'number20',
    `function f(x){ class A {} A = 1; return typeof A + x; }`),
  c('metadata', 'class declaration temporal dead zone', 21, 'ReferenceError21',
    `function f(x){ try { A; } catch (e) { return e.constructor.name + x; } class A {} return 'no'; }`),
  c('metadata', 'heritage is evaluated before computed keys', 22, 'h,k:22',
    `function f(x){ const log = []; class B {} class D extends (log.push('h'), B) { [(log.push('k'), 'm')](){} } return log.join() + ':' + x; }`),
  c('metadata', 'non-constructor heritage throws TypeError', 23, 'TypeError23',
    `function f(x){ try { class D extends (() => {}) {} } catch (e) { return e.constructor.name + x; } return 'no'; }`),
  c('metadata', 'heritage prototype must be an object or null', 24, 'TypeError24',
    `function f(x){ function P(){} P.prototype = 3; try { class D extends P {} } catch (e) { return e.constructor.name + x; } return 'no'; }`),
  c('metadata', 'function name is configurable and falls back to Function.prototype', 25, 'true::25',
    `function f(x){ function g(a){} const d = delete g.name; return d + ':' + g.name + ':' + x; }`),
  c('metadata', 'object literal accessor function names', 26, 'get s|set s|26',
    `function f(x){ const o = { get s(){ return 1; }, set s(v){} }; const d = Object.getOwnPropertyDescriptor(o, 's'); return d.get.name + '|' + d.set.name + '|' + x; }`),
  c('metadata', 'derived default constructor forwards arguments', 27, '1,2,27',
    `function f(x){ class B { constructor(...a){ this.a = a; } } class D extends B {} return new D(1, 2, x).a.join(); }`),
]);

// Uncaught errors: the GPU run must end with the named guest exception
// (strict browser harness: phase4ErrorWrapper checks the exact prototype).
export const conformanceErrorCases = Object.freeze([
  c('class-private-methods', 'uncaught brand check failure', 1, 'TypeError',
    `function f(x){ class A { #m(){ return x; } static call(o){ return o.#m(); } } return A.call({}); }`, { throws: true }),
  c('class-static', 'uncaught static block error', 1, 'RangeError',
    `function f(x){ class A { static { throw new RangeError('s' + x); } } return 1; }`, { throws: true }),
  c('metadata', 'uncaught derived constructor missing super', 1, 'ReferenceError',
    `function f(x){ class B {} class D extends B { constructor(){ this.v = x; } } return new D().v; }`, { throws: true }),
]);

// Spec-mandated early errors (ES2025 static semantics). Rejection with
// SyntaxError is the conformant outcome here, not a boundary.
// `expected` stays undefined (no runtime value); the suite maps these to 'rejected'.
const early = (area, feature, body) => c(area, feature, 1, undefined, `function f(x){ ${body} return x; }`, { earlyError: true });
export const conformanceEarlyErrorCases = Object.freeze([
  early('class-fields', 'instance field named constructor', `class A { constructor = 1; }`),
  early('class-fields', 'string literal field named constructor', `class A { 'constructor' = 1; }`),
  early('class-static', 'static field named prototype', `class A { static prototype = 1; }`),
  early('class-static', 'static field named constructor', `class A { static constructor = 1; }`),
  early('class-fields', 'arguments in a field initializer', `class A { a = arguments; }`),
  early('class-fields', 'super call in a field initializer', `class A extends Object { a = super(); }`),
  early('class-static', 'return in a static block', `class A { static { return; } }`),
  early('class-static', 'arguments in a static block', `class A { static { arguments; } }`),
  early('class-static', 'await binding in a static block', `class A { static { var await; } }`),
  early('class-private', 'duplicate private field', `class A { #x; #x; }`),
  early('class-private', 'delete of a private reference', `class A { #x; m(){ delete this.#x; } }`),
  early('class-private', 'undeclared private name', `class A { m(){ return this.#y; } }`),
  early('class-private', 'private name #constructor', `class A { #constructor; }`),
  early('class-private', 'private in outside a class', `return #x in {};`),
  early('class-private-methods', 'duplicate private getter', `class A { get #a(){} get #a(){} }`),
  early('class-private-methods', 'static and instance accessor halves', `class A { static get #a(){} set #a(v){} }`),
  early('metadata', 'duplicate constructors', `class A { constructor(){} constructor(){} }`),
  early('metadata', 'super call outside a derived constructor', `class A { constructor(){ super(); } }`),
  early('metadata', 'super property in an ordinary function', `function g(){ return super.x; }`),
]);

// Declared boundaries (each cites the status document that declares it). The
// normative ES2025 value is recorded (`normative`) and V8-checked.
export const conformanceBoundaryCases = Object.freeze([
  c('class-private', 'private field on an arguments object return override', 1, 'unsupported',
    `function f(x){ class B { constructor(o){ return o; } } class S extends B { #t = x; static t(o){ return o.#t; } } const a = (function(){ return arguments; })(); new S(a); return S.t(a); }`,
    { status: 'unsupported', normative: 1, declaredBy: 'PHASE-4-NEXT-STATUS.md "Explicit class boundaries": private elements on arrays/arguments/wrappers/unmapped built-in functions -> status 6' }),
  c('class-private', 'private field on a builtin function return override', 1, 'unsupported',
    `function f(x){ class B { constructor(o){ return o; } } class S extends B { #t = x; static t(o){ return o.#t; } } new S(Math.max); return S.t(Math.max); }`,
    { status: 'unsupported', normative: 1, declaredBy: 'PHASE-4-NEXT-STATUS.md "Explicit class boundaries"' }),
  c('class-private-methods', 'async private method', 1, true,
    `function f(x){ class A { async #m(){ return x; } static has(o){ return #m in o; } } return A.has(new A()); }`,
    { status: 'required', outcome: 'value', normative: true, fixedAcrossInputs: true, declaredBy: 'Ordinary async class methods are admitted; original boundary ID/source retained' }),
  c('metadata', 'Reflect.construct new.target', 1, 'unsupported',
    `function f(x){ class A { constructor(){ this.t = new.target; } } class B {} return (Reflect.construct(A, [], B).t === B) + ':' + x; }`,
    { status: 'unsupported', normative: 'true:1', declaredBy: 'PHASE-4-STATUS.md "Remaining Phase 4 gaps": Reflect.construct new.target' }),
]);

// Group 'probe': GC pressure with live private elements / brands / template
// objects, and resumption-sized programs (the strict browser page re-runs ids in
// conformanceResumptionIds one instruction per dispatch, <= 60000 dispatches).
const p = (feature, input, expected, source, extra = {}) => c('probe', feature, input, expected, source, { group: 'probe', ...extra });
export const conformanceProbeCases = Object.freeze([
  p('probe private fields brands and static private state across collections', 1, 'k1:300:301',
    `function f(x){ class A { #v; static #count = 0; #m(){ return this.#v; } constructor(v){ this.#v = v; A.#count++; } static read(o){ return o.#m(); } static count(){ return A.#count; } } const keep = new A('k' + x); let total = 0; for (let i = 0; i < 300; i++) { const t = new A({ i, s: 'p' + i, a: [i] }); total += A.read(t).a[0] === i ? 1 : 0; } return A.read(keep) + ':' + total + ':' + A.count(); }`),
  p('probe discarded class evaluations release private names', 2, 301,
    `function f(x){ let last; for (let i = 0; i < 300; i++) { last = class { #p = i; static g(o){ return o.#p; } }; } return last.g(new last()) + x; }`),
  p('probe stale method brand home is never reused', 3, '80:3',
    `function f(x){ const make = () => class { #m(){} static has(o){ return #m in o; } }; let a0 = new (make())(); let foreign = 0; for (let i = 0; i < 80; i++) { const C = make(); if (!C.has(a0) && C.has(new C())) foreign++; } return foreign + ':' + x; }`),
  p('probe stale private name is never reused', 4, '80:4',
    `function f(x){ const make = () => class { #p = 1; static has(o){ return #p in o; } }; let a0 = new (make())(); let foreign = 0; for (let i = 0; i < 80; i++) { const C = make(); if (!C.has(a0) && C.has(new C())) foreign++; } return foreign + ':' + x; }`),
  p('probe template registry with many sites survives collections', 5, '10:s9:5',
    `function f(x){ const tag = s => s; const sites = () => [tag\`s0\`, tag\`s1\`, tag\`s2\`, tag\`s3\`, tag\`s4\`, tag\`s5\`, tag\`s6\`, tag\`s7\`, tag\`s8\`, tag\`s9\`]; const first = sites(); for (let i = 0; i < 300; i++) { const o = { a: [i, i + 1], s: 'q' + i }; o.b = o.a; } const again = sites(); let same = 0; for (let i = 0; i < 10; i++) if (first[i] === again[i]) same++; return same + ':' + again[9].raw[0] + ':' + x; }`),
  p('probe template object reachable only from a private field', 6, 'true:p6:true',
    `function f(x){ const tag = s => s; class A { #t; constructor(){ this.#t = tag\`p\${x}\`; } static t(o){ return o.#t; } } const a = new A(); for (let i = 0; i < 300; i++) { const o = { a: [i], b: 'z' + i }; o.c = o; } const b = new A(); return (A.t(a) === A.t(b)) + ':' + A.t(b)[0] + x + ':' + Object.isFrozen(A.t(a).raw); }`),
  // Resumption-sized (small instruction counts; accessor/continuation heavy).
  p('probe resumption private accessors in derived field initializers', 1, 'BgsgsD:22',
    `function f(x){ let log = ''; class B { constructor(){ log += 'B'; } } class D extends B { #raw = x; get #v(){ log += 'g'; return this.#raw; } set #v(n){ log += 's'; this.#raw = n; } static #k = 0; static { D.#k = 10; } t = (this.#v += D.#k, this.#v *= 2); constructor(){ super(); log += 'D'; } } const d = new D(); return log + ':' + d.t; }`, { resumption: true }),
  p('probe resumption getter tag forwarding to String.raw', 2, 'a4b6c',
    `function f(x){ const o = { get t(){ return (s, ...v) => String.raw(s, ...v.map(n => n * 2)); } }; return o.t\`a\${x}b\${x + 1}c\`; }`, { resumption: true }),
  p('probe resumption computed static key with toString and private in', 3, 'k3,r:true',
    `function f(x){ class A { static [{ toString(){ return 'k' + x; } }] = 1; #m(){} static { this.r = #m in new A(); } } return Object.keys(A).join() + ':' + A.r; }`, { resumption: true }),
  p('probe resumption sloppy global this', 4, 'true:4',
    `function f(x){ function g(){ return this; } const a = g(); let n = 0; for (let i = 0; i < 5; i++) n += g() === a ? 1 : 0; return (n === 5 && a === globalThis) + ':' + x; }`, { resumption: true, predict6: GLOBAL_REF }),
]);

// Proposed suite ids (module tag 'n-w8') for phase4ResumptionIds.
export const conformanceSuiteTag = 'n-w8';
export const conformanceResumptionIds = Object.freeze(conformanceProbeCases.filter(item => item.resumption).map(item => `${conformanceSuiteTag}:${item.feature}`));
