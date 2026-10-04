// Phase 4 next wave, worker 5 host checks: private methods, private accessors
// and static private brands (phase4-next-w5-cases.js) on top of the lead's
// phase4-class-elements.js representation. Host only: no GPU, no CPU replay.
//  1. V8 oracle (node:vm) reproduces every fixed ES2025 expectation; input + 1
//     changes value results.
//  2. A private native QuickJS built from vendor/ agrees on every fixture.
//  3. Every admitted fixture packs with the native compiler and program.js and
//     every packed opcode has a WGSL case.
//  4. The applied w5 fixes are present and effective:
//     - vendor/quickjs.c: setter-only `#x in o` loads `#x<set>`; no packed
//       private_in (w5 or lead fixture) reads a never-written private slot;
//     - program.js privateSlotLoad: every unchecked load feeding a private
//       opcode is packed with b=1 (including every TDZ-read witness), every
//       unchecked load of a `#…` ref is flagged, nothing else is flagged;
//     - shader.js get case keeps TDZ cells only when ins.z!=0, and the private
//       opcodes answer a TDZ operand with TypeError / false.
//  5. Native (generated/compiler) vs Wasm (generated/compiler.mjs) parity: raw
//     output and packed code/image are identical for every fixture, and
//     rejected programs are rejected identically.
//  6. Unsupported fixtures pack (status 6 is the GPU obligation) and record the
//     normative result; rejected fixtures stay rejected by the declared front
//     end (the class gate, the function-kind gate, acorn + QuickJS).
// Usage: node experiments/quickjs-runtime/check-phase4-next-w5.mjs [--keep] [--no-native] [--dump=<feature substring>]
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Script } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { OP, entrySource, packProgram } from './program.js';
import { attachBootstrap, bootstrapSources } from './bootstrap.js';
import { shader } from './shader.js';
import { privateSlotLoad, classElementWGSLFunctions, classElementWGSLCases } from './phase4-class-elements.js';
import { classElementCases, classElementErrorCases } from './phase4-class-element-cases.js';
import { w5Cases, w5ErrorCases, w5RegressionCases, w5UnsupportedCases, w5RejectedCases } from './phase4-next-w5-cases.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const keep = process.argv.includes('--keep'), nativeRun = !process.argv.includes('--no-native');
const dump = process.argv.find(a => a.startsWith('--dump='))?.slice(7);
const harness = (source, input) => `${source}\nJSON.stringify((function(){try{return {value:f(${JSON.stringify(input)})};}catch(e){return {error:e&&e.name};}})())`;
const v8 = (source, input) => JSON.parse(new Script(harness(source, input)).runInNewContext({}, { timeout: 2000 }));
const compiler = fileURLToPath(new URL('./generated/compiler', import.meta.url));
const raw = source => JSON.parse(execFileSync(compiler, [source], { encoding: 'utf8', maxBuffer: 1 << 28 }));
const { default: createWasm } = await import('./generated/compiler.mjs');
const wasm = await createWasm();
const rawWasm = source => JSON.parse(wasm.ccall('lanes_compile', 'string', ['string'], [source]));
const boot = Object.fromEntries(Object.entries(bootstrapSources).map(([name, source]) => [name, raw(source)]));
const bootWasm = Object.fromEntries(Object.entries(bootstrapSources).map(([name, source]) => [name, rawWasm(source)]));
const pack = source => packProgram(attachBootstrap(raw(source), boot), entrySource(source));
const opNames = Object.keys(OP);
const wgslCases = new Set([...shader.matchAll(/case ((?:\d+u, )*\d+u):/g)].flatMap(m => m[1].split(', ').map(n => parseInt(n, 10))));
const admittedW5 = [...w5Cases, ...w5ErrorCases, ...w5RegressionCases];
const all = [...admittedW5, ...w5UnsupportedCases, ...w5RejectedCases];
const seen = new Set();
for (const item of all) { assert.ok(!seen.has(item.feature), `duplicate feature ${item.feature}`); seen.add(item.feature); }

