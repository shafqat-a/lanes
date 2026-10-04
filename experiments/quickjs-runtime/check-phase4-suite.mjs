// Phase 4 suite host checks (worker 8). Host reference checks only: no GPU,
// no runtime.js, no production CPU fallback. For every phase4Suite() record:
//  1. V8 (node:vm, fresh realm) agrees with both fixed expectations, unless the
//     record id is listed in phase4NormativeDifferences with a reason.
//  2. A private native QuickJS interpreter built from the CURRENT vendor/
//     sources runs the same harness; disagreements are recorded as findings.
//  3. A private native compiler built from the current vendor/ + bridge.c,
//     composed with the current bootstrap.js/program.js exactly like
//     createCompiler(), decides admission. Value/error records that are not yet
//     admitted are 'pending-integration'; 'rejected' records must be rejected.
//  4. Every opcode of every admitted program must have a WGSL case in shader.js
//     (literal cases('...') scan + phase4ShaderOps).
// Native/Wasm compiler parity is NOT checked here (no emcc); see the summary.
// Flags: --write-expected  regenerate phase4-suite-expected.js from V8 for
//        records whose first input already matches the fixed expectation.
//        --keep            keep the private build directory.
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Script } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import { OP, entrySource, packProgram } from './program.js';
import { attachBootstrap, bootstrapSources } from './bootstrap.js';
import { phase4Suite, phase4NormativeDifferences, phase4ResumptionIds } from './phase4-suite.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const keep = process.argv.includes('--keep');
const writeExpected = process.argv.includes('--write-expected');
const support = ['dtoa', 'libregexp', 'libunicode', 'cutils'].map(n => `${root}vendor/${n}.c`);
const common = ['-O2', '-D_GNU_SOURCE', '-DCONFIG_VERSION="lanes-pinned"'];
const runnerSource = `#include "quickjs.c"
int main(int argc, char **argv) {
    if (argc != 2) return 2;
    JSRuntime *rt = JS_NewRuntime(); JSContext *ctx = JS_NewContext(rt);
    JSValue v = JS_Eval(ctx, argv[1], strlen(argv[1]), "case.js", JS_EVAL_TYPE_GLOBAL);
    if (JS_IsException(v)) { JSValue e = JS_GetException(ctx); const char *m = JS_ToCString(ctx, e);
        printf("{\\"harness\\":\\"%s\\"}\\n", m ? m : "?"); return 1; }
    const char *s = JS_ToCString(ctx, v); puts(s ? s : "null");
    JS_FreeCString(ctx, s); JS_FreeValue(ctx, v); JS_FreeContext(ctx); JS_FreeRuntime(rt); return 0;
}
`;

// One harness for both oracles. Strings are transported as UTF-16 code units
// so lone surrogates survive QuickJS's UTF-8 output.
const encoder = 'function __enc(v){if(v===undefined)return {u:1};'
  + 'if(typeof v==="string"){var a=[];for(var i=0;i<v.length;i++)a.push(v.charCodeAt(i));return {s:a};}'
  + 'if(typeof v==="number"&&(v!==v||v===Infinity||v===-Infinity||(v===0&&1/v<0)))return {n:v!==v?"NaN":v===0?"-0":String(v)};'
  + 'if(v!==null&&(typeof v==="object"||typeof v==="function"))return {o:typeof v};return {v:v};}';
const entryName = source => { const fn = parse(source, { ecmaVersion: 2025 }).body[0]; return fn.id.name; };
const harness = (source, input) => `${source}\n(function(){${encoder}try{return JSON.stringify(__enc(${entryName(source)}(${JSON.stringify(input)})));}`
  + 'catch(e){return JSON.stringify({e:(e instanceof Error)?e.name:"non-error:"+typeof e});}})()';
