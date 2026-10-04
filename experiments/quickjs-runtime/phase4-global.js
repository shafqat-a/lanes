import {SCRIPT_LEXICAL_SPEC,SCRIPT_GLOBAL_DECL_SPEC,scriptRef} from './script-entry.js';
import {fieldListWGSL} from './field-list-wgsl.js';
// Phase 4 next wave, assignment 6: sloppy global `this`, `globalThis`, free
// (global) identifier references and the global object model.
// Host code only packs; every guest operation below runs in WGSL on the GPU.
// Never a host-global fallback: the global object is fixed heap node 65.
//
// Program format reminder: a Lanes program is ONE named synchronous function
// declaration (program.js entrySource). Script top-level code, global var /
// let / const / class declarations and top-level `this` therefore cannot be
// written; they stay compiler-rejected by entrySource. The entry function
// itself is the only global declaration (CreateGlobalFunctionBinding).
//
// ---------------------------------------------------------------- model ----
// Two packing modes, decided per program by globalProgramPlan():
//
//  * classic mode (unchanged packing, bit-identical): free identifiers are
//    limited to the literal intrinsic table of program.js (Math, JSON, Number,
//    Object, Array, Function, String, Boolean, the seven Error constructors,
//    parseInt, parseFloat, NaN, Infinity, undefined) plus the entry's own name.
//    They are captured as per-closure cells (capture specs 3/4/5/6). Such a
//    program can never obtain the global object: it has no sloppy push_this
//    and no other free names, so the cells are trivially consistent.
//
//  * global-object mode (image[0].w bit 17, GLOBAL_MODE_BIT): entered when a
//    user function (not a bootstrap helper) is sloppy and binds `this`
//    (push_this), references a free name outside the intrinsic table
//    (globalThis, undeclared names, typeof undeclared, implicit globals), or
//    deletes an unqualified name (delete_var). Then EVERY global reference of
//    every user function, intrinsic names included, is a property operation
//    on the global object, so there is a single store and no inconsistency:
//      get_var x        -> get_global  a=text(x) b=0  (GetValue; ReferenceError if unresolvable)
//      get_var_undef x  -> get_global  a=text(x) b=1  (typeof: undefined if unresolvable)
//      put_var x        -> put_global  a=text(x)      (PutValue: sloppy creates; strict ReferenceError)
//      delete_var x     -> delete_global a=text(x)    (sloppy `delete x`)
//    Global refs get capture spec 7 (no cell; closure() skips them).
//
// Global object (node 65, kind 2 ordinary object, [[Prototype]] =
// %Object.prototype% (node 1), extensible). Initialized in main() only in
// global-object mode (classic programs allocate nothing new). Own properties
// in ES2025 clause 19 order, with the SAME value encodings the classic
// capture specs produce (identity: globalThis.Math === Math etc.):
//   globalThis                 {[[Value]]: node 65, W:true,  E:false, C:true }
//   Infinity, NaN, undefined   {W:false, E:false, C:false}
//   parseFloat 1781, parseInt 1780, Array 200, Boolean 137, Error 600,
//   EvalError 606, Function 500, Number 122, Object 100, RangeError 603,
//   ReferenceError 602, String 136, SyntaxError 604, TypeError 601,
//   URIError 605, JSON node 25, Math node 23   {W:true, E:false, C:true}
// then the entry function binding (CreateGlobalFunctionBinding:
// {W:true, E:true, C:false}; replaces a same-named configurable intrinsic in
// place). Implicit globals are created by [[Set]] as {W, E, C: true}.
//
// Fail-closed boundaries (status 6 / compiler rejection):
//   - ES2025 globals that the runtime does not implement (Symbol, Map,
//     Promise, Reflect, eval, isNaN, ...; globalUnimplementedNames):
//     identifier references are compiler-rejected ("Unsupported global or
//     module reference: X", the existing message); dynamic access on the
//     global object (globalThis[k], getOwnPropertyDescriptor, hasOwnProperty,
//     delete, defineProperty, creation by assignment) reaches prototypeGap /
//     ownGap for node 65 -> status 6. `k in globalThis` answers true.
//   - Object.getOwnPropertyNames / Reflect-like full key lists of the global
//     object (and object spread / Object.assign sources) -> status 6, because
//     the unimplemented globals are missing. Object.keys(globalThis) and
//     for-in are exact: every intrinsic global is non-enumerable.
//   - QuickJS make_var_ref / get_ref_value / put_ref_value / put_var_init are
//     not admitted (compiler rejection: Unsupported QuickJS instruction).
//   - Entry functions named NaN, Infinity or undefined: CanDeclareGlobalFunction
//     is false (script-level TypeError before f runs), which the
//     single-function format cannot express: compiler rejection.
// Known shared engine deviation (documented, not detectable at runtime):
//   strict `x = rhs` where x is unresolvable when the reference is evaluated
//   but rhs creates it. ES2025 6.2.5.6 PutValue throws ReferenceError; QuickJS
//   (and V8) check resolvability at the store. QuickJS bytecode has no op at
//   reference-evaluation time, so the GPU follows QuickJS. See
//   globalKnownDeviationCases in phase4-global-cases.js.
//
// Phase 3 hooks (symbols are absent):
//   - Symbol / BigInt globals: when Phase 3 lands, add {name, value} rows to
//     globalBindings (identity = the Phase 3 constructor value), delete the
//     names from globalUnimplementedNames, and add the literal mapping in
//     program.js for classic mode.
//   - globalThis[Symbol.toStringTag] does not exist in ES2025 (host-defined);
//     Object.prototype.toString.call(globalThis) is "[object Object]" here.
//   - Symbol-keyed own properties of the global object must be listed after
//     string keys by ownKeys (still status 6 for the full list here).
//
// Reservations: heap kind 36, builtin ids 2110..2139 and continuations 66..67
// are reserved but UNUSED: the global object is an ordinary kind-2 node, its
// properties are ordinary kind-3/9 nodes, getters/setters reuse the existing
// get_field / put_field call protocol (setter continuation 2). Fixed node 65.
import { GLOBAL_OBJECT_NODE } from './phase4-fixed-nodes.js';
// Standard-library wave globals (Map, Set, isNaN, isFinite): data only.
import { stdlibGlobals } from './stdlib-registry.js';

