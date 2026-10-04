// Phase 4 next wave, worker 3 host checks: public static class fields and
// static blocks (phase4-next-w3-cases.js). Modelled on
// check-phase4-class-elements.mjs. Host only: no GPU, no CPU replay.
//  1. V8 oracle (node:vm) reproduces every fixed expectation; input + 1 changes it.
//  2. A private native QuickJS interpreter built from vendor/ agrees, except
//     for recorded `quickjsDeviation` fixtures.
//  3. Every admitted fixture packs with the coordinator's native compiler and
//     the integrated program.js, and every packed opcode has a WGSL case.
//  4. Early-error fixtures: V8 and native QuickJS throw SyntaxError at parse
//     time and the coordinator compiler rejects them with SyntaxError.
//  5. Unsupported fixtures pack (runtime status 6 is the GPU obligation).
// Usage: node experiments/quickjs-runtime/check-phase4-next-w3.mjs [--keep] [--no-native] [--verbose]
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Script } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { OP, entrySource, packProgram } from './program.js';
import { attachBootstrap, bootstrapSources } from './bootstrap.js';
import { shader } from './shader.js';
import { phase4Suite, phase4NormativeDifferences as suiteNormativeDifferences } from './w3-phase4-suite.js';
import { w3StaticCases, w3StaticErrorCases, w3StaticEarlyErrorCases, w3StaticUnsupportedCases, w3StaticRejectedCases } from './phase4-next-w3-cases.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const keep = process.argv.includes('--keep'), nativeRun = !process.argv.includes('--no-native'), verbose = process.argv.includes('--verbose');
const harness = (source, input) => `${source}\nJSON.stringify((function(){try{return {value:f(${JSON.stringify(input)})};}catch(e){return {error:e&&e.name};}})())`;
const v8 = (source, input) => JSON.parse(new Script(harness(source, input)).runInNewContext({}, { timeout: 2000 }));
const compiler = fileURLToPath(new URL('./generated/compiler', import.meta.url));
const raw = source => JSON.parse(execFileSync(compiler, [source], { encoding: 'utf8', maxBuffer: 1 << 28 }));
const boot = Object.fromEntries(Object.entries(bootstrapSources).map(([name, source]) => [name, raw(source)]));
const pack = source => packProgram(attachBootstrap(raw(source), boot), entrySource(source));
const opNames = Object.keys(OP);
const wgslCases = new Set([...shader.matchAll(/case ((?:\d+u, )*\d+u):/g)].flatMap(m => m[1].split(', ').map(n => parseInt(n, 10))));

