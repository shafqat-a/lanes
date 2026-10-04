// Phase 4 next wave, worker 4: host checks for private instance/static fields
// and `#x in o` (phase4-next-w4-cases.js). Host only: no GPU, no CPU replay,
// no guest execution outside the oracles.
//  1. V8 oracle (node:vm) reproduces every fixed expectation; input + 1 changes it.
//  2. A private native QuickJS interpreter built from vendor/ agrees, except
//     for recorded `quickjsDeviation` fixtures (which must still deviate).
//  3. Every admitted fixture packs with the coordinator's native compiler and
//     the integrated program.js, and every packed opcode has a WGSL case.
//  4. Unsupported fixtures pack (status 6 is the GPU obligation); rejected
//     fixtures are early errors in V8 and stay compiler-rejected (SyntaxError).
//  5. The integrated fixes are present (regression guards, not diff application):
//     D1 shader.js set_name_computed private-name branch + keySlot skip;
//     D2 phase4-class-elements.js privateNameOrAbsent / privateFind key==0 and
//        worker 5's private-slot TDZ loads (program.js b=1, shader get case);
//     D3 worker 5's vendor setter-only `#s in o` fix (marker + native probes).
//     `regression` fixtures must exhibit the bytecode shape the fix handles.
//  6. Native-vs-Wasm compiler parity: every fixture (and the bootstrap) packs
//     to identical code and image with generated/compiler and
//     generated/compiler.mjs; rejected fixtures are rejected by both.
// Usage: node experiments/quickjs-runtime/check-phase4-next-w4.mjs [--keep] [--no-native] [--dump=<feature substring>]
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Script } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { OP, FIELDS as F, LIMITS as L, entrySource, packProgram } from './program.js';
import { attachBootstrap, bootstrapSources } from './bootstrap.js';
import { shader } from './shader.js';
import { classElementOpcodeNames, classElementWGSLCases, classElementWGSLFunctions } from './phase4-class-elements.js';
import { classElementCases } from './phase4-class-element-cases.js';
import { w4Cases, w4ErrorCases, w4UnsupportedCases, w4RejectedCases } from './phase4-next-w4-cases.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const keep = process.argv.includes('--keep'), nativeRun = !process.argv.includes('--no-native');
const dump = (process.argv.find(a => a.startsWith('--dump=')) || '').slice(7);
const harness = (source, input) => `${source}\nJSON.stringify((function(){try{return {value:f(${JSON.stringify(input)})};}catch(e){return {error:e&&e.name};}})())`;
const v8 = (source, input) => JSON.parse(new Script(harness(source, input)).runInNewContext({}, { timeout: 2000 }));
const compiler = fileURLToPath(new URL('./generated/compiler', import.meta.url));
const raw = source => JSON.parse(execFileSync(compiler, [source], { encoding: 'utf8', maxBuffer: 1 << 28 }));
const boot = Object.fromEntries(Object.entries(bootstrapSources).map(([name, source]) => [name, raw(source)]));
const pack = source => packProgram(attachBootstrap(raw(source), boot), entrySource(source));
const { default: createWasm } = await import('./generated/compiler.mjs');
const wasm = await createWasm();
const rawWasm = source => JSON.parse(wasm.ccall('lanes_compile', 'string', ['string'], [source]));
const bootWasm = Object.fromEntries(Object.entries(bootstrapSources).map(([name, source]) => [name, rawWasm(source)]));
const packWasm = source => packProgram(attachBootstrap(rawWasm(source), bootWasm), entrySource(source));
const opNames = Object.keys(OP);
const wgslCases = new Set([...shader.matchAll(/case ((?:\d+u, )*\d+u):/g)].flatMap(m => m[1].split(', ').map(n => parseInt(n, 10))));
const decode = code => { const out = []; for (let i = 0; i < code.length; i += 4) out.push({ op: opNames[code[i]], a: code[i + 1], b: code[i + 2], fn: code[i + 3] }); return out; };
const listing = code => decode(code).map((x, i) => `${i}: ${x.op} ${x.a} ${x.b} ${x.fn}`);

