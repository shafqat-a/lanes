// Phase 4 worker 1 (next wave): tagged templates, template objects and
// String.raw (ES2025 13.2.8.4 GetTemplateObject, 13.3.11 tagged templates,
// 22.1.2.4 String.raw). Host code only packs; guest semantics run in WGSL.
//
// Compiler side (no vendor/quickjs.c change). Pinned QuickJS js_parse_template
// (call=1) already builds one template object per tagged template site at
// parse time: a cpool constant array of cooked strings (undefined for invalid
// escapes, 13.2.8.3) whose own "raw" property (writable/enumerable/configurable
// false) is an array of raw strings (CR/CRLF normalized); both arrays are
// sealed with a non-writable length and non-writable elements. Every
// evaluation of the site executes `push_const8 <index>`, so the cpool entry IS
// the Parse Node identity: closures of the same bytecode share it, and two
// sites (even with identical text) get distinct entries. The call is emitted
// after the tag reference (get_var / get_field2 / get_array_el2 / super
// reference), the template object and the substitutions (left to right, no
// ToString): `call argc` or `call_method argc` (member tags pass the base as
// this). bridge.c exported the constant as {"unsupported":true}; the
// phase4-patches/w1-tagged-template-bridge.diff patch exports
// {"template":{"cooked":[string|null...],"raw":[string...]}} and adds the
// bridge feature "tagged-template-v1".
//
// Packing (program.js patches below): each template constant becomes an image
// descriptor  D: [count, TEMPLATE_MAGIC, 0, 0]
//             D+1+i: [cooked text index | 0xffffffff (undefined), raw text index, 0, 0]
// and `push_const* <template>` becomes `push_template a=D`. D is unique per
// cpool constant, i.e. per site, and serves as the [[TemplateMap]] key.
// Template strings use the existing image text (256 UTF-16 unit limit,
// RangeError at pack time); more than LIMITS.args (16) template strings would
// exceed the call argument limit and are a pack-time RangeError.
//
// Runtime (WGSL, all state in the states buffer, resumable):
//   fixed heap node 64 (TEMPLATE_REGISTRY, kind 32; layout owned by
//   phase4-fixed-nodes.js) is the realm [[TemplateMap]] head. Nodes 26..79 are
//   excluded from the free list in main() init (before any dynamic
//   allocation) and never swept; init writes node 64 in place
//   (`states[l].heap[TEMPLATE_REGISTRY]=Node(V(0u),0u,0u,32u,0u);`), it is
//   never allocated, so no "first allocation after jsonObject" assumption
//   exists. collect() marks it through PHASE4_FIXED_ROOTS (`mark(l,64u);`).
//   Its `next` chain holds kind-32 entries: key = site D, value.x = cooked
//   array node. collect() marks value.x of every kind-32 node (the chain
//   itself is marked through `next`).
//   push_template looks the site up; on a miss it creates
//     raw    = kind 7 array, value (Array.prototype=2, count, z bit0 = length
//              non-writable, w=0 non-extensible), elements enumerable-only
//              (marked 4: non-writable, non-configurable)
//     cooked = same shape, plus own "raw" data property with flags 0
//   (= SetIntegrityLevel frozen for both, 13.2.8.4 steps 10-13), records the
//   entry and pushes the cooked array. One instruction allocates at most
//   2*16+3 nodes (< the 192-node collection headroom of the main loop).
//
// String.raw: builtin id 2000 (String.raw property of the String constructor,
// name "raw", length 1), mapped through phase4BuiltinFields to the strict guest
// helper `raw` (22.1.2.4 with ToObject / LengthOfArrayLike / ToString executed
// by the GPU VM, including getters and user toString). FIELDS gains "raw"
// (appended; also the key text of the template object's raw property).
//
// Reservations used: builtin id 2000 (2001-2019 unused), heap kind 32, fixed
// node 64. No continuations (56-57 unused), no new private builtins.

import { TEMPLATE_REGISTRY_NODE, PHASE4_FIXED_FIRST, PHASE4_FIXED_LAST, PHASE4_FIXED_ROOTS } from './phase4-fixed-nodes.js';

if (!(TEMPLATE_REGISTRY_NODE >= PHASE4_FIXED_FIRST && TEMPLATE_REGISTRY_NODE <= PHASE4_FIXED_LAST) || !PHASE4_FIXED_ROOTS.includes(TEMPLATE_REGISTRY_NODE))
  throw new Error('phase4-fixed-nodes.js: the template registry must be a rooted phase-4 fixed node (64..79)');

