import { OP, MAX_REGISTERS, MAX_STRING } from './values.js';
import { numberWGSL } from './number.js';
export const vmShader = ({ frames, environments, cells }) => `${numberWGSL}
alias Value = vec4<u32>;
fn number(v: Value) -> Pair { return v.xy; }
fn numeric(n: Pair) -> Value { return Value(n, 0u, 0u); }
fn boolean(b: bool) -> Value { return Value(0u, select(0u, 0x3ff00000u, b), 1u, 0u); }
fn truth(v: Value) -> bool { return v.z == 4u || v.z == 6u || (v.z == 7u && v.y != 0u) || (v.z < 2u && !zero(v.xy) && !nan(v.xy)); }
fn strictEqual(lane: u32, a: Value, b: Value) -> bool {
  if (a.z != b.z) { return false; }
  if (a.z == 7u) { return compareText(lane, a, b) == 0; }
  if (a.z == 4u || a.z == 6u) { return a.w == b.w; }
  if (a.z >= 2u) { return true; }
  return equalNumber(a.xy, b.xy);
}
struct State {
  pc: u32, status: u32, steps: u32, depth: u32, result: Value,
  env: u32, envTop: u32, cellTop: u32, closureId: u32,
  handlerTop: u32, gcTop: u32, collections: u32, pad2: u32,
  r: array<Value, ${MAX_REGISTERS * frames}>, frames: array<vec4<u32>, ${frames}>,
  envs: array<vec4<u32>, ${environments}>, cells: array<Value, ${cells}>, handlers: array<vec4<u32>, 32>,
  gcCells: array<Value, ${cells}>, gcQueue: array<u32, ${environments}>
}
struct Snapshot { status: u32, steps: u32, padding: vec2<u32>, result: Value, chars: array<u32, ${MAX_STRING}> }
struct Params { count: u32, budget: u32, instructions: u32, padding: u32 }
@group(0) @binding(0) var<storage, read> code: array<vec4<u32>>;
@group(0) @binding(1) var<storage, read> constants: array<Value>;
@group(0) @binding(2) var<storage, read_write> states: array<State>;
@group(0) @binding(3) var<uniform> params: Params;
@group(0) @binding(4) var<storage, read_write> snapshots: array<Snapshot>;
fn mark(lane: u32, env: u32) {
  if (env == 0u || states[lane].envs[env].w == 2u) { return; }
  states[lane].envs[env].w = 2u;
  states[lane].gcQueue[states[lane].gcTop] = env; states[lane].gcTop++;
}
fn markValue(lane: u32, value: Value) { if (value.z == 4u) { mark(lane, value.y); } else if (value.z == 7u && value.w == 0u) { mark(lane, value.x); } }
fn collect(lane: u32) {
  states[lane].gcTop = 0u; mark(lane, states[lane].env); markValue(lane, states[lane].result);
  for (var i = 0u; i < (states[lane].depth + 1u) * ${MAX_REGISTERS}u; i++) { markValue(lane, states[lane].r[i]); }
  for (var i = 0u; i < states[lane].depth; i++) { mark(lane, states[lane].frames[i].y); }
  for (var i = 0u; i < states[lane].handlerTop; i++) { mark(lane, states[lane].handlers[i].z); }
  for (var i = 0u; i < states[lane].gcTop; i++) {
    let env = states[lane].envs[states[lane].gcQueue[i]];
    mark(lane, env.x);
    for (var j = 0u; j < env.z; j++) { markValue(lane, states[lane].cells[env.y + j]); }
  }
  var next = 0u;
  for (var i = 1u; i < ${environments}u; i++) {
    let env = states[lane].envs[i];
    if (env.w == 2u) {
      for (var j = 0u; j < env.z; j++) { states[lane].gcCells[next + j] = states[lane].cells[env.y + j]; }
      states[lane].envs[i].y = next; states[lane].envs[i].w = 1u; next += env.z;
    } else { states[lane].envs[i].w = 0u; }
  }
  for (var i = 0u; i < next; i++) { states[lane].cells[i] = states[lane].gcCells[i]; }
  states[lane].cellTop = next; states[lane].collections++;
}
fn freeEnvironment(lane: u32) -> u32 {
  for (var i = 1u; i < ${environments}u; i++) { if (states[lane].envs[i].w == 0u) { return i; } }
  return 0u;
}
fn enter(lane: u32, size: u32, parent: u32, copyEnv: u32) {
  var env = freeEnvironment(lane);
  if (env == 0u || states[lane].cellTop + size > ${cells}u) { collect(lane); env = freeEnvironment(lane); }
  if (env == 0u || states[lane].cellTop + size > ${cells}u) { states[lane].status = 3u; return; }
  let base = states[lane].cellTop; states[lane].cellTop += size;
  states[lane].envs[env] = vec4<u32>(parent, base, size, 1u);
  for (var i = 0u; i < size; i++) {
    if (copyEnv != 0u) { states[lane].cells[base + i] = states[lane].cells[states[lane].envs[copyEnv].y + i]; }
    else { states[lane].cells[base + i] = Value(0u, 0u, 5u, 0u); }
  }
  states[lane].env = env;
}
fn textUnit(lane: u32, value: Value, index: u32) -> u32 {
  if (value.w == 1u) { return constants[value.x + index].x; }
  return states[lane].cells[states[lane].envs[value.x].y + index].x;
}
fn compareText(lane: u32, a: Value, b: Value) -> i32 {
  for (var i = 0u; i < min(a.y, b.y); i++) {
    let x = textUnit(lane, a, i); let y = textUnit(lane, b, i);
    if (x != y) { return select(1i, -1i, x < y); }
  }
  return select(select(1i, -1i, a.y < b.y), 0i, a.y == b.y);
}
fn concat(lane: u32, a: Value, b: Value) -> Value {
  let size = a.y + b.y;
  if (size > ${MAX_STRING}u) { states[lane].status = 3u; return Value(0u); }
  if (size == 0u) { return Value(0u, 0u, 7u, 1u); }
  let outer = states[lane].env; enter(lane, size, 0u, 0u); let env = states[lane].env; states[lane].env = outer;
  if (states[lane].status != 0u) { return Value(0u); }
  for (var i = 0u; i < size; i++) {
    var unit: u32;
    if (i < a.y) { unit = textUnit(lane, a, i); } else { unit = textUnit(lane, b, i - a.y); }
    states[lane].cells[states[lane].envs[env].y + i] = Value(unit, 0u, 0u, 0u);
  }
  return Value(env, size, 7u, 0u);
}
fn oneChar(lane: u32, unit: u32) -> Value {
  let outer = states[lane].env; enter(lane, 1u, 0u, 0u); let env = states[lane].env; states[lane].env = outer;
  if (states[lane].status != 0u) { return Value(0u); }
  states[lane].cells[states[lane].envs[env].y] = Value(unit, 0u, 0u, 0u);
  return Value(env, 1u, 7u, 0u);
}
fn characterIndex(index: Value, size: u32) -> u32 {
  let n = index.xy;
  if (nan(n) || zero(n)) { return select(0xffffffffu, 0u, size > 0u); }
  if (lessNumber(n, Pair(0u, 0xbff00000u)) || equalNumber(n, Pair(0u, 0xbff00000u))) { return 0xffffffffu; }
  if ((n.y & 0x80000000u) != 0u) { return select(0xffffffffu, 0u, size > 0u); }
  if (!lessNumber(n, fromUnsigned(size))) { return 0xffffffffu; }
  return toBits(n);
}
fn propertyIndex(lane: u32, key: Value) -> u32 {
  if (key.z == 0u) {
    let index = toBits(key.xy);
    if (index <= ${MAX_STRING}u && equalNumber(key.xy, fromUnsigned(index))) { return index; }
    return 0xfffffffeu;
  }
  if (key.z < 4u) { return 0xfffffffeu; }
  if (key.z != 7u) { return 0xfffffffdu; }
  if (key.y == 6u && textUnit(lane,key,0u) == 108u && textUnit(lane,key,1u) == 101u && textUnit(lane,key,2u) == 110u && textUnit(lane,key,3u) == 103u && textUnit(lane,key,4u) == 116u && textUnit(lane,key,5u) == 104u) { return 0xffffffffu; }
  if (key.y == 0u || (key.y > 1u && textUnit(lane,key,0u) == 48u)) { return 0xfffffffeu; }
  var index = 0u;
  for (var i = 0u; i < key.y; i++) {
    let unit = textUnit(lane,key,i);
    if (unit < 48u || unit > 57u) { return 0xfffffffdu; }
    index = index * 10u + unit - 48u;
    if (index > ${MAX_STRING}u) { return 0xfffffffeu; }
  }
  return index;
}
fn raise(lane: u32, value: Value, status: u32) {
  if (states[lane].handlerTop == 0u) { states[lane].result = value; states[lane].status = status; }
  else {
    states[lane].handlerTop--; let handler = states[lane].handlers[states[lane].handlerTop];
    states[lane].pc = handler.x; states[lane].depth = handler.y; states[lane].env = handler.z;
    states[lane].r[handler.y * ${MAX_REGISTERS}u + handler.w] = value; states[lane].status = 0u;
  }
}
@compute @workgroup_size(32)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let lane = id.x;
  if (lane >= params.count || states[lane].status != 0u) { return; }
  for (var step = 0u; step < params.budget; step++) {
    let base = states[lane].depth * ${MAX_REGISTERS}u;
    let pc = states[lane].pc;
    if (pc >= params.instructions) { states[lane].status = 2u; break; }
    let instruction = code[pc]; let op = instruction.x; let d = instruction.y; let a = instruction.z; let b = instruction.w;
    states[lane].pc = pc + 1u; states[lane].steps++;
    let binaryNumeric = (op >= ${OP.ADD}u && op <= ${OP.LE}u) || (op >= ${OP.AND}u && op <= ${OP.USHR}u) || op == ${OP.MOD}u;
    let unaryNumeric = op == ${OP.NEG}u || op == ${OP.NUM}u || op == ${OP.INV}u;
    var strings = false;
    if (binaryNumeric) { strings = states[lane].r[base + a].z == 7u && states[lane].r[base + b].z == 7u; }
    let textOperation = strings && (op == ${OP.ADD}u || op == ${OP.LT}u || op == ${OP.LE}u);
    if ((binaryNumeric || unaryNumeric) && !textOperation) {
      if (states[lane].r[base + a].z >= 4u) { states[lane].status = 6u; break; }
      if (binaryNumeric && states[lane].r[base + b].z >= 4u) { states[lane].status = 6u; break; }
    }
    switch op {
      case ${OP.CONST}u: { states[lane].r[base + d] = constants[a]; }
      case ${OP.MOVE}u: { states[lane].r[base + d] = states[lane].r[base + a]; }
      case ${OP.ADD}u: {
        if (strings) { states[lane].r[base + d] = concat(lane, states[lane].r[base + a], states[lane].r[base + b]); }
        else { states[lane].r[base + d] = numeric(plus(number(states[lane].r[base + a]), number(states[lane].r[base + b]))); }
      }
      case ${OP.SUB}u: { let v = number(states[lane].r[base + b]); states[lane].r[base + d] = numeric(plus(number(states[lane].r[base + a]), Pair(v.x, v.y ^ 0x80000000u))); }
      case ${OP.MUL}u: { states[lane].r[base + d] = numeric(times(number(states[lane].r[base + a]), number(states[lane].r[base + b]))); }
      case ${OP.DIV}u: { states[lane].r[base + d] = numeric(divide(number(states[lane].r[base + a]), number(states[lane].r[base + b]))); }
      case ${OP.MOD}u: { states[lane].r[base + d] = numeric(remainder(number(states[lane].r[base + a]), number(states[lane].r[base + b]))); }
      case ${OP.LT}u: {
        if (strings) { states[lane].r[base + d] = boolean(compareText(lane, states[lane].r[base + a], states[lane].r[base + b]) < 0i); }
        else { states[lane].r[base + d] = boolean(lessNumber(number(states[lane].r[base + a]), number(states[lane].r[base + b]))); }
      }
      case ${OP.LE}u: {
        if (strings) { states[lane].r[base + d] = boolean(compareText(lane, states[lane].r[base + a], states[lane].r[base + b]) <= 0i); }
        else { let x = number(states[lane].r[base + a]); let y = number(states[lane].r[base + b]); states[lane].r[base + d] = boolean(lessNumber(x,y) || equalNumber(x,y)); }
      }
      case ${OP.EQ}u: { states[lane].r[base + d] = boolean(strictEqual(lane, states[lane].r[base + a], states[lane].r[base + b])); }
      case ${OP.NE}u: { states[lane].r[base + d] = boolean(!strictEqual(lane, states[lane].r[base + a], states[lane].r[base + b])); }
      case ${OP.LOOSEQ}u, ${OP.LOOSENE}u: {
        let x = states[lane].r[base + a]; let y = states[lane].r[base + b]; var equal = false;
        if ((x.z >= 4u && y.z < 2u) || (y.z >= 4u && x.z < 2u) || (x.z == 7u && (y.z == 4u || y.z == 6u)) || (y.z == 7u && (x.z == 4u || x.z == 6u))) { states[lane].status = 6u; }
        else {
          if ((x.z == 2u || x.z == 3u) && (y.z == 2u || y.z == 3u)) { equal = true; }
          else if (x.z < 2u && y.z < 2u) { equal = equalNumber(x.xy, y.xy); }
          else if (x.z >= 4u && y.z >= 4u) { equal = strictEqual(lane, x, y); }
          states[lane].r[base + d] = boolean(select(!equal, equal, op == ${OP.LOOSEQ}u));
        }
      }
      case ${OP.NEG}u: { let v = number(states[lane].r[base + a]); states[lane].r[base + d] = numeric(Pair(v.x, v.y ^ 0x80000000u)); }
      case ${OP.NUM}u: { states[lane].r[base + d] = numeric(number(states[lane].r[base + a])); }
      case ${OP.NOT}u: { states[lane].r[base + d] = boolean(!truth(states[lane].r[base + a])); }
      case ${OP.INV}u: { states[lane].r[base + d] = numeric(fromSigned(~toBits(number(states[lane].r[base + a])))); }
      case ${OP.AND}u: { states[lane].r[base + d] = numeric(fromSigned(toBits(number(states[lane].r[base + a])) & toBits(number(states[lane].r[base + b])))); }
      case ${OP.OR}u: { states[lane].r[base + d] = numeric(fromSigned(toBits(number(states[lane].r[base + a])) | toBits(number(states[lane].r[base + b])))); }
      case ${OP.XOR}u: { states[lane].r[base + d] = numeric(fromSigned(toBits(number(states[lane].r[base + a])) ^ toBits(number(states[lane].r[base + b])))); }
      case ${OP.SHL}u: { states[lane].r[base + d] = numeric(fromSigned(toBits(number(states[lane].r[base + a])) << (toBits(number(states[lane].r[base + b])) & 31u))); }
      case ${OP.SHR}u: { states[lane].r[base + d] = numeric(fromSigned(bitcast<u32>(bitcast<i32>(toBits(number(states[lane].r[base + a]))) >> (toBits(number(states[lane].r[base + b])) & 31u)))); }
      case ${OP.USHR}u: { states[lane].r[base + d] = numeric(fromUnsigned(toBits(number(states[lane].r[base + a])) >> (toBits(number(states[lane].r[base + b])) & 31u))); }
      case ${OP.JZ}u: { if (!truth(states[lane].r[base + d])) { states[lane].pc = a; } }
      case ${OP.JNN}u: { let tag = states[lane].r[base + d].z; if (tag != 2u && tag != 3u) { states[lane].pc = a; } }
      case ${OP.JMP}u: { states[lane].pc = a; }
      case ${OP.LENGTH}u: {
        let value = states[lane].r[base + a];
        if (value.z == 2u || value.z == 3u) { states[lane].status = 4u; }
        else if (value.z == 7u) { states[lane].r[base + d] = numeric(fromUnsigned(value.y)); }
        else if (value.z == 4u) { states[lane].r[base + d] = numeric(fromUnsigned(code[value.x].w)); }
        else { states[lane].r[base + d] = Value(0u,0x7ff80000u,3u,0u); }
      }
      case ${OP.STRINGCHECK}u: { if (states[lane].r[base + d].z != 7u) { states[lane].status = 4u; } }
      case ${OP.CHARCODE}u, ${OP.CHARAT}u: {
        let value = states[lane].r[base + a]; let index = states[lane].r[base + b];
        if (index.z >= 4u) { states[lane].status = 6u; }
        else {
          let at = characterIndex(index, value.y);
          if (op == ${OP.CHARCODE}u) {
            if (at == 0xffffffffu) { states[lane].r[base + d] = numeric(qnan()); }
            else { states[lane].r[base + d] = numeric(fromUnsigned(textUnit(lane, value, at))); }
          } else {
            if (at == 0xffffffffu) { states[lane].r[base + d] = Value(0u,0u,7u,1u); }
            else { states[lane].r[base + d] = oneChar(lane, textUnit(lane, value, at)); }
          }
        }
      }
      case ${OP.INDEX}u: {
        let value = states[lane].r[base + a];
        if (value.z == 2u || value.z == 3u) { states[lane].status = 4u; }
        else if (value.z != 7u) { states[lane].status = 6u; }
        else {
          let index = propertyIndex(lane, states[lane].r[base + b]);
          if (index == 0xffffffffu) { states[lane].r[base + d] = numeric(fromUnsigned(value.y)); }
          else if (index == 0xfffffffdu) { states[lane].status = 6u; }
          else if (index >= value.y) { states[lane].r[base + d] = Value(0u,0x7ff80000u,3u,0u); }
          else { states[lane].r[base + d] = oneChar(lane, textUnit(lane, value, index)); }
        }
      }
      case ${OP.ENTER}u: { enter(lane, d, states[lane].env, 0u); }
      case ${OP.LEAVE}u: { states[lane].env = states[lane].envs[states[lane].env].x; }
      case ${OP.CLONE}u: { let env = states[lane].env; enter(lane, states[lane].envs[env].z, states[lane].envs[env].x, env); }
      case ${OP.LOAD}u, ${OP.STORE}u, ${OP.INIT}u, ${OP.CONSTSTORE}u: {
        var env = states[lane].env;
        for (var i = 0u; i < a; i++) { env = states[lane].envs[env].x; }
        let cell = states[lane].envs[env].y + b;
        if (op != ${OP.INIT}u && states[lane].cells[cell].z == 5u) { states[lane].status = 5u; }
        else if (op == ${OP.CONSTSTORE}u) { states[lane].status = 4u; }
        else if (op == ${OP.LOAD}u) { states[lane].r[base + d] = states[lane].cells[cell]; }
        else { states[lane].cells[cell] = states[lane].r[base + d]; }
      }
      case ${OP.CLOSURE}u: {
        states[lane].closureId++;
        states[lane].r[base + d] = Value(a, states[lane].env, 4u, states[lane].closureId);
      }
      case ${OP.CALL}u: {
        let callee = states[lane].r[base + a];
        if (callee.z != 4u) { states[lane].status = 4u; }
        else if (states[lane].depth + 1u >= ${frames}u) { states[lane].status = 3u; }
        else {
          let depth = states[lane].depth;
          states[lane].frames[depth] = vec4<u32>(states[lane].pc, states[lane].env, d, 0u);
          states[lane].depth++; let next = states[lane].depth * ${MAX_REGISTERS}u;
          for (var i = 0u; i < ${MAX_REGISTERS}u; i++) { states[lane].r[next + i] = Value(0u, 0x7ff80000u, 3u, 0u); }
          for (var i = 0u; i < (b >> 16u); i++) { states[lane].r[next + i] = states[lane].r[base + (b & 65535u) + i]; }
          states[lane].env = callee.y; states[lane].pc = callee.x;
        }
      }
      case ${OP.TRY}u: {
        if (states[lane].handlerTop >= 32u) { states[lane].status = 3u; }
        else { states[lane].handlers[states[lane].handlerTop] = vec4<u32>(a, states[lane].depth, states[lane].env, d); states[lane].handlerTop++; }
      }
      case ${OP.ENDTRY}u: { if (states[lane].handlerTop > 0u) { states[lane].handlerTop--; } }
      case ${OP.THROW}u: {
        let value = states[lane].r[base + d]; raise(lane, value, select(7u, value.x, value.z == 6u));
      }
      case ${OP.RET}u: {
        while (states[lane].handlerTop > 0u) {
          if (states[lane].handlers[states[lane].handlerTop - 1u].y < states[lane].depth) { break; }
          states[lane].handlerTop--;
        }
        let value = states[lane].r[base + d];
        if (states[lane].depth == 0u) { states[lane].result = value; states[lane].status = 1u; }
        else {
          states[lane].depth--; let depth = states[lane].depth; let frame = states[lane].frames[depth];
          states[lane].pc = frame.x; states[lane].env = frame.y;
          states[lane].r[depth * ${MAX_REGISTERS}u + frame.z] = value;
        }
      }
      default: { states[lane].status = 2u; break; }
    }
    if ((states[lane].status == 4u || states[lane].status == 5u) && states[lane].handlerTop > 0u) {
      states[lane].closureId++; let status = states[lane].status;
      raise(lane, Value(status, 0u, 6u, states[lane].closureId), status);
    }
    if (states[lane].status != 0u) { break; }
  }
  snapshots[lane].status = states[lane].status;
  snapshots[lane].steps = states[lane].steps;
  snapshots[lane].padding.x = states[lane].collections;
  snapshots[lane].result = states[lane].result;
  if (states[lane].status == 1u && states[lane].result.z == 7u) {
    for (var i = 0u; i < states[lane].result.y; i++) { snapshots[lane].chars[i] = textUnit(lane, states[lane].result, i); }
  }
}
`;
