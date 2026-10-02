export const MAX_REGISTERS = 128;
export const STATE_WORDS = 8 + MAX_REGISTERS * 4;
export const OP = Object.freeze(Object.fromEntries([
  'CONST', 'MOVE', 'ADD', 'SUB', 'MUL', 'DIV', 'LT', 'LE', 'EQ', 'NE',
  'AND', 'OR', 'XOR', 'SHL', 'SHR', 'USHR', 'NEG', 'NUM', 'NOT', 'INV', 'JZ', 'JMP', 'RET',
].map((name, i) => [name, i])));
export const VM_STATUS = Object.freeze({ RUNNING: 0, DONE: 1, INVALID: 2 });
const programs = new WeakSet();
export function registerProgram(program) { programs.add(program); return program; }
export function checkProgram(program) { if (!programs.has(program)) throw new TypeError('Expected compileVM() program'); }
export function encode(value, words, offset) {
  let tag = 0;
  if (typeof value === 'boolean') tag = 1;
  else if (value === null) tag = 2;
  else if (value === undefined) tag = 3;
  else if (typeof value !== 'number') throw new TypeError('VM currently accepts only number, boolean, null and undefined values');
  const view = new DataView(words.buffer, words.byteOffset + offset * 4, 16);
  view.setFloat64(0, typeof value === 'number' ? value : Number(value), true);
  words[offset + 2] = tag; words[offset + 3] = 0;
}
export function decode(words, offset) {
  const tag = words[offset + 2];
  if (tag === 2) return null;
  if (tag === 3) return undefined;
  const number = new DataView(words.buffer, words.byteOffset + offset * 4, 8).getFloat64(0, true);
  if (tag === 1) return number !== 0;
  if (tag !== 0) throw new Error('Invalid VM value tag');
  return number;
}
