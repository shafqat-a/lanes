// Phase 4 next wave, worker 2: adversarial fixtures for public class instance
// fields (same shape as phase4-class-element-cases.js). Fixed expectations are
// ES2025 results, re-verified with V8 and the private native QuickJS build by
// check-phase4-next-w2.mjs; every non-throwing fixture changes with input + 1.
// Host-only fixtures: GPU execution is the coordinator's M1/Safari obligation.

const c = (area, feature, input, expected, source, extra = {}) => Object.freeze({ area, feature, input, expected, source, ...extra });
const A = 'class-fields-w2';

export const w2FieldCases = Object.freeze([
  // Initialization order.
  c(A, 'base fields after this binding, before body, in order', 1, 'a:undefined,b:1,ctor:2',
    `function f(x){ let log = []; class K { a = (log.push('a:' + typeof this.b), x); b = (log.push('b:' + this.a), x + 1); constructor(){ log.push('ctor:' + this.b); } } new K(); return log.join(','); }`),
  c(A, 'derived: args, base body, fields, then code after super()', 2, 'pre,arg,B,d,post:2',
    `function f(x){ let log = []; class B { constructor(){ log.push('B'); } } class D extends B { d = log.push('d'); constructor(){ log.push('pre'); super(log.push('arg')); log.push('post'); } } new D(); return log.join(',') + ':' + x; }`),
  c(A, 'derived fields on the override; body this is the override', 3, '4:true:true:tag,g,h',
    `function f(x){ const t = { tag: x }; class B { constructor(){ return t; } } class D extends B { g = this.tag + 1; constructor(){ super(); this.h = (this === t); } } const o = new D(); return o.g + ':' + o.h + ':' + (o === t) + ':' + Object.keys(t).join(); }`),
  c(A, 'base fields stay on the discarded this when base returns an override', 4, 'true:false:4:5:true:false',
    `function f(x){ let inner; const t = {}; class B { b = x; constructor(){ inner = this; return t; } } class D extends B { d = x + 1; } const o = new D(); return [o === t, 'b' in t, inner.b, t.d, inner instanceof D, 'd' in inner].join(':'); }`),
  c(A, 'later field reads an earlier one and a prototype method; later field undefined', 5, '5|11|undefined',
    `function f(x){ class K { a = x; b = this.twice() + 1; c = typeof this.d; d = 0; twice(){ return this.a * 2; } } const k = new K(); return k.a + '|' + k.b + '|' + k.c; }`),
  c(A, 'field without initializer is an own undefined data property', 6, 'true:undefined:true:6',
    `function f(x){ class B { get a(){ return 'getter'; } } class D extends B { a; } const o = new D(); const d = Object.getOwnPropertyDescriptor(o, 'a'); return Object.hasOwn(o, 'a') + ':' + o.a + ':' + d.writable + ':' + x; }`),
  c(A, 'duplicate field name: second initializer sees the first', 7, 'a:8',
    `function f(x){ class K { a = x; a = this.a + 1; } const k = new K(); return Object.keys(k).join() + ':' + k.a; }`),

  // CreateDataPropertyOrThrow (define, not set).
  c(A, 'own-class prototype setter is not invoked', 8, '0:8:false',
    `function f(x){ let calls = 0; class K { set v(n){ calls++; } v = x; } const k = new K(); const d = Object.getOwnPropertyDescriptor(k, 'v'); return calls + ':' + d.value + ':' + ('set' in d); }`),
  c(A, 'field shadows a getter-only prototype accessor', 9, '9:g',
    `function f(x){ class K { get v(){ return 'g'; } v = x; } return new K().v + ':' + K.prototype.v; }`),
  c(A, 'non-extensible override: configurable existing redefined, new key throws', 10, 'TypeError:10:false',
    `function f(x){ const o = Object.preventExtensions({ a: 0 }); class B { constructor(){ return o; } } class D extends B { a = x; b = 2; } let r; try { new D(); r = 'no'; } catch (e) { r = e.constructor.name; } return r + ':' + o.a + ':' + ('b' in o); }`),
  c(A, 'frozen override throws TypeError and keeps the old value', 11, 'true:1:11',
    `function f(x){ const o = Object.freeze({ a: 1 }); class B { constructor(){ return o; } } class D extends B { a = x; } try { new D(); } catch (e) { return (e instanceof TypeError) + ':' + o.a + ':' + x; } return 'no'; }`),
  c(A, 'sealed override: writable non-configurable property throws', 12, 'TypeError:1:12',
    `function f(x){ const o = Object.seal({ a: 1 }); class B { constructor(){ return o; } } class D extends B { a = x; } try { new D(); } catch (e) { return e.constructor.name + ':' + o.a + ':' + x; } return 'no'; }`),
  c(A, 'non-writable configurable property becomes a writable enumerable field', 13, 'truetruetrue13',
    `function f(x){ const o = {}; Object.defineProperty(o, 'a', { value: 0, writable: false, enumerable: false, configurable: true }); class B { constructor(){ return o; } } class D extends B { a = x; } new D(); const d = Object.getOwnPropertyDescriptor(o, 'a'); return '' + d.writable + d.enumerable + d.configurable + d.value; }`),
  c(A, 'redefined field keeps the existing key position', 14, 'a,b,c:14',
    `function f(x){ const o = { a: 0, b: 0 }; class B { constructor(){ return o; } } class D extends B { b = x; c = 1; a = 2; } new D(); return Object.keys(o).join() + ':' + o.b; }`),
  c(A, 'function override: configurable name redefined as enumerable field', 15, 'true:n15:15:true',
    `function f(x){ function g(){} class B { constructor(){ return g; } } class D extends B { name = 'n' + x; extra = x; } const o = new D(); return (o === g) + ':' + g.name + ':' + g.extra + ':' + Object.getOwnPropertyDescriptor(g, 'name').enumerable; }`),
  c(A, 'function override: non-configurable computed prototype field throws', 16, 'TypeError:true:16',
    `function f(x){ function g(){} const p = g.prototype; class B { constructor(){ return g; } } class D extends B { ['prototype'] = 1; } try { new D(); } catch (e) { return e.constructor.name + ':' + (g.prototype === p) + ':' + x; } return 'no'; }`),
  c(A, 'array override: index fields extend length', 17, '3:17:true',
    `function f(x){ class B { constructor(){ return []; } } class D extends B { 0 = x; 2 = 'z'; } const o = new D(); return o.length + ':' + o[0] + ':' + Array.isArray(o); }`),
  c(A, 'String wrapper override: index beyond length ok, own index throws', 18, 'z:TypeError:18',
    `function f(x){ class B { constructor(){ return new String('ab'); } } class D1 extends B { 2 = 'z'; } class D2 extends B { 0 = 'z'; } let r = new D1()[2]; try { new D2(); } catch (e) { r += ':' + e.constructor.name; } return r + ':' + x; }`),
  c(A, 'Error override: own message redefined enumerable', 19, 'f19:message:true',
    `function f(x){ class B { constructor(){ return new Error('m'); } } class D extends B { message = 'f' + x; } const o = new D(); return o.message + ':' + Object.keys(o).join() + ':' + (o instanceof Error); }`),
  c(A, 'unmapped arguments override: length redefined, callee throws', 20, '20:TypeError',
    `function f(x){ class B { constructor(){ return arguments; } } class D1 extends B { length = x; } class D2 extends B { callee = 1; } let r = new D1(1, 2).length + ''; try { new D2(); } catch (e) { r += ':' + e.constructor.name; } return r; }`),

  // Constructor return cases.
  c(A, 'derived explicit return undefined after super keeps fields', 21, 'true:21',
    `function f(x){ class B {} class D extends B { d = x; constructor(){ super(); return undefined; } } const o = new D(); return (o instanceof D) + ':' + o.d; }`),
  c(A, 'derived primitive return throws TypeError after fields ran', 22, 'TypeError:1:22',
    `function f(x){ let ran = 0; class B {} class D extends B { d = ran++; constructor(){ super(); return x; } } try { new D(); } catch (e) { return e.constructor.name + ':' + ran + ':' + x; } return 'no'; }`),
  c(A, 'derived primitive return without super is TypeError, base never runs', 23, 'TypeError:0:23',
    `function f(x){ let base = 0; class B { constructor(){ base++; } } class D extends B { d = 1; constructor(){ return x; } } try { new D(); } catch (e) { return e.constructor.name + ':' + base + ':' + x; } return 'no'; }`),
  c(A, 'derived undefined return without super is ReferenceError', 24, 'ReferenceError24',
    `function f(x){ class B {} class D extends B { d = 1; constructor(){ return; } } try { new D(); } catch (e) { return e.constructor.name + x; } return 'no'; }`),
  c(A, 'derived null return throws TypeError', 25, 'TypeError25',
    `function f(x){ class B {} class D extends B { d = 1; constructor(){ super(); return null; } } try { new D(); } catch (e) { return e.constructor.name + x; } return 'no'; }`),
  c(A, 'base object return discards the initialized this', 26, 'false:26:1',
    `function f(x){ let inits = 0; class K { a = ++inits; constructor(){ return { b: x }; } } const o = new K(); return ('a' in o) + ':' + o.b + ':' + inits; }`),
  c(A, 'base string/null/undefined returns are ignored', 27, '27,27,27',
    `function f(x){ const make = v => class { a = x; constructor(){ return v; } }; return [new (make('s'))().a, new (make(null))().a, new (make(undefined))().a].join(); }`),

  // Computed keys and ToPropertyKey.
  c(A, 'computed keys once, at definition, interleaved with methods and statics', 28, 'e1,ts1,e2,ts2,e3,ts3,def,init1:28',
    `function f(x){ let log = []; const k = n => ({ toString(){ log.push('ts' + n); return 'k' + n; } }); class K { [(log.push('e1'), k(1))] = log.push('init1'); [(log.push('e2'), k(2))](){} static [(log.push('e3'), k(3))] = 0; } log.push('def'); new K(); return log.join(',') + ':' + x; }`),
  c(A, 'ToPropertyKey falls back from toString to valueOf', 29, 'k29:t,v',
    `function f(x){ let log = []; const key = { toString(){ log.push('t'); return {}; }, valueOf(){ log.push('v'); return 'k' + x; } }; class K { [key] = 1; } return Object.keys(new K())[0] + ':' + log.join(); }`),
  c(A, 'ToPropertyKey with no primitive result throws TypeError at definition', 30, 'TypeError:undefined:30',
    `function f(x){ let C; try { C = class { [{ toString(){ return {}; }, valueOf(){ return {}; } }] = 1; }; } catch (e) { return e.constructor.name + ':' + typeof C + ':' + x; } return 'no'; }`),
  c(A, 'ToPropertyKey abrupt completion keeps identity and stops later keys', 31, 'true:0:31',
    `function f(x){ const err = new Error('k'); let later = 0; try { class K { [{ toString(){ throw err; } }] = 1; [later++] = 2; } } catch (e) { return (e === err) + ':' + later + ':' + x; } return 'no'; }`),
  c(A, 'computed primitive keys: number, -0, boolean, null, undefined', 32, '0,48,true,null,undefined',
    `function f(x){ class K { [x * 1.5] = 1; [-0] = 2; [true] = 3; [null] = 4; [undefined] = 5; } return Object.keys(new K()).join(); }`),
  c(A, 'computed constructor key is an ordinary own field', 33, 'true:33:true',
    `function f(x){ class K { ['constructor'] = x; } const k = new K(); return Object.hasOwn(k, 'constructor') + ':' + k.constructor + ':' + (K.prototype.constructor === K); }`),
  c(A, 'each class evaluation re-evaluates computed keys', 34, 'k0,k1,k2:34',
    `function f(x){ let n = 0; const make = () => class { ['k' + n++] = x; }; const keys = [new (make())(), new (make())(), new (make())()].map(o => Object.keys(o)[0]); return keys.join() + ':' + x; }`),

  // Anonymous function naming.
  c(A, 'anonymous function names from field keys', 35, 'p|h|1|k35|36|C|',
    `function f(x){ const key = 'k' + x; class K { p = (function(){}); g = function h(){}; 1 = () => 0; [key] = class {}; [x + 1] = function(){}; c = class C {}; q = (0, function(){}); } const k = new K(); return [k.p.name, k.g.name, k[1].name, k[key].name, k[x + 1].name, k.c.name, k.q.name].join('|'); }`),
  c(A, 'class field value with static name method keeps it', 36, 'function36',
    `function f(x){ class K { c = class { static name(){} }; } return typeof new K().c.name + x; }`),

  // this / super / new.target / arguments inside initializers.
  c(A, 'super getter in initializer uses the instance as receiver', 37, 'B:37',
    `function f(x){ class B { get who(){ return 'B:' + this.tag; } } class D extends B { tag = x; w = super.who; } return new D().w; }`),
  c(A, 'super assignment in initializer defines on the instance', 38, '38:false:true',
    `function f(x){ class B {} class D extends B { s = (super.q = x); } const o = new D(); return o.q + ':' + ('q' in B.prototype) + ':' + Object.hasOwn(o, 'q'); }`),
  c(A, 'new.target undefined in initializer arrow, derived class', 39, 'undefined:undefined:39',
    `function f(x){ class B {} class D extends B { t = (() => new.target)(); u = new.target; } const o = new D(); return typeof o.t + ':' + typeof o.u + ':' + x; }`),
  c(A, 'ordinary function in initializer has its own arguments and this', 40, '3:undefined:40',
    `function f(x){ class K { g = function(){ return arguments.length; }; h = function(){ return this; }; } const k = new K(); const h = k.h; return k.g(1, 2, 3) + ':' + typeof h() + ':' + x; }`),
  c(A, 'arrow field captures the derived override object', 41, 'true:41',
    `function f(x){ const t = { v: x }; class B { constructor(){ return t; } } class D extends B { self = () => this; } const o = new D(); return (o.self() === t) + ':' + o.self().v; }`),
  c(A, 'nested class field this is the inner instance', 42, 'false:true:42',
    `function f(x){ class K { inner = new (class { me = this; })(); v = x; } const k = new K(); return (k.inner.me === k) + ':' + (k.inner.me === k.inner) + ':' + k.v; }`),

  // Exceptions and per-instance evaluation.
  c(A, 'initializer throw identity; later fields and body skipped', 43, 'true:a:false:43',
    `function f(x){ const err = { tag: 'e' }; let log = ''; class K { a = (log += 'a'); b = (() => { throw err; })(); c = (log += 'c'); constructor(){ log += 'ctor'; } } try { new K(); } catch (e) { return (e === err) + ':' + log + ':' + (log.includes('ctor')) + ':' + x; } return 'no'; }`),
  c(A, 'derived initializer throw skips code after super()', 44, 'true:B:44',
    `function f(x){ const err = new RangeError('r'); let log = ''; class B { constructor(){ log += 'B'; } } class D extends B { d = (() => { throw err; })(); constructor(){ super(); log += 'post'; } } try { new D(); } catch (e) { return (e === err) + ':' + log + ':' + x; } return 'no'; }`),
  c(A, 'base constructor throw: derived fields never run', 45, 'true:0:45',
    `function f(x){ const err = {}; let ran = 0; class B { constructor(){ throw err; } } class D extends B { d = ran++; } try { new D(); } catch (e) { return (e === err) + ':' + ran + ':' + x; } return 'no'; }`),
  c(A, 'initializers are separate per-instance evaluations', 46, 'false:false:1:46',
    `function f(x){ class K { o = {}; g = () => this; n = x; } const a = new K(), b = new K(); a.n++; return (a.o === b.o) + ':' + (a.g === b.g) + ':' + (a.n - b.n) + ':' + b.n; }`),
  c(A, 'super() twice: base runs twice, fields once, ReferenceError', 47, '2:1:ReferenceError:0:47',
    `function f(x){ let b = 0, d = 0; class B { constructor(){ b++; } } class D extends B { v = d++; constructor(){ super(); try { super(); } catch (e) { this.err = e.constructor.name; } } } const o = new D(); return [b, d, o.err, o.v, x].join(':'); }`),
  c(A, '__proto__ field defines an own property, prototype unchanged', 52, 'true:52:true',
    `function f(x){ class K { __proto__ = x; } const k = new K(); return (Object.getPrototypeOf(k) === K.prototype) + ':' + k.__proto__ + ':' + Object.hasOwn(k, '__proto__'); }`),
  c(A, 'numeric literal field names canonicalise, names follow', 53, '16,1000,1.5|16|1.5|53',
    `function f(x){ class K { 0x10 = function(){}; 1.5 = () => 0; 1e3 = x; } const k = new K(); return Object.keys(k).join() + '|' + k[16].name + '|' + k['1.5'].name + '|' + k[1000]; }`),
  c(A, 'contextual keywords as field names', 54, 'get,set,static,async:54:2',
    `function f(x){ class K { get = x; set; static; async = 1; static static = 2; } const k = new K(); return Object.keys(k).join() + ':' + k.get + ':' + K.static; }`),
  c(A, 'field values survive collections', 48, '48:300:true',
    `function f(x){ class K { a = [x, 'p' + x]; b = { k: x }; } const keep = new K(); let n = 0; for (let i = 0; i < 300; i++) { const t = new K(); if (t.a[1] === 'p' + x && t.b.k === x) n++; } return keep.a[0] + ':' + n + ':' + (keep.b.k === keep.a[0]); }`),
]);

