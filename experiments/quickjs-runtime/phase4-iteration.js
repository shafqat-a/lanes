// Phase 4 worker 4: array destructuring, for-of and IteratorClose control flow.
// Phase 6 replaces open/step/close with the generic IteratorRecord. Kind 1273
// remains for the shader needle and is not an unsupported gate.
import { iteratorOpenBootstrapSource, iteratorStepBootstrapSource } from './phase6-protocols/w2-iterator-record/sources.js';
import { iteratorCloseSource } from './phase6-protocols/w3-iterator-close/index.js';
//
// Integration follows phase4-registry.js: this module never imports
// program.js/shader.js (import cycle); WGSL generators take { OP, F, L }.
// `iterationRegistryPatches` lists the registry edits and
// `iterationShaderPatches` the one remaining shader.js edit (raise()).
// check-phase4-iteration.mjs applies both to private copies and proves that
// every fixture packs and the shader source builds.
//
// Reservations (PHASE-4-STATUS.md, worker 4): private builtins 1270-1309
// (1270-1274 used), heap kinds 24-25 (unused: the record is an ordinary
// null-prototype object), finish() continuations 40-43 (40/41 used, 42/43
// reserved for Phase 6 close-on-throw).
//
// QuickJS lowering (vendor/quickjs.c, pinned revision), sync forms only:
//   for (lhs of e) body      e; for_of_start; goto L2; L1: <store value>; body;
//                            L2: for_of_next 0; if_false L1; drop; iterator_close
//   [p0, , p2 = d, ...r] = e js_parse_destructuring_element: e; for_of_start;
//                            per element: <lvalue refs>; for_of_next <depth>;
//                            drop (done); <default if undefined>; <store>;
//                            elision: for_of_next 0; drop; drop.
//                            rest: array_from 0; push_0; loop{for_of_next 2;
//                            if_true; define_array_el; inc}; drop; drop; store.
//                            then iterator_close.
//   break/continue out of a for-of: iterator_close (emit_break, has_iterator).
//   return inside a for-of: nip_catch; rot3r; undefined; iterator_close
//                            (emit_return), repeated per enclosing for-of.
//   throw: the exception handler meets the for-of catch offset 0 and calls
//          JS_IteratorClose(record, TRUE), then keeps unwinding.

// ---------------------------------------------------------------------------
// Private builtin identities (shared interface, PHASE-4-STATUS.md).
export const ITERATOR_OPEN = 1270;   // __lanesIteratorOpen(value) -> record | TypeError | Unsupported
export const ITERATOR_STEP = 1271;   // __lanesIteratorStep(record) -> value | record (done sentinel)
export const ITERATOR_CLOSE = 1272;  // __lanesIteratorClose(record) -> undefined (no-op for intrinsics)
export const ITERATION_KIND = 1273;  // __lanesIterationKind(value) -> 0 | 1 | 2 | 4 (WGSL primitive)
// Never guest-resolvable: the `next` slot that for_of_start pushes. QuickJS
// stores the iterator's next method there; no admitted opcode reads it
// (iterator_next / iterator_call are rejected). If it were ever called it
// reaches objectMethod's `id>=150` fallback: Unsupported (status 6).
export const ITERATOR_NEXT_PLACEHOLDER = 1274;
// finish() continuation codes (Frame.tail).
export const CONTINUATION_STEP = 40;  // helper 1271 result r -> push `value done`
export const CONTINUATION_OPEN = 41;  // helper 1270 result -> stack[receiver.x]
// Iterator catch marker: QuickJS pushes JS_NewCatchOffset(0) for for_of_start.
// Here it is tag 9 with y=1 (ordinary catch offsets are V(target,0,9,0)).
export const ITERATOR_MARKER_WGSL = 'V(0u,1u,9u,0u)';

export const iterationPrivateBuiltins = Object.freeze({
  __lanesIteratorOpen: ITERATOR_OPEN,
  __lanesIteratorStep: ITERATOR_STEP,
  __lanesIteratorClose: ITERATOR_CLOSE,
  __lanesIterationKind: ITERATION_KIND,
});

