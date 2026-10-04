// Standard-library wave, worker 6: the twelve ES2025 Reflect functions
// (https://tc39.es/ecma262/2025/multipage/reflection.html#sec-reflect-object).
// Strict guest helpers compiled by QuickJS and executed by the WGSL VM; the
// host never evaluates them outside the oracle check (check-stdlib-reflect.mjs).
//
// Boolean-vs-throw: the shared WGSL operations behind Object.defineProperty
// (descriptor(), status 4 on every rejection) and Object.setPrototypeOf
// (setPrototype(), status 4) throw. These helpers therefore run the spec's
// validation (ValidateAndApplyPropertyDescriptor, ArraySetLength,
// ArrayDefineOwnProperty, OrdinarySetPrototypeOf, OrdinarySet) in guest code
// on top of side-effect-free queries, return false where the spec returns
// false, and only call the throwing primitive when it is guaranteed to
// succeed. No guest exception is ever caught and swallowed.
// [[Delete]] uses __lanesReviverDelete (1860), an existing ordinary boolean
// [[Delete]]. Exact shader.js references: stdlib-reflect-notes.md.
//
// Helpers are flat (no nested functions): private names only resolve in the
// intrinsic root function.
import { MAP_IDS, SET_IDS } from './stdlib-ids.js';

// Names used by these sources. All exist in bootstrap.js privateBuiltins
// except the two in reflectNewIntrinsics.
export const reflectNewIntrinsics = Object.freeze({
  // New WGSL intrinsic (reflectWGSL): IsConstructor(value) -> boolean, never throws.
  __lanesIsConstructor: 2312,
  __lanesPreparedConstruct: 2360,
  __lanesBaseConstructNewTarget: 2361,
  // Trusted parent commit after guest OrdinarySetPrototypeOf validation.
  __lanesSetPrototype: 2362,
});
export const reflectIntrinsics = Object.freeze({
  __lanesToPropertyKey: 900, __lanesToDescriptor: 139, __lanesDescriptor: 112,
  __lanesOwnDescriptor: 901, __lanesOwnHas: 902, __lanesOwnKeys: 140,
  __lanesDefine: 110, __lanesIsArray: 201, __lanesNumber: 1164, __lanesText: 111,
  __lanesIsExtensible: 109, __lanesPreventExtensions: 108, __lanesGetPrototypeOf: 1354,
  __lanesReviverDelete: 1860, __lanesCall: 113, __lanesApply: 114, __lanesLength: 115,
  __lanesUnsupported: 141,
  ...reflectNewIntrinsics,
});

const isObject = v => `(${v} !== null && (typeof ${v} === "object" || typeof ${v} === "function"))`;
const requireTarget = (v, name) => `if (!${isObject(v)}) throw new TypeError("Reflect.${name} called on non-object");`;

// [[DefineOwnProperty]](O, P, D) -> Boolean for ordinary objects, Array
// exotic objects (ArraySetLength / ArrayDefineOwnProperty), String exotic
// objects and arguments objects. D is a null-prototype descriptor record
// (__lanesDescriptor / __lanesToDescriptor), so `in` only sees its own
// fields. P is a property key (string or symbol). Emits the tail of a helper
// (every path returns a Boolean or throws an abrupt completion).
const defineTail = (O, P, D) => `
  if (__lanesIsArray(${O}) && ${P} === "length" && "value" in ${D}) {
    // ArraySetLength steps 3-5: ToUint32 then ToNumber (both observable).
    const newLen = __lanesNumber(${D}.value) >>> 0;
    if (newLen !== __lanesNumber(${D}.value)) throw new RangeError("Invalid array length");
    ${D}.value = newLen;
    const lengthDesc = __lanesOwnDescriptor(${O}, "length");
    if (newLen < lengthDesc.value) {
      if (!lengthDesc.writable) return false;
      if (("configurable" in ${D} && ${D}.configurable) || ("enumerable" in ${D} && ${D}.enumerable)) return false;
      // Step 17: the highest non-configurable own index >= newLen stops the
      // descending deletion; length becomes that index + 1 and the result is false.
      const ownKeys = __lanesOwnKeys(${O}, false);
      let blocker = -1;
      for (let i = 0; i < ownKeys.length; i++) {
        const name = ownKeys[i];
        if (typeof name !== "string") continue;
        const index = __lanesNumber(name);
        if (index >>> 0 !== index || index === 4294967295 || index < newLen || index <= blocker || __lanesText(index) !== name) continue;
        if (!__lanesOwnDescriptor(${O}, name).configurable) blocker = index;
      }
      if (blocker >= 0) {
        ${D}.value = blocker + 1;
        __lanesDefine(${O}, "length", ${D});
        return false;
      }
      __lanesDefine(${O}, "length", ${D});
      return true;
    }
  }
  const current = __lanesOwnDescriptor(${O}, ${P});
  if (__lanesIsArray(${O}) && typeof ${P} === "string" && ${P} !== "length") {
    // ArrayDefineOwnProperty step 1: an index at/after a non-writable length.
    const index = __lanesNumber(${P});
    if (index >>> 0 === index && index !== 4294967295 && __lanesText(index) === ${P}) {
      const lengthDesc = __lanesOwnDescriptor(${O}, "length");
      if (index >= lengthDesc.value && !lengthDesc.writable) return false;
    }
  }
  if (current === undefined) {
    if (!__lanesIsExtensible(${O})) return false;
    __lanesDefine(${O}, ${P}, ${D});
    return true;
  }
  if (!current.configurable) {
    if ("configurable" in ${D} && ${D}.configurable) return false;
    if ("enumerable" in ${D} && ${D}.enumerable !== current.enumerable) return false;
    const descAccessor = "get" in ${D} || "set" in ${D};
    const descData = "value" in ${D} || "writable" in ${D};
    const currentAccessor = __lanesOwnHas(current, "get");
    if ((descAccessor || descData) && descAccessor !== currentAccessor) return false;
    if (currentAccessor) {
      if ("get" in ${D} && ${D}.get !== current.get) return false;
      if ("set" in ${D} && ${D}.set !== current.set) return false;
    } else if (!current.writable) {
      if ("writable" in ${D} && ${D}.writable) return false;
      if ("value" in ${D}) {
        const a = ${D}.value, b = current.value;
        if (!((a === b && (a !== 0 || 1 / a === 1 / b)) || (a !== a && b !== b))) return false;
      }
    }
  }
  __lanesDefine(${O}, ${P}, ${D});
  return true;`;

