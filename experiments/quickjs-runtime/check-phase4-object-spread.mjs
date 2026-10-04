// Phase 4 worker 3 host checks (no GPU, no runtime.js, no CPU fallback):
//  1. V8 oracle: every case's expected value, and input sensitivity (input+1 differs).
//  2. Native QuickJS interpreter built from vendor/ in a private temp dir: agrees
//     with V8, except cases marked quickjsDeviation, which must differ.
//  3. Integrated state (lead registry): private builtins 1240/1241 registered in
//     bootstrap.js, copyDataProperties in FIELDS/bootstrapSources, OP contains
//     every worker-3 op, shader.js contains the exact WGSL case bodies, the
//     objectMethod 1240 line (before the id>=150 catch-all) and the 1241 field
//     dispatch. The helper compiles strict with a private native compiler and
//     only references registered private builtins.
//  4. Host algorithm check: the helper, evaluated by V8 against host stand-ins for
//     the private builtins, reproduces V8 spread/rest (keys, descriptors, getter
//     order, exceptions).
//  5. Every case packs with the real program.js + bootstrap.js (no aliasing);
//     packed worker-3 ops have WGSL and copy_data_properties keeps its mask in `a`.
// Importing shader.js only builds the WGSL text; nothing executes on a GPU.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Script } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { OP, FIELDS, LIMITS, entrySource, packProgram } from './program.js';
import { attachBootstrap, bootstrapSources, privateBuiltins } from './bootstrap.js';
import { shader, phase4ShaderOps } from './shader.js';
import { objectSpreadBootstrapSources, objectSpreadPrivateBuiltins, objectSpreadOpcodes, objectSpreadWGSLCases,
  objectSpreadBuiltinFields, objectSpreadFields, lowerObjectSpread, objectSpreadObjectMethodWGSL } from './phase4-object-spread.js';
import { objectSpreadCases, objectSpreadTypeErrorCases } from './phase4-object-spread-cases.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const keep = process.argv.includes('--keep');
const build = mkdtempSync(join(root, '.phase4-build-w3-'));
const support = ['dtoa', 'libregexp', 'libunicode', 'cutils'].map(n => `${root}vendor/${n}.c`);
const common = ['-O1', '-w','-D_GNU_SOURCE', '-DCONFIG_VERSION="lanes-pinned"', '-I', `${root}vendor`];
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

// Mirrors the renames in program.js packProgram (names only).
function normalize(op) {
  if (op === 'get_var' || op === 'get_var_undef') return 'get_var_ref';
  if (op === 'put_var') return 'put_var_ref';
  if (op === 'get_length') return 'get_field';
  if (/^(get_loc|put_loc|set_loc)8$/.test(op)) op = op.slice(0, -1);
  const suffix = /^(get_loc|put_loc|set_loc|get_arg|put_arg|set_arg|get_var_ref|put_var_ref|set_var_ref|call)([0-3])$/.exec(op);
  if (suffix) return suffix[1];
  if (op === 'push_minus1' || /^push_[0-7]$/.test(op) || ['push_i8', 'push_i16', 'push_i32', 'push_const', 'push_const8',
    'undefined', 'null', 'push_true', 'push_false', 'push_atom_value', 'push_empty_string'].includes(op)) return 'push';
  if (op === 'fclosure' || op === 'fclosure8') return 'closure';
  if (op === 'set_home_object') return 'nop';
  if (/^(if_true|if_false|goto)(8|16)?$/.test(op)) return op.replace(/8|16/g, '');
  return op;
}
const opsOf = raw => [...new Set(raw.functions.flatMap(fn => fn.instructions.map(i => i.op === 'define_method'
  ? ['define_field', 'define_getter', 'define_setter'][i.bytes[5] & 3] : normalize(i.op))))].sort();

