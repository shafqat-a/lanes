import { OP, STATUS, MAX_REGISTERS, validateRun } from './bytecode.js';

export function runCPU(program, inputs, { budget = 10000 } = {}) {
  validateRun(program, inputs, budget);
  const values = new Int32Array(inputs.length), statuses = new Uint32Array(inputs.length);
  const code = program.instructions;
  for (let lane = 0; lane < inputs.length; lane++) {
    const r = new Int32Array(MAX_REGISTERS); r[0] = inputs[lane];
    let pc = 0, status = STATUS.BUDGET;
    for (let step = 0; step < budget; step++) {
      if (pc * 4 >= code.length) { status = STATUS.INVALID; break; }
      const base = pc * 4;
      const op = code[base], d = code[base + 1], a = code[base + 2], b = code[base + 3]; pc++;
      switch (op) {
        case OP.CONST: r[d] = a; break;
        case OP.MOVE: r[d] = r[a]; break;
        case OP.ADD: r[d] = r[a] + r[b]; break;
        case OP.SUB: r[d] = r[a] - r[b]; break;
        case OP.MUL: r[d] = Math.imul(r[a], r[b]); break;
        case OP.LT: r[d] = +(r[a] < r[b]); break;
        case OP.LE: r[d] = +(r[a] <= r[b]); break;
        case OP.EQ: r[d] = +(r[a] === r[b]); break;
        case OP.NE: r[d] = +(r[a] !== r[b]); break;
        case OP.AND: r[d] = r[a] & r[b]; break;
        case OP.OR: r[d] = r[a] | r[b]; break;
        case OP.XOR: r[d] = r[a] ^ r[b]; break;
        case OP.SHL: r[d] = r[a] << r[b]; break;
        case OP.SHR: r[d] = r[a] >> r[b]; break;
        case OP.JZ: if (!r[d]) pc = a; break;
        case OP.JMP: pc = a; break;
        case OP.RET: values[lane] = r[d]; status = STATUS.DONE; break;
        default: status = STATUS.INVALID;
      }
      if (status !== STATUS.BUDGET) break;
    }
    statuses[lane] = status;
  }
  return { values, statuses };
}
