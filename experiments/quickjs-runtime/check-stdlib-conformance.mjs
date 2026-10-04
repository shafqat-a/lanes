// Host-only checks for worker 8's stdlib fixtures (no GPU, no WebGPU):
//  1. fixture shape (one named sync function, primitive inputs, unique ids, ≥80 records),
//  2. QuickJS parse/compile parity: native generated/compiler vs Wasm generated/compiler.mjs
//     produce identical raw instruction streams for every source,
//  3. native V8 expectations for every case/GC probe/resumption/boundary source,
//  4. every `expected` override carries a spec note AND V8 actually disagrees (otherwise
//     the override is unnecessary and the native oracle must be used),
//  5. integrated packing through createCompiler() (reported as pending while the
//     parent has not wired the Map/Set/isNaN globals).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
import { stdlibConformanceCases, stdlibConformanceUnsupported } from './stdlib-conformance-cases.js';
import { stdlibGCCases, stdlibResumptionSources } from './stdlib-gc-cases.js';
import { createCompiler } from './compiler.js';
import { attachBootstrap, bootstrapSources } from './bootstrap.js';
import { packProgram, entrySource } from './program.js';

const GROUPS = new Set(['map', 'set', 'iterator', 'reflect', 'numeric', 'cross']);
const FN = /^function f\(x\)\{[\s\S]*\}$/;
const primitive = v => v === null || ['undefined', 'number', 'string', 'boolean'].includes(typeof v);
const run = (source, input) => new Script('(' + source + ')').runInNewContext()(input);
const show = v => (Object.is(v, -0) ? '-0' : JSON.stringify(v) ?? String(v));

// 1. Shape.
const ids = new Set();
const unique = id => { assert.ok(id && !ids.has(id), `duplicate or missing id ${id}`); ids.add(id); };
for (const c of stdlibConformanceCases) {
  unique(c.id);
  assert.ok(GROUPS.has(c.group), `${c.id}: group`);
  assert.match(c.source, FN, `${c.id}: one named sync function f(x)`);
  assert.ok(Array.isArray(c.inputs) && c.inputs.length > 0 && c.inputs.every(primitive), `${c.id}: primitive inputs`);
  assert.ok(c.inputs.every(x => typeof x !== 'string' || x.length <= 256), `${c.id}: GPU string input limit`);
  if (c.expected !== undefined) {
    assert.ok(Array.isArray(c.expected) && c.expected.length === c.inputs.length && c.expected.every(primitive), `${c.id}: expected shape`);
    assert.ok(typeof c.specNote === 'string' && /ES2025/.test(c.specNote), `${c.id}: expected override needs an ES2025 spec note`);
  }
  if (c.orderSensitive) assert.ok(c.expected && c.specNote, `${c.id}: orderSensitive requires expected + specNote`);
  if (c.requires) assert.ok(Array.isArray(c.requires) && c.requires.every(r => typeof r === 'string'), `${c.id}: requires`);
}
for (const g of stdlibGCCases) { unique(g.id); assert.ok(g.requiredGC && (/churn\(\d+\)/.test(g.source) || Number(/i<(\d+)/.exec(g.source)?.[1]) >= 1500), `${g.id}: must force a collection (churn or ≥1500 allocation rounds)`); assert.match(g.source, FN); }
for (const r of stdlibResumptionSources) { unique(r.id); assert.match(r.source, FN); assert.ok(primitive(r.input) && primitive(r.expected)); }
for (const u of stdlibConformanceUnsupported) { unique(u.id); assert.match(u.source, FN); assert.ok(u.reason, `${u.id}: reason`); }
assert.ok(stdlibConformanceCases.length >= 80, `need ≥80 conformance records, have ${stdlibConformanceCases.length}`);

// 2. Native vs Wasm QuickJS compile parity (raw instruction streams).
const nativePath = fileURLToPath(new URL('./generated/compiler', import.meta.url));
const { default: create } = await import('./generated/compiler.mjs');
const wasm = await create();
// Atom-indexed instructions carry runtime-allocated atom numbers in `bytes`
// (they differ between the two QuickJS builds' atom tables); for those the
// decoded atom text (`operand`) is compared instead of the raw bytes.
const streams = raw => raw.functions.map(f => ({ name: f.name, args: f.args, length: f.length, locals: f.locals, stack: f.stack, strict: f.strict, kind: f.kind, refs: f.refs, constants: f.constants,
  code: f.instructions.map(i => [i.pc, i.op, i.size, i.pop, i.push, i.operand, ...(typeof i.operand === 'string' ? [] : i.bytes)]) }));