export { GLOBAL_OBJECT_NODE };
export const GLOBAL_MODE_BIT = 0x20000; // image[0].w bit 17 (bits 0-15 refs, 16 hasPrototype)
export const GLOBAL_REF_SPEC = 7; // capture spec: global-object binding, no cell
export const GLOBAL_RESERVATIONS = Object.freeze({
  builtinIds: [2110, 2139], heapKinds: [36], continuations: [66, 67], fixedNodes: [GLOBAL_OBJECT_NODE],
  used: { builtinIds: [], heapKinds: [], continuations: [], fixedNodes: [GLOBAL_OBJECT_NODE] },
});

// IEEE-754 words as program.js numberWords (duplicated: no program.js import cycle).
const numberWords = n => { const a = new Uint32Array(2); new DataView(a.buffer).setFloat64(0, n, true); return [a[0], a[1]]; };
const WRITABLE = 1, ENUMERABLE = 2, CONFIGURABLE = 4;

// Global object own properties, in ES2025 clause 19 order. `value` is the
// exact runtime value the classic capture specs produce for the same name
// (spec 4 builtin id -> V(id,0,11,0); spec 6 node -> V(node,0,4,0); spec 5
// literal). check-phase4-global.mjs verifies this against program.js.
export const globalBindings = Object.freeze([
  { name: 'globalThis', value: { node: GLOBAL_OBJECT_NODE }, flags: WRITABLE | CONFIGURABLE },
  { name: 'Infinity', value: { number: Infinity }, flags: 0 },
  { name: 'NaN', value: { number: NaN }, flags: 0 },
  { name: 'undefined', value: { undefined: true }, flags: 0 },
  { name: 'parseFloat', value: { builtin: 1781 }, flags: WRITABLE | CONFIGURABLE },
  { name: 'parseInt', value: { builtin: 1780 }, flags: WRITABLE | CONFIGURABLE },
  { name: 'Array', value: { builtin: 200 }, flags: WRITABLE | CONFIGURABLE },
  { name: 'Boolean', value: { builtin: 137 }, flags: WRITABLE | CONFIGURABLE },
  { name: 'Error', value: { builtin: 600 }, flags: WRITABLE | CONFIGURABLE },
  { name: 'EvalError', value: { builtin: 606 }, flags: WRITABLE | CONFIGURABLE },
  { name: 'Function', value: { builtin: 500 }, flags: WRITABLE | CONFIGURABLE },
  { name: 'Number', value: { builtin: 122 }, flags: WRITABLE | CONFIGURABLE },
  { name: 'Object', value: { builtin: 100 }, flags: WRITABLE | CONFIGURABLE },
  { name: 'RangeError', value: { builtin: 603 }, flags: WRITABLE | CONFIGURABLE },
  { name: 'ReferenceError', value: { builtin: 602 }, flags: WRITABLE | CONFIGURABLE },
  { name: 'String', value: { builtin: 136 }, flags: WRITABLE | CONFIGURABLE },
  { name: 'SyntaxError', value: { builtin: 604 }, flags: WRITABLE | CONFIGURABLE },
  { name: 'TypeError', value: { builtin: 601 }, flags: WRITABLE | CONFIGURABLE },
  { name: 'URIError', value: { builtin: 605 }, flags: WRITABLE | CONFIGURABLE },
  { name: 'JSON', value: { node: 25 }, flags: WRITABLE | CONFIGURABLE },
  { name: 'Math', value: { node: 23 }, flags: WRITABLE | CONFIGURABLE },
  { name: 'Symbol', value: { builtin: 1000 }, flags: WRITABLE | CONFIGURABLE },
  { name: 'BigInt', value: { builtin: 1150 }, flags: WRITABLE | CONFIGURABLE },
  { name: 'Reflect', value: { node: 47 }, flags: WRITABLE | CONFIGURABLE },
  { name: 'AggregateError', value: { builtin: 2940 }, flags: WRITABLE | CONFIGURABLE },
  { name: 'Promise', value: { builtin: 2800 }, flags: WRITABLE | CONFIGURABLE },
  ...stdlibGlobals.map(g => ({ name: g.name, value: { builtin: g.builtin }, flags: WRITABLE | CONFIGURABLE })),
]);

