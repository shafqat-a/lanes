// Phase 4 next wave, assignment 6: global object / sloppy global this fixtures
// (phase4-global.js). Pure data. Every program is ONE named function
// declaration called as `<name>(input)` with an undefined this.
//
// Fields: feature, input, expected (value for `input`; the check also asserts
// input+1 changes it), source, mode ('global' | 'classic': packing mode the
// plan must choose), spec (ES2025 clause).
//   globalCases            value fixtures: V8 (fresh realm) and native QuickJS agree
//   globalErrorCases       uncaught guest errors: expected = error name
//   globalHostCases        host/implementation-defined facets of the global
//                          object (ES2025 19: [[Prototype]] and extra properties
//                          are host-defined): fixed by this design, checked
//                          against native QuickJS only; V8/Node differs
//   globalV8DeviationCases normative ES2025 = expected; QuickJS agrees, V8 does not
//   globalUnsupportedCases admitted (pack), runtime status 6 is the GPU obligation;
//                          `normative` records the ES2025 result (V8 checked)
//   globalRejectedCases    compiler-rejected (packProgram/entrySource SyntaxError)
//   globalKnownDeviationCases ES2025 normative vs. engine behaviour that the
//                          GPU inherits from QuickJS bytecode (documented)
const value = (feature, input, expected, source, extra = {}) => Object.freeze({ feature, input, expected, source, mode: 'global', area: 'global', ...extra });

