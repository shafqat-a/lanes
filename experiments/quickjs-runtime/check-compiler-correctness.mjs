// Regression checks for the local QuickJS compiler patches documented in
// compiler-correctness-notes.md. Host reference checks only: no GPU execution or production CPU fallback.
//  1. V8 host oracle confirms each fixed expected value (and input sensitivity).
//  2. A native QuickJS interpreter built from vendor/ runs the bytecode emitted by
//     the patched compiler and must give the same value (semantic reference).
//  3. The native and Wasm compiler bridges, built here into a private temp
//     directory (generated/ is not used), must emit identical raw bytecode and
//     identical packed programs, with the recorded admission status.
//  4. Bytecode invariants: every lexical const write is TDZ-checked before
//     throw_error JS_THROW_VAR_RO.
// Optional: --baseline=<path to unpatched quickjs.c> also builds the unpatched
// compiler/interpreter, requires every `regression` case to fail there, and
// requires all other fixture sources in this directory to compile identically.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Script } from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { OP, entrySource, packProgram } from './program.js';
import { attachBootstrap, bootstrapSources } from './bootstrap.js';
import { compilerCorrectnessCases } from './compiler-correctness-cases.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const baselineArg = process.argv.find(a => a.startsWith('--baseline='))?.slice(11);
const keep = process.argv.includes('--keep');
const emcc = process.argv.find(a => a.startsWith('--emcc='))?.slice(7) || process.env.EMCC || 'emcc';
const build = mkdtempSync(join(root, '.compiler-correctness-build-'));
const support = ['dtoa', 'libregexp', 'libunicode', 'cutils'].map(n => `${root}vendor/${n}.c`);
const common = ['-O2', '-D_GNU_SOURCE', '-DCONFIG_VERSION="lanes-pinned"'];

// Native QuickJS interpreter: evaluates `source` as a global script, then the entry call.
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
function buildTools(dir, quickjs) {
  // A quickjs.c next to the including file shadows vendor/ (#include "..." search order).
  if (quickjs) copyFileSync(quickjs, join(dir, 'quickjs.c'));
  const bridge = join(dir, 'bridge.c'), runner = join(dir, 'runner.c');
  copyFileSync(`${root}bridge.c`, bridge); writeFileSync(runner, runnerSource);
  const inc = ['-I', dir, '-I', `${root}vendor`];
  execFileSync(process.env.CC || 'cc', [...common, ...inc, bridge, ...support, '-lm', '-lpthread', '-o', join(dir, 'compiler')], { stdio: 'inherit' });
  execFileSync(process.env.CC || 'cc', [...common, ...inc, runner, ...support, '-lm', '-lpthread', '-o', join(dir, 'qjs-run')], { stdio: 'inherit' });
  return {
    raw: source => JSON.parse(execFileSync(join(dir, 'compiler'), [source], { encoding: 'utf8', maxBuffer: 1 << 26 })),
    run: script => JSON.parse(execFileSync(join(dir, 'qjs-run'), [script], { encoding: 'utf8' })),
  };
}
const harness = (source, input) => `${source}\nJSON.stringify((function(){try{return {value:${entrySource(source)}(${JSON.stringify(input)})};}catch(e){return {error:e&&e.name};}})())`;
const oracle = (source, input) => JSON.parse(new Script(harness(source, input)).runInNewContext({}, { timeout: 1000 }));

