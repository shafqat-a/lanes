// Symbol computed method names and instanceof / @@hasInstance.
// Parent applies the patches. This module does not edit shader.js.
// Continuations 86 and 87 and heap kind 53 are reserved and unused.

export const INSTANCEOF_OPERATOR = 2490;
export const HAS_INSTANCE = 1101;
export const LANES_IS_BOUND = 2491;
export const LANES_BOUND_TARGET = 2492;
export const LANES_PROTOTYPE_INSTANCEOF = 2493;

// Second well-known symbol. phase3-values.js wellKnownFirst is 31 and
// phase3WellKnownNames begins asyncIterator, hasInstance. Node 32.
export const HAS_INSTANCE_NODE = 32;
export const HAS_INSTANCE_KEY = 0x60000000 | HAS_INSTANCE_NODE;

export const RESERVED_CONTINUATIONS = Object.freeze([86, 87]);
export const RESERVED_HEAP_KINDS = Object.freeze([53]);

// New FIELDS name. "hasInstance" is already the phase-3 property-name field;
// the guest helper reuses that slot (.y = function, .x stays the text).
export const symbolMethodFieldNames = Object.freeze(['instanceofOperator']);

export const symbolMethodBuiltinFields = Object.freeze({
  [INSTANCEOF_OPERATOR]: 'instanceofOperator',
  [HAS_INSTANCE]: 'hasInstance',
});

// 2491-2493 stay WGSL. They must not be added to call()'s guest-field redirect.
export const symbolMethodPrivateBuiltins = Object.freeze({
  __lanesInstanceofOperator: INSTANCEOF_OPERATOR,
  __lanesHasInstance: HAS_INSTANCE,
  __lanesIsBound: LANES_IS_BOUND,
  __lanesBoundTarget: LANES_BOUND_TARGET,
  __lanesPrototypeInstanceof: LANES_PROTOTYPE_INSTANCEOF,
});

// SetFunctionName for a symbol key. Absent description (cell value.y == 0) is
// the empty string image. A present description, including length 0, is
// "[" + description + "]". Non-symbol keys keep keyName's string/index path.
// BigInt keys never arrive here: keyOf still sets status 6.
export function symbolFunctionNameWGSL({ F }) {
  if (F[''] === undefined) throw new Error('symbolFunctionName requires F[""]');
  return `fn symbolFunctionName(l:u32,key:u32)->V {
  if(phase3SymbolKey(key)){
    let cell=key&0x1fffffffu;
    if(states[l].heap[cell].kind!=17u){states[l].status=2u;return undef();}
    let desc=states[l].heap[cell].value.y;
    if(desc==0u){return image[fieldKey(${F['']}u)];}
    if(states[l].heap[desc].kind!=10u){states[l].status=2u;return undef();}
    let descLen=states[l].heap[desc].key;
    if(descLen>254u){states[l].status=3u;return undef();}
    let open=alloc(l,10u,V(91u,0u,0u,0u),1u,0u);
    if(states[l].status!=0u){return undef();}
    let mid=makeText(l,V(open,1u,7u,0u),V(desc,descLen,7u,0u),0u,1u+descLen);
    if(states[l].status!=0u){return undef();}
    let close=alloc(l,10u,V(93u,0u,0u,0u),1u,0u);
    if(states[l].status!=0u){return undef();}
    return makeText(l,mid,V(close,1u,7u,0u),0u,mid.y+1u);
  }
  if((key&0x80000000u)==0u){return keyText(l,key);}
  return unsignedText(l,key&0x7fffffffu);
}`;
}

// Prototype walk copied from instanceOf after the hook scan and the bound
// unwrap. Guest helpers perform Get(prototype) resumably after checking the
// value is an object. This kernel only walks the supplied prototype identity.
export function prototypeInstanceofWGSL({ F, L }) {
  if (F.prototype === undefined || L?.heap === undefined) throw new Error('lanesPrototypeInstanceof requires F.prototype and L.heap');
  return `fn lanesPrototypeInstanceof(l:u32,value:V,requestedPrototype:V)->V {
  if(value.z!=4u&&value.z!=5u&&value.z!=11u){return boolean(false);}
  let prototype=objectView(l,requestedPrototype);
  if(prototype.z==11u){states[l].status=6u;return undef();}
  if(prototype.z!=4u){states[l].status=4u;return undef();}
  let obj=objectView(l,value);var current=3u;
  if(obj.z==4u){current=states[l].heap[obj.x].value.x;}
  var found=false;
  for(var i=0u;i<${L.heap}u&&current!=0u&&!found;i++){found=current==prototype.x;current=states[l].heap[current].value.x;}
  return boolean(found);
}`;
}

