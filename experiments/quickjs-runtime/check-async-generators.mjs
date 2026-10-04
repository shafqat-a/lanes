// Host-only evidence for worker 6 (async generators). Never touches the GPU and
// never writes into the live tree: the integration preview is applied to
// temporary module copies.
//  1. Native oracle (node:vm, host job draining) for every fixture/input.
//  2. Native/Wasm normalized raw bytecode parity for fixtures and helpers.
//  3. Kind-3 opcode coverage.
//  4. WGSL static lint of this worker's fragments.
//  5. Anchor uniqueness against generatorIntegrationPatch(live,{iteratorPrototypeNode:77}).
//  6. Temp-copy preview: patched modules import, OP/FIELDS stable, WGSL call
//     graph acyclic, every called WGSL identifier defined, all fixtures pack
//     identically from native and Wasm compilers, kind-3 info bits packed.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { asyncGeneratorCases } from './async-generator-cases.js';
import {
  asyncGeneratorIntegrationEdits, applyIntegrationEdits, asyncGeneratorSources, asyncGeneratorFields,
  asyncGeneratorWGSLFunctions, asyncGeneratorGCWGSL, asyncGeneratorObjectMethodWGSL, asyncGeneratorCallWGSL,
  asyncGeneratorClosureWGSL, asyncGeneratorInitWGSL, asyncGeneratorPropertyWGSL, asyncGeneratorPrivateBuiltins,
  asyncGeneratorDependencies, asyncGeneratorBuiltinFields, ASYNC_GENERATOR_IDS, ASYNC_GENERATOR_INFO_BITS,
} from './async-generator-source.js';
import { generatorIntegrationPatch } from './generator-integration-patch.js';
import { OP as liveOP, FIELDS as liveFields } from './program.js';
import createModule from './generated/compiler.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const binary = join(root, 'generated/compiler');
const module = await createModule();
const native = s => JSON.parse(execFileSync(binary, [s], { encoding: 'utf8', maxBuffer: 1 << 26 }));
const wasm = s => JSON.parse(module.ccall('lanes_compile', 'string', ['string'], [s]));
const normalize = r => ({ ...r, functions: r.functions.map(f => ({ ...f, instructions: f.instructions.map(i => typeof i.operand === 'string' ? { ...i, bytes: i.bytes.map((b, n) => n >= 1 && n <= 4 ? 0 : b) } : i) })) });
const report = {};

// ---- 0. fixture hygiene
assert.ok(asyncGeneratorCases.length >= 40, 'at least 40 fixtures');
assert.equal(new Set(asyncGeneratorCases.map(c => c.feature)).size, asyncGeneratorCases.length, 'unique feature names');
assert.ok(asyncGeneratorCases.filter(c => c.resumption).length >= 3, 'three one-instruction resumption fixtures');
assert.ok(asyncGeneratorCases.filter(c => c.gc).length >= 5, 'GC fixtures');
for (const c of asyncGeneratorCases) {
  assert.match(c.source, /^function f\(x\)\{/, c.feature);
  assert.ok(['fulfilled', 'rejected'].includes(c.settlement), c.feature);
}

// ---- 1. native oracle with host job draining (oracle only; never guest semantics)
async function oracle(source, x) {
  const context = vm.createContext({});
  const promise = vm.runInContext(`${source};f(${x})`, context);
  assert.equal(typeof promise?.then, 'function', 'f must return a promise');
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('pending forever')), 2000); });
  try {
    return await Promise.race([promise.then(value => ({ settlement: 'fulfilled', value }), value => ({ settlement: 'rejected', value })), timeout]);
  } finally { clearTimeout(timer); }
}
let nativeChecks = 0;
const oracleFailures = [];
for (const c of asyncGeneratorCases) {
  for (const [x, expected] of [[c.input, c.expected], [c.input + 1, c.expectedNext]]) {
    const got = await oracle(c.source, x);
    if (got.settlement !== c.settlement || !Object.is(got.value, expected)) oracleFailures.push(`${c.feature}(${x}): got ${got.settlement} ${String(got.value)}, expected ${c.settlement} ${String(expected)}`);
    nativeChecks++;
  }
}
assert.deepEqual(oracleFailures, [], 'native oracle');
report.nativeChecks = nativeChecks;

