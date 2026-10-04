// Phase 4 worker 5: classes, super and new.target (synchronous subset).
//
// Supported: class declarations and expressions (named, anonymous, contextual
// names, computed names via define_class_computed), constructors, prototype and
// static methods, getters/setters, computed element keys (evaluated in source
// order), `extends` with ordinary/class/bound constructors and `null`, super(...),
// default derived constructors, super.x / super[k] reads, writes and compound
// updates through home objects (classes and object literals), new.target in
// constructors, ordinary functions and arrows, class-constructor [[Call]]
// TypeError, derived `this` TDZ, double super() ReferenceError and derived
// constructor return checks.
//
// Fields, static blocks and private names: phase4-class-elements.js (next
// wave). Explicitly rejected at compile time (entrySource AST walk):
// async/generator class methods. Explicit runtime status 6: extending
// built-in constructors (Object, Array, Error family, String, Number, Boolean,
// Function), and NewTarget values that are not ordinary guest closures (only
// reachable through Reflect.construct, not implemented).
//
// Pinned QuickJS lowering (vendor/quickjs.c js_parse_class, js_op_define_class):
//   <heritage | undefined>; push_const <ctor bytecode>; define_class atom flags
//     (flags bit 0 = has heritage) : parent bfunc -> ctor proto
//   prototype methods: fclosure; define_method atom 0|1|2 (no ENUMERABLE bit)
//   static methods:   swap; fclosure; define_method ...; swap
//   computed keys:    <key>; fclosure; define_method_computed 0|1|2
//   end:              undefined; put_loc <class_fields_init>; drop (proto);
//                     set_loc <inner const binding>; put_loc <outer let>
//   every class constructor starts with check_ctor (base) or contains
//   init_ctor (default derived); derived constructors keep `this` in a local
//   initialised by put_loc_check_init / put_var_ref_check_init after super()
//   and read it with get_loc_checkthis; explicit returns run check_ctor_return.
//   special_object 2/3/4 = this_func / new_target / home_object.
// Object-literal methods use define_method with OP_DEFINE_METHOD_ENUMERABLE (4)
// and keep their existing packing bit for bit (the lowering returns null).
//
// Representation (no new heap kinds, builtin IDs or continuations needed; the
// reserved 26-28 / 1310-1349 / 47-49 stay unused):
//   closure node (kind 5) value = (function, backing, home, classFlags)
//     home: heap node id of the [[HomeObject]] (prototype object, or the
//       constructor's kind-2 backing node for static methods); 0 = none.
//     classFlags: bit 0 class constructor ([[Call]] throws via check_ctor,
//       [[Construct]] allowed without hasPrototype), bit 1 derived.
//   environment node (kind 4) value = (closure, argc, newTarget, newTargetTag)
//     newTargetTag 0 = undefined, 5 = guest closure id in newTarget. construct()
//     stores it after call() created the callee frame. Frame stays 8 words.
//   collect() marks closure.home and env.newTarget (patches below).

import { classElementLowering, classElementRejectNode } from './phase4-class-elements.js';

export const classOpcodes = Object.freeze([
  Object.freeze({ name: 'define_class', pop: 2, push: 2, note: 'parent closure -> ctor proto; a=text(name), b=flags (bit0 heritage, bit1 computed name: sp[-3] holds the property key and is kept)' }),
  Object.freeze({ name: 'define_class_method', pop: 2, push: 1, note: 'obj fn -> obj; non-enumerable class element; a=text(key), b=text(function name)*4 + kind (0 method, 1 get, 2 set)' }),
  Object.freeze({ name: 'define_class_method_computed', pop: 3, push: 1, note: 'obj key fn -> obj; a=kind, b=text("get "/"set ") or 0; key converted by the main-loop keySlot (sp-2)' }),
  Object.freeze({ name: 'set_home_object', pop: 2, push: 2, note: 'home fn -> home fn; fn.[[HomeObject]] = home (QuickJS js_method_set_home_object)' }),
  Object.freeze({ name: 'check_ctor', pop: 0, push: 0, note: 'TypeError when new.target is undefined' }),
  Object.freeze({ name: 'check_ctor_return', pop: 1, push: 2, note: 'v -> v (v === undefined); TypeError unless v is an object or undefined' }),
  Object.freeze({ name: 'init_ctor', pop: 0, push: 1, note: 'default derived constructor: Construct(GetPrototypeOf(F), args, new.target)' }),
  Object.freeze({ name: 'get_super', pop: 1, push: 1, note: 'obj -> obj.[[GetPrototypeOf]]()' }),
  Object.freeze({ name: 'get_super_value', pop: 3, push: 1, note: 'this base key -> base.[[Get]](key, this); key slot sp-1' }),
  Object.freeze({ name: 'put_super_value', pop: 4, push: 0, note: 'this base key value -> ; base.[[Set]](key, value, this), strict; key slot sp-2' }),
  // Generic QuickJS stack shuffles emitted by super compound assignment and
  // updates; another worker may append them too (dedupe by name).
  Object.freeze({ name: 'insert4', pop: 4, push: 5, shared: true, note: 'a b c d -> d a b c d' }),
  Object.freeze({ name: 'dup3', pop: 3, push: 6, shared: true, note: 'a b c -> a b c a b c' }),
  Object.freeze({ name: 'perm5', pop: 5, push: 5, shared: true, note: 'a b c d e -> d a b c e' }),
]);
export const classOpcodeNames = Object.freeze(classOpcodes.map(item => item.name));

