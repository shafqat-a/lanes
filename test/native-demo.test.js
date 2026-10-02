import test from 'node:test';
import assert from 'node:assert/strict';
import { lower } from '../src/jit/ir.js';
import { nativeFunction } from '../playground/native.js';
import { jitFixtures, jitInputs } from './jit-fixtures.js';
for (const [name, source, oracle] of jitFixtures) test(`demo native code: ${name}`, () => {
  const native = nativeFunction(lower(source, { numericMode: 'i32' }));
  assert.deepEqual(jitInputs.map(native), jitInputs.map(oracle));
});