export { TEMPLATE_REGISTRY_NODE };
export const TAGGED_TEMPLATE_FEATURE = 'tagged-template-v1';
export const TEMPLATE_MAGIC = 0x6c706d74; // "tmpl"
export const TEMPLATE_KIND = 32;
export const STRING_RAW_ID = 2000;
const UNDEFINED_COOKED = 0xffffffff;

export const templateOpcodes = Object.freeze([
  Object.freeze({ name: 'push_template', pop: 0, push: 1, note: 'a = image descriptor D (site key); pushes the cached frozen template object, creating it on first evaluation' }),
]);
export const templateOpcodeNames = Object.freeze(templateOpcodes.map(item => item.name));

const rebuild = () => new Error(`Rebuild the compiler bridge: ${TAGGED_TEMPLATE_FEATURE} template objects are missing`);

// program.js constants hook. Returns { template: D } for a template constant,
// null for other constants. A stale bridge (no tagged-template-v1 feature)
// exports template objects as {"unsupported":true}: fail with a rebuild error
// rather than the generic constant rejection.
export function templateConstant(c, raw, { text, add, limit }) {
  const hasFeature = Array.isArray(raw.features) && raw.features.includes(TAGGED_TEMPLATE_FEATURE);
  if (c && c.unsupported === true && !hasFeature) throw rebuild();
  if (!c || !('template' in c)) return null;
  if (!hasFeature) throw rebuild();
  const { cooked, raw: rawStrings } = c.template ?? {};
  if (!Array.isArray(cooked) || !Array.isArray(rawStrings) || cooked.length === 0 || cooked.length !== rawStrings.length
    || !rawStrings.every(s => typeof s === 'string') || !cooked.every(s => s === null || typeof s === 'string'))
    throw new SyntaxError('Invalid QuickJS template object constant');
  if (cooked.length > limit) throw new RangeError(`GPU tagged template limit: at most ${limit} template strings (${limit - 1} substitutions)`);
  // Texts first: text() appends to the image, the descriptor must be contiguous.
  const cookedIndices = cooked.map(s => s === null ? UNDEFINED_COOKED : text(s));
  const rawIndices = rawStrings.map(s => text(s));
  const offset = add([cooked.length, TEMPLATE_MAGIC, 0, 0]);
  cooked.forEach((_, i) => add([cookedIndices[i], rawIndices[i], 0, 0]));
  return { template: offset };
}

// program.js instruction hook (runs right after the class hook, before the
// existing renames). Only template constants are lowered.
export function templateProgramLowering(op, instruction, { constants }) {
  if (op !== 'push_const' && op !== 'push_const8') return null;
  const constant = constants[instruction.operand];
  if (!constant || !('template' in constant)) return null;
  return { op: 'push_template', a: constant.template, b: 0 };
}

// 22.1.2.4 String.raw ( template, ...substitutions ). Strict guest helper;
// the GPU VM executes ToObject, Get (getters), ToLength and ToString (user
// toString/valueOf). String results above 256 UTF-16 units are status 3.
export const stringRawSource = `function rawBootstrap(template) {
  "use strict";
  const cooked = __lanesToObject(template);
  const literals = __lanesToObject(cooked.raw);
  let length = __lanesNumber(literals.length);
  if (!(length > 0)) length = 0;
  else if (length > 9007199254740991) length = 9007199254740991;
  else length = length - length % 1;
  if (length === 0) return "";
  const substitutions = arguments.length - 1;
  let result = "";
  for (let index = 0; ; index++) {
    result += __lanesToText(literals[index]);
    if (index + 1 === length) return result;
    if (index < substitutions) result += __lanesToText(arguments[index + 1]);
  }
}`;

// FIELDS name -> guest helper source. "raw" doubles as the property key text.
export const templateBootstrapSources = Object.freeze({ raw: stringRawSource });
// Builtin id -> FIELDS name of the guest helper (shader.js call() routing).
export const templateBuiltinFields = Object.freeze({ [STRING_RAW_ID]: 'raw' });
export const templatePrivateBuiltins = Object.freeze({});
export const templateContinuations = () => [];