export const globalCases = Object.freeze([
  value('global-dynamic-unimplemented-get', 3, 'function3', `function f(x){ return typeof globalThis['Sym' + 'bol'] + x; }`),
  value('global-descriptor-unimplemented', 3, 'true3', `function f(x){ return Object.getOwnPropertyDescriptor(globalThis, 'Re' + 'flect').writable + '' + x; }`),
  value('reference-symbol', 3, 'function3', `function f(x){ return typeof Symbol + x; }`, { mode: 'classic' }),
  value('reference-symbol-in-global-mode', 3, 'function3', `function f(x){ w6 = 1; return typeof Symbol + x; }`),

  // --- this binding (10.2.1.2 OrdinaryCallBindThis) ---
  value('sloppy-entry-this-is-global', 3, 'true:3', `function f(x){ return (this === globalThis) + ':' + x; }`, { spec: '10.2.1.2 step 6.a' }),
  value('sloppy-plain-call-this-global', 3, 'true:3', `function f(x){ function g(){ return this; } return (g() === globalThis) + ':' + x; }`, { spec: '10.2.1.2 step 6.a' }),
  value('sloppy-plain-call-typeof-this', 3, 'u1:object3', `function f(x){function g(){return typeof this;}return 'u1:'+g()+x;}`, { spec: '10.2.1.2 (w7 u1 now admitted)' }),
  value('sloppy-entry-arrow-this-global', 3, 'u2:object3', `function f(x){var a=()=>typeof this;return 'u2:'+a()+x;}`, { spec: '10.2.1.2 (w7 u2)' }),
  value('sloppy-arrow-this-identity', 3, 'true3', `function f(x){ var a = () => this; return (a() === globalThis) + '' + x; }`, { spec: '10.2.1.2; 15.3 arrow lexical this' }),
  value('sloppy-call-null-this-global', 3, 'true:3', `function f(x){ function g(){ return this; } return (g.call(null) === globalThis) + ':' + x; }`, { spec: '10.2.1.2 step 6.a' }),
  value('sloppy-call-undefined-this-global', 3, 'true:3', `function f(x){ function g(){ return this; } return (g.call(undefined) === globalThis) + ':' + x; }`, { spec: '10.2.1.2 step 6.a' }),
  value('sloppy-apply-null-this-global', 3, 'true:3', `function f(x){ function g(){ return this; } return (g.apply(null, []) === globalThis) + ':' + x; }`, { spec: '10.2.1.2 step 6.a' }),
  value('sloppy-bind-undefined-this-global', 3, 'true:3', `function f(x){ function g(){ return this; } return (g.bind(undefined)() === globalThis) + ':' + x; }`, { spec: '10.4.1.1; 10.2.1.2' }),
  value('sloppy-bind-null-typeof', 3, 'u6:object3', `function f(x){function g(){return typeof this;}return 'u6:'+g.bind(null)()+x;}`, { spec: '10.2.1.2 (w7 u6)' }),
  value('sloppy-call-number-boxed', 3, 'object:true:true:3', `function f(x){ function g(){ return typeof this + ':' + (this instanceof Number) + ':' + (this == x); } return g.call(x) + ':' + x; }`, { spec: '10.2.1.2 step 6.b ToObject' }),
  value('sloppy-call-string-boxed', 3, 'object:true:2:3', `function f(x){ function g(){ return typeof this + ':' + (this instanceof String) + ':' + this.length; } return g.call('s' + x) + ':' + x; }`, { spec: '10.2.1.2 step 6.b ToObject' }),
  value('sloppy-call-boolean-boxed', 3, 'object:true:3', `function f(x){ function g(){ return typeof this + ':' + (this instanceof Boolean); } return g.call(x > 2) + ':' + x; }`, { spec: '10.2.1.2 step 6.b ToObject' }),
  value('sloppy-boxed-this-stable', 3, 'true3', `function f(x){ function g(){ return this === this; } return g.call(x) + '' + x; }`, { spec: '10.2.1.2 (ToObject once per call)' }),
  value('sloppy-global-this-stable', 3, 'true3', `function f(x){ function g(){ return this; } return (g() === g.call(null)) + '' + x; }`, { spec: '9.3 realm [[GlobalObject]]' }),
  value('strict-plain-call-this-undefined', 3, 'undefined:3', `function f(x){ function g(){ 'use strict'; return this; } return typeof g() + ':' + x; }`, { mode: 'classic', spec: '10.2.1.2 step 5 (strict)' }),
  value('strict-call-null-this-null', 3, 'true:3', `function f(x){ function g(){ 'use strict'; return this === null; } return g.call(null) + ':' + x; }`, { mode: 'classic', spec: '10.2.1.2 step 5' }),
  value('strict-call-number-unboxed', 3, 'number:3', `function f(x){ function g(){ 'use strict'; return typeof this; } return g.call(x) + ':' + x; }`, { mode: 'classic', spec: '10.2.1.2 step 5' }),
  value('sloppy-callback-this-global', 3, 3, `function f(x){ return [x].map(function(v){ return this === globalThis ? v : -1; })[0]; }`, { spec: '23.1.3.21 Array.prototype.map (thisArg undefined)' }),
  value('sloppy-callback-thisarg-boxed', 3, 'object3', `function f(x){ return [1].map(function(){ return typeof this; }, x)[0] + x; }`, { spec: '23.1.3.21; 10.2.1.2' }),
  value('sloppy-detached-method-this-global', 3, 'u7:true3', `function f(x){var o={m(){return this!==o;}};var m=o.m;return 'u7:'+m()+x;}`, { spec: '13.3.6.2 (w7 u7)' }),
  value('sloppy-this-unreached-still-bound', 3, 'u5:3', `function f(x){function g(t){if(t)return this;return 'u5:'+x;}return g(0);}`, { spec: '10.2.1.2 (w7 u5)' }),
  value('sloppy-this-property-becomes-global', 3, 3, `function f(x){ function g(){ this.w6p = x; } g(); return w6p; }`, { spec: '10.2.1.2; 9.1.1.2.6 GetBindingValue (object record)' }),
  value('sloppy-this-reads-global-binding', 3, 'true3', `function f(x){ function g(){ return this.Math === Math && this.f === f; } return g() + '' + x; }`, { spec: '19.1; 16.1.7 CreateGlobalFunctionBinding' }),
  // --- global object identity (19.1, 9.3.2 SetDefaultGlobalBindings) ---
  value('globalthis-self', 3, 'true3', `function f(x){ return (globalThis.globalThis === globalThis) + '' + x; }`, { spec: '19.1.1 globalThis' }),
  value('globalthis-equals-sloppy-this', 3, 'u10:true3', `function f(x){return 'u10:'+(globalThis===this)+x;}`, { spec: '19.1 (w7 u10)' }),
  value('globalthis-math-json-identity', 3, 'true3', `function f(x){ return (globalThis.Math === Math && globalThis.JSON === JSON && globalThis['Ma' + 'th'].max(x, 1) === x) + '' + x; }`, { spec: '19.4' }),
  value('globalthis-constructor-identity', 3, 'true3', `function f(x){ return (globalThis.Object === Object && globalThis.Array === Array && globalThis.Function === Function && globalThis.Number === Number && globalThis.String === String && globalThis.Boolean === Boolean) + '' + x; }`, { spec: '19.3' }),
  value('globalthis-error-identity', 3, 'true3', `function f(x){ var g = globalThis; return (g.Error === Error && g.TypeError === TypeError && g.ReferenceError === ReferenceError && g.RangeError === RangeError && g.SyntaxError === SyntaxError && g.URIError === URIError && g.EvalError === EvalError) + '' + x; }`, { spec: '19.3' }),
  value('globalthis-parse-functions', 3, 56, `function f(x){ return globalThis.parseInt('4' + x) + (globalThis.parseFloat === parseFloat ? 13 : 0); }`, { spec: '19.2.4, 19.2.5' }),
  value('globalthis-value-properties', 3, 'true3', `function f(x){ var g = globalThis; return (g.NaN !== g.NaN && g.Infinity === 1 / 0 && g.undefined === void 0 && 'undefined' in g) + '' + x; }`, { spec: '19.1.2-19.1.4' }),
  value('global-descriptor-math', 3, 'true,true,false,true3', `function f(x){ var d = Object.getOwnPropertyDescriptor(globalThis, 'Math'); return [d.value === Math, d.writable, d.enumerable, d.configurable].join() + x; }`, { spec: '19 (writable, non-enumerable, configurable)' }),
  value('global-descriptor-globalthis', 3, 'true,true,false,true3', `function f(x){ var d = Object.getOwnPropertyDescriptor(globalThis, 'globalThis'); return [d.value === globalThis, d.writable, d.enumerable, d.configurable].join() + x; }`, { spec: '19.1.1' }),
  value('global-descriptor-nan-undefined', 3, 'false,false,false|false,false,false3', `function f(x){ var a = Object.getOwnPropertyDescriptor(globalThis, 'NaN'), b = Object.getOwnPropertyDescriptor(globalThis, 'undefined'); return [a.writable, a.enumerable, a.configurable].join() + '|' + [b.writable, b.enumerable, b.configurable].join() + x; }`, { spec: '19.1.2, 19.1.4' }),
  value('global-descriptor-entry-function', 3, 'true,true,true,false3', `function f(x){ var d = Object.getOwnPropertyDescriptor(globalThis, 'f'); return [d.value === f, d.writable, d.enumerable, d.configurable].join() + x; }`, { spec: '16.1.7 step 5 / 9.1.1.4.18 CreateGlobalFunctionBinding' }),
  value('global-entry-named-like-intrinsic', 3, 'true,function,true,false3', `function Math(x){ var d = Object.getOwnPropertyDescriptor(globalThis, 'Math'); return [globalThis.Math === Math, typeof Math, d.enumerable, d.configurable].join() + x; }`, { spec: '9.1.1.4.18 (configurable existing property is redefined)' }),
  value('global-own-and-inherited', 3, 'true,true,false,true3', `function f(x){ return [globalThis.hasOwnProperty('f'), Object.prototype.hasOwnProperty.call(globalThis, 'Math'), globalThis.hasOwnProperty('toString'), 'toString' in globalThis].join() + x; }`, { spec: '7.3.12 HasProperty' }),
  value('global-in-operator', 3, 'true,true,false3', `function f(x){ return ['Math' in globalThis, 'f' in globalThis, 'w6none' in globalThis].join() + x; }`, { spec: '13.10.1' }),
  value('global-in-unimplemented-name', 3, 'true3', `function f(x){ return ('Sym' + 'bol' in globalThis) + '' + x; }`, { spec: '19.3.33 (exists; HasProperty does not read it)' }),
  value('global-is-extensible', 3, 'true3', `function f(x){ return Object.isExtensible(globalThis) + '' + x; }`, { spec: '9.3.2 (ordinary extensible global)' }),
  value('global-property-is-enumerable', 3, 'false,true3', `function f(x){ return [globalThis.propertyIsEnumerable('Math'), globalThis.propertyIsEnumerable('f')].join() + x; }`, { spec: '19; 9.1.1.4.18' }),
  // --- free identifier references (9.1.1.4 global environment record) ---
  value('typeof-undeclared', 3, 'u8:undefined3', `function f(x){return 'u8:'+typeof notDeclaredAnywhere+x;}`, { spec: '13.5.3.1 (w7 u8)' }),
  value('typeof-intrinsics-global-mode', 3, 'object,object,function,function3', `function f(x){ return [typeof globalThis, typeof Math, typeof parseInt, typeof Object].join() + x; }`, { spec: '13.5.3' }),
  value('undeclared-read-caught', 3, 'ReferenceError:true3', `function f(x){ try { return w6undeclared; } catch (e) { return e.name + ':' + (e instanceof ReferenceError) + x; } }`, { spec: '6.2.5.5 GetValue step 3.a' }),
  value('implicit-global-assignment', 3, 'u11:3', `function f(x){implicitGlobalW7=x;return 'u11:'+implicitGlobalW7;}`, { spec: '6.2.5.6 PutValue step 3.b (w7 u11)' }),
  value('implicit-global-visible-on-object', 3, '3:3', `function f(x){ w6a = x; return w6a + ':' + globalThis.w6a; }`, { spec: '6.2.5.6 step 3.b Set(globalObj)' }),
  value('implicit-global-descriptor', 3, '3,true,true,true', `function f(x){ w6b = x; var d = Object.getOwnPropertyDescriptor(globalThis, 'w6b'); return [d.value, d.writable, d.enumerable, d.configurable].join(); }`, { spec: '10.1.9.2 OrdinarySetWithOwnDescriptor (CreateDataProperty)' }),
  value('implicit-global-from-nested-function', 3, 4, `function f(x){ function g(){ w6n = x + 1; } g(); return w6n; }`, { spec: '6.2.5.6' }),
  value('implicit-global-from-callback', 3, 6, `function f(x){ [1, 2].forEach(function(v){ w6sum = (typeof w6sum === 'number' ? w6sum : x) + v; }); return w6sum; }`, { spec: '6.2.5.6; 13.5.3.1' }),
  value('implicit-global-compound', 3, 5, `function f(x){ w6c = 1; w6c += x; w6c++; return w6c; }`, { spec: '13.15.2; 13.4.2.1' }),
  value('implicit-global-for-in-target', 3, 'b3', `function f(x){ for (w6k in { a: 1, b: 2 }) {} return w6k + x; }`, { spec: '14.7.5.7 ForIn/OfBodyEvaluation (lhs PutValue)' }),
  value('implicit-global-destructuring', 3, '3:4', `function f(x){ [w6d1, w6d2] = [x, x + 1]; return w6d1 + ':' + globalThis.w6d2; }`, { spec: '13.15.5.5 IteratorDestructuringAssignmentEvaluation' }),
  value('global-object-write-visible-as-binding', 3, 3, `function f(x){ globalThis.w6o = x; return w6o; }`, { spec: '9.1.1.2.6 GetBindingValue' }),
  value('intrinsic-binding-write-through', 3, '3:3', `function f(x){ Math = x; return globalThis.Math + ':' + Math; }`, { spec: '9.1.1.4.5 SetMutableBinding (object record)' }),
  value('intrinsic-object-write-through', 3, 3, `function f(x){ globalThis.JSON = x; return JSON; }`, { spec: '9.1.1.2.6' }),
  value('entry-binding-reassign', 3, '3:3', `function f(x){ f = x; return globalThis.f + ':' + f; }`, { spec: '9.1.1.4.5' }),
  value('entry-binding-object-write', 3, 3, `function f(x){ globalThis.f = x; return f; }`, { spec: '9.1.1.2.6' }),
  value('sloppy-readonly-assignment-ignored', 3, 'true,true,true3', `function f(x){ NaN = x; undefined = x; Infinity = x; return [NaN !== NaN, undefined === void 0, Infinity === 1 / 0].join() + x; }`, { mode: 'classic', spec: '10.1.9.2 (Set returns false; sloppy PutValue ignores)' }),
  value('sloppy-readonly-assignment-ignored-global-mode', 3, 'true,true,true3', `function f(x){ NaN = x; undefined = x; Infinity = x; return [globalThis.NaN !== NaN, undefined === void 0, Infinity === 1 / 0].join() + x; }`, { spec: '10.1.9.2 (non-writable global object property)' }),
  value('strict-readonly-assignment-typeerror', 3, 'TypeError3', `function f(x){ 'use strict'; try { NaN = x; return 'no'; } catch (e) { return e.name + x; } }`, { mode: 'classic', spec: '9.1.1.2.5 SetMutableBinding step 5 (S true)' }),
  value('strict-readonly-assignment-typeerror-global-mode', 3, 'TypeError3', `function f(x){ 'use strict'; try { undefined = globalThis; return 'no'; } catch (e) { return e.name + x; } }`, { spec: '9.1.1.2.5 step 5' }),
  value('strict-undeclared-assignment-referenceerror', 3, 'ReferenceError:undefined3', `function f(x){ 'use strict'; try { w6s = x; return 'no'; } catch (e) { return e.name + ':' + typeof w6s + x; } }`, { spec: '6.2.5.6 PutValue step 3.a' }),
  value('strict-assignment-existing-global', 3, 3, `function f(x){ globalThis.w6t = 0; (function(){ 'use strict'; w6t = x; })(); return w6t; }`, { spec: '9.1.1.2.5' }),
  value('sloppy-assignment-inherited-binding', 3, 'true:3', `function f(x){ valueOf = x; return Object.prototype.hasOwnProperty.call(globalThis, 'valueOf') + ':' + valueOf; }`, { spec: '9.1.1.2.5' }),
  value('inherited-binding-read', 3, 'true3', `function f(x){ return (hasOwnProperty === Object.prototype.hasOwnProperty) + '' + x; }`, { spec: '9.1.1.2.1 / 9.1.1.2.6 (prototype chain of the global object)' }),
  value('delete-implicit-global', 3, 'true:undefined3', `function f(x){ w6del = x; var r = delete w6del; return r + ':' + typeof w6del + x; }`, { spec: '13.5.1.2 delete (environment record DeleteBinding)' }),
  value('delete-entry-binding-false', 3, 'false:false:function3', `function f(x){ return (delete f) + ':' + (delete globalThis.f) + ':' + typeof f + x; }`, { spec: '9.1.1.4.7 DeleteBinding; non-configurable' }),
  value('delete-undeclared-true', 3, 'true3', `function f(x){ return (delete w6never) + '' + x; }`, { spec: '13.5.1.2 step 3 (unresolvable -> true)' }),
  value('delete-intrinsic-then-referenceerror', 3, 'true:ReferenceError:undefined3', `function f(x){ var r = delete JSON; try { JSON; return 'no'; } catch (e) { return r + ':' + e.name + ':' + typeof JSON + x; } }`, { spec: '9.1.1.4.7; 6.2.5.5' }),
  value('delete-via-object-then-binding-gone', 3, 'undefined3', `function f(x){ w6g2 = 1; delete globalThis.w6g2; return typeof w6g2 + x; }`, { spec: '9.1.1.2.1' }),
  value('global-getter-binding', 3, 3, `function f(x){ Object.defineProperty(globalThis, 'w6get', { get: function(){ return this === globalThis ? x : -1; }, configurable: true }); return w6get; }`, { spec: '9.1.1.2.6 Get(bindingObject, N)' }),
  value('global-getter-typeof', 3, 'number3', `function f(x){ Object.defineProperty(globalThis, 'w6gt', { get: function(){ return x; }, configurable: true }); return typeof w6gt + x; }`, { spec: '13.5.3.1' }),
  value('global-setter-binding', 3, 'true:3', `function f(x){ var seen; Object.defineProperty(globalThis, 'w6set', { set: function(v){ seen = (this === globalThis) + ':' + v; }, configurable: true }); w6set = x; return seen; }`, { spec: '9.1.1.2.5 Set(bindingObject, N, V)' }),
  value('global-readonly-defined-sloppy-ignored', 3, 3, `function f(x){ Object.defineProperty(globalThis, 'w6ro', { value: x, writable: false, configurable: true }); w6ro = 9; return w6ro; }`, { spec: '10.1.9.2' }),
  value('global-readonly-defined-strict-typeerror', 3, 'TypeError3', `function f(x){ 'use strict'; Object.defineProperty(globalThis, 'w6ro2', { value: x, writable: false, configurable: true }); try { w6ro2 = 9; return 'no'; } catch (e) { return e.name + x; } }`, { spec: '9.1.1.2.5' }),
  value('global-prevent-extensions-sloppy', 3, 'undefined3', `function f(x){ Object.preventExtensions(globalThis); w6pe = x; return typeof w6pe + x; }`, { spec: '10.1.9.2 (CreateDataProperty fails; sloppy ignore)' }),
  value('global-prevent-extensions-strict', 3, 'ReferenceError3', `function f(x){ 'use strict'; Object.preventExtensions(globalThis); try { w6pe2 = x; return 'no'; } catch (e) { return e.name + x; } }`, { spec: '6.2.5.6 step 3.a' }),
  value('object-keys-global-filtered', 3, 'f,w6k1,w6k23', `function f(x){ w6k1 = 1; w6k2 = 2; return Object.keys(globalThis).filter(function(k){ return k === 'f' || k.slice(0, 3) === 'w6k'; }).join() + x; }`, { spec: '20.1.2.18 Object.keys (intrinsic globals are non-enumerable)' }),
  value('for-in-global-filtered', 3, 'f,w6q3', `function f(x){ w6q = 1; var keys = []; for (var k in globalThis) if (k === 'f' || k === 'w6q') keys.push(k); return keys.join() + x; }`, { spec: '14.7.5.9 EnumerateObjectProperties' }),
  value('nested-closures-global-access', 3, 'true:4:object', `function f(x){ function a(){ return function b(){ return function c(){ w6z = x + 1; return (globalThis.Math === Math) + ':' + w6z + ':' + typeof globalThis; }; }; } return a()()(); }`, { spec: '9.1.2.1 GetIdentifierReference (outer chain to the global record)' }),
  value('parse-int-in-global-mode', 3, 'undefined:13', `function f(x){ return typeof w6none + ':' + parseInt('1' + x); }`, { spec: '19.2.5' }),
  value('local-shadows-globalthis', 3, 3, `function f(x){ var globalThis = x; return globalThis; }`, { mode: 'classic', spec: '9.1.2.1 (function scope binding first)' }),
  value('classic-intrinsics-only', 3, 4, `function f(x){ return Math.max(x, 1) + JSON.stringify([1]).length - 2; }`, { mode: 'classic', spec: 'classic packing unchanged' }),
  value('classic-entry-recursion', 3, 6, `function f(x){ return x <= 0 ? 0 : x + f(x - 1); }`, { mode: 'classic', spec: 'classic packing unchanged' }),
  value('sloppy-tag-this-global', 3, 'true:3', `function f(x){ function tag(){ return this === globalThis; } return tag\`a\${x}\` + ':' + x; }`, { spec: '13.3.11 tagged template (undefined thisValue)' }),
  value('global-assign-unimplemented-name', 3, 'false3', `function f(x){ globalThis['Ma' + 'p'] = x; return globalThis.propertyIsEnumerable('Map') + '' + x; }`, { spec: '19 global property attributes; original boundary promoted' }),
  value('global-delete-unimplemented-name', 3, 'true3', `function f(x){ return (delete globalThis['Se' + 't']) + '' + x; }`, { spec: '19 configurable global Set; original boundary promoted' }),
  value('reference-isnan', 3, 'false3', `function f(x){ return isNaN(x) + '' + x; }`, { spec: '19.2.3 isNaN; original boundary promoted' }),
  // Standard-library wave: Reflect.has is implemented (was a prototypeGap(47) boundary).
  value('reference-reflect', 3, 'true3', `function f(x){ return Reflect.has(globalThis, 'f') + '' + x; }`, { spec: '28.1.9 Reflect.has' }),
  value('global-stdlib-bindings', 3, 'true:true:true:true:3', `function f(x){ w6s = x; return (globalThis.Map === Map) + ':' + (globalThis.Set === Set) + ':' + (globalThis.isNaN === isNaN) + ':' + (globalThis.isFinite === isFinite) + ':' + w6s; }`, { spec: '19.2.2, 19.2.3, 19.3.22, 19.3.32' }),
]);

