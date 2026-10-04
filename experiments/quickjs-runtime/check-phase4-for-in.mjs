// Phase 4 worker 6 host checks for for-in and lexical/TDZ fixtures. Host only:
// no GPU, no runtime.js, no production CPU fallback. Guest fixture code runs
// only in test oracles (V8 node:vm and a native QuickJS interpreter built from
// vendor/ in a private directory); the integration is simulated by applying
// phase4-for-in.js edits to private copies of program.js/bootstrap.js/shader.js.
//  1. V8 oracle: fixed expected value, input sensitivity, distinct expectations.
//  2. Native QuickJS interpreter (vendor/, private build) agrees for input and input+1.
//  3. Helper sources compile with the private native compiler, are strict, and
//     pack (all opcodes and captures resolve) under the simulated integration.
//  4. Host model of the helper algorithm (mocked primitives) matches V8 for-in.
//  5. Per-case admission today vs. after integration, opcode inventory, and
//     WGSL switch coverage of every opcode in the patched shader.
//  6. Fixture sources elsewhere whose compiler admission flips after integration.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { Script, createContext } from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { OP, entrySource, packProgram } from './program.js';
import { attachBootstrap, bootstrapSources } from './bootstrap.js';
import * as forIn from './phase4-for-in.js';
import { forInCases, lexicalCases, forInTypeErrorCases, lexicalReferenceErrorCases } from './phase4-for-in-cases.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const keep = process.argv.includes('--keep');
const build = mkdtempSync(join(root, '.phase4-build-w6-'));
const support = ['dtoa', 'libregexp', 'libunicode', 'cutils'].map(n => `${root}vendor/${n}.c`);
const common = ['-O1', '-D_GNU_SOURCE', '-DCONFIG_VERSION="lanes-pinned"', '-I', `${root}vendor`];
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
const v8 = (source, input) => JSON.parse(new Script(harness(source, input)).runInNewContext({}, { timeout: 2000 }));
const primitive = v => v === null || ['number', 'string', 'boolean', 'undefined'].includes(typeof v);

// Copy lead-owned modules into the build dir; only phase4-registry.js is edited
// (applyForInRegistry). Relative imports keep pointing at the originals, except
// between the copied modules.
const patched = new Set(['program.js', 'bootstrap.js', 'shader.js', 'phase4-registry.js']);
function writePatched(file) {
  const original = readFileSync(join(root, file), 'utf8');
  const text = file === 'phase4-registry.js' ? forIn.applyForInRegistry(original) : original;
  const rewritten = text.replace(/from '(\.\.?\/[^']+)'/g, (m, spec) => {
    if (spec.startsWith('./') && patched.has(spec.slice(2))) return m;
    let rel = relative(build, resolve(root, spec)).split('\\').join('/');
    if (!rel.startsWith('.')) rel = './' + rel;
    return `from '${rel}'`;
  });
  writeFileSync(join(build, file), rewritten);
  return text;
}

