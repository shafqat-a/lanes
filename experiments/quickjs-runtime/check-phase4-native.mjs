// Phase 4 lead check (host only; no GPU, no guest execution on the host).
// 1. Every existing main-corpus program still packs with the patched native
//    compiler (generated/compiler rebuilt by `node build.mjs`).
// 2. Every Phase 4 case module's admitted programs only use opcodes with a
//    WGSL case, and expected rejections stay rejected. Formerly rejected
//    tagged templates (boxing/string-extract) are admitted and checked here.
// 3. V8 oracle confirms fixed expectations (test oracle only).
// Native/Wasm parity for the patched vendor sources is NOT checked here: the
// Wasm compiler must be rebuilt with Emscripten (see PHASE-4-STATUS.md).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
import { OP, entrySource, packProgram } from './program.js';
import { attachBootstrap, bootstrapSources } from './bootstrap.js';
import { phase4ShaderOps } from './shader.js';
import { sources, stringSources } from './cases.js';
import { phase4CaseGroups } from './phase4-case-groups.js';
import { boxingSources, boxingTaggedTemplateSources } from './boxing-cases.js';
import { stringExtractCases, stringExtractNegativeSources, stringExtractCompilerGapCases, stringExtractTaggedTemplateSources } from './string-extract-cases.js';

const nativePath = fileURLToPath(new URL('./generated/compiler', import.meta.url));
const raw = source => JSON.parse(execFileSync(nativePath, [source], { encoding: 'utf8', maxBuffer: 1 << 28 }));
const bootstraps = Object.fromEntries(Object.entries(bootstrapSources).map(([name, source]) => [name, raw(source)]));
for (const [name, b] of Object.entries(bootstraps)) assert.ok(!b.error, `bootstrap ${name}: ${b.error}`);
const pack = source => packProgram(attachBootstrap(raw(source), bootstraps), entrySource(source));
const opNames = Object.keys(OP);
const shaderText = readFileSync(new URL('./shader.js', import.meta.url), 'utf8');
const shaderOps = new Set([...shaderText.matchAll(/cases\('([^']+)'/g)].flatMap(m => m[1].split(' ')));
for (const m of shaderText.matchAll(/\[((?:'[a-z0-9_]+',?)+)\]\.map\(\(name/g)) for (const n of m[1].matchAll(/'([a-z0-9_]+)'/g)) shaderOps.add(n[1]);
for (const name of phase4ShaderOps) shaderOps.add(name);

const focused = [...boxingSources, ...stringExtractCases, ...stringExtractNegativeSources, ...stringExtractCompilerGapCases.map(item => item.source)];
// Formerly rejected tagged templates are admitted: they are part of the focused
// positive lists, so the corpus loop below packs them and checks WGSL coverage.
const taggedTemplatePrograms = [...boxingTaggedTemplateSources, ...stringExtractTaggedTemplateSources];
for (const source of taggedTemplatePrograms) assert.ok(focused.includes(source), `tagged template not in focused corpus: ${source}`);
let corpus = 0;
for (const source of [...sources, ...stringSources, ...focused]) {
  const { code } = pack(source);
  for (let i = 0; i < code.length; i += 4) assert.ok(shaderOps.has(opNames[code[i]]), `${opNames[code[i]]} lacks WGSL: ${source}`);
  corpus++;
}

const oracle = (source, input) => {
  try { return { value: new Script(`(${source})(${JSON.stringify(input)})`).runInNewContext({}, { timeout: 2000 }) }; }
  catch (error) { return { error: error?.name }; }
};
const groups = {};
for (const { area, admitted, rejected, pendingOps = [] } of phase4CaseGroups) {
  const summary = groups[area] = { admitted: 0, pending: 0, rejected: 0, oracle: 0, pendingFeatures: [], rejections: [] };
  for (const item of admitted) {
    if ('expected' in item && !item.requiresSymbol && item.runtime !== 'unsupported') {
      // `throws`: uncaught guest error of that constructor name (expected names it).
      // `v8Deviation`: documented V8 deviation from ES2025; V8 must produce exactly that value.
      const v8Expected = 'v8Deviation' in item ? item.v8Deviation : item.expected;
      assert.deepEqual(oracle(item.source, item.input), item.throws ? { error: v8Expected } : { value: v8Expected }, `${area}/${item.feature} oracle`);
      summary.oracle++;
    }
    let program;
    try { program = pack(item.source); }
    catch (error) {
      const op = /Unsupported QuickJS instruction: (\w+)/.exec(error.message)?.[1];
      if (!pendingOps.includes(op)) throw new Error(`${area}/${item.feature}: ${error.message}`);
      summary.pending++; summary.pendingFeatures.push(`${item.feature} (${op})`); continue;
    }
    const { code } = program;
    const ops = new Set();
    for (let i = 0; i < code.length; i += 4) ops.add(opNames[code[i]]);
    const missing = [...ops].filter(op => !shaderOps.has(op));
    assert.deepEqual(missing, [], `${area}/${item.feature} admitted without WGSL`);
    summary.admitted++;
  }
  for (const item of rejected) {
    assert.throws(() => pack(item.source), undefined, `${area}/${item.feature} must stay rejected`);
    let reason; try { pack(item.source); } catch (error) { reason = `${error.name}: ${error.message}`; }
    summary.rejected++; summary.rejections.push({ feature: item.feature, reason });
  }
}
console.log(JSON.stringify({ gpuChecks: false, guestExecution: false, nativeOnly: true, wasmParity: 'pending-emscripten-rebuild', corpusPrograms: corpus, taggedTemplatePrograms: taggedTemplatePrograms.length, groups }, null, 1));
