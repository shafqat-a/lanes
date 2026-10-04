// Worker 2 (public class instance fields) host checks for phase4-next-w2-cases.js.
// Host only: no GPU, no CPU replay. Modelled on check-phase4-class-elements.mjs.
//  1. V8 oracle (node:vm) reproduces every fixed expectation; input + 1 changes it.
//  2. A private native QuickJS interpreter built from vendor/ agrees, except
//     for recorded `quickjsDeviation` fixtures.
//  3. Every admitted fixture packs with the native compiler + program.js and
//     every packed opcode has a WGSL switch case.
//  4. The lead-applied w2 fixes are present: defineOwnData (Array length
//     TypeError, mapped-arguments write-through) in phase4-class-elements.js
//     and the generated shader; the instance `prototype` field parser fix in
//     vendor/quickjs.c (and the compilers admit such fields).
//  5. Rejected fixtures: V8 reports an early SyntaxError and packing fails
//     with the expected compiler message.
//  6. Native/Wasm compiler parity: generated/compiler (native) and
//     generated/compiler.mjs (Wasm, via compiler.js) pack every fixture to
//     identical code and image, and reject the same early errors.
// Usage: node experiments/quickjs-runtime/check-phase4-next-w2.mjs [--keep] [--no-native] [--no-wasm]
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Script } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { OP, entrySource, packProgram } from './program.js';
import { attachBootstrap, bootstrapSources } from './bootstrap.js';
import { shader } from './shader.js';
import { createCompiler } from './compiler.js';
import { w2FieldCases, w2FieldErrorCases, w2FieldFixedCases, w2FieldRejectedCases } from './phase4-next-w2-cases.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const keep = process.argv.includes('--keep'), nativeRun = !process.argv.includes('--no-native'), wasmRun = !process.argv.includes('--no-wasm');
const harness = (source, input) => `${source}\nJSON.stringify((function(){try{return {value:f(${JSON.stringify(input)})};}catch(e){return {error:e&&e.name};}})())`;
const v8 = (source, input) => JSON.parse(new Script(harness(source, input)).runInNewContext({}, { timeout: 2000 }));
const compiler = fileURLToPath(new URL('./generated/compiler', import.meta.url));
const raw = source => JSON.parse(execFileSync(compiler, [source], { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] }));
const boot = Object.fromEntries(Object.entries(bootstrapSources).map(([name, source]) => [name, raw(source)]));
const pack = source => packProgram(attachBootstrap(raw(source), boot), entrySource(source));
const opNames = Object.keys(OP);
const wgslCases = new Set([...shader.matchAll(/case ((?:\d+u, )*\d+u):/g)].flatMap(m => m[1].split(', ').map(n => parseInt(n, 10))));

