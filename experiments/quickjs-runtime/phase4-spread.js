// Phase 4, worker 2: rest parameters, spread arguments (calls, method calls,
// `new F(...a)`) and spread elements in array literals.
//
// Pinned QuickJS lowering (vendor/quickjs.c):
//   - rest parameter:  `rest first` at function entry, then put_arg/put_loc.
//   - spread call:     callee [this] ; array_from n ; push_i32 n ;
//                      { append | define_array_el inc }* ; drop ;
//                      (perm3 | undefined swap) ; apply magic
//   - array literal:   array_from n ; push_i32 n ; { append | define_array_el inc | inc }* ;
//                      (dup1 put_field length | drop)
// This module only supplies data for the lead to splice into program.js,
// shader.js and bootstrap.js. Guest semantics run on the GPU only.
// Lead integration: no program.js import (import cycle through
// phase4-registry.js); WGSL receives { L } lazily.

// Opcodes to append to program.js OP, with stack effects copied from
// vendor/quickjs-opcode.h (DEF(name, size, n_pop, n_push, fmt)).
export const spreadOpcodes = Object.freeze([
  // DEF(rest, 3, 0, 1, u16): -- array. "only used at the start of a function".
  // Operand: u16 first argument index; creates Array(argv[min(first,argc)..argc)).
  'rest',
  // DEF(apply, 3, 3, 1, u16): f this array -> result (magic 0, call)
  //                           ctor newTarget array -> object (magic 1, construct)
  'apply',
  // DEF(append, 1, 3, 2, none): array pos enumobj -> array pos'
  // "append enumerated object, update length" (js_append_enumerate).
  'append',
]);
export const spreadOpcodeEffects = Object.freeze({
  rest: Object.freeze({ size: 3, pop: 0, push: 1, fmt: 'u16' }),
  apply: Object.freeze({ size: 3, pop: 3, push: 1, fmt: 'u16' }),
  append: Object.freeze({ size: 1, pop: 3, push: 2, fmt: 'none' }),
});

// Private builtin ids (reservation 1210-1239). 1210 is the WGSL -> guest helper
// trampoline used by `append`; it is never a guest-visible value.
export const spreadPrivateBuiltins = Object.freeze({ __lanesSpreadAppend: 1210 });
export const spreadBuiltinFields = Object.freeze({ 1210: 'spreadAppend' });

// Names the helper sources may reference that are owned by other Phase 4
// workers (see PHASE-4-STATUS.md). The lead resolves them via privateBuiltins.
export const spreadExternalPrivateBuiltins = Object.freeze({
  __lanesIteratorOpen: 1270, __lanesIteratorStep: 1271, __lanesIteratorClose: 1272, __lanesIterationKind: 1273,
});

// Operand packing for program.js packProgram. Call inside the instruction loop
// after the existing renames and before `if (!(op in OP))`:
//   const spread = spreadProgramLowering(op, instruction, fn.instructions[index - 1]);
//   if (spread) ({ op, a, b } = spread);
// Returns null for opcodes this module does not own. Throws SyntaxError for
// forms that must be rejected at compile time.
export function spreadProgramLowering(op, instruction, previous) {
  if (op === 'apply_eval') throw new SyntaxError('Unsupported spread call of direct eval (apply_eval)');
  if (op === 'rest') {
    const first = instruction.operand;
    if (!Number.isInteger(first) || first < 0 || first > 0xffff) throw new SyntaxError('Invalid QuickJS rest operand');
    // Arguments beyond LIMITS.args can never be passed (call() rejects them),
    // so any first index is safe: min(first, argc) is evaluated on the GPU.
    return { op: 'rest', a: first, b: 0 };
  }
  if (op === 'apply') {
    const magic = instruction.operand;
    // js_function_apply magic: 0 = call (f, this, array), 1 = construct
    // (ctor, new.target, array). Magic 2 (Reflect.apply) is never emitted by
    // OP_apply; anything other than 0/1 is rejected.
    if (magic !== 0 && magic !== 1) throw new SyntaxError(`Unsupported QuickJS apply magic: ${magic}`);
    // magic 1 is emitted for `new F(...a)` (always preceded by perm3) and for
    // `super(...a)` in derived constructors (FUNC_CALL_SUPER_CTOR, preceded by
    // the `drop` of the spread index, no perm3). Super spread belongs to worker 5
    // and is rejected here until it supports super/new.target; at runtime
    // construct() would also report status 6 because new.target != callee.
    if (magic === 1 && previous && previous.op !== 'perm3')
      throw new SyntaxError('Unsupported spread super constructor call (apply magic 1 without perm3)');
    return { op: 'apply', a: magic, b: 0 };
  }
  if (op === 'append') return { op: 'append', a: 0, b: 0 };
  return null;
}