const allSources = [
  ...stdlibConformanceCases.map(c => [c.id, c.source]), ...stdlibGCCases.map(c => [c.id, c.source]),
  ...stdlibResumptionSources.map(c => [c.id, c.source]), ...stdlibConformanceUnsupported.map(c => [c.id, c.source]),
];
let compileParity = 0, instructions = 0;
for (const [id, source] of allSources) {
  const a = JSON.parse(execFileSync(nativePath, [source], { encoding: 'utf8' }));
  const b = JSON.parse(wasm.ccall('lanes_compile', 'string', ['string'], [source]));
  assert.ok(!a.error && !b.error, `${id}: QuickJS rejected the source: ${a.error || b.error}`);
  assert.deepEqual(streams(b), streams(a), `${id}: native/Wasm instruction streams differ`);
  compileParity++; instructions += a.functions.reduce((n, f) => n + f.instructions.length, 0);
}

// 3./4. Native V8 expectations and override justification.
let nativeValues = 0; const overrides = [], v8Agreeing = [];
const groupCounts = {};
for (const c of stdlibConformanceCases) {
  groupCounts[c.group] = (groupCounts[c.group] || 0) + 1;
  c.inputs.forEach((input, i) => {
    let value, error;
    try { value = run(c.source, input); } catch (e) { error = e; }
    if (c.expected === undefined) {
      assert.ok(!error, `${c.id}(${show(input)}): native threw ${error}`);
      assert.ok(primitive(value), `${c.id}(${show(input)}): non-primitive result cannot cross the GPU boundary`);
      nativeValues++;
      return;
    }
    const disagrees = !!error || !Object.is(value, c.expected[i]);
    if (disagrees) overrides.push({ id: c.id, input: show(input), es2025: show(c.expected[i]), v8: error ? String(error) : show(value), orderSensitive: !!c.orderSensitive });
    else v8Agreeing.push(`${c.id}(${show(input)})`);
  });
}
// An override is justified only when V8 disagrees with ES2025 (or lacks the feature).
assert.deepEqual(v8Agreeing, [], `expected overrides where V8 already agrees (use the native oracle instead): ${v8Agreeing.join(', ')}`);
let gcNative = 0;
for (const g of stdlibGCCases) for (const input of g.inputs) { const v = run(g.source, input); assert.ok(primitive(v), g.id); gcNative++; }
for (const r of stdlibResumptionSources) assert.ok(Object.is(run(r.source, r.input), r.expected), `${r.id}: resumption expectation drifted (native ${show(run(r.source, r.input))})`);
let boundarySpecValues = 0;
for (const u of stdlibConformanceUnsupported) if (u.specExpected !== undefined) { assert.ok(Object.is(run(u.source, u.input), u.specExpected), `${u.id}: specExpected`); boundarySpecValues++; }

// 5. Integrated packing (bootstrap + globals). Pending until the parent registry lands.
// When a source packs, the Wasm-integrated program must equal native QuickJS
// output packed with natively compiled bootstrap helpers (check-math-phase5.mjs pattern).
const compiler = await createCompiler();
let integrated = 0, integratedParity = 0; const pending = {};
let bootstraps;
for (const [id, source] of allSources) {
  let actual;
  try { actual = compiler.compile(source); integrated++; }
  catch (e) {
    if (!/Unsupported/.test(e.message)) throw new Error(`${id}: unexpected integrated compile error: ${e.message}`);
    const key = e.message.replace(/\s+/g, ' ').slice(0, 90); pending[key] = (pending[key] || 0) + 1;
    continue;
  }
  bootstraps ||= Object.fromEntries(Object.entries(bootstrapSources).map(([field, s]) => [field, JSON.parse(execFileSync(nativePath, [s], { encoding: 'utf8' }))]));
  const expected = packProgram(attachBootstrap(JSON.parse(execFileSync(nativePath, [source], { encoding: 'utf8' })), bootstraps), entrySource(source));
  assert.deepEqual(actual.code, expected.code, `${id}: integrated code differs from native packing`);
  assert.deepEqual(actual.image, expected.image, `${id}: integrated image differs from native packing`);
  integratedParity++;
}

console.log(JSON.stringify({
  conformanceCases: stdlibConformanceCases.length, groupCounts, nativeValues,
  overrides: overrides.length, overrideDetails: overrides,
  gcProbes: stdlibGCCases.length, gcNativeValues: gcNative,
  resumptionSources: stdlibResumptionSources.length,
  unsupportedSources: stdlibConformanceUnsupported.length, boundarySpecValues,
  compileParity, rawInstructions: instructions,
  integratedCompiled: integrated, integratedParity, integrationPending: Object.keys(pending).length > 0, integrationPendingReasons: pending,
  gpuChecks: false,
}, null, 1));
