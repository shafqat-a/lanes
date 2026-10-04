// ES2025 IteratorClose for the phase-4 iterator record.
// Parent splices these sources. Do not reimplement iterator open/step.
//
// Generic records (open/step worker): null-prototype objects, kind === 3,
// with `iterator` and `next`. Kind 1/2 stay the intrinsic no-op (clear
// `object` only). Normal for-of exhaustion stores undefined over the stack
// record, so the iterator_close opcode never calls 1272; `return` must not
// run then. This helper also skips `return` when `record.iterator` is already
// undefined (double close, or a record left live after its iterator was cleared).

export const CLOSE_THROW_ID = 2440;
export const CLOSE_THROW_NAME = '__lanesIteratorCloseThrow';
// finish() continuation: throw-close helper returned; re-enter raise with that
// return value (the original error). 81 is reserved and unused.
export const CONTINUATION_CLOSE_THROW = 80;
export const CONTINUATION_CLOSE_THROW_RESERVED = 81;

const NOT_OBJECT = 'Iterator close result is not an object';

// Normal completion (break, return-from-function, destructuring that stops
// early). A throw from the return getter or from return() replaces the
// completion. Non-object/non-function/null result is a TypeError.
export const iteratorCloseSource = `function iteratorCloseBootstrap(record) {
  "use strict";
  if (record.kind !== 3) {
    record.object = undefined;
    return undefined;
  }
  if (record.iterator === undefined) return undefined;
  const iterator = record.iterator;
  record.iterator = undefined;
  const ret = iterator.return;
  if (ret === null || ret === undefined) return undefined;
  const inner = __lanesCall(ret, iterator);
  if (inner === null || (typeof inner !== "object" && typeof inner !== "function")) {
    throw new TypeError("${NOT_OBJECT}");
  }
  return undefined;
}`;

// Throw completion. One root function: private builtins resolve only there,
// so __lanesCall is inlined in this function (not a nested helper). The
// original error wins over a return-getter throw, a return() throw, and a
// non-object return result. Kind 1/2 still run the intrinsic no-op, then
// the original error is returned.
export const iteratorCloseThrowSource = `function iteratorCloseThrowBootstrap(record, error) {
  "use strict";
  try {
    if (record.kind !== 3) {
      record.object = undefined;
    } else if (record.iterator !== undefined) {
      const iterator = record.iterator;
      record.iterator = undefined;
      const ret = iterator.return;
      if (ret !== null && ret !== undefined) {
        const inner = __lanesCall(ret, iterator);
        if (inner === null || (typeof inner !== "object" && typeof inner !== "function")) {
          throw new TypeError("${NOT_OBJECT}");
        }
      }
    }
  } catch (e) {
    return error;
  }
  return error;
}`;