// Bootstrap-backed ids -> FIELDS name (call() field dispatch). 1273 is WGSL.
export const iterationBuiltinFields = Object.freeze({
  [ITERATOR_OPEN]: 'iteratorOpen',
  [ITERATOR_STEP]: 'iteratorStep',
  [ITERATOR_CLOSE]: 'iteratorClose',
});
// FIELDS names (all new); program.js appends Object.keys(phase4BootstrapSources).
export const iterationFieldNames = Object.freeze(Object.values(iterationBuiltinFields));

// ---------------------------------------------------------------------------
// Opcodes appended to OP. Stack effects as executed here (QuickJS's table
// lists for_of_start 1/3, for_of_next 3/5, iterator_close 3/0).
export const iterationOpcodes = Object.freeze([
  Object.freeze({ name: 'for_of_start', format: 'none', stack: 'value -> record next marker', effect: +2,
    note: 'record from helper 1270 (continuation 41); next = V(1274,0,11,0); marker = V(0,1,9,0)' }),
  Object.freeze({ name: 'for_of_next', format: 'u8', stack: 'record next marker [offset values] -> ... value done', effect: +2,
    note: 'record at sp-3-offset; an undefined record gives undefined,true without a call; else helper 1271 + continuation 40' }),
  Object.freeze({ name: 'iterator_close', format: 'none', stack: 'record next marker ->', effect: -3,
    note: 'marker slot not validated (the return path passes undefined); a live record calls helper 1272, result omitted (continuation 2)' }),
]);
export const iterationOpcodeNames = Object.freeze(iterationOpcodes.map(o => o.name));

// Iterator-protocol opcodes that stay rejected. Sync functions never emit them
// (generators, async functions, yield* and for-await, all Phase 6); the
// explicit message just makes the reason visible if a form ever leaks.
export const iterationRejectedOpcodes = Object.freeze(['for_await_of_start', 'for_await_of_next', 'iterator_check_object',
  'iterator_get_value_done', 'iterator_next', 'iterator_call', 'initial_yield', 'yield', 'yield_star', 'async_yield_star', 'await']);

// Operand packing for phase4Lowering: {op, a, b}. The bridge exports the u8 of
// for_of_next as `instruction.operand` (=== bytes[1]); a = that offset.
export function lowerIteration(op, instruction) {
  if (iterationRejectedOpcodes.includes(op)) throw new SyntaxError(`Unsupported QuickJS instruction: ${op} (generic iterator protocol, Phase 6)`);
  if (op === 'for_of_start' || op === 'iterator_close') return { op, a: 0, b: 0 };
  if (op === 'for_of_next') {
    const offset = instruction.operand;
    if (!Number.isInteger(offset) || offset < 0 || offset > 255 || (instruction.bytes && instruction.bytes[1] !== offset)) throw new SyntaxError('Invalid for_of_next offset');
    return { op, a: offset, b: 0 };
  }
  return null;
}
export const iterationLoweredOps = Object.freeze([...iterationOpcodeNames, ...iterationRejectedOpcodes]);
export const iterationProgramLowering = Object.freeze({
  for_of_start: 'none -> a=0, b=0',
  for_of_next: 'u8 offset (bridge operand) -> a; b=0; record = stack[sp-3-a]',
  iterator_close: 'none -> a=0, b=0',
  rejected: iterationRejectedOpcodes,
  lower: lowerIteration,
  // Emitted by adjacent forms owned elsewhere: append (array spread) and
  // rest (rest parameters) are worker 2; template to_string is worker 1.
  otherOwners: Object.freeze({ append: 'worker 2', rest: 'worker 2', apply: 'worker 2', to_string: 'worker 1' }),
});