// Phase 4 next wave: fields, static blocks and private names are implemented
// in phase4-class-elements.js (lowering, WGSL, representation notes).
export const classRejections = Object.freeze([
  Object.freeze({ where: 'entrySource', node: 'MethodDefinition (async or generator)', message: 'Unsupported async or generator class method' }),
  Object.freeze({ where: 'packProgram', ops: ['define_class', 'define_class_computed'], message: 'Invalid define_class flags (any bit except heritage)' }),
  Object.freeze({ where: 'packProgram', ops: ['special_object'], message: 'Unsupported QuickJS special object: <n> (n > 4: var_object, import_meta)' }),
  Object.freeze({ where: 'runtime status 6', message: 'extends a built-in constructor; NewTarget other than a guest closure; super property writes to exotic receivers (arrays, arguments, wrappers); private elements on exotic objects' }),
]);

// AST rule for program.js entrySource (call for every visited node).
export const classRejectNode = classElementRejectNode;

// packProgram hook. Call first in the instruction loop, before the existing
// renames: `const lowered = classProgramLowering(op, instruction, { text, constants });
// if (lowered) ({ op, a, b } = lowered);`. Returns null for instructions the
// existing lowering keeps (object-literal define_method/_computed, push_const
// literals and every non-class opcode).
export function classProgramLowering(op, instruction, { text, constants }) {
  const operand = instruction.operand;
  const element = classElementLowering(op, instruction, { text });
  if (element) return element;
  switch (op) {
    case 'push_const': case 'push_const8': {
      // Only js_parse_class pushes function bytecode (the constructor for
      // define_class). Creating the closure here is equivalent to
      // js_closure2 inside js_op_define_class: no instruction runs between.
      const constant = constants[operand];
      return constant && 'function' in constant ? { op: 'closure', a: constant.function, b: 0 } : null;
    }
    case 'define_class': case 'define_class_computed': {
      const flags = instruction.bytes[5];
      if (typeof operand !== 'string' || flags & ~1) throw new SyntaxError('Invalid define_class flags');
      return { op: 'define_class', a: text(operand), b: flags | (op === 'define_class_computed' ? 2 : 0) };
    }
    case 'define_method': {
      const flags = instruction.bytes[5];
      if (flags & 4) return null; // object literal: existing enumerable lowering
      const kind = flags & 3;
      if (kind > 2 || flags & ~7) throw new SyntaxError('Invalid method kind');
      const name = (kind === 1 ? 'get ' : kind === 2 ? 'set ' : '') + operand;
      return { op: 'define_class_method', a: text(operand), b: text(name) * 4 + kind };
    }
    case 'define_method_computed': {
      if (operand & 4) return null; // object literal: existing lowering
      const kind = operand & 3;
      if (kind > 2 || operand & ~7) throw new SyntaxError('Invalid computed method kind');
      return { op: 'define_class_method_computed', a: kind, b: kind ? text(kind === 1 ? 'get ' : 'set ') : 0 };
    }
    case 'get_loc_checkthis': return { op: 'get_loc_check', a: operand, b: 0 };
    case 'special_object':
      if (!(operand >= 0 && operand <= 4)) throw new SyntaxError(`Unsupported QuickJS special object: ${operand}`);
      return { op, a: operand, b: 0 };
    case 'set_home_object': case 'check_ctor': case 'check_ctor_return': case 'init_ctor':
    case 'get_super': case 'get_super_value': case 'put_super_value':
    case 'insert4': case 'dup3': case 'perm5':
      return { op, a: 0, b: 0 };
    default: return null;
  }
}

