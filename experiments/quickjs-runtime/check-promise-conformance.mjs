// Worker 8 host-only evidence for the Promise + async wave. Never touches a GPU.
//  1. fixture metadata invariants (promise-conformance-cases.js)
//  2. native oracle: every fixture runs in a fresh node:vm realm; the returned
//     promise is awaited and its settlement/value compared with Object.is
//  3. native/Wasm QuickJS bytecode parity (atom operands normalized exactly
//     like check-generators.mjs) and async function kinds (2 async, 3 async
//     generator) matching the acorn parse of every fixture
//  4. cross-check of other workers' *-cases.js modules (if present) with the
//     same oracle; disagreements are reported, never edited.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse } from 'acorn';
import createModule from './generated/compiler.mjs';
import { promiseConformanceCases, promiseConformanceCategories } from './promise-conformance-cases.js';
import { promiseSuite, optionalCaseModules, normalizeCase } from './promise-gpu-suite.js';

const here = new URL('.', import.meta.url);
// Guest-level unhandled rejections are part of the fixtures (they must never
// surface as host errors on the GPU either); count them instead of crashing.
let hostUnhandledRejections = 0;
process.on('unhandledRejection', () => { hostUnhandledRejections++; });
const show = v => (Object.is(v, -0) ? '-0' : typeof v === 'string' ? JSON.stringify(v) : typeof v === 'bigint' ? `${v}n` : String(v));
const failures = [];
const fail = (where, message) => failures.push(`${where}: ${message}`);

// ---- 1. metadata invariants --------------------------------------------------------
const cases = promiseConformanceCases;
{
  const seen = new Set();
  for (const c of cases) {
    if (seen.has(c.feature)) fail(c.feature, 'duplicate feature'); seen.add(c.feature);
    if (!promiseConformanceCategories.includes(c.category)) fail(c.feature, `unknown category ${c.category}`);
    if (typeof c.input !== 'number' || !Number.isFinite(c.input)) fail(c.feature, 'input must be a finite number');
    if (!c.source.startsWith('function f(x){') || !c.source.endsWith('}')) fail(c.feature, 'source must be function f(x){...}');
    if (![undefined, 'fulfilled', 'rejected', 'pending'].includes(c.settlement)) fail(c.feature, `bad settlement ${c.settlement}`);
    if (c.settlement === 'pending' && (c.expected !== undefined || c.expectedNext !== undefined)) fail(c.feature, 'pending fixtures expect undefined');
    for (const v of [c.expected, c.expectedNext]) if ((typeof v === 'object' && v !== null) || typeof v === 'symbol' || typeof v === 'function') fail(c.feature, 'expected values must be GPU-decodable primitives');
    if (c.resource !== undefined && (!['heap', 'frames', 'stack'].includes(c.resource) || c.expectedStatus !== 3)) fail(c.feature, 'resource fixtures need resource heap|frames|stack and expectedStatus 3');
    if ((c.category === 'resource') !== (c.resource !== undefined)) fail(c.feature, 'resource marker/category mismatch');
    if (c.gc && c.resource) fail(c.feature, 'gc and resource are exclusive');
    if (c.promiseOnly !== !/\basync\b|\bawait\b/.test(c.source)) fail(c.feature, 'promiseOnly marker inconsistent');
  }
}
const counts = {
  total: cases.length,
  byCategory: Object.fromEntries(promiseConformanceCategories.map(k => [k, cases.filter(c => c.category === k).length])),
  gc: cases.filter(c => c.gc).length, resumption: cases.filter(c => c.resumption).length,
  resource: cases.filter(c => c.resource).length, promiseOnly: cases.filter(c => c.promiseOnly).length,
  settlement: Object.fromEntries(['fulfilled', 'rejected', 'pending', 'sync'].map(s => [s, cases.filter(c => (c.settlement ?? 'sync') === s).length])),
};
if (counts.total < 60) fail('metadata', `need >= 60 fixtures, have ${counts.total}`);
if (counts.gc < 6) fail('metadata', `need >= 6 gc fixtures, have ${counts.gc}`);
if (counts.resumption < 5) fail('metadata', `need >= 5 resumption fixtures, have ${counts.resumption}`);