export const templateWGSLFunctions = ({ F, L }) => `
// Phase 4 tagged templates. Node ${TEMPLATE_REGISTRY_NODE} heads the realm [[TemplateMap]]:
// kind-${TEMPLATE_KIND} entries (key = site descriptor, value.x = template object).
const TEMPLATE_REGISTRY: u32 = ${TEMPLATE_REGISTRY_NODE}u;
fn templateLookup(l:u32,site:u32)->u32 {
  var entry=states[l].heap[TEMPLATE_REGISTRY].next;
  for(var i=0u;i<${L.heap}u&&entry!=0u;i++){
    if(states[l].heap[entry].kind==${TEMPLATE_KIND}u&&states[l].heap[entry].key==site){return states[l].heap[entry].value.x;}
    entry=states[l].heap[entry].next;
  }
  return 0u;
}
// GetTemplateObject steps 4-15 for a cache miss: frozen cooked and raw arrays.
fn templateCreate(l:u32,site:u32)->V {
  let header=image[site];
  if(header.y!=${TEMPLATE_MAGIC}u||header.x==0u||header.x>${L.args}u){states[l].status=2u;return undef();}
  let count=header.x;
  let rawArray=alloc(l,7u,V(2u,count,1u,0u),0u,0u);
  let cooked=alloc(l,7u,V(2u,count,1u,0u),0u,0u);
  if(states[l].status!=0u){return undef();}
  for(var i=0u;i<count&&states[l].status==0u;i++){
    let item=image[site+1u+i];
    var value=undef();if(item.x!=0xffffffffu){value=image[item.x];}
    dataProperty(l,cooked,0x80000000u|i,value,2u);
    dataProperty(l,rawArray,0x80000000u|i,image[item.y],2u);
  }
  if(states[l].status!=0u){return undef();}
  dataProperty(l,cooked,fieldKey(${F.raw}u),V(rawArray,0u,4u,0u),0u);
  let entry=alloc(l,${TEMPLATE_KIND}u,V(cooked,0u,0u,0u),site,states[l].heap[TEMPLATE_REGISTRY].next);
  if(states[l].status!=0u){return undef();}
  states[l].heap[TEMPLATE_REGISTRY].next=entry;
  return V(cooked,0u,4u,0u);
}
`;

export const templateWGSLCases = () => ({
  push_template: `let cached=templateLookup(l,arg);
        if(cached!=0u){push(l,V(cached,0u,4u,0u));}
        else{let created=templateCreate(l,arg);if(states[l].status==0u){push(l,created);}}`,
});

// Exact edits to lead-owned files. `find` must occur exactly once in the
// current file text (shader.js text is the template-literal source, so
// interpolations appear as \${...}); check-phase4-templates.mjs verifies it.
export const templateRegistryPatches = Object.freeze([
  { id: 'registry-import', file: 'phase4-registry.js', why: 'wire the template module',
    find: `import { classOpcodeNames, classWGSLCases, classWGSLFunctions } from './phase4-classes.js';\n`,
    replace: `import { classOpcodeNames, classWGSLCases, classWGSLFunctions } from './phase4-classes.js';\nimport { templateOpcodeNames, templateBootstrapSources, templateBuiltinFields, templateWGSLFunctions, templateWGSLCases } from './phase4-templates.js';\n` },
  // Anchors sit on the line ends / following comments so that other workers
  // appending to the same lists do not invalidate them; additions stay last.
  { id: 'registry-opcodes', file: 'phase4-registry.js', why: 'append push_template last (existing indices unchanged)',
    find: `]);\n\nif (new Set(phase4Opcodes).size !== phase4Opcodes.length)`,
    replace: `, ...templateOpcodeNames]);\n\nif (new Set(phase4Opcodes).size !== phase4Opcodes.length)` },
  { id: 'registry-bootstrap', file: 'phase4-registry.js', why: 'String.raw guest helper; appends FIELDS "raw" last',
    find: ` });\n\n// Private builtin names available to bootstrap helpers`,
    replace: `, ...templateBootstrapSources });\n\n// Private builtin names available to bootstrap helpers` },
  { id: 'registry-builtin-fields', file: 'phase4-registry.js', why: 'builtin 2000 (String.raw) -> helper field raw',
    find: ` });\n\n// Operand packing for admitted Phase 4 opcodes.`,
    replace: `, ...templateBuiltinFields });\n\n// Operand packing for admitted Phase 4 opcodes.` },
  { id: 'registry-wgsl-functions', file: 'phase4-registry.js', why: 'templateLookup / templateCreate / TEMPLATE_REGISTRY (WGSL module scope is order independent)',
    find: `export const phase4WGSLFunctions = context => `,
    replace: `export const phase4WGSLFunctions = context => templateWGSLFunctions(context) + ` },
  { id: 'registry-wgsl-cases', file: 'phase4-registry.js', why: 'push_template case',
    find: `  return {\n`,
    replace: `  return {\n    ...templateWGSLCases(context),\n` },
]);