// WGSL module-scope helpers (any position: WGSL module declarations are
// order independent, but they must not separate @compute from fn main).
export const classWGSLFunctions = ({ F, L }) => `
// Phase 4 classes. Closure (kind 5) value=(function, backing, home node, flags:
// bit0 class constructor, bit1 derived). Env (kind 4) value.zw = new.target.
fn classIsConstructor(l:u32,value:V)->bool {
  var v=value;
  for(var i=0u;i<${L.frames}u&&v.z==5u&&states[l].heap[v.x].kind==12u;i++){let bound=states[l].heap[v.x].value;v=V(bound.x,0u,bound.z,0u);}
  if(v.z==11u){return v.x==100u||v.x==200u||(v.x>=600u&&v.x<=606u)||v.x==122u||v.x==136u||v.x==137u||v.x==500u||v.x==2800u||v.x==2200u||v.x==2220u;}
  if(v.z!=5u||states[l].heap[v.x].kind!=5u){return false;}
  return (image[states[l].heap[v.x].value.x*2u].w&0x10000u)!=0u||(states[l].heap[v.x].value.w&1u)!=0u;
}
fn classSetHome(l:u32,fnValue:V,home:V) {
  if(fnValue.z!=5u||states[l].heap[fnValue.x].kind!=5u){return;}
  let obj=objectView(l,home);if(obj.z!=4u){return;}
  states[l].heap[fnValue.x].value.z=obj.x;
}
// DefineMethodProperty / class accessor definition: enumerable false,
// configurable true (writable true for methods). Existing non-configurable
// properties (a static computed "prototype") throw TypeError.
fn classDefineMethod(l:u32,holder:V,key:u32,fnValue:V,kind:u32) {
  if(!functionKey(l,holder,key)){return;}
  let obj=objectView(l,holder);
  if(obj.z!=4u||fnValue.z!=5u||states[l].heap[obj.x].kind!=2u){states[l].status=2u;return;}
  var property=findProperty(l,obj.x,key);
  if(property!=0u&&(states[l].heap[property].marked&8u)==0u){states[l].status=4u;return;}
  if(property==0u){
    if(states[l].heap[obj.x].value.w==0u){states[l].status=4u;return;}
    property=alloc(l,select(9u,3u,kind==0u),V(0u),key,states[l].heap[obj.x].next);
    if(states[l].status!=0u){return;}
    states[l].heap[obj.x].next=property;
  }
  if(kind==0u){states[l].heap[property].kind=3u;states[l].heap[property].value=fnValue;}
  else{
    if(states[l].heap[property].kind!=9u){states[l].heap[property].kind=9u;states[l].heap[property].value=V(0u);}
    states[l].heap[property].value[select(0u,1u,kind==2u)]=fnValue.x;
  }
  states[l].heap[property].marked=10u;
}
// special_object 3 (new.target) and 4 (home object). A function reaching
// special_object 4 without a home object would be a lowering gap: status 6.
fn classSpecialObject(l:u32,kind:u32)->V {
  let env=states[l].heap[states[l].env].value;
  if(kind==3u){if(env.w==0u){return undef();}return V(env.z,0u,env.w,0u);}
  if(kind==4u){let home=states[l].heap[env.x].value.z;if(home!=0u){return objectValue(l,home);}}
  states[l].status=6u;return undef();
}
// OrdinarySet(base, key, value, receiver) for strict class code. Returns a
// tag-12 setter callback for the caller to invoke with the receiver.
fn classSuperSet(l:u32,base:V,receiver:V,key:u32,value:V)->V {
  if(!functionKey(l,receiver,key)){return undef();}
  let start=objectView(l,base);
  if(start.z!=4u){states[l].status=select(6u,4u,start.z==2u||start.z==3u);return undef();}
  var current=start.x;var found=0u;
  for(var i=0u;i<${L.heap}u&&current!=0u&&found==0u;i++){
    found=findProperty(l,current,key);
    if(found==0u&&((states[l].heap[current].kind==7u&&lengthKey(l,key))||stringOwn(l,current,key)!=0u||prototypeGap(l,current,key))){states[l].status=6u;return undef();}
    if(found==0u){current=states[l].heap[current].value.x;}
  }
  if(found!=0u){
    let node=states[l].heap[found];
    if(node.kind==9u){if(node.value.y!=0u){return V(node.value.y,0u,12u,0u);}states[l].status=4u;return undef();}
    if(node.kind==11u){states[l].status=6u;return undef();}
    if((node.marked&2u)==0u){states[l].status=4u;return undef();}
  }
  // WGSL reserves "target"; holder is the receiver's own-property node.
  let holder=objectView(l,receiver);
  if(holder.z!=4u){states[l].status=select(6u,4u,receiver.z<4u||receiver.z==7u);return undef();}
  if(states[l].heap[holder.x].kind!=2u){states[l].status=6u;return undef();}
  let own=findProperty(l,holder.x,key);
  if(own!=0u){
    if(states[l].heap[own].kind!=3u||(states[l].heap[own].marked&2u)==0u){states[l].status=4u;return undef();}
    states[l].heap[own].value=value;return undef();
  }
  if(states[l].heap[holder.x].value.w==0u){states[l].status=4u;return undef();}
  let property=alloc(l,3u,value,key,states[l].heap[holder.x].next);
  if(states[l].status==0u){states[l].heap[holder.x].next=property;}
  return undef();
}
`;