export const globalErrorCases = Object.freeze([
  value('uncaught-undeclared-read', 3, 'ReferenceError', `function f(x){ return w6missing + x; }`, { throws: true, spec: '6.2.5.5 step 3.a' }),
  value('uncaught-undeclared-call', 3, 'ReferenceError', `function f(x){ return w6missingFn(x); }`, { throws: true, spec: '6.2.5.5' }),
  value('uncaught-undeclared-postfix', 3, 'ReferenceError', `function f(x){ w6missingCount++; return x; }`, { throws: true, spec: '13.4.2.1 (GetValue first)' }),
  value('uncaught-strict-undeclared-assignment', 3, 'ReferenceError', `function f(x){ 'use strict'; w6strictMissing = x; return x; }`, { throws: true, spec: '6.2.5.6 step 3.a' }),
  value('uncaught-deleted-intrinsic-read', 3, 'ReferenceError', `function f(x){ delete globalThis.Math; return Math.max(x, 1); }`, { throws: true, spec: '6.2.5.5' }),
]);

// [[Prototype]] / extra properties of the global object are host-defined
// (ES2025 19: "has a [[Prototype]] internal slot whose value is host-defined").
// This design: ordinary object, [[Prototype]] = %Object.prototype%, no
// @@toStringTag (as native QuickJS). Node's global differs.
export const globalHostCases = Object.freeze([
  value('global-prototype-is-object-prototype', 3, 'true3', `function f(x){ return (Object.getPrototypeOf(globalThis) === Object.prototype) + '' + x; }`, { spec: '19 (host-defined [[Prototype]])' }),
  // ES2025 defines no @@toStringTag on the global object; QuickJS and Node add
  // a host "global" tag. Symbols are absent here (Phase 3 hook: a host tag
  // would be an own @@toStringTag data property of node 65).
  value('global-to-string-tag', 3, '[object Object]3', `function f(x){ return Object.prototype.toString.call(globalThis) + x; }`, { spec: '20.1.3.6 (no @@toStringTag in ES2025)', quickjs: '[object global]3' }),
  value('global-set-prototype', 3, 3, `function f(x){ Object.setPrototypeOf(globalThis, { w6proto: x }); return w6proto; }`, { spec: '10.1.2 OrdinarySetPrototypeOf; 9.1.1.2.1 HasBinding' }),
]);

