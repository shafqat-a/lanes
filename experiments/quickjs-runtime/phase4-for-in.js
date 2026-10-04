// Phase 4 worker 6: for-in statements (ES2025 14.7.5 ForIn/OfHeadEvaluation,
// EnumerateObjectProperties and the For-In Iterator reference algorithm,
// 14.7.5.10.2.1 %ForInIteratorPrototype%.next).
//
// Integration package shaped for phase4-registry.js. No imports (the registry
// is imported by program.js/bootstrap.js/shader.js; importing them here would be
// a cycle). WGSL generators receive { OP, F, L } lazily. Nothing here runs guest
// code on the host: the helper sources are compiled by QuickJS and their bytecode
// executes in the WGSL VM like every other bootstrap helper.
//
// Reservations used (PHASE-4-STATUS.md, worker 6): private builtin IDs 1350-1354
// of 1350-1369 and continuation (Frame.tail) 50 of 50-51. Heap kinds 29-30 are
// NOT needed: the enumeration record is an ordinary null-prototype object that
// only lives on the operand stack and is never bound to a guest variable.

// ---- Opcodes (vendor/quickjs-opcode.h) ----
export const forInOpcodeNames = Object.freeze(['for_in_start', 'for_in_next']);
export const forInOpcodes = Object.freeze([
  Object.freeze({ name: 'for_in_start', size: 1, pop: 1, push: 1, format: 'none',
    stack: 'obj -> record', lowering: 'calls guest helper __lanesForInStart (1350) with obj; the returned record replaces obj' }),
  Object.freeze({ name: 'for_in_next', size: 1, pop: 1, push: 3, format: 'none',
    stack: 'record -> record value done', lowering: 'calls guest helper __lanesForInNext (1351) with record; finish() continuation 50 pushes value and done' }),
]);

// ---- program.js lowering ----
// Both opcodes have format none: [OP[name], 0, 0, f]. QuickJS emission
// (js_parse_for_in_of, quickjs.c ~28880-29108, OPTIMIZE relocates `next`):
//   goto L_expr
//   L_next:  <head assignment: put_loc / put_loc_check_init / put_var_ref / put_field / put_array_el ...>
//            goto L_body
//   L_expr:  [Annex B var initializer] <object expression> [close_loc: TDZ head bindings captured there]
//            for_in_start
//            goto L_cont
//   L_body:  <statement> [close_loc: per-iteration let/const copies]
//   L_cont:  for_in_next
//            if_false L_next          ; done === false -> assign value, run body
//            drop                     ; the undefined value
//   L_break: drop                     ; the record (break lands here)
// The relocated chunk leaves OP_nop padding (already lowered to nop).
// `return` needs no cleanup; break/continue use the loop's break entry.
export function forInLowering(op) {
  if (!forInOpcodeNames.includes(op)) throw new Error(`not a for-in opcode: ${op}`);
  return { op, a: 0, b: 0 };
}
export const forInProgramLowering = Object.freeze({
  for_in_start: Object.freeze({ operand: 'none -> a=0, b=0', lower: forInLowering }),
  for_in_next: Object.freeze({ operand: 'none -> a=0, b=0', lower: forInLowering }),
});

// ---- Private builtins ----
// 1350/1351 are pushed by the opcodes and resolve in call() to the helper fields
// (forInBuiltinFields). 1352-1354 are WGSL primitives (forInObjectMethodWGSL)
// that the helpers capture by name.
export const forInPrivateBuiltins = Object.freeze({
  __lanesForInStart: 1350,      // guest helper field forInStart
  __lanesForInNext: 1351,       // guest helper field forInNext
  __lanesForInOwn: 1352,        // (object, key) -> 0 absent, 1 own non-enumerable, 2 own enumerable; never reads values
  __lanesForInKeys: 1353,       // object -> Array of enumerable own STRING keys in [[OwnPropertyKeys]] order
  __lanesGetPrototypeOf: 1354,  // object -> [[GetPrototypeOf]] (intrinsic; no guest-mutable Object.getPrototypeOf lookup)
});
export const forInBuiltinFields = Object.freeze({ 1350: 'forInStart', 1351: 'forInNext' });