// Names program.js maps literally in classic mode (must equal its root ref
// table; the check scans program.js). globalThis is NOT one of them.
export const globalClassicIntrinsicNames = Object.freeze(globalBindings.map(b => b.name).filter(n => n !== 'globalThis'));

// ES2025 clause 19 (+ Annex B.2.1) global properties the runtime does not
// implement. Never a ReferenceError / undefined: compile rejection or status 6.
export const globalUnimplementedNames = Object.freeze([
  'eval', 'isFinite', 'isNaN', 'decodeURI', 'decodeURIComponent', 'encodeURI', 'encodeURIComponent',
  'ArrayBuffer', 'BigInt64Array', 'BigUint64Array', 'DataView', 'Date',
  'FinalizationRegistry', 'Float16Array', 'Float32Array', 'Float64Array', 'Int8Array', 'Int16Array', 'Int32Array',
  'Iterator', 'Map', 'Proxy', 'RegExp', 'Set', 'SharedArrayBuffer', 'Uint8Array',
  'Uint8ClampedArray', 'Uint16Array', 'Uint32Array', 'WeakMap', 'WeakRef', 'WeakSet', 'Atomics',
  'escape', 'unescape',
].filter(name => !stdlibGlobals.some(g => g.name === name)));

// FIELDS names this module needs (program.js appends the missing ones; append-only).
// Preserve field indices allocated before phase3 bindings were promoted.
export const globalFieldNames = Object.freeze(["globalThis", "Infinity", "NaN", "undefined", "parseFloat", "parseInt", "Array", "Boolean", "Error", "EvalError", "Function", "Number", "Object", "RangeError", "ReferenceError", "String", "SyntaxError", "TypeError", "URIError", "JSON", "Math", "eval", "isFinite", "isNaN", "decodeURI", "decodeURIComponent", "encodeURI", "encodeURIComponent", "AggregateError", "ArrayBuffer", "BigInt", "BigInt64Array", "BigUint64Array", "DataView", "Date", "FinalizationRegistry", "Float16Array", "Float32Array", "Float64Array", "Int8Array", "Int16Array", "Int32Array", "Iterator", "Map", "Promise", "Proxy", "RegExp", "Set", "SharedArrayBuffer", "Symbol", "Uint8Array", "Uint8ClampedArray", "Uint16Array", "Uint32Array", "WeakMap", "WeakRef", "WeakSet", "Atomics", "Reflect", "escape", "unescape"]);