// ---------------------------------------------------------------------------
// Guest helpers (strict, compiled as intrinsic roots). Open and step are the
// phase-6 generic IteratorRecord (kind 3). Kind 1/2 step bodies remain for a
// record already opened that way. Close calls `return` on a kind-3 record.
// 1273 stays a WGSL primitive and is no longer the open/spread gate.
export const iterationBootstrapSources = Object.freeze({
  iteratorOpen: iteratorOpenBootstrapSource,
  iteratorStep: iteratorStepBootstrapSource,
  iteratorClose: iteratorCloseSource,
});

// ---------------------------------------------------------------------------
// WGSL module-scope functions (phase4WGSLFunctions).
export const iterationWGSLFunctions = ({ L }) => `
// __lanesIterationKind (${ITERATION_KIND}): 0 = not provably intrinsic (caller
// reports Unsupported), 1 = %ArrayIteratorPrototype% over an Array exotic
// object or an arguments object (own @@iterator = %Array.prototype.values%),
// 2 = %StringIteratorPrototype% over a string or String wrapper, 4 = null or
// undefined (GetIterator throws TypeError). An array/wrapper qualifies only if
// the first of Array.prototype (node 2) / String.prototype (node 20) on its
// prototype chain (itself included) matches its kind; otherwise @@iterator
// resolves elsewhere and the result is 0.
// PHASE 3 HOOK (single choke point): once symbol keys exist, return 0 unless
// Array.prototype[@@iterator] / String.prototype[@@iterator] and the
// %ArrayIteratorPrototype% / %StringIteratorPrototype% next methods are the
// unmodified intrinsics and no object on the chain up to that prototype has
// an own @@iterator.
fn iterationKind(l:u32,value:V)->u32 {
  if(value.z==17u||value.z==18u){return 0u;}
  if(value.z==2u||value.z==3u){return 4u;}
  if(value.z==7u){if(phase3ChainHasIterator(l,20u)){return 0u;}return 2u;}
  if(value.z!=4u){return 0u;}
  // An own or inherited @@iterator (well-known cell 34) is not invoked. Kind 0
  // makes the guest opener report Unsupported instead of the intrinsic fast path.
  if(phase3ChainHasIterator(l,value.x)){return 0u;}
  let kind=states[l].heap[value.x].kind;
  if(kind==14u){return 1u;}
  let text=kind==16u&&wrapped(l,value.x).z==7u;
  if(kind!=7u&&!text){return 0u;}
  var current=value.x;
  for(var i=0u;i<${L.heap}u&&current!=0u;i++){
    if(current==2u){return select(0u,1u,kind==7u);}
    if(current==20u){return select(0u,2u,text);}
    current=states[l].heap[current].value.x;
  }
  return 0u;
}
// for_of_next completion: the step helper returns the record itself as the
// done sentinel. Done also replaces the record slot by undefined (QuickJS
// js_for_of_next), so later for_of_next / iterator_close skip the iterator.
fn iterationStepResult(l:u32,index:u32,result:V) {
  let record=states[l].stack[index];
  if(result.z==4u&&record.z==4u&&result.x==record.x){
    states[l].stack[index]=undef();push(l,undef());push(l,boolean(true));
  }else{push(l,result);push(l,boolean(false));}
}
`;

// objectMethod() line (phase4ObjectMethods): the native kind primitive.
export const iterationObjectMethodWGSL = `if(id==${ITERATION_KIND}u){return num(fromUnsigned(iterationKind(l,original)));}`;

// finish() continuations (phase4Continuations); `returned`/`constructed` in scope.
export const iterationContinuations = () => [
  { code: CONTINUATION_STEP, body: 'iterationStepResult(l,constructed.x,returned);' },
  { code: CONTINUATION_OPEN, body: 'states[l].stack[constructed.x]=returned;' },
];

