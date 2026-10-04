// Worker 5 host-only evidence for async functions (QuickJS kind 2).
//  1. Fresh native oracle (node:vm, microtasks drained) for every fixture/input.
//  2. Raw native/Wasm bytecode parity (atom operands normalized) + kind-2 opcode coverage.
//  3. WGSL static lint of the worker-5 fragments.
//  4. Anchor uniqueness against generatorIntegrationPatch(live,{iteratorPrototypeNode:77}).
//  5. Isolated preview (temp copies, never the live tree): generator patch + worker-5
//     edits, opcode/FIELDS stability, WGSL lint + acyclic call graph, and packing of
//     every fixture from both compilers. Helpers owned by other workers that are not
//     integrated yet are STUBBED (preview only, labelled) and reported.
//  6. Optional composition with other workers' exported edits, if present (report only).
// GPU execution is NOT performed here.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import createModule from './generated/compiler.mjs';
import { generatorIntegrationPatch } from './generator-integration-patch.js';
import { OP as liveOP, FIELDS as liveFIELDS, LIMITS } from './program.js';
import { asyncFunctionCases } from './async-function-cases.js';
import * as A from './async-function-source.js';

process.on('unhandledRejection', () => {}); // fixtures intentionally create unobserved rejections
const root = fileURLToPath(new URL('.', import.meta.url));
const binary = join(root, 'generated/compiler');
const module = await createModule();
const native = s => JSON.parse(execFileSync(binary, [s], { encoding: 'utf8', maxBuffer: 1 << 26 }));
const wasm = s => JSON.parse(module.ccall('lanes_compile', 'string', ['string'], [s]));
const report = { fixtures: asyncFunctionCases.length };