// Entry names for which CanDeclareGlobalFunction is false.
const NON_DECLARABLE = new Set(['NaN', 'Infinity', 'undefined']);

export const globalOpcodes = Object.freeze([
  Object.freeze({ name: 'get_global', pop: 0, push: 1, note: 'a = key text; b = 0 GetValue (ReferenceError when unresolvable), 1 typeof (undefined)' }),
  Object.freeze({ name: 'put_global', pop: 1, push: 0, note: 'a = key text; sloppy: Set(global) (creates); strict: ReferenceError when unresolvable, TypeError on failed Set' }),
  Object.freeze({ name: 'delete_global', pop: 0, push: 1, note: 'a = key text; sloppy delete of an unqualified name: global [[Delete]]' }),
]);
export const globalOpcodeNames = Object.freeze(globalOpcodes.map(o => o.name));

const userFunctionCount = raw => {
  const offsets = Object.values(raw.bootstrapFunctions ?? {}).filter(Number.isInteger);
  return Math.min(raw.functions.length, ...offsets);
};

// Decide the packing mode. Throws SyntaxError for declared rejections.
export function globalProgramPlan(raw, entryName) {
  const functions = raw.functions ?? [];
  const script=raw.entryKind==='script';
  const userCount = userFunctionCount(raw);
  if (NON_DECLARABLE.has(entryName)) throw new SyntaxError(`Unsupported global function declaration: ${entryName} (CanDeclareGlobalFunction is false)`);
  const reasons = new Set(script?['script-entry']:[]);
  const intrinsic = new Set(globalClassicIntrinsicNames), unimplemented = new Set(globalUnimplementedNames);
  for (let f = 0; f < userCount; f++) {
    const fn = functions[f];
    // Trusted standalone helper roots use private capture specifications, not
    // the user global-object environment. Appended helpers are outside userCount.
    if(fn.intrinsicRoot===true)continue;
    if (!fn.strict && fn.instructions.some(i => i.op === 'push_this')) reasons.add('sloppy-this');
    if (fn.instructions.some(i => i.op === 'delete_var')) reasons.add('delete-global');
    if (fn.instructions.some(i => i.op === 'make_var_ref')) reasons.add('global-reference');
    for (const ref of fn.refs) {
      if (script && ref.type===4 && ref.lexical && NON_DECLARABLE.has(ref.name))throw new SyntaxError(`Restricted global lexical declaration: ${ref.name}`);
      if (script && scriptRef(ref) && (ref.lexical || functions[0].refs.some(r=>r.type===4&&r.name===ref.name)))continue;
      if (ref.type !== 3 && !(script&&ref.type===5)) continue;
      // Private bootstrap hooks are never guest global bindings. Mode selection
      // must reject these before globalRefSpec bypasses the classic admission path.
      if(ref.name.startsWith('__lanes'))throw new SyntaxError(`Unsupported global or module reference: ${ref.name}`);
      if (unimplemented.has(ref.name)) throw new SyntaxError(`Unsupported global or module reference: ${ref.name}`);
      if (f === 0 && ref.name !== entryName && !intrinsic.has(ref.name)) reasons.add('global-reference');
    }
  }
  return Object.freeze({ mode: reasons.size > 0, script, reasons: Object.freeze([...reasons].sort()), userCount, functions, entryName });
}

