import { OP, MAX_REGISTERS } from './values.js';
import { numberWGSL } from './number.js';
export const vmShader = `${numberWGSL}
alias Value = vec4<u32>;
fn number(v: Value) -> Pair { return v.xy; }
fn numeric(n: Pair) -> Value { return Value(n, 0u, 0u); }
fn boolean(b: bool) -> Value { return Value(0u, select(0u, 0x3ff00000u, b), 1u, 0u); }
fn truth(v: Value) -> bool { return v.z < 2u && !zero(v.xy) && !nan(v.xy); }
fn strictEqual(a: Value, b: Value) -> bool {
  if (a.z != b.z) { return false; }
  if (a.z >= 2u) { return true; }
  return equalNumber(a.xy, b.xy);
}
struct State { pc: u32, status: u32, steps: u32, padding: u32, result: Value, r: array<Value, ${MAX_REGISTERS}> }
struct Params { count: u32, budget: u32, instructions: u32, padding: u32 }
@group(0) @binding(0) var<storage, read> code: array<vec4<u32>>;
@group(0) @binding(1) var<storage, read> constants: array<Value>;
@group(0) @binding(2) var<storage, read_write> states: array<State>;
@group(0) @binding(3) var<uniform> params: Params;
@compute @workgroup_size(32)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let lane = id.x;
  if (lane >= params.count || states[lane].status != 0u) { return; }
  for (var step = 0u; step < params.budget; step++) {
    let pc = states[lane].pc;
    if (pc >= params.instructions) { states[lane].status = 2u; return; }
    let instruction = code[pc]; let op = instruction.x; let d = instruction.y; let a = instruction.z; let b = instruction.w;
    states[lane].pc = pc + 1u; states[lane].steps++;
    switch op {
      case ${OP.CONST}u: { states[lane].r[d] = constants[a]; }
      case ${OP.MOVE}u: { states[lane].r[d] = states[lane].r[a]; }
      case ${OP.ADD}u: { states[lane].r[d] = numeric(plus(number(states[lane].r[a]), number(states[lane].r[b]))); }
      case ${OP.SUB}u: { let v = number(states[lane].r[b]); states[lane].r[d] = numeric(plus(number(states[lane].r[a]), Pair(v.x, v.y ^ 0x80000000u))); }
      case ${OP.MUL}u: { states[lane].r[d] = numeric(times(number(states[lane].r[a]), number(states[lane].r[b]))); }
      case ${OP.DIV}u: { states[lane].r[d] = numeric(divide(number(states[lane].r[a]), number(states[lane].r[b]))); }
      case ${OP.LT}u: { states[lane].r[d] = boolean(lessNumber(number(states[lane].r[a]), number(states[lane].r[b]))); }
      case ${OP.LE}u: { let x = number(states[lane].r[a]); let y = number(states[lane].r[b]); states[lane].r[d] = boolean(lessNumber(x,y) || equalNumber(x,y)); }
      case ${OP.EQ}u: { states[lane].r[d] = boolean(strictEqual(states[lane].r[a], states[lane].r[b])); }
      case ${OP.NE}u: { states[lane].r[d] = boolean(!strictEqual(states[lane].r[a], states[lane].r[b])); }
      case ${OP.NEG}u: { let v = number(states[lane].r[a]); states[lane].r[d] = numeric(Pair(v.x, v.y ^ 0x80000000u)); }
      case ${OP.NUM}u: { states[lane].r[d] = numeric(number(states[lane].r[a])); }
      case ${OP.NOT}u: { states[lane].r[d] = boolean(!truth(states[lane].r[a])); }
      case ${OP.INV}u: { states[lane].r[d] = numeric(fromSigned(~toBits(number(states[lane].r[a])))); }
      case ${OP.AND}u: { states[lane].r[d] = numeric(fromSigned(toBits(number(states[lane].r[a])) & toBits(number(states[lane].r[b])))); }
      case ${OP.OR}u: { states[lane].r[d] = numeric(fromSigned(toBits(number(states[lane].r[a])) | toBits(number(states[lane].r[b])))); }
      case ${OP.XOR}u: { states[lane].r[d] = numeric(fromSigned(toBits(number(states[lane].r[a])) ^ toBits(number(states[lane].r[b])))); }
      case ${OP.SHL}u: { states[lane].r[d] = numeric(fromSigned(toBits(number(states[lane].r[a])) << (toBits(number(states[lane].r[b])) & 31u))); }
      case ${OP.SHR}u: { states[lane].r[d] = numeric(fromSigned(bitcast<u32>(bitcast<i32>(toBits(number(states[lane].r[a]))) >> (toBits(number(states[lane].r[b])) & 31u)))); }
      case ${OP.USHR}u: { states[lane].r[d] = numeric(fromUnsigned(toBits(number(states[lane].r[a])) >> (toBits(number(states[lane].r[b])) & 31u))); }
      case ${OP.JZ}u: { if (!truth(states[lane].r[d])) { states[lane].pc = a; } }
      case ${OP.JMP}u: { states[lane].pc = a; }
      case ${OP.RET}u: { states[lane].result = states[lane].r[d]; states[lane].status = 1u; return; }
      default: { states[lane].status = 2u; return; }
    }
  }
}
`;
