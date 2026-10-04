// Phase 4 worker 2 host checks (no GPU execution, no production CPU fallback):
//  1. Static contract checks of phase4-spread.js (ids, fields, lowering rules,
//     WGSL bodies reference only existing shader helpers).
//  2. V8 oracle: every expected value, plus input sensitivity.
//  3. Native QuickJS interpreter built from vendor/ in a private temp dir
//     (.phase4-build-w2-*) agrees with V8.
//  4. Every case compiles with a private native compiler build; the emitted
//     opcodes are within OP ∪ spreadOpcodes ∪ case.dependsOn, and the program
//     packs through program.js packProgram once spread ops are lowered.
//  5. Helper sources compile, are flat, reference only known private builtins
//     and pack as bootstrap helpers. A V8 model of the iteration interface
//     checks the helper's algorithm against native spread.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Script, createContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { OP, FIELDS, LIMITS, entrySource, packProgram } from './program.js';
import { attachBootstrap, bootstrapSources, privateBuiltins } from './bootstrap.js';
import {
  spreadOpcodes, spreadOpcodeEffects, spreadProgramLowering, spreadWGSLCases, spreadCallMappingWGSL,
  spreadBootstrapSources, spreadPrivateBuiltins, spreadBuiltinFields, spreadExternalPrivateBuiltins, spreadNotes,
} from './phase4-spread.js';
import { spreadCases, spreadTypeErrorCases, spreadUnsupportedCases, spreadResourceCases } from './phase4-spread-cases.js';
import * as registry from './phase4-registry.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const keep = process.argv.includes('--keep');
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

// ---- 1. Static contract checks -------------------------------------------
const counts = { staticChecks: 0, lowering: 0, wgsl: 0, oracle: 0, inputSensitivity: 0, nativeInterpreter: 0, compiled: 0, packed: 0, helperModel: 0 };
// Integrated: the lead appended the spread ops to OP (phase4-registry.js).
// Partial integration (some but not all ops) is an error.
const integrated = spreadOpcodes.every(op => op in OP);
const integration = {};
for (const op of spreadOpcodes) {
  assert.ok(spreadOpcodeEffects[op], op);
  if (!integrated) assert.ok(!(op in OP), `${op} in OP without full spread integration`);
  counts.staticChecks++;
}
if (integrated) {
  // Registry wiring: opcodes, lowering, helper sources, builtin fields, private builtins.
  for (const op of spreadOpcodes) {
    assert.ok(registry.phase4Opcodes.includes(op), `${op} in phase4Opcodes`);
    // Appended after the original table: index above every pre-Phase-4 op.
    assert.ok(OP[op] > OP.pow, `${op} appended after existing OP indices`);
  }
  const ins = (op, operand) => ({ op, operand, bytes: [] });
  for (const [op, operand, prev] of [['rest', 3, null], ['append', 0, 'drop'], ['apply', 0, 'swap'], ['apply', 1, 'perm3']])
    assert.deepEqual(registry.phase4Lowering(op, ins(op, operand), ins(prev, 0)), spreadProgramLowering(op, ins(op, operand), ins(prev, 0)), `phase4Lowering ${op}`);
  assert.throws(() => registry.phase4Lowering('apply', ins('apply', 1), ins('drop', 0)), /super constructor/);
  assert.throws(() => registry.phase4Lowering('apply_eval', ins('apply_eval', 0), null), SyntaxError);
  for (const [field, source] of Object.entries(spreadBootstrapSources)) {
    assert.equal(registry.phase4BootstrapSources[field], source, `registry helper ${field}`);
    assert.equal(bootstrapSources[field], source, `bootstrapSources.${field}`);
    assert.ok(Number.isInteger(FIELDS[field]), `FIELDS.${field}`);
  }
  for (const [id, field] of Object.entries(spreadBuiltinFields)) assert.equal(registry.phase4BuiltinFields[id], field, `phase4BuiltinFields[${id}]`);
  for (const [name, id] of Object.entries(spreadExternalPrivateBuiltins)) {
    if (name === '__lanesIteratorClose' && !Object.hasOwn(privateBuiltins, name)) continue; // spreadAppend never closes
    assert.equal(privateBuiltins[name], id, `bootstrap privateBuiltins.${name}`);
  }
  integration.registry = true;
  counts.staticChecks += 6;
}
const header = readFileSync(`${root}vendor/quickjs-opcode.h`, 'utf8');
for (const [op, e] of Object.entries(spreadOpcodeEffects)) {
  const m = new RegExp(`DEF\\(\\s*${op},\\s*(\\d+),\\s*(\\d+),\\s*(\\d+),\\s*(\\w+)\\)`).exec(header);
  assert.ok(m, `opcode ${op} in quickjs-opcode.h`);
  assert.deepEqual([+m[1], +m[2], +m[3], m[4]], [e.size, e.pop, e.push, e.fmt], `stack effect ${op}`);
  counts.staticChecks++;
}
const reserved = { ...spreadExternalPrivateBuiltins, __lanesOwnPropertyKeys: 1240 };
for (const [name, id] of Object.entries(spreadPrivateBuiltins)) {
  assert.ok(id >= 1210 && id <= 1239, `${name} id in worker-2 range`);
  assert.ok(Object.hasOwn(spreadBuiltinFields, id), `${name} has a helper field`);
  if (Object.hasOwn(privateBuiltins, name)) assert.equal(privateBuiltins[name], id);
  else assert.ok(!Object.values(privateBuiltins).includes(id), `id ${id} collides with privateBuiltins`);
  counts.staticChecks++;
}
for (const [id, field] of Object.entries(spreadBuiltinFields)) {
  assert.ok(Object.hasOwn(spreadBootstrapSources, field), `field ${field} has a source`);
  if (!Object.hasOwn(bootstrapSources, field)) assert.ok(!(field in FIELDS), `field ${field} collides with FIELDS`);
  assert.ok(Object.values(spreadPrivateBuiltins).includes(Number(id)));
  counts.staticChecks++;
}
assert.match(spreadCallMappingWGSL({ spreadAppend: 777 }), /fnValue\.x==1210u\)\{field=777u;/);
assert.throws(() => spreadCallMappingWGSL({}), /FIELDS is missing/);
assert.ok(spreadNotes.includes('spreadProgramLowering'));
counts.staticChecks += 3;