// ---- 2. native oracle -----------------------------------------------------------------
const isThenable = v => (typeof v === 'object' || typeof v === 'function') && v !== null && typeof v.then === 'function';
async function oracle(source, input) {
  let value;
  try { value = vm.runInNewContext(`${source};f(${typeof input === 'string' ? JSON.stringify(input) : typeof input === 'bigint' ? input + 'n' : show(input)})`, {}, { timeout: 10000 }); }
  catch (e) { return { settlement: 'sync-throw', value: `${e?.name}: ${e?.message}` }; }
  if (!isThenable(value)) return { settlement: undefined, value };
  // node:vm realms share the host microtask queue: every guest job has run by the
  // time a host timer fires, so 'pending' means "never settles with an empty queue".
  return Promise.race([
    Promise.resolve(value).then(v => ({ settlement: 'fulfilled', value: v }), e => ({ settlement: 'rejected', value: e })),
    new Promise(r => setTimeout(() => r({ settlement: 'pending', value: undefined }), 25)),
  ]);
}
let nativeChecks = 0;
for (const c of cases) {
  for (const [x, expected] of [[c.input, c.expected], [c.input + 1, c.expectedNext]]) {
    const got = await oracle(c.source, x);
    if (got.settlement !== c.settlement) fail(c.feature, `input ${x}: native settlement ${got.settlement} (${show(got.value)}), fixture ${c.settlement}`);
    else if (!Object.is(got.value, expected)) fail(c.feature, `input ${x}: native ${show(got.value)}, fixture ${show(expected)}`);
    else nativeChecks++;
  }
}