// opName -> WGSL case body for shader.js `cases(name, body)` (phase4WGSLCases).
export const iterationWGSLCases = ({ L }) => ({
  for_of_start: `let value=pop(l);if(states[l].status!=0u){break;}
        if(states[l].sp+5u>${L.stack}u){states[l].status=3u;break;}
        let slot=states[l].sp;
        push(l,undef());push(l,V(${ITERATOR_NEXT_PLACEHOLDER}u,0u,11u,0u));push(l,${ITERATOR_MARKER_WGSL});
        push(l,V(${ITERATOR_OPEN}u,0u,11u,0u));push(l,value);
        let depth=states[l].depth;call(l,1u,false,false);
        if(states[l].status==0u){
          if(states[l].depth>depth){states[l].frames[states[l].depth].tail=${CONTINUATION_OPEN}u;states[l].frames[states[l].depth].receiver=V(slot,0u,0u,0u);}
          else{states[l].stack[slot]=pop(l);}
        }`,
  for_of_next: `if(states[l].sp<states[l].frames[states[l].depth].base+3u+arg){states[l].status=2u;break;}
        let index=states[l].sp-3u-arg;let record=states[l].stack[index];
        if(record.z==3u){push(l,undef());push(l,boolean(true));break;}
        if(record.z!=4u){states[l].status=2u;break;}
        if(states[l].sp+2u>${L.stack}u){states[l].status=3u;break;}
        push(l,V(${ITERATOR_STEP}u,0u,11u,0u));push(l,record);
        let depth=states[l].depth;call(l,1u,false,false);
        if(states[l].status==0u){
          if(states[l].depth>depth){states[l].frames[states[l].depth].tail=${CONTINUATION_STEP}u;states[l].frames[states[l].depth].receiver=V(index,0u,0u,0u);}
          else{let result=pop(l);iterationStepResult(l,index,result);}
        }`,
  iterator_close: `if(asyncIterationClose(l)){break;}
        if(states[l].sp<states[l].frames[states[l].depth].base+3u){states[l].status=2u;break;}
        states[l].sp-=3u;let record=states[l].stack[states[l].sp];
        if(record.z==4u){
          push(l,V(${ITERATOR_CLOSE}u,0u,11u,0u));push(l,record);
          let depth=states[l].depth;call(l,1u,false,false);
          if(states[l].status==0u){if(states[l].depth>depth){states[l].frames[states[l].depth].tail=2u;}else{let ignored=pop(l);}}
        }`,
});

// ---------------------------------------------------------------------------
// Lead integration: phase4-registry.js edits. Each anchor occurs exactly once
// in the registry as of this writing; the check applies them to a copy.
export const iterationRegistryPatches = Object.freeze([
  { what: 'import', anchor: "import { lowerObjectSpread,",
    insertBefore: "import { iterationOpcodeNames, iterationLoweredOps, lowerIteration, iterationBootstrapSources, iterationPrivateBuiltins, iterationBuiltinFields, iterationWGSLFunctions, iterationObjectMethodWGSL, iterationWGSLCases, iterationContinuations } from './phase4-iteration.js';\n" },
  { what: 'opcodes', anchor: "...objectSpreadOps]);", replacement: "...objectSpreadOps, ...iterationOpcodeNames]);" },
  { what: 'bootstrap sources', anchor: "Object.freeze({ ...objectSpreadBootstrapSources });", replacement: "Object.freeze({ ...objectSpreadBootstrapSources, ...iterationBootstrapSources });" },
  { what: 'private builtins', anchor: "Object.freeze({ ...objectSpreadPrivateBuiltins });", replacement: "Object.freeze({ ...objectSpreadPrivateBuiltins, ...iterationPrivateBuiltins });" },
  { what: 'builtin fields', anchor: "Object.freeze({ ...objectSpreadBuiltinFields });", replacement: "Object.freeze({ ...objectSpreadBuiltinFields, ...iterationBuiltinFields });" },
  { what: 'lowering', anchor: "  return null;\n}", replacement: "  if (iterationLoweredOps.includes(op)) return lowerIteration(op, instruction);\n  return null;\n}" },
  { what: 'WGSL functions', anchor: "export const phase4WGSLFunctions = () => '';", replacement: "export const phase4WGSLFunctions = context => iterationWGSLFunctions(context);" },
  { what: 'objectMethod lines', anchor: "[objectSpreadObjectMethodWGSL]", replacement: "[objectSpreadObjectMethodWGSL, iterationObjectMethodWGSL]" },
  { what: 'WGSL cases', anchor: "    ...Object.fromEntries(objectSpreadOps.map(name => [name, objectSpread[name]])),",
    replacement: "    ...Object.fromEntries(objectSpreadOps.map(name => [name, objectSpread[name]])),\n    ...iterationWGSLCases(context)," },
  { what: 'continuations', anchor: "export const phase4Continuations = () => [];", replacement: "export const phase4Continuations = context => [...iterationContinuations(context)];" },
].map(Object.freeze));