// Case bodies for shader.js cases(name, body); `l`, `ins`, `arg` as in main().
export const classWGSLCases = ({ F, L }) => ({
  define_class: `let fnValue=pop(l);let parentValue=pop(l);
        if(fnValue.z!=5u||states[l].heap[fnValue.x].kind!=5u){states[l].status=2u;break;}
        let heritage=(ins.z&1u)!=0u;var protoParent=1u;var ctorParent=3u;
        if(heritage&&parentValue.z==2u){protoParent=0u;}
        else if(heritage){
          if(!classIsConstructor(l,parentValue)){states[l].status=4u;break;}
          // Built-in parents need OrdinaryCreateFromConstructor(newTarget) in
          // their native [[Construct]]. Closures and bound functions (kind 12,
          // backing in value.y) are supported.
          if(parentValue.z!=5u){states[l].status=6u;break;}
          let parentPrototype=getProperty(l,parentValue,fieldKey(${F.prototype}u));if(states[l].status!=0u){break;}
          let parentView=objectView(l,parentPrototype);
          if(parentPrototype.z==12u||parentView.z==11u){states[l].status=6u;break;}
          if(parentView.z==2u){protoParent=0u;}else if(parentView.z==4u){protoParent=parentView.x;}else{states[l].status=4u;break;}
          ctorParent=states[l].heap[parentValue.x].value.y;
        }
        var name=image[arg];
        if((ins.z&2u)!=0u){let key=keyOf(l,peek(l));if(states[l].status!=0u){break;}name=symbolFunctionName(l,key);if(states[l].status!=0u){break;}}
        let proto=alloc(l,2u,V(protoParent,0u,0u,1u),0u,0u);
        let constructor=alloc(l,3u,fnValue,fieldKey(${F.constructor}u),0u);
        let backing=states[l].heap[fnValue.x].value.y;
        let property=alloc(l,3u,V(proto,0u,4u,0u),fieldKey(${F.prototype}u),states[l].heap[backing].next);
        if(states[l].status!=0u){break;}
        states[l].heap[constructor].marked=10u;states[l].heap[proto].next=constructor;
        states[l].heap[property].marked=0u;states[l].heap[backing].next=property;
        states[l].heap[backing].value.x=ctorParent;
        states[l].heap[fnValue.x].value.z=proto;states[l].heap[fnValue.x].value.w=select(1u,3u,heritage);
        functionName(l,fnValue,name,true);
        push(l,fnValue);push(l,V(proto,0u,4u,0u));`,
  define_class_method: `let fnValue=pop(l);functionName(l,fnValue,image[ins.z>>2u],true);
        let key=keyOf(l,image[arg]);if(states[l].status!=0u){break;}
        let obj=peek(l);classSetHome(l,fnValue,obj);classDefineMethod(l,obj,key,fnValue,ins.z&3u);`,
  define_class_method_computed: `let fnValue=pop(l);let key=keyOf(l,pop(l));if(states[l].status!=0u){break;}let obj=peek(l);var name=symbolFunctionName(l,key);
        if(states[l].status!=0u){break;}
        if(arg!=0u){let prefix=image[ins.z];name=makeText(l,prefix,name,0u,prefix.y+name.y);}
        functionName(l,fnValue,name,true);classSetHome(l,fnValue,obj);classDefineMethod(l,obj,key,fnValue,arg);`,
  set_home_object: `if(states[l].sp<2u){states[l].status=2u;break;}classSetHome(l,peek(l),states[l].stack[states[l].sp-2u]);`,
  check_ctor: `if(states[l].heap[states[l].env].value.w==0u){states[l].status=4u;}`,
  check_ctor_return: `let value=peek(l);
        if(value.z==4u||value.z==5u||value.z==11u){push(l,boolean(false));}else if(value.z==3u){push(l,boolean(true));}else{states[l].status=4u;}`,
  init_ctor: `let env=states[l].heap[states[l].env].value;
        if(env.w==0u){states[l].status=4u;break;}
        if(env.y>${L.args}u||states[l].sp+env.y+2u>${L.stack}u){states[l].status=3u;break;}
        push(l,objectValue(l,states[l].heap[states[l].heap[env.x].value.y].value.x));push(l,V(env.z,0u,env.w,0u));
        for(var i=0u;i<env.y;i++){push(l,states[l].heap[cell(l,states[l].env,i,false)].value);}
        construct(l,env.y);`,
  // The pushed super base carries w=1 (objects, closures and builtins
  // otherwise have w=0): QuickJS rewrites super.m(...) to get_array_el on
  // [this base key], and the get_array_el patch then runs an accessor with
  // this as receiver (ES2025 super Reference thisValue).
  get_super: `let value=pop(l);let obj=objectView(l,value);
        if(obj.z!=4u){states[l].status=select(6u,4u,value.z==2u||value.z==3u);break;}
        var superBase=objectValue(l,states[l].heap[obj.x].value.x);
        if(superBase.z!=2u){superBase.w=1u;}
        push(l,superBase);`,
  get_super_value: `let keyValue=pop(l);let base=pop(l);let receiver=pop(l);let key=keyOf(l,keyValue);if(states[l].status!=0u){break;}
        let value=getProperty(l,base,key);if(states[l].status!=0u){break;}
        if(value.z==12u){push(l,receiver);push(l,callbackValue(value.x));call(l,0u,true,false);}else{push(l,value);}`,
  put_super_value: `let value=pop(l);let keyValue=pop(l);let base=pop(l);let receiver=pop(l);
        if(base.z!=4u&&base.z!=5u&&base.z!=11u){states[l].status=4u;break;}
        let key=keyOf(l,keyValue);if(states[l].status!=0u){break;}
        let pending=classSuperSet(l,base,receiver,key,value);if(states[l].status!=0u){break;}
        if(pending.z==12u){push(l,receiver);push(l,callbackValue(pending.x));push(l,value);let depth=states[l].depth;call(l,1u,true,false);
          if(states[l].status==0u){if(states[l].depth>depth){states[l].frames[states[l].depth].tail=2u;}else{let ignored=pop(l);}}}`,
  insert4: `let d=pop(l);let c=pop(l);let b=pop(l);let a=pop(l);push(l,d);push(l,a);push(l,b);push(l,c);push(l,d);`,
  dup3: `let c=pop(l);let b=pop(l);let a=pop(l);push(l,a);push(l,b);push(l,c);push(l,a);push(l,b);push(l,c);`,
  perm5: `let e=pop(l);let d=pop(l);let c=pop(l);let b=pop(l);let a=pop(l);push(l,d);push(l,a);push(l,b);push(l,c);push(l,e);`,
});

