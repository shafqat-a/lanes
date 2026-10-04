// Parent integration evidence for the Promise + async wave (host only).
// Applies promiseIntegrationPatch to copies of the live modules inside a
// private preview directory in this folder, imports the patched modules, and
// verifies: opcode/FIELDS stability, reserved ranges, a lint-clean acyclic
// WGSL module, every fixture packing identically from the native and Wasm
// compilers, and the host settlement API against a mock device. The live tree
// is never written. Nothing here executes guest code or WGSL.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { promiseIntegrationPatch, PROMISE_INTEGRATION_FILES } from './promise-integration-patch.js';
import { assertDisjointRanges, FIXED_RESERVED_LAST_REQUIRED } from './reserved-ranges.js';
import { OP as liveOP, FIELDS as liveFields } from './program.js';
import createModule from './generated/compiler.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const caseModules = ['promise-core-cases.js', 'promise-resolve-cases.js', 'promise-then-cases.js', 'promise-combinators-cases.js',
  'async-function-cases.js', 'async-generator-cases.js', 'promise-jobs-cases.js', 'async-iteration-cases.js', 'promise-conformance-cases.js'];
const report = { isolatedPreview: true, liveCoreModified: false, gpuExecuted: false };
assertDisjointRanges();

const original = Object.fromEntries(PROMISE_INTEGRATION_FILES.map(n => [n, readFileSync(join(root, n), 'utf8')]));
const patched = await promiseIntegrationPatch(original);
const directory = mkdtempSync(join(root, '..', '.promise-preview-'));
try {
  for (const name of readdirSync(root)) if (/\.(m?js)$/.test(name)) writeFileSync(join(directory, name), readFileSync(join(root, name)));
  for (const name of ['generated', 'vendor', 'phase6-protocols', 'phase3']) symlinkSync(join(root, name), join(directory, name));
  for (const name of PROMISE_INTEGRATION_FILES) writeFileSync(join(directory, name), patched[name]);
  const load = name => import(pathToFileURL(join(directory, name)).href);
  const N = await load('phase4-fixed-nodes.js');
  assert.equal(N.FIXED_RESERVED_LAST, FIXED_RESERVED_LAST_REQUIRED, 'reserved fixed range covers 86..105');
  const P = await load('program.js'), S = await load('shader.js'), B = await load('bootstrap.js');
  for (const [name, id] of Object.entries(liveOP)) assert.equal(P.OP[name], id, `${name} opcode stable`);
  for (const [name, id] of Object.entries(liveFields)) assert.equal(P.FIELDS[name], id, `${name} field stable`);
  report.opcodesPreserved = Object.keys(liveOP).length; report.opcodesAdded = Object.keys(P.OP).length - report.opcodesPreserved;
  report.fieldsPreserved = Object.keys(liveFields).length; report.fieldsAdded = Object.keys(P.FIELDS).length - report.fieldsPreserved;

  // WGSL: no template residue, no reserved identifiers, unique acyclic functions.
  const shader = S.shader;
  assert.ok(!/undefinedu|NaNu|\$\{|\[object Object\]/.test(shader), 'WGSL template residue');
  const clean = shader.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const reserved = new Set('abstract active alignas alignof as asm async await become cast catch class const_cast consteval constexpr debugger decltype delete do enum explicit export extends extern external fallthrough filter final finally friend from get goto impl implements import inline instanceof interface layout macro match meta mod module move mut mutable namespace new nil noexcept null nullptr of operator package partition pass patch precise precision private protected pub public readonly ref register require resource restrict self set shared sizeof static super target template this throw trait try type typedef typeid typename typeof union unless unsafe unsized use using virtual volatile where with yield'.split(' '));
  for (const m of clean.matchAll(/\b(?:let|var|fn|const)\s+([A-Za-z_]\w*)/g)) assert.ok(!reserved.has(m[1]), `WGSL reserved identifier ${m[1]}`);
  for (const [open, close] of [['{', '}'], ['(', ')']]) assert.equal(clean.split(open).length, clean.split(close).length, `WGSL balanced ${open}${close}`);
  const functions = new Map();
  for (const m of clean.matchAll(/\bfn\s+(\w+)\s*\(/g)) {
    assert.ok(!functions.has(m[1]), `WGSL function ${m[1]} defined once`);
    let start = clean.indexOf('{', m.index), end = start + 1, depth = 1;
    while (depth && end < clean.length) { if (clean[end] === '{') depth++; else if (clean[end] === '}') depth--; end++; }
    functions.set(m[1], clean.slice(start + 1, end - 1));
  }
  const active = [], done = new Set();
  const visit = name => { assert.ok(!active.includes(name), `WGSL recursion: ${[...active, name].join(' -> ')}`); if (done.has(name)) return; active.push(name); for (const m of functions.get(name).matchAll(/\b(\w+)\s*\(/g)) if (functions.has(m[1])) visit(m[1]); active.pop(); done.add(name); };
  for (const name of functions.keys()) visit(name);
  report.wgslFunctions = functions.size;
  for (const fn of ['promiseAllocate', 'promiseHeaderOf', 'promiseSettleHeader', 'jobEnqueue', 'asyncAwait', 'asyncResume', 'asyncRejectDispatch', 'generatorResume'])
    assert.ok(functions.has(fn), `${fn} present`);
  for (const status of [10, 11]) assert.ok(new RegExp(`status==${status}u`).test(clean), `status ${status} handled in WGSL`);
  // Fixed-node init order: Promise ctor/prototype before methods installed on them.
  const mainBody = functions.get('main');
  for (const node of [90, 91, 92, 93, 94, 95, 96, 97, 98, 99]) assert.ok(new RegExp(`heap\\[${node}u\\]\\s*=`).test(clean), `fixed node ${node} initialized in place`);
  report.mainBytes = mainBody.length;

  // Every fixture packs identically from both compiler bridges.
  const module = await createModule();
  const native = s => JSON.parse(execFileSync(join(root, 'generated/compiler'), [s], { encoding: 'utf8', maxBuffer: 1 << 26 }));
  const wasm = s => JSON.parse(module.ccall('lanes_compile', 'string', ['string'], [s]));
  const bootNative = Object.fromEntries(Object.entries(B.bootstrapSources).map(([k, s]) => [k, native(s)]));
  const bootWasm = Object.fromEntries(Object.entries(B.bootstrapSources).map(([k, s]) => [k, wasm(s)]));
  report.bootstrapHelpers = Object.keys(bootNative).length;
  const packed = {}, failures = [];
  for (const file of caseModules) {
    const m = await import(pathToFileURL(join(root, file)).href);
    const cases = Object.values(m).filter(Array.isArray).flat().filter(c => c && typeof c.source === 'string');
    let count = 0;
    for (const c of cases) {
      try {
        const a = P.packProgram(B.attachBootstrap(native(c.source), bootNative), P.entrySource(c.source));
        const b = P.packProgram(B.attachBootstrap(wasm(c.source), bootWasm), P.entrySource(c.source));
        assert.deepEqual(a.code, b.code); assert.deepEqual(a.image, b.image); count++;
      } catch (e) { failures.push(`${file}:${c.feature}: ${e.message.split('\n')[0]}`); }
    }
    packed[file] = `${count}/${cases.length}`;
  }
  report.packedNativeWasm = packed; report.packFailures = failures;

  // Host settlement API against a mock device: statuses 12/13/14.
  const R = await load('runtime.js');
  const program = P.packProgram(B.attachBootstrap(native('function f(x){return Promise.resolve(x);}'), bootNative), 'f');
  const snapshot = (status, value) => { const w = new Uint32Array(S.SNAPSHOT_WORDS * 3); w.set([status, 7, 1, 0], 0); w.set(value, 4); w.set([13, 7, 0, 0, 0, 0x40080000, 0, 0], S.SNAPSHOT_WORDS); w.set([14, 7, 0, 0, 0, 0x7ff80000, 3, 0], 2 * S.SNAPSHOT_WORDS); return w; };
  const device = words => ({ lost: new Promise(() => {}), limits: { maxStorageBufferBindingSize: 1e9, maxBufferSize: 1e9, maxStorageBuffersPerShaderStage: 8, maxBindingsPerBindGroup: 1000 },
    pushErrorScope() {}, popErrorScope() { return Promise.resolve(null); },
    createShaderModule() { return { getCompilationInfo: () => Promise.resolve({ messages: [] }) }; },
    createComputePipelineAsync() { return Promise.resolve({ getBindGroupLayout() {} }); },
    createBuffer({ size }) { return { size, destroy() {}, mapAsync() { return Promise.resolve(); }, getMappedRange() { return words.slice(0, size / 4).buffer; }, unmap() {} }; },
    createBindGroup() { return {}; }, queue: { writeBuffer() {}, submit() {} },
    createCommandEncoder() { return { beginComputePass() { return { setPipeline() {}, setBindGroup() {}, dispatchWorkgroups() {}, end() {} }; }, copyBufferToBuffer() {}, finish() {} }; } });
  const words = snapshot(12, [0, 0x40000000, 0, 0]);
  const runtime = new R.QuickJSGPU(device(words));
  const settled = await runtime.run(program, [1, 2, 3], { promiseResults: 'settle', maxDispatches: 1 });
  assert.deepEqual(settled.settlements, ['fulfilled', 'rejected', 'pending']);
  assert.deepEqual(settled.values, [2, 3, undefined]); assert.equal(settled.done, true);
  await assert.rejects(runtime.run(program, [1, 2, 3], { maxDispatches: 1 }), /requires \{ promiseResults: 'settle' \}/);
  await assert.rejects(runtime.run(program, [1], { promiseResults: 'yes' }), /promiseResults must be/);
  await runtime.dispose();
  report.hostApi = { settlements: settled.settlements, values: settled.values, optInRequired: true };
} finally { rmSync(directory, { recursive: true, force: true }); }
console.log(JSON.stringify(report, null, 1));
if (report.packFailures.length) { console.error(`${report.packFailures.length} fixtures failed to pack`); process.exitCode = 1; }