// Normative ES2025 result; native QuickJS agrees, V8 does not.
export const globalV8DeviationCases = Object.freeze([
  value('strict-assignment-inherited-hasownproperty', 3, 'true:3', `function f(x){ 'use strict'; hasOwnProperty = x; return Object.prototype.hasOwnProperty.call(globalThis, 'hasOwnProperty') + ':' + x; }`,
    { spec: '9.1.1.2.1 HasBinding uses HasProperty (inherited from %Object.prototype%); 9.1.1.2.5', v8: 'ReferenceError (V8 strict global store ignores the prototype chain)' }),
  value('strict-assignment-inherited-binding', 3, 'true:3', `function f(x){ 'use strict'; toString = x; return Object.prototype.hasOwnProperty.call(globalThis, 'toString') + ':' + toString; }`,
    { spec: '9.1.1.2.1 HasBinding = HasProperty (inherited); 10.1.9.2', v8: 'ReferenceError' }),
]);

// Admitted; the GPU must report status 6 (unimplemented globals are missing
// from the global object). `normative` is the ES2025 value (V8 checked) or
// null when host-defined.
export const globalUnsupportedCases = Object.freeze([
  value('global-has-own-unimplemented', 3, 'unsupported', `function f(x){ return globalThis.hasOwnProperty('Pro' + 'mise') + '' + x; }`, { normative: 'true3', mechanism: 'ownGap(65)' }),
  value('global-assign-unimplemented-weakmap', 3, 'unsupported', `function f(x){ globalThis['Weak' + 'Map'] = x; return globalThis.propertyIsEnumerable('WeakMap') + '' + x; }`, { normative: 'false3', mechanism: 'putProperty ownGap(65)' }),
  value('global-delete-unimplemented-weakset', 3, 'unsupported', `function f(x){ return (delete globalThis['Weak' + 'Set']) + '' + x; }`, { normative: 'true3', mechanism: 'delete ownGap(65)' }),
  value('global-own-property-names', 3, 'unsupported', `function f(x){ return Object.getOwnPropertyNames(globalThis).indexOf('f') >= 0 ? x : -1; }`, { normative: 3, mechanism: 'ownKeys(65) full list' }),
  value('global-object-spread', 3, 'unsupported', `function f(x){ return ({ ...globalThis }).f === f ? x : -1; }`, { normative: 3, mechanism: 'ownKeys(65) via __lanesOwnPropertyKeys' }),
]);