// Exact textual edits to lead-owned files. `find` is the current source text
// (template placeholders unevaluated) and must occur exactly once;
// check-phase4-classes.mjs verifies that and generates the patched WGSL.
export const classShaderPatches = Object.freeze([
  {
    id: 'collect-home-newtarget', file: 'shader.js',
    why: 'GC: closure.home (kind 5 value.z) and env new.target (kind 4 value.z when value.w!=0) are new references',
    find: `    if (node.kind == 5u || node.kind==12u) { mark(l,node.value.y); }\n`,
    replace: `    if (node.kind == 5u || node.kind==12u) { mark(l,node.value.y); }\n    if(node.kind==5u){mark(l,node.value.z);}\n    if(node.kind==4u&&node.value.w!=0u){mark(l,node.value.z);}\n`,
  },
  {
    id: 'construct-newtarget-var', file: 'shader.js',
    why: 'construct(): keep the NewTarget separately from the callee (super() passes the derived constructor)',
    find: `var callee=states[l].stack[base];let newTarget=states[l].stack[base+1u];`,
    replace: `var callee=states[l].stack[base];let newTarget=states[l].stack[base+1u];var constructTarget=newTarget;`,
  },
  {
    id: 'construct-admit-super-newtarget', file: 'shader.js',
    why: 'construct(): NewTarget may differ from the callee only for super(...) (a guest closure); Reflect.construct-style targets stay status 6',
    find: `  if(!equal(l,callee,newTarget)){states[l].status=6u;return;}\n`,
    replace: `  if(!equal(l,callee,newTarget)&&!(newTarget.z==5u&&states[l].heap[newTarget.x].kind==5u)){states[l].status=6u;return;}\n`,
  },
  {
    id: 'construct-bound-newtarget', file: 'shader.js',
    why: 'BoundFunction [[Construct]] step 5: if SameValue(F, newTarget), newTarget = target',
    find: `argc+=count;callee=V(bound.value.x,0u,bound.value.z,0u);states[l].sp=base+2u+argc;`,
    replace: `argc+=count;let inner=V(bound.value.x,0u,bound.value.z,0u);if(equal(l,callee,constructTarget)){constructTarget=inner;}callee=inner;states[l].sp=base+2u+argc;`,
  },
  {
    id: 'construct-builtin-newtarget', file: 'shader.js',
    why: 'super() into a built-in constructor (class extends Array/Error/...) needs OrdinaryCreateFromConstructor(newTarget): explicit status 6; non-constructors TypeError',
    find: `  if(callee.z==11u){\n    // new String/Number/Boolean: NewTarget equals the callee, so the result\n`,
    replace: `  if(callee.z==11u){\n    if(!equal(l,callee,constructTarget)){states[l].status=select(4u,6u,classIsConstructor(l,callee));return;}\n    // new String/Number/Boolean: NewTarget equals the callee, so the result\n`,
  },
  {
    id: 'construct-class-derived-newtarget', file: 'shader.js',
    why: 'class constructors are constructors without hasPrototype; derived constructors do not allocate this; the object prototype comes from NewTarget; the callee environment records new.target',
    find: `  let info=image[states[l].heap[callee.x].value.x*2u];
  if((info.w&0x10000u)==0u){states[l].status=4u;return;}
  let value=getProperty(l,callee,fieldKey(\${F.prototype}u));let prototype=objectView(l,value);
  if(states[l].status!=0u){return;}
  if(prototype.z==11u||prototype.z==12u){states[l].status=6u;return;}
  var parent=1u;if(prototype.z==4u){parent=prototype.x;}
  let obj=alloc(l,2u,V(parent,0u,0u,1u),0u,0u);
  states[l].stack[base]=V(obj,0u,4u,0u);states[l].stack[base+1u]=callee;
  let depth=states[l].depth;call(l,argc,true,false);
  if(states[l].status==0u&&states[l].depth>depth){states[l].frames[states[l].depth].tail=3u;}
}
`,
    replace: `  let info=image[states[l].heap[callee.x].value.x*2u];let classFlags=states[l].heap[callee.x].value.w;
  if((info.w&0x10000u)==0u&&(classFlags&1u)==0u){states[l].status=4u;return;}
  // Derived constructors receive an uninitialized this; super() creates it.
  var receiver=undef();
  if((classFlags&2u)==0u){
    let value=getProperty(l,constructTarget,fieldKey(\${F.prototype}u));let prototype=objectView(l,value);
    if(states[l].status!=0u){return;}
    if(prototype.z==11u||prototype.z==12u){states[l].status=6u;return;}
    var parent=1u;if(prototype.z==4u){parent=prototype.x;}
    receiver=V(alloc(l,2u,V(parent,0u,0u,1u),0u,0u),0u,4u,0u);
    if(states[l].status!=0u){return;}
  }
  states[l].stack[base]=receiver;states[l].stack[base+1u]=callee;
  let depth=states[l].depth;call(l,argc,true,false);
  if(states[l].status==0u&&states[l].depth>depth){
    states[l].frames[states[l].depth].tail=3u;
    states[l].heap[states[l].env].value.z=constructTarget.x;states[l].heap[states[l].env].value.w=5u;
  }
}
`,
  },
  {
    id: 'keyslot-class-ops', file: 'shader.js',
    why: 'resumable ToPropertyKey for computed class element keys and super[key] references',
    find: `    if(op==\${OP.define_array_el}u||op==\${OP.define_method_computed}u||op==\${OP.set_name_computed}u){keySlot=states[l].sp-2u;}\n`,
    replace: `    if(op==\${OP.define_array_el}u||op==\${OP.define_method_computed}u||op==\${OP.set_name_computed}u||op==\${OP.define_class_method_computed}u||op==\${OP.put_super_value}u){keySlot=states[l].sp-2u;}\n    if(op==\${OP.get_super_value}u){keySlot=states[l].sp-1u;}\n`,
  },
  {
    id: 'special-object-newtarget-home', file: 'shader.js',
    why: 'special_object 3 (new.target) and 4 (home object)',
    find: "      ${cases('special_object', `if(arg<2u){push(l,argumentsObject(l,arg==1u));}else{push(l,V(states[l].heap[states[l].env].value.x,0u,5u,0u));}`)}\n",
    replace: "      ${cases('special_object', `if(arg<2u){push(l,argumentsObject(l,arg==1u));}else if(arg==2u){push(l,V(states[l].heap[states[l].env].value.x,0u,5u,0u));}else{push(l,classSpecialObject(l,arg));}`)}\n",
  },
  {
    id: 'this-init-once', file: 'shader.js',
    why: "put_loc_check_init / put_var_ref_check_init are emitted only for a derived constructor's this: a second super() throws ReferenceError",
    find: `          if ((op==\${OP.put_loc_check}u || op==\${OP.set_loc_check}u || op==\${OP.put_var_ref_check}u) && states[l].heap[c].value.z==6u) { states[l].status=5u; break; }\n`,
    replace: `          if ((op==\${OP.put_loc_check}u || op==\${OP.set_loc_check}u || op==\${OP.put_var_ref_check}u) && states[l].heap[c].value.z==6u) { states[l].status=5u; break; }\n          if ((op==\${OP.put_loc_check_init}u || op==\${OP.put_var_ref_check_init}u) && states[l].heap[c].value.z!=6u) { states[l].status=5u; break; }\n`,
  },
  {
    id: 'super-call-getter-receiver', file: 'shader.js',
    why: 'QuickJS lowers super.m(...) to get_array_el on [this base key] (quickjs.c js_parse_postfix_expr, OP_get_super_value -> OP_get_array_el); a getter must still receive this, which is the slot under the marked super base',
    find: `        if(value.z==12u) {push(l,obj);push(l,callbackValue(value.x));call(l,0u,true,false);}`,
    replace: `        if(value.z==12u) {var getterThis=obj;if(op==\${OP.get_array_el}u&&obj.w==1u&&(obj.z==4u||obj.z==5u||obj.z==11u)){getterThis=peek(l);}push(l,getterThis);push(l,callbackValue(value.x));call(l,0u,true,false);}`,
  },
  {
    id: 'object-literal-home-method', file: 'shader.js',
    why: 'object-literal methods (define_method lowered to define_field with b!=0) get [[HomeObject]] for super',
    find: `if(op==\${OP.define_field}u&&ins.z!=0u){functionName(l,value,image[ins.z],true);}`,
    replace: `if(op==\${OP.define_field}u&&ins.z!=0u){functionName(l,value,image[ins.z],true);classSetHome(l,value,peek(l));}`,
  },
  {
    id: 'object-literal-home-accessor', file: 'shader.js',
    why: 'object-literal getters/setters get [[HomeObject]]',
    find: "${cases('define_getter define_setter', `let fnValue=pop(l);functionName(l,fnValue,image[ins.z],true);\n",
    replace: "${cases('define_getter define_setter', `let fnValue=pop(l);functionName(l,fnValue,image[ins.z],true);classSetHome(l,fnValue,peek(l));\n",
  },
  {
    id: 'object-literal-home-computed', file: 'shader.js',
    why: 'object-literal computed methods/accessors get [[HomeObject]]',
    find: `        functionName(l,fnValue,name,true);\n        if(arg==0u){let ignored=putProperty(l,obj,key,fnValue,true);}`,
    replace: `        functionName(l,fnValue,name,true);classSetHome(l,fnValue,obj);\n        if(arg==0u){let ignored=putProperty(l,obj,key,fnValue,true);}`,
  },
]);

