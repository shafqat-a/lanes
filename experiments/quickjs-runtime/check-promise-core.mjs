// Host-only evidence for the Promise core (worker 1). Never touches the live
// tree, never runs a GPU. Sections:
//  1. native oracle: every fixture evaluated by the host engine with real job
//     draining; settlement and settled value must equal the fixed expectations;
//  2. helper sources compiled by the native binary and the Wasm bridge, raw
//     bytecode identical (atom operands normalized), all kind 0, nested
//     global refs resolve to the root's capture slots;
//  3. WGSL static lint of every promise-core WGSL string;
//  4. anchors: applied to generatorIntegrationPatch(live,{iteratorPrototypeNode:77})
//     each matches exactly once; the fully patched modules are then imported
//     from a temp dir and every fixture is packed with all bootstrap helpers
//     from both compilers (identical code/image => every helper op and ref is
//     admitted by the packer), FIELDS/opcodes stay stable, WGSL call graph acyclic.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import createModule from './generated/compiler.mjs';
import { LIMITS, FIELDS, OP } from './program.js';
import { generatorIntegrationPatch } from './generator-integration-patch.js';
import { PROMISE_INTRINSIC_RANGES, PROMISE_HELPER_RANGES, PROMISE_IDS, PROMISE_NODES, PROMISE_KINDS } from './promise-ids.js';
import * as PC from './promise-core-source.js';
import { promiseCoreCases, promiseCoreBoundaryCases } from './promise-core-cases.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const failures = [];
const step = (name, fn) => { try { return fn(); } catch (e) { failures.push(`${name}: ${e.message}`); } };
// Rejected promises created by fixtures are intentionally unhandled.
process.on('unhandledRejection', () => {});

// ---------------------------------------------------------------- 1. oracle --
let oracleChecks = 0;
const allCases = [...promiseCoreCases, ...promiseCoreBoundaryCases];
{
  const features = new Set();
  for (const c of allCases) { assert.ok(!features.has(c.feature), `duplicate feature ${c.feature}`); features.add(c.feature); }
  assert.ok(promiseCoreCases.length >= 30, 'at least 30 core fixtures');
}
for (const c of allCases) {
  for (const [x, expected] of [[c.input, c.expected], [c.input + 1, c.expectedNext]]) {
    const context = vm.createContext({});
    let result;
    try { result = vm.runInContext(`${c.source};f(${x})`, context); }
    catch (e) { failures.push(`${c.feature}(${x}): synchronous throw ${e}`); continue; }
    if (!(result instanceof vm.runInContext('Promise', context))) { failures.push(`${c.feature}(${x}): result is not a Promise`); continue; }
    const [settlement, value] = await new Promise(done => result.then(v => done(['fulfilled', v]), e => done(['rejected', e])));
    if (settlement !== c.settlement || !Object.is(value, expected)) failures.push(`${c.feature}(${x}): native ${settlement} ${String(value)}, expected ${c.settlement} ${String(expected)}`);
    else oracleChecks++;
  }
}

