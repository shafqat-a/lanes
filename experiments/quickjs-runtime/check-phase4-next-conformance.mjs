// Phase 4 next wave, worker 8: host conformance check for
// phase4-next-conformance-cases.js. Host only: no GPU, no CPU replay, no
// guest execution outside the test oracles.
//  1. V8 oracle (node:vm) must reproduce every fixed expectation (value,
//     uncaught error name, early SyntaxError, boundary `normative`), and
//     input + 1 must change value results.
//  2. A private native QuickJS interpreter built from vendor/ runs every case;
//     disagreements with the fixed ES2025 value are recorded as deviations.
//  3. Every case is compiled with the coordinator's native compiler
//     (generated/compiler) and packed by the integrated program.js:
//     packed-ok | rejected (SyntaxError) | pack-error (other error class).
//     Packed programs must have a WGSL case for every opcode.
//  4. Gap report: required cases that are rejected / pack-error, or that the
//     static review predicts reach status 6 (`predict6`), plus declared
//     boundaries whose declared outcome no longer holds.
//  5. Append-only audit: OP and FIELDS indices of HEAD~2, HEAD~1 and HEAD
//     (git archive into a private temp dir) are prefixes of the working tree.
//  6. Static fixed-node / GC invariants of the generated shader.
//  7. Prints the exact suite records (second expectations) for the lead.
// Usage: node experiments/quickjs-runtime/check-phase4-next-conformance.mjs [--no-native] [--no-git] [--strict] [--records] [--keep]
//   --strict  exit 1 when a required case is a gap (default: report only).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Script } from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as Cases from './phase4-next-conformance-cases.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const repo = fileURLToPath(new URL('../../', import.meta.url));
const argv = new Set(process.argv.slice(2));
const nativeRun = !argv.has('--no-native'), gitRun = !argv.has('--no-git'), strict = argv.has('--strict'), keep = argv.has('--keep');
const harness = (source, input) => `${source}\nJSON.stringify((function(){try{return {value:f(${JSON.stringify(input)})};}catch(e){return {error:e&&e.name};}})())`;
const v8 = (source, input) => {
  try { return JSON.parse(new Script(harness(source, input)).runInNewContext({}, { timeout: 4000 })); }
  catch (error) { return { compileError: error?.name ?? String(error) }; }
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const problems = []; // oracle/fixture defects (always fatal)
const note = (kind, id, detail) => problems.push({ kind, id, detail });

// Integrated pipeline (may be mid-edit by the lead: report instead of crashing).
let pipeline = null, pipelineError = null;
try {
  const program = await import('./program.js');
  const bootstrap = await import('./bootstrap.js');
  const shaderModule = await import('./shader.js');
  const fixed = await import('./phase4-fixed-nodes.js');
  pipeline = { program, bootstrap, shaderModule, fixed };
} catch (error) { pipelineError = `${error.name}: ${error.message}`; }

const compilerPath = join(root, 'generated', 'compiler');
const raw = source => JSON.parse(execFileSync(compilerPath, [source], { encoding: 'utf8', maxBuffer: 1 << 28 }));

const all = [
  ...Cases.conformanceCases.map(item => ({ ...item, kind: 'value' })),
  ...Cases.conformanceErrorCases.map(item => ({ ...item, kind: 'error' })),
  ...Cases.conformanceEarlyErrorCases.map(item => ({ ...item, kind: 'early' })),
  ...Cases.conformanceBoundaryCases.map(item => ({ ...item, kind: item.outcome === 'value' ? 'value' : 'boundary' })),
  ...Cases.conformanceProbeCases.map(item => ({ ...item, kind: 'value' })),
];
const tag = Cases.conformanceSuiteTag;
const idOf = item => `${tag}:${item.feature}`;
{ const ids = new Set(); for (const item of all) { if (ids.has(idOf(item))) note('duplicate-id', idOf(item), ''); ids.add(idOf(item)); } }

let build = null, runNative = null;
const results = [];
try {
  build = mkdtempSync(join(root, '.phase4-build-w8-'));
  if (nativeRun) {
    writeFileSync(join(build, 'runner.c'), `#include "quickjs.c"
int main(int argc, char **argv) {
    if (argc != 2) return 2;
    JSRuntime *rt = JS_NewRuntime(); JSContext *ctx = JS_NewContext(rt);
    JSValue v = JS_Eval(ctx, argv[1], strlen(argv[1]), "case.js", JS_EVAL_TYPE_GLOBAL);
    if (JS_IsException(v)) { JSValue e = JS_GetException(ctx); const char *m = JS_ToCString(ctx, e);
        printf("{\\"harnessError\\":\\"%s\\"}\\n", m ? m : "?"); return 1; }
    const char *s = JS_ToCString(ctx, v); puts(s ? s : "null");
    JS_FreeCString(ctx, s); JS_FreeValue(ctx, v); JS_FreeContext(ctx); JS_FreeRuntime(rt); return 0;
}
`);
    const support = ['dtoa', 'libregexp', 'libunicode', 'cutils'].map(n => `${root}vendor/${n}.c`);
    execFileSync(process.env.CC || 'cc', ['-O1', '-D_GNU_SOURCE', '-DCONFIG_VERSION="lanes-pinned"', '-I', `${root}vendor`, join(build, 'runner.c'), ...support, '-lm', '-lpthread', '-o', join(build, 'qjs-run')], { stdio: ['ignore', 'ignore', 'inherit'] });
    runNative = (source, input) => {
      try { return JSON.parse(execFileSync(join(build, 'qjs-run'), [harness(source, input)], { encoding: 'utf8', timeout: 20000 })); }
      catch (error) { const out = String(error.stdout || ''); try { return JSON.parse(out); } catch { return { harnessError: out || error.message }; } }
    };
  }

  // Shader facts for opcode coverage.
  let wgslCases = null, opNames = null;
  if (pipeline) {
    const { shader } = pipeline.shaderModule;
    wgslCases = new Set([...shader.matchAll(/case ((?:\d+u, )*\d+u):/g)].flatMap(m => m[1].split(', ').map(n => parseInt(n, 10))));
    opNames = Object.keys(pipeline.program.OP);
  }
  const pack = source => {
    const { program, bootstrap } = pipeline;
    const boot = pack.boot ??= Object.fromEntries(Object.entries(bootstrap.bootstrapSources).map(([name, s]) => [name, raw(s)]));
    return program.packProgram(bootstrap.attachBootstrap(raw(source), boot), program.entrySource(source));
  };

  // --dump=<substring>: print the raw QuickJS instruction listing of matching cases.
  const dumpArg = process.argv.find(a => a.startsWith('--dump='));
  if (dumpArg) {
    const needle = dumpArg.slice(7);
    for (const item of all.filter(i => i.feature.includes(needle))) {
      const out = raw(item.source);
      console.log(`# ${idOf(item)}${out.error ? ` error: ${out.error}` : ''}`);
      for (const [index, fn] of (out.functions || []).entries())
        console.log(`  fn ${index} ${fn.name ?? ''}: ${fn.instructions.map(i => `${i.op}${i.operand === undefined ? '' : ` ${JSON.stringify(i.operand)}`}`).join('; ')}`);
    }
    if (build && !keep) rmSync(build, { recursive: true, force: true });
    process.exit(0);
  }

  for (const item of all) {
    const id = idOf(item);
    const r = { id, area: item.area, kind: item.kind, status: item.status, input: item.input };
    // 1. V8 oracle.
    if (item.kind === 'early') {
      const out = v8(item.source, item.input);
      r.v8 = out.compileError ?? out;
      if (out.compileError !== 'SyntaxError') note('v8-early-error', id, JSON.stringify(out));
    } else if (item.kind === 'boundary') {
      const out = v8(item.source, item.input);
      r.v8 = out;
      if (!same(out, { value: item.normative })) note('v8-normative', id, `${JSON.stringify(out)} != ${JSON.stringify(item.normative)}`);
    } else {
      const want = item.kind === 'error' ? { error: item.expected } : { value: item.expected };
      const out = v8(item.source, item.input);
      r.v8 = out;
      if (!same(out, want)) note('v8-expected', id, `${JSON.stringify(out)} != ${JSON.stringify(want)}`);
      const input2 = item.input + (item.kind === 'error' ? 2 : 1);
      const second = v8(item.source, input2);
      r.second = { input: input2, ...second };
      if (item.kind === 'value' && !item.fixedAcrossInputs && (same(second, want) || !('value' in second))) note('v8-input-sensitivity', id, JSON.stringify(second));
      if (item.fixedAcrossInputs && !same(second, want)) note('v8-fixed-source-result', id, JSON.stringify(second));
      if (item.kind === 'error' && !same(second, want)) note('v8-error-parity', id, JSON.stringify(second));
    }
    // 2. Native QuickJS.
    if (runNative) {
      const out = runNative(item.source, item.input);
      let want;
      if (item.kind === 'early') want = null;
      else if (item.kind === 'boundary') want = { value: item.normative };
      else want = item.kind === 'error' ? { error: item.expected } : { value: item.expected };
      const agrees = want === null ? typeof out.harnessError === 'string' && out.harnessError.startsWith('SyntaxError') : same(out, want);
      r.native = agrees ? 'agrees' : out;
      if (!agrees) r.documentedDeviation = Boolean(item.quickjsDeviation);
      if (agrees && item.quickjsDeviation) note('stale-quickjs-deviation', id, 'native QuickJS now agrees');
    }
    // 3. Pack.
    if (pipeline) {
      try {
        const packed = pack(item.source);
        const ops = new Set();
        const missing = new Set();
        for (let i = 0; i < packed.code.length; i += 4) { ops.add(opNames[packed.code[i]]); if (!wgslCases.has(packed.code[i])) missing.add(opNames[packed.code[i]] ?? packed.code[i]); }
        r.pack = 'packed-ok';
        if (missing.size) { r.pack = 'pack-missing-wgsl'; r.missingWGSL = [...missing]; }
        r.newOps = [...ops].filter(op => ['push_template', 'private_symbol', 'get_private_field', 'put_private_field', 'define_private_field', 'add_brand', 'check_brand', 'private_in'].includes(op));
      } catch (error) {
        r.pack = error instanceof SyntaxError ? 'rejected' : 'pack-error';
        r.packError = `${error.name}: ${error.message}`.slice(0, 200);
      }
    } else r.pack = 'pipeline-unavailable';
    if (item.predict6) r.predict6 = item.predict6;
    if (item.predict2) r.predict2 = item.predict2;
    // 4. Classification.
    if (item.kind === 'early') {
      r.verdict = r.pack === 'rejected' ? 'conformant-rejection' : r.pack === 'pipeline-unavailable' ? 'unknown' : 'GAP:early-error-admitted';
    } else if (item.kind === 'boundary') {
      const declared = item.status === 'rejected' ? r.pack === 'rejected' && (!item.reason || item.reason.test(r.packError ?? '')) : r.pack === 'packed-ok';
      r.verdict = declared ? `declared-${item.status}` : `BOUNDARY-DRIFT:${r.pack}`;
    } else {
      if (r.pack === 'packed-ok') r.verdict = item.predict2 ? 'GAP?:predicted-status-2' : item.predict6 && !/Unsupported global/.test(item.predict6) ? 'GAP?:predicted-status-6' : 'packed (GPU pending)';
      else if (r.pack === 'pipeline-unavailable') r.verdict = 'unknown';
      else r.verdict = `GAP:${r.pack}`;
    }
    results.push(r);
  }

  // 5. Append-only OP / FIELDS audit against committed revisions.
  const appendOnly = {};
  if (gitRun && pipeline) {
    for (const rev of ['HEAD~2', 'HEAD~1', 'HEAD']) {
      const dir = join(build, rev.replace(/\W/g, '_'));
      mkdirSync(dir);
      try {
        const tar = execFileSync('git', ['archive', '--format=tar', rev, 'experiments/quickjs-runtime', 'src', ':(exclude)experiments/quickjs-runtime/vendor', ':(exclude)experiments/quickjs-runtime/generated'], { cwd: repo, maxBuffer: 1 << 28 });
        execFileSync('tar', ['-x', '-C', dir], { input: tar });
        const old = await import(pathToFileURL(join(dir, 'experiments/quickjs-runtime/program.js')).href);
        const changedOP = Object.entries(old.OP).filter(([n, i]) => pipeline.program.OP[n] !== i).map(([n, i]) => `${n}:${i}->${pipeline.program.OP[n]}`);
        const changedFields = Object.entries(old.FIELDS).filter(([n, i]) => pipeline.program.FIELDS[n] !== i).map(([n, i]) => `${JSON.stringify(n)}:${i}->${pipeline.program.FIELDS[n]}`);
        const opCount = Object.keys(old.OP).length, fieldCount = Object.keys(old.FIELDS).length;
        appendOnly[rev] = { ok: changedOP.length === 0 && changedFields.length === 0, opCount, fieldCount,
          appendedOps: Object.keys(pipeline.program.OP).slice(opCount), appendedFieldCount: Object.keys(pipeline.program.FIELDS).length - fieldCount,
          lastAppendedFields: Object.keys(pipeline.program.FIELDS).slice(fieldCount).slice(-5), changedOP, changedFields };
      } catch (error) { appendOnly[rev] = { error: `${error.name}: ${error.message}`.slice(0, 300) }; }
    }
  }

  // 6. Static fixed-node / GC invariants of the generated shader.
  const gc = {};
  if (pipeline) {
    const { shader } = pipeline.shaderModule; const N = pipeline.fixed; const L = pipeline.program.LIMITS;
    const collectFn = shader.slice(shader.indexOf('fn collect('), shader.indexOf('fn find('));
    const mainFn = shader.slice(shader.indexOf('fn main('));
    const init = mainFn.slice(0, mainFn.indexOf('for (var step=0u;'));
    const consts = Object.fromEntries([...shader.matchAll(/const (\w+): u32 = (\d+)u;/g)].map(m => [m[1], Number(m[2])]));
    const inPlace = [...init.matchAll(/states\[l\]\.heap\[(\w+)\]=Node\(V\([^)]*\),\d+u,\d+u,(\d+)u/g)].map(m => ({ node: /^\d+u?$/.test(m[1]) ? parseInt(m[1], 10) : consts[m[1]], name: m[1], kind: Number(m[2]) }));
    const reservedInit = inPlace.filter(x => x.node >= N.FIXED_RESERVED_FIRST && x.node <= N.FIXED_RESERVED_LAST && x.kind !== 0);
    gc.freeListSkipsReserved = init.includes(`states[l].heap[${N.FIXED_INIT_LAST}u].next=${N.FIXED_RESERVED_LAST + 1}u;`);
    gc.freeCountExcludesReserved = init.includes(`freeCount=${L.heap - 1 - N.FIXED_RESERVED_COUNT}u;`);
    gc.sweepSkipsReserved = collectFn.includes(`if (i>=${N.FIXED_RESERVED_FIRST}u && i<=${N.FIXED_RESERVED_LAST}u)`);
    gc.initLayoutChecked = init.includes(`if(jsonObject!=${N.FIXED_INIT_LAST}u){states[l].status=2u;}`);
    gc.initializedReservedNodes = reservedInit.map(x => `${x.name}=${x.node} kind ${x.kind}`);
    gc.unrootedInitializedReservedNodes = reservedInit.filter(x => !N.PHASE4_FIXED_ROOTS.includes(x.node) && !collectFn.includes(`mark(l,${x.node}u)`) && !collectFn.includes(`mark(l,${x.name})`)).map(x => x.node);
    gc.rootsMarked = N.PHASE4_FIXED_ROOTS.every(n => collectFn.includes(`mark(l,${n}u)`));
    gc.privateMarking = ['if(node.kind==2u||node.kind==8u){mark(l,node.value.y);}', 'if(node.kind==34u){markValue(l,node.value);mark(l,node.key);}', 'if(node.kind==35u){mark(l,node.key);}', 'if(node.kind==32u){mark(l,node.value.x);}'].every(part => collectFn.includes(part));
    gc.collectionHeadroom = (shader.match(/freeCount<(\d+)u\) \{ collect\(l\)/) || [])[1];
    // Heap kinds 32..39 referenced anywhere in WGSL (allocation sites per kind).
    gc.kindAllocations = Object.fromEntries([32, 33, 34, 35, 36, 37, 38, 39].map(k => [k, (shader.match(new RegExp(`alloc\\(l,${k}u,`, 'g')) || []).length + (shader.match(new RegExp(`=Node\\(V\\([^)]*\\),\\d+u,\\d+u,${k}u`, 'g')) || []).length]));
  }

  // 7. Records for the lead (phase4-suite.js sources + phase4-suite-expected.js).
  const second = {};
  for (const r of results) if ((r.kind === 'value' || r.kind === 'error') && r.second && !problems.some(p => p.id === r.id)) second[r.id] = r.kind === 'error' ? undefined : r.second.value;

  const gaps = results.filter(r => r.verdict.startsWith('GAP'));
  const drift = results.filter(r => r.verdict.startsWith('BOUNDARY-DRIFT'));
  const byArea = {};
  for (const r of results) { const a = byArea[r.area] ||= {}; a[r.verdict] = (a[r.verdict] || 0) + 1; }
  const nativeDeviations = results.filter(r => r.native && r.native !== 'agrees').map(r => ({ id: r.id, native: r.native, documented: r.documentedDeviation }));
  const summary = {
    gpuChecks: false, guestExecution: false, pipelineError, cases: results.length,
    oracleProblems: problems, byArea, gaps: gaps.map(r => ({ id: r.id, verdict: r.verdict, ...(r.packError ? { packError: r.packError } : {}), ...(r.verdict.includes('status-6') ? { predict6: r.predict6 } : {}), ...(r.predict2 ? { predict2: r.predict2 } : {}) })),
    boundaryDrift: drift.map(r => ({ id: r.id, verdict: r.verdict, packError: r.packError })),
    nativeDeviations, appendOnly, gc,
    resumptionIds: Cases.conformanceResumptionIds,
  };
  console.log(JSON.stringify(summary, null, 1));
  if (argv.has('--records')) {
    console.log('\n// phase4-suite-expected.js additions (V8-verified second inputs):');
    for (const [id, value] of Object.entries(second)) if (value !== undefined) console.log(`  ${JSON.stringify(id)}: ${JSON.stringify(value)},`);
    console.log('\n// Per-case detail:');
    for (const r of results) console.log(JSON.stringify({ id: r.id, verdict: r.verdict, pack: r.pack, newOps: r.newOps, native: r.native }));
  }
  if (problems.length) { console.error(`FAIL: ${problems.length} oracle/fixture problems`); process.exitCode = 1; }
  else if (strict && (gaps.length || drift.length)) { console.error(`FAIL (--strict): ${gaps.length} gaps, ${drift.length} boundary drifts`); process.exitCode = 1; }
} finally {
  if (build && !keep) rmSync(build, { recursive: true, force: true });
}
