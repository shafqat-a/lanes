// Phase 4 worker 1 host checks for tagged templates / template objects /
// String.raw. Host only: no GPU, no WGSL compilation, no CPU replay.
//  1. Lead files (phase4-registry.js, program.js, shader.js, bridge.c) are
//     either all pending or all integrated; every patch anchor occurs once and
//     the bridge diff applies cleanly (patch -p0 --dry-run).
//  2. Private native builds in .phase4-build-w1-*: base compiler (bridge
//     without the template patch), patched compiler, native QuickJS interpreter.
//  3. Private module copies (imports rewritten): base, "lowering-only"
//     (program.js patches + push_template opcode, no FIELDS/bootstrap change)
//     and full (all patches).
//  4. Fixtures: V8 oracle + native QuickJS on input and input+1; every admitted
//     case packs with the full variant, the base variant rejects it, every
//     packed opcode has a WGSL case, and the packed template descriptors equal
//     acorn's cooked/raw strings for every tagged site.
//  5. Corpora: patched compiler output equals the base output (modulo the
//     features list) for every source without a tagged template; lowering-only
//     packing is bit-identical to base; full packing admits the same programs
//     with the same user-function opcode sequence (FIELDS "raw" and the
//     String.raw helper shift image offsets: intended change).
//  6. WGSL lint of the full shader (reserved identifiers, balance, @compute
//     placement, known calls, fixed node 64 layout from phase4-fixed-nodes.js:
//     free-list/sweep exclusion of 26..79, in-place init, GC root marking).
//  7. Early errors (tagged templates in optional chains, untagged invalid
//     escapes): SyntaxError in V8, native QuickJS and packProgram.
// Usage: node experiments/quickjs-runtime/check-phase4-templates.mjs [--keep] [--no-corpus]
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Script } from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse } from 'acorn';
import * as T from './phase4-templates.js';
import * as N from './phase4-fixed-nodes.js';
import * as C from './phase4-template-tagged-cases.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const keep = process.argv.includes('--keep');
const corpus = !process.argv.includes('--no-corpus');
mkdirSync(join(root, '.w1-build'), { recursive: true });
const build = mkdtempSync(join(root, '.w1-build', 'templates-'));
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
const oracle = (source, input) => JSON.parse(new Script(harness(source, input)).runInNewContext({}, { timeout: 2000 }));

const occurrences = (text, part) => text.split(part).length - 1;
function applyPatches(text, patches, file) {
  for (const patch of patches) {
    const count = occurrences(text, patch.find);
    assert.equal(count, 1, `${file} anchor ${patch.id} occurs ${count} times`);
    text = text.replace(patch.find, () => patch.replace);
  }
  return text;
}
function reversePatches(text, patches, file) {
  for (const patch of [...patches].reverse()) {
    assert.equal(occurrences(text, patch.replace), 1, `${file} applied patch ${patch.id} not found once`);
    text = text.replace(patch.replace, () => patch.find);
  }
  return text;
}
function patchState(text, patches, file) {
  const states = patches.map(patch => {
    const found = occurrences(text, patch.find), replaced = occurrences(text, patch.replace);
    if (found === 1 && replaced === 0) return 'pending';
    if (replaced === 1 && found === (patch.replace.includes(patch.find) ? 1 : 0)) return 'applied';
    assert.fail(`${file} patch ${patch.id}: find occurs ${found} times, replace ${replaced} times`);
  });
  assert.ok(states.every(s => s === states[0]), `${file} partially integrated: ${patches.map((p, i) => `${p.id}=${states[i]}`).join(', ')}`);
  return states[0];
}
const rewriteImports = (text, overrides) => text.replace(/from '(\.\.?\/[^']+)'/g, (m, path) => `from '${overrides[path] ?? pathToFileURL(join(root, path)).href}'`);

