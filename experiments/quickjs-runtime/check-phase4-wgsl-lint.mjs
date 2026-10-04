// Static lint for Phase 4 WGSL fragments (no GPU, no WGSL compiler available
// locally). Catches WGSL reserved words used as identifiers, unbalanced
// braces/parentheses and unresolved template output. Not a WGSL validation:
// the coordinator's M1/Safari run compiles the shader.
import assert from 'node:assert/strict';
import { OP, FIELDS as F, LIMITS as L } from './program.js';
import { shader } from './shader.js';
import { phase4WGSLCases, phase4WGSLFunctions, phase4Continuations, phase4ObjectMethods } from './phase4-registry.js';

// WGSL reserved words (W3C WGSL §15.3) plus keywords likely to collide.
const reserved = new Set(`NULL Self abstract active alignas alignof as asm asm_fragment async attribute auto await become
binding_array cast catch class co_await co_return co_yield coherent column_major common compile compile_fragment concept
const_cast consteval constexpr constinit crate debugger decltype delete demote demote_to_helper do dynamic_cast enum explicit
export extends extern external fallthrough filter final finally friend from fxgroup get goto groupshared highp impl implements
import inline instanceof interface layout lowp macro macro_rules match mediump meta mod module move mut mutable namespace new
nil noexcept noinline nointerpolation noperspective null nullptr of operator package packoffset partition pass patch
pixelfragment precise precision premerge priv protected pub public readonly ref regardless register reinterpret_cast require
resource restrict self set shared sizeof smooth snorm static static_assert static_cast std subroutine super target template
this thread_local throw trait try type typedef typeid typename typeof union unless unorm unsafe unsized use using varying
virtual volatile wgsl where with writeonly yield`.split(/\s+/));
const context = { OP, F, L };
const fragments = {
  ...Object.fromEntries(Object.entries(phase4WGSLCases(context)).map(([k, v]) => [`case:${k}`, v])),
  functions: phase4WGSLFunctions(context),
  ...Object.fromEntries(phase4Continuations(context).map(({ code, body }) => [`continuation:${code}`, body])),
  ...Object.fromEntries(phase4ObjectMethods(context).map((body, i) => [`objectMethod:${i}`, body])),
};
const problems = [];
for (const [name, text] of Object.entries(fragments)) {
  const code = text.replace(/\/\/[^\n]*/g, '');
  for (const m of code.matchAll(/\b(?:let|var|fn)\s+([A-Za-z_]\w*)/g)) if (reserved.has(m[1])) problems.push(`${name}: reserved identifier ${m[1]}`);
  for (const m of code.matchAll(/\(([A-Za-z_]\w*)\s*:/g)) if (reserved.has(m[1])) problems.push(`${name}: reserved parameter ${m[1]}`);
  for (const [open, close] of ['{}', '()', '[]']) if (code.split(open).length !== code.split(close).length) problems.push(`${name}: unbalanced ${open}${close}`);
  if (/\$\{|undefinedu|NaNu|\[object [A-Z]/.test(code)) problems.push(`${name}: unresolved template output`);
}
// Whole shader: balanced braces after comment removal.
const body = shader.replace(/\/\/[^\n]*/g, '');
for (const [open, close] of ['{}', '()']) if (body.split(open).length !== body.split(close).length) problems.push(`shader: unbalanced ${open}${close}`);
for (const m of body.matchAll(/\b(?:let|var|fn)\s+([A-Za-z_]\w*)/g)) if (reserved.has(m[1])) problems.push(`shader: reserved identifier ${m[1]}`);
for (const m of body.matchAll(/[(,]\s*([A-Za-z_]\w*)\s*:\s*[A-Za-z]/g)) if (reserved.has(m[1])) problems.push(`shader: reserved parameter ${m[1]}`);
// The entry-point attribute must attach to main, not to an interpolated helper.
if (!/@compute @workgroup_size\(\d+\)\s*fn main\(/.test(shader)) problems.push('shader: @compute does not precede fn main');
assert.deepEqual(problems, []);
console.log(JSON.stringify({ wgslLint: 'passed', fragments: Object.keys(fragments).length, shaderChars: shader.length, compiledByWGSL: false }));