// ---- Guest helpers (bootstrap sources) ----
// Record layout (null-prototype object from __lanesDescriptor()):
//   object  current object O on the chain (null once finished)
//   keys    enumerable own string keys of O, taken when O is reached
//   index   next position in keys
//   visited null-prototype set of keys already returned
//   levels  objects below O on the chain (numeric keys 0..depth-1)
//   depth   number of entries in levels
export const forInStartSource = `function forInStartBootstrap(value) {
  "use strict";
  const record = __lanesDescriptor();
  record.visited = __lanesDescriptor();
  record.levels = __lanesDescriptor();
  record.depth = 0;
  record.index = 0;
  if (value === null || value === undefined) {
    record.object = null;
    return record;
  }
  const object = __lanesToObject(value);
  record.object = object;
  record.keys = __lanesForInKeys(object);
  return record;
}`;

export const forInNextSource = `function forInNextBootstrap(record) {
  "use strict";
  let object = record.object;
  while (object !== null) {
    const keys = record.keys;
    const count = keys.length;
    let index = record.index;
    while (index < count) {
      const key = keys[index];
      index++;
      if (typeof key !== "string") __lanesUnsupported();
      if (__lanesOwnHas(record.visited, key)) continue;
      if (__lanesForInOwn(object, key) !== 2) continue;
      const levels = record.levels;
      const depth = record.depth;
      let shadowed = false;
      for (let level = 0; level < depth && !shadowed; level++) shadowed = __lanesForInOwn(levels[level], key) !== 0;
      if (shadowed) continue;
      record.visited[key] = true;
      record.index = index;
      return key;
    }
    record.levels[record.depth] = object;
    record.depth = record.depth + 1;
    object = __lanesGetPrototypeOf(object);
    record.object = object;
    record.index = 0;
    if (object !== null) record.keys = __lanesForInKeys(object);
  }
  return record;
}`;

export const forInBootstrapSources = Object.freeze({ forInStart: forInStartSource, forInNext: forInNextSource });

// ---- WGSL ----
// Case bodies for shader.js cases(name, body); `l` as in main().
export const forInWGSLCases = () => ({
  // obj -> record. A missing helper leaves id 1350 native: objectMethod reports status 6.
  for_in_start: `let value=pop(l);push(l,V(1350u,0u,11u,0u));push(l,value);call(l,1u,false,false);`,
  // record -> record value done. The helper frame's continuation 50 pushes value/done.
  for_in_next: `let record=peek(l);push(l,V(1351u,0u,11u,0u));push(l,record);
        let depth=states[l].depth;call(l,1u,false,false);
        if(states[l].status==0u){if(states[l].depth>depth){states[l].frames[states[l].depth].tail=50u;}else{states[l].status=6u;}}`,
});

// finish() continuation 50 (mirrors worker 4's iterator-step continuation 40):
// the helper returns the next key, or the private record itself as the done
// sentinel (keys are strings, so identity is unambiguous). The record is still
// in the operand slot directly below the helper frame base.
export const forInContinuations = () => [{ code: 50, body: `
    let record=states[l].stack[states[l].sp-1u];
    if(returned.z==4u&&record.z==4u&&returned.x==record.x){push(l,undef());push(l,boolean(true));}
    else{push(l,returned);push(l,boolean(false));}
  ` }];

// objectMethod() lines (`a` is objectView(l,original); b is the second argument).
export const forInObjectMethodWGSL = ({ F }) => `if(id==1353u){return forInKeys(l,original);}
  if(id==1354u){if(a.z!=4u){states[l].status=select(6u,4u,a.z==2u||a.z==3u);return undef();}return objectValue(l,states[l].heap[a.x].value.x);}
  if(id==1352u){
    // For-in visit check: [[GetOwnProperty]] existence and enumerability without
    // reading the value. 0 absent, 1 own non-enumerable, 2 own enumerable.
    let key=keyOf(l,b);if(states[l].status!=0u){return undef();}
    if(a.z!=4u){states[l].status=6u;return undef();}
    if(ownGap(l,a.x,key)){return undef();}
    // %Function.prototype% owns non-enumerable caller/arguments accessors (ES2025 10.2.4).
    if(a.x==3u&&(field(l,key,${F.caller}u)||field(l,key,${F.arguments}u))){return num(fromUnsigned(1u));}
    let property=findProperty(l,a.x,key);let stringKind=stringOwn(l,a.x,key);
    if(stringKind==1u||(property!=0u&&(states[l].heap[property].marked&4u)!=0u)){return num(fromUnsigned(2u));}
    if(property!=0u||stringKind!=0u||(states[l].heap[a.x].kind==7u&&lengthKey(l,key))){return num(fromUnsigned(1u));}
    return num(fromUnsigned(0u));
  }`;

