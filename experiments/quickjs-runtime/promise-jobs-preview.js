// Worker 7 test support (host-only): isolated preview of the composed tree.
// Reads the live modules, applies generatorIntegrationPatch(live,
// {iteratorPrototypeNode:77}), then every Promise/async worker's exported
// integration edits that currently apply, then worker 7's edits, writes the
// result into a temp directory and imports it. The live tree is never written.
// The parent-owned FIXED_RESERVED_LAST 85 -> 105 change is applied to the
// preview copy only (contract precondition for nodes 90..105).
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { generatorIntegrationPatch } from './generator-integration-patch.js';
import { applyEdits, promiseJobsIntegrationEdits } from './promise-jobs-source.js';
import { asyncIterationIntegrationEdits } from './async-iteration-source.js';

export const root = fileURLToPath(new URL('.', import.meta.url));
export const PREVIEW_FILES = ['program.js', 'phase4-registry.js', 'phase4-class-elements.js', 'shader.js', 'phase4-classes.js', 'bootstrap.js', 'phase4-global.js', 'phase4-iteration.js', 'phase4-fixed-nodes.js'];
export const WORKER7_EDITS = Object.freeze({ jobs: promiseJobsIntegrationEdits, asyncIteration: asyncIterationIntegrationEdits });
// Other workers' modules and their exported edit lists (applied when present and applicable).
const OTHERS = [
  ['worker1', './promise-core-source.js', 'promiseCoreIntegrationEdits'],
  ['worker2', './promise-resolve-source.js', 'promiseResolveIntegrationEdits'],
  ['worker3', './promise-then-source.js', 'promiseThenIntegrationEdits'],
  ['worker4', './promise-combinators-source.js', 'promiseCombinatorsIntegrationEdits'],
  ['worker5', './async-function-source.js', 'asyncFunctionIntegrationEdits'],
  ['worker6', './async-generator-source.js', 'asyncGeneratorIntegrationEdits'],
];
const PARENT_FIXED = { file: 'phase4-fixed-nodes.js', anchor: 'export const FIXED_RESERVED_LAST = 85;', position: 'replace', text: 'export const FIXED_RESERVED_LAST = 105;' };