// program.js capture-spec hook (refs loop). Must not call text(): the ref
// table is contiguous in the image.
export function globalRefSpec(plan, f, ref, scriptKeys) {
  if(plan.script && f<plan.userCount && scriptRef(ref)){
    if(ref.lexical)return f===0?[SCRIPT_LEXICAL_SPEC,0,0,0]:[2,ref.index,0,0];
    if(f===0&&ref.type===4){
      if(globalUnimplementedNames.includes(ref.name))throw new SyntaxError(`Unsupported global declaration: ${ref.name}`);
      return [SCRIPT_GLOBAL_DECL_SPEC,scriptKeys.get(ref.name),ref.varKind===10?1:0,0];
    }
    return [GLOBAL_REF_SPEC,0,0,0];
  }
  if (!plan.mode || f >= plan.userCount || ref.type !== 3) return null;
  return [GLOBAL_REF_SPEC, 0, 0, 0];
}

// program.js instruction hook. Returns {op, a, b} or null.
export function globalProgramLowering(plan, f, op, instruction, { text }) {
  if (!['get_var', 'get_var_undef', 'put_var', 'put_var_init', 'delete_var'].includes(op)) return null;
  if (op === 'put_var_init') throw new SyntaxError('Unsupported global lexical declaration');
  if (!plan.mode || f >= plan.userCount) {
    if (op === 'delete_var') throw new SyntaxError('Unsupported QuickJS instruction: delete_var');
    return null;
  }
  if (op === 'delete_var') {
    if (typeof instruction.operand !== 'string') throw new SyntaxError('Invalid QuickJS global reference');
    return { op: 'delete_global', a: text(instruction.operand), b: 0 };
  }
  const ref = plan.functions[f].refs[instruction.operand];
  if (!ref || ref.type !== 3) throw new SyntaxError('Invalid QuickJS global reference');
  if (op === 'put_var') return { op: 'put_global', a: text(ref.name), b: 0 };
  return { op: 'get_global', a: text(ref.name), b: op === 'get_var_undef' ? 1 : 0 };
}

// ------------------------------------------------------------------ WGSL ----
const wgslValue = (value, node) => {
  if ('node' in value) return `V(${value.node}u,0u,4u,0u)`;
  if ('builtin' in value) return `V(${value.builtin}u,0u,11u,0u)`;
  if ('undefined' in value) return 'undef()';
  const [lo, hi] = numberWords(value.number);
  return `V(${lo}u,${hi}u,0u,0u)`;
};

export const globalWGSLFunctions = ({ F, L }) => {
  for (const name of globalFieldNames) if (!(name in F)) throw new Error(`FIELDS lacks global name ${name} (apply the program.js FIELDS patch)`);
  return `
// Phase 4 global object (phase4-global.js): fixed node ${GLOBAL_OBJECT_NODE}, kind 2, [[Prototype]]
// %Object.prototype%. Present only in global-object mode (image[0].w bit 17).
const GLOBAL_OBJECT: u32 = ${GLOBAL_OBJECT_NODE}u;
fn globalMode()->bool {return (image[0].w&${GLOBAL_MODE_BIT}u)!=0u;}
// ES2025 clause 19 bindings with the classic capture-spec identities.
fn globalInit(l:u32) {
  states[l].heap[GLOBAL_OBJECT]=Node(V(1u,0u,0u,1u),0u,0u,2u,0u);
  ${globalBindings.map(b => `dataProperty(l,GLOBAL_OBJECT,fieldKey(${F[b.name]}u),${wgslValue(b.value)},${b.flags}u);`).join('\n  ')}
}
// CreateGlobalFunctionBinding(entry name, closure, false): {W,E,!C}; an existing
// (configurable) intrinsic of the same name is redefined in place.
fn globalEntryBinding(l:u32,fnValue:V) {
  let key=image[1u].w;let property=findProperty(l,GLOBAL_OBJECT,key);
  if(property==0u){dataProperty(l,GLOBAL_OBJECT,key,fnValue,3u);return;}
  states[l].heap[property].kind=3u;states[l].heap[property].value=fnValue;states[l].heap[property].marked=6u;
}
// Unimplemented ES2025 globals: absent own properties are unsupported, not misses.
fn globalGap(l:u32,key:u32)->bool {
  if((key&0x80000000u)!=0u){return false;}
  ${fieldListWGSL(globalUnimplementedNames.map(name=>F[name]))}
}
// HasProperty(global, key) (object environment record HasBinding).
fn globalHas(l:u32,key:u32)->bool {
  var current=GLOBAL_OBJECT;
  for(var i=0u;i<${L.heap}u&&current!=0u;i++){
    if(findProperty(l,current,key)!=0u||(lengthKey(l,key)&&states[l].heap[current].kind==7u)||stringOwn(l,current,key)!=0u||prototypeGap(l,current,key)){return true;}
    current=states[l].heap[current].value.x;
  }
  return false;
}
`;
};