export const classProgramPatches = Object.freeze([
  {
    id: 'entry-ast-rejections', file: 'program.js',
    why: 'explicit compiler rejections for unsupported class elements',
    find: `    const node=nodes.pop();\n`,
    replace: `    const node=nodes.pop();\n    const classRejection=classRejectNode(node);if(classRejection)throw new SyntaxError(classRejection);\n`,
  },
  {
    id: 'pack-class-lowering', file: 'program.js',
    why: 'class operand packing before the existing renames',
    find: `      let { op, operand: a } = instruction, b = 0;\n`,
    replace: `      let { op, operand: a } = instruction, b = 0;\n      const classLowered = classProgramLowering(op, instruction, { text, constants });\n      if (classLowered) ({ op, a, b } = classLowered);\n`,
  },
  {
    id: 'pack-home-object-op', file: 'program.js',
    why: 'set_home_object becomes a real opcode (it was a nop)',
    find: `      if (['set_home_object', 'nop'].includes(op)) { op = 'nop'; a = 0; }\n`,
    replace: `      if (op === 'nop') a = 0;\n`,
  },
  {
    id: 'pack-special-object', file: 'program.js',
    why: 'admit new.target (3) and home object (4)',
    find: `if (op === 'special_object' && a !== 0 && a !== 1 && a !== 2) throw`,
    replace: `if (op === 'special_object' && !(a >= 0 && a <= 4)) throw`,
  },
]);