export const templateProgramPatches = Object.freeze([
  { id: 'program-import', file: 'program.js', why: 'template constant and opcode hooks',
    find: `import { classProgramLowering, classRejectNode } from './phase4-classes.js';\n`,
    replace: `import { classProgramLowering, classRejectNode } from './phase4-classes.js';\nimport { templateConstant, templateProgramLowering } from './phase4-templates.js';\n` },
  { id: 'program-admit-tagged', file: 'program.js', why: 'tagged templates are no longer rejected by the AST walk',
    find: `    // Untagged substitutions use the patched to_string lowering (bridge feature\n    // template-to-string). Tagged templates need cached frozen template objects.\n    if(node.type==='TaggedTemplateExpression')throw new SyntaxError('Unsupported tagged template: template objects are not implemented');\n`,
    replace: `    // Untagged substitutions use the patched to_string lowering (bridge feature\n    // template-to-string). Tagged templates use per-site frozen template objects\n    // (bridge feature ${TAGGED_TEMPLATE_FEATURE}, opcode push_template; phase4-templates.js).\n` },
  { id: 'program-template-constant', file: 'program.js', why: 'pack template object constants as image descriptors; stale bridges fail with a rebuild error',
    find: `      if ('string' in c) return { literal: text(c.string) };\n`,
    replace: `      if ('string' in c) return { literal: text(c.string) };\n      const template = templateConstant(c, raw, { text, add, limit: LIMITS.args });\n      if (template) return template;\n` },
  { id: 'program-push-template', file: 'program.js', why: 'push_const* of a template constant -> push_template D',
    find: `      if (classLowered) ({ op, a, b } = classLowered);\n`,
    replace: `      if (classLowered) ({ op, a, b } = classLowered);\n      const templateLowered = templateProgramLowering(op, instruction, { constants });\n      if (templateLowered) ({ op, a, b } = templateLowered);\n` },
]);

export const templateShaderPatches = Object.freeze([
  // Fixed node layout (free-list exclusion of 26..79, sweep exclusion, the
  // PHASE4_FIXED_ROOTS root marks) is lead-owned shader.js / phase4-fixed-nodes.js
  // code; this patch only initializes node 64 in place (never alloc()).
  { id: 'init-template-registry', file: 'shader.js',
    why: 'fixed node 64 = [[TemplateMap]] head, written in place after the 1..25 init allocations; rooted by PHASE4_FIXED_ROOTS',
    find: `    if(jsonObject!=\${FIXED_INIT_LAST}u){states[l].status=2u;}\n`,
    replace: `    if(jsonObject!=\${FIXED_INIT_LAST}u){states[l].status=2u;}\n    // Fixed node \${TEMPLATE_REGISTRY_NODE}: tagged template registry (phase4-templates.js), kind ${TEMPLATE_KIND}; written in place, never allocated.\n    states[l].heap[TEMPLATE_REGISTRY]=Node(V(0u),0u,0u,${TEMPLATE_KIND}u,0u);\n` },
  { id: 'collect-template-entry', file: 'shader.js', why: 'GC: kind-32 registry entries reference the cooked template array (value.x)',
    find: `    if(node.kind==16u){mark(l,node.value.y);}\n`,
    replace: `    if(node.kind==16u){mark(l,node.value.y);}\n    if(node.kind==${TEMPLATE_KIND}u){mark(l,node.value.x);}\n` },
  { id: 'string-raw-metadata', file: 'shader.js', why: 'String.raw.name "raw" and length 1 (builtin 2000 has no backing object; other own-property queries stay status 6)',
    find: `  if(obj.z==11u&&(obj.x==122u||obj.x==136u||obj.x==137u)){\n`,
    replace: `  if(obj.z==11u&&obj.x==${STRING_RAW_ID}u){\n    if(field(l,key,\${F.name}u)){return image[fieldKey(\${F.raw}u)];}\n    if(lengthKey(l,key)){return num(fromUnsigned(1u));}\n    states[l].status=6u;return undef();\n  }\n  if(obj.z==11u&&(obj.x==122u||obj.x==136u||obj.x==137u)){\n` },
  { id: 'string-raw-property', file: 'shader.js', why: 'String.raw resolves to builtin 2000',
    find: `if(field(l,key,\${F.prototype}u)){var prototype=21u;if(obj.x==136u){prototype=20u;}if(obj.x==137u){prototype=22u;}return V(prototype,0u,4u,0u);}\n`,
    replace: `if(field(l,key,\${F.prototype}u)){var prototype=21u;if(obj.x==136u){prototype=20u;}if(obj.x==137u){prototype=22u;}return V(prototype,0u,4u,0u);}\n    if(obj.x==136u&&field(l,key,\${F.raw}u)){return V(${STRING_RAW_ID}u,0u,11u,0u);}\n` },
  { id: 'string-raw-own-length', file: 'shader.js', why: 'Function.prototype.bind on String.raw: __lanesHasOwnLength',
    find: `    if(original.z==11u&&original.x>=800u&&original.x<=807u){return boolean(true);}\n`,
    replace: `    if(original.z==11u&&original.x>=800u&&original.x<=807u){return boolean(true);}\n    if(original.z==11u&&original.x==${STRING_RAW_ID}u){return boolean(true);}\n` },
]);