// ---- 2/3. raw parity + kind-3 opcode coverage
const kind3Ops = new Map();
let rawPrograms = 0;
for (const c of asyncGeneratorCases) {
  const a = native(c.source), b = wasm(c.source);
  assert.ok(!a.error, `${c.feature}: ${a.error}`);
  assert.deepEqual(normalize(b), normalize(a), `${c.feature} native/Wasm normalized bytecode`);
  assert.ok(a.functions.some(f => f.kind === 3), `${c.feature} has a kind-3 function`);
  for (const f of a.functions) if (f.kind === 3) {
    assert.equal(f.hasPrototype, 0, `${c.feature}: async generator closures are not constructors`);
    for (const i of f.instructions) {
      kind3Ops.set(i.op, (kind3Ops.get(i.op) || 0) + 1);
      assert.ok(!['tail_call', 'tail_call_method', 'return', 'return_undef'].includes(i.op), `${c.feature}: kind 3 must complete through return_async`);
    }
  }
  rawPrograms++;
}
for (const op of ['initial_yield', 'await', 'yield', 'async_yield_star', 'return_async', 'for_await_of_start', 'iterator_next', 'iterator_call', 'iterator_check_object'])
  assert.ok(kind3Ops.has(op), `kind-3 coverage: ${op}`);
let helperPrograms = 0;
for (const [name, source] of Object.entries(asyncGeneratorSources)) {
  const a = native(source), b = wasm(source);
  assert.ok(!a.error, `${name}: ${a.error}`);
  assert.deepEqual(normalize(b), normalize(a), `${name} helper native/Wasm`);
  assert.equal(a.functions[0].strict, 1, `${name} strict`);
  // Nested closures must not reference private names (root-scope only).
  for (const f of a.functions.slice(1)) for (const ref of f.refs) assert.ok(!/^__/.test(ref.name) || a.functions[0].refs.some(r => r.name === ref.name && r.type <= 2), `${name}: nested ${ref.name}`);
  helperPrograms++;
}
report.rawPrograms = rawPrograms; report.helperPrograms = helperPrograms;
report.kind3Ops = Object.fromEntries([...kind3Ops].sort());