// Tag 5 and heap kind 12. Target word matches call()'s bound unwrap.
export const boundHelperWGSL = `fn lanesIsBound(l:u32,value:V)->V {
  return boolean(value.z==5u&&states[l].heap[value.x].kind==12u);
}
fn lanesBoundTarget(l:u32,value:V)->V {
  if(value.z!=5u||states[l].heap[value.x].kind!=12u){states[l].status=4u;return undef();}
  let bound=states[l].heap[value.x];
  return V(bound.value.x,0u,bound.value.z,0u);
}`;

export function symbolMethodWGSL({ F, L }) {
  return `${symbolFunctionNameWGSL({ F })}\n${boundHelperWGSL}\n${prototypeInstanceofWGSL({ F, L })}`;
}

export const symbolMethodObjectMethodWGSL = `if(id==${LANES_IS_BOUND}u){return lanesIsBound(l,original);}
  if(id==${LANES_BOUND_TARGET}u){return lanesBoundTarget(l,original);}
  if(id==${LANES_PROTOTYPE_INSTANCEOF}u){return lanesPrototypeInstanceof(l,original,b);}`;

// Prefix image ("get " / "set ") is still concatenated by the opcode, for
// string keys and symbol keys, so string-key names do not change.
export const defineMethodComputedCaseBody = `let fnValue=pop(l);let key=keyOf(l,pop(l));if(states[l].status!=0u){break;}let obj=peek(l);var name=symbolFunctionName(l,key);
        if(states[l].status!=0u){break;}
        if(arg!=0u){let prefix=image[ins.z];name=makeText(l,prefix,name,0u,prefix.y+name.y);}
        functionName(l,fnValue,name,true);classSetHome(l,fnValue,obj);
        if(arg==0u){let ignored=putProperty(l,obj,key,fnValue,true);}else{defineAccessor(l,obj,key,fnValue,arg==2u);}`;

// Kind 33 private names stay on the image-description path. keyOf is not run
// for them, and it still status-6s a BigInt key before symbolFunctionName.
export const setNameComputedCaseBody = `let named=states[l].stack[states[l].sp-2u];if(named.z==4u&&states[l].heap[named.x].kind==33u){functionName(l,peek(l),image[states[l].heap[named.x].value.x],false);}else{let key=keyOf(l,named);if(states[l].status!=0u){break;}let name=symbolFunctionName(l,key);if(states[l].status!=0u){break;}functionName(l,peek(l),name,false);}`;

export const defineClassMethodComputedCaseBody = `let fnValue=pop(l);let key=keyOf(l,pop(l));if(states[l].status!=0u){break;}let obj=peek(l);var name=symbolFunctionName(l,key);
        if(states[l].status!=0u){break;}
        if(arg!=0u){let prefix=image[ins.z];name=makeText(l,prefix,name,0u,prefix.y+name.y);}
        functionName(l,fnValue,name,true);classSetHome(l,fnValue,obj);classDefineMethod(l,obj,key,fnValue,arg);`;

export const instanceofCaseBody = `let constructor=pop(l);let value=pop(l);push(l,V(${INSTANCEOF_OPERATOR}u,0u,11u,0u));push(l,value);push(l,constructor);call(l,2u,false,false);`;

export const defineClassComputedNameFind = 'if((ins.z&2u)!=0u){let key=keyOf(l,peek(l));if(states[l].status!=0u){break;}if(phase3SymbolKey(key)){states[l].status=6u;break;}name=keyName(l,key);}';
export const defineClassComputedNameReplace = 'if((ins.z&2u)!=0u){let key=keyOf(l,peek(l));if(states[l].status!=0u){break;}name=symbolFunctionName(l,key);if(states[l].status!=0u){break;}}';

const defineMethodFindBody = 'let fnValue=pop(l);let key=keyOf(l,pop(l));if(states[l].status!=0u){break;}if(phase3SymbolKey(key)){states[l].status=6u;break;}let obj=peek(l);var name=keyName(l,key);\n        if(arg!=0u){let prefix=image[ins.z];name=makeText(l,prefix,name,0u,prefix.y+name.y);}\n        functionName(l,fnValue,name,true);classSetHome(l,fnValue,obj);\n        if(arg==0u){let ignored=putProperty(l,obj,key,fnValue,true);}else{defineAccessor(l,obj,key,fnValue,arg==2u);}';
const setNameFindBody = 'let named=states[l].stack[states[l].sp-2u];if(named.z==4u&&states[l].heap[named.x].kind==33u){functionName(l,peek(l),image[states[l].heap[named.x].value.x],false);}else{let key=keyOf(l,named);if(states[l].status!=0u){break;}if(phase3SymbolKey(key)){states[l].status=6u;break;}functionName(l,peek(l),keyName(l,key),false);}';
const classMethodFindBody = 'let fnValue=pop(l);let key=keyOf(l,pop(l));if(states[l].status!=0u){break;}if(phase3SymbolKey(key)){states[l].status=6u;break;}let obj=peek(l);var name=keyName(l,key);\n        if(arg!=0u){let prefix=image[ins.z];name=makeText(l,prefix,name,0u,prefix.y+name.y);}\n        functionName(l,fnValue,name,true);classSetHome(l,fnValue,obj);classDefineMethod(l,obj,key,fnValue,arg);';
const instanceofFindBody = 'let constructor=pop(l);let value=pop(l);push(l,instanceOf(l,value,constructor));';

