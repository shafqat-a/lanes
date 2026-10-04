// Parent integration check for the standard-library wave (host only).
// Verifies shader generation, static WGSL lint of the new fragments, registry
// consistency, native/Wasm compiler parity of every helper and every worker
// fixture through the full packing path, and append-only FIELDS/OP tables.
// It never executes guest code on the host and never touches a GPU.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { OP, FIELDS as F, LIMITS as L, packProgram, entrySource } from './program.js';
import { shader } from './shader.js';
import { attachBootstrap, bootstrapSources, privateBuiltins } from './bootstrap.js';
import { createCompiler } from './compiler.js';
import { stdlibMethods, stdlibFunctionMetadata, stdlibFieldNames, stdlibGlobals, stdlibWGSLFunctions, stdlibObjectMethodWGSL, stdlibInitWGSL, stdlibMarkWGSL, stdlibPending } from './stdlib-registry.js';
import { collectionIntrinsics } from './stdlib-ids.js';
import { stdlibSuite } from './stdlib-gpu-suite.js';

const context = { OP, F, L };
const problems = [];
// 1. Static lint of the new WGSL (no WGSL compiler is available locally).
const reserved = new Set('as async break case const continue default delete do else enum export extends false fn for if import in let loop new null private public return self static struct super switch this true type typeof var while with yield target set get from of'.split(' '));
const fragments = { functions: stdlibWGSLFunctions(context), objectMethod: stdlibObjectMethodWGSL(), init: stdlibInitWGSL(context), mark: stdlibMarkWGSL };
for (const [name, text] of Object.entries(fragments)) {
  const code = text.replace(/\/\/[^\n]*/g, '');
  for (const m of code.matchAll(/\b(?:let|var|fn)\s+([A-Za-z_]\w*)/g)) if (reserved.has(m[1])) problems.push(`${name}: reserved identifier ${m[1]}`);
  for (const [open, close] of ['{}', '()', '[]']) if (code.split(open).length !== code.split(close).length) problems.push(`${name}: unbalanced ${open}${close}`);
  if (/\$\{|undefinedu|NaNu|\bnullu/.test(code)) problems.push(`${name}: unresolved template output`);
}
const body = shader.replace(/\/\/[^\n]*/g, '');
for (const [open, close] of ['{}', '()']) if (body.split(open).length !== body.split(close).length) problems.push(`shader: unbalanced ${open}${close}`);
if (/\$\{|undefinedu|NaNu/.test(body)) problems.push('shader: unresolved template output');
for (const fn of ['collectionIntrinsic', 'collectionCompact', 'collectionSameValueZero', 'collectionHeader', 'collectionFind', 'collectionAppend']) {
  const defs = body.match(new RegExp(`\\bfn ${fn}\\(`, 'g'))?.length ?? 0;
  if (defs !== 1) problems.push(`shader: ${fn} defined ${defs} times`);
}
if (!body.includes('collectionCompact(l);')) problems.push('shader: collect() does not compact collections');
for (const node of [66, 67, 68, 69, 70, 71]) if (!body.includes(`states[l].heap[${node}u]=Node(`)) problems.push(`shader: fixed node ${node} not initialized`);
assert.deepEqual(problems, [], problems.join('\n'));

// 2. Registry consistency.
for (const name of stdlibFieldNames) assert.ok(name in F, `FIELDS lacks ${name}`);
for (const m of stdlibFunctionMetadata) { assert.ok(m.name in F && m.field in F, `metadata ${m.id}`); assert.ok(m.field in bootstrapSources, `bootstrap lacks ${m.field}`); }
for (const [name, id] of Object.entries(collectionIntrinsics)) assert.equal(privateBuiltins[name], id, name);
const fieldValues = Object.values(F); assert.equal(new Set(fieldValues).size, fieldValues.length);
// Append-only OP/FIELDS against a baseline checkout of HEAD, when provided:
// LANES_BASELINE_DIR=<dir containing a HEAD copy of experiments/quickjs-runtime>.
let baselineChecked = false;
if (process.env.LANES_BASELINE_DIR) {
  const base = await import(new URL(`file://${process.env.LANES_BASELINE_DIR}/program.js`).href);
  for (const [name, index] of Object.entries(base.OP)) assert.equal(OP[name], index, `OP ${name} moved`);
  for (const [name, index] of Object.entries(base.FIELDS)) assert.equal(F[name], index, `FIELDS ${name} moved`);
  baselineChecked = { baseOps: Object.keys(base.OP).length, baseFields: Object.keys(base.FIELDS).length };
}

// 3. Native/Wasm parity of every helper, then of every fixture through attachBootstrap + packProgram.
const nativePath = fileURLToPath(new URL('./generated/compiler', import.meta.url));
const native = source => JSON.parse(execFileSync(nativePath, [source], { encoding: 'utf8', maxBuffer: 1 << 28 }));
const { default: create } = await import('./generated/compiler.mjs');
const wasm = await create();
const wasmRaw = source => JSON.parse(wasm.ccall('lanes_compile', 'string', ['string'], [source]));
let helperParity = 0; const helperFailures = [];
const helperFields = [...new Set([...stdlibFunctionMetadata.map(m => m.field), 'mapConstruct', 'setConstruct'])];
for (const field of helperFields) {
  const source = bootstrapSources[field];
  // Pack exactly as the runtime does: a user entry plus the helper appended by attachBootstrap.
  const entry = 'function f(x){return x;}';
  try {
    const pa = packProgram(attachBootstrap(native(entry), { [field]: native(source) }), 'f');
    const pb = packProgram(attachBootstrap(wasmRaw(entry), { [field]: wasmRaw(source) }), 'f');
    assert.deepEqual(pa.code, pb.code, field); assert.deepEqual(pa.image, pb.image, field); helperParity++;
  } catch (error) { helperFailures.push(`${field}: ${error.message.split('\n')[0]}`); }
}
const compiler = await createCompiler();
const nativeBootstraps = Object.fromEntries(Object.entries(bootstrapSources).map(([field, source]) => [field, native(source)]));
const groups = {};
let programs = 0, values = 0;
const failures = [];
for (const group of stdlibSuite.groups) {
  const count = { cases: 0, values: 0, unsupported: 0, resumption: 0, gc: 0, rejected: [] };
  const sources = [
    ...group.cases.map(c => ({ source: c.source, inputs: c.inputs ?? [] })),
    ...(group.gcCases ?? []).map(c => ({ source: c.source, inputs: c.inputs ?? [c.input] })),
    ...(group.resumption ?? []).map(r => ({ source: r.source, inputs: [r.input] })),
  ];
  for (const { source, inputs } of sources) {
    try {
      const a = compiler.compile(source);
      const b = packProgram(attachBootstrap(native(source), nativeBootstraps), entrySource(source));
      assert.deepEqual(a.code, b.code); assert.deepEqual(a.image, b.image);
      count.cases++; count.values += inputs.length; programs++; values += inputs.length;
    } catch (error) { failures.push(`${group.name}: ${error.message.split('\n')[0]} :: ${source.slice(0, 120)}`); count.rejected.push(error.message.split('\n')[0]); }
  }
  for (const source of group.unsupported ?? []) {
    const text = typeof source === 'string' ? source : source.source;
    try { compiler.compile(text); count.unsupported++; } catch (error) { count.unsupported++; count.rejected.push(`unsupported-compile: ${error.message.split('\n')[0]}`); }
  }
  count.resumption = (group.resumption ?? []).length; count.gc = (group.gcCases ?? []).length;
  groups[group.name] = { ...count, rejected: [...new Set(count.rejected)] };
}
console.log(JSON.stringify({ lint: 'pass', shaderBytes: shader.length, opcodes: Object.keys(OP).length, fields: Object.keys(F).length, baselineChecked, stdlibMethods: stdlibMethods.length, globals: stdlibGlobals.map(g => g.name), helperParity, helperFailures, programs, values, groups, failures, pending: stdlibPending, gpuChecks: false }, null, 1));
if (failures.length || helperFailures.length) process.exitCode = 1;
