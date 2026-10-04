import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CLOSE_THROW_ID,
  CLOSE_THROW_NAME,
  CONTINUATION_CLOSE_THROW,
  CONTINUATION_CLOSE_THROW_RESERVED,
  iteratorCloseSource,
  iteratorCloseThrowSource,
} from './index.js';
import {
  iteratorClose,
  iteratorCloseThrow,
  genericRecord,
  intrinsicRecord,
  scanRaise,
  forOfStack,
  TAG_UNDEFINED,
  TAG_OBJECT,
  TAG_CATCH,
} from './simulate.js';
import { raiseIteratorCloseWGSL, continuationCloseThrowWGSL, NOTES } from './raisePatch.js';

function boom(message) {
  const error = new Error(message);
  error.name = 'TestError';
  return error;
}

test('normal + no return method → undefined, iterator marked closed', () => {
  const iterator = { next() { return { value: 1, done: false }; } };
  const record = genericRecord(iterator);
  assert.equal(iteratorClose(record), undefined);
  assert.equal(record.iterator, undefined);
  assert.equal(Object.hasOwn(iterator, 'return'), false);
});

test('normal + return getter throw → that throw', () => {
  const thrown = boom('getter');
  const iterator = {};
  let sawCleared = false;
  Object.defineProperty(iterator, 'return', {
    get() {
      sawCleared = record.iterator === undefined;
      throw thrown;
    },
  });
  const record = genericRecord(iterator);
  assert.throws(() => iteratorClose(record), (error) => error === thrown);
  assert.equal(sawCleared, true);
  assert.equal(record.iterator, undefined);
});

test('normal + return() throw → that throw', () => {
  const thrown = boom('return');
  let calls = 0;
  let iteratorAtCall;
  const iterator = {
    return() {
      calls += 1;
      iteratorAtCall = record.iterator;
      iteratorClose(record);
      throw thrown;
    },
  };
  const record = genericRecord(iterator);
  assert.throws(() => iteratorClose(record), (error) => error === thrown);
  assert.equal(calls, 1);
  assert.equal(iteratorAtCall, undefined);
  assert.equal(record.iterator, undefined);
});

test('normal + return returns 1 → TypeError', () => {
  let calls = 0;
  const iterator = { return() { calls += 1; return 1; } };
  const record = genericRecord(iterator);
  assert.throws(() => iteratorClose(record), (error) => {
    assert.equal(error instanceof TypeError, true);
    assert.equal(error.message, 'Iterator close result is not an object');
    return true;
  });
  assert.equal(calls, 1);
  assert.equal(record.iterator, undefined);
});

test('normal + return returns null → TypeError', () => {
  const iterator = { return() { return null; } };
  const record = genericRecord(iterator);
  assert.throws(() => iteratorClose(record), (error) => error instanceof TypeError && error.message === 'Iterator close result is not an object');
});

test('normal + return returns { } → undefined', () => {
  let thisValue;
  const iterator = {
    return() {
      thisValue = this;
      return {};
    },
  };
  const record = genericRecord(iterator);
  assert.equal(iteratorClose(record), undefined);
  assert.equal(thisValue, iterator);
  assert.equal(record.iterator, undefined);
});

test('throw completion + return getter throw → original error', () => {
  const original = boom('original');
  const iterator = {};
  Object.defineProperty(iterator, 'return', { get() { throw boom('getter'); } });
  const record = genericRecord(iterator);
  assert.equal(iteratorCloseThrow(record, original), original);
  assert.equal(record.iterator, undefined);
});

test('throw completion + return throw → original error', () => {
  const original = boom('original');
  let calls = 0;
  const iterator = {
    return() {
      calls += 1;
      throw boom('return');
    },
  };
  const record = genericRecord(iterator);
  assert.equal(iteratorCloseThrow(record, original), original);
  assert.equal(calls, 1);
  assert.equal(record.iterator, undefined);
});

test('throw completion + non-object result → original error', () => {
  const original = boom('original');
  const iterator = { return() { return 1; } };
  const record = genericRecord(iterator);
  assert.equal(iteratorCloseThrow(record, original), original);
  assert.equal(record.iterator, undefined);
});