// Case bodies (shader.js cases(name, body); \`ins\`, \`arg\`, \`l\` as in main()).
export const globalWGSLCases = ({ L }) => ({
  // GetValue of a global identifier reference (b=1: typeof operand).
  get_global: `if(!globalMode()){states[l].status=2u;break;}
        let globalObject=V(GLOBAL_OBJECT,0u,4u,0u);
        if(!globalHas(l,arg)){if(states[l].status==0u){if(ins.z!=0u){push(l,undef());}else{states[l].status=5u;}}break;}
        let value=getProperty(l,globalObject,arg);if(states[l].status!=0u){break;}
        if(value.z==12u){push(l,globalObject);push(l,callbackValue(value.x));call(l,0u,true,false);}else{push(l,value);}`,
  // PutValue: strict code throws ReferenceError for an unresolvable name;
  // [[Set]] on the global object otherwise (setter continuation 2 drops its result).
  put_global: `if(!globalMode()){states[l].status=2u;break;}
        let value=pop(l);let globalObject=V(GLOBAL_OBJECT,0u,4u,0u);
        if(image[ins.w*2u+1u].y!=0u&&!globalHas(l,arg)){if(states[l].status==0u){states[l].status=5u;}break;}
        if(states[l].status!=0u){break;}
        let pending=putProperty(l,globalObject,arg,value,false);
        if(pending.z==12u){push(l,globalObject);push(l,callbackValue(pending.x));push(l,value);let depth=states[l].depth;call(l,1u,true,false);
          if(states[l].status==0u){if(states[l].depth>depth){states[l].frames[states[l].depth].tail=2u;}else{let ignored=pop(l);}}}`,
  // Sloppy \`delete x\`: global [[Delete]] (non-configurable -> false, absent -> true).
  delete_global: `if(!globalMode()){states[l].status=2u;break;}
        if(ownGap(l,GLOBAL_OBJECT,arg)){break;}
        let property=findProperty(l,GLOBAL_OBJECT,arg);var removed=true;
        if(property!=0u){
          if((states[l].heap[property].marked&8u)==0u){removed=false;}
          else{var previous=GLOBAL_OBJECT;
            for(var i=0u;i<${L.heap}u&&states[l].heap[previous].next!=property;i++){previous=states[l].heap[previous].next;}
            states[l].heap[previous].next=states[l].heap[property].next;states[l].heap[property].next=0u;}
        }
        push(l,boolean(removed));`,
});

// --------------------------------------------- exact edits to lead files ----
// `find` must occur exactly once in the current file text (shader.js is the
// template-literal source, so interpolations appear as \${...}).
// check-phase4-global.mjs applies them to private copies and reports drift.
export const globalRegistryPatches = Object.freeze([
  { id: 'registry-import', file: 'phase4-registry.js', why: 'wire the global module',
    find: `import { lowerObjectSpread, objectSpreadWGSLCases, objectSpreadBootstrapSources, objectSpreadBuiltinFields, objectSpreadPrivateBuiltins, objectSpreadObjectMethodWGSL } from './phase4-object-spread.js';\n`,
    replace: `import { lowerObjectSpread, objectSpreadWGSLCases, objectSpreadBootstrapSources, objectSpreadBuiltinFields, objectSpreadPrivateBuiltins, objectSpreadObjectMethodWGSL } from './phase4-object-spread.js';\nimport { globalOpcodeNames, globalWGSLFunctions, globalWGSLCases } from './phase4-global.js';\n` },
  { id: 'registry-opcodes', file: 'phase4-registry.js', why: 'append get_global/put_global/delete_global last (existing indices unchanged)',
    find: `]);\n\nif (new Set(phase4Opcodes).size !== phase4Opcodes.length)`,
    replace: `, ...globalOpcodeNames]);\n\nif (new Set(phase4Opcodes).size !== phase4Opcodes.length)` },
  { id: 'registry-wgsl-functions', file: 'phase4-registry.js', why: 'GLOBAL_OBJECT, globalMode, globalInit, globalEntryBinding, globalGap, globalHas',
    find: `export const phase4WGSLFunctions = context => `,
    replace: `export const phase4WGSLFunctions = context => globalWGSLFunctions(context) + ` },
  { id: 'registry-wgsl-cases', file: 'phase4-registry.js', why: 'get_global / put_global / delete_global cases',
    find: `    ...classElementWGSLCases(context),\n`,
    replace: `    ...classElementWGSLCases(context),\n    ...globalWGSLCases(context),\n` },
]);