if (dump) {
  for (const item of all.filter(i => i.feature.includes(dump))) {
    const r = raw(item.source);
    console.log(`== ${item.feature}`);
    if (r.error) { console.log('error:', r.error); continue; }
    r.functions.forEach((fn, i) => {
      console.log(`-- fn ${i} ${JSON.stringify(fn.name)} args=${fn.args} locals=${fn.locals} kind=${fn.kind} refs=${JSON.stringify(fn.refs)}`);
      for (const ins of fn.instructions) console.log(`   ${ins.pc}\t${ins.op}\t${ins.operand === undefined ? '' : JSON.stringify(ins.operand)}`);
    });
  }
  process.exit(0);
}

// Raw QuickJS ops use short forms: get_loc0..3 / put_var_ref2 carry the index
// in the name; get_loc8 / put_loc8 and the long forms carry it as operand.
// set_loc_uninitialized only (re)creates the TDZ and is not an initialisation.
const slotOp = ins => {
  const m = /^(get|put|set)_(loc|var_ref)(\d)?(_check|_check_init|_checkthis)?$/.exec(ins.op);
  if (!m) return null;
  return { access: m[1] === 'get' ? 'load' : 'store', space: m[2], index: m[3] !== undefined && m[3] !== '8' ? Number(m[3]) : ins.operand };
};
const isUncheckedLoad = ins => { const s = slotOp(ins); return s?.access === 'load' && !/_check/.test(ins.op); };
const parents = r => { const p = new Map(); r.functions.forEach((fn, i) => fn.constants?.forEach(k => { if (k && 'function' in k) p.set(k.function, i); })); return p; };

// D1 witness: a private_in whose operand slot (resolved through closure refs:
// type 0 parent local, 1 parent argument, 2 parent ref) is never written.
function uninitialisedPrivateIn(r) {
  const fns = r.functions, findings = [], parentOf = parents(r);
  const resolve = (f, slot) => {
    if (slot.space === 'loc') return `${f}:${slot.index}`;
    let idx = slot.index;
    for (let guard = 0; guard < 64; guard++) {
      const ref = fns[f].refs[idx], p = parentOf.get(f);
      if (!ref || p === undefined || ref.type === 1) return null;
      if (ref.type === 0) return `${p}:${ref.index}`;
      f = p; idx = ref.index;
    }
    return null;
  };
  const stores = new Set();
  fns.forEach((fn, f) => fn.instructions.forEach(ins => {
    const slot = slotOp(ins);
    if (slot?.access === 'store') { const t = resolve(f, slot); if (t) stores.add(t); }
  }));
  fns.forEach((fn, f) => fn.instructions.forEach((ins, j) => {
    if (ins.op !== 'private_in') return;
    const slot = j > 0 ? slotOp(fn.instructions[j - 1]) : null;
    if (slot?.access !== 'load') return;
    const t = resolve(f, slot);
    if (t && !stores.has(t)) findings.push({ fn: f, pc: ins.pc, slot: t, name: slot.space === 'var_ref' ? fns[f].refs[slot.index]?.name : undefined });
  }));
  return findings;
}

// D2 witness: a flagged private load runs before its slot's first store,
// either directly in the defining function or in a closure that the defining
// function calls right after creating it.
const CALL = /^(tail_)?call(_method|[0-3])?$/;
function tdzPrivateReads(r) {
  const fns = r.functions, findings = [], parentOf = parents(r), createdAt = new Map();
  fns.forEach(fn => fn.instructions.forEach((ins, j) => {
    if (/^fclosure8?$/.test(ins.op)) { const k = fn.constants[ins.operand]; if (k && 'function' in k) createdAt.set(k.function, j); }
  }));
  const firstStore = (p, idx) => fns[p].instructions.findIndex(ins => { const s = slotOp(ins); return s?.access === 'store' && s.space === 'loc' && s.index === idx; });
  fns.forEach((fn, f) => fn.instructions.forEach((ins, j) => {
    if (!isUncheckedLoad(ins) || !privateSlotLoad(fn.instructions, j)) return;
    const slot = slotOp(ins);
    let owner = f, idx = slot.index;
    if (slot.space === 'var_ref') { const ref = fn.refs[idx]; if (!ref || ref.type !== 0) return; owner = parentOf.get(f); idx = ref.index; if (owner === undefined) return; }
    const store = firstStore(owner, idx);
    if (owner === f) { if (store < 0 || j < store) findings.push({ fn: f, pc: ins.pc, slot: `${owner}:${idx}`, direct: true }); return; }
    const created = createdAt.get(f), body = fns[owner].instructions;
    if (created === undefined || (store >= 0 && created > store)) return;
    const calledEarly = body.slice(created + 1, Math.min(created + 5, store < 0 ? body.length : store)).some(i => CALL.test(i.op));
    if (calledEarly) findings.push({ fn: f, pc: ins.pc, slot: `${owner}:${idx}`, name: fn.refs[slot.index]?.name });
  }));
  return findings;
}