// Module-scope WGSL functions.
export const forInWGSLFunctions = ({ L }) => `
// EnumerateObjectProperties level keys (phase 4 for-in, builtin 1353): the
// enumerable own string keys of an object in [[OwnPropertyKeys]] order (String
// exotic indices, other array indices ascending, then named keys in creation
// order; property lists are newest-first). Unlike ownKeys this accepts the
// wrapper prototypes 20-22, sloppy functions and the mapped intrinsic objects:
// every unimplemented built-in property there is non-enumerable, so these
// enumerable lists are exact. Shadowing by unimplemented properties is checked
// per key by builtin 1352 (ownGap reports status 6).
// Phase 3 contract: symbol-keyed properties must never be listed here.
fn forInKeys(l:u32,original:V)->V {
  let object=objectView(l,original);
  if(object.z==2u||object.z==3u){states[l].status=4u;return undef();}
  if(object.z!=4u){states[l].status=6u;return undef();}
  let text=wrapped(l,object.x);var exotic=0u;if(text.z==7u){exotic=text.y;}
  var numeric=exotic;var named=0u;var current=states[l].heap[object.x].next;
  for(var n=0u;n<${L.heap}u&&current!=0u;n++){
    let node=states[l].heap[current];
    if((node.marked&4u)!=0u&&!phase3SymbolKey(node.key)){if(arrayIndex(l,node.key)!=0xffffffffu){numeric++;}else{named++;}}
    current=node.next;
  }
  let count=numeric+named;
  let result=alloc(l,7u,V(2u,count,0u,1u),0u,0u);let value=V(result,0u,4u,0u);
  var nextName=count;current=states[l].heap[object.x].next;
  for(var n=0u;n<${L.heap}u&&current!=0u&&states[l].status==0u;n++){
    let node=states[l].heap[current];
    if((node.marked&4u)!=0u&&!phase3SymbolKey(node.key)&&arrayIndex(l,node.key)==0xffffffffu){nextName--;dataProperty(l,result,0x80000000u|nextName,keyName(l,node.key),7u);}
    current=node.next;
  }
  for(var i=0u;i<exotic&&states[l].status==0u;i++){dataProperty(l,result,0x80000000u|i,unsignedText(l,i),7u);}
  var minimum=0u;
  for(var i=exotic;i<numeric&&states[l].status==0u;i++){
    var found=0xffffffffu;current=states[l].heap[object.x].next;
    for(var n=0u;n<${L.heap}u&&current!=0u;n++){
      let node=states[l].heap[current];let index=arrayIndex(l,node.key);
      if(index!=0xffffffffu&&index>=minimum&&(node.marked&4u)!=0u){found=min(found,index);}
      current=node.next;
    }
    if(found==0xffffffffu){states[l].status=6u;return undef();}
    dataProperty(l,result,0x80000000u|i,unsignedText(l,found),7u);minimum=found+1u;
  }
  return value;
}
`;

// ---- phase4-registry.js wiring ----
// Each registry export below is wrapped so the for-in contribution is appended
// to whatever the registry already contributes. applyForInRegistry(text) does
// exactly this (the checker applies it to a private copy); by hand it is:
//   import { forInOpcodeNames, forInLowering, forInBootstrapSources, forInPrivateBuiltins, forInBuiltinFields,
//            forInWGSLCases, forInContinuations, forInObjectMethodWGSL, forInWGSLFunctions } from './phase4-for-in.js';
//   phase4Opcodes          += ...forInOpcodeNames
//   phase4BootstrapSources += ...forInBootstrapSources
//   phase4PrivateBuiltins  += ...forInPrivateBuiltins
//   phase4BuiltinFields    += ...forInBuiltinFields
//   phase4Lowering:        if (forInOpcodeNames.includes(op)) return forInLowering(op);
//   phase4WGSLCases:       ...forInWGSLCases(context)
//   phase4Continuations:   ...forInContinuations(context)
//   phase4ObjectMethods:   forInObjectMethodWGSL(context)
//   phase4WGSLFunctions:   + forInWGSLFunctions(context)
export const forInRegistryWiring = Object.freeze({
  phase4Opcodes: base => Object.freeze([...base, ...forInOpcodeNames]),
  phase4BootstrapSources: base => Object.freeze({ ...base, ...forInBootstrapSources }),
  phase4PrivateBuiltins: base => Object.freeze({ ...base, ...forInPrivateBuiltins }),
  phase4BuiltinFields: base => Object.freeze({ ...base, ...forInBuiltinFields }),
  phase4Lowering: base => (op, instruction, previous) => forInOpcodeNames.includes(op) ? forInLowering(op) : base(op, instruction, previous),
  phase4WGSLCases: base => context => ({ ...base(context), ...forInWGSLCases(context) }),
  phase4Continuations: base => context => [...base(context), ...forInContinuations(context)],
  phase4ObjectMethods: base => context => [...base(context), forInObjectMethodWGSL(context)],
  phase4WGSLFunctions: base => context => base(context) + forInWGSLFunctions(context),
});
export function applyForInRegistry(text, importPath = './phase4-for-in.js') {
  let out = text, appended = '';
  for (const name of Object.keys(forInRegistryWiring)) {
    const pattern = new RegExp(`^export (const ${name} =|function ${name}\\()`, 'm');
    const match = pattern.exec(out);
    if (!match || pattern.test(out.slice(match.index + 1))) throw new Error(`phase4-registry.js: expected exactly one export ${name}`);
    out = out.slice(0, match.index) + (match[1].startsWith('const') ? `const ${name}Base =` : `function ${name}Base(`) + out.slice(match.index + match[0].length);
    appended += `export const ${name} = forInRegistryWiring.${name}(${name}Base);\n`;
  }
  return `import { forInRegistryWiring } from '${importPath}';\n${out}\n// Phase 4 worker 6 (for-in) contributions.\n${appended}`;
}

