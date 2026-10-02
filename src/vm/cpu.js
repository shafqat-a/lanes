import { OP, MAX_REGISTERS, VM_STATUS, memoryLayout, MAX_STRING } from './values.js';
const TDZ = Symbol('uninitialized binding');
const text = value => value && typeof value === 'object' && 'text' in value ? value.text : value;
export function initialCPU(inputs, limits) {
  return inputs.map(value => {
    const state = { pc: 0, status: 0, steps: 0, value: undefined, env: 0, cellCount: 0, collections: 0, limits,
      environments: [{ parent: 0, cells: [] }], frames: [], handlers: [], registers: Array(MAX_REGISTERS).fill(undefined) };
    if (typeof value === 'string') {
      state.environments.push({ parent: 0, cells: Array.from({ length: value.length }, (_, i) => value.charCodeAt(i)) });
      state.cellCount = value.length; state.registers[0] = { text: value, env: 1 };
    } else state.registers[0] = value;
    return state;
  });
}
export function advanceCPU(program, states, budget) {
  const code = program.instructions;
  for (const state of states) {
    const limits = state.limits ?? memoryLayout(program);
    const collect = () => {
      const marked = new Set([0]), queue = [];
      const mark = env => { if (!marked.has(env)) { marked.add(env); queue.push(env); } };
      const value = v => { if (v && typeof v === 'object' && ('entry' in v || 'text' in v)) mark(v.env); };
      mark(state.env); state.registers.forEach(value); value(state.value);
      for (const frame of state.frames) { mark(frame.env); frame.registers.forEach(value); }
      for (const handler of state.handlers) mark(handler.env);
      for (let i = 0; i < queue.length; i++) {
        const env = state.environments[queue[i]]; mark(env.parent); env.cells.forEach(value);
      }
      state.cellCount = 0;
      for (let i = 1; i < state.environments.length; i++) {
        if (marked.has(i)) state.cellCount += state.environments[i].cells.length;
        else state.environments[i] = null;
      }
      state.collections++;
    };
    const free = () => {
      for (let i = 1; i < state.environments.length; i++) if (state.environments[i] === null) return i;
      return state.environments.length < limits.environments ? state.environments.length : 0;
    };
    const enter = (size, parent = state.env, cells = Array(size).fill(TDZ)) => {
      let index = free();
      if (!index || state.cellCount + size > limits.cells) { collect(); index = free(); }
      if (!index || state.cellCount + size > limits.cells) { state.status = VM_STATUS.RESOURCE; return; }
      state.cellCount += size; state.env = index; state.environments[index] = { parent, cells };
    };
    const string = value => {
      if (value.length === 0) return '';
      if (value.length > MAX_STRING) { state.status = VM_STATUS.RESOURCE; return undefined; }
      const outer = state.env; enter(value.length, 0, Array.from({ length: value.length }, (_, i) => value.charCodeAt(i)));
      const env = state.env; state.env = outer; return { text: value, env };
    };
    const raise = (value, status) => {
      const handler = state.handlers.pop();
      if (!handler) { state.value = value; state.status = status; return; }
      while (state.frames.length > handler.depth) state.registers = state.frames.pop().registers;
      state.env = handler.env; state.pc = handler.pc; state.registers[handler.destination] = value; state.status = 0;
    };
    for (let step = 0; step < budget && !state.status; step++) {
      if (state.pc * 4 >= code.length) { state.status = VM_STATUS.INVALID; break; }
      const base = state.pc++ * 4, op = code[base], d = code[base + 1], a = code[base + 2], b = code[base + 3];
      state.steps++;
      const r = state.registers;
      const x = text(r[a]), y = text(r[b]);
      const binaryNumeric = (op >= OP.ADD && op <= OP.LE) || (op >= OP.AND && op <= OP.USHR) || op === OP.MOD;
      const unaryNumeric = [OP.NEG, OP.NUM, OP.INV].includes(op);
      const strings = typeof x === 'string' && typeof y === 'string';
      if (binaryNumeric || unaryNumeric) {
        const allowedStrings = strings && [OP.ADD, OP.LT, OP.LE].includes(op);
        if (!allowedStrings && ((x !== null && typeof x === 'object') || typeof x === 'string' ||
          (binaryNumeric && ((y !== null && typeof y === 'object') || typeof y === 'string')))) { state.status = VM_STATUS.UNSUPPORTED; break; }
      }
      switch (op) {
        case OP.CONST: r[d] = program.constants[a]; break;
        case OP.MOVE: r[d] = r[a]; break;
        case OP.ADD: r[d] = strings ? string(x + y) : x + y; break;
        case OP.SUB: r[d] = x - y; break;
        case OP.MUL: r[d] = x * y; break;
        case OP.DIV: r[d] = x / y; break;
        case OP.MOD: r[d] = x % y; break;
        case OP.LT: r[d] = x < y; break;
        case OP.LE: r[d] = x <= y; break;
        case OP.EQ: r[d] = x === y; break;
        case OP.NE: r[d] = x !== y; break;
        case OP.LOOSEQ: case OP.LOOSENE: {
          const object = v => v !== null && typeof v === 'object';
          if ((object(x) && y != null && !object(y)) || (object(y) && x != null && !object(x)) || (typeof x === 'string' && y != null && typeof y !== 'string') || (typeof y === 'string' && x != null && typeof x !== 'string')) { state.status = VM_STATUS.UNSUPPORTED; break; }
          r[d] = op === OP.LOOSEQ ? x == y : x != y; break;
        }
        case OP.AND: r[d] = x & y; break;
        case OP.OR: r[d] = x | y; break;
        case OP.XOR: r[d] = x ^ y; break;
        case OP.SHL: r[d] = x << y; break;
        case OP.SHR: r[d] = x >> y; break;
        case OP.USHR: r[d] = x >>> y; break;
        case OP.NEG: r[d] = -x; break;
        case OP.NUM: r[d] = +x; break;
        case OP.NOT: r[d] = !x; break;
        case OP.INV: r[d] = ~x; break;
        case OP.JZ: if (!text(r[d])) state.pc = a; break;
        case OP.JNN: if (r[d] !== null && r[d] !== undefined) state.pc = a; break;
        case OP.JMP: state.pc = a; break;
        case OP.LENGTH:
          if (x == null) state.status = VM_STATUS.TYPE;
          else r[d] = typeof x === 'string' ? x.length : typeof x === 'object' && 'entry' in x ? code[x.entry * 4 + 3] : undefined;
          break;
        case OP.STRINGCHECK: if (typeof text(r[d]) !== 'string') state.status = VM_STATUS.TYPE; break;
        case OP.CHARCODE: case OP.CHARAT:
          if (typeof y === 'string' || (y !== null && typeof y === 'object')) { state.status = VM_STATUS.UNSUPPORTED; break; }
          r[d] = op === OP.CHARCODE ? x.charCodeAt(y) : string(x.charAt(y)); break;
        case OP.INDEX: {
          if (x == null) { state.status = VM_STATUS.TYPE; break; }
          if (typeof x !== 'string' || (y !== null && typeof y === 'object')) { state.status = VM_STATUS.UNSUPPORTED; break; }
          if (y === 'length') { r[d] = x.length; break; }
          if (typeof y === 'string' && !/^[0-9]+$/.test(y)) { state.status = VM_STATUS.UNSUPPORTED; break; }
          const value = x[y]; r[d] = value === undefined ? undefined : string(value); break;
        }
        case OP.ENTER: enter(d); break;
        case OP.LEAVE: state.env = state.environments[state.env].parent; break;
        case OP.CLONE: { const env = state.environments[state.env]; enter(env.cells.length, env.parent, env.cells.slice()); break; }
        case OP.LOAD: case OP.STORE: case OP.INIT: case OP.CONSTSTORE: {
          let env = state.env; for (let i = 0; i < a; i++) env = state.environments[env].parent;
          const cells = state.environments[env].cells;
          if (op !== OP.INIT && cells[b] === TDZ) { state.status = VM_STATUS.REFERENCE; break; }
          if (op === OP.CONSTSTORE) { state.status = VM_STATUS.TYPE; break; }
          if (op === OP.LOAD) r[d] = cells[b]; else cells[b] = r[d];
          break;
        }
        case OP.CLOSURE: r[d] = { entry: a, env: state.env }; break;
        case OP.CALL: {
          const fn = r[a];
          if (!fn || typeof fn !== 'object' || !('entry' in fn)) { state.status = VM_STATUS.TYPE; break; }
          if (state.frames.length + 1 >= limits.frames) { state.status = VM_STATUS.RESOURCE; break; }
          const args = r.slice(b & 65535, (b & 65535) + (b >>> 16));
          state.frames.push({ registers: r, pc: state.pc, env: state.env, destination: d });
          state.registers = Array(MAX_REGISTERS).fill(undefined); args.forEach((arg, i) => state.registers[i] = arg);
          state.env = fn.env; state.pc = fn.entry; break;
        }
        case OP.TRY:
          if (state.handlers.length >= 32) state.status = VM_STATUS.RESOURCE;
          else state.handlers.push({ pc: a, depth: state.frames.length, env: state.env, destination: d });
          break;
        case OP.ENDTRY: state.handlers.pop(); break;
        case OP.THROW: {
          const value = r[d]; raise(value, value?.error ?? VM_STATUS.THROWN); break;
        }
        case OP.RET: {
          while (state.handlers.length && state.handlers.at(-1).depth >= state.frames.length) state.handlers.pop();
          const value = r[d], caller = state.frames.pop();
          if (caller) { state.pc = caller.pc; state.env = caller.env; state.registers = caller.registers; state.registers[caller.destination] = value; }
          else { state.value = value; state.status = VM_STATUS.DONE; }
          break;
        }
        default: state.status = VM_STATUS.INVALID;
      }
      if ((state.status === VM_STATUS.TYPE || state.status === VM_STATUS.REFERENCE) && state.handlers.length)
        raise({ error: state.status }, state.status);
    }
  }
}
