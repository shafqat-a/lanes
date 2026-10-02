export const OP = Object.freeze(Object.fromEntries(
  ['CONST', 'MOVE', 'ADD', 'SUB', 'MUL', 'LT', 'LE', 'EQ', 'NE', 'AND', 'OR', 'XOR', 'SHL', 'SHR', 'JZ', 'JMP', 'RET']
    .map((name, index) => [name, index])));
export const MAX_REGISTERS = 128;
export const STATUS = Object.freeze({ DONE: 1, BUDGET: 2, INVALID: 3 });
const compiled = new WeakSet();
export function registerProgram(program) { compiled.add(program); return program; }
export function validateRun(program, inputs, budget) {
  if (!compiled.has(program)) throw new TypeError('Expected a program returned by compile()');
  if (!(inputs instanceof Int32Array)) throw new TypeError('Inputs must be an Int32Array');
  if (!Number.isInteger(budget) || budget < 1 || budget > 1_000_000)
    throw new RangeError('Instruction budget must be between 1 and 1,000,000');
}