export const globalRejectedCases = Object.freeze([
  { feature: 'top-level-let', source: `let w6 = 1; function f(x){ return w6 + x; }`, reason: /Expected one synchronous named function declaration/, normative: 4 },
  { feature: 'top-level-var', source: `var w6 = 1; function f(x){ return w6 + x; }`, reason: /Expected one synchronous named function declaration/, normative: 4 },
  { feature: 'top-level-class', source: `class W6 {} function f(x){ return typeof W6 + x; }`, reason: /Expected one synchronous named function declaration/, normative: 'function3' },
  { feature: 'top-level-this', source: `this.w6 = 1; function f(x){ return w6 + x; }`, reason: /Expected one synchronous named function declaration/, normative: 4 },
  { feature: 'reference-decodeuri', source: `function f(x){ return decodeURI('' + x) + x; }`, reason: /Unsupported global or module reference: decodeURI/, normative: '33' },
  { feature: 'reference-indirect-eval', source: `function f(x){ return (0, eval)('1') + x; }`, reason: /Unsupported global or module reference: eval/, normative: 4 },
  // 16.1.7 GlobalDeclarationInstantiation step 10.a.iv: TypeError (V8 reports SyntaxError).
  { feature: 'entry-named-nan', source: `function NaN(x){ return x; }`, reason: /CanDeclareGlobalFunction/, normative: { error: 'TypeError' }, v8: { error: 'SyntaxError' } },
  { feature: 'entry-named-undefined', source: `function undefined(x){ return x; }`, reason: /CanDeclareGlobalFunction/, normative: { error: 'TypeError' }, v8: { error: 'SyntaxError' } },
]);

// Strict PutValue on a reference that was unresolvable when evaluated, made
// resolvable by the right-hand side. ES2025 6.2.5.6: ReferenceError. QuickJS
// (put_var re-checks HasProperty at the store) and V8 store. The GPU executes
// QuickJS bytecode, which has no operation at reference-evaluation time, so it
// follows QuickJS: recorded, not admitted as a normative fixture.
export const globalKnownDeviationCases = Object.freeze([
  value('strict-unresolvable-created-by-rhs', 3, 'ReferenceError3', `function f(x){ 'use strict'; try { w6r = (globalThis.w6r = 0, x); return 'stored' + w6r; } catch (e) { return e.name + x; } }`,
    { spec: '6.2.5.6 PutValue step 3.a (reference resolved before rhs)', engines: 'stored3' }),
]);