let build, runNative = null;
const failures = [];
const check = (label, fn) => { try { fn(); } catch (error) { failures.push(`${label}: ${error.message.split('\n')[0]}${'actual' in error ? ` actual=${JSON.stringify(error.actual)}` : ''}`); } };
try {
  if (nativeRun) {
    build = mkdtempSync(join(root, '.phase4-build-w3-'));
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
      try { return JSON.parse(execFileSync(join(build, 'qjs-run'), [harness(source, input)], { encoding: 'utf8' })); }
      catch (error) {
        try { return JSON.parse(error.stdout); } catch { return { harnessError: String(error.stdout || error.message).trim() }; }
      }
    };
  }

  const summary = { admitted: 0, v8: 0, native: 0, nativeDeviations: [], v8Deviations: [], earlyErrors: 0, unsupported: 0, rejected: 0, opcodes: new Set() };
  const checkPack = item => {
    const { code } = pack(item.source);
    const ops = [];
    for (let i = 0; i < code.length; i += 4) {
      const name = opNames[code[i]];
      summary.opcodes.add(name); ops.push(name);
      assert.ok(wgslCases.has(code[i]), `${name} lacks WGSL`);
    }
    if (verbose) console.log(item.feature, ops.join(' '));
    summary.admitted++;
  };
  const expectOf = item => item.throws ? { error: item.expected } : { value: item.expected };
  for (const item of [...w3StaticCases, ...w3StaticErrorCases]) {
    check(`${item.feature} [V8]`, () => {
      if (item.v8Deviation !== undefined) {
        // Recorded V8 deviation from ES2025: V8 must still reproduce it (so the
        // record stays honest); the normative expectation is checked by QuickJS.
        assert.deepEqual(v8(item.source, item.input), { value: item.v8Deviation }, 'recorded V8 deviation');
        summary.v8Deviations.push(item.feature);
      } else {
        assert.deepEqual(v8(item.source, item.input), expectOf(item));
        if (!item.throws) assert.notDeepEqual(v8(item.source, item.input + 1), expectOf(item), 'input+1 must change the result');
      }
      summary.v8++;
    });
    if (runNative) check(`${item.feature} [native QuickJS]`, () => {
      const native = runNative(item.source, item.input);
      if (item.quickjsDeviation) { summary.nativeDeviations.push({ feature: item.feature, native }); assert.notDeepEqual(native, expectOf(item), 'recorded deviation no longer reproduces'); }
      else assert.deepEqual(native, expectOf(item));
      if (item.v8Deviation !== undefined) assert.notDeepEqual(runNative(item.source, item.input + 1), expectOf(item), 'input+1 must change the result');
      summary.native++;
    });
    check(`${item.feature} [pack]`, () => checkPack(item));
  }
  for (const item of w3StaticEarlyErrorCases) {
    check(`${item.feature} [early error]`, () => {
      assert.throws(() => new Script(harness(item.source, item.input)), error => error.name === 'SyntaxError', 'V8 parse');
      if (runNative) assert.match(runNative(item.source, item.input).harnessError || '', /^SyntaxError/, 'native QuickJS parse');
      let message;
      assert.throws(() => pack(item.source), error => { message = error.message; return error instanceof SyntaxError && item.reason.test(error.message); }, 'compiler rejection');
      if (verbose) console.log(item.feature, '->', message);
      summary.earlyErrors++;
    });
  }
  for (const item of w3StaticUnsupportedCases) {
    check(`${item.feature} [unsupported]`, () => {
      assert.deepEqual(v8(item.source, item.input), { value: item.normative });
      checkPack(item); summary.unsupported++;
    });
  }
  for (const item of w3StaticRejectedCases) {
    check(`${item.feature} [rejected]`, () => {
      assert.deepEqual(v8(item.source, item.input), { value: item.normative });
      assert.throws(() => pack(item.source), error => error instanceof SyntaxError && item.reason.test(error.message));
      summary.rejected++;
    });
  }
  // 6. Proposed suite integration (phase4-patches/w3-static-suite-integration.diff)
  //    through the worker-local scratch copy w3-phase4-suite.js.
  check('suite integration [w3-phase4-suite.js]', () => {
    const records = phase4Suite().filter(record => record.module === 'n-static');
    const by = outcome => records.filter(record => record.outcome === outcome);
    assert.equal(records.length, w3StaticCases.length + w3StaticErrorCases.length + w3StaticEarlyErrorCases.length + w3StaticUnsupportedCases.length + w3StaticRejectedCases.length);
    assert.equal(by('value').length, w3StaticCases.length);
    assert.equal(by('error:TypeError').length + by('error:ReferenceError').length, w3StaticErrorCases.length);
    assert.equal(by('unsupported').length, w3StaticUnsupportedCases.length);
    assert.equal(by('rejected').length, w3StaticEarlyErrorCases.length + w3StaticRejectedCases.length);
    for (const record of records) {
      if (record.outcome === 'rejected' && w3StaticEarlyErrorCases.some(item => item.feature === record.feature)) assert.equal(record.hasNormative, false, `${record.id}: early errors carry no normative value`);
      else assert.equal(record.hasNormative, true, `${record.id}: normative result`);
    }
    for (const id of Object.keys(suiteNormativeDifferences)) assert.ok(records.some(record => record.id === id), `normative difference ${id} names a record`);
    summary.suiteRecords = records.length;
  });
  console.log(JSON.stringify({ gpuChecks: false, guestExecution: false, ...summary, opcodes: [...summary.opcodes].sort() }, null, 1));
  if (failures.length) { console.error(`${failures.length} failure(s):\n${failures.join('\n')}`); process.exitCode = 1; }
} finally {
  if (build && !keep) rmSync(build, { recursive: true, force: true });
}
