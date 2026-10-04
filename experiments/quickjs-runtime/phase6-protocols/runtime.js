// Phase 6 shared runtime integration. Worker modules own the guest sources
// and the WGSL helpers. This module only composes them for phase4-registry.js.
// It must not import program.js, shader.js, or bootstrap.js.
//
// IDs (this job, 2400..2499, plus the pre-existing method ids below):
//   2420 createArrayIterator          2421 createStringIterator
//   2422 array-iterator slot          2423 clear   2424 setIndex
//   2425 string take                  2426 string done   2427 string brand
//   2440 iteratorCloseThrow (guest)
//   2460 arrayIteratorNext (guest)    2461 stringIteratorNext (guest)
//   2463 iterator identity (sync objectMethod; not a bootstrap field)
//   2490 instanceofOperator (guest)   2491 isBound   2492 boundTarget
//   2493 prototype walk (sync; Get of "prototype" stays inside this helper)
//   1101 Function.prototype[@@hasInstance] (guest)   1103 String.prototype[@@iterator]
// Existing array method ids 303 entries / 317 keys / 334 values stay. They are
// field-mapped here and are not new keys of arraySources (that would shift FIELDS).
// Continuations 72..79 and 81..87 are reserved and unused. 80 re-raises after
// throw-close. Heap kinds 51 and 52 are the iterator objects. 48..50 and 53..55
// are unused. Fixed nodes 77..79 are documented in phase4-fixed-nodes.js.
// Nodes 66..73 and generator nodes 74..76 are reserved elsewhere.
//
// Bootstrap sources are NOT merged into phase4BootstrapSources. program.js
// pushes these names after phase3FieldNames so FIELDS stays append-only.
// `hasInstance` is already a phase-3 field; its image .y holds this helper
// and .x stays the property-name text. Do not push that name again.
import { iteratorCloseThrowSource, CLOSE_THROW_ID, CONTINUATION_CLOSE_THROW } from './w3-iterator-close/index.js';
import { iteratorBuiltinFields, iteratorPrivateBuiltins } from './w4-intrinsic-iterators/ids.js';
import { sources as intrinsicIteratorSources } from './w4-intrinsic-iterators/sources.js';
import { iteratorMarkWGSL, iteratorObjectMethodWGSL, iteratorWgslFunctions } from './w4-intrinsic-iterators/wgsl.js';
import {
  symbolMethodBootstrapSources,
  symbolMethodBuiltinFields,
  symbolMethodObjectMethodWGSL,
  symbolMethodPrivateBuiltins,
  symbolMethodWGSL,
} from './w6-symbol-methods/symbol-methods.js';

export const protocolBootstrapSources = Object.freeze({
  ...intrinsicIteratorSources,
  iteratorCloseThrow: iteratorCloseThrowSource,
  ...symbolMethodBootstrapSources,
});

export const protocolPrivateBuiltins = Object.freeze({
  ...iteratorPrivateBuiltins,
  __lanesIteratorCloseThrow: CLOSE_THROW_ID,
  ...symbolMethodPrivateBuiltins,
});

// 2463 stays a synchronous objectMethod. A bootstrap field would hide it.
const intrinsicFields = Object.fromEntries(Object.entries(iteratorBuiltinFields).filter(([id]) => Number(id) !== 2463));
export const protocolBuiltinFields = Object.freeze({
  ...intrinsicFields,
  303: 'arrayEntries',
  317: 'arrayKeys',
  334: 'arrayValues',
  ...symbolMethodBuiltinFields,
  [CLOSE_THROW_ID]: 'iteratorCloseThrow',
});

export function protocolWGSLFunctions(context) {
  return iteratorWgslFunctions() + symbolMethodWGSL(context);
}

export function protocolObjectMethodWGSL() {
  return iteratorObjectMethodWGSL() + symbolMethodObjectMethodWGSL;
}

export function protocolContinuations() {
  return [{ code: CONTINUATION_CLOSE_THROW, body: 'raise(l,returned);' }];
}

export function protocolMarkWGSL() {
  return iteratorMarkWGSL();
}