let summary;
const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); return ok; };
try {
  // ---- Private native compiler and interpreter from vendor/ ----
  const cc = process.env.CC || 'cc';
  writeFileSync(join(build, 'runner.c'), runnerSource);
  execFileSync(cc, [...common, `${root}bridge.c`, ...support, '-lm', '-lpthread', '-o', join(build, 'compiler')], { stdio: 'inherit' });
  execFileSync(cc, [...common, join(build, 'runner.c'), ...support, '-lm', '-lpthread', '-o', join(build, 'qjs-run')], { stdio: 'inherit' });
  const raw = source => JSON.parse(execFileSync(join(build, 'compiler'), [source], { encoding: 'utf8', maxBuffer: 1 << 26 }));
  const native = (source, input) => JSON.parse(execFileSync(join(build, 'qjs-run'), [harness(source, input)], { encoding: 'utf8' }));

  // ---- Opcode stack effects against vendor/quickjs-opcode.h ----
  const opcodeHeader = readFileSync(join(root, 'vendor/quickjs-opcode.h'), 'utf8');
  for (const op of forIn.forInOpcodes) {
    const m = new RegExp(`DEF\\(\\s*${op.name},\\s*(\\d+),\\s*(\\d+),\\s*(\\d+),\\s*(\\w+)\\)`).exec(opcodeHeader);
    assert.ok(m, `opcode ${op.name} in quickjs-opcode.h`);
    assert.deepEqual([+m[1], +m[2], +m[3], m[4]], [op.size, op.pop, op.push, op.format], `stack effect ${op.name}`);
  }
  // Integrated mode: the lead has wired for-in into the real registry, so the
  // real program.js/bootstrap.js/shader.js are verified in place. Otherwise the
  // integration is simulated on private copies (applyForInRegistry).
  const integratedInPlace = forIn.forInOpcodeNames.every(name => name in OP);
  assert.ok(integratedInPlace || forIn.forInOpcodeNames.every(name => !(name in OP)), 'for_in opcodes partially present in OP');
  // Reservations: IDs 1350-1369, continuation 50-51.
  for (const id of Object.values(forIn.forInPrivateBuiltins)) assert.ok(id >= 1350 && id <= 1369, `private builtin ${id} outside reservation`);
  assert.deepEqual(forIn.forInContinuations({}).map(c => c.code), [50]);
  assert.deepEqual(forIn.forInOpcodes.map(o => o.name), [...forIn.forInOpcodeNames]);

  // ---- Simulated integration (private copies of lead-owned files) ----
  const modulePath = file => integratedInPlace ? `./${file}` : pathToFileURL(join(build, file)).href;
  if (!integratedInPlace) for (const file of patched) writePatched(file);
  const P = await import(modulePath('program.js'));
  const B = await import(modulePath('bootstrap.js'));
  const S = await import(modulePath('shader.js'));
  if (!integratedInPlace) {
    assert.deepEqual(Object.keys(P.OP).slice(0, Object.keys(OP).length), Object.keys(OP), 'existing opcode indices unchanged');
    assert.equal(P.OP.for_in_start, Object.keys(OP).length);
    assert.equal(P.OP.for_in_next, Object.keys(OP).length + 1);
  }
  assert.equal(P.OP.for_in_next, P.OP.for_in_start + 1, 'for_in opcodes adjacent');
  for (const field of Object.values(forIn.forInBuiltinFields)) assert.ok(field in P.FIELDS, `FIELDS.${field}`);
  for (const [name, id] of Object.entries(forIn.forInPrivateBuiltins)) assert.equal(B.privateBuiltins[name], id, name);
  for (const field of Object.keys(forIn.forInBootstrapSources)) assert.equal(B.bootstrapSources[field], forIn.forInBootstrapSources[field]);
  const wgsl = S.shader;
  const braces = s => [...s].reduce((n, c) => n + (c === '{') - (c === '}'), 0);
  assert.equal(braces(wgsl), 0, 'patched WGSL braces balance');
  const parens = s => [...s].reduce((n, c) => n + (c === '(') - (c === ')'), 0);
  assert.equal(parens(wgsl), 0, 'patched WGSL parentheses balance');
  assert.ok(wgsl.includes(`case ${P.OP.for_in_start}u: {`) && wgsl.includes(`case ${P.OP.for_in_next}u: {`), 'switch cases emitted');
  assert.ok(wgsl.includes(`if(fnValue.x==1350u){field=${P.FIELDS.forInStart}u;}`), 'helper field mapping emitted');
  assert.equal((wgsl.match(/fn forInKeys\(/g) || []).length, 1, 'forInKeys emitted once');
  assert.ok(wgsl.includes('if(id==1352u){') && wgsl.includes('if(id==1353u){') && wgsl.includes('if(id==1354u){'), 'objectMethod primitives emitted');
  assert.ok(wgsl.includes('else if(continuation==50u){'), 'continuation 50 emitted');
  // objectMethod lines must precede the catch-all that reports ids >= 150 as unsupported.
  assert.ok(wgsl.indexOf('if(id==1352u){') < wgsl.indexOf('if(id>=150u){states[l].status=6u;'), 'primitives dispatch before the id>=150 catch-all');
  if (!integratedInPlace) {
    const original = (await import('./shader.js')).shader;
    assert.ok(!original.includes('fn forInKeys(') && original.length < wgsl.length, 'unpatched shader has no for-in support');
  }
  assert.ok(!/\$\{|undefinedu\b/.test(wgsl), 'no unresolved template expressions in WGSL');
  const shaderText = readFileSync(integratedInPlace ? join(root, 'shader.js') : join(build, 'shader.js'), 'utf8');
  const shaderOps = new Set([...shaderText.matchAll(/cases\('([^']+)'/g)].flatMap(m => m[1].split(' ')));
  for (const m of shaderText.matchAll(/\[((?:'[a-z0-9_]+',?)+)\]\.map\(\(name/g)) for (const n of m[1].matchAll(/'([a-z0-9_]+)'/g)) shaderOps.add(n[1]);
  // Registry-provided cases (phase4WGSLCases) are emitted through phase4ShaderOps.
  assert.ok(Array.isArray(S.phase4ShaderOps), 'shader.js exports phase4ShaderOps');
  for (const op of S.phase4ShaderOps) shaderOps.add(op);
  for (const op of forIn.forInOpcodeNames) assert.ok(S.phase4ShaderOps.includes(op), `${op} in phase4ShaderOps`);

  // ---- Bootstraps: current and integrated ----
  const currentBoot = Object.fromEntries(Object.entries(bootstrapSources).map(([k, s]) => [k, raw(s)]));
  const integratedBoot = { ...currentBoot };
  const helpers = {};
  const opNames = Object.keys(P.OP);
  for (const [field, source] of Object.entries(forIn.forInBootstrapSources)) {
    const r = raw(source);
    assert.ok(!r.error, `helper ${field} compiles: ${r.error}`);
    assert.equal(r.functions.length, 1, `${field}: single function`);
    assert.equal(r.functions[0].strict, 1, `${field}: strict`);
    const ops = [...new Set(r.functions[0].instructions.map(i => i.op))].sort();
    assert.ok(!ops.some(op => op.startsWith('for_in')), `${field}: no for-in recursion`);
    const refs = r.functions[0].refs.map(ref => ref.name);
    for (const name of refs) assert.ok(Object.hasOwn(B.privateBuiltins, name) || ['undefined'].includes(name), `${field}: capture ${name} resolves`);
    integratedBoot[field] = r;
    helpers[field] = { instructions: r.functions[0].instructions.length, stack: r.functions[0].stack, locals: r.functions[0].locals, ops, captures: refs };
  }
  // A trivial entry packs with every bootstrap attached: helper opcodes and captures resolve.
  const probe = 'function f(x){return x;}';
  const probePacked = P.packProgram(attachBootstrap(raw(probe), integratedBoot), 'f');
  for (const field of Object.values(forIn.forInBuiltinFields)) {
    const fn = probePacked.image[(probePacked.typeTable + 1) * 4 + 3];
    assert.ok(probePacked.image[(fn + P.FIELDS[field]) * 4 + 1] > 0, `helper ${field} attached to field table`);
  }
  for (const field of Object.keys(forIn.forInBootstrapSources)) {
    const index = probePacked.raw.bootstrapFunctions[field], packedHelperOps = new Set();
    for (let i = 0; i < probePacked.code.length; i += 4) if (probePacked.code[i + 3] === index) packedHelperOps.add(opNames[probePacked.code[i]]);
    helpers[field].packedOps = [...packedHelperOps].sort();
    for (const op of packedHelperOps) assert.ok(shaderOps.has(op), `${field}: shader handles ${op}`);
  }

  // ---- Host model of the helper algorithm (mocked primitives in a V8 context) ----
  const model = createContext({});
  new Script(`
    var __lanesDescriptor = () => Object.create(null);
    var __lanesToObject = Object;
    var __lanesForInKeys = o => Reflect.ownKeys(o).filter(k => typeof k === "string" && Object.getOwnPropertyDescriptor(o, k).enumerable);
    var __lanesForInOwn = (o, k) => { const d = Object.getOwnPropertyDescriptor(o, k); return d === undefined ? 0 : d.enumerable ? 2 : 1; };
    var __lanesOwnHas = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
    var __lanesGetPrototypeOf = Object.getPrototypeOf;
    var __lanesUnsupported = () => { throw new Error("unsupported"); };
    var start = ${forIn.forInStartSource};
    var next = ${forIn.forInNextSource};
    function viaHelper(value, visit) { const r = start(value); const out = []; for (;;) { const k = next(r); if (k === r) return out; out.push(k); if (visit) visit(k); } }
    function viaForIn(value, visit) { const out = []; for (const k in value) { out.push(k); if (visit) visit(k); } return out; }
    function fixtures() {
      const p = {a:1,b:2,c:3}; const o1 = Object.create(p); Object.defineProperty(o1, "b", {value:0}); o1.d = 1; o1[3] = 0; o1[1] = 0;
      const top = {t:1,h:1}; const mid = Object.create(top); Object.defineProperty(mid, "h", {value:0}); mid.m = 1; const low = Object.create(mid); low.l = 1; low.t = 2;
      const arr = [1,,3]; arr.x = 1; arr[10] = 1;
      const w = new String("abc"); w.z = 1; w[7] = 1;
      const fn = function g(){}; fn.q = 1;
      const args = (function(){ return arguments; })(1, 2, 3);
      const nul = Object.create(null); nul.b = 1; nul[0] = 1; nul.a = 1;
      const sym = {s:1}; sym[Symbol("k")] = 1;
      const acc = { get g(){ return 1; }, set h(v){} };
      return [null, undefined, 0, 7, true, "", "xyz", {}, {b:1,a:2,1:3,0:4}, o1, low, arr, w, fn, args, nul, sym, acc, Object.freeze({f:1}), new Error("m")];
    }
    function compare() {
      const results = [];
      for (const value of fixtures()) results.push({ helper: viaHelper(value), v8: viaForIn(value) });
      // Interoperable mutation: deleting a not-yet-visited own or inherited key.
      for (const mutate of [
        o => k => { if (k === "a") delete o.c; },
        o => k => { if (k === "a") delete Object.getPrototypeOf(o).z; },
        o => k => { delete o[k]; },
        o => k => { if (k === "0") o.length = 1; },
      ]) {
        const make = () => { const p = {z:1}; const o = Object.create(p); o.a = 1; o.b = 2; o.c = 3; return o; };
        const makeArray = () => [1,2,3];
        const pick = mutate.toString().includes("length") ? makeArray : make;
        const a = pick(), b = pick();
        results.push({ helper: viaHelper(a, mutate(a)), v8: viaForIn(b, mutate(b)) });
      }
      // Enumerable Object.prototype keys and shadowing through built-in prototypes.
      Object.prototype.inherited = 1; Array.prototype.fromArray = 1;
      for (const value of [{own:1}, [1], "s", 5, function(){}]) results.push({ helper: viaHelper(value), v8: viaForIn(value) });
      Object.defineProperty(Object.prototype, "toString", {enumerable: true});
      results.push({ helper: viaHelper({}), v8: viaForIn({}) });
      return JSON.stringify(results);
    }
  `).runInContext(model);
  const modelResults = JSON.parse(new Script('compare()').runInContext(model));
  modelResults.forEach((r, i) => check(JSON.stringify(r.helper) === JSON.stringify(r.v8), `helper model ${i}: ${JSON.stringify(r)}`));

  // ---- Fixtures ----
  const groups = { forInCases, lexicalCases, forInTypeErrorCases, lexicalReferenceErrorCases };
  const seen = new Map();
  const admission = (pack, boot, source) => {
    try { const p = pack(attachBootstrap(raw(source), boot), entrySource(source)); return { admission: 'admitted', packed: p }; }
    catch (error) { return { admission: 'rejected', reason: `${error.name}: ${error.message}` }; }
  };
  const results = [];
  const counts = { cases: 0, v8Oracle: 0, inputSensitivity: 0, nativeQuickJS: 0, admittedToday: 0, admittedIntegrated: 0, rejectedIntegrated: 0, shaderCoverage: 0 };
  for (const [group, list] of Object.entries(groups)) for (const item of list) {
    const { feature, source, input, expected } = item;
    counts.cases++;
    assert.ok(primitive(expected), `${feature}: primitive expected`);
    check(!seen.has(JSON.stringify(expected)), `${feature}: duplicate expected value with ${seen.get(JSON.stringify(expected))}`);
    seen.set(JSON.stringify(expected), feature);
    const got = v8(source, input), other = v8(source, input + 1);
    check(JSON.stringify(got) === JSON.stringify({ value: expected }), `${feature}: V8 ${JSON.stringify(got)} expected ${JSON.stringify(expected)}`); counts.v8Oracle++;
    check(JSON.stringify(other) !== JSON.stringify({ value: expected }), `${feature}: not input-sensitive`); counts.inputSensitivity++;
    const n1 = native(source, input), n2 = native(source, input + 1);
    check(JSON.stringify(n1) === JSON.stringify(got), `${feature}: native QuickJS ${JSON.stringify(n1)} vs V8 ${JSON.stringify(got)}`);
    check(JSON.stringify(n2) === JSON.stringify(other), `${feature}: native QuickJS input+1 ${JSON.stringify(n2)} vs V8 ${JSON.stringify(other)}`);
    counts.nativeQuickJS += 2;
    const today = admission(packProgram, currentBoot, source);
    const integrated = admission(P.packProgram, integratedBoot, source);
    if (today.admission === 'admitted') counts.admittedToday++;
    let ops = [], missing = [];
    if (integrated.admission === 'admitted') {
      counts.admittedIntegrated++;
      const p = integrated.packed, guest = p.raw.functions.length - Object.keys(p.raw.bootstrapFunctions).reduce((n, k) => n + integratedBoot[k].functions.length, 0);
      const set = new Set();
      for (let i = 0; i < p.code.length; i += 4) if (p.code[i + 3] < guest) { const name = opNames[p.code[i]]; set.add(['throw_error', 'special_object'].includes(name) ? `${name}/${p.code[i + 1]}` : name); }
      ops = [...set].sort();
      missing = ops.filter(op => !shaderOps.has(op.split('/')[0]));
      check(missing.length === 0, `${feature}: opcodes without WGSL case: ${missing}`);
      counts.shaderCoverage++;
    } else counts.rejectedIntegrated++;
    // A fixture that also needs another Phase 4 area may stay rejected only for that area's opcodes.
    if (item.requires) check(integrated.admission === 'admitted' || /for_of|iterator/.test(integrated.reason), `${feature}: rejected for a reason other than ${item.requires}: ${integrated.reason}`);
    else check(integrated.admission === 'admitted', `${feature}: not admitted after integration: ${integrated.reason}`);
    results.push({ group, feature, today: today.admission, ...(today.reason ? { todayReason: today.reason } : {}), integrated: integrated.admission,
      ...(integrated.reason ? { integratedReason: integrated.reason } : {}), ...(item.requires ? { requires: item.requires } : {}),
      forIn: ops.some(op => op.startsWith('for_in')), ops });
  }

  // ---- Admission flips in other fixture files ----
  const sources = new Map();
  const collect = (file, v) => { if (typeof v === 'string' && /^\s*function\s/.test(v)) { if (!sources.has(v)) sources.set(v, file); } else if (v && typeof v === 'object') Object.values(v).forEach(x => collect(file, x)); };
  const fixtureFiles = readdirSync(root).filter(f => /-cases\.js$/.test(f) && f !== 'phase4-for-in-cases.js').sort();
  for (const file of fixtureFiles) {
    try { collect(file, await import(`./${file}`)); } catch (error) { failures.push(`fixture import ${file}: ${error.message}`); }
  }
  const flips = [];
  let scanned = 0, skipped = 0;
  for (const [source, file] of sources) {
    if (!/\bfor\s*\(/.test(source) || !/\bin\b/.test(source) || source.includes('\0')) { skipped++; continue; }
    let name; try { name = entrySource(source); } catch { skipped++; continue; }
    scanned++;
    const today = admission(packProgram, currentBoot, source), integrated = admission(P.packProgram, integratedBoot, source);
    if (today.admission !== integrated.admission || today.reason !== integrated.reason)
      flips.push({ file, source: source.length > 160 ? source.slice(0, 157) + '...' : source, today: today.reason ?? 'admitted', integrated: integrated.reason ?? 'admitted' });
  }
  // Recorded expectations that would change.
  const { languageScopeRejectedCases } = await import('./language-scope-cases.js');
  const { compilerCorrectnessCases } = await import('./compiler-correctness-cases.js');
  const recorded = [
    ...languageScopeRejectedCases.map(c => ({ file: 'language-scope-cases.js', ...c })),
    ...compilerCorrectnessCases.filter(c => c.admission === 'rejected').map(c => ({ file: 'compiler-correctness-cases.js', ...c })),
  ].map(c => ({ file: c.file, feature: c.feature, recorded: c.admission, today: admission(packProgram, currentBoot, c.source).admission,
    integrated: admission(P.packProgram, integratedBoot, c.source).admission }))
    .filter(c => c.recorded !== c.integrated).map(c => ({ ...c, causedByForIn: c.today !== c.integrated }));

  summary = { mode: integratedInPlace ? 'integrated-in-place (real program.js/bootstrap.js/shader.js)' : 'simulated (private copies + applyForInRegistry)', gpuChecks: false, runtimeExecution: false, nativeReferenceExecution: true, productionCPUFallback: false,
    counts, helperModelComparisons: modelResults.length, helpers,
    shader: { forInStartCase: P.OP.for_in_start, forInNextCase: P.OP.for_in_next, continuation: 50, wgslBytes: wgsl.length },
    recordedExpectationFlips: recorded, fixtureAdmissionFlips: { scanned, skipped, flips }, failures, results };
} finally {
  if (!keep) rmSync(build, { recursive: true, force: true });
}
// Default output is compact; --full adds per-case opcode inventories and helper details.
if (summary && !process.argv.includes('--full')) {
  const { results, helpers, ...rest } = summary;
  summary = { ...rest, helpers: Object.fromEntries(Object.entries(helpers).map(([k, v]) => [k, { instructions: v.instructions, captures: v.captures }])),
    results: results.map(r => `${r.group}/${r.feature}: today ${r.today}, integrated ${r.integrated}${r.requires ? ` (requires ${r.requires})` : ''}, ${r.ops.length} ops`) };
}
console.log(JSON.stringify(summary, null, 1));
if (failures.length) { console.error(`${failures.length} failure(s):\n` + failures.join('\n')); process.exitCode = 1; }