// ---- 3. compiler parity + async kinds -----------------------------------------------------
const module = await createModule();
const binary = fileURLToPath(new URL('./generated/compiler', import.meta.url));
const normalize = r => ({ ...r, functions: r.functions.map(f => ({ ...f, instructions: f.instructions.map(i => typeof i.operand === 'string' ? { ...i, bytes: i.bytes.map((b, n) => n >= 1 && n <= 4 ? 0 : b) } : i) })) });
function expectedKinds(source) {
  const kinds = { 1: 0, 2: 0, 3: 0 };
  const walk = node => {
    if (!node || typeof node.type !== 'string') return;
    if (/Function/.test(node.type)) { const k = (node.async ? 2 : 0) | (node.generator ? 1 : 0); if (k) kinds[k]++; }
    for (const key of Object.keys(node)) { const v = node[key]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') walk(v); }
  };
  walk(parse(source, { ecmaVersion: 2025 }));
  return kinds;
}
let parity = 0, nativeCompilerAvailable = true, nativeCompilerError;
const asyncOps = new Set();
for (const c of cases) {
  let wasm;
  try { wasm = JSON.parse(module.ccall('lanes_compile', 'string', ['string'], [c.source])); }
  catch (e) { fail(c.feature, `Wasm compile failed: ${e.message}`); continue; }
  if (wasm.error) { fail(c.feature, `Wasm compile error ${wasm.error}`); continue; }
  const want = expectedKinds(c.source), have = { 1: 0, 2: 0, 3: 0 };
  for (const f of wasm.functions) if (have[f.kind] !== undefined) have[f.kind]++;
  for (const k of [1, 2, 3]) if (want[k] !== have[k]) fail(c.feature, `kind ${k}: acorn ${want[k]}, QuickJS ${have[k]}`);
  for (const f of wasm.functions) if (f.kind >= 2) for (const i of f.instructions) {
    asyncOps.add(i.op);
    if (['tail_call', 'tail_call_method'].includes(i.op)) fail(c.feature, `kind ${f.kind} function ${f.name || '<anon>'} uses ${i.op}; async completion hook would be skipped`);
  }
  if (nativeCompilerAvailable) {
    try {
      const native = JSON.parse(execFileSync(binary, [c.source], { encoding: 'utf8', maxBuffer: 1 << 26 }));
      try { assert.deepEqual(normalize(wasm), normalize(native)); parity++; } catch { fail(c.feature, 'native/Wasm normalized bytecode differ'); }
    } catch (e) { nativeCompilerAvailable = false; nativeCompilerError = e.message.split('\n')[0]; }
  }
}
if (!nativeCompilerAvailable) fail('compiler', `native compiler unavailable (${nativeCompilerError}); parity NOT established`);
for (const op of ['await', 'return_async', 'for_await_of_start', 'async_yield_star']) if (!asyncOps.has(op)) fail('coverage', `no fixture compiles to ${op} inside a kind 2/3 function`);

// ---- 4. cross-check other workers' fixtures --------------------------------------------------
const OTHER = /^(promise-core|promise-resolve|promise-then|promise-combinators|async-function|async-generator|promise-jobs|async-iteration)-.*cases.*\.js$/;
const crossCheck = { modules: [], records: 0, checked: 0, skipped: 0, agreements: 0, disagreements: [] };
for (const file of readdirSync(here).filter(n => OTHER.test(n)).sort()) {
  let mod;
  try { mod = await import(pathToFileURL(fileURLToPath(new URL(file, here)))); }
  catch (e) { crossCheck.modules.push({ file, error: `import failed: ${e.message.split('\n')[0]}` }); continue; }
  const entry = { file, exports: [], records: 0 };
  for (const [name, value] of Object.entries(mod)) {
    if (!Array.isArray(value) || !value.some(r => r && typeof r.source === 'string')) continue;
    entry.exports.push(name);
    for (const r of value) {
      if (!r || typeof r.source !== 'string') continue;
      entry.records++; crossCheck.records++;
      const id = `${file}:${name}:${r.feature || r.name || r.id || '?'}`;
      const inputs = Array.isArray(r.inputs) ? r.inputs : 'input' in r ? [r.input, ...('expectedNext' in r ? [r.input + 1] : [])] : null;
      const expected = Array.isArray(r.inputs) ? r.expected : 'expected' in r ? [r.expected, ...('expectedNext' in r ? [r.expectedNext] : [])] : undefined;
      if (!inputs || !Array.isArray(expected) || expected.length !== inputs.length || r.unsupported || r.status !== undefined) { crossCheck.skipped++; continue; }
      for (let i = 0; i < inputs.length; i++) {
        let got;
        try { got = await oracle(r.source, inputs[i]); } catch (e) { got = { settlement: 'oracle-error', value: e.message }; }
        crossCheck.checked++;
        const settlement = r.settlement ?? r.expectedSettlement;
        const settleOk = settlement === undefined ? true : got.settlement === settlement;
        if (settleOk && Object.is(got.value, expected[i])) crossCheck.agreements++;
        else crossCheck.disagreements.push({ id, input: show(inputs[i]), fixture: `${settlement ?? '?'} ${show(expected[i])}`, native: `${got.settlement} ${show(got.value)}` });
      }
    }
  }
  crossCheck.modules.push(entry);
}

// ---- 5. browser suite description (static; the page itself is never run here) -------------
const suite = { records: promiseSuite.records.length, resumption: promiseSuite.resumption.length, coreOnly: promiseSuite.records.filter(r => r.promiseOnly).length, optionalModulesNormalized: 0 };
if (suite.records !== cases.length) fail('suite', 'promise-gpu-suite.js does not expose every conformance fixture');
for (const path of optionalCaseModules) {
  let mod; try { mod = await import(new URL(path, import.meta.url)); } catch { continue; }
  for (const [name, value] of Object.entries(mod)) if (Array.isArray(value)) for (const item of value) if (item && typeof item.source === 'string') {
    try { normalizeCase(item, path, /Boundary/.test(name)); suite.optionalModulesNormalized++; } catch (e) { fail('suite', e.message); }
  }
}

const report = {
  browserSuite: suite,
  counts, nativeChecks, hostUnhandledRejectionsObserved: hostUnhandledRejections, nativeWasmParityPrograms: parity, nativeCompilerAvailable,
  asyncOpcodesObserved: [...asyncOps].filter(op => /async|await/.test(op)).sort(),
  crossCheck: { ...crossCheck, modulesFound: crossCheck.modules.length },
  gpuExecuted: false, coreIntegrated: false,
  failures,
};
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
