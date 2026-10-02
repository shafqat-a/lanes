export const MAX_REGISTERS = 128;
export const MAX_ARGUMENTS = 16;
export const MAX_STRING = 256;
export const SNAPSHOT_WORDS = 8 + MAX_STRING;
export function memoryLayout(program, strings = false) {
  const frames = program.functions > 1 || program.calls ? 32 : 1;
  const environments = frames > 1 ? 256 : program.strings || strings ? 128 : 64;
  const cells = frames > 1 || program.strings || strings ? 2048 : 512;
  return { frames, environments, cells, words: 16 + 4 * (frames * MAX_REGISTERS + frames + environments + cells * 2 + 32) + environments };
}
export const OP = Object.freeze(Object.fromEntries([
  'CONST', 'MOVE', 'ADD', 'SUB', 'MUL', 'DIV', 'LT', 'LE', 'EQ', 'NE',
  'AND', 'OR', 'XOR', 'SHL', 'SHR', 'USHR', 'NEG', 'NUM', 'NOT', 'INV', 'JZ', 'JMP', 'RET',
  'ENTER', 'LEAVE', 'CLONE', 'LOAD', 'STORE', 'INIT', 'CLOSURE', 'CALL',
  'TRY', 'ENDTRY', 'THROW', 'CONSTSTORE', 'MOD', 'JNN', 'LOOSEQ', 'LOOSENE',
  'LENGTH', 'STRINGCHECK', 'CHARCODE', 'CHARAT', 'INDEX',
].map((name, i) => [name, i])));
export const VM_STATUS = Object.freeze({ RUNNING: 0, DONE: 1, INVALID: 2, RESOURCE: 3, TYPE: 4, REFERENCE: 5, UNSUPPORTED: 6, THROWN: 7 });
const programs = new WeakSet();
export function registerProgram(program) { programs.add(program); return program; }
export function checkProgram(program) { if (!programs.has(program)) throw new TypeError('Expected compileVM() program'); }
export function encode(value, words, offset) {
  let tag = 0;
  if (typeof value === 'boolean') tag = 1;
  else if (value === null) tag = 2;
  else if (value === undefined) tag = 3;
  else if (typeof value === 'string') {
    if (value.length > MAX_STRING) throw new RangeError(`VM string limit: ${MAX_STRING} UTF-16 code units`);
    words[offset] = 0; words[offset + 1] = value.length; words[offset + 2] = 7; words[offset + 3] = 1; return;
  }
  else if (typeof value !== 'number') throw new TypeError('VM currently accepts only number, boolean, string, null and undefined values');
  const view = new DataView(words.buffer, words.byteOffset + offset * 4, 16);
  view.setFloat64(0, typeof value === 'number' ? value : Number(value), true);
  words[offset + 2] = tag; words[offset + 3] = 0;
}
export function decode(words, offset, characters = offset + 4) {
  const tag = words[offset + 2];
  if (tag === 2) return null;
  if (tag === 3) return undefined;
  if (tag === 4) throw new TypeError('Function results cannot cross the VM host boundary yet');
  if (tag === 6) throw new TypeError('Error object results cannot cross the VM host boundary yet');
  if (tag === 7) return String.fromCharCode(...words.subarray(characters, characters + words[offset + 1]));
  const number = new DataView(words.buffer, words.byteOffset + offset * 4, 8).getFloat64(0, true);
  if (tag === 1) return number !== 0;
  if (tag !== 0) throw new Error('Invalid VM value tag');
  return number;
}
