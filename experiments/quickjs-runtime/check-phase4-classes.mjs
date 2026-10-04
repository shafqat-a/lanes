// Phase 4 worker 5 host checks for classes / super / new.target. Host only:
// no GPU, no runtime.js execution, no CPU fallback.
//  1. V8 oracle (node:vm) gives each expected value; input + 1 changes it.
//  2. A native QuickJS interpreter built from vendor/ agrees (both inputs).
//  3. A private native compiler build exports bytecode; a patched copy of
//     program.js (classProgramPatches + class opcodes appended) packs every
//     admitted case. Every packed opcode is in the original OP or classOpcodes,
//     and the original program.js rejects every class case (new coverage).
//  4. Rejected cases fail in entrySource with the documented message.
//  5. Every lead-file patch anchor occurs exactly once; the patched shader.js
//     copy generates WGSL containing every class case, balanced delimiters,
//     no WGSL reserved identifiers and only known function calls.
//  6. Existing fixture corpora pack bit-identically with the patched program.js.
// Usage: node experiments/quickjs-runtime/check-phase4-classes.mjs [--keep] [--no-corpus]
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Script } from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as realProgram from './program.js';
import { attachBootstrap, bootstrapSources } from './bootstrap.js';
import * as classes from './phase4-classes.js';
import { classCases, classTypeErrorCases, classUnsupportedCases, classRejectedCases, classAdmittedElementCases } from './phase4-class-cases.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const keep = process.argv.includes('--keep');
const corpus = !process.argv.includes('--no-corpus');
const build = mkdtempSync(join(root, '.phase4-build-w5-'));
const support = ['dtoa', 'libregexp', 'libunicode', 'cutils'].map(n => `${root}vendor/${n}.c`);
const common = ['-O1', '-D_GNU_SOURCE', '-DCONFIG_VERSION="lanes-pinned"'];
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
const harness = (source, input) => `${source}\nJSON.stringify((function(){try{return {value:f(${JSON.stringify(input)})};}catch(e){return {error:e&&e.name};}})())`;
const oracle = (source, input) => JSON.parse(new Script(harness(source, input)).runInNewContext({}, { timeout: 1000 }));

// Apply {find, replace} edits; each anchor must occur exactly once.
function applyPatches(text, patches, file) {
  for (const patch of patches) {
    const count = text.split(patch.find).length - 1;
    assert.equal(count, 1, `${file} anchor ${patch.id ?? patch.find.slice(0, 40)} occurs ${count} times`);
    text = text.replace(patch.find, () => patch.replace);
  }
  return text;
}
const occurrences = (text, part) => text.split(part).length - 1;
// 'pending' (every find once, no replace) or 'applied' (every replace once and
// its find absent, unless the replacement itself contains the find text).
function patchState(text, patches, file) {
  const states = patches.map(patch => {
    const found = occurrences(text, patch.find), replaced = occurrences(text, patch.replace);
    if (found === 1 && replaced === 0) return 'pending';
    if (replaced === 1 && found === (patch.replace.includes(patch.find) ? 1 : 0)) return 'applied';
    assert.fail(`${file} patch ${patch.id}: find occurs ${found} times, replace ${replaced} times`);
  });
  assert.ok(states.every(state => state === states[0]), `${file} partially integrated: ${patches.map((p, i) => `${p.id}=${states[i]}`).join(', ')}`);
  return states[0];
}
const fileUrl = name => pathToFileURL(join(root, name)).href;
const rewriteImports = (text, overrides) => text.replace(/from '(\.\.?\/[^']+)'/g, (m, path) => `from '${overrides[path] ?? pathToFileURL(join(root, path)).href}'`);

const WGSL_RESERVED = new Set(`alias break case const const_assert continue continuing default diagnostic discard else enable false fn for if let loop override requires return struct switch true var while
NULL Self abstract active alignas alignof as asm asm_fragment async attribute auto await become binding_array cast catch class co_await co_return co_yield coherent column_major common compile compile_fragment concept const_cast consteval constexpr constinit crate debugger decltype delete demote demote_to_helper do dynamic_cast enum explicit export extends extern external fallthrough filter final finally friend from fxgroup get goto groupshared highp impl implements import inline instanceof interface layout lowp macro macro_rules match mediump meta mod module move mut mutable namespace new nil noexcept noinline nointerpolation noperspective null nullptr of operator package packoffset partition pass patch pixelfragment precise precision premerge priv protected pub public readonly ref regardless register reinterpret_cast require resource restrict self set shared sizeof smooth snorm static static_assert static_cast std subroutine super target template this thread_local throw trait try type typedef typeid typename typeof union unless unorm unsafe unsized use using varying virtual volatile wgsl where with writeonly yield`.split(/\s+/));
const WGSL_BUILTINS = new Set(['select', 'min', 'max', 'all', 'any', 'V', 'Pair', 'vec4', 'vec2', 'u32', 'i32', 'f32', 'bool', 'array', 'Node', 'Frame', 'bitcast']);