let build, runNative = null;
try {
  if (nativeRun) {
    build = mkdtempSync(join(root, '.phase4-build-w5-'));
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
      catch (error) { return { harnessError: String(error.stdout || error.message).trim() }; }
    };
  }

  // 4a. Static presence of the applied fixes in the lead-owned sources.
  const vendor = readFileSync(`${root}vendor/quickjs.c`, 'utf8');
  const inCase = vendor.slice(vendor.indexOf('    case OP_scope_in_private_field:'), vendor.indexOf('dbuf_putc(bc, OP_private_in);'));
  assert.ok(inCase.includes('if (var_kind == JS_VAR_PRIVATE_SETTER) {') && inCase.includes('get_private_setter_name(ctx, var_name)') && inCase.includes('resolve_scope_private_field1(ctx, &is_ref, &var_kind, s,'), 'vendor: setter-only private_in loads #x<set>');
  const programSource = readFileSync(`${root}program.js`, 'utf8');
  assert.ok(programSource.includes("if ((op === 'get_loc' || op === 'get_var_ref') && privateSlotLoad(fn.instructions, index)) b = 1;"), 'program.js flags private slot loads');
  assert.ok(shader.includes('if (v.z==6u && ins.z==0u) { states[l].status=5u; } else { push(l,v); }'), 'shader get case keeps flagged TDZ cells');
  const wgslFns = classElementWGSLFunctions({ L: { heap: 2048 } }), wgslPrivate = classElementWGSLCases();
  assert.ok(wgslFns.includes('fn privateNameOrAbsent(l:u32,v:V)->u32 {\n  if(v.z==6u){return 0u;}'), 'privateNameOrAbsent maps TDZ to key 0');
  assert.ok(wgslFns.includes('if(holder==0u||holder==PRIVATE_NO_STORAGE||key==0u){return 0u;}'), 'privateFind: key 0 finds nothing');
  for (const op of ['get_private_field', 'put_private_field', 'private_in']) assert.ok(wgslPrivate[op].includes('privateNameOrAbsent(l,name)'), `${op} uses privateNameOrAbsent`);
  assert.ok(wgslPrivate.define_private_field.includes('privateName(l,name)'), 'define_private_field keeps the strict privateName (checked load, never TDZ)');
  assert.ok(wgslFns.includes('if(fnValue.z!=5u||states[l].heap[fnValue.x].kind!=5u){states[l].status=4u;return 0u;}'), 'privateBrand: TDZ closure -> TypeError');
  for (const op of ['private_in', 'get_private_field', 'put_private_field', 'check_brand']) assert.ok(shader.includes(`case ${OP[op]}u:`), `WGSL case ${op}`);

  const summary = { admitted: 0, v8: 0, native: 0, regression: { setterOnlyIn: 0, tdzRead: 0, tdzWitnessLoadsFlagged: 0 }, flaggedLoads: 0, wasmParity: { programs: 0, rejected: 0 }, unsupported: 0, rejected: {}, opcodes: new Set() };
  const expectOf = item => item.throws ? { error: item.expected } : { value: item.expected };
  // 4b/5. Pack natively, check WGSL coverage, flags on flagged loads, and Wasm parity.
  const packChecked = (item, r) => {
    const attached = attachBootstrap(r, boot), name = entrySource(item.source);
    const native = packProgram(attached, name);
    const viaWasm = packProgram(attachBootstrap(rawWasm(item.source), bootWasm), name);
    // Raw `bytes` embed QuickJS atom numbers, which depend on the atom table of
    // each compiler instance (the Wasm module is reused across calls); every
    // decoded field must match, and packing must be bit-identical.
    const decoded = x => ({ ...x, functions: x.functions.map(fn => ({ ...fn, instructions: fn.instructions.map(({ bytes, ...ins }) => ins) })) });
    assert.deepEqual(decoded(rawWasm(item.source)), decoded(r), `${item.feature}: native vs Wasm decoded raw output`);
    assert.deepEqual(viaWasm.code, native.code, `${item.feature}: native vs Wasm packed code`);
    assert.deepEqual(viaWasm.image, native.image, `${item.feature}: native vs Wasm packed image`);
    summary.wasmParity.programs++;
    const { code } = native;
    for (let i = 0; i < code.length; i += 4) {
      const op = opNames[code[i]];
      summary.opcodes.add(op);
      assert.ok(wgslCases.has(code[i]), `${item.feature}: ${op} lacks WGSL`);
    }
    // Every raw instruction maps to one packed instruction (4 words).
    let offset = 0;
    const entries = attached.functions.map(fn => { const e = offset; offset += fn.instructions.length; return e; });
    const word = (f, j) => (entries[f] + j) * 4;
    r.functions.forEach((fn, f) => fn.instructions.forEach((ins, j) => {
      if (!['get_loc', 'get_var_ref'].includes(opNames[code[word(f, j)]])) return;
      const flagged = isUncheckedLoad(ins) && privateSlotLoad(fn.instructions, j);
      assert.equal(code[word(f, j) + 2], flagged ? 1 : 0, `${item.feature}: load flag at fn ${f} pc ${ins.pc}`);
      const slot = slotOp(ins), refName = slot?.space === 'var_ref' ? fn.refs[slot.index]?.name : undefined;
      if (isUncheckedLoad(ins) && refName?.startsWith('#')) assert.ok(flagged, `${item.feature}: private load of ${refName} not flagged`);
      if (flagged && slot.space === 'var_ref') assert.ok(refName?.startsWith('#'), `${item.feature}: flagged non-private load ${refName}`);
      if (flagged) summary.flaggedLoads++;
    }));
    return { code, word };
  };

  for (const item of admittedW5) {
    assert.deepEqual(v8(item.source, item.input), expectOf(item), `${item.area}/${item.feature}: V8 oracle`);
    if (item.fixedAcrossInputs) assert.deepEqual(v8(item.source, item.input + 1), expectOf(item), `${item.feature}: preserved constant-result source`);
    if (!item.throws && !item.fixedAcrossInputs) assert.notDeepEqual(v8(item.source, item.input + 1), expectOf(item), `${item.area}/${item.feature}: input+1 must change the result`);
    summary.v8++;
    if (runNative) {
      assert.ok(!item.quickjsDeviation, `${item.feature}: no deviations expected`);
      assert.deepEqual(runNative(item.source, item.input), expectOf(item), `${item.area}/${item.feature}: native QuickJS`);
      summary.native++;
    }
    const r = raw(item.source);
    const { code, word } = packChecked(item, r);
    summary.admitted++;
    assert.deepEqual(uninitialisedPrivateIn(r), [], `${item.feature}: private_in reads a never-written private slot`);
    if (item.setterOnlyIn) {
      // The private_in operand is the `#s<set>` closure.
      const hits = r.functions.flatMap(fn => fn.instructions.flatMap((ins, j) => ins.op === 'private_in' ? [fn.refs[slotOp(fn.instructions[j - 1])?.index]?.name] : []));
      assert.ok(hits.length > 0 && hits.every(n => n === '#s<set>'), `${item.feature}: private_in loads #s<set> (${hits})`);
      summary.regression.setterOnlyIn++;
    }
    const tdz = tdzPrivateReads(r);
    if (item.tdzRead) {
      assert.ok(tdz.length > 0, `${item.feature}: TDZ read shape no longer present (fixture lost its purpose)`);
      for (const w of tdz) {
        const j = r.functions[w.fn].instructions.findIndex(ins => ins.pc === w.pc);
        assert.equal(code[word(w.fn, j) + 2], 1, `${item.feature}: TDZ witness load packed with b=1`);
        summary.regression.tdzWitnessLoadsFlagged++;
      }
      summary.regression.tdzRead++;
    } else assert.deepEqual(tdz, [], `${item.feature}: unexpected TDZ private read`);
  }
  // The lead's class-element fixtures: same fix invariants and Wasm parity.
  for (const item of [...classElementCases, ...classElementErrorCases]) {
    const r = raw(item.source);
    assert.deepEqual(uninitialisedPrivateIn(r), [], `lead ${item.feature}: never-written private slot`);
    packChecked(item, r);
  }
  for (const item of w5UnsupportedCases) {
    assert.deepEqual(v8(item.source, item.input), { value: item.normative }, `${item.feature}: normative`);
    packChecked(item, raw(item.source)); summary.admitted++; summary.unsupported++;
  }
  for (const item of w5RejectedCases) {
    const early = (() => { try { new Script(item.source); return null; } catch (e) { return e.name; } })();
    let acorn = null; try { entrySource(item.source); } catch (e) { acorn = e; }
    const quickjs = raw(item.source).error || null, quickjsWasm = rawWasm(item.source).error || null;
    assert.equal(quickjsWasm, quickjs, `${item.feature}: native vs Wasm compiler error`);
    let packed = null; try { pack(item.source); } catch (e) { packed = e; }
    let packedWasm = null; try { packProgram(attachBootstrap(rawWasm(item.source), bootWasm), entrySource(item.source)); } catch (e) { packedWasm = e; }
    assert.ok(packed && packedWasm, `${item.feature}: must stay rejected (native and Wasm)`);
    assert.equal(packedWasm.constructor, packed.constructor, `${item.feature}: same rejection class`);
    assert.equal(packedWasm.message, packed.message, `${item.feature}: same rejection message`);
    summary.wasmParity.rejected++;
    switch (item.rejectBy) {
      case 'gate':
        assert.equal(early, null, `${item.feature}: valid ES2025`);
        assert.ok(acorn instanceof SyntaxError && item.reason.test(acorn.message), `${item.feature}: class gate (${acorn?.message})`);
        break;
      case 'kind':
        assert.equal(early, null, `${item.feature}: valid ES2025`);
        assert.equal(acorn, null, `${item.feature}: passes the entry gate`);
        assert.equal(quickjs, null, `${item.feature}: QuickJS compiles it`);
        assert.ok(packed instanceof RangeError && item.reason.test(packed.message), `${item.feature}: function-kind gate (${packed.message})`);
        break;
      case 'both':
        assert.equal(early, 'SyntaxError', `${item.feature}: ES2025 early error`);
        assert.ok(acorn instanceof SyntaxError, `${item.feature}: acorn early error`);
        assert.ok(packed instanceof SyntaxError, `${item.feature}: pack rejects with SyntaxError`);
        assert.ok(quickjs, `${item.feature}: QuickJS compiler also rejects`);
        break;
      default: assert.fail(`${item.feature}: unknown rejectBy`);
    }
    summary.rejected[item.rejectBy] = (summary.rejected[item.rejectBy] || 0) + 1;
  }
  // Bootstrap sources compile identically too.
  const decodedRaw = x => ({ ...x, functions: x.functions.map(fn => ({ ...fn, instructions: fn.instructions.map(({ bytes, ...ins }) => ins) })) });
  for (const name of Object.keys(bootstrapSources)) assert.deepEqual(decodedRaw(bootWasm[name]), decodedRaw(boot[name]), `bootstrap ${name}: native vs Wasm`);
  summary.wasmParity.bootstraps = Object.keys(bootstrapSources).length;

  for (const name of ['private_symbol', 'add_brand', 'check_brand', 'private_in', 'get_private_field', 'put_private_field', 'define_private_field', 'throw_error'])
    assert.ok(summary.opcodes.has(name), `no fixture exercises ${name}`);
  console.log(JSON.stringify({ gpuChecks: false, guestExecution: false, fixesPresent: true, ...summary,
    opcodes: [...summary.opcodes].filter(n => ['private_symbol', 'get_private_field', 'put_private_field', 'define_private_field', 'add_brand', 'check_brand', 'private_in', 'throw_error'].includes(n)) }, null, 1));
} finally {
  if (build && !keep) rmSync(build, { recursive: true, force: true });
}