// CreateListFromArrayLike (ES2025 7.3.18, all element types) into a
// null-prototype list object, as applySource in bootstrap.js. More than
// LIMITS.args elements is the explicit resource limit (status 3) of builtin 115.
const listFromArrayLike = (input, name) => `
  if (!${isObject(input)}) throw new TypeError("Reflect.${name}: argumentsList is not an object");
  const length = __lanesLength(__lanesNumber(${input}.length));`;

// `new F(a0..an-1)` for n = 0..LIMITS.args (16); builtin 115 already rejected
// longer lists with status 3, so the final explicit Unsupported is unreachable.
// MAX_ARGS mirrors program.js LIMITS.args (not imported: program.js imports
// stdlib-registry.js, which imports this module).
const MAX_ARGS = 16, LIMITS_FRAMES = 32; // program.js LIMITS.args / LIMITS.frames
const constructDispatch = (F, list, n) => {
  const lines = [];
  for (let count = 0; count <= MAX_ARGS; count++) {
    const args = Array.from({ length: count }, (_, i) => `${list}[${i}]`).join(', ');
    lines.push(`if (${n} === ${count}) return new ${F}(${args});`);
  }
  lines.push('return __lanesUnsupported();');
  return lines.join('\n  ');
};

export const reflectSources = Object.freeze({
  reflectApply: `function reflectApply(target, thisArgument, argumentsList) {
  "use strict";
  if (typeof target !== "function") throw new TypeError("Reflect.apply target is not callable");
  ${listFromArrayLike('argumentsList', 'apply')}
  const list = __lanesDescriptor();
  list.length = length;
  for (let i = 0; i < length; i++) list[i] = argumentsList[i];
  return __lanesApply(target, thisArgument, list);
}`,
  // Alternate newTarget: ordinary/base constructors use guest prototype Get,
  // then a trusted GPU prepared-construction bridge. Derived/intrinsic targets
  // retain an explicit boundary; their allocation semantics differ.
  reflectConstruct: `function reflectConstruct(target, argumentsList) {
  "use strict";
  if (!__lanesIsConstructor(target)) throw new TypeError("Reflect.construct target is not a constructor");
  const newTarget = arguments.length < 3 ? target : arguments[2];
  if (newTarget !== target && !__lanesIsConstructor(newTarget)) throw new TypeError("Reflect.construct newTarget is not a constructor");
  ${listFromArrayLike('argumentsList', 'construct')}
  const list = __lanesDescriptor();
  for (let i = 0; i < length; i++) list[i] = argumentsList[i];
  if (newTarget !== target) {
    const effectiveNewTarget = __lanesBaseConstructNewTarget(target, newTarget);
    if (effectiveNewTarget === undefined) return __lanesUnsupported();
    list.length = length;
    const prototype = effectiveNewTarget.prototype;
    const result = __lanesPreparedConstruct(target, list, newTarget, prototype);
    return result;
  }
  // Explicit arity dispatch instead of \`new target(...list)\`: spread would run
  // the (guest-replaceable) Array iteration protocol, which Construct does not.
  ${constructDispatch('target', 'list', 'length')}
}`,
  reflectDefineProperty: `function reflectDefineProperty(target, propertyKey, attributes) {
  "use strict";
  ${requireTarget('target', 'defineProperty')}
  const key = __lanesToPropertyKey(propertyKey);
  const desc = __lanesToDescriptor(attributes);
  ${defineTail('target', 'key', 'desc')}
}`,
  reflectDeleteProperty: `function reflectDeleteProperty(target, propertyKey) {
  "use strict";
  ${requireTarget('target', 'deleteProperty')}
  return __lanesReviverDelete(target, __lanesToPropertyKey(propertyKey));
}`,
  reflectGet: `function reflectGet(target, propertyKey) {
  "use strict";
  ${requireTarget('target', 'get')}
  const key = __lanesToPropertyKey(propertyKey);
  if (arguments.length < 3) return target[key];
  const receiver = arguments[2];
  if (receiver === target) return target[key];
  let object = target;
  let own = __lanesOwnDescriptor(object, key);
  while (own === undefined) {
    object = __lanesGetPrototypeOf(object);
    if (object === null) return undefined;
    own = __lanesOwnDescriptor(object, key);
  }
  if (!__lanesOwnHas(own, "get")) return own.value;
  const getter = own.get;
  if (getter === undefined) return undefined;
  return __lanesCall(getter, receiver);
}`,
  reflectGetOwnPropertyDescriptor: `function reflectGetOwnPropertyDescriptor(target, propertyKey) {
  "use strict";
  ${requireTarget('target', 'getOwnPropertyDescriptor')}
  return __lanesOwnDescriptor(target, __lanesToPropertyKey(propertyKey));
}`,
  reflectGetPrototypeOf: `function reflectGetPrototypeOf(target) {
  "use strict";
  ${requireTarget('target', 'getPrototypeOf')}
  return __lanesGetPrototypeOf(target);
}`,
  reflectHas: `function reflectHas(target, propertyKey) {
  "use strict";
  ${requireTarget('target', 'has')}
  const key = __lanesToPropertyKey(propertyKey);
  return key in target;
}`,
  reflectIsExtensible: `function reflectIsExtensible(target) {
  "use strict";
  ${requireTarget('target', 'isExtensible')}
  return __lanesIsExtensible(target);
}`,
  reflectPreventExtensions: `function reflectPreventExtensions(target) {
  "use strict";
  ${requireTarget('target', 'preventExtensions')}
  __lanesPreventExtensions(target);
  return true;
}`,
  // OrdinarySet / OrdinarySetWithOwnDescriptor (ES2025 10.1.9.1-2) with an
  // explicit Receiver, for both receiver === target and receiver !== target.
  reflectSet: `function reflectSet(target, propertyKey, value) {
  "use strict";
  ${requireTarget('target', 'set')}
  const key = __lanesToPropertyKey(propertyKey);
  const receiver = arguments.length < 4 ? target : arguments[3];
  let object = target;
  let own = __lanesOwnDescriptor(object, key);
  while (own === undefined) {
    object = __lanesGetPrototypeOf(object);
    if (object === null) break;
    own = __lanesOwnDescriptor(object, key);
  }
  if (own !== undefined && __lanesOwnHas(own, "get")) {
    const setter = own.set;
    if (setter === undefined) return false;
    __lanesCall(setter, receiver, value);
    return true;
  }
  if (own !== undefined && !own.writable) return false;
  if (!${isObject('receiver')}) return false;
  const existing = __lanesOwnDescriptor(receiver, key);
  const desc = __lanesDescriptor();
  desc.value = value;
  if (existing !== undefined) {
    if (__lanesOwnHas(existing, "get")) return false;
    if (!existing.writable) return false;
  } else {
    desc.writable = true;
    desc.enumerable = true;
    desc.configurable = true;
  }
  ${defineTail('receiver', 'key', 'desc')}
}`,
  // OrdinarySetPrototypeOf (ES2025 10.1.2.1) plus SetImmutablePrototype for
  // %Object.prototype% (the only immutable-prototype object in this runtime).
  reflectSetPrototypeOf: `function reflectSetPrototypeOf(target, proto) {
  "use strict";
  ${requireTarget('target', 'setPrototypeOf')}
  if (proto !== null && !${isObject('proto')}) throw new TypeError("Object prototype may only be an Object or null");
  const current = __lanesGetPrototypeOf(target);
  if (proto === current) return true;
  if (target === __lanesGetPrototypeOf({})) return false;
  if (!__lanesIsExtensible(target)) return false;
  let p = proto;
  while (p !== null) {
    if (p === target) return false;
    p = __lanesGetPrototypeOf(p);
  }
  __lanesSetPrototype(target, proto);
  return true;
}`,
});