let summary;
try {
  // Private native compiler and interpreter from the current vendor/ and bridge.c.
  const inc = ['-I', `${root}vendor`];
  const compilerPath = join(build, 'compiler'), runnerPath = join(build, 'qjs-run');
  writeFileSync(join(build, 'runner.c'), runnerSource);
  execFileSync(process.env.CC || 'cc', [...common, ...inc, `${root}bridge.c`, ...support, '-lm', '-lpthread', '-o', compilerPath], { stdio: ['ignore', 'ignore', 'inherit'] });
  execFileSync(process.env.CC || 'cc', [...common, ...inc, join(build, 'runner.c'), ...support, '-lm', '-lpthread', '-o', runnerPath], { stdio: ['ignore', 'ignore', 'inherit'] });
  const compileRaw = source => JSON.parse(execFileSync(compilerPath, [source], { encoding: 'utf8', maxBuffer: 1 << 26 }));
  const runNative = script => JSON.parse(execFileSync(runnerPath, [script], { encoding: 'utf8' }));

  // Lead files are either pending (patches not applied: build patched copies
  // with a registry simulation) or integrated (patches applied: verify them in
  // place, use the real modules, and build a copy with the class patches
  // reversed as the "without classes" baseline). Mixed states fail.
  const classesUrl = fileUrl('phase4-classes.js');
  const programSource = readFileSync(join(root, 'program.js'), 'utf8');
  const shaderSource = readFileSync(join(root, 'shader.js'), 'utf8');
  const programMode = patchState(programSource, classes.classProgramPatches, 'program.js');
  const shaderMode = patchState(shaderSource, classes.classShaderPatches, 'shader.js');
  const misplaced = '@compute @workgroup_size(32)\n${phase4WGSLFunctions(phase4Context)}\n';
  const leadComputePlacementBug = shaderSource.includes(misplaced);
  let patched, unpatched, shader;
  if (programMode === 'pending') {
    const programOpAnchor = { id: 'op-append (registry simulation)', find: '  ...phase4Opcodes,\n', replace: '  ...phase4Opcodes, ...classOpcodeNames.filter(name => !phase4Opcodes.includes(name)),\n' };
    let programText = applyPatches(programSource, [programOpAnchor, ...classes.classProgramPatches], 'program.js');
    programText = `import { classProgramLowering, classRejectNode, classOpcodeNames } from '${classesUrl}';\n${rewriteImports(programText, {})}`;
    writeFileSync(join(build, 'program.js'), programText);
    patched = await import(pathToFileURL(join(build, 'program.js')).href);
    unpatched = realProgram;
  } else {
    assert.match(programSource, /import \{[^}]*classProgramLowering[^}]*\} from '\.\/phase4-classes\.js'/, 'program.js must import classProgramLowering');
    let reversed = programSource;
    for (const patch of [...classes.classProgramPatches].reverse()) reversed = reversed.replace(patch.replace, () => patch.find);
    writeFileSync(join(build, 'program-without-classes.js'), rewriteImports(reversed, {}));
    unpatched = await import(pathToFileURL(join(build, 'program-without-classes.js')).href);
    patched = realProgram;
  }
  if (shaderMode === 'pending') {
    const registrySimulation = [
      { id: 'cases (registry simulation)', find: 'const phase4Cases = phase4WGSLCases(phase4Context);', replace: 'const phase4Cases = { ...phase4WGSLCases(phase4Context), ...classWGSLCases(phase4Context) };' },
      leadComputePlacementBug
        ? { id: 'functions (registry simulation, @compute moved)', find: misplaced, replace: '${phase4WGSLFunctions(phase4Context)}\n${classWGSLFunctions(phase4Context)}\n@compute @workgroup_size(32)\n' }
        : { id: 'functions (registry simulation)', find: '@compute @workgroup_size(32)\n', replace: '${classWGSLFunctions(phase4Context)}\n@compute @workgroup_size(32)\n' },
    ];
    let shaderText = applyPatches(shaderSource, [...classes.classShaderPatches, ...registrySimulation], 'shader.js');
    shaderText = `import { classWGSLCases, classWGSLFunctions } from '${classesUrl}';\n${rewriteImports(shaderText, { './program.js': programMode === 'pending' ? pathToFileURL(join(build, 'program.js')).href : fileUrl('program.js') })}`;
    writeFileSync(join(build, 'shader.js'), shaderText);
    ({ shader } = await import(pathToFileURL(join(build, 'shader.js')).href));
  } else {
    assert.ok(programMode === 'applied', 'shader.js integrated but program.js not');
    ({ shader } = await import('./shader.js'));
  }
  const baseOP = unpatched.OP, baseEntry = unpatched.entrySource, basePack = unpatched.packProgram;

  // Opcode table: indices without classes unchanged, class opcodes present.
  for (const [name, index] of Object.entries(baseOP)) assert.equal(patched.OP[name], index, `OP index changed: ${name}`);
  for (const name of classes.classOpcodeNames) assert.ok(name in patched.OP, `class opcode missing: ${name}`);
  const allowedOps = new Set([...Object.keys(baseOP), ...classes.classOpcodeNames]);
  const opNames = Object.entries(patched.OP).reduce((names, [name, index]) => { names[index] = name; return names; }, []);

  // WGSL checks.
  const wgsl = { cases: 0, functions: 0, calls: 0 };
  for (const name of classes.classOpcodeNames) { assert.ok(shader.includes(`case ${patched.OP[name]}u:`), `WGSL case for ${name}`); wgsl.cases++; }
  for (const fn of ['classIsConstructor', 'classSetHome', 'classDefineMethod', 'classSpecialObject', 'classSuperSet']) { assert.equal(shader.split(`fn ${fn}(`).length, 2, `WGSL fn ${fn}`); wgsl.functions++; }
  for (const [open, close] of [['{', '}'], ['(', ')'], ['[', ']']]) assert.equal(shader.split(open).length, shader.split(close).length, `WGSL ${open}${close} balance`);
  assert.match(shader, /@compute @workgroup_size\(32\)\s*fn main\(/, '@compute must annotate fn main');
  assert.ok(!shader.includes('${') && !shader.includes('undefinedu'), 'unevaluated template or undefined operand in WGSL');
  const ctx = { OP: patched.OP, F: patched.FIELDS, L: patched.LIMITS };
  const snippets = [classes.classWGSLFunctions(ctx), ...Object.values(classes.classWGSLCases(ctx)), ...classes.classShaderPatches.map(p => p.replace)];
  const defined = new Set([...shader.matchAll(/\bfn\s+([A-Za-z_]\w*)\s*\(/g)].map(m => m[1]));
  for (const snippet of snippets) {
    const text = snippet.replace(/\/\/[^\n]*/g, '');
    for (const m of text.matchAll(/\b(?:let|var)\s+([A-Za-z_]\w*)/g)) assert.ok(!WGSL_RESERVED.has(m[1]), `WGSL reserved identifier: ${m[1]}`);
    for (const m of text.matchAll(/\bfn\s+\w+\s*\(([^)]*)\)/g)) for (const p of m[1].split(',').map(s => s.split(':')[0].trim()).filter(Boolean)) assert.ok(!WGSL_RESERVED.has(p), `WGSL reserved parameter: ${p}`);
    for (const m of text.replace(/\$\{[^}]*\}/g, '0').matchAll(/(?<![\w.])([A-Za-z_]\w*)\s*\(/g)) {
      if (['if', 'for', 'while', 'switch', 'return', 'fn', 'cases'].includes(m[1])) continue;
      assert.ok(defined.has(m[1]) || WGSL_BUILTINS.has(m[1]), `WGSL call to unknown function ${m[1]}`); wgsl.calls++;
    }
  }

  // Bootstrap helpers compiled by the private native compiler.
  const boot = Object.fromEntries(Object.entries(bootstrapSources).map(([k, s]) => [k, compileRaw(s)]));
  for (const [field, raw] of Object.entries(boot)) for (const fn of raw.functions) for (const i of fn.instructions)
    assert.ok(!['put_loc_check_init', 'put_var_ref_check_init', 'define_class', 'get_super'].includes(i.op), `bootstrap ${field} emits ${i.op}`);
  const packBase = (raw, source) => basePack(attachBootstrap(raw, boot), baseEntry(source));
  const packPatched = (raw, source) => patched.packProgram(attachBootstrap(raw, boot), patched.entrySource(source));
  const caseOps = (program, raw) => {
    const ops = new Set();
    for (let i = 0; i < program.code.length; i += 4) if (program.code[i + 3] < raw.functions.length) ops.add(opNames[program.code[i]]);
    return ops;
  };

  const counts = { cases: 0, typeErrorCases: 0, oracle: 0, inputSensitivity: 0, nativeInterpreter: 0, nativeDeviations: 0, admitted: 0, baseRejected: 0, unsupportedAdmitted: 0, rejected: 0, corpusSources: 0, corpusAdmittedIdentical: 0, corpusBaseRejected: 0, corpusNewlyAdmitted: 0 };
  const values = new Set(), results = [], classOpUse = {};
  for (const [list, kind] of [[classCases, 'cases'], [classTypeErrorCases, 'typeErrorCases']]) {
    for (const { feature, source, input, expected, quickjs } of list) {
      counts[kind]++;
      assert.ok(['number', 'string', 'boolean'].includes(typeof expected), feature);
      assert.ok(!values.has(JSON.stringify(expected)), `duplicate expected value: ${feature}`); values.add(JSON.stringify(expected));
      assert.deepEqual(oracle(source, input), { value: expected }, `V8 oracle: ${feature}`); counts.oracle++;
      const other = oracle(source, input + 1);
      assert.notDeepEqual(other, { value: expected }, `input sensitivity: ${feature}`); assert.ok('value' in other, `input+1 must not throw: ${feature}`); counts.inputSensitivity++;
      if (quickjs !== undefined) {
        // Documented pinned-QuickJS deviation: the native interpreter must show
        // exactly the recorded value, and it must differ from ES2025/V8.
        assert.notDeepEqual(quickjs, expected, feature);
        assert.deepEqual(runNative(harness(source, input)), { value: quickjs }, `native QuickJS deviation: ${feature}`);
        counts.nativeDeviations++;
      } else {
        assert.deepEqual(runNative(harness(source, input)), { value: expected }, `native QuickJS: ${feature}`);
        assert.deepEqual(runNative(harness(source, input + 1)), other, `native QuickJS (input+1): ${feature}`); counts.nativeInterpreter += 2;
      }
      const raw = compileRaw(source); assert.ok(!raw.error, `${feature}: ${raw.error}`);
      let baseError; try { packBase(raw, source); } catch (e) { baseError = e.message; }
      assert.ok(baseError, `original program.js already admits: ${feature}`); counts.baseRejected++;
      const program = packPatched(raw, source); counts.admitted++;
      const ops = caseOps(program, raw);
      for (const op of ops) assert.ok(allowedOps.has(op), `${feature}: packed op ${op}`);
      const used = [...ops].filter(op => classes.classOpcodeNames.includes(op) || op === 'special_object');
      for (const op of used) classOpUse[op] = (classOpUse[op] ?? 0) + 1;
      const rawOps = [...new Set(raw.functions.flatMap(fn => fn.instructions.map(i => i.op)))];
      results.push({ feature, kind, baseRejection: baseError, classOps: used, rawClassOps: rawOps.filter(op => /class|super|ctor|home|special_object|checkthis|check_init|insert4|dup3|perm5/.test(op)) });
    }
  }
  for (const { feature, source, input, expectedStatus } of classUnsupportedCases) {
    assert.equal(expectedStatus, 6);
    assert.ok('value' in oracle(source, input), `V8 oracle: ${feature}`);
    const raw = compileRaw(source); assert.ok(!raw.error, feature);
    const program = packPatched(raw, source);
    for (const op of caseOps(program, raw)) assert.ok(allowedOps.has(op), `${feature}: packed op ${op}`);
    counts.unsupportedAdmitted++; results.push({ feature, kind: 'unsupported', expectedStatus });
  }
  for (const { feature, source, input, reason } of classRejectedCases) {
    assert.ok('value' in oracle(source, input), `V8 oracle: ${feature}`);
    assert.ok(!compileRaw(source).error, `QuickJS compiles: ${feature}`);
    let message;
    try { patched.entrySource(source); } catch (e) { assert.ok(e instanceof SyntaxError, feature); message = e.message; }
    assert.match(message ?? 'admitted', reason, `rejection: ${feature}`);
    counts.rejected++; results.push({ feature, kind: 'rejected', reason: message });
  }
  // Next wave: the formerly rejected class elements pack through the
  // phase4-class-elements.js lowering (semantics: check-phase4-class-elements.mjs).
  for (const { feature, source, input, expected } of classAdmittedElementCases) {
    assert.deepEqual(oracle(source, input), { value: expected }, `V8 oracle: ${feature}`);
    const program = packPatched(compileRaw(source), source);
    for (let i = 0; i < program.code.length; i += 4) assert.ok(opNames[program.code[i]] in patched.OP, feature);
    counts.admitted++;
  }

  // Worker 8 class/new.target fixtures (report only): admission with the
  // patched program.js; other workers' opcodes may still be missing.
  const crossFixtures = [];
  try {
    const suite = await import('./phase4-regression-cases.js');
    for (const item of [...(suite.phase4RegressionCases ?? []), ...(suite.phase4NegativeCases ?? [])]) {
      if (!['class', 'new-target'].includes(item.area)) continue;
      const raw = compileRaw(item.source);
      let admission = 'admitted';
      try { packPatched(raw, item.source); } catch (e) { admission = e.message; }
      crossFixtures.push({ feature: item.feature, admission });
    }
  } catch (e) { crossFixtures.push({ error: e.message }); }

  // Existing corpora: patched packing must be bit-identical wherever the
  // original program.js admits a program.
  const corpusFailures = [], newlyAdmitted = [];
  if (corpus) {
    const files = ['cases.js', 'language-scope-cases.js', 'global-constant-cases.js', 'object-operation-cases.js', 'array-method-cases.js', 'array-extended-cases.js',
      'array-search-cases.js', 'array-shift-cases.js', 'array-mutation-cases.js', 'array-reduce-cases.js', 'string-search-cases.js', 'string-search-integration-cases.js',
      'number-cases.js', 'number-text-cases.js', 'property-key-negative-cases.js', 'object-static-descriptor-cases.js', 'array-builtin-metadata-cases.js',
      'compiler-correctness-cases.js', 'boxing-cases.js', 'boxing-integration-cases.js', 'computed-assignment-cases.js', 'high-index-cases.js',
      'foundational-language-cases.js', 'property-key-conversion-cases.js', 'string-extract-cases.js', 'number-pow-cases.js', 'compiler-review-cases.js'];
    const sources = new Set();
    const collect = v => { if (typeof v === 'string' && /^\s*function\s/.test(v)) sources.add(v); else if (v && typeof v === 'object') Object.values(v).forEach(collect); };
    for (const file of files) { try { collect(await import(`./${file}`)); } catch (e) { corpusFailures.push({ file, error: e.message }); } }
    for (const source of sources) {
      if (source.includes('\0')) continue;
      counts.corpusSources++;
      let raw; try { raw = compileRaw(source); } catch { continue; }
      // The this-init-once patch assumes only derived-constructor `this`
      // initialisation emits these opcodes (quickjs.c resolve_scope_var).
      if (!/\bclass\b/.test(source) && !raw.error) for (const fn of raw.functions) for (const i of fn.instructions)
        assert.ok(!['put_loc_check_init', 'put_var_ref_check_init'].includes(i.op), `${i.op} outside a class:\n${source}`);
      let base, baseErr; try { base = packBase(raw, source); } catch (e) { baseErr = e; }
      let next, nextErr; try { next = packPatched(raw, source); } catch (e) { nextErr = e; }
      if (base) {
        assert.ok(next, `patched program.js rejects an admitted corpus program: ${nextErr?.message}\n${source}`);
        assert.deepEqual(next.code, base.code, `packed code changed:\n${source}`);
        assert.deepEqual(next.image, base.image, `packed image changed:\n${source}`);
        counts.corpusAdmittedIdentical++;
      } else {
        counts.corpusBaseRejected++;
        if (next) { counts.corpusNewlyAdmitted++; newlyAdmitted.push({ baseRejection: baseErr.message, source }); }
      }
    }
  }
  summary = { gpuChecks: false, runtimeExecution: false, productionCPUFallback: false, nativeQuickJSReference: true, programMode, shaderMode, leadComputePlacementBug, counts, wgsl,
    patches: { shader: classes.classShaderPatches.map(p => p.id), program: classes.classProgramPatches.map(p => p.id) }, classOpUse, corpusImportFailures: corpusFailures, corpusNewlyAdmitted: newlyAdmitted, worker8ClassFixtures: crossFixtures, results };
} finally {
  if (!keep) rmSync(build, { recursive: true, force: true });
}
console.log(JSON.stringify(summary, null, 1));