// WGSL case bodies, written for shader.js `cases(name, body)`; `arg` is the
// packed operand (`a`), `l` the lane. They use only existing shader helpers.
export const spreadWGSLCases = ({ L }) => ({
  // QuickJS js_create_array(argc-first, argv+first): a fresh Array exotic
  // (kind 7, prototype node 2, extensible) whose elements are defined, not Set.
  rest: `let env=states[l].env;let count=states[l].heap[env].value.y;let start=min(arg,count);
        let id=alloc(l,7u,V(2u,0u,0u,1u),0u,0u);if(states[l].status!=0u){break;}
        let obj=V(id,0u,4u,0u);
        for(var i=start;i<count&&states[l].status==0u;i++){
          let binding=cell(l,env,i,false);if(states[l].status!=0u){break;}
          let ignored=putProperty(l,obj,0x80000000u|(i-start),states[l].heap[binding].value,true);
        }
        if(states[l].status==0u){push(l,obj);}`,
  // The argument array is internal (built by array_from/append/define_array_el
  // in this frame, never guest-visible) and dense, so its own data elements
  // are read directly. magic 0: [f this array] -> call(method) layout
  // [this f args]; magic 1: [ctor newTarget array] -> construct() layout.
  apply: `let list=pop(l);let secondValue=pop(l);let calleeValue=pop(l);if(states[l].status!=0u){break;}
        if(arg>1u||list.z!=4u||states[l].heap[list.x].kind!=7u){states[l].status=2u;break;}
        let count=states[l].heap[list.x].value.y;
        if(count>${L.args}u||states[l].sp+2u+count>${L.stack}u){states[l].status=3u;break;}
        if(arg==0u){push(l,secondValue);push(l,calleeValue);}else{push(l,calleeValue);push(l,secondValue);}
        let base=states[l].sp;
        for(var i=0u;i<count&&states[l].status==0u;i++){
          let value=getProperty(l,list,0x80000000u|i);
          if(value.z==12u){states[l].status=2u;}else{states[l].stack[base+i]=value;}
        }
        if(states[l].status!=0u){break;}
        states[l].sp=base+count;
        if(arg==0u){call(l,count,true,false);}else{construct(l,count);}`,
  // array pos enumobj -> array pos': keep the array, then call the private
  // guest helper spreadAppend(array, pos, enumobj). Its return value (the new
  // position) lands where the helper id was pushed, leaving `array pos'`.
  // Abrupt completions inside the helper unwind through raise() as usual.
  append: `let value=pop(l);let position=pop(l);let arrayValue=peek(l);if(states[l].status!=0u){break;}
        if(position.z!=0u||arrayValue.z!=4u||states[l].heap[arrayValue.x].kind!=7u){states[l].status=2u;break;}
        push(l,V(${spreadPrivateBuiltins.__lanesSpreadAppend}u,0u,11u,0u));push(l,arrayValue);push(l,position);push(l,value);
        call(l,3u,false,false);`,
});

// Snippet for shader.js call(): inside `if(fnValue.z==11u){ var field=0xffffffffu; ... }`
// (next to the `fnValue.x==960u` numberPow mapping). F is program.js FIELDS.
// A missing helper is an explicit Unsupported instead of reaching objectMethod.
export function spreadCallMappingWGSL(F) {
  return Object.entries(spreadBuiltinFields).map(([id, field]) => {
    if (!Number.isInteger(F[field])) throw new Error(`FIELDS is missing ${field}`);
    return `if(fnValue.x==${id}u){field=${F[field]}u;if(image[image[params.padding+1u].w+field].y==0u){states[l].status=6u;return;}}`;
  }).join('\n    ');
}

