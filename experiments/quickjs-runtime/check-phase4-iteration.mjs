// Phase 4 worker 4 host checks (no GPU, no runtime.js execution):
//  1. V8 oracle: every iteration/TypeError case gives its expected primitive,
//     input + 1 changes it; unsupported cases throw TypeError (or are
//     spec-iterable where noted) in V8.
//  2. A native QuickJS interpreter built from vendor/ in a private directory
//     agrees with V8 on every case (both inputs).
//  3. Helper sources compile with the private native compiler, reference only
//     existing private builtins (plus 1273) and use only existing opcodes.
//  4. Helper model: the three helper sources run in V8 with host shims for the
//     private builtins and must reproduce native iteration logs (getter /
//     length access order, growth, shrinkage, surrogates, done stickiness).
//  5. Integration rehearsal: the documented program.js / bootstrap.js /
//     shader.js patches are applied to private copies; every case packs
//     (opcode inventory), the bootstrap fields are wired, and the shader
//     source builds with the new cases, functions and continuations.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Script } from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { OP, FIELDS, entrySource } from './program.js';
import { privateBuiltins } from './bootstrap.js';
import * as iteration from './phase4-iteration.js';
import { iterationCases, iterationUnsupportedCases, iterationTypeErrorCases } from './phase4-iteration-cases.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const keep = process.argv.includes('--keep');
const build = mkdtempSync(join(root, '.phase4-build-w4-'));
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
const harness = (source, input) => `${source}\nJSON.stringify((function(){try{return {value:${entrySource(source)}(${JSON.stringify(input)})};}catch(e){return {error:e&&e.name};}})())`;
const oracle = (source, input) => JSON.parse(new Script(harness(source, input)).runInNewContext({}, { timeout: 1000 }));
// Same renames packProgram applies before the OP lookup.
const lowered = op => {
  if (op === 'get_var' || op === 'get_var_undef') return 'get_var_ref';
  if (op === 'put_var') return 'put_var_ref';
  if (op === 'get_length') return 'get_field';
  if (/^(get_loc|put_loc|set_loc)8$/.test(op)) op = op.slice(0, -1);
  const suffix = /^(get_loc|put_loc|set_loc|get_arg|put_arg|set_arg|get_var_ref|put_var_ref|set_var_ref|call)([0-3])$/.exec(op);
  if (suffix) return suffix[1];
  if (op === 'push_minus1' || /^push_[0-7]$/.test(op) || ['push_i8', 'push_i16', 'push_i32', 'push_const', 'push_const8', 'undefined', 'null', 'push_true', 'push_false', 'push_atom_value', 'push_empty_string'].includes(op)) return 'push';
  if (['fclosure', 'fclosure8'].includes(op)) return 'closure';
  if (op === 'set_home_object') return 'nop';
  if (op === 'define_method') return 'define_field';
  return op.replace(/^(if_true|if_false|goto)(8|16)$/, '$1');
};
const newOps = iteration.iterationOpcodes.map(o => o.name);
const failures = [];
const expect = (ok, message) => { if (!ok) failures.push(message); };

// Host shims standing in for the private builtins inside the helper model.
function helperModel() {
  const kind = v => {
    if (v === null || v === undefined) return 4;
    if (typeof v === 'string') return 2;
    if (typeof v !== 'object') return 0;
    const tag = Object.prototype.toString.call(v);
    if (tag === '[object Arguments]') return 1;
    const array = Array.isArray(v), text = tag === '[object String]';
    if (!array && !text) return 0;
    for (let p = v; p !== null; p = Object.getPrototypeOf(p)) {
      if (p === Array.prototype) return array ? 1 : 0;
      if (p === String.prototype) return text ? 2 : 0;
    }
    return 0;
  };
  class Unsupported extends Error {}
  const shims = {
    __lanesIterationKind: kind,
    __lanesUnsupported: m => { throw new Unsupported(m); },
    __lanesDescriptor: () => Object.create(null),
    __lanesNumber: v => Number(v),
    __lanesPrimitive: (v, hint) => {
      for (const name of hint ? ['toString', 'valueOf'] : ['valueOf', 'toString']) {
        const m = v[name]; if (typeof m === 'function') { const r = m.call(v); if (r === null || typeof r !== 'object') return r; }
      }
      throw new TypeError('Cannot convert object to primitive value');
    },
    __lanesText: v => String(v),
    __lanesCharCodeAt: (s, i) => s.charCodeAt(i),
    __lanesSlice: (s, a, b) => s.slice(a, b),
    __lanesCall: (fn, thisArg, ...args) => fn.call(thisArg, ...args),
  };
  const names = Object.keys(shims);
  const make = source => new Function(...names, `return (${source});`)(...names.map(n => shims[n]));
  const S = iteration.iterationBootstrapSources;
  return { open: make(S.iteratorOpen), step: make(S.iteratorStep), close: make(S.iteratorClose), kind, Unsupported };
}