function backtickCase(name, body) {
  return "      ${cases('" + name + "', `" + body + "`)}";
}
function quoteCase(name, body) {
  return "      ${cases('" + name + "', '" + body + "')}";
}

// Exact shader.js / phase4-classes.js edits. `find` is current source text.
export const symbolMethodPatches = Object.freeze([
  Object.freeze({
    id: 'define-method-computed',
    file: 'experiments/quickjs-runtime/shader.js',
    find: backtickCase('define_method_computed', defineMethodFindBody),
    replace: backtickCase('define_method_computed', defineMethodComputedCaseBody),
  }),
  Object.freeze({
    id: 'set-name-computed',
    file: 'experiments/quickjs-runtime/shader.js',
    find: quoteCase('set_name_computed', setNameFindBody),
    replace: quoteCase('set_name_computed', setNameComputedCaseBody),
  }),
  Object.freeze({
    id: 'instanceof',
    file: 'experiments/quickjs-runtime/shader.js',
    find: quoteCase('instanceof', instanceofFindBody),
    replace: quoteCase('instanceof', instanceofCaseBody),
  }),
  Object.freeze({
    id: 'define-class-method-computed',
    file: 'experiments/quickjs-runtime/phase4-classes.js',
    find: '  define_class_method_computed: `' + classMethodFindBody + '`,',
    replace: '  define_class_method_computed: `' + defineClassMethodComputedCaseBody + '`,',
  }),
  Object.freeze({
    id: 'define-class-computed-name',
    file: 'experiments/quickjs-runtime/phase4-classes.js',
    find: defineClassComputedNameFind,
    replace: defineClassComputedNameReplace,
  }),
]);

// shader.js prototypeGap source line. Delete it when the property is installed,
// or a deleted @@hasInstance still takes ownGap/getProperty to status 6.
export const prototypeGapHasInstanceLine = '  if(id==3u&&key==(0x60000000u|${phase3HasInstanceNode}u)){return true;}';

// flags 0: not writable, not enumerable, not configurable.
// functionProto is node 3. Key is 0x60000000|32.
export const functionPrototypeHasInstanceInit = `dataProperty(l,functionProto,0x60000000u|${HAS_INSTANCE_NODE}u,V(${HAS_INSTANCE}u,0u,11u,0u),0u);`;

// InstanceofOperator. __lanesHasInstance is builtin 1101, the intrinsic
// installed on Function.prototype[@@hasInstance], not a live re-get: a
// replacement of that property is still invoked. Bound re-entry calls 2490,
// which is this guest function, so the target's hook runs.
export const instanceofOperatorSource = `function instanceofOperatorBootstrap(value, ctor) {
  "use strict";
  if (ctor === null || (typeof ctor !== "object" && typeof ctor !== "function")) {
    throw new TypeError("Right-hand side of instanceof is not an object");
  }
  const method = ctor[Symbol.hasInstance];
  if (method !== null && method !== undefined) {
    if (typeof method !== "function") throw new TypeError("Symbol.hasInstance is not a function");
    if (method !== __lanesHasInstance) return !!__lanesCall(method, ctor, value);
    if (typeof ctor !== "function") return false;
  }
  if (typeof ctor !== "function") throw new TypeError("Right-hand side of instanceof is not callable");
  if (__lanesIsBound(ctor)) return __lanesInstanceofOperator(value, __lanesBoundTarget(ctor));
  if (value === null || (typeof value !== "object" && typeof value !== "function")) return false;
  return __lanesPrototypeInstanceof(value, ctor.prototype);
}`;

// OrdinaryHasInstance. this is the constructor. A bound this re-enters the
// full instanceof operator (2490), including the target's @@hasInstance.
export const hasInstanceSource = `function hasInstanceBootstrap(value) {
  "use strict";
  const ctor = this;
  if (typeof ctor !== "function") return false;
  if (__lanesIsBound(ctor)) return __lanesInstanceofOperator(value, __lanesBoundTarget(ctor));
  if (value === null || (typeof value !== "object" && typeof value !== "function")) return false;
  return __lanesPrototypeInstanceof(value, ctor.prototype);
}`;

export const symbolMethodBootstrapSources = Object.freeze({
  instanceofOperator: instanceofOperatorSource,
  hasInstance: hasInstanceSource,
});
