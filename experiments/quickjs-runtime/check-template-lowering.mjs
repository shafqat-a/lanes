// Host-only regression checks for the local untagged template literal lowering
// (vendor/quickjs.c js_parse_template + OP_to_string). No GPU execution.
//  1. V8 host oracle confirms each fixed expected value and input sensitivity.
//  2. A native QuickJS interpreter built from vendor/ (private temp directory;
//     generated/ is not used) runs the patched compiler's bytecode and must agree.
//  3. Bytecode: no `concat` property load, exactly one to_string per untagged
//     substitution, and the bridge advertises features:["template-to-string"].
//  4. Tagged templates: the template object is an unsupported constant (and
//     program.js rejects) until the tagged-template-v1 bridge patch is applied;
//     then it is a {template} constant (see check-phase4-templates.mjs).
// Optional: --baseline=HEAD (or --baseline=<unpatched quickjs.c>; an unpatched
// quickjs-opcode.h is taken from the same directory, else from git HEAD) builds
// the unpatched compiler/interpreter, requires every `regression` case to fail
// there, and requires every fixture source without an untagged substitution
// (and every tagged case) to compile to the same bytecode modulo opcode numbering.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Script } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import { entrySource, packProgram } from './program.js';
import { bootstrapSources } from './bootstrap.js';
import { templateCases, templateResourceLimitCases, templateTypeErrorCases, templateRejectedCases } from './template-cases.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const baselineArg = process.argv.find(a => a.startsWith('--baseline='))?.slice(11);
const keep = process.argv.includes('--keep');
mkdirSync(join(root, '.w1-build'), { recursive: true });
const build = mkdtempSync(join(root, '.w1-build', 'lowering-'));
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
function buildTools(dir) {
  // Files next to the including file shadow vendor/ (#include "..." search order).
  const bridge = join(dir, 'bridge.c'), runner = join(dir, 'runner.c');
  copyFileSync(`${root}bridge.c`, bridge); writeFileSync(runner, runnerSource);
  const inc = ['-I', dir, '-I', `${root}vendor`];
  execFileSync(process.env.CC || 'cc', [...common, ...inc, bridge, ...support, '-lm', '-lpthread', '-o', join(dir, 'compiler')], { stdio: 'inherit' });
  execFileSync(process.env.CC || 'cc', [...common, ...inc, runner, ...support, '-lm', '-lpthread', '-o', join(dir, 'qjs-run')], { stdio: 'inherit' });
  return {
    raw: source => JSON.parse(execFileSync(join(dir, 'compiler'), [source], { encoding: 'utf8', maxBuffer: 1 << 26 })),
    run: script => JSON.parse(execFileSync(join(dir, 'qjs-run'), [script], { encoding: 'utf8', maxBuffer: 1 << 26 })),
  };
}
const gitShow = path => execFileSync('git', ['show', `HEAD:./${path}`], { cwd: root, maxBuffer: 1 << 26 });
// entrySource() currently rejects template substitutions, so the name comes from acorn directly.
const entryName = source => parse(source, { ecmaVersion: 2025 }).body[0].id.name;
const harness = (source, input) => `${source}\nJSON.stringify((function(){try{return {value:${entryName(source)}(${JSON.stringify(input)})};}catch(e){return {error:e&&e.name};}})())`;
const oracle = (source, input) => JSON.parse(new Script(harness(source, input)).runInNewContext({}, { timeout: 1000 }));

// Untagged substitution count (TaggedTemplate quasis excluded).
function untaggedSubstitutions(source) {
  let count = 0;
  const visit = (node, tagged) => {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'TemplateLiteral' && !tagged) count += node.expressions.length;
    for (const [key, value] of Object.entries(node)) {
      const childTagged = node.type === 'TaggedTemplateExpression' && key === 'quasi';
      if (Array.isArray(value)) value.forEach(v => visit(v, false));
      else if (value && typeof value === 'object') visit(value, childTagged);
    }
  };
  visit(parse(source, { ecmaVersion: 2025 }), false);
  return count;
}
const instructions = raw => raw.functions.flatMap(fn => fn.instructions);
// Bytecode identity modulo opcode numbering (to_string renumbers later opcodes).
const normalized = raw => raw.error ? raw : { ...raw, functions: raw.functions.map(fn => ({ ...fn, instructions: fn.instructions.map(i => ({ ...i, bytes: i.bytes.slice(1) })) })) };
const admission = (raw, source) => { try { entrySource(source); packProgram(raw, 'f'); return 'admitted'; } catch (e) { return `rejected: ${e.message}`; } };