export const templatePatches = Object.freeze([...templateRegistryPatches, ...templateProgramPatches, ...templateShaderPatches]);

// Native patch for bridge.c (lead-owned). Apply from experiments/quickjs-runtime
// with `patch -p0 -i phase4-patches/w1-tagged-template-bridge.diff`
// (or `git apply -p0 ...`). vendor/quickjs.c is unchanged.
export const templateNativePatches = Object.freeze([
  { id: 'bridge-template-constant', file: 'bridge.c', diff: 'phase4-patches/w1-tagged-template-bridge.diff',
    why: 'export template object constants and advertise features ["template-to-string","tagged-template-v1"]' },
]);

export const templateNotes = Object.freeze({
  reservations: { builtinIds: [STRING_RAW_ID], heapKinds: [TEMPLATE_KIND], fixedNodes: [TEMPLATE_REGISTRY_NODE], continuations: [], fields: ['raw'] },
  integration: [
    'Apply templateRegistryPatches (6), templateProgramPatches (4), templateShaderPatches (5) and phase4-patches/w1-tagged-template-bridge.diff, then rebuild the native compiler and the Wasm (bridge output changed).',
    'Node 64 comes from phase4-fixed-nodes.js: main() excludes 26..79 from the free list before any dynamic allocation, the sweep never frees 26..79, collect() marks PHASE4_FIXED_ROOTS (must include 64), and init writes node 64 in place (no alloc).',
    'Suites asserting "Unsupported tagged template" must be updated: check-boxing.mjs, check-phase4-native.mjs, check-string-extract.mjs, browser-boxing.js, browser-string-extract.js (boxingCompilerRejectedSources, stringExtractCompilerRejectedSources), template-cases.js templateRejectedCases (now admitted; expected values unchanged), phase4-regression-cases.js unsupported-tagged-template / unsupported-string-raw (now admitted; normative values become expectations).',
  ],
  gaps: [
    'Reflective queries of String.raw as an own property of String (getOwnPropertyDescriptor, in, hasOwnProperty, keys, assignment) are runtime status 6 (the String constructor has no backing object).',
    'A sloppy tag function reading `this` needs globalThis: status 6 (existing boundary).',
    'More than 16 template strings (15 substitutions) per tagged template: pack-time RangeError (call argument limit). Template strings above 256 UTF-16 units: pack-time RangeError.',
    'eval as a tag and any Symbol use stay compiler-rejected as unsupported global references (Phase 3 owns Symbol).',
    'The [[TemplateMap]] is per GPU run (one realm per run); template objects are not shared across separately packed programs.',
    'Tagged templates in optional chains (a?.b`x`, a?.`x`, a?.()`x`) and NotEscapeSequence in untagged templates are early SyntaxErrors (V8, native QuickJS and packProgram agree).',
    'Template sites in dynamic code (Function constructor, eval) are outside the GPU compiler: Function is runtime status 6, eval compiler-rejected; cross-realm [[TemplateMap]] does not exist (single realm).',
  ],
});
