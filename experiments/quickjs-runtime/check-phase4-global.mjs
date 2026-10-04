// Phase 4 next wave, assignment 6: global object / sloppy global this
// (phase4-global.js, phase4-global-cases.js). Host only: no GPU, no CPU
// replay, no guest evaluation outside the oracles.
//  1. Every lead-file patch anchor occurs exactly once (or is already applied).
//  2. Private patched copies of program.js / shader.js / phase4-registry.js /
//     phase4-fixed-nodes.js (under .w6-build/) pack every admitted fixture in
//     the declared mode; every packed opcode has a WGSL case; rejected
//     fixtures stay rejected; the patched WGSL passes the static lint.
//  3. Oracles: V8 in a FRESH NODE REALM per run (vm.runInThisContext in a
//     child process: node:vm contexts have a non-ordinary global, e.g. global
//     function declarations become configurable) and a private native QuickJS
//     interpreter built from vendor/. input+1 must change every value.
//  4. Identity: every literal intrinsic program.js maps in classic mode is a
//     global binding with the same runtime value encoding.
//  5. Corpus: every existing fixture program packs bit-identically (code and
//     image) whenever the plan keeps it in classic mode (FIELDS append excluded).
// Usage: node experiments/quickjs-runtime/check-phase4-global.mjs [--keep] [--no-native] [--no-corpus] [--no-v8]
import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify, isDeepStrictEqual } from 'node:util';
import { attachBootstrap, bootstrapSources } from './bootstrap.js';
import { globalPatches, globalBindings, globalClassicIntrinsicNames, globalUnimplementedNames, globalOpcodeNames, globalProgramPlan, GLOBAL_MODE_BIT, GLOBAL_OBJECT_NODE } from './phase4-global.js';
import { globalCases, globalErrorCases, globalHostCases, globalV8DeviationCases, globalUnsupportedCases, globalRejectedCases, globalKnownDeviationCases } from './phase4-global-cases.js';

const run = promisify(execFile);
const root = fileURLToPath(new URL('.', import.meta.url));
const flag = name => process.argv.includes(name);
const keep = flag('--keep'), nativeRun = !flag('--no-native'), corpusRun = !flag('--no-corpus'), v8Run = !flag('--no-v8');
const count = (text, part) => text.split(part).length - 1;
const compiler = join(root, 'generated', 'compiler');
const rawCache = new Map();
const raw = source => {
  if (!rawCache.has(source)) rawCache.set(source, JSON.parse(execFileSync(compiler, [source], { encoding: 'utf8', maxBuffer: 1 << 28 })));
  return rawCache.get(source);
};
const boot = Object.fromEntries(Object.entries(bootstrapSources).map(([name, source]) => [name, raw(source)]));

