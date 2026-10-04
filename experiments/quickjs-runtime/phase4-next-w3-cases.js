// Phase 4 next wave, worker 3: adversarial fixtures for public static class
// fields and static blocks (ES2025 15.7 ClassDefinitionEvaluation, 15.7.10
// ClassStaticBlockDefinitionEvaluation, 7.3.33 DefineField). Same fixture
// shape as phase4-class-element-cases.js. Fixed expectations are ES2025
// results re-verified by check-phase4-next-w3.mjs against V8 and a private
// native QuickJS interpreter; each changes with input + 1. Instance-field
// behaviour (assignment 2) is deliberately not duplicated here.

const c = (area, feature, input, expected, source, extra = {}) => Object.freeze({ area, feature, input, expected, source, ...extra });

export const w3StaticCases = Object.freeze([
  c('class-static', 'w3: symbol-keyed static field (Phase 3 hook)', 1, 1,
    `function f(x){ const s = Symbol('k'); class A { static [s] = x; } return A[s]; }`),

  // Evaluation order (ClassDefinitionEvaluation steps 25-38).
  c('class-static', 'w3: static fields and blocks interleave; instance fields never run at definition', 1, 'k1,k2,k3,sa,blk1,sb,blk2:1',
    `function f(x){ const log = []; const k = s => (log.push(s), s); class A { [k('k1')] = log.push('inst'); static [k('k2')] = log.push('sa'); static { log.push('blk1'); } static [k('k3')](){} static sb = log.push('sb'); static { log.push('blk2'); } } return log.join(',') + ':' + x; }`),
  c('class-static', 'w3: computed static key ToPropertyKey runs once, before any static initializer', 2, 'key,init:2:1',
    `function f(x){ const log = []; let n = 0; const key = { toString(){ n++; log.push('key'); return 'p' + x; } }; class A { static [key] = (log.push('init'), x); } return log.join(',') + ':' + A['p' + x] + ':' + n; }`),
  c('class-static', 'w3: throwing computed static key skips every static initializer', 3, 'k,E:3',
    `function f(x){ const log = []; try { class A { static a = log.push('a'); static [(log.push('k'), { toString(){ throw new Error('E'); } })] = 1; static { log.push('blk'); } } } catch (e) { log.push(e.message); } return log.join(',') + ':' + x; }`),
  c('class-static', 'w3: static initializer reading a later static field sees undefined', 4, 'undefined:4:true',
    `function f(x){ class A { static a = this.b; static b = x; } return typeof A.a + ':' + A.b + ':' + Object.hasOwn(A, 'a'); }`),
  c('class-static', 'w3: a static block runs once per class evaluation', 5, '3:5',
    `function f(x){ let n = 0; const make = () => class { static { n++; } }; make(); make(); make(); return n + ':' + x; }`),
  c('class-static', 'w3: abrupt static block stops later static elements', 6, 'a,blk:X6:false',
    `function f(x){ const log = []; let probe; try { class A { static a = log.push('a'); static { log.push('blk'); probe = this; throw 'X' + x; } static b = log.push('b'); } } catch (e) { log.push(e); } return log.slice(0, 2).join(',') + ':' + log[2] + ':' + Object.hasOwn(probe, 'b'); }`),

  // this / super / new.target.
  c('class-static', 'w3: this in a nested function inside a static block is undefined (strict)', 7, 'undefined:true:7',
    `function f(x){ let r; class A { static { function g(){ return typeof this; } const h = () => this; r = g() + ':' + (h() === A); } } return r + ':' + x; }`),
  c('class-static', 'w3: super getter in a static field receives the derived constructor as this', 8, 'A8',
    `function f(x){ class P { static get tag(){ return this.label + x; } } class A extends P { static label = 'A'; static v = super.tag; } return A.v; }`),
  c('class-static', 'w3: super property assignment in a static block defines on the derived constructor', 9, 'true:false:9',
    `function f(x){ class P {} class A extends P { static { super.y = x; } } return Object.hasOwn(A, 'y') + ':' + Object.hasOwn(P, 'y') + ':' + A.y; }`),
  c('class-static', 'w3: super method call in a static block uses the derived constructor as this', 10, 'A10',
    `function f(x){ class P { static who(){ return this.name; } } let r; class A extends P { static { r = super.who() + x; } } return r; }`),
  c('class-static', 'w3: super inside an arrow nested in a static field', 11, 'P11',
    `function f(x){ class P { static m(){ return 'P'; } } class A extends P { static g = () => super.m() + x; } return A.g(); }`),
  c('class-static', 'w3: static home object is the constructor, not the prototype', 12, 'static12',
    `function f(x){ class P { m(){ return 'proto'; } static m(){ return 'static'; } } class A extends P { static v = super.m() + x; } return A.v; }`),
  c('class-static', 'w3: new.target undefined in a static field and an arrow in a static block', 13, 'undefined,undefined:13',
    `function f(x){ let r; class A { static t = new.target; static { r = (() => typeof new.target)(); } } return typeof A.t + ',' + r + ':' + x; }`),
  c('class-static', 'w3: arguments inside a function declared in a static block is allowed', 14, '3:14',
    `function f(x){ let r; class A { static { function g(){ return arguments.length + ':' + arguments[2]; } r = g(1, 2, x); } } return r; }`),

  // Static block scoping.
  c('class-static', 'w3: var in a static block does not leak to the enclosing function', 15, 'outer:15:undefined',
    `function f(x){ let leaked = 'outer', inside, early; class A { static { early = typeof leaked; var leaked = x; inside = () => leaked; } } return leaked + ':' + inside() + ':' + early; }`),
  c('class-static', 'w3: each static block has its own var scope', 16, 'undefined,16:16',
    `function f(x){ let r = []; class A { static { var v; r.push(typeof v); v = x; } static { var v = x; r.push(v); } } return r.join(',') + ':' + x; }`),
  c('class-static', 'w3: function declarations in a static block hoist within the block only', 17, '17:string',
    `function f(x){ let r, g = 'outer'; class A { static { r = g(); function g(){ return x; } } } return r + ':' + typeof g; }`),
  c('class-static', 'w3: let/const/class in a static block and closures over them', 18, '19:18',
    `function f(x){ let get; class A { static { let a = x; const b = a + 1; class K { static v = b; } get = () => K.v; } } return get() + ':' + x; }`),
  c('class-static', 'w3: control flow (labelled break, loops, try/finally) inside a static block', 19, '0+1+2:f:19',
    `function f(x){ let r = [], fin; class A { static { out: for (let i = 0; ; i++) { if (i === 3) break out; r.push(i); } try { throw 1; } catch { } finally { fin = 'f'; } } } return r.join('+') + ':' + fin + ':' + x; }`),
  c('class-static', 'w3: static block writes outer let and reads the inner class binding', 20, 'true:20',
    `function f(x){ let out = 0, self; class A { static { out = x; self = A; } } return (self === A) + ':' + out; }`),

  // Class bindings.
  c('class-static', 'w3: abrupt static field leaves the outer class binding in TDZ', 21, 'ReferenceError:function:21',
    `function f(x){ let outer, inner, r = ''; try { outer = () => A; class A { static { inner = () => A; } static z = (() => { throw 0; })(); } } catch (e) {} try { outer(); r = 'no'; } catch (e) { r = e.constructor.name; } return r + ':' + typeof inner() + ':' + x; }`),
  c('class-static', 'w3: inner class binding is immutable inside a static block', 22, 'TypeError:22',
    `function f(x){ let r; try { class A { static { A = 1; } } } catch (e) { r = e.constructor.name; } return r + ':' + x; }`),
  c('class-static', 'w3: static arrow captures the inner binding, not the reassignable outer one', 23, 'true:23',
    `function f(x){ class A { static self = () => A; static v = x; } const keep = A; A = null; return (keep.self() === keep) + ':' + keep.self().v; }`),
  c('class-static', 'w3: named class expression inner binding visible in static initializers', 24, 'Inner:true:24',
    `function f(x){ const C = class Inner { static n = Inner.name; static self = Inner; static v = x; }; return C.n + ':' + (C.self === C) + ':' + C.v; }`),

  // Names and anonymous function naming.
  c('class-static', 'w3: anonymous function naming across static field key forms', 25, 'f|a|c|k25|7|str key',
    `function f(x){ const key = 'k' + x; class A { static f = function(){}; static a = () => 0; static c = class {}; static [key] = () => 1; static 7 = function(){}; static 'str key' = () => 2; } return [A.f.name, A.a.name, A.c.name, A[key].name, A[7].name, A['str key'].name].join('|'); }`),
  c('class-static', 'w3: static field value with its own static name is not renamed', 26, 'own26',
    `function f(x){ class A { static c = class { static name = 'own' + x; }; } return A.c.name; }`),
  c('class-static', 'w3: named function in a static field keeps its own name', 27, 'g:27',
    `function f(x){ class A { static h = function g(){}; } return A.h.name + ':' + x; }`),
  c('class-static', 'w3: class name observed before a static name field overrides it', 28, 'A|N28|false',
    `function f(x){ let before; class A { static { before = this.name; } static name = 'N' + x; } return before + '|' + A.name + '|' + (typeof A.name === 'function'); }`),
  c('class-static', 'w3: static name field replaces a static name method', 29, 'string:29:true',
    `function f(x){ class A { static name(){ return 'm'; } static name = 'v' + x; } return typeof A.name + ':' + A.name.slice(1) + ':' + Object.getOwnPropertyDescriptor(A, 'name').enumerable; }`),
  c('class-static', 'w3: deleted name falls back to Function.prototype.name', 30, ':30',
    `function f(x){ class A { static { delete this.name; } static n = this.name; } return A.n + ':' + x; }`),

  // DefineField / CreateDataPropertyOrThrow on the constructor.
  c('class-static', 'w3: static field replaces an earlier static method with an enumerable data property', 31, '31:true:true',
    `function f(x){ class A { static m(){ return 0; } static m = x; } const d = Object.getOwnPropertyDescriptor(A, 'm'); return d.value + ':' + d.enumerable + ':' + d.writable; }`),
  c('class-static', 'w3: static field declared before a same-named static method still wins', 32, 'number:32',
    `function f(x){ class A { static m = x; static m(){} } return typeof A.m + ':' + A.m; }`),
  c('class-static', 'w3: static field replaces a static accessor without calling its setter', 33, 'data:0:33',
    `function f(x){ let calls = 0; class A { static get v(){ return 'g'; } static set v(n){ calls++; } static v = x; } const d = Object.getOwnPropertyDescriptor(A, 'v'); return ('value' in d ? 'data' : 'acc') + ':' + calls + ':' + A.v; }`),
  c('class-static', 'w3: assignment in a static block uses [[Set]] and runs a static setter', 34, '1:34:false',
    `function f(x){ let calls = 0, seen; class A { static set v(n){ calls++; seen = n; } static { this.v = x; } } return calls + ':' + seen + ':' + ('value' in Object.getOwnPropertyDescriptor(A, 'v')); }`),
  c('class-static', 'w3: static field after a static block froze the constructor throws TypeError', 35, 'TypeError:false:35',
    `function f(x){ let r; try { class A { static { Object.freeze(this); r = this; } static late = x; } } catch (e) { return e.constructor.name + ':' + Object.hasOwn(r, 'late') + ':' + x; } return 'no'; }`),
  c('class-static', 'w3: static field over a non-configurable property defined by a static block throws TypeError', 36, 'TypeError:1:36',
    `function f(x){ let r; try { class A { static { Object.defineProperty(this, 'z', { value: 1, writable: true }); r = this; } static z = x; } } catch (e) { return e.constructor.name + ':' + r.z + ':' + x; } return 'no'; }`),
  c('class-static', 'w3: static field replaces a configurable method on a non-extensible constructor', 37, '37:false',
    `function f(x){ class A { static m(){} static { Object.preventExtensions(this); } static m = x; } return A.m + ':' + Object.isExtensible(A); }`),
  c('class-static', 'w3: computed static constructor field defines an own data property', 38, 'true:38:true',
    `function f(x){ class A { static ['constructor'] = x; } return Object.hasOwn(A, 'constructor') + ':' + A.constructor + ':' + (A.prototype.constructor === A); }`),
  c('class-static', 'w3: computed static prototype field throws TypeError and earlier statics already ran', 39, 'TypeError:a:39',
    `function f(x){ const log = []; try { class A { static a = log.push('a'); static ['proto' + 'type'] = 1; static { log.push('after'); } } } catch (e) { return e.constructor.name + ':' + log.join(',') + ':' + x; } return 'no'; }`,
    // ES2025 15.7.10 ClassFieldDefinitionEvaluation only evaluates the key; the
    // TypeError comes from DefineField -> CreateDataPropertyOrThrow (step 31 of
    // ClassDefinitionEvaluation), i.e. after `static a` ran. V8 throws while
    // evaluating the computed key instead. Pinned QuickJS follows the spec.
    { v8Deviation: 'TypeError::39' }),
  c('class-static', 'w3: static length field after the constructor arity was observed', 40, '2|40|true',
    `function f(x){ let before; class A { constructor(a, b){} static { before = this.length; } static length = x; } return before + '|' + A.length + '|' + Object.getOwnPropertyDescriptor(A, 'length').enumerable; }`),
  c('class-static', 'w3: numeric static field keys define canonical index keys', 41, '0,41,1.5',
    `function f(x){ class A { static 0 = 'a'; static 1.5 = 'b'; static [x] = 'c'; } return Object.keys(A).join(','); }`),

  // Inheritance of statics.
  c('class-static', 'w3: subclass static field reads an inherited static and does not write the parent', 42, '43:false:42',
    `function f(x){ class P { static s = x; } class A extends P { static t = this.s + 1; static s2 = super.s; } return A.t + ':' + Object.hasOwn(A, 's') + ':' + A.s2; }`),
  c('class-static', 'w3: subclass static field shadows the parent static', 43, '43:1',
    `function f(x){ class P { static s = 1; } class A extends P { static s = x; } return A.s + ':' + P.s; }`),
  c('class-static', 'w3: static field in a class extending null', 44, 'true:44',
    `function f(x){ class A extends null { static v = x; static p = Object.getPrototypeOf(this.prototype); } return (A.p === null) + ':' + A.v; }`),

  // NamedEvaluation reaches the anonymous class before its own static elements.
  c('class-static', 'w3: computed static key names an anonymous class before its static block runs', 45, 'k45|k45',
    `function f(x){ let seen; class A { static ['k' + x] = class { static { seen = this.name; } }; } return seen + '|' + A['k' + x].name; }`),
  c('class-static', 'w3: anonymous derived class field value: static block sees the field name', 46, 'c:P46',
    `function f(x){ let seen; class P { static p(){ return 'P'; } } class A { static c = class extends P { static { seen = this.name + ':' + super.p(); } }; } return seen + x; }`),
  c('class-static', 'w3: static name method of an anonymous class value is not overridden', 47, 'function:47',
    `function f(x){ class A { static c = class { static name(){ return x; } }; } return typeof A.c.name + ':' + A.c.name(); }`),

  // Closures, nesting and collections.
  c('class-static', 'w3: static blocks in a loop capture per-iteration bindings', 48, '0,1,2:48',
    `function f(x){ const fns = []; for (let i = 0; i < 3; i++) { class A { static { fns.push(() => i); } } } return fns.map(g => g()).join(',') + ':' + x; }`),
  c('class-static', 'w3: nested class static blocks keep their own this', 49, 'true:true:49',
    `function f(x){ let r; class O { static { const outer = this; class I { static { r = (this === I) + ':' + (outer === O); } } } } return r + ':' + x; }`),
  c('class-static', 'w3: many static blocks and fields in one class', 50, '51,53,55,57,59,61:62',
    `function f(x){ let n = x; class A { static { n++; } static a = n++; static { n++; } static b = n++; static { n++; } static c = n++; static { n++; } static d = n++; static { n++; } static e = n++; static { n++; } static g = n++; } return [A.a, A.b, A.c, A.d, A.e, A.g].join(',') + ':' + n; }`),
  c('class-static', 'w3: static elements survive collections during static initialisation', 51, '51:300:true',
    `function f(x){ class A { static keep = { v: x }; static { let s = 0; for (let i = 0; i < 300; i++) { const t = [i, { i }, 'g' + i]; s += t.length > 2 ? 1 : 0; } this.count = s; } static late = this.keep; } return A.keep.v + ':' + A.count + ':' + (A.late === A.keep); }`),
  c('class-static', 'w3: static field initializer calls a static method that reads a later field', 52, 'undefined|52',
    `function f(x){ class A { static early = A.read(); static value = x; static read(){ return this.value; } } return typeof A.early + '|' + A.value; }`),
  c('class-static', 'w3: arguments of a function expression in a static field initializer', 53, '2:53',
    `function f(x){ class A { static g = function(){ return arguments.length + ':' + arguments[1]; }; } return A.g(0, x); }`),

  // Contextual-keyword element names.
  c('class-static', 'w3: static field named static', 54, '54:true:false',
    `function f(x){ class A { static static = x; } return A.static + ':' + Object.hasOwn(A, 'static') + ':' + ('static' in new A()); }`),
  c('class-static', 'w3: static method named constructor beside a static field', 55, '55:true:56',
    `function f(x){ class A { static constructor(){ return x; } static v = this.constructor() + 1; } return A.constructor() + ':' + (A.prototype.constructor === A) + ':' + A.v; }`),
]);