// No guest helpers, private builtins or continuations are needed.
export const classBootstrapSources = Object.freeze({});
export const classPrivateBuiltins = Object.freeze({});

export const classNotes = Object.freeze({
  integration: [
    'phase4-registry.js: append classOpcodeNames (dedupe shared insert4/dup3/perm5) to phase4Opcodes; merge classWGSLCases(ctx) into phase4WGSLCases(ctx); append classWGSLFunctions(ctx) to phase4WGSLFunctions(ctx).',
    'program.js: import { classProgramLowering, classRejectNode } from ./phase4-classes.js and apply classProgramPatches (4 edits).',
    'shader.js: apply classShaderPatches (13 edits). The WGSL helpers reference objectView/objectValue/getProperty/functionKey/findProperty/alloc/construct/call from shader.js.',
    'shader.js currently emits ${phase4WGSLFunctions(...)} between "@compute @workgroup_size(32)" and "fn main": with non-empty helpers the attribute attaches to the first helper. Move the interpolation above the @compute line.',
  ],
  representation: 'closure kind 5 value=(f, backing, home node, flags bit0 class ctor / bit1 derived); env kind 4 value=(closure, argc, newTarget id, 5 or 0); the get_super result has w=1 (tags 4/5/11 otherwise always have w=0; equal() and objectView ignore w). Frame layout, heap kinds, continuations and builtin ids are unchanged.',
  bytecodeContract: 'push_const with a function constant lowers to closure (only js_parse_class emits it); get_loc_checkthis lowers to get_loc_check (both ReferenceError on TDZ).',
  enumerableFlag: 'define_method keeps the existing lowering when bytes[5] has OP_DEFINE_METHOD_ENUMERABLE (object literals) and becomes define_class_method otherwise; define_method_computed likewise on operand bit 4. Existing packed programs are bit-identical (check-phase4-classes.mjs packs the existing corpora both ways).',
  gaps: [
    'Public/private fields, private methods/accessors, static blocks and async/generator methods are compiler-rejected.',
    'extends built-in constructors: runtime status 6 at class definition; Reflect.construct-style NewTarget: status 6.',
    'super property writes to exotic receivers (arrays, arguments objects, wrappers) report status 6.',
    'Pinned QuickJS rewrites super.m(...) to get_array_el, so its own interpreter runs an accessor m with the home prototype as this. The GPU lowering marks the get_super result (w=1) and the get_array_el patch passes this instead (ES2025); the native QuickJS oracle therefore differs for that fixture (recorded as quickjs in phase4-class-cases.js).',
    'Class source text (Function.prototype.toString) is not implemented.',
  ],
});