const runner = `#include "quickjs.c"
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
const support = ['dtoa', 'libregexp', 'libunicode', 'cutils'].map(n => `${root}vendor/${n}.c`);
const buildNative = dir => {
  writeFileSync(join(dir, 'runner.c'), runner);
  execFileSync(process.env.CC || 'cc', ['-O1', '-w', '-D_GNU_SOURCE', '-DCONFIG_VERSION="lanes-pinned"', '-I', `${root}vendor`, join(dir, 'runner.c'), ...support, '-lm', '-lpthread', '-o', join(dir, 'qjs-run')], { stdio: ['ignore', 'ignore', 'inherit'] });
  return (source, input) => {
    try { return JSON.parse(execFileSync(join(dir, 'qjs-run'), [harness(source, input)], { encoding: 'utf8' })); }
    catch (error) { return { harnessError: String(error.stdout || error.message) }; }
  };
};

const PRIVATE_USES = new Set(['private_in', 'get_private_field', 'put_private_field', 'check_brand']);
let build, runNative = null;
try {
  if (dump) {
    for (const item of [...w4Cases, ...w4ErrorCases, ...w4UnsupportedCases].filter(i => i.feature.includes(dump)))
      console.log(`== ${item.feature}\n${listing(pack(item.source).code).slice(0, 200).join('\n')}`);
    process.exit(0);
  }
  if (nativeRun) { build = mkdtempSync(join(root, '.phase4-build-w4-')); runNative = buildNative(build); }

  // ---- 5. Integrated fixes are present ---------------------------------------
  const ctx = { OP, F, L };
  const fns = classElementWGSLFunctions(ctx), cases = classElementWGSLCases(ctx);
  const fixes = {};
  // D1 (shader.js).
  assert.ok(shader.includes(`if(op==${OP.set_name_computed}u&&states[l].sp>=2u){let named=states[l].stack[states[l].sp-2u];if(named.z==4u&&states[l].heap[named.x].kind==33u){keySlot=0xffffffffu;}}`), 'D1: keySlot skip for private names');
  assert.ok(shader.includes('if(named.z==4u&&states[l].heap[named.x].kind==33u){functionName(l,peek(l),image[states[l].heap[named.x].value.x],false);}'), 'D1: set_name_computed names from the private description');
  assert.equal(shader.split(`case ${OP.set_name_computed}u:`).length, 2, 'D1: one set_name_computed case');
  fixes.D1 = 'present (shader.js keySlot skip + set_name_computed private branch)';
  // D2 (phase4-class-elements.js + worker 5 TDZ loads).
  assert.ok(/fn privateNameOrAbsent\(l:u32,v:V\)->u32 \{\s*if\(v\.z==6u\)\{return 0u;\}\s*return privateName\(l,v\);\s*\}/.test(fns), 'D2: privateNameOrAbsent');
  assert.ok(fns.includes('if(holder==0u||holder==PRIVATE_NO_STORAGE||key==0u){return 0u;}'), 'D2: privateFind key==0 guard');
  for (const op of ['get_private_field', 'put_private_field', 'private_in']) assert.ok(cases[op].includes('privateNameOrAbsent('), `D2: ${op} uses privateNameOrAbsent`);
  assert.ok(!cases.define_private_field.includes('privateNameOrAbsent('), 'D2: define_private_field keeps the strict helper');
  assert.ok(shader.includes('if (v.z==6u && ins.z==0u) { states[l].status=5u; } else { push(l,v); }'), 'D2 (w5): flagged private-slot loads push the TDZ cell');
  assert.equal(shader.split('fn privateNameOrAbsent(').length, 2, 'D2: helper in the generated shader');
  fixes.D2 = 'present (privateNameOrAbsent, privateFind key==0, b=1 private-slot loads)';
  // D3 (vendor, worker 5).
  const vendor = readFileSync(join(root, 'vendor/quickjs.c'), 'utf8');
  const inCase = vendor.slice(vendor.indexOf('case OP_scope_in_private_field:'), vendor.indexOf('dbuf_putc(bc, OP_private_in);'));
  assert.ok(/var_kind == JS_VAR_PRIVATE_SETTER/.test(inCase) && /get_private_setter_name/.test(inCase), 'D3: vendor setter-only #s in o redirect');
  fixes.D3 = { vendor: 'present (OP_scope_in_private_field -> #s<set>)' };

  const summary = { admitted: 0, v8: 0, native: 0, nativeDeviations: [], regressions: [], gc: 0, unsupported: 0, rejected: 0, parity: 0, opcodes: new Set() };
  const checkPack = item => {
    const packed = pack(item.source);
    for (let i = 0; i < packed.code.length; i += 4) {
      const name = opNames[packed.code[i]];
      summary.opcodes.add(name);
      assert.ok(wgslCases.has(packed.code[i]), `${item.feature}: ${name} lacks WGSL`);
    }
    // 6. Native-vs-Wasm parity.
    const other = packWasm(item.source);
    assert.deepEqual(other.code, packed.code, `${item.feature}: native/Wasm code parity`);
    assert.deepEqual(other.image, packed.image, `${item.feature}: native/Wasm image parity`);
    summary.parity++;
    summary.admitted++;
    return packed;
  };
  const expectOf = item => item.throws ? { error: item.expected } : { value: item.expected };
  const seen = new Set();
  for (const item of [...w4Cases, ...w4ErrorCases]) {
    assert.ok(!seen.has(item.feature), `duplicate feature ${item.feature}`); seen.add(item.feature);
    assert.deepEqual(v8(item.source, item.input), expectOf(item), `${item.area}/${item.feature}: V8 oracle`);
    if (!item.throws) assert.notDeepEqual(v8(item.source, item.input + 1), expectOf(item), `${item.area}/${item.feature}: input+1 must change the result`);
    summary.v8++;
    if (runNative) {
      const native = runNative(item.source, item.input);
      if (item.quickjsDeviation) {
        assert.notDeepEqual(native, expectOf(item), `${item.feature}: recorded QuickJS deviation no longer deviates`);
        summary.nativeDeviations.push({ feature: item.feature, native });
      } else assert.deepEqual(native, expectOf(item), `${item.area}/${item.feature}: native QuickJS`);
      summary.native++;
    }
    const { code } = checkPack(item);
    if (item.gc) summary.gc++;
    const ins = decode(code);
    // Every load flagged b=1 feeds a private operation (worker 5's TDZ contract).
    ins.forEach((x, i) => { if ((x.op === 'get_loc' || x.op === 'get_var_ref') && x.b === 1) assert.ok(PRIVATE_USES.has(ins[i + 1].op) || (ins[i + 1].op === 'swap' && ins[i + 3].op === 'check_brand'), `${item.feature}: b=1 load at ${i} does not feed a private op`); });
    const setName = ins.findIndex((x, i) => x.op === 'set_name_computed' && ins[i + 1].op === 'define_private_field' && ins[i - 1].op === 'closure' && /^get_(var_ref|loc)/.test(ins[i - 2].op));
    if (item.regression === 'D1') {
      assert.ok(setName > 0, `${item.feature}: expected set_name_computed over a private name`);
      summary.regressions.push({ feature: item.feature, fix: 'D1', setNameComputedAt: setName });
    }
    if (item.regression === 'D2') {
      // The private-name slot is read (flagged b=1) before its private_symbol
      // runs: directly in the class-defining function, or in a closure called
      // from a computed key.
      const symbol = ins.findIndex((x, i) => x.op === 'private_symbol' && ins[i + 1].op === 'put_loc');
      assert.ok(symbol > 0, `${item.feature}: private_symbol present`);
      const slot = ins[symbol + 1].a, fn = ins[symbol].fn;
      assert.ok(ins.slice(0, symbol).some(x => x.fn === fn && x.op === 'set_loc_uninitialized' && x.a === slot), `${item.feature}: slot starts in TDZ`);
      const direct = ins.findIndex((x, i) => i < symbol && x.fn === fn && x.op === 'get_loc' && x.a === slot && PRIVATE_USES.has(ins[i + 1].op));
      const call = ins.findIndex((x, i) => i < symbol && x.fn === fn && (x.op === 'call' || x.op === 'call_method'));
      const captured = ins.findIndex((x, i) => x.fn !== fn && x.op === 'get_var_ref' && PRIVATE_USES.has(ins[i + 1]?.op));
      const read = direct >= 0 ? direct : captured;
      assert.ok(direct >= 0 || (call >= 0 && captured >= 0), `${item.feature}: early private-slot read not found`);
      assert.equal(ins[read].b, 1, `${item.feature}: early private-slot read must be flagged b=1`);
      summary.regressions.push({ feature: item.feature, fix: 'D2', slot, privateSymbolAt: symbol, readAt: read, flagged: ins[read].b });
    }
    if (item.regression === 'D3') {
      // `#s in o` must no longer load the never-written `#s` slot: the loaded
      // value feeding private_in is flagged and is a setter closure slot.
      const at = ins.findIndex((x, i) => x.op === 'private_in' && /^get_(var_ref|loc)$/.test(ins[i - 1].op));
      assert.ok(at > 0 && ins[at - 1].b === 1, `${item.feature}: flagged load feeds private_in`);
      summary.regressions.push({ feature: item.feature, fix: 'D3', privateInAt: at });
    }
  }
  for (const item of w4UnsupportedCases) {
    assert.deepEqual(v8(item.source, item.input), { value: item.normative }, `${item.feature}: normative`);
    checkPack(item); summary.unsupported++;
  }
  for (const item of w4RejectedCases) {
    assert.throws(() => new Script(item.source), SyntaxError, `${item.feature}: V8 early error`);
    assert.throws(() => pack(item.source), error => error instanceof SyntaxError, `${item.feature} must stay rejected (native)`);
    assert.throws(() => packWasm(item.source), error => error instanceof SyntaxError, `${item.feature} must stay rejected (Wasm)`);
    summary.rejected++;
  }
  for (const name of ['private_symbol', 'get_private_field', 'put_private_field', 'define_private_field', 'private_in', 'add_brand', 'check_brand'])
    assert.ok(summary.opcodes.has(name), `no fixture exercises ${name}`);
  for (const fix of ['D1', 'D2', 'D3']) assert.ok(summary.regressions.some(r => r.fix === fix), `no regression fixture for ${fix}`);
  // Bootstrap parity is covered by the packed comparison above (every packed
  // program attaches the bootstrap compiled by the same compiler). Raw JSON is
  // not compared: its instruction `bytes` carry runtime-local atom numbers that
  // differ between a fresh native process and the long-lived Wasm instance.

  // D3 behaviour on the rebuilt native interpreter (same vendor/ as the compilers).
  if (runNative) {
    const probes = [
      ['instance setter-only', `function f(x){ class A { set #s(v){} static has(o){ return #s in o; } } return A.has(new A()) + ':' + A.has({}) + ':' + A.has({ undefined: 1 }) + ':' + x; }`, 'true:false:false:1'],
      ['static setter-only', `function f(x){ class A { static set #s(v){} static has(o){ return #s in o; } } return A.has(A) + ':' + A.has({ undefined: 1 }) + ':' + x; }`, 'true:false:1'],
      ['setter-only nested closure', `function f(x){ class A { set #s(v){} static has(){ return o => #s in o; } } return A.has()(new A()) + ':' + x; }`, 'true:1'],
      ['getter+setter unchanged', `function f(x){ class A { get #s(){ return 1; } set #s(v){} static has(o){ return #s in o; } } return A.has(new A()) + ':' + A.has({}) + ':' + x; }`, 'true:false:1'],
    ];
    for (const [name, source, expected] of probes) {
      assert.deepEqual(v8(source, 1), { value: expected }, `${name}: V8`);
      assert.deepEqual(runNative(source, 1), { value: expected }, `${name}: native QuickJS (patched vendor)`);
      const a = pack(source), b = packWasm(source);
      assert.deepEqual(a.code, b.code, `${name}: native/Wasm parity`);
    }
    fixes.D3.nativeProbes = probes.length;
  }
  fixes.leadFixturesWithPrivateSetName = classElementCases.filter(item => decode(pack(item.source).code).some((x, i, all) => x.op === 'set_name_computed' && all[i + 1]?.op === 'define_private_field')).map(item => item.feature);
  console.log(JSON.stringify({ gpuChecks: false, guestExecution: false, wgslCompiled: false, ...summary, opcodes: [...summary.opcodes].filter(n => classElementOpcodeNames.includes(n)), fixes }, null, 1));
} finally {
  if (build && !keep) rmSync(build, { recursive: true, force: true });
}