// ------------------------------------------------- 2. helper compiler parity --
const module = await createModule();
const binary = join(root, 'generated/compiler');
const native = s => JSON.parse(execFileSync(binary, [s], { encoding: 'utf8', maxBuffer: 1 << 26 }));
const wasm = s => JSON.parse(module.ccall('lanes_compile', 'string', ['string'], [s]));
const normalize = r => ({ ...r, functions: r.functions.map(f => ({ ...f, instructions: f.instructions.map(i => typeof i.operand === 'string' ? { ...i, bytes: i.bytes.map((b, n) => n >= 1 && n <= 4 ? 0 : b) } : i) })) });
let helperParity = 0;
const knownNames = { ...PC.promiseCoreIntrinsics, ...PC.promiseCoreExternalIntrinsics };
for (const [field, source] of Object.entries(PC.promiseCoreSources)) step(`helper ${field}`, () => {
  const a = native(source), b = wasm(source);
  assert.ok(!a.error, a.error); assert.ok(!b.error, b.error);
  assert.deepEqual(normalize(b), normalize(a), `${field} native/Wasm normalized bytecode`);
  const parent = new Map();
  a.functions.forEach((f, i) => { assert.equal(f.kind, 0, `${field}#${i} must be a synchronous kind-0 function`); for (const k of f.constants) if ('function' in k) parent.set(k.function, i); });
  assert.equal(a.functions[0].strict, 1, `${field} strict`);
  for (const ref of a.functions[0].refs) if (ref.type === 3) assert.ok(ref.name === 'undefined' || ref.name in knownNames || ['TypeError'].includes(ref.name), `${field}: unknown global ${ref.name}`);
  a.functions.forEach((f, i) => {
    if (i === 0) return;
    for (const ref of f.refs) if (ref.type === 3) {
      assert.ok(!/^__(lanes|promise)/.test(ref.name), `${field}#${i}: private name ${ref.name} used in a nested function (bind it to a root local)`);
      assert.equal(parent.get(i), 0, `${field}#${i}: nested global ref outside a direct child of the root`);
      assert.equal(a.functions[0].refs[ref.index]?.name, ref.name, `${field}#${i}: nested global ${ref.name} does not resolve to the root slot`);
    }
  });
  // Resolving functions / capability executor: anonymous arrows, no prototype.
  for (const f of a.functions.slice(1)) { assert.equal(f.name, '', `${field}: nested helper function must be anonymous`); assert.equal(f.hasPrototype, 0, `${field}: arrow`); }
  if (field === 'promiseCreateResolvingFunctions') assert.deepEqual(a.functions.slice(1).map(f => f.length), [1, 1]);
  if (field === 'promiseNewCapability') assert.deepEqual(a.functions.slice(1).map(f => f.length), [2]);
  helperParity++;
});
// Fixture sources compile identically in both bridges (user code may use classes/closures).
let fixtureParity = 0;
for (const c of allCases) step(`fixture compile ${c.feature}`, () => { const a = native(c.source), b = wasm(c.source); assert.ok(!a.error, a.error); assert.deepEqual(normalize(b), normalize(a)); fixtureParity++; });

