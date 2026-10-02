import { OP, MAX_REGISTERS, VM_STATUS } from './values.js';
export function initialCPU(inputs) {
  return inputs.map(value => ({ pc: 0, status: 0, steps: 0, value: undefined,
    registers: Object.assign(Array(MAX_REGISTERS).fill(undefined), { 0: value }) }));
}
export function advanceCPU(program, states, budget) {
  const code = program.instructions;
  for (const state of states) {
    const r = state.registers;
    for (let step = 0; step < budget && !state.status; step++) {
      if (state.pc * 4 >= code.length) { state.status = VM_STATUS.INVALID; break; }
      const base = state.pc++ * 4, op = code[base], d = code[base + 1], a = code[base + 2], b = code[base + 3];
      state.steps++;
      switch (op) {
        case OP.CONST: r[d] = program.constants[a]; break;
        case OP.MOVE: r[d] = r[a]; break;
        case OP.ADD: r[d] = r[a] + r[b]; break;
        case OP.SUB: r[d] = r[a] - r[b]; break;
        case OP.MUL: r[d] = r[a] * r[b]; break;
        case OP.DIV: r[d] = r[a] / r[b]; break;
        case OP.LT: r[d] = r[a] < r[b]; break;
        case OP.LE: r[d] = r[a] <= r[b]; break;
        case OP.EQ: r[d] = r[a] === r[b]; break;
        case OP.NE: r[d] = r[a] !== r[b]; break;
        case OP.AND: r[d] = r[a] & r[b]; break;
        case OP.OR: r[d] = r[a] | r[b]; break;
        case OP.XOR: r[d] = r[a] ^ r[b]; break;
        case OP.SHL: r[d] = r[a] << r[b]; break;
        case OP.SHR: r[d] = r[a] >> r[b]; break;
        case OP.USHR: r[d] = r[a] >>> r[b]; break;
        case OP.NEG: r[d] = -r[a]; break;
        case OP.NUM: r[d] = +r[a]; break;
        case OP.NOT: r[d] = !r[a]; break;
        case OP.INV: r[d] = ~r[a]; break;
        case OP.JZ: if (!r[d]) state.pc = a; break;
        case OP.JMP: state.pc = a; break;
        case OP.RET: state.value = r[d]; state.status = VM_STATUS.DONE; break;
        default: state.status = VM_STATUS.INVALID;
      }
    }
  }
}