function decode(json) {
  const r = JSON.parse(json);
  if ('harness' in r) return { harness: r.harness };
  if ('e' in r) return { error: r.e };
  if ('u' in r) return { value: undefined };
  if ('s' in r) return { value: String.fromCharCode(...r.s) };
  if ('n' in r) return { value: Number(r.n) };
  if ('o' in r) return { nonPrimitive: r.o };
  return { value: r.v };
}
const v8 = (source, input) => {
  try { return decode(new Script(harness(source, input)).runInNewContext({}, { timeout: 5000 })); }
  catch (e) { return { harness: `${e.name}: ${e.message}` }; }
};
const asResult = expected => expected && typeof expected === 'object' && typeof expected.error === 'string' ? { error: expected.error } : { value: expected };
const same = (a, b) => ('value' in a && 'value' in b) ? Object.is(a.value, b.value) : JSON.stringify(a) === JSON.stringify(b);
const show = r => 'value' in r ? (typeof r.value === 'string' ? JSON.stringify(r.value) : String(r.value)) : JSON.stringify(r);
const literal = v => {
  if (v && typeof v === 'object') return `{ error: ${JSON.stringify(v.error)} }`;
  if (v === undefined) return 'undefined';
  if (typeof v === 'number') return Object.is(v, -0) ? '-0' : String(v);
  return JSON.stringify(v);
};