// --------------------------------------------------------- 3. WGSL lint --
const reserved = new Set('abstract active alignas alignof as asm async await become cast catch class const_cast consteval constexpr debugger decltype delete do enum explicit export extends extern external fallthrough filter final finally friend from get goto impl implements import inline instanceof interface layout macro match meta mod module move mut mutable namespace new nil noexcept null nullptr of operator package partition pass patch precise precision private protected pub public readonly ref register require resource restrict self set shared sizeof static super target template this throw trait try type typedef typeid typename typeof union unless unsafe unsized use using virtual volatile where with yield'.split(' '));
const fields = { ...FIELDS }; for (const name of PC.promiseCoreFields) if (!(name in fields)) fields[name] = Object.keys(fields).length;
const wgslParts = {
  functions: PC.promiseCoreWGSLFunctions({ F: fields, L: LIMITS }),
  objectMethod: PC.promiseCoreObjectMethodWGSL,
  callFields: PC.promiseCoreCallFieldsWGSL({ F: fields }),
  construct: PC.promiseCoreConstructWGSL,
  objectView: PC.promiseCoreObjectViewWGSL,
  objectValue: PC.promiseCoreObjectValueWGSL,
  gc: PC.promiseCoreGCWGSL,
  init: PC.promiseCoreInitWGSL({ F: fields }),
};
const wgsl = Object.values(wgslParts).join('\n');
step('wgsl lint', () => {
  assert.ok(!/undefinedu|NaNu|\$\{/.test(wgsl), 'interpolation leak');
  for (const m of wgsl.matchAll(/\b(?:let|var|fn|const)\s+([A-Za-z_]\w*)/g)) assert.ok(!reserved.has(m[1]), `WGSL reserved identifier ${m[1]}`);
  for (const m of wgsl.matchAll(/\(\s*([A-Za-z_]\w*)\s*:/g)) assert.ok(!reserved.has(m[1]), `WGSL reserved parameter ${m[1]}`);
  for (const [name, part] of Object.entries(wgslParts)) {
    let depth = 0, paren = 0;
    for (const ch of part) { if (ch === '{') depth++; if (ch === '}') depth--; if (ch === '(') paren++; if (ch === ')') paren--; assert.ok(depth >= 0 && paren >= 0, `${name}: unbalanced`); }
    assert.equal(depth, 0, `${name}: unbalanced braces`); assert.equal(paren, 0, `${name}: unbalanced parentheses`);
  }
  const [iFirst, iLast] = PROMISE_INTRINSIC_RANGES.worker1, [hFirst, hLast] = PROMISE_HELPER_RANGES.worker1;
  const ownIds = new Set(PC.promiseCoreUsedIds);
  for (const id of ownIds) assert.ok(id === PROMISE_IDS.ctor || id === PROMISE_IDS.construct || (id >= iFirst && id <= iLast) || (id >= hFirst && id <= hLast), `id ${id} outside worker-1 ranges`);
  // Every literal in 2800..2999 used by the WGSL is ours.
  for (const m of wgsl.matchAll(/\b(2[89]\d\d)u\b/g)) assert.ok(ownIds.has(Number(m[1])), `foreign id ${m[1]} in WGSL`);
  // Heap kinds referenced (kind==N / alloc(l,N)) in the 64..79 band: 64/65 only.
  for (const m of wgsl.matchAll(/kind(?:!=|==)(\d+)u|alloc\(l,(\d+)u/g)) { const k = Number(m[1] ?? m[2]); if (k >= 64 && k <= 79) assert.ok(PC.promiseCoreUsedKinds.includes(k), `kind ${k}`); }
  for (const m of wgsl.matchAll(/const PROMISE_(?:HEADER|REACTION):u32=(\d+)u/g)) assert.ok([PROMISE_KINDS.promiseHeader, PROMISE_KINDS.reactionCell].includes(Number(m[1])));
  // Fixed nodes written / referenced in 86..105: 90/91 only.
  for (const m of wgsl.matchAll(/heap\[(\d+)u\]|V\((\d+)u,0u,4u,0u\)|dataProperty\(l,(\d+)u/g)) { const n = Number(m[1] ?? m[2] ?? m[3]); if (n >= 86 && n <= 105) assert.ok([PROMISE_NODES.promiseCtor, PROMISE_NODES.promiseProto].includes(n), `fixed node ${n}`); }
  for (const fn of ['promiseAllocate', 'promiseHeaderOf', 'promiseSettleHeader']) assert.equal((wgslParts.functions.match(new RegExp(`fn ${fn}\\(`, 'g')) || []).length, 1, fn);
  assert.match(wgslParts.functions, /fn promiseAllocate\(l:u32,proto:u32\)->u32/);
  assert.match(wgslParts.functions, /fn promiseHeaderOf\(l:u32,v:V\)->u32/);
  assert.match(wgslParts.functions, /fn promiseSettleHeader\(l:u32,header:u32,state:u32,value:V\)/);
  assert.match(wgslParts.functions, /jobEnqueue\(l,1u,/);
});

// ------------------------------------------------------- 4. anchors + preview --
const names = ['program.js', 'phase4-registry.js', 'phase4-class-elements.js', 'shader.js', 'phase4-classes.js', 'bootstrap.js', 'phase4-global.js'];
const live = Object.fromEntries(names.map(n => [n, readFileSync(join(root, n), 'utf8')]));
const base = generatorIntegrationPatch(live, { iteratorPrototypeNode: 77 });
let anchorsChecked = 0;
for (const e of PC.promiseCoreIntegrationEdits) step(`anchor ${e.file}`, () => {
  assert.ok(['before', 'after', 'replace'].includes(e.position));
  assert.equal(base[e.file].split(e.anchor).length - 1, 1, `${e.file}: anchor must match exactly once: ${e.anchor.slice(0, 80)}`);
  anchorsChecked++;
});
let preview = null;
const directory = mkdtempSync(join(tmpdir(), 'lanes-promise-core-preview-'));
try {
  await (async () => {
    let patched = PC.applyPromiseCoreEdits(base);
    // TEST-ONLY name binding for worker 2's helper id (contract 2825). It maps an
    // identifier to an id for the packer; it adds no semantics.
    patched = PC.applyPromiseCoreEdits(patched, [{ file: 'bootstrap.js', anchor: '  ...promiseCoreIntrinsics,\n', position: 'after', text: '  ...(Object.hasOwn(phase4PrivateBuiltins,"__promiseResolveBody")?{}:{__promiseResolveBody:2825}),\n' }]);
    for (const name of names) {
      const code = patched[name].replace(/(from\s*|import\s*)['"](\.\.?\/[^'"]+|acorn)['"]/g, (match, prefix, specifier) => {
        const relative = specifier.slice(2), url = specifier === 'acorn' ? import.meta.resolve('acorn') : pathToFileURL(join(names.includes(relative) ? directory : root, specifier)).href;
        return prefix + JSON.stringify(url);
      });
      writeFileSync(join(directory, name), code);
    }
    const { bootstrapSources, attachBootstrap, privateBuiltins } = await import(pathToFileURL(join(directory, 'bootstrap.js')));
    const P = await import(pathToFileURL(join(directory, 'program.js'))), S = await import(pathToFileURL(join(directory, 'shader.js')));
    const G = await import(pathToFileURL(join(directory, 'phase4-global.js')));
    for (const [name, id] of Object.entries(OP)) assert.equal(P.OP[name], id, `${name} opcode stable`);
    for (const [name, id] of Object.entries(FIELDS)) assert.equal(P.FIELDS[name], id, `${name} field stable`);
    for (const name of PC.promiseCoreFields) assert.ok(name in P.FIELDS, `FIELDS ${name}`);
    for (const [name, id] of Object.entries(PC.promiseCoreIntrinsics)) assert.equal(privateBuiltins[name], id, `privateBuiltins ${name}`);
    for (const field of Object.keys(PC.promiseCoreSources)) assert.equal(bootstrapSources[field], PC.promiseCoreSources[field]);
    assert.ok(!G.globalUnimplementedNames.includes('Promise'));
    assert.ok(G.globalBindings.some(b => b.name === 'Promise' && b.value.builtin === 2800));
    const shader = S.shader;
    assert.ok(!/undefinedu|NaNu|\$\{/.test(shader));
    for (const fn of ['promiseAllocate', 'promiseHeaderOf', 'promiseSettleHeader', 'promiseIntrinsic', 'promiseStateOf', 'promiseMatchingReactions']) assert.equal((shader.match(new RegExp('fn ' + fn + '\\(', 'g')) || []).length, 1, `${fn} once`);
    for (const part of ['objectMethod', 'construct', 'objectView', 'objectValue', 'callFields']) {
      const text = part === 'callFields' ? PC.promiseCoreCallFieldsWGSL({ F: P.FIELDS }) : wgslParts[part];
      assert.equal(shader.split(text).length - 1, 1, `${part} hook spliced once`);
    }
    assert.ok(shader.includes(PC.promiseCoreGCWGSL.trim()), 'GC hook spliced');
    assert.ok(shader.includes(PC.promiseCoreInitWGSL({ F: P.FIELDS }).trim()), 'init spliced');
    // Hook placement: objectMethod dispatch precedes the id>=150 fallthrough; GC hook inside collect();
    // init after Function.prototype/Object.prototype exist and before the entry closure.
    const om = shader.indexOf('fn objectMethod('), omHook = shader.indexOf(PC.promiseCoreObjectMethodWGSL), om150 = shader.indexOf('if(id>=150u){states[l].status=6u;return undef();}', om);
    assert.ok(om < omHook && omHook < om150, 'objectMethod hook before id>=150 fallthrough');
    const col = shader.indexOf('fn collect('), gc = shader.indexOf(PC.promiseCoreGCWGSL.trim()), sweep = shader.indexOf('states[l].freeHead=0u; states[l].freeCount=0u;', col);
    assert.ok(col < gc && gc < sweep, 'GC hook in the mark loop');
    const init = shader.indexOf(PC.promiseCoreInitWGSL({ F: P.FIELDS }).trim()), fp = shader.indexOf('let functionProto=alloc('), entry = shader.indexOf('let fnValue=closure(l,0u);');
    assert.ok(fp < init && init < entry, 'init placement');
    const ctor = shader.indexOf('fn construct('), ctorHook = shader.indexOf(PC.promiseCoreConstructWGSL);
    assert.ok(ctor < ctorHook && ctorHook < shader.indexOf('fn setPrototype('), 'construct hook inside construct()');
    // Acyclic WGSL call graph (as check-generator-integration). jobEnqueue is worker 7's (external).
    const functions = new Map(), clean = shader.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    for (const m of clean.matchAll(/\bfn\s+(\w+)\s*\(/g)) {
      let start = clean.indexOf('{', m.index), end = start + 1, depth = 1;
      while (depth && end < clean.length) { if (clean[end] === '{') depth++; else if (clean[end] === '}') depth--; end++; }
      assert.equal(depth, 0, m[1]); functions.set(m[1], clean.slice(start + 1, end - 1));
    }
    const active = [], done = new Set();
    function visit(name) { assert.ok(!active.includes(name), `WGSL recursion: ${[...active, name].join(' -> ')}`); if (done.has(name)) return; active.push(name); for (const m of functions.get(name).matchAll(/\b(\w+)\s*\(/g)) if (functions.has(m[1])) visit(m[1]); active.pop(); done.add(name); }
    for (const name of functions.keys()) visit(name);
    const externalCalls = [...new Set([...functions.get('promiseSettleHeader').matchAll(/\b(\w+)\s*\(/g)].map(m => m[1]).filter(n => !functions.has(n) && !['for', 'if', 'V', 'select', 'u32'].includes(n)))];
    // Pack every fixture with all bootstrap helpers from both compilers.
    const bootNative = Object.fromEntries(Object.entries(bootstrapSources).map(([k, s]) => [k, native(s)]));
    const bootWasm = Object.fromEntries(Object.entries(bootstrapSources).map(([k, s]) => [k, wasm(s)]));
    let packed = 0;
    for (const c of allCases) step(`pack ${c.feature}`, () => {
      const a = P.packProgram(attachBootstrap(native(c.source), bootNative), P.entrySource(c.source));
      const b = P.packProgram(attachBootstrap(wasm(c.source), bootWasm), P.entrySource(c.source));
      assert.deepEqual(a.code, b.code); assert.deepEqual(a.image, b.image);
      packed++;
    });
    preview = { packedNativeWasmPrograms: packed, wgslFunctions: functions.size, wgslAcyclic: true, externalWGSLCalls: externalCalls };
  })();
} catch (e) { failures.push(`preview: ${e.stack || e.message}`); }
finally { rmSync(directory, { recursive: true, force: true }); }

// Parent-owned precondition (not a worker-1 failure): fixed nodes 90/91 must be
// excluded from allocation/sweep before init writes them in place.
const { FIXED_RESERVED_LAST } = await import('./phase4-fixed-nodes.js');
const dependencies = { fixedReservedCoversNodes90to91: FIXED_RESERVED_LAST >= PROMISE_NODES.promiseProto, liveFixedReservedLast: FIXED_RESERVED_LAST, jobEnqueueWorker7: 'external WGSL fn', promiseResolveBody2825Worker2: 'external guest helper' };
const report = { dependencies, oracleChecks, helperNativeWasmParity: helperParity, fixtureCompileParity: fixtureParity, wgslStaticChecks: !failures.some(f => f.startsWith('wgsl')), anchorsChecked, preview, coreFixtures: promiseCoreCases.length, boundaryFixtures: promiseCoreBoundaryCases.length, liveCoreModified: false, gpuExecuted: false, failures };
console.log(JSON.stringify(report, null, 1));
if (failures.length) process.exit(1);