// ---- 5/6. preview
const names = ['program.js', 'phase4-registry.js', 'phase4-class-elements.js', 'shader.js', 'phase4-classes.js', 'bootstrap.js', 'phase4-fixed-nodes.js'];
const original = Object.fromEntries(names.map(n => [n, readFileSync(join(root, n), 'utf8')]));
const generatorPatched = generatorIntegrationPatch(original, { iteratorPrototypeNode: 77 });
for (const edit of asyncGeneratorIntegrationEdits) {
  const count = generatorPatched[edit.file].split(edit.anchor).length - 1;
  assert.equal(count, 1, `anchor uniqueness ${edit.file}: ${edit.anchor.slice(0, 80)} (${count})`);
}
report.anchors = asyncGeneratorIntegrationEdits.length;
let patched = applyIntegrationEdits(generatorPatched, asyncGeneratorIntegrationEdits);
// Dependency stubs (PREVIEW ONLY, owned by other workers / the parent). They
// only make names resolvable for packing and WGSL generation; none of them
// supplies semantics, and no fixture is executed here.
const WORKER7_STUB_OPS = ['for_await_of_start', 'for_await_of_next', 'iterator_get_value_done'];
const dependencyStubs = [
  { file: 'phase4-registry.js', anchor: ',...asyncGeneratorOpcodes', position: 'after', text: ",..." + JSON.stringify(['await', ...WORKER7_STUB_OPS]), why: 'worker 5 await / worker 7 for_await_of_start opcode names' },
  { file: 'phase4-registry.js', anchor: '\n  if(asyncGeneratorOpcodes.includes(op))return {op,a:0,b:0};', position: 'after', text: "\n  if(op==='await'||"+JSON.stringify(WORKER7_STUB_OPS)+".includes(op))return {op,a:Number.isInteger(instruction.operand)?instruction.operand:0,b:0};", why: 'worker 5 / worker 7 lowering' },
  { file: 'bootstrap.js', anchor: '  ...asyncGeneratorPrivateBuiltins,\n', position: 'after', text: '  __promiseNewCapability:2821,__promiseResolve:2827,__promisePerformThen:2830,\n', why: 'workers 1/2/3 private names' },
  { file: 'phase4-fixed-nodes.js', anchor: 'export const FIXED_RESERVED_LAST = 85;', position: 'replace', text: 'export const FIXED_RESERVED_LAST = 105;', why: 'parent: reserve fixed nodes 86..105' },
];
patched = applyIntegrationEdits(patched, dependencyStubs);
const directory = mkdtempSync(join(tmpdir(), 'lanes-async-generator-preview-'));
try {
  for (const name of names) {
    const code = patched[name].replace(/(from\s*|import\s*)['"](\.\.?\/[^'"]+|acorn)['"]/g, (match, prefix, specifier) => {
      const relative = specifier.slice(2), url = specifier === 'acorn' ? import.meta.resolve('acorn') : pathToFileURL(join(names.includes(relative) ? directory : root, specifier)).href;
      return prefix + JSON.stringify(url);
    });
    writeFileSync(join(directory, name), code);
  }
  const { bootstrapSources, attachBootstrap, privateBuiltins } = await import(pathToFileURL(join(directory, 'bootstrap.js')));
  const P = await import(pathToFileURL(join(directory, 'program.js'))), S = await import(pathToFileURL(join(directory, 'shader.js')));
  for (const [name, id] of Object.entries(liveOP)) assert.equal(P.OP[name], id, `${name} opcode stable`);
  for (const [name, id] of Object.entries(liveFields)) assert.equal(P.FIELDS[name], id, `${name} field stable`);
  assert.ok(Number.isInteger(P.OP.async_yield_star), 'async_yield_star admitted');
  for (const name of asyncGeneratorFields) assert.ok(!(name in liveFields) || ['AsyncGenerator', 'AsyncGeneratorFunction'].includes(name), `field ${name} must be new`);
  for (const name of Object.keys(asyncGeneratorSources)) assert.ok(!(name in liveFields), `helper slot ${name} must not alias an existing name`);
  for (const [name, id] of Object.entries(asyncGeneratorPrivateBuiltins)) assert.equal(privateBuiltins[name], id, `private ${name}`);
  for (const id of Object.keys(asyncGeneratorBuiltinFields)) assert.ok(new RegExp(`fnValue\\.x==${id}u\\)\\{field=`).test(S.shader), `call() dispatch for ${id}`);
  const shader = S.shader;
  assert.ok(!/undefinedu|NaNu|\$\{/.test(shader), 'no unresolved template output');
  // Function table and acyclic call graph.
  const clean = shader.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const functions = new Map();
  for (const m of clean.matchAll(/\bfn\s+(\w+)\s*\(/g)) {
    let start = clean.indexOf('{', m.index), end = start + 1, depth = 1;
    while (depth && end < clean.length) { if (clean[end] === '{') depth++; else if (clean[end] === '}') depth--; end++; }
    assert.equal(depth, 0, m[1]);
    assert.ok(!functions.has(m[1]), `fn ${m[1]} defined once`);
    functions.set(m[1], clean.slice(start + 1, end - 1));
  }
  const active = [], done = new Set();
  function visit(name) {
    assert.ok(!active.includes(name), `WGSL recursion: ${[...active, name].join(' -> ')}`);
    if (done.has(name)) return;
    active.push(name);
    for (const m of functions.get(name).matchAll(/\b(\w+)\s*\(/g)) if (functions.has(m[1])) visit(m[1]);
    active.pop(); done.add(name);
  }
  for (const name of functions.keys()) visit(name);
  const mine = [...functions.keys()].filter(n => /^asyncGenerator/.test(n));
  assert.ok(mine.length >= 18, 'async generator WGSL functions present');
  // Every identifier called from this worker's WGSL resolves.
  const context = { OP: P.OP, F: P.FIELDS, L: P.LIMITS };
  const fragments = {
    functions: asyncGeneratorWGSLFunctions(context), gc: asyncGeneratorGCWGSL, objectMethod: asyncGeneratorObjectMethodWGSL,
    call: asyncGeneratorCallWGSL, closure: asyncGeneratorClosureWGSL(context), init: asyncGeneratorInitWGSL(context), property: asyncGeneratorPropertyWGSL(context),
  };
  const builtins = new Set('if for while loop switch return select min max V Pair Node Frame array vec4 vec2 u32 i32 f32 bool'.split(' '));
  const reserved = new Set(`NULL Self abstract active alignas alignof as asm asm_fragment async attribute auto await become binding_array cast catch class co_await co_return co_yield coherent column_major common compile compile_fragment concept const_cast consteval constexpr constinit crate debugger decltype delete demote demote_to_helper do dynamic_cast enum explicit export extends extern external fallthrough filter final finally friend from fxgroup get goto groupshared highp impl implements import inline instanceof interface layout lowp macro macro_rules match mediump meta mod module move mut mutable namespace new nil noexcept noinline nointerpolation noperspective null nullptr of operator package packoffset partition pass patch pixelfragment precise precision premerge priv protected pub public readonly ref regardless register reinterpret_cast require resource restrict self set shared sizeof smooth snorm static static_assert static_cast std subroutine super target template this thread_local throw trait try type typedef typeid typename typeof union unless unorm unsafe unsized use using varying virtual volatile wgsl where with writeonly yield`.split(/\s+/));
  const problems = [];
  for (const [name, text] of Object.entries(fragments)) {
    const code = text.replace(/\/\/[^\n]*/g, '');
    for (const [open, close] of ['{}', '()', '[]']) if (code.split(open).length !== code.split(close).length) problems.push(`${name}: unbalanced ${open}${close}`);
    if (/\$\{|undefinedu|NaNu/.test(code)) problems.push(`${name}: unresolved template output`);
    for (const m of code.matchAll(/\b(?:let|var|fn|const)\s+([A-Za-z_]\w*)/g)) if (reserved.has(m[1])) problems.push(`${name}: reserved identifier ${m[1]}`);
    for (const m of code.matchAll(/[(,]\s*([A-Za-z_]\w*)\s*:\s*[A-Za-z]/g)) if (reserved.has(m[1])) problems.push(`${name}: reserved parameter ${m[1]}`);
    for (const m of code.matchAll(/\b([A-Za-z_]\w*)\s*\(/g)) if (!functions.has(m[1]) && !builtins.has(m[1])) problems.push(`${name}: unknown call ${m[1]}`);
    // `let` bindings must never be reassigned.
    const lets = [...code.matchAll(/\blet\s+(\w+)\s*=/g)].map(m => m[1]);
    for (const v of lets) if (new RegExp(`(^|[^\\w.])${v}\\s*=[^=]`, 'g').test(code.replace(new RegExp(`\\blet\\s+${v}\\s*=`, 'g'), ''))) problems.push(`${name}: let ${v} reassigned`);
  }
  for (const m of clean.matchAll(/\b(?:let|var|fn)\s+([A-Za-z_]\w*)/g)) if (reserved.has(m[1])) problems.push(`shader: reserved identifier ${m[1]}`);
  for (const [open, close] of ['{}', '()']) if (clean.split(open).length !== clean.split(close).length) problems.push(`shader: unbalanced ${open}${close}`);
  assert.ok(/@compute @workgroup_size\(\d+\)\s*fn main\(/.test(shader), '@compute precedes main');
  assert.deepEqual(problems, [], 'WGSL lint');
  // Hook placement inside the right functions.
  assert.ok(functions.get('finish').includes('asyncGeneratorBeforeFinish(l)'), 'finish hook');
  assert.ok(functions.get('raise').includes('asyncGeneratorUnwind(l,'), 'raise hook');
  assert.ok(functions.get('call').includes('asyncGeneratorResume(l,') && functions.get('call').includes('asyncGeneratorEnter(l,'), 'call hooks');
  assert.ok(/else if\(generatorFunction\(l,fnValue\)\)\{generatorEnter\(/.test(functions.get('call')), 'sync generator enter diverted for kind 3');
  assert.ok(functions.get('construct').includes(`callee.x==${ASYNC_GENERATOR_IDS.functionIdentity}u`), 'construct hook');
  assert.ok(functions.get('closure').includes('ASYNC_GENERATOR_FUNCTION_PROTOTYPE'), 'closure hook');
  assert.ok(functions.get('collect').includes('node.kind==74u'), 'GC hook');
  assert.ok(functions.get('objectMethod').includes(`id==${ASYNC_GENERATOR_IDS.signal}u`), 'objectMethod arms');
  assert.ok(functions.get('getProperty').includes('obj.x==2880u'), 'metadata arms');
  const main = functions.get('main');
  assert.ok(main.includes('asyncGeneratorOpcode(l,op)){asyncGeneratorStep(l,op);}else'), 'dispatch intercept');
  assert.ok(main.indexOf('states[l].heap[95u]=Node(V(96u') >= 0 && main.indexOf('states[l].heap[94u]=Node(V(3u') >= 0, 'fixed nodes 94/95 initialized');
  report.wgslFunctions = functions.size; report.asyncGeneratorWGSLFunctions = mine.length;
  // Packed images from both compiler bridges.
  const bootNative = Object.fromEntries(Object.entries(bootstrapSources).map(([k, s]) => [k, native(s)]));
  const bootWasm = Object.fromEntries(Object.entries(bootstrapSources).map(([k, s]) => [k, wasm(s)]));
  for (const k of Object.keys(asyncGeneratorSources)) assert.ok(k in bootNative, `bootstrap ${k}`);
  let packed = 0;const packGated = [];
  for (const c of asyncGeneratorCases) {
    // The Promise global is worker 1's phase4-global edit; not stubbed here.
    if (c.needs?.includes('Promise.resolve')) { packGated.push(c.feature); continue; }
    const a = P.packProgram(attachBootstrap(native(c.source), bootNative), P.entrySource(c.source));
    const b = P.packProgram(attachBootstrap(wasm(c.source), bootWasm), P.entrySource(c.source));
    assert.deepEqual(a.code, b.code, c.feature); assert.deepEqual(a.image, b.image, c.feature);
    const raw = a.raw;
    raw.functions.forEach((f, i) => { if (f.kind === 3) assert.equal(a.image[i * 8 + 3] & ASYNC_GENERATOR_INFO_BITS, ASYNC_GENERATOR_INFO_BITS, `${c.feature}: kind-3 info bits`); });
    packed++;
  }
  report.packedNativeWasmPrograms = packed; report.packGatedOnWorker1PromiseGlobal = packGated;
  report.opcodesPreserved = Object.keys(liveOP).length; report.fieldsPreserved = Object.keys(liveFields).length;
} finally { rmSync(directory, { recursive: true, force: true }); }
report.dependencyStubsInPreview = dependencyStubs.map(s => s.why);
report.dependencies = Object.fromEntries(Object.entries(asyncGeneratorDependencies).map(([k, v]) => [k, v.owner]));
report.gpuExecuted = false; report.liveCoreModified = false;
console.log(JSON.stringify(report, null, 1));