const WGSL_RESERVED = new Set(`alias break case const const_assert continue continuing default diagnostic discard else enable false fn for if let loop override requires return struct switch true var while
NULL Self abstract active alignas alignof as asm asm_fragment async attribute auto await become binding_array cast catch class co_await co_return co_yield coherent column_major common compile compile_fragment concept const_cast consteval constexpr constinit crate debugger decltype delete demote demote_to_helper do dynamic_cast enum explicit export extends extern external fallthrough filter final finally friend from fxgroup get goto groupshared highp impl implements import inline instanceof interface layout lowp macro macro_rules match mediump meta mod module move mut mutable namespace new nil noexcept noinline nointerpolation noperspective null nullptr of operator package packoffset partition pass patch pixelfragment precise precision premerge priv protected pub public readonly ref regardless register reinterpret_cast require resource restrict self set shared sizeof smooth snorm static static_assert static_cast std subroutine super target template this thread_local throw trait try type typedef typeid typename typeof union unless unorm unsafe unsized use using varying virtual volatile wgsl where with writeonly yield`.split(/\s+/));
const WGSL_BUILTINS = new Set(['select', 'min', 'max', 'all', 'any', 'V', 'Pair', 'vec4', 'vec2', 'u32', 'i32', 'f32', 'bool', 'array', 'Node', 'Frame', 'bitcast']);

// Tagged template sites in source order: [cooked (null = undefined), raw].
function taggedSites(source) {
  const sites = [];
  const visit = node => {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'TaggedTemplateExpression') sites.push(JSON.stringify([node.quasi.quasis.map(q => q.value.cooked ?? null), node.quasi.quasis.map(q => q.value.raw)]));
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit); else if (value && typeof value === 'object') visit(value);
    }
  };
  visit(parse(source, { ecmaVersion: 2025 }));
  return sites;
}