// Guest helpers (compiled by QuickJS, run on the GPU). Strict, flat (no nested
// functions: private builtin refs only resolve in the helper root function).
//
// spreadAppend follows js_append_enumerate's general (iterator) path; the
// QuickJS fast-array path is observably identical because it is only taken
// when the array has no accessors and len == count.
//  - GetIterator: __lanesIterationKind 4 (null/undefined) -> TypeError;
//    kind 0 (symbol-dependent: plain objects, array-likes, numbers, functions,
//    anything whose @@iterator could be guest-defined) -> __lanesUnsupported;
//    kinds 1 (Array/arguments) and 2 (string code points) are intrinsic.
//  - Each element: CreateDataPropertyOrThrow(array, pos++, value) through
//    __lanesDefine with a {value, writable, enumerable, configurable: true}
//    descriptor, so Array.prototype index setters are never triggered. The
//    target is the internal fresh array, so this never fails.
//  - length: defining index pos extends the Array length (as in QuickJS,
//    JS_DefinePropertyValueUint32 updates length; no separate Set).
//  - Abrupt completion of a step (getter throw) propagates. IteratorClose is
//    not needed: the exception comes from the iterator itself (spec does not
//    close), and intrinsic iterators have no `return` method.
export const spreadBootstrapSources = Object.freeze({
  // Generic GetIterator. A throw from next propagates without IteratorClose
  // (narrower than ArrayAccumulation). for-of still closes on break/throw.
  spreadAppend: `function spreadAppendBootstrap(array, position, iterable) {
  "use strict";
  const record = __lanesIteratorOpen(iterable);
  const desc = __lanesDescriptor();
  desc.writable = true;
  desc.enumerable = true;
  desc.configurable = true;
  let index = position;
  for (;;) {
    const value = __lanesIteratorStep(record);
    if (value === record) return index;
    desc.value = value;
    __lanesDefine(array, index, desc);
    index++;
  }
}`,
});

export const spreadNotes = `Integration (worker 2: rest / spread / apply / append)
1. program.js: append ${spreadOpcodes.map(n => `'${n}'`).join(', ')} to the OP name list (indices of existing ops unchanged).
   In packProgram's instruction loop, track the index and, before the "Unsupported QuickJS instruction" check, apply
   spreadProgramLowering(op, instruction, fn.instructions[index-1]). It returns {op,a,b} or null and throws SyntaxError for
   apply_eval, apply magic other than 0/1, and apply magic 1 not preceded by perm3 (super(...a), worker 5).
2. program.js fieldNames: append ...Object.keys(spreadBootstrapSources) (i.e. 'spreadAppend').
3. bootstrap.js: privateBuiltins gains ...spreadPrivateBuiltins (optional: only WGSL uses 1210) and must contain worker 4's
   __lanesIterationKind 1273 / __lanesIteratorOpen 1270 / __lanesIteratorStep 1271 before spreadAppend can pack;
   bootstrapSources gains ...spreadBootstrapSources.
4. shader.js main switch: \${cases('rest', spreadWGSLCases.rest)}, \${cases('apply', spreadWGSLCases.apply)},
   \${cases('append', spreadWGSLCases.append)}. No pre-dispatch key slot is needed for these ops.
5. shader.js call(): in the "if(fnValue.z==11u){ var field=0xffffffffu;" block add spreadCallMappingWGSL(F).
6. No new heap kinds, value tags or finish() continuations are used (44-45 stay reserved, unused).
Semantics: apply magic 0 calls with the given this (undefined for plain calls, the base object for o.m(...a) / o[k](...a));
magic 1 constructs with new.target == callee. More than LIMITS.args (16) spread arguments or stack overflow -> status 3.
The argument array is internal: built in the same frame by array_from/append/define_array_el and consumed by apply.
Gaps: spread of non-intrinsic iterables (plain objects, array-likes, Map/Set, numbers, generators) is status 6 until
Phase 3 Symbols and Phase 6 generic iterators; super(...a) is rejected (worker 5).`;