// Iteration scenarios: run once with native for-of, once with the helpers.
const scenarios = [
  ['array with growth', log => { const a = [1, 2]; return [a, v => { log.push(v); if (a.length < 5) a.push(v * 10); }]; }],
  ['array with shrink', log => { const a = [1, 2, 3, 4]; return [a, v => { log.push(v); a.length = 2; }]; }],
  ['holes and inherited index', log => { const a = [1, , 3]; return [a, v => log.push(v)]; }],
  ['index getters', log => { const a = []; for (let i = 0; i < 3; i++) Object.defineProperty(a, i, { get() { log.push('g' + i); return i; } }); return [a, v => log.push(v)]; }],
  ['arguments with length accessor', log => { const args = (function () { return arguments; })(7, 8, 9);
    Object.defineProperty(args, 'length', { get() { log.push('L'); return { valueOf() { log.push('V'); return 2.7; } }; } }); return [args, v => log.push(v)]; }],
  ['string surrogates', log => ['a😀\uDE00\uD83Db\uD83D', v => log.push(v)]],
  ['String wrapper with own toString', log => { const w = new String('zz'); w.toString = () => { log.push('ts'); return 'x😀'; }; return [w, v => log.push(v)]; }],
  ['empty string', log => ['', v => log.push(v)]],
  ['throwing getter', log => { const a = [1, 2]; Object.defineProperty(a, 1, { get() { log.push('throw'); throw new RangeError('x'); } }); return [a, v => log.push(v)]; }],
];
function runScenario(make, useHelpers, model) {
  const log = [];
  const [iterable, body] = make(log);
  try {
    if (!useHelpers) { for (const v of iterable) body(v); log.push('done'); }
    else {
      const record = model.open(iterable);
      for (;;) { const v = model.step(record); if (v === record) break; body(v); }
      log.push('done');
      assert.equal(model.step(record), record, 'done is sticky');
    }
  } catch (e) { log.push('error:' + e.name); }
  return log;
}