const table = [
  ['apply', 2300, 3, 'reflectApply'], ['construct', 2301, 2, 'reflectConstruct'],
  ['defineProperty', 2302, 3, 'reflectDefineProperty'], ['deleteProperty', 2303, 2, 'reflectDeleteProperty'],
  ['get', 2304, 2, 'reflectGet'], ['getOwnPropertyDescriptor', 2305, 2, 'reflectGetOwnPropertyDescriptor'],
  ['getPrototypeOf', 2306, 1, 'reflectGetPrototypeOf'], ['has', 2307, 2, 'reflectHas'],
  ['isExtensible', 2308, 1, 'reflectIsExtensible'], ['preventExtensions', 2309, 1, 'reflectPreventExtensions'],
  ['set', 2310, 3, 'reflectSet'], ['setPrototypeOf', 2311, 2, 'reflectSetPrototypeOf'],
];
export const reflectMethods = Object.freeze(table.map(([name, id, length, field]) => Object.freeze({
  owner: 'Reflect', name, id, length, field, kind: 'method', source: reflectSources[field],
})));

// New WGSL (parent splices; registry already concatenates reflectWGSL).
// IsConstructor (ES2025 7.2.4): bound functions are constructors iff their
// target is; then the existing phase4-classes.js classIsConstructor
// (closures with [[Construct]], classes, Object/Array/Error*/Number/String/
// Boolean/Function), plus Symbol/BigInt and Map/Set. Symbol and BigInt
// have [[Construct]] even though invoking it throws; argument-list evaluation
// therefore precedes that TypeError.
export const reflectWGSL = Object.freeze({
  functions: `fn reflectIsConstructor(l:u32,value:V)->bool {
  var v=value;
  for(var i=0u;i<${LIMITS_FRAMES}u&&v.z==5u&&states[l].heap[v.x].kind==12u;i++){let bound=states[l].heap[v.x].value;v=V(bound.x,0u,bound.z,0u);}
  if(v.z==11u&&(v.x==1000u||v.x==1150u||v.x==${MAP_IDS.ctor}u||v.x==${SET_IDS.ctor}u)){return true;}
  return classIsConstructor(l,v);
}`,
  objectMethod: `if(id==${reflectNewIntrinsics.__lanesIsConstructor}u){return boolean(reflectIsConstructor(l,original));}
  if(id==2361u){
    var constructorTarget=original;var newTarget=b;
    for(var i=0u;i<32u&&constructorTarget.z==5u&&states[l].heap[constructorTarget.x].kind==12u;i++){
      let bound=states[l].heap[constructorTarget.x].value;let inner=V(bound.x,0u,bound.z,0u);
      if(equal(l,constructorTarget,newTarget)){newTarget=inner;}constructorTarget=inner;
    }
    if(constructorTarget.z==5u&&states[l].heap[constructorTarget.x].kind==12u){states[l].status=3u;return undef();}
    if(constructorTarget.z==5u&&classIsConstructor(l,constructorTarget)&&(states[l].heap[constructorTarget.x].value.w&2u)==0u){return newTarget;}
    return undef();
  }`,
});

export const reflectPending = Object.freeze([
  'Reflect.construct with alternate newTarget supports ordinary and base-class targets (including bound targets), guest prototype getters, and same-realm Object.prototype fallback. Alternate derived/intrinsic targets remain explicit status6 after constructor validation and argument-list reads, before prototype Get.',
  'Reflect.construct argument lists longer than LIMITS.args (16) and Reflect.apply likewise: status 3 resource limit from builtin 115 (__lanesLength).',
  'Targets/receivers that are unmapped tag-11 builtin functions (e.g. Array.prototype.push) reach status 6 in __lanesOwnDescriptor/__lanesDefine/__lanesReviverDelete/__lanesIsExtensible; Reflect.get/has with receiver === target use the ordinary property path and work for their name/length.',
  'Objects with prototypeGap names (Math/Number/String.prototype pending names, global object gaps) report status 6 exactly as the ordinary property operations do.',
  'Proxy objects do not exist in this runtime; every target is ordinary or one of the Array/String/arguments exotic objects handled in guest code.',
  'IsConstructor relies on classIsConstructor plus Symbol/BigInt/Map/Set; any later constructor builtin must be added to reflectIsConstructor.',
]);