// Uncaught guest errors (outcome error:<Name>).
export const w3StaticErrorCases = Object.freeze([
  c('class-static', 'w3: uncaught TypeError from a static block', 1, 'TypeError',
    `function f(x){ class A { static { null[x]; } } return 1; }`, { throws: true }),
  c('class-static', 'w3: uncaught TDZ ReferenceError in a static field', 1, 'ReferenceError',
    `function f(x){ class A { static v = later + x; } let later = 1; return A.v; }`, { throws: true }),
]);

// Early errors (ES2025 15.7.1 and 15.7.10): V8 and native QuickJS must throw
// SyntaxError when parsing; the coordinator compiler must reject with
// SyntaxError so nothing reaches packing. `expected` stays undefined (no
// runtime result exists); `reason` is the pinned QuickJS parser message the
// coordinator compiler reports.
const early = (feature, source, reason) => c('class-static', feature, 1, undefined, source, { earlyError: 'SyntaxError', reason });
export const w3StaticEarlyErrorCases = Object.freeze([
  early('w3: arguments in a static block',
    `function f(x){ class A { static { arguments; } } return x; }`, /'arguments' identifier is not allowed/),
  early('w3: arguments in an arrow inside a static block',
    `function f(x){ class A { static { (() => arguments)(); } } return x; }`, /'arguments' identifier is not allowed/),
  early('w3: arguments in a static field initializer',
    `function f(x){ class A { static v = arguments; } return x; }`, /'arguments' identifier is not allowed/),
  early('w3: await as an identifier reference in a static block',
    `function f(x){ class A { static { await; } } return x; }`, /unexpected 'await' keyword/),
  early('w3: await as a binding in a static block',
    `function f(x){ class A { static { var await = 1; } } return x; }`, /variable name expected/),
  early('w3: await as a label in a static block',
    `function f(x){ class A { static { await: ; } } return x; }`, /unexpected 'await' keyword/),
  early('w3: return in a static block',
    `function f(x){ class A { static { return; } } return x; }`, /return in a static initializer block/),
  early('w3: super() call in a static block',
    `function f(x){ class P {} class A extends P { static { super(); } } return x; }`, /super\(\) is only valid in a derived class constructor/),
  early('w3: static prototype field (literal name)',
    `function f(x){ class A { static prototype = x; } return 1; }`, /invalid method name/),
  early('w3: static constructor field (literal name)',
    `function f(x){ class A { static constructor = x; } return 1; }`, /invalid field name/),
  early('w3: lexical and var redeclaration in a static block',
    `function f(x){ class A { static { let v; var v; } } return x; }`, /invalid redefinition of lexical identifier/),
  early('w3: break out of a static block',
    `function f(x){ for (;;) { class A { static { break; } } } return x; }`, /break must be inside loop or switch/),
]);

// Admitted forms that stay explicit runtime boundaries (status 6), with the
// ES2025 result recorded as `normative`.
export const w3StaticUnsupportedCases = Object.freeze([
  c('class-static', 'w3: static arguments field on a class constructor', 1, 'unsupported',
    `function f(x){ class A { static arguments = x; } return A.arguments; }`, { normative: 1 }),
]);

// Symbol-keyed static fields are admitted after phase 3 integration.
export const w3StaticRejectedCases = Object.freeze([]);