let summary;
try {
  // 1. Integration state of lead-owned files.
  const leadFiles = { 'phase4-registry.js': T.templateRegistryPatches, 'program.js': T.templateProgramPatches, 'shader.js': T.templateShaderPatches };
  const current = Object.fromEntries(Object.keys(leadFiles).map(file => [file, readFileSync(join(root, file), 'utf8')]));
  const modes = Object.fromEntries(Object.entries(leadFiles).map(([file, patches]) => [file, patchState(current[file], patches, file)]));
  const mode = modes['program.js'];
  assert.ok(Object.values(modes).every(m => m === mode), `lead files partially integrated: ${JSON.stringify(modes)}`);
  const baseText = Object.fromEntries(Object.entries(leadFiles).map(([file, patches]) => [file, mode === 'pending' ? current[file] : reversePatches(current[file], patches, file)]));
  const diffPath = join(root, T.templateNativePatches[0].diff);
  const bridgeText = readFileSync(join(root, 'bridge.c'), 'utf8');
  const bridgeMode = bridgeText.includes(T.TAGGED_TEMPLATE_FEATURE) ? 'applied' : 'pending';
  const bridgeDirs = { base: join(build, 'bridge-base'), full: join(build, 'bridge-full') };
  for (const dir of Object.values(bridgeDirs)) { mkdirSync(dir); copyFileSync(join(root, 'bridge.c'), join(dir, 'bridge.c')); }
  // patch -p0 from the directory holding bridge.c (= experiments/quickjs-runtime layout).
  if (bridgeMode === 'pending') {
    execFileSync('patch', ['--dry-run', '-s', '-p0', '-i', diffPath], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] });
    execFileSync('patch', ['-s', '-p0', '-i', diffPath], { cwd: bridgeDirs.full, stdio: ['ignore', 'ignore', 'inherit'] });
  } else {
    execFileSync('patch', ['-s', '-R', '-p0', '-i', diffPath], { cwd: bridgeDirs.base, stdio: ['ignore', 'ignore', 'inherit'] });
  }
  const gitApply = (() => { try { execFileSync('git', ['apply', '--check', '-p0', ...(bridgeMode === 'applied' ? ['-R'] : []), diffPath], { cwd: root, stdio: 'ignore' }); return 'ok'; } catch { return 'failed'; } })();
  assert.equal(gitApply, 'ok', 'git apply --check -p0 of the bridge diff');

  // 2. Private native builds.
  const cc = process.env.CC || 'cc';
  const compileBridge = (dir, out) => execFileSync(cc, [...common, '-I', dir, '-I', `${root}vendor`, join(dir, 'bridge.c'), ...support, '-lm', '-lpthread', '-o', out], { stdio: ['ignore', 'ignore', 'ignore'] });
  compileBridge(bridgeDirs.base, join(build, 'compiler-base'));
  compileBridge(bridgeDirs.full, join(build, 'compiler-full'));
  writeFileSync(join(build, 'runner.c'), runnerSource);
  execFileSync(cc, [...common, '-I', `${root}vendor`, join(build, 'runner.c'), ...support, '-lm', '-lpthread', '-o', join(build, 'qjs-run')], { stdio: ['ignore', 'ignore', 'ignore'] });
  const compiler = path => source => JSON.parse(execFileSync(path, [source], { encoding: 'utf8', maxBuffer: 1 << 26 }));
  const rawBase = compiler(join(build, 'compiler-base')), rawFull = compiler(join(build, 'compiler-full'));
  const runNative = script => JSON.parse(execFileSync(join(build, 'qjs-run'), [script], { encoding: 'utf8', maxBuffer: 1 << 26 }));

  // 3. Module variants.
  const opsOnly = T.templateRegistryPatches.filter(p => ['registry-import', 'registry-opcodes', 'registry-wgsl-cases', 'registry-wgsl-functions'].includes(p.id));
  const variantFiles = {
    base: { 'phase4-registry.js': baseText['phase4-registry.js'], 'program.js': baseText['program.js'], 'shader.js': baseText['shader.js'] },
    ops: { 'phase4-registry.js': applyPatches(baseText['phase4-registry.js'], opsOnly, 'registry'), 'program.js': applyPatches(baseText['program.js'], T.templateProgramPatches, 'program.js') },
    full: Object.fromEntries(Object.entries(leadFiles).map(([file, patches]) => [file, applyPatches(baseText[file], patches, file)])),
  };
  const variants = {};
  for (const [name, files] of Object.entries(variantFiles)) {
    const url = file => pathToFileURL(join(build, `${name}-${file}`)).href;
    const overrides = { './phase4-registry.js': url('phase4-registry.js'), './bootstrap.js': url('bootstrap.js'), './program.js': url('program.js') };
    writeFileSync(join(build, `${name}-phase4-registry.js`), rewriteImports(files['phase4-registry.js'], overrides));
    writeFileSync(join(build, `${name}-bootstrap.js`), rewriteImports(readFileSync(join(root, 'bootstrap.js'), 'utf8'), overrides));
    writeFileSync(join(build, `${name}-program.js`), rewriteImports(files['program.js'], overrides));
    const program = await import(url('program.js'));
    const bootstrap = await import(url('bootstrap.js'));
    const registry = await import(url('phase4-registry.js'));
    let shader;
    if (files['shader.js']) { writeFileSync(join(build, `${name}-shader.js`), rewriteImports(files['shader.js'], overrides)); ({ shader } = await import(url('shader.js'))); }
    variants[name] = { program, bootstrap, registry, shader };
  }
  const { base, ops, full } = variants;
  // Opcode / FIELDS stability.
  for (const [opName, index] of Object.entries(base.program.OP)) { assert.equal(full.program.OP[opName], index, `OP index changed: ${opName}`); assert.equal(ops.program.OP[opName], index); }
  for (const [field, index] of Object.entries(base.program.FIELDS)) assert.equal(full.program.FIELDS[field], index, `FIELDS index changed: ${field}`);
  assert.deepEqual(Object.keys(full.program.FIELDS).slice(Object.keys(base.program.FIELDS).length), ['raw'], 'FIELDS appends exactly "raw"');
  assert.deepEqual(ops.program.FIELDS, base.program.FIELDS);
  assert.equal(full.program.OP.push_template, Object.keys(base.program.OP).length, 'push_template appended last');
  assert.equal(full.program.LIMITS.args, 16);
  assert.equal(full.bootstrap.privateBuiltins.__lanesToObject, 926);

  // Bootstraps compiled with the matching compilers.
  const compileBoot = (sources, raw) => Object.fromEntries(Object.entries(sources).map(([k, s]) => [k, raw(s)]));
  const bootBase = compileBoot(base.bootstrap.bootstrapSources, rawBase);
  const bootOps = compileBoot(ops.bootstrap.bootstrapSources, rawFull);
  const bootFull = compileBoot(full.bootstrap.bootstrapSources, rawFull);
  assert.deepEqual(Object.keys(bootFull).filter(k => !(k in bootBase)), ['raw']);
  for (const [field, raw] of Object.entries(bootFull)) for (const fn of raw.functions) for (const i of fn.instructions)
    assert.ok(!['push_const', 'push_const8'].includes(i.op) || !('template' in (fn.constants[i.operand] ?? {})), `bootstrap ${field} uses a tagged template`);
  const pack = (variant, boot, raw, source) => variant.program.packProgram(variant.bootstrap.attachBootstrap(raw, boot), variant.program.entrySource(source));
  const packBase = (source, raw = rawBase(source)) => pack(base, bootBase, raw, source);
  const packOps = (source, raw = rawFull(source)) => pack(ops, bootOps, raw, source);
  const packFull = (source, raw = rawFull(source)) => pack(full, bootFull, raw, source);
  const opNames = Object.entries(full.program.OP).reduce((names, [n, i]) => { names[i] = n; return names; }, []);
  const programOps = (program, limit = Infinity) => {
    const used = new Set();
    for (let i = 0; i < program.code.length; i += 4) if (program.code[i + 3] < limit) used.add(opNames[program.code[i]]);
    return used;
  };
  const textAt = (image, index) => {
    const at = index * 4;
    assert.equal(image[at + 2], 7, `image ${index} is not a string`);
    let s = ''; for (let i = 0; i < image[at + 1]; i++) s += String.fromCharCode(image[(image[at] + i) * 4]);
    return s;
  };
  const descriptors = program => {
    const seen = new Map();
    for (let i = 0; i < program.code.length; i += 4) {
      if (program.code[i] !== full.program.OP.push_template) continue;
      const d = program.code[i + 1], img = program.image;
      assert.equal(img[d * 4 + 1], T.TEMPLATE_MAGIC, 'descriptor magic');
      const count = img[d * 4];
      const entries = Array.from({ length: count }, (_, k) => [img[(d + 1 + k) * 4], img[(d + 1 + k) * 4 + 1]]);
      seen.set(d, JSON.stringify([entries.map(([c]) => c === 0xffffffff ? null : textAt(img, c)), entries.map(([, r]) => textAt(img, r))]));
    }
    return seen;
  };

  // 4. Fixtures.
  const shader = full.shader;
  const caseLabels = new Set([...shader.matchAll(/\bcase ((?:\d+u,? ?)+):/g)].flatMap(m => m[1].split(',').map(s => Number.parseInt(s.trim(), 10))));
  const counts = { cases: 0, typeErrorCases: 0, throwCases: 0, oracle: 0, inputSensitivity: 0, nativeInterpreter: 0, admitted: 0, baseRejected: 0, sites: 0, descriptorsChecked: 0, unsupportedAdmitted: 0, limitCases: 0, rejected: 0, earlyErrors: 0 };
  const values = new Set(), results = [], opUse = {};
  const checkAdmitted = (item, kind) => {
    const raw = rawFull(item.source); assert.ok(!raw.error, `${item.feature}: ${raw.error}`);
    assert.deepEqual(raw.features, ['template-to-string', T.TAGGED_TEMPLATE_FEATURE]);
    const sites = taggedSites(item.source);
    let baseError; try { packBase(item.source); } catch (e) { baseError = e.message; }
    if (sites.length) { assert.ok(baseError, `base program.js admits a tagged template: ${item.feature}`); counts.baseRejected++; }
    const program = packFull(item.source, raw); counts.admitted++;
    for (const op of programOps(program)) { assert.ok(caseLabels.has(full.program.OP[op]), `${item.feature}: no WGSL case for ${op}`); }
    const user = programOps(program, raw.functions.length);
    if (user.has('push_template')) opUse.push_template = (opUse.push_template ?? 0) + 1;
    const packed = [...descriptors(program).values()].sort(), expectedSites = [...new Set(sites)].sort();
    // Identical text at distinct sites yields distinct descriptors with equal content.
    assert.deepEqual([...new Set(packed)].sort(), expectedSites, `${item.feature}: packed template strings differ from acorn`);
    assert.equal(packed.length, sites.length, `${item.feature}: one descriptor per site`);
    counts.sites += sites.length; counts.descriptorsChecked += packed.length;
    results.push({ feature: item.feature, kind, sites: sites.length, baseRejection: baseError ?? null });
  };
  const checkValue = item => {
    const { feature, source, input, expected } = item;
    assert.ok(['number', 'string', 'boolean'].includes(typeof expected), feature);
    assert.ok(!values.has(JSON.stringify(expected)), `duplicate expected value: ${feature}`); values.add(JSON.stringify(expected));
    assert.deepEqual(oracle(source, input), { value: expected }, `V8 oracle: ${feature}`); counts.oracle++;
    const other = oracle(source, input + 1);
    assert.notDeepEqual(other, { value: expected }, `input sensitivity: ${feature}`); assert.ok('value' in other, `input+1 must not throw: ${feature}`); counts.inputSensitivity++;
    assert.deepEqual(runNative(harness(source, input)), { value: expected }, `native QuickJS: ${feature}`);
    assert.deepEqual(runNative(harness(source, input + 1)), other, `native QuickJS (input+1): ${feature}`); counts.nativeInterpreter += 2;
  };
  for (const item of C.taggedTemplateCases) { checkValue(item); checkAdmitted(item, 'case'); counts.cases++; }
  for (const item of C.taggedTemplateTypeErrorCases) { checkValue(item); checkAdmitted(item, 'typeError'); counts.typeErrorCases++; }
  for (const item of C.taggedTemplateThrowCases) {
    assert.equal(item.throws, true);
    for (const input of [item.input, item.input + 1]) {
      assert.deepEqual(oracle(item.source, input), { error: item.expected }, `V8 oracle: ${item.feature}`);
      assert.deepEqual(runNative(harness(item.source, input)), { error: item.expected }, `native QuickJS: ${item.feature}`);
    }
    counts.oracle += 2; counts.nativeInterpreter += 2;
    checkAdmitted(item, 'throws'); counts.throwCases++;
  }
  for (const item of C.taggedTemplateUnsupportedCases) {
    const promoted = item.outcome === 'value';
    if (promoted) assert.equal(item.expected, item.normative);
    else assert.equal(item.expectedStatus, 6);
    assert.deepEqual(oracle(item.source, item.input), { value: item.normative }, `V8 oracle: ${item.feature}`);
    checkAdmitted(item, promoted ? 'value' : 'unsupported');
    if (!promoted) counts.unsupportedAdmitted++;
  }
  for (const item of C.taggedTemplateLimitCases) {
    assert.deepEqual(oracle(item.source, item.input), { value: item.normative }, `V8 oracle: ${item.feature}`);
    assert.deepEqual(runNative(harness(item.source, item.input)), { value: item.normative }, `native QuickJS: ${item.feature}`);
    assert.throws(() => packFull(item.source), e => e instanceof RangeError && item.reason.test(e.message), item.feature);
    counts.limitCases++; results.push({ feature: item.feature, kind: 'limit', stage: item.stage });
  }
  for (const item of C.taggedTemplateRejectedCases) {
    assert.deepEqual(oracle(item.source, item.input), { value: item.normative }, `V8 oracle: ${item.feature}`);
    assert.throws(() => packFull(item.source), e => e instanceof SyntaxError && item.reason.test(e.message), item.feature);
    counts.rejected++; results.push({ feature: item.feature, kind: 'rejected' });
  }
  // Early errors: every engine and the GPU compiler path reject at parse time.
  for (const item of C.taggedTemplateEarlyErrorCases) {
    assert.throws(() => new Script(harness(item.source, 1)), SyntaxError, `V8 early error: ${item.feature}`);
    let native;
    try { native = runNative(harness(item.source, 1)); } catch (e) { native = JSON.parse(e.stdout); }
    assert.match(native.harnessError ?? '', /^SyntaxError/, `native QuickJS early error: ${item.feature}`);
    assert.throws(() => packFull(item.source), SyntaxError, `packProgram early error: ${item.feature}`);
    counts.earlyErrors++; results.push({ feature: item.feature, kind: 'earlyError', native: native.harnessError });
  }
  // A 16-string template (15 substitutions) is the largest admitted size.
  const largest = 'function f(x){function tag(s){return s.length;}return tag`${x}${x}${x}${x}${x}${x}${x}${x}${x}${x}${x}${x}${x}${x}${x}`+x;}';
  assert.deepEqual(oracle(largest, 1), { value: 17 }); packFull(largest);
  // Stale bridge (no tagged-template-v1): explicit rebuild error, not a generic rejection.
  const staleSource = C.taggedTemplateCases[0].source;
  assert.throws(() => pack(full, bootBase, rawBase(staleSource), staleSource), /Rebuild the compiler bridge: tagged-template-v1/);
  assert.throws(() => packBase(staleSource), /Unsupported tagged template/);
  // Template object identity: one descriptor per site; same-site evaluations reuse it.
  const loop = packFull(C.taggedTemplateCases.find(c => c.feature === 'same-site-loop-identity').source);
  assert.equal(descriptors(loop).size, 1);
  const distinct = packFull(C.taggedTemplateCases.find(c => c.feature === 'distinct-sites-identical-text').source);
  assert.equal(descriptors(distinct).size, 3);
  // The bridge exports undefined cooked strings as null.
  assert.deepEqual(rawFull('function f(x){return (s=>s)`\\u{`;}').functions[0].constants.find(c => c.template).template, { cooked: [null], raw: ['\\u{'] });

  // Formerly rejected corpus entries (lead updates those suites on integration).
  const formerly = [];
  for (const { file, list, features } of C.taggedTemplateFormerlyRejected) {
    const mod = await import(`./${file}`);
    for (const entry of mod[list]) {
      const source = typeof entry === 'string' ? entry : entry.source;
      if (features && !features.includes(entry.feature)) continue;
      let admission = 'admitted'; try { packFull(source); } catch (e) { admission = e.message; }
      let baseAdmission = 'admitted'; try { packBase(source); } catch (e) { baseAdmission = e.message; }
      assert.equal(admission, 'admitted', `${file} ${list}: ${source}`);
      assert.match(baseAdmission, /Unsupported tagged template/, `${file}: base must reject`);
      const input = typeof entry === 'object' && 'input' in entry ? entry.input : 1;
      formerly.push({ file, list, feature: entry.feature, v8: oracle(source, input), nativeAgrees: JSON.stringify(runNative(harness(source, input))) === JSON.stringify(oracle(source, input)) });
    }
  }
  assert.ok(formerly.every(item => item.nativeAgrees), 'native QuickJS disagrees on a formerly rejected source');

  // 5. Corpora.
  const corpusReport = { sources: 0, rawIdentical: 0, baseAdmitted: 0, opsBitIdentical: 0, fullSameOps: 0, baseRejected: 0, newlyAdmitted: [] };
  if (corpus) {
    const files = ['cases.js', 'template-cases.js', 'boxing-cases.js', 'boxing-integration-cases.js', 'language-scope-cases.js', 'global-constant-cases.js', 'object-operation-cases.js',
      'array-method-cases.js', 'array-extended-cases.js', 'array-search-cases.js', 'array-shift-cases.js', 'array-mutation-cases.js', 'array-reduce-cases.js', 'string-search-cases.js',
      'string-search-integration-cases.js', 'number-cases.js', 'number-text-cases.js', 'property-key-negative-cases.js', 'object-static-descriptor-cases.js', 'array-builtin-metadata-cases.js',
      'compiler-correctness-cases.js', 'computed-assignment-cases.js', 'high-index-cases.js', 'foundational-language-cases.js', 'property-key-conversion-cases.js', 'string-extract-cases.js',
      'number-pow-cases.js', 'compiler-review-cases.js', 'phase4-spread-cases.js', 'phase4-object-spread-cases.js', 'phase4-iteration-cases.js', 'phase4-for-in-cases.js',
      'phase4-class-cases.js', 'phase4-edge-cases.js', 'phase4-regression-cases.js'];
    const sources = new Set();
    const collect = v => { if (typeof v === 'string' && /^\s*function\s/.test(v)) sources.add(v); else if (v && typeof v === 'object') Object.values(v).forEach(collect); };
    for (const file of files) collect(await import(`./${file}`));
    for (const source of sources) {
      if (source.includes('\0')) continue;
      let sites; try { sites = taggedSites(source).length; } catch { continue; }
      corpusReport.sources++;
      const a = rawBase(source), b = rawFull(source);
      if (!sites) {
        assert.deepEqual({ ...b, features: a.features }, a, `patched bridge changed output:\n${source}`);
        if (!a.error) assert.deepEqual(b.features, ['template-to-string', T.TAGGED_TEMPLATE_FEATURE]);
        corpusReport.rawIdentical++;
      }
      let p0, e0; try { p0 = packBase(source, a); } catch (e) { e0 = e; }
      if (p0) {
        corpusReport.baseAdmitted++;
        const p1 = packOps(source, b);
        assert.deepEqual(p1.code, p0.code, `lowering-only code changed:\n${source}`);
        assert.deepEqual(p1.image, p0.image, `lowering-only image changed:\n${source}`);
        corpusReport.opsBitIdentical++;
        const p2 = packFull(source, b);
        const userOps = (program, n) => { const list = []; for (let i = 0; i < program.code.length; i += 4) if (program.code[i + 3] < n) list.push(program.code[i]); return list; };
        assert.deepEqual(userOps(p2, b.functions.length), userOps(p0, a.functions.length), `full packing changed user opcodes:\n${source}`);
        corpusReport.fullSameOps++;
      } else {
        corpusReport.baseRejected++;
        let p2; try { p2 = packFull(source, b); } catch {}
        if (p2) { assert.ok(sites > 0, `newly admitted without a tagged template:\n${source}`); corpusReport.newlyAdmitted.push(source); }
      }
    }
  }

  // 6. WGSL lint and structure.
  const body = shader.replace(/\/\/[^\n]*/g, '');
  for (const [open, close] of ['{}', '()', '[]']) assert.equal(occurrences(body, open), occurrences(body, close), `WGSL ${open}${close} balance`);
  assert.match(shader, /@compute @workgroup_size\(\d+\)\s*fn main\(/, '@compute must annotate fn main');
  assert.ok(!/\$\{|undefinedu|NaNu/.test(shader), 'unresolved template output in WGSL');
  for (const m of body.matchAll(/\b(?:let|var|fn|const)\s+([A-Za-z_]\w*)/g)) assert.ok(!WGSL_RESERVED.has(m[1]), `WGSL reserved identifier ${m[1]}`);
  for (const m of body.matchAll(/[(,]\s*([A-Za-z_]\w*)\s*:\s*[A-Za-z]/g)) assert.ok(!WGSL_RESERVED.has(m[1]), `WGSL reserved parameter ${m[1]}`);
  const ctx = { OP: full.program.OP, F: full.program.FIELDS, L: full.program.LIMITS };
  const defined = new Set([...shader.matchAll(/\bfn\s+([A-Za-z_]\w*)\s*\(/g)].map(m => m[1]));
  let calls = 0;
  const resolve = text => text.replace(/\$\{F\.(\w+)\}/g, (m, f) => String(ctx.F[f])).replace(/\$\{([A-Z_0-9]+)\}/g, (m, name) => {
    assert.ok(name in N, `unknown shader interpolation ${name}`); return String(N[name]);
  });
  const shaderReplace = T.templateShaderPatches.map(p => resolve(p.replace));
  for (const snippet of [T.templateWGSLFunctions(ctx), ...Object.values(T.templateWGSLCases(ctx)), ...shaderReplace]) {
    assert.ok(shader.includes(snippet.trim().split('\n')[0].trim()), 'snippet present in shader');
    const text = snippet.replace(/\/\/[^\n]*/g, '');
    for (const m of text.matchAll(/(?<![\w.])([A-Za-z_]\w*)\s*\(/g)) {
      if (['if', 'for', 'while', 'switch', 'return', 'fn'].includes(m[1])) continue;
      assert.ok(defined.has(m[1]) || WGSL_BUILTINS.has(m[1]), `WGSL call to unknown function ${m[1]}`); calls++;
    }
  }
  // Fixed node 64 (phase4-fixed-nodes.js): reserved range, never allocated or swept, rooted.
  assert.equal(T.TEMPLATE_REGISTRY_NODE, 64);
  assert.equal(T.TEMPLATE_REGISTRY_NODE, N.TEMPLATE_REGISTRY_NODE);
  assert.ok(N.PHASE4_FIXED_FIRST <= 64 && 64 <= N.PHASE4_FIXED_LAST && N.FIXED_RESERVED_FIRST === N.FIXED_INIT_LAST + 1);
  assert.ok(N.PHASE4_FIXED_ROOTS.includes(64), 'node 64 is a GC root');
  assert.equal(occurrences(shader, 'const TEMPLATE_REGISTRY: u32 = 64u;'), 1);
  assert.equal(occurrences(shader, `case ${full.program.OP.push_template}u:`), 1, 'push_template case');
  const mainFn = shader.slice(shader.indexOf('fn main('));
  const init = mainFn.slice(0, mainFn.indexOf('let objectProto=alloc('));
  assert.ok(init.includes(`states[l].heap[${N.FIXED_INIT_LAST}u].next=${N.FIXED_RESERVED_LAST + 1}u;`), 'init free list skips the reserved fixed nodes before any alloc()');
  assert.ok(init.includes(`freeCount=${full.program.LIMITS.heap - 1 - N.FIXED_RESERVED_COUNT}u;`), 'init freeCount excludes the reserved nodes');
  const registryInit = `states[l].heap[TEMPLATE_REGISTRY]=Node(V(0u),0u,0u,${T.TEMPLATE_KIND}u,0u);`;
  assert.equal(occurrences(shader, registryInit), 1, 'node 64 initialized in place exactly once');
  assert.ok(mainFn.indexOf(registryInit) > mainFn.indexOf(`if(jsonObject!=${N.FIXED_INIT_LAST}u){states[l].status=2u;}`), 'registry initialized after the 1..25 layout check');
  assert.ok(!/let templateRegistry=alloc\(/.test(shader), 'no legacy node-26 registry allocation');
  const collectFn = shader.slice(shader.indexOf('fn collect('), shader.indexOf('fn find('));
  assert.ok(collectFn.includes(`mark(l,${T.TEMPLATE_REGISTRY_NODE}u);`) && collectFn.includes(`if(node.kind==${T.TEMPLATE_KIND}u){mark(l,node.value.x);}`), 'GC marks the template registry and entries');
  assert.ok(collectFn.includes(`if (i>=${N.FIXED_RESERVED_FIRST}u && i<=${N.FIXED_RESERVED_LAST}u) { states[l].heap[i].marked &= ~1u; continue; }`), 'sweep never frees reserved fixed nodes');
  // No other WGSL uses heap kind 32.
  const mine = T.templateWGSLFunctions(ctx) + shaderReplace.join('');
  for (const use of [`kind==${T.TEMPLATE_KIND}u`, `alloc(l,${T.TEMPLATE_KIND}u`]) assert.equal(occurrences(shader, use), occurrences(mine, use), `heap kind ${T.TEMPLATE_KIND} used outside the template code: ${use}`);
  // String.raw routing: builtin 2000 -> helper FIELDS "raw".
  assert.ok(shader.includes(`if(fnValue.x==${T.STRING_RAW_ID}u){field=${ctx.F.raw}u;}`), 'call() routes builtin 2000 to the raw helper');

  summary = { gpuChecks: false, wgslCompiled: false, runtimeExecution: false, productionCPUFallback: false, nativeQuickJSReference: true,
    integration: { leadFiles: modes, bridge: bridgeMode, bridgeDiff: 'patch -p0 / git apply -p0 ok' }, counts, opUse, wgsl: { calls, pushTemplateOpcode: full.program.OP.push_template, rawField: ctx.F.raw },
    patches: { registry: T.templateRegistryPatches.map(p => p.id), program: T.templateProgramPatches.map(p => p.id), shader: T.templateShaderPatches.map(p => p.id), native: T.templateNativePatches.map(p => p.diff) },
    formerlyRejected: formerly, corpus: { ...corpusReport, newlyAdmitted: corpusReport.newlyAdmitted.length, newlyAdmittedSources: corpusReport.newlyAdmitted }, results };
} finally {
  if (!keep) rmSync(build, { recursive: true, force: true });
}
console.log(JSON.stringify(summary, null, 1));