let summary;
try {
  for (const [name, src] of [['runner.c', runnerSource]]) writeFileSync(join(build, name), src);
  const cc = process.env.CC || 'cc';
  execFileSync(cc, [...common, `${root}bridge.c`, ...support, '-lm', '-lpthread', '-o', join(build, 'compiler')], { stdio: 'inherit' });
  execFileSync(cc, [...common, join(build, 'runner.c'), ...support, '-lm', '-lpthread', '-o', join(build, 'qjs-run')], { stdio: 'inherit' });
  const raw = source => JSON.parse(execFileSync(join(build, 'compiler'), [source], { encoding: 'utf8', maxBuffer: 1 << 26 }));
  const run = script => JSON.parse(execFileSync(join(build, 'qjs-run'), [script], { encoding: 'utf8' }));
  const boots = Object.fromEntries(Object.entries(bootstrapSources).map(([k, s]) => [k, raw(s)]));
  const added = new Set(objectSpreadOpcodes.map(o => o.name));
  const counts = { cases: 0, oracle: 0, inputSensitivity: 0, nativeAgree: 0, nativeDeviation: 0, helperChecks: 0, algorithmChecks: 0, packed: 0 };
  const opNames = Object.keys(OP);

  // Integrated contract (lead registry: phase4-registry.js -> program.js,
  // bootstrap.js, shader.js). No temporary aliasing.
  for (const [name, id] of Object.entries(objectSpreadPrivateBuiltins)) {
    assert.ok(id >= 1240 && id <= 1269, `${name} outside 1240-1269`);
    assert.equal(privateBuiltins[name], id, `${name} not registered in bootstrap.js privateBuiltins`);
    assert.deepEqual(Object.entries(privateBuiltins).filter(([, v]) => v === id).map(([k]) => k), [name], `${id} shared`);
  }
  for (const op of added) {
    assert.ok(op in OP, `${op} missing from OP`);
    assert.ok(phase4ShaderOps.includes(op), `${op} has no WGSL case in shader.js`);
  }
  for (const field of objectSpreadFields) {
    assert.ok(field in FIELDS, `FIELDS lacks ${field}`);
    assert.equal(bootstrapSources[field], objectSpreadBootstrapSources[field], `bootstrapSources.${field} differs`);
  }
  assert.deepEqual(Object.values(objectSpreadBuiltinFields), objectSpreadFields);
  const wgsl = objectSpreadWGSLCases({ L: LIMITS });
  assert.deepEqual(Object.keys(wgsl).sort(), [...added].sort());
  assert.ok(!/\blet target\b/.test(wgsl.copy_data_properties), 'WGSL reserved word `target` used as a local');
  for (const [op, body] of Object.entries(wgsl)) assert.ok(shader.includes(body), `shader.js ${op} body differs from phase4-object-spread.js`);
  assert.ok(shader.includes(objectSpreadObjectMethodWGSL), 'objectMethod lacks the 1240 own-keys line');
  for (const [id, field] of Object.entries(objectSpreadBuiltinFields))
    assert.ok(shader.includes(`if(fnValue.x==${id}u){field=${FIELDS[field]}u;}`), `call() lacks field dispatch for ${id}`);
  // 1240 must be dispatched before objectMethod's `id>=150u` unsupported catch-all.
  assert.ok(shader.indexOf(objectSpreadObjectMethodWGSL) < shader.indexOf('if(id>=150u){states[l].status=6u;return undef();}'), '1240 line after the id>=150 catch-all');
  assert.equal(lowerObjectSpread('copy_data_properties', 2 | (1 << 2)).a, 6);
  assert.throws(() => lowerObjectSpread('copy_data_properties', 0));

  // 3. Helper sources, packed with the real program.js and bootstrap.js.
  const helpers = {};
  const entry = 'function f(x){return x;}';
  packProgram(attachBootstrap(raw(entry), boots), 'f');
  for (const [field, source] of Object.entries(objectSpreadBootstrapSources)) {
    const r = raw(source);
    assert.ok(!r.error, `${field}: ${r.error}`);
    assert.deepEqual(boots[field], r, `${field}: bootstrap bytecode`);
    const globals = r.functions.flatMap(fn => fn.refs.filter(ref => ref.type > 2).map(ref => ref.name));
    // packProgram stores undefined/NaN/Infinity literally in the capture table.
    for (const name of globals.filter(n => !['undefined', 'NaN', 'Infinity'].includes(n))) assert.ok(Object.hasOwn(privateBuiltins, name), `${field}: unknown global ${name}`);
    assert.ok(r.functions[0].strict === 1, `${field} must be strict`);
    helpers[field] = { globals: [...new Set(globals)].sort(), ops: opsOf(r), notInOP: opsOf(r).filter(op => !(op in OP)) };
    assert.deepEqual(helpers[field].notInOP, [], `${field} uses ops outside OP`);
    counts.helperChecks++;
  }

  // 4. Host algorithm check of the helper (V8 stand-ins for the private builtins).
  const prelude = `
const __lanesToObject=v=>{if(v===null||v===undefined)throw new TypeError();return Object(v);};
const __lanesOwnPropertyKeys=Object.getOwnPropertyNames,__lanesOwnHas=Object.hasOwn,__lanesOwnDescriptor=Object.getOwnPropertyDescriptor;
const __lanesDescriptor=()=>Object.create(null),__lanesDefine=Object.defineProperty;
const copy=(${objectSpreadBootstrapSources.copyDataProperties});
function snap(o){return Object.getOwnPropertyNames(o).map(k=>{const d=Object.getOwnPropertyDescriptor(o,k);return k+"="+String(d.value)+(d.writable?"w":"")+(d.enumerable?"e":"")+(d.configurable?"c":"")+(d.get?"G":"");}).join(",")+"|"+(Object.getPrototypeOf(o)===Object.prototype);}
function attempt(fn){try{return fn();}catch(e){return "throw:"+(e&&e.name||e);}}
`;
  const sources = [
    'null', 'undefined', '7', 'true', '"ab"', '[1,,3]', '{b:1,2:"t",a:2,0:"z"}',
    '{get a(){log+="a";return 1;},b:2,get c(){log+="c";return 3;}}',
    '{get a(){delete this.b;log+="d";return 1;},b:2,c:3}',
    '(()=>{const s=Object.create({inh:1});Object.defineProperty(s,"hid",{value:2});s.vis=3;return s;})()',
    '{["__proto__"]:9,x:1}', '{get a(){throw new RangeError();}}', '{hasOwnProperty:1,toString:2,p:3}',
  ];
  for (const s of sources) {
    const spread = `let log="";${prelude}attempt(()=>snap({set b(v){log+="S";},...(${s})})+log)`;
    const viaHelper = `let log="";${prelude}attempt(()=>{const t={set b(v){log+="S";}};copy(t,(${s}),null);return snap(t)+log;})`;
    assert.equal(new Script(viaHelper).runInNewContext({}), new Script(spread).runInNewContext({}), `helper spread: ${s}`);
    const rest = `let log="";${prelude}attempt(()=>{const k="p";const {a,[k]:q,...r}=(${s});return snap(r)+log;})`;
    const viaHelperRest = `let log="";${prelude}attempt(()=>{const k="p";const src=__lanesToObject(${s});const ex={};ex.a=null;src.a;ex[k]=null;src[k];const r={};copy(r,src,ex);return snap(r)+log;})`;
    assert.equal(new Script(viaHelperRest).runInNewContext({}), new Script(rest).runInNewContext({}), `helper rest: ${s}`);
    counts.algorithmChecks += 2;
  }

  // 1, 2, 5. Cases.
  const values = new Set(), results = [];
  for (const item of [...objectSpreadCases, ...objectSpreadTypeErrorCases]) {
    const { feature, source, input, expected } = item;
    counts.cases++;
    assert.ok(['number', 'string', 'boolean'].includes(typeof expected), feature);
    assert.ok(!values.has(JSON.stringify(expected)), `duplicate expected: ${feature}`); values.add(JSON.stringify(expected));
    assert.deepEqual(oracle(source, input), { value: expected }, `V8 oracle: ${feature}`); counts.oracle++;
    const other = oracle(source, input + 1);
    assert.notDeepEqual(other, { value: expected }, `input sensitivity: ${feature}`); counts.inputSensitivity++;
    const native = run(harness(source, input));
    if (item.quickjsDeviation) { assert.notDeepEqual(native, { value: expected }, `expected QuickJS deviation: ${feature}`); counts.nativeDeviation++; }
    else {
      assert.deepEqual(native, { value: expected }, `native QuickJS: ${feature}`);
      assert.deepEqual(run(harness(source, input + 1)), other, `native QuickJS input+1: ${feature}`);
      counts.nativeAgree++;
    }
    const r = raw(source);
    assert.ok(!r.error, `${feature}: ${r.error}`);
    const ops = opsOf(r);
    // Integrated admission with the real program.js and bootstrap.js.
    const program = packProgram(attachBootstrap(r, boots), entrySource(source));
    const missing = ops.filter(op => !(op in OP));
    assert.deepEqual(missing, [], `${feature}: ops outside OP`);
    const uses = ops.filter(op => added.has(op));
    const masks = [...new Set(r.functions.flatMap(fn => fn.instructions.filter(i => i.op === 'copy_data_properties').map(i => i.operand)))];
    for (const m of masks) lowerObjectSpread('copy_data_properties', m);
    // Packed words: [op, a, b, function]. Every worker-3 op has a WGSL case and
    // copy_data_properties carries its raw mask in `a`.
    const packedMasks = new Set();
    for (let i = 0; i < program.code.length; i += 4) {
      const name = opNames[program.code[i]];
      if (added.has(name)) assert.ok(phase4ShaderOps.includes(name), `${feature}: ${name} without WGSL`);
      if (name === 'copy_data_properties') { packedMasks.add(program.code[i + 1]); assert.equal(program.code[i + 2], 0); }
    }
    assert.deepEqual([...packedMasks].sort(), [...masks].sort(), `${feature}: packed masks`);
    counts.packed++;
    results.push({ feature, ...(item.quickjsDeviation ? { quickjsDeviation: native } : {}), worker3Ops: uses, copyMasks: masks });
  }
  summary = { gpuChecks: false, nativeReferenceExecution: true, productionCPUFallback: false, integrated: true, counts, helpers, results };
} finally {
  if (!keep) rmSync(build, { recursive: true, force: true });
}
console.log(JSON.stringify(summary, null, 1));