// Uncaught guest errors (outcome error:<Name>).
export const w2FieldErrorCases = Object.freeze([
  c(A, 'uncaught derived primitive return', 1, 'TypeError',
    `function f(x){ class B {} class D extends B { d = x; constructor(){ super(); return x; } } return new D(); }`, { throws: true }),
  c(A, 'uncaught second super()', 1, 'ReferenceError',
    `function f(x){ class B {} class D extends B { d = x; constructor(){ super(); super(); } } return new D().d; }`, { throws: true }),
  c(A, 'uncaught frozen-override field TypeError', 1, 'TypeError',
    `function f(x){ const o = Object.freeze({ a: 0 }); class B { constructor(){ return o; } } class D extends B { a = x; } return new D().a; }`, { throws: true }),
]);

// Admitted by the lead-applied w2 patches (formerly status-6 boundaries and
// pinned-QuickJS over-rejections). `fixedBy` names the applied patch.
export const w2FieldFixedCases = Object.freeze([
  c(A, 'array override: length field throws TypeError (non-configurable)', 49, 'TypeError:0:49',
    `function f(x){ class B { constructor(){ return []; } } class D extends B { length = 5; } let o = []; try { new D(); } catch (e) { return e.constructor.name + ':' + o.length + ':' + x; } return 'no'; }`, { fixedBy: 'w2-define-own-data.diff (array-length)' }),
  c(A, 'sloppy base returns mapped arguments: field keeps the mapping', 50, '50:50:2',
    `function f(x){ let get; function B(a){ get = () => a; return arguments; } class D extends B { 0 = x; } const o = new D(1, 2); return o[0] + ':' + get() + ':' + o.length; }`, { fixedBy: 'w2-define-own-data.diff (mapped-arguments)' }),
  c(A, 'instance field named prototype', 50, '50:object',
    `function f(x){ class K { prototype = x; } return new K().prototype + ':' + typeof K.prototype; }`, { fixedBy: 'w2-instance-prototype-field.diff' }),
  c(A, 'string-literal instance field named prototype', 51, 'prototype51',
    `function f(x){ class K { 'prototype' = x; } return Object.keys(new K()).join() + x; }`, { fixedBy: 'w2-instance-prototype-field.diff' }),
]);