test('throw completion + successful return → original error', () => {
  const original = boom('original');
  let calls = 0;
  const iterator = {
    return() {
      calls += 1;
      return { done: true };
    },
  };
  const record = genericRecord(iterator);
  assert.equal(iteratorCloseThrow(record, original), original);
  assert.equal(calls, 1);
  assert.equal(record.iterator, undefined);
});

test('already exhausted iterator → return method not read', () => {
  let reads = 0;
  const iterator = {};
  Object.defineProperty(iterator, 'return', {
    get() {
      reads += 1;
      return () => ({});
    },
  });
  const record = genericRecord(iterator);
  assert.equal(iteratorClose(record), undefined);
  assert.equal(reads, 1);
  assert.equal(iteratorClose(record), undefined);
  assert.equal(iteratorCloseThrow(record, boom('original')).message, 'original');
  assert.equal(reads, 1);
});

test('kind 1 and 2 are the intrinsic no-op and do not read return', () => {
  let reads = 0;
  const iterator = {};
  Object.defineProperty(iterator, 'return', { get() { reads += 1; return () => ({}); } });
  for (const kind of [1, 2]) {
    const object = { length: 1 };
    const record = intrinsicRecord(kind, object);
    record.iterator = iterator;
    assert.equal(iteratorClose(record), undefined);
    assert.equal(record.object, undefined);
    const again = intrinsicRecord(kind, object);
    again.iterator = iterator;
    const original = boom('kind');
    assert.equal(iteratorCloseThrow(again, original), original);
    assert.equal(again.object, undefined);
  }
  assert.equal(reads, 0);
});

