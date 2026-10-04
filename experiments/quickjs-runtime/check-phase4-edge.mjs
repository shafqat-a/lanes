// Phase 4 worker 7: this / arguments / call / declaration edge cases.
// Host checks only. No GPU, no runtime.js, no production CPU fallback:
//  1. V8 (`node:vm`) oracle confirms each fixed ES2025 expected value; the
//     result for input+1 must differ (input sensitivity).
//  2. Native QuickJS interpreters built from vendor/ into a private
//     `.phase4-build-w7-*` directory run every case (semantic reference):
//       current = vendor/quickjs.c as is,
//       patched = vendor/quickjs.c + phase4-patches/w7-*.diff (skipped per patch
//                 when its marker shows it is already integrated).
//     Patched must match the oracle everywhere. Current must match except
//     `regression` cases of a non-integrated patch, which must still fail there
//     and must change raw bytecode (so the GPU executes different code).
//  3. Admission inventory: the CURRENT program.js packProgram on the private
//     native compiler output with bootstrap attached; current and patched
//     compilers must agree and match the recorded `admission`. Admitted guest
//     opcodes must all have a WGSL case in shader.js.
//  4. Patch delta: every other `*-cases.js` function source and every bootstrap
//     source must compile to identical raw bytecode unless it contains an
//     if-clause FunctionDeclaration or a FunctionDeclaration named `arguments`.
// Usage: node check-phase4-edge.mjs [--keep] [--no-delta]
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Script } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import { OP, entrySource, packProgram } from './program.js';
import { attachBootstrap, bootstrapSources } from './bootstrap.js';
import { edgeCases, edgeTypeErrorCases, edgeUnsupportedCases, edgePatches, edgePatchMarkers } from './phase4-edge-cases.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const keep = process.argv.includes('--keep');
const delta = !process.argv.includes('--no-delta');
const build = mkdtempSync(join(root, '.phase4-build-w7-'));
const support = ['dtoa', 'libregexp', 'libunicode', 'cutils'].map(n => `${root}vendor/${n}.c`);
const common = ['-O2', '-D_GNU_SOURCE', '-DCONFIG_VERSION="lanes-pinned"'];
const runnerSource = `#include "quickjs.c"
int main(int argc, char **argv) {
    if (argc != 2) return 2;
    JSRuntime *rt = JS_NewRuntime(); JSContext *ctx = JS_NewContext(rt);
    JSValue v = JS_Eval(ctx, argv[1], strlen(argv[1]), "case.js", JS_EVAL_TYPE_GLOBAL);
    if (JS_IsException(v)) { JSValue e = JS_GetException(ctx); const char *m = JS_ToCString(ctx, e);
        printf("{\\"harnessError\\":\\"%s\\"}\\n", m ? m : "?"); return 1; }
    const char *s = JS_ToCString(ctx, v); puts(s ? s : "null");
    JS_FreeCString(ctx, s); JS_FreeValue(ctx, v); JS_FreeContext(ctx); JS_FreeRuntime(rt); return 0;
}
`;
function buildTools(dir, quickjsDir) {
  mkdirSync(dir, { recursive: true });
  const runner = join(dir, 'runner.c'); writeFileSync(runner, runnerSource);
  // -I order: a patched quickjs.c (if any) shadows vendor/quickjs.c; headers come from vendor/.
  const inc = [...(quickjsDir ? ['-I', quickjsDir] : []), '-I', `${root}vendor`];
  const cc = process.env.CC || 'cc', opts = { stdio: ['ignore', 'ignore', 'ignore'] };
  execFileSync(cc, [...common, ...inc, `${root}bridge.c`, ...support, '-lm', '-lpthread', '-o', join(dir, 'compiler')], opts);
  execFileSync(cc, [...common, ...inc, runner, ...support, '-lm', '-lpthread', '-o', join(dir, 'qjs-run')], opts);
  const cache = new Map();
  return {
    raw: source => {
      if (!cache.has(source)) cache.set(source, execFileSync(join(dir, 'compiler'), [source], { encoding: 'utf8', maxBuffer: 1 << 26 }));
      return JSON.parse(cache.get(source));
    },
    run: script => JSON.parse(execFileSync(join(dir, 'qjs-run'), [script], { encoding: 'utf8' })),
  };
}
const harness = (source, input) => `${source}\nJSON.stringify((function(){try{return {value:${entrySource(source)}(${JSON.stringify(input)})};}catch(e){return {error:e&&e.name};}})())`;
const oracle = (source, input) => JSON.parse(new Script(harness(source, input)).runInNewContext({}, { timeout: 1000 }));
const primitive = v => v === null || ['number', 'string', 'boolean'].includes(typeof v);
const opNames = Object.keys(OP);
const shaderText = readFileSync(new URL('./shader.js', import.meta.url), 'utf8');
const shaderOps = new Set([...shaderText.matchAll(/cases\('([^']+)'/g)].flatMap(m => m[1].split(' ')));
for (const m of shaderText.matchAll(/\[((?:'[a-z0-9_]+',?)+)\]\.map\(\(name/g)) for (const n of m[1].matchAll(/'([a-z0-9_]+)'/g)) shaderOps.add(n[1]);
// Phase 4 registry cases are generated, not literal: shader.js exports their names.
const { phase4ShaderOps = [] } = await import('./shader.js');
for (const name of phase4ShaderOps) shaderOps.add(name);

// Sources whose bytecode the w7 patches may legitimately change.
function patchSensitive(source) {
  let ast; try { ast = parse(source, { ecmaVersion: 2025 }); } catch { return false; }
  const nodes = [ast];
  while (nodes.length) {
    const node = nodes.pop();
    if (node.type === 'IfStatement' && [node.consequent, node.alternate].some(c => c?.type === 'FunctionDeclaration')) return true;
    if (node.type === 'FunctionDeclaration' && node.id?.name === 'arguments') return true;
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) { for (const child of value) if (child && typeof child.type === 'string') nodes.push(child); }
      else if (value && typeof value.type === 'string') nodes.push(value);
    }
  }
  return false;
}

let summary;
try {
  const vendorText = readFileSync(`${root}vendor/quickjs.c`, 'utf8');
  const integrated = Object.fromEntries(Object.entries(edgePatchMarkers).map(([k, marker]) => [k, vendorText.includes(marker)]));
  const pending = Object.keys(edgePatches).filter(k => !integrated[k]);
  const current = buildTools(join(build, 'current'));
  let patched = current;
  if (pending.length) {
    const dir = join(build, 'patched-src'); mkdirSync(dir);
    copyFileSync(`${root}vendor/quickjs.c`, join(dir, 'quickjs.c'));
    for (const k of pending) execFileSync('patch', ['-s', '--no-backup-if-mismatch', join(dir, 'quickjs.c'), `${root}${edgePatches[k]}`], { stdio: 'inherit' });
    patched = buildTools(join(build, 'patched'), dir);
  }
  const boots = tools => Object.fromEntries(Object.entries(bootstrapSources).map(([k, s]) => [k, tools.raw(s)]));
  const currentBoot = boots(current), patchedBoot = pending.length ? boots(patched) : currentBoot;
  // Invariant: no bootstrap helper binds a sloppy this. push_this boxes a primitive
  // receiver in place (Frame.receiver), and continuations such as get_array_el3's
  // tail 7 reuse Frame.receiver of a helper frame as private storage.
  const sloppyThisHelpers = Object.entries(patchedBoot).flatMap(([k, raw]) => raw.functions
    .filter(fn => !fn.strict && fn.instructions.some(i => i.op === 'push_this')).map(fn => `${k}:${fn.name}`));
  assert.deepEqual(sloppyThisHelpers, [], 'bootstrap helper with sloppy this');
  const admission = (tools, boot, source) => {
    try { packProgram(attachBootstrap(tools.raw(source), boot), entrySource(source)); return { admission: 'admitted' }; }
    catch (e) { return { admission: 'rejected', reason: `${e.name}: ${e.message}` }; }
  };

  const counts = { cases: 0, oracle: 0, inputSensitivity: 0, nativeCurrent: 0, nativePatched: 0, admission: 0, regressionFailsBeforePatch: 0, regressionBytecodeChanged: 0 };
  const features = new Set(), inventory = [], nativeDifferences = [];
  const groups = [['edge', edgeCases], ['typeError', edgeTypeErrorCases], ['unsupported', edgeUnsupportedCases]];
  for (const [group, list] of groups) for (const item of list) {
    const { feature, source, input, expected } = item;
    counts.cases++;
    assert.ok(!features.has(feature), `duplicate feature ${feature}`); features.add(feature);
    assert.ok(primitive(expected), feature);
    assert.ok(['pass', 'compiler-bug', 'explicit-unsupported'].includes(item.classification), feature);
    // 1. Host oracle.
    const want = item.throws ? { error: expected } : { value: expected };
    assert.deepEqual(oracle(source, input), want, `oracle: ${feature}`); counts.oracle++;
    const other = oracle(source, input + 1);
    assert.notDeepEqual(other, want, `input sensitivity: ${feature}`); counts.inputSensitivity++;
    // 2. Native QuickJS references.
    const pRun = [patched.run(harness(source, input)), patched.run(harness(source, input + 1))];
    assert.deepEqual(pRun, [want, other], `native QuickJS (patched): ${feature}`); counts.nativePatched += 2;
    const cRun = [current.run(harness(source, input)), current.run(harness(source, input + 1))];
    counts.nativeCurrent += 2;
    const regressionPending = item.regression && !integrated[item.regression];
    if (regressionPending) {
      assert.notDeepEqual(cRun[0], want, `regression should fail before ${item.regression}: ${feature}`);
      assert.notDeepEqual(current.raw(source), patched.raw(source), `regression bytecode unchanged: ${feature}`);
      counts.regressionFailsBeforePatch++; counts.regressionBytecodeChanged++;
      nativeDifferences.push({ feature, patch: item.regression, currentVendor: cRun[0], expected: want });
    } else {
      assert.deepEqual(cRun, [want, other], `native QuickJS (current vendor): ${feature}`);
    }
    // 3. Admission (current program.js) for current and patched compiler output.
    const a = admission(patched, patchedBoot, source), b = admission(current, currentBoot, source);
    assert.deepEqual(a, b, `admission differs between current and patched compiler: ${feature}`);
    assert.equal(a.admission, item.admission, `admission ${feature}: ${a.reason ?? 'admitted'}`); counts.admission++;
    const row = { group, feature, classification: item.classification, admission: a.admission };
    if (item.regression) row.regression = item.regression;
    if (a.reason) {
      row.reason = a.reason;
      assert.match(a.reason, /^SyntaxError: Unsupported /, `rejection must be an explicit unsupported message: ${feature}`);
    } else {
      const raw = patched.raw(source);
      const { code } = packProgram(raw, entrySource(source)), ops = new Set();
      for (let i = 0; i < code.length; i += 4) { const name = opNames[code[i]]; ops.add(['special_object', 'throw_error'].includes(name) ? `${name}/${code[i + 1]}` : name); }
      row.ops = [...ops].sort();
      row.shaderMissing = row.ops.filter(op => !shaderOps.has(op.split('/')[0]));
      assert.deepEqual(row.shaderMissing, [], `guest opcode without WGSL case: ${feature}`);
      // Sloppy functions that bind this (push_this in the prologue): the runtime
      // reports status 6 if one is entered with an undefined/null receiver.
      row.sloppyThisFunctions = raw.functions.filter(fn => !fn.strict && fn.instructions.some(i => i.op === 'push_this')).map(fn => fn.name || '<anonymous>');
      if (item.mechanism === 'runtime-status-6') assert.ok(row.sloppyThisFunctions.length > 0, `status-6 evidence (sloppy push_this) missing: ${feature}`);
    }
    inventory.push(row);
  }
  const values = edgeCases.map(c => JSON.stringify(c.expected));
  assert.equal(new Set(values).size, values.length, 'edgeCases expected values must be distinct');

  // 4. Patch delta over the other fixture sources and bootstrap sources.
  let deltaReport = { skipped: pending.length ? 'disabled (--no-delta)' : 'all w7 patches already integrated' };
  if (delta && pending.length) {
    const sources = new Set(), skippedFiles = [];
    const collect = v => { if (typeof v === 'string' && /^\s*function\s/.test(v)) sources.add(v); else if (v && typeof v === 'object') Object.values(v).forEach(collect); };
    for (const file of readdirSync(root).filter(f => /-cases\.js$/.test(f)).sort()) {
      try { collect(await import(`./${file}`)); } catch (e) { skippedFiles.push({ file, error: e.message.slice(0, 120) }); }
    }
    Object.values(bootstrapSources).forEach(s => sources.add(s));
    const changed = [];
    let unchanged = 0, skippedArgv = 0;
    for (const s of sources) {
      if (s.includes('\0') || s.length > 100000) { skippedArgv++; continue; }
      if (JSON.stringify(current.raw(s)) === JSON.stringify(patched.raw(s))) unchanged++; else changed.push(s);
    }
    const unexpected = changed.filter(s => !patchSensitive(s));
    assert.deepEqual(unexpected, [], 'w7 patches changed bytecode of unrelated sources');
    deltaReport = { sources: sources.size, unchanged, changed: changed.length, changedSources: changed, skippedArgv, skippedFiles };
  }

  const byClass = {};
  for (const r of inventory) byClass[r.classification] = (byClass[r.classification] || 0) + 1;
  summary = { gpuChecks: false, runtimeExecution: false, productionCPUFallback: false, nativeReferenceExecution: true,
    patches: Object.fromEntries(Object.entries(edgePatches).map(([k, p]) => [k, { diff: p, integratedInVendor: integrated[k] }])),
    counts, classification: byClass, bootstrapHelpers: Object.keys(patchedBoot).length, sloppyThisHelpers, nativeDifferences, delta: deltaReport, inventory };
} finally {
  if (!keep) rmSync(build, { recursive: true, force: true });
}
console.log(JSON.stringify(summary, null, 1));