// Early errors: must stay SyntaxError at compile time (V8 and the compiler).
export const w2FieldRejectedCases = Object.freeze([
  c(A, 'arguments in a field initializer', 1, undefined,
    `function f(x){ class K { a = arguments; } return new K().a; }`, { reason: /arguments/ }),
  c(A, 'arguments in an arrow inside a field initializer', 1, undefined,
    `function f(x){ class K { a = () => arguments; } return new K().a(); }`, { reason: /arguments/ }),
  c(A, 'field named constructor', 1, undefined,
    `function f(x){ class K { constructor = x; } return new K(); }`, { reason: /invalid field name/ }),
  c(A, 'string-literal field named constructor', 1, undefined,
    `function f(x){ class K { 'constructor' = x; } return new K(); }`, { reason: /invalid field name/ }),
  c(A, 'static field named prototype', 1, undefined,
    `function f(x){ class K { static prototype = x; } return K; }`, { reason: /invalid method name/ }),
  c(A, 'static field named constructor', 1, undefined,
    `function f(x){ class K { static constructor = x; } return K; }`, { reason: /invalid field name/ }),
  c(A, 'super() call in a field initializer', 1, undefined,
    `function f(x){ class B {} class D extends B { a = super(); } return new D(); }`, { reason: /super/ }),
]);
