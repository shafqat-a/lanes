// Host completion of the guest close sources, plus a raise-scan model of the
// for-of stack. The close functions are the compiled bootstrap strings; the
// scan mirrors raiseIteratorCloseWGSL (tag 9 y==1, tag 3 skip, tail 40 clear).
import { iteratorCloseSource, iteratorCloseThrowSource } from './index.js';

export function lanesCall(fn, thisArg, ...args) {
  if (typeof fn !== 'function') throw new TypeError('Iterator return is not callable');
  return Reflect.apply(fn, thisArg, args);
}

function load(source, name) {
  const factory = new Function('__lanesCall', `${source}\nreturn ${name};`);
  return factory(lanesCall);
}

export const iteratorClose = load(iteratorCloseSource, 'iteratorCloseBootstrap');
export const iteratorCloseThrow = load(iteratorCloseThrowSource, 'iteratorCloseThrowBootstrap');

export function genericRecord(iterator) {
  const record = Object.create(null);
  record.kind = 3;
  record.iterator = iterator;
  record.object = undefined;
  record.next = undefined;
  return record;
}

export function intrinsicRecord(kind, object) {
  const record = Object.create(null);
  record.kind = kind;
  record.object = object;
  record.index = 0;
  return record;
}

export const TAG_UNDEFINED = 3;
export const TAG_OBJECT = 4;
export const TAG_CATCH = 9;
export const TAG_BUILTIN = 11;

export function undefinedValue() {
  return { z: TAG_UNDEFINED };
}

// Mutates state.stack when a tail-40 step frame is popped (record → undefined).
// Returns the scan decision. Does not invoke close and does not call itself.
export function scanRaise(state, error) {
  const stack = state.stack;
  const frames = state.frames;
  let sp = state.sp;
  let depth = state.depth;
  let found = false;
  let destination = 0;
  let suspend = false;
  let closeRecordIndex = -1;
  const limit = stack.length + frames.length + 4;
  for (let i = 0; i < limit && !found && !suspend && (sp > frames[depth].base || depth > 0); i++) {
    if (sp > frames[depth].base) {
      sp -= 1;
      const value = stack[sp];
      if (value.z === TAG_CATCH && value.y === 1) {
        if (sp >= frames[depth].base + 2) {
          const record = stack[sp - 2];
          if (record.z === TAG_OBJECT) {
            suspend = true;
            closeRecordIndex = sp - 2;
          }
        }
      } else {
        found = value.z === TAG_CATCH && value.y === 0;
        destination = value.x;
      }
    } else {
      const frame = frames[depth];
      if (frame.tail === 40) {
        const recordIndex = frame.receiver.x;
        if (recordIndex < sp) stack[recordIndex] = undefinedValue();
      }
      depth -= 1;
    }
  }
  return { stack, sp, depth, found, destination, suspend, closeRecordIndex, error };
}

// for-of triple at `slot`, matching for_of_start after continuation 41.
export function forOfStack(slot, record) {
  const stack = [];
  stack[slot] = record;
  stack[slot + 1] = { z: TAG_BUILTIN, x: 1274, name: 'next' };
  stack[slot + 2] = { z: TAG_CATCH, y: 1, x: 0, name: 'marker' };
  return stack;
}