mkdirSync(join(root, '.w6-build'), { recursive: true });
const build = mkdtempSync(join(root, '.w6-build', 'check-'));
const summary = { gpuChecks: false, guestExecution: 'oracles only (V8 child realm, native QuickJS)', anchors: {}, fixtures: {}, oracles: {}, corpus: {} };
try {
  // ---- 1. anchors ----------------------------------------------------------
  const leadFiles = [...new Set(globalPatches.map(p => p.file))];
  const original = Object.fromEntries(leadFiles.map(file => [file, readFileSync(join(root, file), 'utf8')]));
  const drift = [], applied = [];
  for (const p of globalPatches) {
    const text = original[p.file];
    if (count(text, p.replace) === 1) { applied.push(p.id); continue; }
    if (count(text, p.find) !== 1) drift.push(`${p.file}:${p.id} (find occurs ${count(text, p.find)}x)`);
  }
  assert.deepEqual(drift, [], `patch anchors drifted: ${drift.join('; ')}`);
  summary.anchors = { patches: globalPatches.length, alreadyApplied: applied, pending: globalPatches.length - applied.length };

  // ---- 2. private copies: patched, patched-without-FIELDS, baseline ----------
  const variant = (name, select) => {
    const dir = join(build, name); mkdirSync(dir);
    for (const file of leadFiles) {
      let text = original[file];
      for (const p of globalPatches.filter(p => p.file === file)) {
        const want = select(p), isApplied = applied.includes(p.id);
        if (want && !isApplied) text = text.replace(p.find, () => p.replace);
        if (!want && isApplied) text = text.replace(p.replace, () => p.find);
      }
      // Relative imports: lead files resolve to this variant, everything else to the original.
      text = text.replace(/(from\s+|import\s*\(\s*|import\s+)'(\.{1,2}\/[^']+)'/g, (m, head, spec) => {
        const target = new URL(spec, pathToFileURL(join(root, file)));
        const local = basename(fileURLToPath(target));
        return `${head}'${leadFiles.includes(local) && fileURLToPath(target) === join(root, local) ? `./${local}` : target.href}'`;
      });
      writeFileSync(join(dir, file), text);
    }
    return dir;
  };
  // --write-diffs: unified diffs of the pending edits (apply with
  // `patch -p0 -i phase4-patches/w6-global-<file>.diff` from experiments/quickjs-runtime).
  if (flag('--write-diffs')) {
    const plain = join(build, 'plain'); mkdirSync(plain);
    for (const file of leadFiles) {
      let text = original[file];
      for (const p of globalPatches.filter(p => p.file === file && !applied.includes(p.id))) text = text.replace(p.find, () => p.replace);
      writeFileSync(join(plain, file), text);
      let out = '';
      try { execFileSync('diff', ['-u', '--label', file, '--label', file, join(root, file), join(plain, file)], { encoding: 'utf8' }); }
      catch (e) { out = e.stdout; }
      if (out) writeFileSync(join(root, 'phase4-patches', `w6-global-${file.replace(/\.js$/, '')}.diff`), out);
    }
  }
  const patchedDir = variant('patched', () => true);
  const noFieldsDir = variant('nofields', p => !p.fields);
  const baselineDir = variant('baseline', () => false);
  const load = async (dir, file) => import(pathToFileURL(join(dir, file)).href);
  const P = await load(patchedDir, 'program.js');
  const S = await load(patchedDir, 'shader.js');
  const N = await load(noFieldsDir, 'program.js');
  const B = await load(baselineDir, 'program.js');
  for (const name of globalOpcodeNames) assert.ok(name in P.OP, `patched OP lacks ${name}`);
  const opNames = Object.keys(P.OP);
  if (keep) writeFileSync(join(build, 'patched-shader.wgsl'), S.shader);
  const wgslCases = new Set([...S.shader.matchAll(/case ((?:\d+u, )*\d+u):/g)].flatMap(m => m[1].split(', ').map(n => parseInt(n, 10))));
  const pack = (mod, source) => mod.packProgram(attachBootstrap(raw(source), boot), mod.entrySource(source));
  const planOf = source => globalProgramPlan(attachBootstrap(raw(source), boot), P.entrySource(source));

  // Patched WGSL: helpers, cases, hooks, static lint (not a WGSL compilation).
  for (const fn of ['globalMode', 'globalInit', 'globalEntryBinding', 'globalGap', 'globalHas']) assert.equal(count(S.shader, `fn ${fn}(`), 1, `WGSL fn ${fn}`);
  for (const name of globalOpcodeNames) assert.ok(wgslCases.has(P.OP[name]), `WGSL case ${name}`);
  for (const part of ['if(id==GLOBAL_OBJECT){return globalGap(l,key);}', 'if(globalMode()){globalInit(l);}', 'if(globalMode()){globalEntryBinding(l,fnValue);}',
    `if(spec.x==7u){continue;}`, 'else if((value.z==2u||value.z==3u)&&globalMode()){push(l,V(GLOBAL_OBJECT,0u,4u,0u));}',
    'if(object.z==4u&&object.x==GLOBAL_OBJECT&&!enumerableOnly)', 'if(property==0u&&obj.x==GLOBAL_OBJECT&&ownGap(l,obj.x,key)){return undef();}', `mark(l,${GLOBAL_OBJECT_NODE}u);`])
    assert.ok(S.shader.includes(part), `patched shader contains ${part}`);
  {
    const reserved = new Set('NULL Self abstract active alignas alignof as asm async attribute auto await become cast catch class const_cast consteval constexpr debugger decltype delete do enum explicit export extends extern external fallthrough filter final finally friend from get goto impl implements import inline instanceof interface layout macro match meta mod module move mut mutable namespace new nil noexcept null nullptr of operator package partition pass patch precise precision private protected pub public readonly ref register require resource restrict self set shared sizeof static super target template this throw trait try type typedef typeid typename typeof union unless unsafe unsized use using virtual volatile where with yield'.split(' '));
    const body = S.shader.replace(/\/\/[^\n]*/g, '');
    const problems = [];
    for (const [open, close] of ['{}', '()', '[]']) if (count(body, open) !== count(body, close)) problems.push(`unbalanced ${open}${close}`);
    for (const m of body.matchAll(/\b(?:let|var|fn|const)\s+([A-Za-z_]\w*)/g)) if (reserved.has(m[1])) problems.push(`reserved identifier ${m[1]}`);
    if (/\$\{|undefinedu|NaNu/.test(body)) problems.push('unresolved template output');
    if (!/@compute @workgroup_size\(\d+\)\s*fn main\(/.test(S.shader)) problems.push('@compute does not precede fn main');
    assert.deepEqual(problems, [], 'patched WGSL lint');
  }

  // ---- 4. identity with the classic literal table --------------------------
  const programText = original['program.js'];
  const scanned = new Set([...programText.matchAll(/ref\.name\s*===\s*'(\w+)'/g)].map(m => m[1]));
  for (const m of programText.matchAll(/\[((?:'\w+',?\s*)+)\]\.(?:indexOf|includes)\(ref\.name\)/g)) for (const n of m[1].matchAll(/'(\w+)'/g)) scanned.add(n[1]);
  assert.deepEqual([...scanned].sort(), [...globalClassicIntrinsicNames].sort(), 'program.js classic literal globals == globalClassicIntrinsicNames');
  const wordsOf = v => {
    if ('node' in v) return [v.node, 0, 4, 0];
    if ('builtin' in v) return [v.builtin, 0, 11, 0];
    if ('undefined' in v) return [0, 0x7ff80000, 3, 0];
    const a = new Uint32Array(2); new DataView(a.buffer).setFloat64(0, v.number, true); return [a[0], a[1], 0, 0];
  };
  for (const binding of globalBindings.filter(b => b.name !== 'globalThis')) {
    const source = `function f(){ return ${binding.name}; }`;
    const program = pack(B, source);
    assert.equal(program.image[3] & GLOBAL_MODE_BIT, 0, `${binding.name}: classic`);
    const refOffset = program.image[4], refs = raw(source).functions[0].refs;
    const i = refs.findIndex(r => r.name === binding.name);
    const spec = [...program.image.slice((refOffset + i) * 4, (refOffset + i) * 4 + 4)];
    const runtime = spec[0] === 4 ? [spec[1], 0, 11, 0] : spec[0] === 6 ? [spec[1], 0, 4, 0] : spec[0] === 5 ? [spec[1], spec[2], spec[3], 0] : null;
    assert.deepEqual(runtime, wordsOf(binding.value), `${binding.name}: global object value equals the classic capture`);
    // Global-object mode packs the same name as get_global <text>.
    const g = pack(P, `function f(){ w6 = 0; return ${binding.name}; }`);
    assert.notEqual(g.image[3] & GLOBAL_MODE_BIT, 0);
  }
  summary.identity = { bindings: globalBindings.length, classicNames: globalClassicIntrinsicNames.length };

  // ---- 2b. fixtures pack ---------------------------------------------------
  const used = new Set(), modes = { global: 0, classic: 0 };
  const checkPack = (item, expectMode = item.mode) => {
    const program = pack(P, item.source), plan = planOf(item.source);
    const mode = plan.mode ? 'global' : 'classic';
    assert.equal(mode, expectMode, `${item.feature}: packing mode (${plan.reasons})`);
    assert.equal((program.image[3] & GLOBAL_MODE_BIT) !== 0, plan.mode, `${item.feature}: image mode bit`);
    for (let i = 0; i < program.code.length; i += 4) {
      const name = opNames[program.code[i]]; used.add(name);
      assert.ok(wgslCases.has(program.code[i]), `${item.feature}: ${name} lacks WGSL`);
      if (!plan.mode) assert.ok(!globalOpcodeNames.includes(name), `${item.feature}: global opcode in classic mode`);
    }
    modes[mode]++;
    return program;
  };
  for (const item of [...globalCases, ...globalErrorCases, ...globalHostCases, ...globalV8DeviationCases, ...globalUnsupportedCases, ...globalKnownDeviationCases]) checkPack(item);
  for (const name of globalOpcodeNames) assert.ok(used.has(name), `no fixture exercises ${name}`);
  for (const item of globalRejectedCases) {
    assert.throws(() => pack(P, item.source), e => e instanceof SyntaxError && item.reason.test(e.message), `${item.feature} must stay rejected`);
  }
  summary.fixtures = { value: globalCases.length, errors: globalErrorCases.length, host: globalHostCases.length, v8Deviation: globalV8DeviationCases.length,
    unsupported: globalUnsupportedCases.length, rejected: globalRejectedCases.length, knownDeviation: globalKnownDeviationCases.length, modes };

  // ---- 3. oracles ----------------------------------------------------------
  // Rejected fixtures have top-level code: call the (last) declared function.
  const entryName = source => { try { return P.entrySource(source); } catch { return [...source.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g)].pop()[1]; } };
  const harness = (source, input) => `${source}\nJSON.stringify((function(){try{return {value:${entryName(source)}(${JSON.stringify(input)})};}catch(e){return {error:e&&e.name};}})())`;
  const v8Runner = `const vm=require('node:vm');let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{let r;try{r=vm.runInThisContext(s);}catch(e){r=JSON.stringify({error:e&&e.name});}process.stdout.write(r);});`;
  const v8 = async (source, input) => {
    const child = execFile(process.execPath, ['-e', v8Runner], { encoding: 'utf8', timeout: 10000 });
    const done = new Promise((resolve, reject) => { let out = ''; child.stdout.on('data', d => out += d); child.on('close', () => resolve(out)); child.on('error', reject); });
    child.stdin.end(harness(source, input));
    return JSON.parse(await done);
  };
  let runNative = null;
  if (nativeRun) {
    const nb = join(build, 'native'); mkdirSync(nb);
    writeFileSync(join(nb, 'runner.c'), `#include "quickjs.c"
int main(int argc, char **argv) {
    if (argc != 2) return 2;
    JSRuntime *rt = JS_NewRuntime(); JSContext *ctx = JS_NewContext(rt);
    JSValue v = JS_Eval(ctx, argv[1], strlen(argv[1]), "case.js", JS_EVAL_TYPE_GLOBAL);
    if (JS_IsException(v)) { JSValue e = JS_GetException(ctx); JSValue n = JS_GetPropertyStr(ctx, e, "name"); const char *m = JS_ToCString(ctx, n);
        printf("{\\"error\\":\\"%s\\"}\\n", m ? m : "?"); return 0; }
    const char *s = JS_ToCString(ctx, v); puts(s ? s : "null");
    JS_FreeCString(ctx, s); JS_FreeValue(ctx, v); JS_FreeContext(ctx); JS_FreeRuntime(rt); return 0;
}
`);
    const support = ['dtoa', 'libregexp', 'libunicode', 'cutils'].map(n => join(root, 'vendor', `${n}.c`));
    execFileSync(process.env.CC || 'cc', ['-O1', '-D_GNU_SOURCE', '-DCONFIG_VERSION="lanes-pinned"', '-I', join(root, 'vendor'), join(nb, 'runner.c'), ...support, '-lm', '-lpthread', '-o', join(nb, 'qjs-run')], { stdio: ['ignore', 'ignore', 'inherit'] });
    runNative = async (source, input) => {
      try { return JSON.parse((await run(join(nb, 'qjs-run'), [harness(source, input)], { encoding: 'utf8' })).stdout); }
      catch (error) { return { harnessError: String(error.stdout || error.message) }; }
    };
  }
  const pool = async (items, worker, width = 8) => {
    const results = new Array(items.length); let next = 0;
    await Promise.all(Array.from({ length: width }, async () => { while (next < items.length) { const i = next++; results[i] = await worker(items[i]); } }));
    return results;
  };
  const expectOf = item => item.throws ? { error: item.expected } : { value: item.expected };
  // kind: 'equal' (oracle == want), 'differ' (oracle != want: input+1, or a recorded V8 deviation), 'observe'.
  const jobs = [];
  const job = (engine, item, input, kind, want) => jobs.push({ engine, item, input, kind, want });
  for (const item of [...globalCases, ...globalErrorCases]) for (const engine of ['v8', 'native']) {
    job(engine, item, item.input, 'equal', expectOf(item));
    if (!item.throws) job(engine, item, item.input + 1, 'differ', expectOf(item));
  }
  // Host-defined facets: QuickJS must show `quickjs` (default: the design value); V8 is observed only.
  for (const item of globalHostCases) {
    const native = 'quickjs' in item ? { value: item.quickjs } : expectOf(item);
    job('native', item, item.input, 'equal', native); job('native', item, item.input + 1, 'differ', native); job('v8', item, item.input, 'observe');
  }
  for (const item of globalV8DeviationCases) { job('native', item, item.input, 'equal', expectOf(item)); job('native', item, item.input + 1, 'differ', expectOf(item)); job('v8', item, item.input, 'differ', expectOf(item)); job('v8', item, item.input, 'observe'); }
  for (const item of globalUnsupportedCases) job('v8', item, item.input, 'equal', { value: item.normative });
  // Rejected: the normative ES2025 result; per-engine observed deviations are recorded on the fixture.
  for (const item of globalRejectedCases) for (const engine of ['v8', 'native']) {
    const normative = typeof item.normative === 'object' ? item.normative : { value: item.normative };
    job(engine, item, 3, 'equal', item[engine] ?? normative);
  }
  for (const item of globalKnownDeviationCases) for (const engine of ['v8', 'native']) job(engine, item, item.input, 'equal', { value: item.engines });
  const failures = [], observations = {}, runs = { v8: 0, native: 0 };
  await pool(jobs.filter(j => (j.engine === 'v8' ? v8Run : !!runNative)), async j => {
    const got = j.engine === 'v8' ? await v8(j.item.source, j.input) : await runNative(j.item.source, j.input);
    runs[j.engine]++;
    const label = `${j.engine} ${j.item.feature}(${j.input})`;
    if (j.kind === 'observe') observations[j.item.feature] = got;
    else if (j.kind === 'equal' && !isDeepStrictEqual(got, j.want)) failures.push(`${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(j.want)}`);
    else if (j.kind === 'differ' && isDeepStrictEqual(got, j.want)) failures.push(`${label}: must differ from ${JSON.stringify(j.want)}`);
  });
  const v8Runs = runs.v8, nativeRuns = runs.native;
  summary.oracles = { v8Runs, nativeRuns, v8HostObservations: observations };
  assert.deepEqual(failures, [], `oracle disagreements:\n${failures.join('\n')}`);
  // Known deviations: the normative result must differ from the engines'.
  for (const item of globalKnownDeviationCases) assert.notDeepEqual({ value: item.engines }, expectOf(item));

  // ---- 5. corpus -------------------------------------------------------------
  if (corpusRun) {
    const modules = ['cases.js', 'boxing-cases.js', 'language-scope-cases.js', 'foundational-language-cases.js', 'compiler-correctness-cases.js', 'template-cases.js',
      'phase4-regression-cases.js', 'phase4-spread-cases.js', 'phase4-object-spread-cases.js', 'phase4-iteration-cases.js', 'phase4-for-in-cases.js',
      'phase4-class-cases.js', 'phase4-class-element-cases.js', 'phase4-edge-cases.js', 'phase4-template-tagged-cases.js', 'object-operation-cases.js',
      'array-method-cases.js', 'array-mutation-cases.js', 'string-extract-cases.js', 'string-search-cases.js', 'computed-assignment-cases.js', 'high-index-cases.js'];
    const sources = new Map();
    const collect = (value, origin, depth = 0) => {
      if (depth > 4 || value == null) return;
      if (typeof value === 'string') { if (/^\s*function\s+[A-Za-z_$]/.test(value)) sources.set(value, origin); return; }
      if (Array.isArray(value)) { for (const v of value) collect(v, origin, depth + 1); return; }
      if (typeof value === 'object') for (const v of Object.values(value)) collect(v, origin, depth + 1);
    };
    const skipped = [];
    for (const file of modules) {
      try { const m = await import(pathToFileURL(join(root, file)).href); for (const [k, v] of Object.entries(m)) if (typeof v !== 'function') collect(v, `${file}:${k}`); }
      catch (e) { skipped.push(`${file}: ${e.message.split('\n')[0]}`); }
    }
    const identical = [], flipped = [], changedClassic = [], newlyAdmitted = [], errors = [], changedReasons = [], newlyRejected = [];
    for (const [source, origin] of sources) {
      let base, next, compiled;
      try { compiled = raw(source); } catch (e) { errors.push(`${origin}: compiler ${e.message}`); continue; }
      if (compiled.error) continue;
      let baseError = null, nextError = null;
      try { base = pack(B, source); } catch (e) { base = null; baseError = e.message; }
      try { next = pack(N, source); } catch (e) { next = null; nextError = e.message; }
      if (!next) { if (base) newlyRejected.push(`${origin}: newly rejected: ${nextError}`); else if (baseError !== nextError) changedReasons.push({ origin, before: baseError, after: nextError }); continue; }
      const plan = planOf(source);
      if (!base) { newlyAdmitted.push({ origin, mode: plan.mode ? 'global' : 'classic', source: source.slice(0, 100) }); continue; }
      if (plan.mode) {
        // Same program under the full patch set: every opcode has a WGSL case.
        const full = pack(P, source);
        for (let i = 0; i < full.code.length; i += 4) assert.ok(wgslCases.has(full.code[i]), `${origin}: ${opNames[full.code[i]]} lacks WGSL`);
        flipped.push({ origin, reasons: plan.reasons.join('+'), source: source.slice(0, 80) }); continue;
      }
      const same = base.code.length === next.code.length && base.code.every((w, i) => w === next.code[i]) && base.image.length === next.image.length && base.image.every((w, i) => w === next.image[i]);
      (same ? identical : changedClassic).push(origin);
    }
    assert.deepEqual(changedClassic, [], 'classic-mode corpus programs must pack bit-identically');
    assert.deepEqual(newlyRejected, [], 'no corpus program may become rejected');
    assert.deepEqual(errors, [], 'native compiler failures (rerun when generated/compiler is not being rebuilt)');
    const byOrigin = {};
    for (const item of flipped) byOrigin[`${item.origin} [${item.reasons}]`] = (byOrigin[`${item.origin} [${item.reasons}]`] ?? 0) + 1;
    summary.corpus = { sources: sources.size, classicIdentical: identical.length, nowGlobalMode: flipped.length, newlyAdmitted: newlyAdmitted.length, skippedModules: skipped, compilerErrors: errors.length,
      globalModeByOrigin: byOrigin, newlyAdmittedList: newlyAdmitted, changedRejectionMessages: changedReasons };
  }
  console.log(JSON.stringify(summary, null, 1));
} finally {
  if (!keep) rmSync(build, { recursive: true, force: true });
}