export const globalProgramPatches = Object.freeze([
  { id: 'program-import', file: 'program.js', why: 'global plan / capture-spec / lowering hooks',
    find: `import { templateConstant, templateProgramLowering } from './phase4-templates.js';\n`,
    replace: `import { templateConstant, templateProgramLowering } from './phase4-templates.js';\nimport { GLOBAL_MODE_BIT, globalFieldNames, globalProgramPlan, globalRefSpec, globalProgramLowering } from './phase4-global.js';\n` },
  { id: 'program-fields', file: 'program.js', fields: true, why: 'FIELDS: globalThis and the unimplemented ES2025 global names (append-only)',
    find: `for(const name of Object.keys(phase4BootstrapSources))if(!fieldNames.includes(name))fieldNames.push(name);\n`,
    replace: `for(const name of Object.keys(phase4BootstrapSources))if(!fieldNames.includes(name))fieldNames.push(name);\nfor(const name of globalFieldNames)if(!fieldNames.includes(name))fieldNames.push(name);\n` },
  { id: 'program-plan', file: 'program.js', why: 'decide classic vs global-object mode (may throw the declared SyntaxErrors)',
    find: `  const functions = raw.functions, image = functions.flatMap(() => [[0, 0, 0, 0], [0, 0, 0, 0]]), code = [], strings = new Map();\n`,
    replace: `  const functions = raw.functions, image = functions.flatMap(() => [[0, 0, 0, 0], [0, 0, 0, 0]]), code = [], strings = new Map();\n  // Global-object mode (phase4-global.js): sloppy this, free global names, delete x.\n  const globalPlan = globalProgramPlan(raw, name);\n` },
  { id: 'program-ref-spec', file: 'program.js', why: 'global-object mode: every global ref is capture spec 7 (no cell)',
    find: `    for (const ref of fn.refs) {\n`,
    replace: `    for (const ref of fn.refs) {\n      const globalSpec = globalRefSpec(globalPlan, f, ref);\n      if (globalSpec) { add(globalSpec); continue; }\n` },
  { id: 'program-mode-bit', file: 'program.js', why: 'image[0].w bit 17 marks global-object mode for the GPU',
    find: `    image[f * 2] = [entry[f], fn.args, fn.locals, fn.refs.length | (fn.hasPrototype << 16)];\n`,
    replace: `    image[f * 2] = [entry[f], fn.args, fn.locals, fn.refs.length | (fn.hasPrototype << 16) | (f === 0 && globalPlan.mode ? GLOBAL_MODE_BIT : 0)];\n` },
  { id: 'program-lowering', file: 'program.js', why: 'get_var/get_var_undef/put_var/delete_var -> get_global/put_global/delete_global (before the get_var_ref renames)',
    find: `      if (templateLowered) ({ op, a, b } = templateLowered);\n`,
    replace: `      if (templateLowered) ({ op, a, b } = templateLowered);\n      const globalLowered = globalProgramLowering(globalPlan, f, op, instruction, { text });\n      if (globalLowered) ({ op, a, b } = globalLowered);\n` },
]);