let summary;
try {
  const patched = buildTools(build);
  const counts = { cases: 0, oracle: 0, inputSensitivity: 0, nativeInterpreter: 0, bytecodeChecked: 0, toStringOps: 0, rejectedCases: 0 };
  const results = [];
  const checkValue = (item, list) => {
    const { feature, source, input, expected } = item;
    assert.ok(expected === null || ['number', 'string', 'boolean'].includes(typeof expected), feature);
    assert.deepEqual(oracle(source, input), { value: expected }, `oracle: ${feature}`); counts.oracle++;
    const other = oracle(source, input + 1);
    assert.notDeepEqual(other, { value: expected }, `input sensitivity: ${feature}`); counts.inputSensitivity++;
    assert.deepEqual(patched.run(harness(source, input)), { value: expected }, `native QuickJS: ${feature}`);
    assert.deepEqual(patched.run(harness(source, input + 1)), other, `native QuickJS (input+1): ${feature}`);
    counts.nativeInterpreter += 2; counts.cases++;
    assert.ok(!list.has(JSON.stringify(expected)), `duplicate expected value: ${feature}`); list.add(JSON.stringify(expected));
  };
  for (const [group, list] of [['template', templateCases], ['resourceLimit', templateResourceLimitCases], ['typeError', templateTypeErrorCases]]) {
    const values = new Set();
    for (const item of list) {
      checkValue(item, values);
      const raw = patched.raw(item.source);
      assert.ok(!raw.error, `${item.feature}: ${raw.error}`);
      // tagged-template-v1 is added by phase4-patches/w1-tagged-template-bridge.diff.
      assert.ok(['template-to-string', 'template-to-string,tagged-template-v1'].includes(String(raw.features)), 'bridge features');
      const ins = instructions(raw), subs = untaggedSubstitutions(item.source);
      const concatLoads = ins.filter(i => ['get_field', 'get_field2'].includes(i.op) && i.operand === 'concat').length;
      if (!item.usesConcat) assert.equal(concatLoads, 0, `${item.feature}: concat load`);
      const toString = ins.filter(i => i.op === 'to_string').length;
      assert.ok(subs > 0 && toString === subs, `${item.feature}: ${toString} to_string for ${subs} substitutions`);
      counts.bytecodeChecked++; counts.toStringOps += toString;
      results.push({ group, feature: item.feature, substitutions: subs, ...(item.regression ? { regression: true } : {}),
        ...(item.expectedStatus ? { expectedGpuStatus: item.expectedStatus } : {}), currentProgramJs: admission(raw, item.source) });
    }
  }
  const rejected = [], rejectedValues = new Set();
  for (const item of templateRejectedCases) {
    checkValue(item, rejectedValues);
    const raw = patched.raw(item.source);
    assert.ok(!raw.error, `${item.feature}: ${raw.error}`);
    // Before the tagged-template-v1 bridge patch the template object is an
    // unsupported constant and program.js must reject; afterwards it is a
    // template constant and admission follows the program.js integration state
    // (check-phase4-templates.mjs covers the tagged lowering itself).
    const tagged = raw.features.includes('tagged-template-v1');
    const templateObject = raw.functions.some(fn => fn.constants.some(c => tagged ? 'template' in c : c.unsupported === true));
    assert.ok(templateObject, `${item.feature}: expected ${tagged ? 'template' : 'unsupported template object'} constant`);
    const status = admission(raw, item.source);
    if (!tagged) assert.match(status, /^rejected/, `${item.feature} must stay rejected`);
    rejected.push({ feature: item.feature, unsupportedTemplateObjectConstant: templateObject, toStringOps: instructions(raw).filter(i => i.op === 'to_string').length, currentProgramJs: status });
    counts.rejectedCases++;
  }
  const exampleSource = 'function f(x){return `a${x}b${x+1}`;}';
  const example = patched.raw(exampleSource).functions[0].instructions.map(i => typeof i.operand === 'string' ? `${i.op} ${JSON.stringify(i.operand)}` : i.operand && i.size > 1 ? `${i.op} ${i.operand}` : i.op);

  let baseline;
  if (baselineArg) {
    const dir = mkdtempSync(join(build, 'baseline-'));
    if (baselineArg === 'HEAD') writeFileSync(join(dir, 'quickjs.c'), gitShow('vendor/quickjs.c'));
    else copyFileSync(baselineArg, join(dir, 'quickjs.c'));
    const header = baselineArg === 'HEAD' ? null : join(dirname(baselineArg), 'quickjs-opcode.h');
    if (header && existsSync(header) && header !== join(root, 'vendor', 'quickjs-opcode.h')) copyFileSync(header, join(dir, 'quickjs-opcode.h'));
    else writeFileSync(join(dir, 'quickjs-opcode.h'), gitShow('vendor/quickjs-opcode.h'));
    const old = buildTools(dir);
    const fails = [];
    for (const item of [...templateCases, ...templateResourceLimitCases, ...templateTypeErrorCases]) {
      const got = old.run(harness(item.source, item.input));
      const ok = JSON.stringify(got) === JSON.stringify({ value: item.expected });
      if (!ok) fails.push({ feature: item.feature, got });
      if (item.regression) assert.ok(!ok, `baseline should fail: ${item.feature}`);
    }
    // Every other fixture source must compile identically (modulo opcode numbering).
    const sources = new Set();
    const collect = v => { if (typeof v === 'string' && /^\s*function\s/.test(v)) sources.add(v); else if (v && typeof v === 'object') Object.values(v).forEach(collect); };
    for (const file of ['cases.js', 'compiler-correctness-cases.js', 'language-scope-cases.js', 'global-constant-cases.js', 'object-operation-cases.js',
      'array-method-cases.js', 'array-extended-cases.js', 'array-search-cases.js', 'array-shift-cases.js', 'array-mutation-cases.js', 'array-reduce-cases.js',
      'string-search-cases.js', 'string-search-integration-cases.js', 'number-cases.js', 'number-text-cases.js', 'property-key-negative-cases.js',
      'object-static-descriptor-cases.js', 'array-builtin-metadata-cases.js', 'foundational-language-cases.js', 'computed-assignment-cases.js',
      'high-index-cases.js', 'string-extract-cases.js', 'boxing-cases.js', 'property-key-conversion-cases.js', 'number-pow-cases.js', 'compiler-review-cases.js'])
      collect(await import(`./${file}`));
    Object.values(bootstrapSources).forEach(s => sources.add(s));
    templateRejectedCases.forEach(c => sources.add(c.source));
    const changed = [], unexpected = [];
    let unchanged = 0, skipped = 0;
    for (const s of sources) {
      if (s.includes('\0')) { skipped++; continue; } // argv cannot carry NUL
      let subs;
      try { subs = untaggedSubstitutions(s); } catch { subs = -1; }
      if (JSON.stringify(normalized(old.raw(s))) === JSON.stringify(normalized(patched.raw(s)))) { unchanged++; continue; }
      changed.push(s); if (subs === 0) unexpected.push(s);
    }
    assert.deepEqual(unexpected, [], 'patch changed bytecode of sources without untagged substitutions');
    const regressionCount = [...templateCases, ...templateTypeErrorCases].filter(c => c.regression).length;
    baseline = { source: baselineArg, regressionCases: regressionCount, regressionFailuresBeforePatch: fails.filter(f => [...templateCases, ...templateTypeErrorCases].find(c => c.feature === f.feature)?.regression).length,
      baselineFailures: fails, otherFixtureSources: sources.size, skippedNul: skipped, unchangedBytecode: unchanged, changedBytecode: changed.length };
  }
  summary = { gpuChecks: false, nativeReferenceExecution: true, productionCPUFallback: false, counts,
    example: { source: exampleSource, instructions: example }, ...(baseline ? { baseline } : {}), results, rejected };
} finally {
  if (!keep) rmSync(build, { recursive: true, force: true });
}
console.log(JSON.stringify(summary, null, 1));