// Lowering rules.
const ins = (op, operand) => ({ op, operand, bytes: [] });
assert.deepEqual(spreadProgramLowering('rest', ins('rest', 2)), { op: 'rest', a: 2, b: 0 });
assert.deepEqual(spreadProgramLowering('append', ins('append', 0)), { op: 'append', a: 0, b: 0 });
assert.deepEqual(spreadProgramLowering('apply', ins('apply', 0), ins('swap', 0)), { op: 'apply', a: 0, b: 0 });
assert.deepEqual(spreadProgramLowering('apply', ins('apply', 0), ins('perm3', 0)), { op: 'apply', a: 0, b: 0 });
assert.deepEqual(spreadProgramLowering('apply', ins('apply', 1), ins('perm3', 0)), { op: 'apply', a: 1, b: 0 });
assert.throws(() => spreadProgramLowering('apply', ins('apply', 1), ins('drop', 0)), SyntaxError);
assert.throws(() => spreadProgramLowering('apply', ins('apply', 2), ins('perm3', 0)), SyntaxError);
assert.throws(() => spreadProgramLowering('apply_eval', ins('apply_eval', 0)), SyntaxError);
assert.throws(() => spreadProgramLowering('rest', ins('rest', -1)), SyntaxError);
assert.equal(spreadProgramLowering('call', ins('call', 1)), null);
counts.lowering += 10;

