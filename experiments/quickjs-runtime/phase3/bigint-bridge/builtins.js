// BigInt constructor identity. Call is Unsupported, not ToNumber and not a
// host conversion. Literals do not go through this call.
// Builtin ids 1151..1179 are left free for the arithmetic module.

import { TAG_BIGINT } from './representation.js';

export const BIGINT_CALL_ID = 1150;
export const BIGINT_CONSTRUCTOR_NODE = 29;
export const BIGINT_PROTOTYPE_NODE = 30;
export const BIGINT_LENGTH = 1;
export const BIGINT_NAME = 'BigInt';

// shader.js dataProperty stores these flags << 1 in Node.marked.
// bit 0 writable, bit 1 enumerable, bit 2 configurable.
export const BIGINT_FLAG_WRITABLE = 1;
export const BIGINT_FLAG_ENUMERABLE = 2;
export const BIGINT_FLAG_CONFIGURABLE = 4;

export const bigintBuiltins = Object.freeze([
  Object.freeze({
    id: BIGINT_CALL_ID,
    name: BIGINT_NAME,
    length: BIGINT_LENGTH,
    node: BIGINT_CONSTRUCTOR_NODE,
    prototypeNode: BIGINT_PROTOTYPE_NODE,
    callable: true,
    constructable: false,
    valueTag: 11,
    value: Object.freeze([BIGINT_CALL_ID, 0, 11, 0]),
    callOutcome: Object.freeze({
      kind: 'unsupported',
      code: 'bigint-tobigint',
      status: 6,
      message: 'ToBigInt is not implemented',
    }),
    constructOutcome: Object.freeze({
      kind: 'type-error',
      code: 'bigint-new',
      status: 4,
      message: 'BigInt is not a constructor',
    }),
  }),
]);

export const bigintPropertyDescriptors = Object.freeze([
  Object.freeze({
    ownerNode: BIGINT_CONSTRUCTOR_NODE,
    ownerName: BIGINT_NAME,
    key: 'length',
    valueKind: 'number',
    value: BIGINT_LENGTH,
    writable: false,
    enumerable: false,
    configurable: true,
    flags: BIGINT_FLAG_CONFIGURABLE,
  }),
  Object.freeze({
    ownerNode: BIGINT_CONSTRUCTOR_NODE,
    ownerName: BIGINT_NAME,
    key: 'name',
    valueKind: 'string',
    value: BIGINT_NAME,
    writable: false,
    enumerable: false,
    configurable: true,
    flags: BIGINT_FLAG_CONFIGURABLE,
  }),
  Object.freeze({
    ownerNode: BIGINT_CONSTRUCTOR_NODE,
    ownerName: BIGINT_NAME,
    key: 'prototype',
    valueKind: 'object',
    valueNode: BIGINT_PROTOTYPE_NODE,
    writable: false,
    enumerable: false,
    configurable: false,
    flags: 0,
  }),
  Object.freeze({
    ownerNode: BIGINT_PROTOTYPE_NODE,
    ownerName: 'BigInt.prototype',
    key: 'constructor',
    valueKind: 'builtin',
    valueId: BIGINT_CALL_ID,
    valueTag: 11,
    writable: true,
    enumerable: false,
    configurable: true,
    flags: BIGINT_FLAG_WRITABLE | BIGINT_FLAG_CONFIGURABLE,
  }),
]);

// Not installed. asString is not an ES method and is not invented here.
export const bigintPending = Object.freeze([
  Object.freeze({ name: 'toString', owner: 'BigInt.prototype', outcome: 'unsupported' }),
  Object.freeze({ name: 'valueOf', owner: 'BigInt.prototype', outcome: 'unsupported' }),
  Object.freeze({ name: 'toLocaleString', owner: 'BigInt.prototype', outcome: 'unsupported' }),
  Object.freeze({ name: 'asIntN', owner: 'BigInt', outcome: 'unsupported' }),
  Object.freeze({ name: 'asUintN', owner: 'BigInt', outcome: 'unsupported' }),
  Object.freeze({
    name: 'toStringTag',
    owner: 'BigInt.prototype',
    outcome: 'unsupported',
    note: 'well-known symbol key is not installed by this bridge',
  }),
]);

export const typeofBigInt = Object.freeze({
  tag: TAG_BIGINT,
  result: 'bigint',
  note: 'shader.js typeof defaults to type index 2 ("object") for tag 18. program.js typeNames has no bigint slot.',
});

export const equalityNotes = Object.freeze({
  strictSameType: 'mathematical equality of canonical sign and limbs, not heap-index identity',
  strictMixedNumber: false,
  abstractEquality: 'PENDING unsupported; do not coerce with Number',
  mixedRelational: 'PENDING unsupported; do not coerce with Number',
});

// ES JSON.stringify(bigint) throws TypeError. Do not drop the value and do
// not keep the current unsupported ToString completion as the specified result.
export const jsonStringifyBigInt = Object.freeze({
  pending: true,
  outcome: 'type-error',
  code: 'bigint-json',
  status: 4,
});

export const bigintNodes = Object.freeze({
  constructor: Object.freeze({
    id: BIGINT_CONSTRUCTOR_NODE,
    kind: 2,
    prototypeNode: 3,
    extensible: true,
  }),
  prototype: Object.freeze({
    id: BIGINT_PROTOTYPE_NODE,
    kind: 2,
    prototypeNode: 1,
    extensible: true,
  }),
});

// Arguments are ignored on purpose. This must not coerce them.
export function bigintBuiltinOutcome(id, kind) {
  if (id !== BIGINT_CALL_ID) return { kind: 'unsupported', code: 'bigint-unknown-builtin', status: 6 };
  if (kind === 'construct') return { kind: 'type-error', code: 'bigint-new', status: 4 };
  if (kind === 'call') return { kind: 'unsupported', code: 'bigint-tobigint', status: 6 };
  return { kind: 'unsupported', code: 'bigint-pending', status: 6 };
}

export const nextFreeBigIntBuiltinId = 1151;
