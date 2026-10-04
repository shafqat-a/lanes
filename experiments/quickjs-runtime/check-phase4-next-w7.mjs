// Phase 4 next wave, worker 7 host check: function/class metadata and
// constructor/new.target/super audit (phase4-next-w7-cases.js).
// Host only: no GPU, no CPU replay.
//  1. V8 oracle (node:vm) reproduces every fixed expectation; input + 1 changes it.
//  2. A private native QuickJS interpreter built from vendor/ agrees, except
//     for recorded `quickjsDeviation` fixtures.
//  3. Every admitted fixture packs with the coordinator's native compiler and
//     the integrated program.js, and every packed opcode has a WGSL case.
//  4. Declared boundaries: unsupported fixtures pack (runtime status 6 is the
//     GPU obligation); rejected fixtures stay compiler-rejected.
//  5. WGSL anchors the audit relies on (metadata flags, key order, ctor checks).
// Usage: node experiments/quickjs-runtime/check-phase4-next-w7.mjs [--keep] [--no-native]
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Script } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { OP, entrySource, packProgram } from './program.js';
import { attachBootstrap, bootstrapSources } from './bootstrap.js';
import { shader } from './shader.js';
import { w7NextCases, w7NextErrorCases, w7NextUnsupportedCases, w7NextRejectedCases } from './phase4-next-w7-cases.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const keep = process.argv.includes('--keep'), nativeRun = !process.argv.includes('--no-native');
const harness = (source, input) => `${source}\nJSON.stringify((function(){try{return {value:f(${JSON.stringify(input)})};}catch(e){return {error:e&&e.name};}})())`;
const v8 = (source, input) => JSON.parse(new Script(harness(source, input)).runInNewContext({}, { timeout: 2000 }));
const compiler = fileURLToPath(new URL('./generated/compiler', import.meta.url));
const raw = source => JSON.parse(execFileSync(compiler, [source], { encoding: 'utf8', maxBuffer: 1 << 28 }));
const boot = Object.fromEntries(Object.entries(bootstrapSources).map(([name, source]) => [name, raw(source)]));
const pack = source => packProgram(attachBootstrap(raw(source), boot), entrySource(source));
const opNames = Object.keys(OP);
const wgslCases = new Set([...shader.matchAll(/case ((?:\d+u, )*\d+u):/g)].flatMap(m => m[1].split(', ').map(n => parseInt(n, 10))));

let build, runNative = null;
try {
  if (nativeRun) {
    build = mkdtempSync(join(root, '.phase4-build-w7next-'));
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
      catch (error) { return { harnessError: String(error.stdout || error.message) }; }
    };
  }

  const summary = { admitted: 0, v8: 0, native: 0, nativeDeviations: [], unsupported: 0, rejected: 0, opcodes: new Set() };
  const checkPack = item => {
    const { code } = pack(item.source);
    for (let i = 0; i < code.length; i += 4) {
      const name = opNames[code[i]];
      summary.opcodes.add(name);
      assert.ok(wgslCases.has(code[i]), `${item.feature}: ${name} lacks WGSL`);
    }
    summary.admitted++;
  };
  const expectOf = item => item.throws ? { error: item.expected } : { value: item.expected };
  for (const item of [...w7NextCases, ...w7NextErrorCases]) {
    assert.deepEqual(v8(item.source, item.input), expectOf(item), `${item.area}/${item.feature}: V8 oracle`);
    if (!item.throws) assert.notDeepEqual(v8(item.source, item.input + 1), expectOf(item), `${item.area}/${item.feature}: input+1 must change the result`);
    summary.v8++;
    if (runNative) {
      const native = runNative(item.source, item.input);
      if (item.quickjsDeviation) {
        assert.notDeepEqual(native, expectOf(item), `${item.feature}: recorded QuickJS deviation no longer reproduces`);
        if (item.quickjs !== undefined) assert.deepEqual(native, item.quickjs, `${item.feature}: recorded QuickJS result`);
        summary.nativeDeviations.push(item.feature);
      } else assert.deepEqual(native, expectOf(item), `${item.area}/${item.feature}: native QuickJS`);
      summary.native++;
    }
    checkPack(item);
  }
  for (const item of w7NextUnsupportedCases) {
    assert.deepEqual(v8(item.source, item.input), { value: item.normative }, `${item.feature}: normative`);
    checkPack(item); summary.unsupported++;
  }
  for (const item of w7NextRejectedCases) {
    assert.throws(() => pack(item.source), error => error instanceof SyntaxError && item.reason.test(error.message), `${item.feature} must stay rejected`);
    summary.rejected++;
  }
  assert.ok(w7NextCases.length + w7NextErrorCases.length >= 40, 'at least 40 executable fixtures');

  // WGSL anchors for the audited metadata (flags: 2 writable, 4 enumerable, 8 configurable).
  const anchors = {
    'closure length/name configurable only': 'states[l].heap[length].marked=8u;',
    'closure prototype writable only': 'states[l].heap[property].marked=2u;states[l].heap[backing].next=property;',
    'class prototype all-false': 'states[l].heap[property].marked=0u;states[l].heap[backing].next=property;',
    'prototype.constructor writable+configurable': 'states[l].heap[constructor].marked=10u;',
    'bound length/name configurable only': 'states[l].heap[nameProperty].marked=8u;',
    'class element non-enumerable': 'states[l].heap[property].marked=10u;\n}',
    'own keys restore creation order': 'nextName--;dataProperty(l,result,0x80000000u|nextName,keyName(l,node.key),7u);',
    'class ctor [[Call]] TypeError': `if(states[l].heap[states[l].env].value.w==0u){states[l].status=4u;}`,
    'non-constructor [[Construct]] TypeError': 'if((info.w&0x10000u)==0u&&(classFlags&1u)==0u){states[l].status=4u;return;}',
    'bound [[Construct]] newTarget': 'if(equal(l,callee,constructTarget)){constructTarget=inner;}',
  };
  for (const [what, text] of Object.entries(anchors)) assert.ok(shader.includes(text), `WGSL anchor: ${what}`);
  console.log(JSON.stringify({ gpuChecks: false, guestExecution: false, ...summary, opcodes: [...summary.opcodes].length }, null, 1));
} finally {
  if (build && !keep) rmSync(build, { recursive: true, force: true });
}