export function liveBase() {
  const live = Object.fromEntries(PREVIEW_FILES.map(n => [n, readFileSync(join(root, n), 'utf8')]));
  return generatorIntegrationPatch(live, { iteratorPrototypeNode: 77 });
}
export function anchorCounts(base, edits) {
  return edits.map(e => ({ file: e.file, anchor: e.anchor, count: base[e.file].split(e.anchor).length - 1, position: e.position }));
}
async function otherEdits() {
  const out = [];
  for (const [worker, path, name] of OTHERS) {
    try { const m = await import(path); if (Array.isArray(m[name])) out.push([worker, m[name]]); else out.push([worker, null, `${name} not exported`]); }
    catch (e) { out.push([worker, null, `module unavailable: ${e.message.split('\n')[0]}`]); }
  }
  return out;
}
// mode: 'withOthers' (default) or 'worker7Only'. order: 'othersFirst' | 'worker7First'.
export async function composePreview({ mode = 'withOthers', order = 'othersFirst' } = {}) {
  let files = applyEdits(liveBase(), [PARENT_FIXED], 'parent FIXED_RESERVED_LAST');
  const applied = [], skipped = [];
  const mine = () => { files = applyEdits(files, WORKER7_EDITS.jobs, 'worker7 jobs'); files = applyEdits(files, WORKER7_EDITS.asyncIteration, 'worker7 async iteration'); applied.push('worker7'); };
  if (order === 'worker7First') mine();
  if (mode === 'withOthers') for (const [worker, edits, why] of await otherEdits()) {
    if (!edits) { skipped.push(`${worker}: ${why}`); continue; }
    try { files = applyEdits(files, edits, worker); applied.push(worker); } catch (e) { skipped.push(`${worker}: ${e.message}`); }
  }
  if (order !== 'worker7First') mine();
  return { files, applied, skipped };
}
export async function importPreview(files) {
  const directory = mkdtempSync(join(tmpdir(), 'lanes-worker7-preview-'));
  try {
    for (const name of PREVIEW_FILES) {
      // Line-anchored: phase4-iteration.js holds import statements inside string literals.
      const code = files[name].replace(/^(import\s[^;\n]*?from\s*|import\s*)['"](\.\.?\/[^'"]+|acorn)['"]/gm, (match, prefix, specifier) => {
        const relative = specifier.slice(2), url = specifier === 'acorn' ? import.meta.resolve('acorn') : pathToFileURL(join(PREVIEW_FILES.includes(relative) ? directory : root, specifier)).href;
        return prefix + JSON.stringify(url);
      });
      writeFileSync(join(directory, name), code);
    }
    const B = await import(pathToFileURL(join(directory, 'bootstrap.js')));
    const P = await import(pathToFileURL(join(directory, 'program.js')));
    const S = await import(pathToFileURL(join(directory, 'shader.js')));
    const R = await import(pathToFileURL(join(directory, 'phase4-registry.js')));
    return { B, P, S, R };
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
// WGSL function table and recursion check (as check-generator-integration.mjs).
export function wgslFunctions(shader) {
  const functions = new Map(), clean = shader.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  for (const m of clean.matchAll(/\bfn\s+(\w+)\s*\(/g)) {
    let start = clean.indexOf('{', m.index), end = start + 1, depth = 1;
    while (depth && end < clean.length) { if (clean[end] === '{') depth++; else if (clean[end] === '}') depth--; end++; }
    if (depth !== 0) throw new Error(`unbalanced fn ${m[1]}`);
    if (functions.has(m[1])) throw new Error(`duplicate WGSL fn ${m[1]}`);
    functions.set(m[1], clean.slice(start + 1, end - 1));
  }
  const active = [], done = new Set();
  const visit = name => {
    if (active.includes(name)) throw new Error(`WGSL recursion: ${[...active, name].join(' -> ')}`);
    if (done.has(name)) return; active.push(name);
    for (const m of functions.get(name).matchAll(/\b(\w+)\s*\(/g)) if (functions.has(m[1])) visit(m[1]);
    active.pop(); done.add(name);
  };
  for (const name of functions.keys()) visit(name);
  return functions;
}
const BUILTIN_CALLS = new Set(['for', 'if', 'while', 'switch', 'return', 'V', 'Pair', 'Node', 'Frame', 'select', 'u32', 'i32', 'f32', 'bool', 'min', 'max', 'array', 'vec2', 'vec4', 'bitcast', 'abs', 'clamp', 'countLeadingZeros', 'firstLeadingBit', 'countOneBits', 'reverseBits', 'extractBits', 'insertBits', 'firstTrailingBit', 'countTrailingZeros', 'arrayLength']);
export function unresolvedCalls(functions, names) {
  const out = new Set();
  for (const name of names) for (const m of (functions.get(name) || '').matchAll(/\b(\w+)\s*\(/g)) if (!functions.has(m[1]) && !BUILTIN_CALLS.has(m[1])) out.add(m[1]);
  return [...out];
}
export const WGSL_RESERVED = new Set('NULL Self abstract active alignas alignof as asm asm_fragment async attribute auto await become binding_array cast catch class co_await co_return co_yield coherent column_major common compile compile_fragment concept const_cast consteval constexpr constinit crate debugger decltype delete demote demote_to_helper do dynamic_cast enum explicit export extends extern external fallthrough filter final finally friend from fxgroup get goto groupshared highp impl implements import inline instanceof interface layout lowp macro macro_rules match mediump meta mod module move mut mutable namespace new nil noexcept noinline nointerpolation noperspective null nullptr of operator package packoffset partition pass patch pixelfragment precise precision premerge priv protected pub public readonly ref regardless register reinterpret_cast require resource restrict self set shared sizeof smooth snorm static static_assert static_cast std subroutine super target template this thread_local throw trait try type typedef typeid typename typeof union unless unorm unsafe unsized use using varying virtual volatile wgsl where with writeonly yield'.split(' '));
export function lintWGSL(parts) {
  const problems = [];
  for (const [name, text] of Object.entries(parts)) {
    const code = text.replace(/\/\/[^\n]*/g, '');
    for (const m of code.matchAll(/\b(?:let|var|fn|const)\s+([A-Za-z_]\w*)/g)) if (WGSL_RESERVED.has(m[1])) problems.push(`${name}: reserved identifier ${m[1]}`);
    for (const m of code.matchAll(/[(,]\s*([A-Za-z_]\w*)\s*:\s*[A-Za-z]/g)) if (WGSL_RESERVED.has(m[1])) problems.push(`${name}: reserved parameter ${m[1]}`);
    for (const [open, close] of ['{}', '()', '[]']) if (code.split(open).length !== code.split(close).length) problems.push(`${name}: unbalanced ${open}${close}`);
    if (/\$\{|undefinedu|NaNu|\[object [A-Z]/.test(code)) problems.push(`${name}: unresolved template output`);
  }
  return problems;
}
// Host oracle with real job draining. Returns [settlement, value] where
// settlement is 'none' for a non-promise result and 'throw' for a sync throw.
export async function oracle(vm, source, x) {
  const context = vm.createContext({});
  let result;
  try { result = vm.runInContext(`${source};f(${x})`, context); } catch (e) { return ['throw', e]; }
  if (!(result instanceof vm.runInContext('Promise', context))) {
    for (let i = 0; i < 4; i++) await new Promise(r => setImmediate(r));
    return ['none', result];
  }
  let state = 'pending', value;
  result.then(v => { state = 'fulfilled'; value = v; }, e => { state = 'rejected'; value = e; });
  for (let i = 0; i < 20; i++) await new Promise(r => setImmediate(r));
  return [state, value];
}