let summary;
try {
  const patched = buildTools(build);
  // Wasm bridge with the build.mjs flags, written to the private build directory.
  execFileSync(emcc, [...common, '-I', `${root}vendor`, `${root}bridge.c`, ...support,
    '-sMODULARIZE=1', '-sEXPORT_ES6=1', '-sENVIRONMENT=web,node', '-sALLOW_MEMORY_GROWTH=1', '-sSTACK_SIZE=1048576',
    '-sEXPORTED_FUNCTIONS=["_lanes_compile"]', '-sEXPORTED_RUNTIME_METHODS=["ccall"]', '-o', join(build, 'compiler.mjs')], { stdio: 'inherit' });
  // Same composition as createCompiler() in compiler.js, bound to this build's module.
  const module = await (await import(pathToFileURL(join(build, 'compiler.mjs')).href)).default();
  const wasmRaw = source => JSON.parse(module.ccall('lanes_compile', 'string', ['string'], [source]));
  // Atom operands are exported as strings; their 4 raw bytes are runtime atom ids,
  // which legitimately differ between the native and Wasm runtimes.
  const portable = raw => raw.error ? raw : { ...raw, functions: raw.functions.map(fn => ({ ...fn, instructions: fn.instructions.map(i =>
    typeof i.operand === 'string' ? { ...i, bytes: [i.bytes[0], ...i.bytes.slice(5)] } : i) })) };
  const wasmBoot = Object.fromEntries(Object.entries(bootstrapSources).map(([k, s]) => [k, wasmRaw(s)]));
  const nativeBoot = Object.fromEntries(Object.entries(bootstrapSources).map(([k, s]) => [k, patched.raw(s)]));
  for (const k of Object.keys(nativeBoot)) assert.deepEqual(portable(wasmBoot[k]), portable(nativeBoot[k]), `bootstrap ${k}: native/Wasm bytecode`);
  const pack = (raw, boot, source) => packProgram(attachBootstrap(raw, boot), entrySource(source));
  const opNames = Object.keys(OP);

  const counts = { cases: 0, oracle: 0, inputSensitivity: 0, sharedBindingDiscrimination: 0, nativeInterpreter: 0, nativeWasmRaw: 0, packedParity: 0, tdzInvariant: 0, admitted: 0, rejected: 0 };
  const values = new Set(), results = [];
  for (const item of compilerCorrectnessCases) {
    const { feature, source, input, expected } = item;
    counts.cases++;
    assert.ok(expected === null || ['number', 'string', 'boolean'].includes(typeof expected), feature);
    assert.ok(!values.has(JSON.stringify(expected)), `duplicate expected value: ${feature}`); values.add(JSON.stringify(expected));
    // 1. Host oracle and input sensitivity.
    assert.deepEqual(oracle(source, input), { value: expected }, `oracle: ${feature}`); counts.oracle++;
    const other = oracle(source, input + 1);
    assert.notDeepEqual(other, { value: expected }, `input sensitivity: ${feature}`); counts.inputSensitivity++;
    if ('sharedWouldGive' in item) {
      // A single shared loop binding must be observable unless this is a control.
      assert.deepEqual(oracle(source.replace(/for\((let|const) /g, 'for(var '), input), { value: item.sharedWouldGive }, `shared binding: ${feature}`);
      if (!item.control) assert.notEqual(item.sharedWouldGive, expected, feature);
      counts.sharedBindingDiscrimination++;
    }
    // 2. Native QuickJS interpreter with the patched compiler.
    assert.deepEqual(patched.run(harness(source, input)), { value: expected }, `native QuickJS: ${feature}`);
    assert.deepEqual(patched.run(harness(source, input + 1)), other, `native QuickJS (input+1): ${feature}`);
    counts.nativeInterpreter += 2;
    // 3. Native/Wasm bridge parity and admission.
    const nraw = patched.raw(source), wraw = wasmRaw(source);
    assert.deepEqual(portable(wraw), portable(nraw), `native/Wasm raw bytecode: ${feature}`); counts.nativeWasmRaw++;
    let np, wp, ne, we;
    try { np = pack(nraw, nativeBoot, source); } catch (e) { ne = e; }
    try { wp = pack(wraw, wasmBoot, source); } catch (e) { we = e; }
    assert.equal(we?.message, ne?.message, `admission parity: ${feature}`);
    const admission = ne ? 'rejected' : 'admitted';
    assert.equal(admission, item.admission, `admission ${feature}: ${ne?.message ?? 'admitted'}`);
    if (np) { assert.deepEqual(wp.code, np.code, feature); assert.deepEqual(wp.image, np.image, feature); counts.packedParity++; }
    counts[admission]++;
    // 4. TDZ invariant over every guest function of the raw bytecode.
    let checkedWrites = 0;
    for (const fn of nraw.functions || []) {
      const ins = fn.instructions;
      ins.forEach((i, k) => {
        if (i.op !== 'throw_error' || i.bytes[5] !== 0) return;
        const check = ins[k - 2], drop = ins[k - 1];
        if (item.uncheckedReadOnly) { assert.notEqual(drop?.op, 'drop', feature); return; }
        assert.ok(check && ['get_loc_check', 'get_var_ref_check'].includes(check.op) && drop.op === 'drop',
          `${feature}: throw_error JS_THROW_VAR_RO without TDZ check in ${fn.name || '<anonymous>'}`);
        checkedWrites++;
      });
    }
    if (item.bug === 'const-tdz' && !item.uncheckedReadOnly) assert.ok(checkedWrites > 0, `${feature}: expected a const write`);
    counts.tdzInvariant += checkedWrites;
    const ops = np ? [...new Set([...np.code].filter((_, i) => i % 4 === 0).map(o => opNames[o]))] : [];
    results.push({ feature, bug: item.bug, admission, ...(ne ? { reason: ne.message } : { closeLoc: ops.includes('close_loc') }) });
  }

  let baseline;
  if (baselineArg) {
    const dir = mkdtempSync(join(build, 'baseline-')), old = buildTools(dir, baselineArg);
    const fails = [], passes = [];
    for (const item of compilerCorrectnessCases) {
      const got = old.run(harness(item.source, item.input));
      (JSON.stringify(got) === JSON.stringify({ value: item.expected }) ? passes : fails).push({ feature: item.feature, got });
      if (item.regression) assert.ok(fails.some(f => f.feature === item.feature), `baseline should fail: ${item.feature}`);
    }
    // Bytecode for all other fixture sources here must be unchanged by the patch.
    const sources = new Set();
    const collect = v => { if (typeof v === 'string' && /^\s*function\s/.test(v)) sources.add(v); else if (v && typeof v === 'object') Object.values(v).forEach(collect); };
    for (const file of ['cases.js', 'language-scope-cases.js', 'global-constant-cases.js', 'object-operation-cases.js', 'array-method-cases.js',
      'array-extended-cases.js', 'array-search-cases.js', 'array-shift-cases.js', 'array-mutation-cases.js', 'array-reduce-cases.js',
      'string-search-cases.js', 'string-search-integration-cases.js', 'number-cases.js', 'number-text-cases.js', 'property-key-negative-cases.js',
      'object-static-descriptor-cases.js', 'array-builtin-metadata-cases.js'])
      collect(await import(`./${file}`));
    Object.values(bootstrapSources).forEach(s => sources.add(s));
    const changed = [];
    let unchanged = 0, skippedNul = 0;
    for (const s of sources) {
      if (s.includes('\0')) { skippedNul++; continue; } // argv cannot carry NUL

      if (JSON.stringify(old.raw(s)) === JSON.stringify(patched.raw(s))) unchanged++;
      else changed.push(s);
    }
    // Only sources with a const write or a for-statement continue may change.
    const allowed = s => /\bcontinue\b/.test(s) || /\bconst\b/.test(s);
    assert.deepEqual(changed.filter(s => !allowed(s)), [], 'patch changed unrelated bytecode');
    baseline = { regressionFailuresBeforePatch: fails.filter(f => compilerCorrectnessCases.find(c => c.feature === f.feature).regression).length,
      baselineFailures: fails, otherFixtureSources: sources.size, skippedNul, unchangedBytecode: unchanged, changedBytecode: changed };
  }

  const regressions = compilerCorrectnessCases.filter(c => c.regression).length;
  summary = { gpuChecks: false, nativeReferenceExecution: true, productionCPUFallback: false, nativeQuickJSReference: true, wasmBuild: true, counts, regressionCases: regressions, ...(baseline ? { baseline } : {}), results };
} finally {
  if (!keep) rmSync(build, { recursive: true, force: true });
}
console.log(JSON.stringify(summary, null, 1));