// WGSL bodies: balanced braces, only existing shader functions / WGSL builtins,
// no WGSL reserved words used as names, no unresolved template output.
const shaderText = readFileSync(`${root}shader.js`, 'utf8');
const shaderFns = new Set([...shaderText.matchAll(/\bfn\s+(\w+)\s*\(/g)].map(m => m[1]));
const wgslBuiltins = new Set(['V', 'min', 'max', 'select', 'if', 'for', 'while']);
const wgslReserved = new Set(['target', 'this', 'new', 'set', 'get', 'type', 'self', 'from', 'of', 'move', 'mut', 'ref', 'array', 'match', 'null', 'delete', 'static']);
const wgslCases = spreadWGSLCases({ L: LIMITS });
assert.deepEqual(Object.keys(wgslCases).sort(), [...spreadOpcodes].sort());
for (const [op, body] of Object.entries(wgslCases)) {
  let depth = 0;
  for (const c of body) { if (c === '{' || c === '(') depth++; if (c === '}' || c === ')') depth--; assert.ok(depth >= 0, `${op}: unbalanced`); }
  assert.equal(depth, 0, `${op}: unbalanced`);
  assert.ok(!/undefined|NaN|\$\{/.test(body), `${op}: unresolved template`);
  for (const [, name] of body.matchAll(/\b([A-Za-z_]\w*)\s*\(/g))
    assert.ok(shaderFns.has(name) || wgslBuiltins.has(name), `${op}: unknown WGSL function ${name}`);
  for (const [, name] of body.matchAll(/\b(?:let|var)\s+(\w+)/g)) assert.ok(!wgslReserved.has(name), `${op}: reserved WGSL name ${name}`);
  counts.wgsl++;
}
for (const name of ['putProperty', 'getProperty', 'cell', 'alloc', 'call', 'construct', 'push', 'pop', 'peek'])
  assert.ok(shaderFns.has(name), `shader helper ${name}`);
assert.match(wgslCases.apply, new RegExp(`count>${LIMITS.args}u`));
assert.match(wgslCases.append, /V\(1210u,0u,11u,0u\)/);
if (integrated) {
  // The registry's generated bodies are exactly ours, and shader.js emits a
  // switch case for each op containing that body (host string build only).
  const generated = registry.phase4WGSLCases({ OP, F: FIELDS, L: LIMITS });
  for (const op of spreadOpcodes) assert.equal(generated[op], wgslCases[op], `registry WGSL body for ${op}`);
  const { shader, phase4ShaderOps } = await import('./shader.js');
  for (const op of spreadOpcodes) {
    assert.ok(phase4ShaderOps.includes(op), `phase4ShaderOps has ${op}`);
    assert.ok(shader.includes(`case ${OP[op]}u: { ${wgslCases[op]} }`), `shader switch case for ${op}`);
  }
  // call() maps builtin 1210 to the spreadAppend helper field.
  assert.ok(shader.includes(`if(fnValue.x==1210u){field=${FIELDS.spreadAppend}u;}`), 'shader call() maps 1210 -> spreadAppend');
  integration.shader = true;
  counts.wgsl += 3;
}

// ---- Native tools ----------------------------------------------------------
const build = mkdtempSync(join(root, '.phase4-build-w2-'));
let summary;
try {
  const bridge = join(build, 'bridge.c'), runner = join(build, 'runner.c');
  copyFileSync(`${root}bridge.c`, bridge); writeFileSync(runner, runnerSource);
  const inc = ['-I', build, '-I', `${root}vendor`];
  execFileSync(process.env.CC || 'cc', [...common, ...inc, bridge, ...support, '-lm', '-lpthread', '-o', join(build, 'compiler')], { stdio: 'inherit' });
  execFileSync(process.env.CC || 'cc', [...common, ...inc, runner, ...support, '-lm', '-lpthread', '-o', join(build, 'qjs-run')], { stdio: 'inherit' });
  const compile = source => JSON.parse(execFileSync(join(build, 'compiler'), [source], { encoding: 'utf8', maxBuffer: 1 << 26 }));
  const run = script => JSON.parse(execFileSync(join(build, 'qjs-run'), [script], { encoding: 'utf8' }));

  const nativeBoot = Object.fromEntries(Object.entries(bootstrapSources).map(([k, s]) => [k, compile(s)]));
  // Spread opcodes and declared foreign dependencies become nop so packProgram
  // validates every other instruction, reference and limit unchanged.
  const lowerRaw = (raw, deps = []) => {
    const seen = new Set(), foreign = new Set();
    const functions = raw.functions.map(fn => ({ ...fn, instructions: fn.instructions.map((i, k) => {
      const lowered = spreadProgramLowering(i.op, i, fn.instructions[k - 1]);
      if (lowered) { seen.add(i.op); return { ...i, op: 'nop', operand: 0 }; }
      if (deps.includes(i.op)) { foreign.add(i.op); return { ...i, op: 'nop', operand: 0 }; }
      return i;
    }) }));
    return { raw: { ...raw, functions }, seen, foreign };
  };

  // ---- 2-4. Cases ----------------------------------------------------------
  const values = new Set(), opUse = {}, results = [];
  const checkCase = (item, kind) => {
    const { feature, source, input } = item;
    const want = kind === 'value' ? { value: item.expected } : { value: item.oracle };
    if (kind === 'value') {
      assert.ok(['number', 'string', 'boolean'].includes(typeof item.expected), feature);
      assert.ok(!values.has(JSON.stringify(item.expected)), `duplicate expected value: ${feature}`); values.add(JSON.stringify(item.expected));
    }
    assert.deepEqual(oracle(source, input), want, `V8 oracle: ${feature}`); counts.oracle++;
    const other = oracle(source, input + 1);
    if (kind === 'value') { assert.notDeepEqual(other, want, `input sensitivity: ${feature}`); counts.inputSensitivity++; }
    assert.deepEqual(run(harness(source, input)), want, `native QuickJS: ${feature}`);
    assert.deepEqual(run(harness(source, input + 1)), other, `native QuickJS (input+1): ${feature}`);
    counts.nativeInterpreter += 2;
    const raw = compile(source);
    assert.ok(!raw.error, `${feature}: ${raw.error}`); counts.compiled++;
    const { raw: lowered, seen, foreign } = lowerRaw(raw, item.dependsOn || []);
    assert.ok(seen.size > 0, `${feature}: emits no spread opcode`);
    if (integrated) {
      // Real program.js lowering with every bootstrap (incl. spreadAppend) attached.
      let program;
      try { program = packProgram(attachBootstrap(raw, nativeBoot), entrySource(source)); }
      catch (e) { assert.fail(`${feature}: integrated packProgram: ${e.message}`); }
      const packedOps = new Set([...program.code].filter((_, i) => i % 4 === 0));
      for (const op of seen) assert.ok(packedOps.has(OP[op]), `${feature}: packed code lacks ${op}`);
      // Operands: rest first index / apply magic survive packing unchanged.
      const rawOperands = raw.functions.flatMap(fn => fn.instructions.filter(i => i.op === 'rest' || i.op === 'apply').map(i => `${i.op}:${i.operand}`)).sort();
      const packedOperands = [];
      // Only the case's own functions (bootstrap helpers are appended after them).
      for (let i = 0; i < program.code.length; i += 4) for (const op of ['rest', 'apply'])
        if (program.code[i] === OP[op] && program.code[i + 3] < raw.functions.length) packedOperands.push(`${op}:${program.code[i + 1]}`);
      assert.deepEqual(packedOperands.sort(), rawOperands, `${feature}: packed spread operands`);
    } else {
      try { packProgram(attachBootstrap(lowered, nativeBoot), entrySource(source)); }
      catch (e) { assert.fail(`${feature}: packProgram after spread lowering: ${e.message}`); }
    }
    counts.packed++;
    for (const op of seen) opUse[op] = (opUse[op] || 0) + 1;
    results.push({ feature, outcome: kind === 'value' ? 'value' : item.outcome, spreadOps: [...seen].sort(), ...(foreign.size ? { dependsOn: [...foreign] } : {}) });
  };
  for (const item of spreadCases) checkCase(item, 'value');
  for (const item of spreadTypeErrorCases) checkCase(item, 'value');
  for (const item of spreadUnsupportedCases) {
    assert.ok(item.outcome === 'unsupported' || item.outcome === 'value', item.feature);
    checkCase(item, item.outcome === 'value' ? 'value' : 'outcome');
  }
  for (const item of spreadResourceCases) {
    assert.equal(item.outcome, 'resource'); assert.ok(item.oracle > LIMITS.args, item.feature); checkCase(item, 'outcome');
  }
  for (const op of spreadOpcodes) assert.ok(opUse[op] > 0, `no case emits ${op}`);
  // apply magic coverage, and the super(...a) rejection rule on real bytecode.
  const magics = new Set();
  for (const item of spreadCases) for (const fn of compile(item.source).functions) for (const i of fn.instructions) if (i.op === 'apply') magics.add(i.operand);
  assert.deepEqual([...magics].sort(), [0, 1], 'cases cover apply magic 0 and 1');
  const superRaw = compile('function f(x){class A{constructor(...a){this.a=a;}}class B extends A{constructor(...a){super(...a);}}return new B(x).a[0];}');
  const superApply = superRaw.functions.flatMap(fn => fn.instructions.map((i, k) => [i, fn.instructions[k - 1]])).filter(([i]) => i.op === 'apply');
  assert.ok(superApply.some(([i, p]) => i.operand === 1 && p.op !== 'perm3'), 'super spread emits apply 1 without perm3');
  assert.throws(() => superApply.forEach(([i, p]) => spreadProgramLowering(i.op, i, p)), /super constructor/);
  counts.lowering++;

  // ---- 5. Helper sources ------------------------------------------------------
  const allowed = new Set([...Object.keys(privateBuiltins), ...Object.keys(reserved), ...Object.keys(spreadPrivateBuiltins),
    'TypeError', 'RangeError', 'Error']);
  const external = new Set([...Object.keys(reserved), ...Object.keys(spreadPrivateBuiltins)].filter(n => !Object.hasOwn(privateBuiltins, n)));
  const helperRefs = {};
  for (const [field, source] of Object.entries(spreadBootstrapSources)) {
    const raw = compile(source);
    assert.ok(!raw.error, `${field}: ${raw.error}`);
    assert.equal(raw.functions.length, 1, `${field}: helpers must be flat`);
    assert.equal(raw.functions[0].strict, 1, `${field}: strict`);
    const names = raw.functions[0].refs.map(r => r.name);
    for (const n of names) assert.ok(allowed.has(n), `${field}: unknown reference ${n}`);
    helperRefs[field] = names;
    for (const i of raw.functions[0].instructions) assert.equal(spreadProgramLowering(i.op, i, null), null, `${field}: helper uses ${i.op}`);
    // Pack as a bootstrap helper (in an existing field slot) with not-yet-integrated
    // reserved names stood in by an existing private builtin.
    const standIn = { ...raw, functions: raw.functions.map(fn => ({ ...fn, refs: fn.refs.map(r => external.has(r.name) ? { ...r, name: '__lanesUnsupported' } : r) })) };
    const entry = 'function f(x){return x;}';
    packProgram(attachBootstrap(compile(entry), { ...nativeBoot, toNumber: standIn }), 'f');
    counts.packed++;
  }

  // V8 model of the worker-4 iteration contract, used only to test the helper
  // algorithm (Get(length)/Get(index) per step, code points, kinds 0/1/2/4).
  const model = createContext({});
  new Script(`
    const isArgs = v => Object.prototype.toString.call(v) === "[object Arguments]";
    globalThis.__lanesIterationKind = v => v == null ? 4 : (Array.isArray(v) || isArgs(v)) ? 1 : (typeof v === "string" || v instanceof String) ? 2 : 0;
    globalThis.__lanesIteratorOpen = v => ({ v, i: 0, s: (typeof v === "string" || v instanceof String) ? String(v) : null });
    globalThis.__lanesIteratorStep = r => {
      if (r.s !== null) { if (r.i >= r.s.length) return r; const c = r.s.codePointAt(r.i); const t = String.fromCodePoint(c); r.i += t.length; return t; }
      if (r.i >= r.v.length) return r; return r.v[r.i++];
    };
    globalThis.__lanesDescriptor = () => Object.create(null);
    globalThis.__lanesDefine = (o, k, d) => Object.defineProperty(o, k, d);
    globalThis.__lanesUnsupported = () => { throw new Error("UNSUPPORTED"); };
    globalThis.spreadAppend = ${spreadBootstrapSources.spreadAppend};
  `).runInContext(model);
  const probes = [
    '(() => { const a = [1, , 3]; return [a]; })()',
    '(() => { const a = [1, 2]; Object.defineProperty(a, "1", { get() { if (a.length < 3) a.push(7); return 2; } }); return [a]; })()',
    '(() => { const a = [0, 1, 2]; Object.defineProperty(a, "0", { get() { a.length = 1; return 9; }, configurable: true }); return [a]; })()',
    '["a\\uD83D\\uDE00\\uDC00b"]', '[new String("xy")]', '[(function(){ return arguments; })(4, 5)]', '[[]]',
  ];
  for (const probe of probes) {
    const got = new Script(`(() => { const [v] = ${probe}; const out = [9]; const pos = spreadAppend(out, 1, v); return JSON.stringify([pos, out.length, out.map(String), Object.keys(out)]); })()`).runInContext(model);
    const want = new Script(`(() => { const [v] = ${probe}; const out = [9, ...v]; return JSON.stringify([out.length, out.length, out.map(String), Object.keys(out)]); })()`).runInContext(model);
    assert.equal(got, want, `helper model: ${probe}`); counts.helperModel++;
  }
  for (const [probe, error] of [['null', /not iterable/], ['undefined', /not iterable/], ['({})', /UNSUPPORTED/], ['5', /UNSUPPORTED/], ['({length:1,0:1})', /UNSUPPORTED/]]) {
    assert.throws(() => new Script(`spreadAppend([], 0, ${probe})`).runInContext(model), error, `helper model: ${probe}`); counts.helperModel++;
  }
  assert.equal(new Script(`(() => { let hits = 0; Object.defineProperty(Array.prototype, "0", { set() { hits++; }, configurable: true }); const out = []; spreadAppend(out, 0, [1]); delete Array.prototype[0]; return hits + ":" + out[0]; })()`).runInContext(model), '0:1');
  counts.helperModel++;

  summary = { gpuChecks: false, productionCPUFallback: false, nativeQuickJSReference: true, integratedIntoOP: integrated, integration,
    counts, spreadOpUse: opUse, helperRefs, cases: results };
} finally {
  if (!keep) rmSync(build, { recursive: true, force: true });
}
console.log(JSON.stringify(summary, null, 1));