// Opcodes with WGSL cases: same scan as check-language-scope.mjs, plus registry cases.
const shaderText = readFileSync(new URL('./shader.js', import.meta.url), 'utf8');
const shaderOps = new Set([...shaderText.matchAll(/cases\('([^']+)'/g)].flatMap(m => m[1].split(' ')));
for (const m of shaderText.matchAll(/\[((?:'[a-z0-9_]+',?)+)\]\.map\(\(name/g)) for (const n of m[1].matchAll(/'([a-z0-9_]+)'/g)) shaderOps.add(n[1]);
const shaderModule = await import('./shader.js');
for (const op of shaderModule.phase4ShaderOps || []) shaderOps.add(op);
const opNames = Object.keys(OP);

const build = mkdtempSync(join(root, '.phase4-build-w8-'));
let summary, failures = [];
try {
  writeFileSync(join(build, 'runner.c'), runnerSource);
  copyFileSync(`${root}bridge.c`, join(build, 'bridge.c'));
  const inc = ['-I', build, '-I', `${root}vendor`], cc = process.env.CC || 'cc', run = promisify(execFile);
  await Promise.all([
    run(cc, [...common, ...inc, join(build, 'bridge.c'), ...support, '-lm', '-lpthread', '-o', join(build, 'compiler')]),
    run(cc, [...common, ...inc, join(build, 'runner.c'), ...support, '-lm', '-lpthread', '-o', join(build, 'qjs-run')]),
  ]);
  const raw = source => JSON.parse(execFileSync(join(build, 'compiler'), [source], { encoding: 'utf8', maxBuffer: 1 << 26 }));
  const quickjs = (source, input) => {
    try { return decode(execFileSync(join(build, 'qjs-run'), [harness(source, input)], { encoding: 'utf8', timeout: 20000 })); }
    catch (e) { return { harness: e.stdout?.trim() || e.message }; }
  };
  const bootstrapErrors = [], boot = {};
  for (const [field, source] of Object.entries(bootstrapSources)) {
    const r = raw(source); boot[field] = r;
    if (r.error) bootstrapErrors.push({ field, error: r.error });
  }
  if (bootstrapErrors.length) failures.push({ kind: 'bootstrap-compile', bootstrapErrors });
  const admit = source => {
    let r;
    try { r = raw(source); } catch (e) { return { admission: 'rejected', reason: `compiler crash: ${e.message}` }; }
    try {
      const program = packProgram(attachBootstrap(r, boot), entrySource(source));
      const guest = r.functions.length, ops = new Set(), guestOps = new Set();
      for (let i = 0; i < program.code.length; i += 4) {
        const name = opNames[program.code[i]]; ops.add(name);
        if (program.code[i + 3] < guest) guestOps.add(name);
      }
      return { admission: 'admitted', ops: [...ops].sort(), guestOps: [...guestOps].sort(), rawOps: rawOps(r) };
    } catch (e) { return { admission: 'rejected', reason: `${e.name}: ${e.message}`, rawOps: r.error ? [] : rawOps(r) }; }
  };
  const rawOps = r => [...new Set((r.functions || []).flatMap(fn => fn.instructions.map(i => i.op)))].sort();

  const suite = phase4Suite(), newSecond = {};
  const perArea = {}, counts = { records: suite.length, v8Checks: 0, v8Agree: 0, normativeDifferences: 0, quickjsChecks: 0, quickjsAgree: 0,
    admitted: 0, pendingIntegration: 0, rejectedAsExpected: 0, unsupportedAdmitted: 0, unsupportedRejected: 0, resourceLimitAdmitted: 0, inputInsensitive: 0, missingSecondExpected: 0 };
  const quickjsDisagreements = [], staleDeviation = [], pending = [], admittedRecords = [], normativeDifferenceLog = [], dependsOnAbsent = [], inputInsensitive = [];
  const opInventory = {};
  for (const record of suite) {
    const { id, source, inputs, outcome } = record;
    const area = perArea[record.area] ||= { records: 0, admitted: 0, pendingIntegration: 0, rejectedAsExpected: 0, value: 0, error: 0, unsupported: 0, rejected: 0, resourceLimit: 0 };
    area.records++;
    if (outcome === 'value') area.value++; else if (outcome.startsWith('error:')) area.error++;
    else if (outcome === 'resource-limit') area.resourceLimit++; else area[outcome]++;
    // 1. V8 oracle on both inputs.
    const oracle = inputs.map(input => v8(source, input));
    if (record.hasNormative) {
      for (let i = 0; i < 2; i++) {
        const fixed = i === 0 ? record.expected[0] : record.expected[1];
        if (i === 1 && !record.secondExpectedRecorded) {
          counts.missingSecondExpected++;
          // A value record whose input+1 throws (or vice versa) needs an explicit input2.
          const kindMismatch = ('error' in oracle[1]) !== ('error' in asResult(record.expected[0]));
          if (kindMismatch && (outcome === 'value' || outcome.startsWith('error:'))) failures.push({ kind: 'second-input-changes-outcome', id, v8: show(oracle[1]) });
          else if (writeExpected && same(oracle[0], asResult(record.expected[0])) && ('value' in oracle[1] || 'error' in oracle[1]))
            newSecond[id] = 'error' in oracle[1] ? { error: oracle[1].error } : oracle[1].value;
          else failures.push({ kind: 'missing-second-expected', id, v8: show(oracle[1]) });
          continue;
        }
        counts.v8Checks++;
        if (same(oracle[i], asResult(fixed))) { counts.v8Agree++; if (writeExpected && i === 1) newSecond[id] = fixed; continue; }
        if (Object.hasOwn(phase4NormativeDifferences, id)) {
          counts.normativeDifferences++;
          normativeDifferenceLog.push({ id, input: inputs[i], v8: show(oracle[i]), fixed: show(asResult(fixed)), reason: phase4NormativeDifferences[id] });
          if (writeExpected && i === 1) newSecond[id] = fixed;
        } else failures.push({ kind: 'v8-disagrees', id, input: inputs[i], v8: show(oracle[i]), fixed: show(asResult(fixed)) });
      }
      const [a, b] = [asResult(record.expected[0]), asResult(record.expected[1])];
      if (record.secondExpectedRecorded && same(a, b)) {
        counts.inputInsensitive++; inputInsensitive.push(id);
        if (record.module === 'w8' && outcome === 'value') failures.push({ kind: 'input-insensitive', id });
      }
      if (outcome !== 'value' && !outcome.startsWith('error:')) { /* normative only */ }
      else if (record.secondExpectedRecorded && outcome.startsWith('error:') && !('error' in asResult(record.expected[1])))
        failures.push({ kind: 'outcome-differs-between-inputs', id });
    }
    // 2. Native QuickJS interpreter from current vendor/.
    if (record.hasNormative) {
      for (let i = 0; i < 2; i++) {
        const fixed = i === 0 ? record.expected[0] : (record.secondExpectedRecorded ? record.expected[1] : newSecond[id]);
        if (i === 1 && fixed === undefined && !record.secondExpectedRecorded && !(id in newSecond)) continue;
        const got = quickjs(source, inputs[i]); counts.quickjsChecks++;
        if (same(got, asResult(fixed))) { counts.quickjsAgree++; if (record.quickjsDeviation) staleDeviation.push({ id, input: inputs[i] }); }
        else quickjsDisagreements.push({ id, input: inputs[i], quickjs: show(got), fixed: show(asResult(fixed)), ...(record.quickjsDeviation ? { declaredByFixture: true } : {}) });
      }
    }
    // 3. Admission against the record's outcome.
    const status = admit(source);
    const absent = record.dependsOn.filter(op => status.rawOps && !status.rawOps.includes(op));
    if (absent.length) dependsOnAbsent.push({ id, absent });
    if (outcome === 'rejected') {
      if (status.admission === 'rejected') { counts.rejectedAsExpected++; area.rejectedAsExpected++; }
      else failures.push({ kind: 'expected-rejection-admitted', id });
    } else if (status.admission === 'rejected') {
      if (outcome === 'unsupported') { counts.unsupportedRejected++; area.rejectedAsExpected++; }
      else { counts.pendingIntegration++; area.pendingIntegration++; pending.push({ id, reason: status.reason }); }
    } else {
      counts.admitted++; area.admitted++;
      if (outcome === 'unsupported') counts.unsupportedAdmitted++;
      if (outcome === 'resource-limit') counts.resourceLimitAdmitted++;
      // 4. Admitted programs must not contain opcodes without a WGSL case.
      const missing = status.ops.filter(op => !shaderOps.has(op));
      if (missing.length) failures.push({ kind: 'admitted-without-wgsl-case', id, missing });
      for (const op of status.guestOps) opInventory[op] = (opInventory[op] || 0) + 1;
      admittedRecords.push({ id, outcome, guestOps: status.guestOps, ...(missing.length ? { shaderMissing: missing } : {}),
        ...(outcome === 'unsupported' ? { requires: 'GPU must report Unsupported runtime operation' } : {}),
        ...(outcome === 'resource-limit' ? { requires: 'GPU must report Resource limit' } : {}) });
    }
  }
  if (writeExpected) {
    const entries = suite.filter(r => r.hasNormative && (id => id in newSecond)(r.id)).map(r => `  ${JSON.stringify(r.id)}: ${literal(newSecond[r.id])},`);
    writeFileSync(join(root, 'phase4-suite-expected.js'), '// Fixed second-input (input+1) expectations for phase4-suite.js records.\n'
      + '// Authored with check-phase4-suite.mjs --write-expected (V8 oracle, only for records whose\n'
      + '// first-input V8 result equals the fixed expectation); re-verified on every run.\n'
      + `export const phase4SecondExpected = Object.freeze({\n${entries.join('\n')}\n});\n`);
  }
  const reasonGroups = {};
  for (const p of pending) { const k = p.reason.replace(/: .*$/, m => m.length > 90 ? m.slice(0, 90) : m); reasonGroups[k] = (reasonGroups[k] || 0) + 1; }
  summary = {
    gpuChecks: false, runtimeExecution: false, productionCPUFallback: false,
    nativeQuickJSReference: 'private build from current vendor/ (this run)',
    nativeWasmParity: 'pending: emcc unavailable locally; coordinator must rebuild generated/compiler.mjs and compare',
    passed: failures.length === 0, counts, perArea, failures,
    resumptionIds: phase4ResumptionIds,
    pendingIntegrationReasons: reasonGroups, pending,
    quickjsDisagreements, declaredQuickJSDeviationsThatAgree: staleDeviation, normativeDifferences: normativeDifferenceLog, inputInsensitive, dependsOnAbsent,
    opInventory: { admittedGuestOps: opInventory, shaderOpsCount: shaderOps.size }, admitted: admittedRecords,
  };
} finally {
  if (!keep) rmSync(build, { recursive: true, force: true });
}
if (process.argv.includes('--brief')) {
  const { pending, admitted, opInventory, ...brief } = summary;
  brief.perArea = Object.fromEntries(Object.entries(summary.perArea).map(([k, v]) => [k, Object.entries(v).map(([a, b]) => `${a}=${b}`).join(' ')]));
  brief.quickjsDisagreements = summary.quickjsDisagreements.map(d => `${d.id} @${d.input}: quickjs=${d.quickjs} fixed=${d.fixed}${d.declaredByFixture ? ' (declared)' : ''}`);
  brief.dependsOnAbsent = summary.dependsOnAbsent.map(d => `${d.id}: ${d.absent.join(' ')}`);
  brief.admittedIds = admitted.length;
  brief.admittedGuestOps = Object.keys(opInventory.admittedGuestOps).sort().join(' ');
  console.log(JSON.stringify(brief, null, 1));
} else console.log(JSON.stringify(summary, null, 1));
if (!summary.passed) process.exitCode = 1;