test('throw close source keeps __lanesCall in the root try', () => {
  assert.equal(iteratorCloseThrowSource.match(/function /g).length, 1);
  assert.match(iteratorCloseThrowSource, /function iteratorCloseThrowBootstrap\(record, error\)/);
  assert.match(iteratorCloseThrowSource, /try \{/);
  assert.match(iteratorCloseThrowSource, /catch \(e\) \{\s*return error;\s*\}/);
  assert.match(iteratorCloseThrowSource, /__lanesCall\(ret, iterator\)/);
  assert.match(iteratorCloseSource, /function iteratorCloseBootstrap\(record\)/);
  assert.match(iteratorCloseSource, /__lanesCall\(ret, iterator\)/);
  assert.equal(CLOSE_THROW_ID, 2440);
  assert.equal(CLOSE_THROW_NAME, '__lanesIteratorCloseThrow');
  assert.equal(CONTINUATION_CLOSE_THROW, 80);
  assert.equal(CONTINUATION_CLOSE_THROW_RESERVED, 81);
});

test('raise patch suspends on the iterator marker and does not recurse', () => {
  assert.match(raiseIteratorCloseWGSL, /fn raise\(l:u32,error:V\)/);
  assert.match(raiseIteratorCloseWGSL, /value\.z==9u&&value\.y==1u/);
  assert.match(raiseIteratorCloseWGSL, /states\[l\]\.stack\[sp-2u\]/);
  assert.match(raiseIteratorCloseWGSL, /record\.z==4u/);
  assert.match(raiseIteratorCloseWGSL, /frames\[depth\]\.tail==40u/);
  assert.match(raiseIteratorCloseWGSL, /V\(2440u,0u,11u,0u\)/);
  assert.match(raiseIteratorCloseWGSL, /tail=80u/);
  assert.match(raiseIteratorCloseWGSL, /receiver=error/);
  assert.equal(raiseIteratorCloseWGSL.includes('raise(l,'), false);
  assert.equal(raiseIteratorCloseWGSL.includes('81u'), false);
  assert.equal(raiseIteratorCloseWGSL.includes('alloc('), false);
  assert.match(raiseIteratorCloseWGSL, /\$\{L\.stack\+L\.frames\}/);
  assert.match(raiseIteratorCloseWGSL, /\$\{L\.stack\}/);
  assert.equal(continuationCloseThrowWGSL, 'else if(continuation==80u){raise(l,returned);}');
  assert.match(NOTES, /kind 50/i);
  const notesFile = readFileSync(new URL('./NOTES.md', import.meta.url), 'utf8');
  assert.match(notesFile, /stack\[sp-2\]/);
  assert.match(notesFile, /2440/);
  assert.match(notesFile, /kind 50/i);
  assert.match(notesFile, /tail == 40/);
});

test('body throw closes the live record and leaves it on the stack', () => {
  const record = { z: TAG_OBJECT, kind: 3, name: 'record' };
  const stack = forOfStack(10, record);
  stack[9] = { z: TAG_CATCH, y: 0, x: 50, name: 'outer-catch' };
  const error = boom('body');
  const hit = scanRaise({ stack, sp: 13, depth: 0, frames: [{ base: 0, tail: 0, receiver: { x: 0 } }] }, error);
  assert.equal(hit.suspend, true);
  assert.equal(hit.closeRecordIndex, 10);
  assert.equal(hit.sp, 12);
  assert.equal(hit.error, error);
  assert.equal(stack[10], record);
  // Continuation 80: finish set sp back to the close frame base (the marker).
  const resumed = scanRaise({ stack, sp: 12, depth: 0, frames: [{ base: 0, tail: 0, receiver: { x: 0 } }] }, error);
  assert.equal(resumed.suspend, false);
  assert.equal(resumed.found, true);
  assert.equal(resumed.destination, 50);
  assert.equal(resumed.sp, 9);
  assert.equal(resumed.error, error);
});

test('step tail 40 clears the record, skips return, and keeps the error', () => {
  const record = { z: TAG_OBJECT, kind: 3, name: 'record' };
  const stack = forOfStack(10, record);
  stack[9] = { z: TAG_CATCH, y: 0, x: 70, name: 'outer-catch' };
  // Step call base is slot+3. Callee and argument sit at and above that base.
  stack[13] = { z: 11, x: 1271, name: 'step' };
  stack[14] = record;
  const error = boom('next');
  const hit = scanRaise({
    stack,
    sp: 13,
    depth: 1,
    frames: [
      { base: 0, tail: 0, receiver: { x: 0 } },
      { base: 13, tail: 40, receiver: { x: 10 } },
    ],
  }, error);
  assert.equal(hit.suspend, false);
  assert.equal(hit.found, true);
  assert.equal(hit.destination, 70);
  assert.equal(hit.error, error);
  assert.equal(stack[10].z, TAG_UNDEFINED);
  assert.equal(hit.depth, 0);
});

test('a catch inside the step helper does not clear the record', () => {
  const record = { z: TAG_OBJECT, kind: 3, name: 'record' };
  const stack = forOfStack(10, record);
  stack[13] = { z: TAG_CATCH, y: 0, x: 4, name: 'step-catch' };
  const hit = scanRaise({
    stack,
    sp: 14,
    depth: 1,
    frames: [
      { base: 0, tail: 0, receiver: { x: 0 } },
      { base: 13, tail: 40, receiver: { x: 10 } },
    ],
  }, boom('inside-step'));
  assert.equal(hit.found, true);
  assert.equal(hit.destination, 4);
  assert.equal(hit.suspend, false);
  assert.equal(hit.depth, 1);
  assert.equal(stack[10], record);
});

test('nested for-of closes the inner record first', () => {
  const outer = { z: TAG_OBJECT, name: 'outer' };
  const inner = { z: TAG_OBJECT, name: 'inner' };
  const stack = forOfStack(0, outer);
  stack[3] = inner;
  stack[4] = { z: 11, x: 1274, name: 'inner-next' };
  stack[5] = { z: TAG_CATCH, y: 1, x: 0, name: 'inner-marker' };
  const error = boom('inner-body');
  const hit = scanRaise({ stack, sp: 6, depth: 0, frames: [{ base: 0, tail: 0, receiver: { x: 0 } }] }, error);
  assert.equal(hit.suspend, true);
  assert.equal(hit.closeRecordIndex, 3);
  assert.equal(stack[0], outer);
  const resumed = scanRaise({ stack, sp: hit.sp, depth: 0, frames: [{ base: 0, tail: 0, receiver: { x: 0 } }] }, error);
  assert.equal(resumed.suspend, true);
  assert.equal(resumed.closeRecordIndex, 0);
  assert.equal(resumed.error, error);
});