export const globalShaderPatches = Object.freeze([
  { id: 'closure-skip-global-ref', file: 'shader.js', why: 'capture spec 7 has no cell: global-object mode reads the global object by name',
    find: `    let spec=image[refs+i]; var captured=0u;\n`,
    replace: `    let spec=image[refs+i]; var captured=0u;\n    // Global-object mode binding (phase4-global.js): no capture cell.\n    if(spec.x==${GLOBAL_REF_SPEC}u){continue;}\n` },
  { id: 'prototype-gap-global', file: 'shader.js', why: 'unimplemented ES2025 globals are gaps of node 65 (get -> 6, in -> true, own queries -> 6)',
    find: `fn prototypeGap(l:u32,id:u32,key:u32)->bool {\n`,
    replace: `fn prototypeGap(l:u32,id:u32,key:u32)->bool {\n  if(id==GLOBAL_OBJECT){return globalGap(l,key);}\n` },
  { id: 'own-keys-global', file: 'shader.js', why: 'full own-key lists of the global object lack the unimplemented globals: status 6 (enumerable-only lists are exact)',
    find: `  if(object.z==4u&&object.x>=20u&&object.x<=24u){states[l].status=6u;return undef();}\n`,
    replace: `  if(object.z==4u&&object.x>=20u&&object.x<=24u){states[l].status=6u;return undef();}\n  if(object.z==4u&&object.x==GLOBAL_OBJECT&&!enumerableOnly){states[l].status=6u;return undef();}\n` },
  { id: 'put-property-global-gap', file: 'shader.js', why: 'creating an own property named like an unimplemented global would expose wrong attributes: status 6',
    find: `  var property=findProperty(l,obj.x,key);\n  if(property==0u && states[l].heap[obj.x].value.w==0u)`,
    replace: `  var property=findProperty(l,obj.x,key);\n  if(property==0u&&obj.x==GLOBAL_OBJECT&&ownGap(l,obj.x,key)){return undef();}\n  if(property==0u && states[l].heap[obj.x].value.w==0u)` },
  { id: 'push-this-global', file: 'shader.js', why: 'sloppy this with an undefined/null receiver is the global object (10.2.1.2 step 6.a)',
    find: `          // undefined/null would need globalThis, which is unsupported.\n          if(wrapperPrototype(value)!=0u){let boxed=wrap(l,value);states[l].frames[states[l].depth].receiver=boxed;push(l,boxed);}\n          else{states[l].status=6u;}\n`,
    replace: `          // undefined/null: the global object in global-object mode (phase4-global.js).\n          if(wrapperPrototype(value)!=0u){let boxed=wrap(l,value);states[l].frames[states[l].depth].receiver=boxed;push(l,boxed);}\n          else if((value.z==2u||value.z==3u)&&globalMode()){push(l,V(GLOBAL_OBJECT,0u,4u,0u));}\n          else{states[l].status=6u;}\n` },
  { id: 'init-global-object', file: 'shader.js', why: 'fixed node 65 initialized (global-object mode only) before the entry closure; entry binding right after it',
    find: `    let fnValue=closure(l,0u); let env=environment(l,fnValue.x,1u);\n`,
    replace: `    // Fixed node ${GLOBAL_OBJECT_NODE}: global object (phase4-global.js), global-object mode only.\n    if(globalMode()){globalInit(l);}\n    let fnValue=closure(l,0u); let env=environment(l,fnValue.x,1u);\n    if(globalMode()){globalEntryBinding(l,fnValue);}\n` },
]);

export const globalFixedNodePatches = Object.freeze([
  { id: 'fixed-node-root', file: 'phase4-fixed-nodes.js', why: 'node 65 is a GC root (its property chain hangs from next)',
    find: `export const PHASE4_FIXED_ROOTS = Object.freeze([TEMPLATE_REGISTRY_NODE]);`,
    replace: `export const PHASE4_FIXED_ROOTS = Object.freeze([TEMPLATE_REGISTRY_NODE, GLOBAL_OBJECT_NODE]);` },
]);

export const globalPatches = Object.freeze([...globalRegistryPatches, ...globalProgramPatches, ...globalShaderPatches, ...globalFixedNodePatches]);