// shader.js: the only edit outside the registry hooks.
export const iterationShaderPatches = Object.freeze([
  Object.freeze({ file: 'shader.js', where: 'raise(): skip iterator markers (QuickJS for-of catch offset 0)',
    anchor: "found=value.z==9u;destination=value.x;",
    replacement: "found=value.z==9u&&value.y==0u;destination=value.x;",
    // PHASE 6 HOOK (close-on-throw): when value.z==9u&&value.y==1u the record
    // is stack[sp-2]; QuickJS calls IteratorClose(record, throw completion)
    // there unless the record is undefined, discards its result/exception and
    // keeps unwinding. That needs a resumable unwind: push a frame for helper
    // 1272 with reserved continuation 42 ("re-raise the saved error from this
    // depth"); 43 spare. A throw out of the step helper must also leave the
    // slot undefined (js_for_of_next), e.g. by clearing stack[receiver.x] when
    // raise() unwinds a frame whose tail is 40.
    note: 'nip_catch needs NO change and must keep stopping at ANY tag-9 value: QuickJS OP_nip_catch stops at the first JS_TAG_CATCH_OFFSET including the for-of offset 0, and emit_return relies on that (nip_catch; rot3r; undefined; iterator_close).' }),
]);

// ---------------------------------------------------------------------------
export const iterationNotes = Object.freeze([
  'Interface (consumers workers 2/3/6), unchanged from PHASE-4-STATUS.md: open(1270)(value) -> record | TypeError (null/undefined) | Unsupported (status 6); step(1271)(record) -> value, or the record itself when done (compare with ===; the record is never a guest value); close(1272)(record) -> undefined; kind(1273)(value) -> 0/1/2/4. Loop shape: `const r = __lanesIteratorOpen(v); for (;;) { const x = __lanesIteratorStep(r); if (x === r) break; ... }`, calling __lanesIteratorClose(r) on early normal exit.',
  'Step is sticky: after done or an abrupt step the record stays exhausted and further steps return the record without any Get.',
  'Array-like steps observe Get(length) (ToLength via __lanesNumber: valueOf and getters on arguments.length run) then Get(index) on every step; growth/shrinkage during iteration is observed; holes read through the prototype chain.',
  'Kind 1 is restricted to heap kind 7 (Array) whose chain reaches Array.prototype before String.prototype, and heap kind 14 (arguments, own @@iterator). Plain objects inheriting Array.prototype are spec-iterable but reported Unsupported (conservative). Kind 2: primitive strings, and kind-16 String wrappers whose chain reaches String.prototype first.',
  'Numbers, booleans, functions, plain objects and arrays whose chain lacks Array.prototype report Unsupported (status 6). Several are TypeError per spec today, but become symbol-dependent once Phase 3 adds Symbol.',
  'IteratorClose is observably a no-op (intrinsic iterators have no return method). Normal-completion closes (break, return, destructuring end) still call helper 1272 for live records; throw-completion close is the Phase 6 hook in raise().',
  'Heap kinds 24-25 are unused; continuations 42-43 reserved for Phase 6 close-on-throw.',
  'for_of_start/for_of_next/iterator_close push 2 transient call slots above the iterator slots; each checks LIMITS.stack and reports status 3.',
  'Each step is a guest call (one frame); destructuring k elements costs k step calls plus one close call.',
]);