let build, runNative = null;
const failures = [];
const check = (label, fn) => { try { fn(); } catch (error) { failures.push(`${label}: ${error.message.split('\n')[0]}`); } };
const checkAsync = async (label, fn) => { try { await fn(); } catch (error) { failures.push(`${label}: ${error.message.split('\n')[0]}`); } };
try {
  if (nativeRun) {
    build = mkdtempSync(join(root, '.phase4-build-w2-'));
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
    execFileSync(process.env.CC || 'cc', ['-O1', '-w', '-D_GNU_SOURCE', '-DCONFIG_VERSION="lanes-pinned"', '-I', `${root}vendor`, join(build, 'runner.c'), ...support, '-lm', '-lpthread', '-o', join(build, 'qjs-run')], { stdio: ['ignore', 'ignore', 'inherit'] });
    runNative = (source, input) => {
      try { return JSON.parse(execFileSync(join(build, 'qjs-run'), [harness(source, input)], { encoding: 'utf8' })); }
      catch (error) { return { harnessError: String(error.stdout || error.message) }; }
    };
  }

  const summary = { admitted: 0, fixedAdmitted: 0, v8: 0, native: 0, nativeDeviations: [], rejected: 0, fixesPresent: [], opcodes: new Set() };
  const checkPack = item => {
    const { code } = pack(item.source);
    for (let i = 0; i < code.length; i += 4) {
      const name = opNames[code[i]];
      summary.opcodes.add(name);
      assert.ok(wgslCases.has(code[i]), `${name} lacks WGSL`);
    }
  };
  const expectOf = item => item.throws ? { error: item.expected } : { value: item.expected };
  const admitted = [...w2FieldCases, ...w2FieldErrorCases, ...w2FieldFixedCases];
  for (const item of admitted) {
    const label = item.feature;
    check(`${label} [V8]`, () => {
      assert.deepEqual(v8(item.source, item.input), expectOf(item));
      if (!item.throws) assert.notDeepEqual(v8(item.source, item.input + 1), expectOf(item), 'input+1 must change the result');
      summary.v8++;
    });
    if (runNative) check(`${label} [native QuickJS]`, () => {
      const native = runNative(item.source, item.input);
      if (item.quickjsDeviation) summary.nativeDeviations.push({ feature: label, native });
      else assert.deepEqual(native, expectOf(item));
      summary.native++;
    });
    check(`${label} [pack]`, () => { checkPack(item); if (w2FieldFixedCases.includes(item)) summary.fixedAdmitted++; else summary.admitted++; });
  }

  // The lead-applied w2 fixes must be present (not merely applicable).
  const lengthFixed = 'if(kind==7u&&lengthKey(l,key)){states[l].status=4u;return;}';
  const mappedFixed = 'if(node.kind==15u){if((node.marked&8u)==0u){states[l].status=4u;return;}states[l].heap[node.value.x].value=value;states[l].heap[property].marked=14u;return;}';
  check('fix present: defineOwnData Array length TypeError', () => {
    for (const text of [readFileSync(join(root, 'phase4-class-elements.js'), 'utf8'), shader]) {
      assert.equal(text.split(lengthFixed).length, 2);
      assert.ok(!text.includes('if(kind==7u&&lengthKey(l,key)){states[l].status=6u;return;}'), 'old status-6 line gone');
    }
    summary.fixesPresent.push('array-length');
  });
  check('fix present: defineOwnData mapped arguments write-through', () => {
    for (const text of [readFileSync(join(root, 'phase4-class-elements.js'), 'utf8'), shader]) {
      assert.equal(text.split(mappedFixed).length, 2);
      const start = text.indexOf('fn defineOwnData('), body = text.slice(start, text.indexOf('\n}\n', start) + 2);
      assert.ok(body.indexOf(mappedFixed) >= 0 && body.indexOf(mappedFixed) < body.indexOf('if(node.kind!=3u&&node.kind!=9u)'), 'kind 15 handled before the kind 3/9 boundary');
      assert.equal(body.split('{').length, body.split('}').length, 'balanced braces');
    }
    summary.fixesPresent.push('mapped-arguments');
  });
  check('fix present: instance prototype field (vendor/quickjs.c)', () => {
    const vendor = readFileSync(join(root, 'vendor', 'quickjs.c'), 'utf8');
    assert.match(vendor, /if \(name == JS_ATOM_constructor \|\|\s*\(is_static && name == JS_ATOM_prototype\)\) \{\s*js_parse_error\(s, "invalid field name"\);/);
    assert.ok(!vendor.includes('if (name == JS_ATOM_constructor || name == JS_ATOM_prototype) {'), 'old over-rejection gone');
    summary.fixesPresent.push('instance-prototype-field');
  });

  const rejection = source => {
    try { pack(source); } catch (error) { return String(error.stderr || '') + String(error.message); }
    return null;
  };
  for (const item of w2FieldRejectedCases) {
    check(`${item.feature} [V8 early error]`, () => assert.throws(() => new Script(item.source), SyntaxError));
    if (runNative) check(`${item.feature} [native QuickJS early error]`, () => {
      const native = runNative(item.source, item.input);
      assert.ok(native.harnessError && /SyntaxError/.test(native.harnessError), JSON.stringify(native));
    });
    check(`${item.feature} [compiler rejects]`, () => {
      const message = rejection(item.source);
      assert.ok(message !== null && item.reason.test(message), `expected rejection ${item.reason}, got ${message}`);
      summary.rejected++;
    });
  }

  // Native vs Wasm compiler parity (packing only; no execution).
  summary.wasmParity = 'skipped';
  if (wasmRun) await checkAsync('native/Wasm parity', async () => {
    const wasm = await createCompiler();
    let identical = 0, bothRejected = 0;
    for (const item of admitted) {
      const a = wasm.compile(item.source), b = pack(item.source);
      assert.deepEqual(a.code, b.code, `${item.feature}: code`);
      assert.deepEqual(a.image, b.image, `${item.feature}: image`);
      identical++;
    }
    // The Wasm path may surface the front-end parser's message rather than
    // QuickJS's (different text); parity requires a SyntaxError rejection.
    const messages = [];
    for (const item of w2FieldRejectedCases) {
      let rejected = null;
      try { wasm.compile(item.source); } catch (error) { rejected = error; }
      assert.ok(rejected && (rejected instanceof SyntaxError || rejected.name === 'SyntaxError'), `${item.feature}: Wasm must reject with SyntaxError, got ${rejected}`);
      if (!item.reason.test(String(rejected.message))) messages.push({ feature: item.feature, wasm: String(rejected.message) });
      bothRejected++;
    }
    summary.wasmParity = { identicalPrograms: identical, bothRejected, differentRejectionText: messages };
  });

  console.log(JSON.stringify({ gpuChecks: false, guestExecution: false, ...summary, opcodes: [...summary.opcodes].length, failures }, null, 1));
  if (failures.length) process.exitCode = 1;
} finally {
  if (build && !keep) rmSync(build, { recursive: true, force: true });
}