// ---- 1. native oracle --------------------------------------------------------
async function settle(source, x) {
  const p = vm.runInNewContext(`${source};f(${x})`);
  if (!p || typeof p.then !== 'function') return { state: 'not-a-promise', value: p };
  let out = { state: 'pending', value: undefined };
  p.then(v => { out = { state: 'fulfilled', value: v }; }, e => { out = { state: 'rejected', value: e }; });
  for (let i = 0; i < 20 && out.state === 'pending'; i++) await new Promise(r => setImmediate(r));
  return out;
}
let nativeChecks = 0;
const features = new Set();
for (const c of asyncFunctionCases) {
  assert.ok(!features.has(c.feature), `duplicate feature ${c.feature}`); features.add(c.feature);
  assert.match(c.source, /^function f\(x\)\{/);
  for (const [x, expected] of [[c.input, c.expected], [c.input + 1, c.expectedNext]]) {
    const r = await settle(c.source, x);
    assert.equal(r.state, c.settlement, `${c.feature}(${x}) settlement`);
    assert.equal(r.value, expected, `${c.feature}(${x}) value`);
    assert.ok(r.value === undefined || ['number', 'string', 'boolean'].includes(typeof r.value), `${c.feature}: primitive result`);
    nativeChecks++;
  }
}
const gcCount = asyncFunctionCases.filter(c => c.gc).length, oneCount = asyncFunctionCases.filter(c => c.oneInstruction).length;
assert.ok(asyncFunctionCases.length >= 40 && gcCount >= 3 && oneCount >= 3, 'fixture coverage minimums');
Object.assign(report, { nativeChecks, gcFixtures: gcCount, oneInstructionFixtures: oneCount, settlements: Object.fromEntries(['fulfilled', 'rejected', 'pending'].map(s => [s, asyncFunctionCases.filter(c => c.settlement === s).length])) });

// ---- 2. raw native/Wasm parity and kind-2 opcode coverage --------------------
const normalize = r => ({ ...r, functions: r.functions.map(f => ({ ...f, instructions: f.instructions.map(i => typeof i.operand === 'string' ? { ...i, bytes: i.bytes.map((b, n) => n >= 1 && n <= 4 ? 0 : b) } : i) })) });
const kind2Ops = new Set();
let rawParity = 0;
for (const c of asyncFunctionCases) {
  const n = native(c.source), w = wasm(c.source);
  assert.ok(!n.error, `${c.feature}: ${n.error}`);
  assert.deepEqual(normalize(w), normalize(n), `${c.feature} native/Wasm normalized bytecode`);
  assert.ok(n.functions.some(f => f.kind === 2), `${c.feature}: async function compiled as kind 2`);
  for (const f of n.functions) if (f.kind === 2) {
    assert.equal(f.hasPrototype, 0, `${c.feature}: kind 2 has no prototype`);
    for (const i of f.instructions) {
      kind2Ops.add(i.op);
      assert.ok(!['tail_call', 'tail_call_method', 'return', 'return_undef', 'initial_yield', 'yield', 'yield_star'].includes(i.op), `${c.feature}: kind 2 must complete through return_async (${i.op})`);
    }
  }
  rawParity++;
}
for (const op of A.asyncFunctionKind2Opcodes) assert.ok(kind2Ops.has(op), `${op} fixture coverage`);
Object.assign(report, { nativeWasmRawPrograms: rawParity, kind2OpcodesObserved: [...kind2Ops].sort() });

// ---- 3. WGSL lint ------------------------------------------------------------
const reserved = new Set('abstract active alignas alignof as asm async await become cast catch class const_cast consteval constexpr debugger decltype delete do enum explicit export extends extern external fallthrough filter final finally friend from get goto impl implements import inline instanceof interface layout macro match meta mod module move mut mutable namespace new nil noexcept null nullptr of operator package partition pass patch precise precision private protected pub public readonly ref register require resource restrict self set shared sizeof static super target template this throw trait try type typedef typeid typename typeof union unless unsafe unsized use using virtual volatile where with yield'.split(' '));
function lint(wgsl, label) {
  assert.ok(!/undefinedu|NaNu|\$\{/.test(wgsl), `${label}: interpolation residue`);
  for (const m of wgsl.matchAll(/\b(?:let|var|fn|const)\s+([A-Za-z_]\w*)/g)) assert.ok(!reserved.has(m[1]), `${label}: WGSL reserved identifier ${m[1]}`);
  let depth = 0; for (const ch of wgsl.replace(/\/\/[^\n]*/g, '')) { if (ch === '{') depth++; else if (ch === '}') depth--; assert.ok(depth >= 0, `${label}: brace underflow`); }
  assert.equal(depth, 0, `${label}: unbalanced braces`);
  let paren = 0; for (const ch of wgsl.replace(/\/\/[^\n]*/g, '')) { if (ch === '(') paren++; else if (ch === ')') paren--; }
  assert.equal(paren, 0, `${label}: unbalanced parentheses`);
}
const fields = { ...liveFIELDS }; for (const name of A.asyncFunctionFields) if (!(name in fields)) fields[name] = Object.keys(fields).length;
const fragments = {
  functions: A.asyncFunctionWGSLFunctions({ L: LIMITS }), gc: A.asyncFunctionGCWGSL, call: A.asyncFunctionCallWGSL, enter: A.asyncFunctionEnterWGSL,
  closure: A.asyncFunctionClosureWGSL, init: A.asyncFunctionInitWGSL({ F: fields }), property: A.asyncFunctionPropertyWGSL({ F: fields }),
  dispatch: A.asyncFunctionDispatchWGSL({ F: fields }), ...Object.fromEntries(Object.entries(A.asyncFunctionWGSLCases()).map(([k, v]) => ['case ' + k, `{${v}}`])),
};
for (const [label, text] of Object.entries(fragments)) lint(text, label);
report.wgslFragmentsLinted = Object.keys(fragments).length;

// ---- 4. anchors ----------------------------------------------------------------
// phase4-global.js / phase4-fixed-nodes.js are included only because other
// workers' edits (step 6) touch them; worker 5 edits none of them.
const names = ['program.js', 'phase4-registry.js', 'phase4-class-elements.js', 'shader.js', 'phase4-classes.js', 'bootstrap.js', 'phase4-global.js', 'phase4-fixed-nodes.js', 'phase4-iteration.js'];
const ownFiles = new Set(['program.js', 'phase4-registry.js', 'phase4-class-elements.js', 'shader.js', 'bootstrap.js']);
const live = Object.fromEntries(names.map(n => [n, readFileSync(join(root, n), 'utf8')]));
const postGenerator = generatorIntegrationPatch(live, { iteratorPrototypeNode: 77 });
const count = (s, a) => s.split(a).length - 1;
for (const e of A.asyncFunctionIntegrationEdits) {
  assert.ok(ownFiles.has(e.file) && ['before', 'after', 'replace'].includes(e.position) && typeof e.text === 'string' && e.why, `edit shape ${e.anchor}`);
  assert.equal(count(postGenerator[e.file], e.anchor), 1, `anchor must match exactly once in post-generator ${e.file}: ${JSON.stringify(e.anchor.slice(0, 80))}`);
}
function applyEdits(files, edits, label) {
  const out = { ...files };
  for (const e of edits) {
    const s = out[e.file];
    if (typeof s !== 'string' || count(s, e.anchor) !== 1) throw new Error(`${label}: anchor drift ${e.file}: ${e.anchor.slice(0, 90)}`);
    const at = s.indexOf(e.anchor);
    out[e.file] = e.position === 'before' ? s.slice(0, at) + e.text + s.slice(at)
      : e.position === 'after' ? s.slice(0, at + e.anchor.length) + e.text + s.slice(at + e.anchor.length)
      : s.slice(0, at) + e.text + s.slice(at + e.anchor.length);
  }
  return out;
}
report.anchorsUnique = A.asyncFunctionIntegrationEdits.length;

// ---- 5. isolated preview -------------------------------------------------------
const WGSL_STUBS = {
  promiseAllocate: 'fn promiseAllocate(l:u32,proto:u32)->u32 {let object=alloc(l,2u,V(proto,0u,0u,1u),0u,0u);return object;}',
  promiseHeaderOf: 'fn promiseHeaderOf(l:u32,v:V)->u32 {return 0u;}',
  promiseSettleHeader: 'fn promiseSettleHeader(l:u32,header:u32,state:u32,value:V) {states[l].status=6u;}',
  promiseMatchingReactions: 'fn promiseMatchingReactions(l:u32,header:u32,state:u32)->u32 {return 0u;}',
};
async function preview(files, label, { stubNames = {} } = {}) {
  const directory = mkdtempSync(join(root, '.async-function-preview-'));
  try {
    const patched = { ...files };
    if (Object.keys(stubNames).length) {
      // PREVIEW-ONLY STUB: private names owned by other workers that are not yet
      // integrated, so the helper sources pack. Calls to them would hit status 6.
      patched['bootstrap.js'] = patched['bootstrap.js'].replace('  ...phase3BigintConversionIntrinsics,\n});',
        `  ...phase3BigintConversionIntrinsics,\n  /* PREVIEW-ONLY STUB (worker-5 check) */ ...${JSON.stringify(stubNames)},\n});`);
    }
    for (const name of names) {
      // Rewrite only real module specifiers (statement-initial import/export), not string literals.
      const code = patched[name].replace(/^((?:import|export)\b[^'"\n;]*?(?:from\s*)?)['"](\.\.?\/[^'"]+|acorn)['"]/gm, (m, prefix, spec) => {
        const rel = spec.slice(2), url = spec === 'acorn' ? import.meta.resolve('acorn') : pathToFileURL(join(names.includes(rel) ? directory : root, spec)).href;
        return prefix + JSON.stringify(url);
      });
      writeFileSync(join(directory, name), code);
    }
    const { bootstrapSources, attachBootstrap, privateBuiltins } = await import(pathToFileURL(join(directory, 'bootstrap.js')));
    const P = await import(pathToFileURL(join(directory, 'program.js'))), S = await import(pathToFileURL(join(directory, 'shader.js')));
    for (const [n, id] of Object.entries(liveOP)) assert.equal(P.OP[n], id, `${label}: ${n} opcode stable`);
    for (const [n, id] of Object.entries(liveFIELDS)) assert.equal(P.FIELDS[n], id, `${label}: ${n} field stable`);
    assert.ok('await' in P.OP && 'return_async' in P.OP, `${label}: await/return_async opcodes`);
    for (const n of A.asyncFunctionFields) assert.ok(n in P.FIELDS, `${label}: FIELDS ${n}`);
    for (const fn of ['asyncEnter', 'asyncAwait', 'asyncResume', 'asyncReturn', 'asyncReplaceFrame', 'asyncUnwindBoundary', 'asyncRaiseBoundary', 'asyncRejectDispatch', 'asyncActive', 'asyncClose', 'asyncFunction'])
      assert.equal(count(S.shader, `fn ${fn}(`), 1, `${label}: ${fn} registered once`);
    assert.equal(count(S.shader, 'asyncRejectDispatch(l);'), 2, `${label}: two main() status-11 dispatch points`);
    const missingWGSL = Object.keys(WGSL_STUBS).filter(n => !S.shader.includes(`fn ${n}(`));
    const wgsl = S.shader + '\n// PREVIEW-ONLY STUBS (worker-5 check)\n' + missingWGSL.map(n => WGSL_STUBS[n]).join('\n');
    lint(wgsl.replace(/\/\*[\s\S]*?\*\//g, ''), `${label} shader`);
    const functions = new Map(), clean = wgsl.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    for (const m of clean.matchAll(/\bfn\s+(\w+)\s*\(/g)) {
      let start = clean.indexOf('{', m.index), end = start + 1, depth = 1;
      while (depth && end < clean.length) { if (clean[end] === '{') depth++; else if (clean[end] === '}') depth--; end++; }
      assert.equal(depth, 0, m[1]); functions.set(m[1], clean.slice(start + 1, end - 1));
    }
    const calledUndefined = new Set();
    for (const n of ['asyncEnter', 'asyncAwait', 'asyncResume', 'asyncReturn', 'asyncReplaceFrame', 'asyncRaiseBoundary', 'asyncRejectDispatch'])
      for (const m of functions.get(n).matchAll(/\b([a-z]\w*)\s*\(/g)) if (!functions.has(m[1]) && !['select', 'min', 'max', 'V', 'Frame', 'Node', 'Pair', 'u32', 'vec4', 'array', 'if', 'for', 'while', 'return'].includes(m[1])) calledUndefined.add(m[1]);
    assert.deepEqual([...calledUndefined], [], `${label}: worker-5 WGSL calls undefined functions`);
    const active = [], done = new Set();
    const visit = name => { assert.ok(!active.includes(name), `${label}: WGSL recursion ${[...active, name].join(' -> ')}`); if (done.has(name)) return; active.push(name); for (const m of functions.get(name).matchAll(/\b(\w+)\s*\(/g)) if (functions.has(m[1])) visit(m[1]); active.pop(); done.add(name); };
    for (const name of functions.keys()) visit(name);
    // Missing private names referenced by worker-5 helpers.
    const missingNames = Object.keys(A.asyncFunctionDependencies).filter(n => !Object.hasOwn(privateBuiltins, n));
    const result = { label, wgslFunctions: functions.size, acyclic: true, wgslStubs: missingWGSL, missingPrivateNames: missingNames, packed: 0, packFailures: [] };
    const bootNative = {}, bootWasm = {};
    for (const [k, s] of Object.entries(bootstrapSources)) { bootNative[k] = native(s); bootWasm[k] = wasm(s); }
    for (const c of asyncFunctionCases) {
      try {
        const a = P.packProgram(attachBootstrap(native(c.source), bootNative), P.entrySource(c.source));
        const b = P.packProgram(attachBootstrap(wasm(c.source), bootWasm), P.entrySource(c.source));
        assert.deepEqual(a.code, b.code, c.feature); assert.deepEqual(a.image, b.image, c.feature);
        // Every kind-2 function must carry bit 19 (and not bit 18) in its info word.
        const raw = a.raw.functions;
        raw.forEach((fn, i) => { const w = a.image[i * 8 + 3]; if (fn.kind === 2) assert.equal(w & 0xc0000, 0x80000, `${c.feature}: async info bit`); else assert.equal(w & 0x80000, 0, `${c.feature}: non-async info bit`); });
        result.packed++;
      } catch (error) { result.packFailures.push(`${c.feature}: ${error.message.split('\n')[0]}`); }
    }
    return result;
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
const ours = applyEdits(postGenerator, A.asyncFunctionIntegrationEdits, 'worker-5');
assert.ok(ours['program.js'].includes('fn.kind !== 2 && fn.kind !== 1))'));
const pure = await preview(ours, 'generator+worker5');
let stubbed = null;
if (pure.packFailures.length) {
  const stubNames = Object.fromEntries(pure.missingPrivateNames.map(n => [n, A.asyncFunctionDependencies[n].id]));
  stubbed = await preview(ours, 'generator+worker5+PREVIEW-STUBS', { stubNames });
  assert.deepEqual(stubbed.packFailures, [], 'all fixtures must pack once only other-worker helper names are stubbed');
  assert.equal(stubbed.packed, asyncFunctionCases.length);
}
const brief = r => r && ({ ...r, packFailureCount: r.packFailures.length, packFailures: [...new Set(r.packFailures.map(f => f.replace(/^[^:]*: /, '')))] });
report.preview = { pure: brief(pure), stubbed: brief(stubbed) };

// ---- 6. optional composition with other workers' exported edits ----------------
// Report-only: other workers' files are in flux; failures here are listed, not asserted.
const others = [['promise-core-source.js', 'promiseCoreIntegrationEdits'], ['promise-resolve-source.js', 'promiseResolveIntegrationEdits'], ['promise-then-source.js', 'promiseThenIntegrationEdits'],
  ['promise-combinators-source.js', 'promiseCombinatorsIntegrationEdits'], ['async-generator-source.js', 'asyncGeneratorIntegrationEdits'], ['promise-jobs-source.js', 'promiseJobsIntegrationEdits'], ['async-iteration-source.js', 'asyncIterationIntegrationEdits']];
const otherEdits = [], composition = { available: [], absent: [] };
for (const [file, exportName] of others) {
  if (!existsSync(join(root, file))) { composition.absent.push(file); continue; }
  try {
    const edits = (await import(pathToFileURL(join(root, file))))[exportName];
    if (Array.isArray(edits)) { otherEdits.push([file, edits]); composition.available.push(file); } else composition.absent.push(`${file} (no ${exportName})`);
  } catch (error) { composition.absent.push(`${file}: ${error.message.split('\n')[0]}`); }
}
for (const order of ['worker5-last', 'worker5-first']) {
  const sequence = order === 'worker5-first' ? [['worker-5', A.asyncFunctionIntegrationEdits], ...otherEdits] : [...otherEdits, ['worker-5', A.asyncFunctionIntegrationEdits]];
  let files = { ...postGenerator }; const applied = [], failed = [];
  for (const [label, edits] of sequence) {
    try { files = applyEdits(files, edits, label); applied.push(label); } catch (error) { failed.push(error.message.split('\n')[0]); }
  }
  const entry = { applied, failed };
  if (applied.includes('worker-5')) {
    try { const r = await preview(files, `composition ${order}`); entry.packed = r.packed; entry.packFailures = [...new Set(r.packFailures.map(f => f.replace(/^[^:]*: /, '')))]; entry.packFailureCount = r.packFailures.length; entry.wgslStubs = r.wgslStubs; entry.acyclicWGSLFunctions = r.wgslFunctions; }
    catch (error) { entry.previewError = error.message.split('\n')[0]; }
  }
  composition[order] = entry;
}
report.crossWorkerComposition = composition;

console.log(JSON.stringify({ ...report, liveCoreModified: false, gpuExecuted: false }, null, 1));