let summary;
try {
  // Private native compiler and interpreter (vendor/ sources; bridge.c copy).
  const bridge = join(build, 'bridge.c'), runner = join(build, 'runner.c');
  copyFileSync(`${root}bridge.c`, bridge); writeFileSync(runner, runnerSource);
  const inc = ['-I', build, '-I', `${root}vendor`];
  execFileSync(process.env.CC || 'cc', [...common, ...inc, bridge, ...support, '-lm', '-lpthread', '-o', join(build, 'compiler')], { stdio: 'inherit' });
  execFileSync(process.env.CC || 'cc', [...common, ...inc, runner, ...support, '-lm', '-lpthread', '-o', join(build, 'qjs-run')], { stdio: 'inherit' });
  const compile = source => JSON.parse(execFileSync(join(build, 'compiler'), [source], { encoding: 'utf8', maxBuffer: 1 << 26 }));
  const native = script => JSON.parse(execFileSync(join(build, 'qjs-run'), [script], { encoding: 'utf8' }));

  const counts = { cases: 0, oracle: 0, inputSensitivity: 0, nativeInterpreter: 0, unsupportedV8: 0, typeError: 0,
    helperSources: 0, helperScenarios: 0, packed: 0, patches: 0 };
  const values = new Set();
  const all = [...iterationCases, ...iterationTypeErrorCases];
  for (const item of all) {
    const { feature, source, input, expected } = item;
    counts.cases++;
    expect(['number', 'string', 'boolean'].includes(typeof expected), `primitive expected: ${feature}`);
    expect(!values.has(JSON.stringify(expected)), `duplicate expected value: ${feature}`); values.add(JSON.stringify(expected));
    const got = oracle(source, input);
    expect(JSON.stringify(got) === JSON.stringify({ value: expected }), `V8 ${feature}: ${JSON.stringify(got)}`); counts.oracle++;
    const other = oracle(source, input + 1);
    expect(JSON.stringify(other) !== JSON.stringify(got), `input sensitivity ${feature}`); counts.inputSensitivity++;
    const n1 = native(harness(source, input)), n2 = native(harness(source, input + 1));
    expect(JSON.stringify(n1) === JSON.stringify(got), `native QuickJS ${feature}: ${JSON.stringify(n1)}`);
    expect(JSON.stringify(n2) === JSON.stringify(other), `native QuickJS input+1 ${feature}: ${JSON.stringify(n2)} vs ${JSON.stringify(other)}`);
    counts.nativeInterpreter += 2;
    if (iterationTypeErrorCases.includes(item)) counts.typeError++;
  }
  for (const item of iterationUnsupportedCases) {
    const got = oracle(item.source, item.input), n = native(harness(item.source, item.input));
    expect(item.v8 === 'TypeError' ? got.error === 'TypeError' : 'value' in got, `V8 unsupported ${item.feature}: ${JSON.stringify(got)}`);
    expect(JSON.stringify(n) === JSON.stringify(got), `native unsupported ${item.feature}: ${JSON.stringify(n)}`);
    counts.unsupportedV8++;
  }

  // 3. Helper sources.
  const knownPrivate = { ...privateBuiltins, ...iteration.iterationPrivateBuiltins };
  const helperOps = {};
  for (const [field, source] of Object.entries(iteration.iterationBootstrapSources)) {
    const raw = compile(source);
    expect(!raw.error, `helper ${field} compiles: ${raw.error}`);
    if (raw.error) continue;
    const ops = new Set();
    for (const fn of raw.functions) {
      for (const ref of fn.refs) expect(ref.name in knownPrivate || ['TypeError', 'undefined', 'Symbol'].includes(ref.name), `helper ${field} reference ${ref.name}`);
      for (const i of fn.instructions) ops.add(lowered(i.op));
      expect(fn.strict === 1, `helper ${field} strict`);
    }
    for (const op of ops) expect(op in OP, `helper ${field} uses unsupported op ${op}`);
    helperOps[field] = [...ops].sort();
    counts.helperSources++;
  }
  for (const [name, id] of Object.entries(iteration.iterationPrivateBuiltins)) {
    expect(id >= 1270 && id <= 1309, `private id ${id} in the worker-4 range`);
    for (const [other, otherId] of Object.entries(privateBuiltins)) expect(otherId !== id || other === name, `private id ${id} collides with ${other}`);
  }
  for (const code of iteration.iterationContinuations().map(c => c.code)) expect(code >= 40 && code <= 43, `continuation ${code} in the worker-4 range`);
  expect(iteration.ITERATOR_NEXT_PLACEHOLDER >= 1270 && iteration.ITERATOR_NEXT_PLACEHOLDER <= 1309 && !Object.values(privateBuiltins).includes(iteration.ITERATOR_NEXT_PLACEHOLDER), 'next placeholder id');

  // 4. Helper model vs native iteration.
  const model = helperModel();
  for (const [name, make] of scenarios) {
    if (name === 'holes and inherited index') Array.prototype[1] = 'inherited';
    try {
      const want = runScenario(make, false, model), have = runScenario(make, true, model);
      expect(JSON.stringify(want) === JSON.stringify(have), `helper model ${name}: ${JSON.stringify(have)} vs ${JSON.stringify(want)}`);
    } finally { delete Array.prototype[1]; }
    counts.helperScenarios++;
  }
  for (const [index, [value, kind]] of [[null, 4], [undefined, 4], ['s', 2], [new String('s'), 2], [[1], 1], [{}, 0], [1, 0], [true, 0], [() => 1, 0],
    [Object.setPrototypeOf([1], null), 0], [Object.create(Array.prototype), 0], [Object.setPrototypeOf(new String('a'), Array.prototype), 0]].entries())
    expect(model.kind(value) === kind, `kind model #${index}`);
  expect((() => { try { model.open(null); } catch (e) { return e instanceof TypeError; } })(), 'open(null) TypeError');
  expect((() => { try { model.open({}); } catch (e) { return e instanceof TypeError; } })(), 'open({}) TypeError');
  // Lowering: offsets pass through, Phase 6 protocol opcodes stay rejected.
  expect(JSON.stringify(iteration.lowerIteration('for_of_next', { operand: 2, bytes: [126, 2] })) === '{"op":"for_of_next","a":2,"b":0}', 'for_of_next lowering');
  for (const op of iteration.iterationRejectedOpcodes)
    expect((() => { try { iteration.lowerIteration(op, { operand: 0 }); } catch (e) { return e instanceof SyntaxError; } })(), `${op} rejected`);

  // 5. Integration rehearsal on private copies.
  // program.js/bootstrap.js are copied unchanged; they reach this module only
  // through the patched registry copy.
  const local = ['program.js', 'bootstrap.js', 'shader.js', 'phase4-registry.js'];
  const patchFile = (name, patches) => {
    let text = readFileSync(`${root}${name}`, 'utf8');
    for (const p of patches) {
      const n = text.split(p.anchor).length - 1;
      expect(n === 1, `${name} anchor occurs ${n} times: ${p.anchor}`);
      if (n === 1) { text = text.replace(p.anchor, () => 'insertBefore' in p ? p.insertBefore + p.anchor : p.replacement); counts.patches++; }
    }
    // Resolve sibling imports from the build directory; keep patched copies local.
    text = text.replace(/from '\.\/([\w.-]+)'/g, (m, file) => local.includes(file) ? m : `from '../${file}'`)
      .replace(/from '\.\.\/\.\.\/src\//g, "from '../../../src/");
    writeFileSync(join(build, name), text);
  };
  // Once the lead has integrated this module, verify the real files in place.
  const registryText = readFileSync(`${root}phase4-registry.js`, 'utf8'), shaderText = readFileSync(`${root}shader.js`, 'utf8');
  const registryIntegrated = registryText.includes("from './phase4-iteration.js'");
  const shaderIntegrated = iteration.iterationShaderPatches.every(p => shaderText.includes(p.replacement));
  expect(registryIntegrated === shaderIntegrated, `registry integrated=${registryIntegrated} but raise() patch integrated=${shaderIntegrated}`);
  const integrated = registryIntegrated && shaderIntegrated;
  let P, B, SH;
  if (integrated) {
    P = await import('./program.js'); B = await import('./bootstrap.js'); SH = await import('./shader.js');
    const R = await import('./phase4-registry.js');
    for (const name of newOps) expect(R.phase4Opcodes.includes(name), `registry opcode ${name}`);
    for (const [field, source] of Object.entries(iteration.iterationBootstrapSources)) expect(R.phase4BootstrapSources[field] === source, `registry bootstrap source ${field}`);
    for (const [name, id] of Object.entries(iteration.iterationPrivateBuiltins)) expect(R.phase4PrivateBuiltins[name] === id, `registry private builtin ${name}`);
    for (const [id, field] of Object.entries(iteration.iterationBuiltinFields)) expect(R.phase4BuiltinFields[id] === field, `registry builtin field ${id}`);
    for (const code of [iteration.CONTINUATION_STEP, iteration.CONTINUATION_OPEN]) expect(R.phase4Continuations({ OP: P.OP, F: P.FIELDS, L: P.LIMITS }).some(c => c.code === code), `registry continuation ${code}`);
    for (const op of newOps) expect(JSON.stringify(R.phase4Lowering(op, { operand: 0, bytes: [0, 0] })) === JSON.stringify(iteration.lowerIteration(op, { operand: 0, bytes: [0, 0] })), `registry lowering ${op}`);
    expect((() => { try { R.phase4Lowering('iterator_call', { operand: 0 }); } catch (e) { return e instanceof SyntaxError; } })(), 'registry rejects iterator_call');
  } else {
    patchFile('phase4-registry.js', iteration.iterationRegistryPatches);
    patchFile('program.js', []);
    patchFile('bootstrap.js', []);
    patchFile('shader.js', iteration.iterationShaderPatches);
    P = await import(pathToFileURL(join(build, 'program.js')).href);
    B = await import(pathToFileURL(join(build, 'bootstrap.js')).href);
    SH = await import(pathToFileURL(join(build, 'shader.js')).href);
    for (const name of newOps) expect(!(name in OP), `OP gains ${name}`);
    for (const field of iteration.iterationFieldNames) expect(!(field in FIELDS), `FIELDS gains ${field}`);
  }
  counts.mode = integrated ? 'integrated (verified in place)' : 'rehearsal (patched private copies)';
  for (const name of newOps) expect(name in P.OP, `OP has ${name}`);
  for (const [name, index] of Object.entries(OP)) expect(P.OP[name] === index, `OP index of ${name} unchanged`);
  for (const field of iteration.iterationFieldNames) expect(field in P.FIELDS, `FIELDS has ${field}`);
  for (const [name, id] of Object.entries(iteration.iterationPrivateBuiltins)) expect(B.privateBuiltins[name] === id, `privateBuiltins ${name}`);
  const boot = Object.fromEntries(Object.entries(B.bootstrapSources).map(([k, s]) => [k, compile(s)]));
  for (const [k, raw] of Object.entries(boot)) expect(!raw.error, `bootstrap ${k} compiles`);
  const inventory = [];
  const opNames = Object.keys(P.OP);
  for (const item of [...iterationCases, ...iterationTypeErrorCases, ...iterationUnsupportedCases]) {
    let program;
    try { program = P.packProgram(B.attachBootstrap(compile(item.source), boot), entrySource(item.source)); }
    catch (e) { expect(false, `pack ${item.feature}: ${e.message}`); continue; }
    counts.packed++;
    const ops = [...new Set([...program.code].filter((_, i) => i % 4 === 0).map(o => opNames[o]))];
    const fieldTable = program.image[(program.typeTable + 1) * 4 + 3];
    for (const field of iteration.iterationFieldNames) expect(program.image[(fieldTable + P.FIELDS[field]) * 4 + 1] !== 0, `${item.feature}: bootstrap field ${field} wired`);
    // Opcodes of the case itself (functions before the first bootstrap root).
    const caseOps = new Set(compile(item.source).functions.flatMap(fn => fn.instructions.map(i => lowered(i.op))));
    expect(caseOps.has('for_of_start'), `${item.feature}: exercises for_of_start`);
    for (const op of Object.keys(iteration.iterationProgramLowering.otherOwners)) expect(!caseOps.has(op), `${item.feature}: depends on ${op} (other worker)`);
    for (const op of caseOps) expect(op in OP || newOps.includes(op), `${item.feature}: op ${op} outside OP + iteration ops`);
    inventory.push({ feature: item.feature, iterationOps: newOps.filter(o => caseOps.has(o)), otherOps: [...caseOps].filter(o => !newOps.includes(o)).sort().join(' '), packedOps: ops.length });
  }
  const wgsl = SH.shader;
  for (const needle of ['fn iterationKind(l:u32,value:V)->u32', 'fn iterationStepResult(', 'continuation==40u', 'continuation==41u',
    'found=value.z==9u&&value.y==0u', `if(id==${iteration.ITERATION_KIND}u)`, ...Object.keys(iteration.iterationBuiltinFields).map(id => `fnValue.x==${id}u`),
    ...newOps.map(name => `case ${P.OP[name]}u:`)])
    expect(wgsl.includes(needle), `shader contains ${needle}`);
  expect(!/undefinedu/.test(wgsl), 'shader has no undefined opcode/field interpolation');
  let depth = 0; for (const c of wgsl) { if (c === '{') depth++; else if (c === '}') depth--; if (depth < 0) break; }
  expect(depth === 0, 'shader braces balance');

  summary = { gpuChecks: false, runtimeExecution: false, nativeReferenceExecution: true, counts, helperOps, inventory, failures };
} finally {
  if (!keep) rmSync(build, { recursive: true, force: true });
}
console.log(JSON.stringify(summary, null, 1));
if (summary.failures.length) { console.error(`${summary.failures.length} failure(s)`); process.exit(1); }