export const forInNotes = Object.freeze([
  'Integration: wire phase4-registry.js as forInRegistryWiring describes (applyForInRegistry(text) performs it mechanically). No direct program.js, bootstrap.js or shader.js edit is needed; FIELDS forInStart/forInNext come from phase4BootstrapSources.',
  'Semantics follow the ES2025 For-In Iterator reference algorithm: the keys of each object on the chain are taken when that object is reached (the receiver at for_in_start), integer indices ascending, then strings in creation order. Each key is re-checked at visit time: the object that listed it must still have it as an own enumerable property. Returned keys are never returned again. A key is also skipped when an object lower on the chain currently owns it, enumerable or not, which implements shadowing.',
  'null/undefined: the record has object null, so the first for_in_next is done and the body never runs (ForIn/OfHeadEvaluation break completion). Primitives use the existing ToObject primitive (__lanesToObject 926): strings enumerate their indices; Number/Boolean wrappers have no own keys.',
  'Symbols: for-in never yields symbol keys. forInKeys (1353) lists only string keys; Phase 3 must keep it string-only when symbol-keyed properties exist. The helper also calls __lanesUnsupported() if a non-string key reaches it, so a Phase 3 regression reports status 6 instead of enumerating a symbol. The shared own-keys interface __lanesOwnPropertyKeys (1240, worker 3) is not used because for-in needs enumerable keys of String/Number/Boolean.prototype and sloppy functions, which the generic [[OwnPropertyKeys]] primitive rejects.',
  'Continuation 50 mirrors worker 4 iterator continuation 40: the helper returns the key, or the record itself as the done sentinel. finish() reads the record from the operand slot below the helper frame base and pushes `value done`, as QuickJS js_for_in_next does.',
  'The helpers never call user code: no getters, no ToPrimitive, no proxies. Status 6 arises only from unsupported receivers (native builtin functions not mapped by objectView) or from shadowing checks against unimplemented String/Number prototype names (ownGap).',
  'Unlike Object.keys/getOwnPropertyNames (ownKeys), for-in accepts String/Number/Boolean.prototype, sloppy functions and the mapped intrinsics (Object, Array, Function.prototype, Error constructors). Only enumerable keys are listed, and every unimplemented built-in property is non-enumerable. %Function.prototype% caller/arguments are not materialized, but 1352 reports them as own non-enumerable so they still shadow.',
  'Implementation-defined behaviour that is deliberately untested: properties added during enumeration; enumerability changes during enumeration; deleting an own key that a prototype also has. For the last case, the ES2025 reference algorithm and this helper visit the inherited key at the prototype position; QuickJS skips it; V8 visits it at the own position.',
  'QuickJS snapshots own-key enumerability at for_in_start (JS_GPN_SET_ENUM). This helper snapshots the enumerable keys of each level when it is reached and re-checks enumerability at visit time. The two differ only when enumerability changes during iteration.',
  'Lexical bindings: per-iteration let/const copies, `for (let x in x)` TDZ and the permanent TDZ of closures created in the head expression all come from the pinned compiler (close_loc after the head expression and after the body). They need no runtime support beyond for_in_*. The native QuickJS oracle confirms each fixture.',
]);
