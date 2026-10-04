// Semantic contract for the phase 3 Symbol/BigInt wave.
// "supported" is only behavior confirmed in the current engine source.
// Symbol and BigInt guest operations are not supported. ENGINE_HAS_* stay
// false until a cited implementation exists. Do not mark those features
// supported without a file=experiments/quickjs-runtime/... ident=SymbolName
// citation whose ident occurs in that file.

export const ENGINE_HAS_SYMBOL = false;
export const ENGINE_HAS_BIGINT = false;

const WAVE = 'target of phase3 wave, not yet in core';
const OUT = 'explicit unsupported; not a phase3 wave claim';

export const BOUNDARIES = Object.freeze([
  Object.freeze({
    feature: 'Math @@toStringTag',
    status: 'supported',
    notes: 'Object.prototype.toString on Math (fixed node 23) returns [object Math]. file=experiments/quickjs-runtime/shader.js ident=objectMethod',
  }),
  Object.freeze({
    feature: 'JSON @@toStringTag',
    status: 'supported',
    notes: 'Object.prototype.toString on JSON (fixed node 25) returns [object JSON]. file=experiments/quickjs-runtime/shader.js ident=objectMethod',
  }),
  Object.freeze({
    feature: 'integer addition',
    status: 'supported',
    notes: 'Number + number uses software binary64 plus. Harness input 0 makes f(x){return x+1} return 1. file=experiments/quickjs-runtime/shader.js ident=binary',
  }),
  Object.freeze({
    feature: 'Array.isArray',
    status: 'supported',
    notes: 'Builtin 201 is true only for heap kind 7. file=experiments/quickjs-runtime/shader.js ident=objectMethod',
  }),
  Object.freeze({ feature: 'symbol identity', status: 'unsupported', notes: WAVE }),
  Object.freeze({ feature: 'symbol constructor rejects new', status: 'unsupported', notes: `${WAVE}; spec throw is TypeError, not implemented` }),
  Object.freeze({ feature: 'Symbol.for and Symbol.keyFor', status: 'unsupported', notes: WAVE }),
  Object.freeze({ feature: 'typeof symbol', status: 'unsupported', notes: `${WAVE}; typeof currently falls through to object for unknown tags` }),
  Object.freeze({ feature: 'symbol description', status: 'unsupported', notes: WAVE }),
  Object.freeze({ feature: 'symbol property keys', status: 'unsupported', notes: `${WAVE}; keyOf rejects non-number non-string keys with status 6` }),
  Object.freeze({ feature: 'property enumeration order with symbols', status: 'unsupported', notes: `${WAVE}; ownKeys emits only strings, integer indices then creation order` }),
  Object.freeze({ feature: 'Object.getOwnPropertySymbols', status: 'unsupported', notes: WAVE }),
  Object.freeze({ feature: 'Reflect.ownKeys symbol keys', status: 'unsupported', notes: WAVE }),
  Object.freeze({ feature: 'object spread copies enumerable symbol keys', status: 'unsupported', notes: `${WAVE}; copyDataProperties reads __lanesOwnPropertyKeys 1240, which is string-only` }),
  Object.freeze({ feature: 'for-in excludes symbol keys', status: 'unsupported', notes: `${WAVE}; forInKeys stringifies non-index keys before forInNextBootstrap can see them` }),
  Object.freeze({ feature: 'Symbol.iterator', status: 'unsupported', notes: WAVE }),
  Object.freeze({ feature: 'Symbol.toPrimitive', status: 'unsupported', notes: WAVE }),
  Object.freeze({ feature: 'Symbol.toStringTag', status: 'unsupported', notes: `${WAVE}; objectMethod id 155 is the temporary tag bridge and must be replaced, not extended with more hardcoded nodes` }),
  Object.freeze({ feature: 'ToPrimitive symbol hook', status: 'unsupported', notes: WAVE }),
  Object.freeze({ feature: 'toStringTag bridge replacement', status: 'unsupported', notes: WAVE }),
  Object.freeze({ feature: 'Symbol.iterator override of iterationKind', status: 'unsupported', notes: `${WAVE}; iterationKind never reads an own @@iterator` }),
  Object.freeze({ feature: 'Symbol.asyncIterator', status: 'unsupported', notes: OUT }),
  Object.freeze({ feature: 'Symbol.hasInstance', status: 'unsupported', notes: OUT }),
  Object.freeze({ feature: 'Symbol.isConcatSpreadable', status: 'unsupported', notes: OUT }),
  Object.freeze({ feature: 'Symbol.match', status: 'unsupported', notes: OUT }),
  Object.freeze({ feature: 'Symbol.matchAll', status: 'unsupported', notes: OUT }),
  Object.freeze({ feature: 'Symbol.replace', status: 'unsupported', notes: OUT }),
  Object.freeze({ feature: 'Symbol.search', status: 'unsupported', notes: OUT }),
  Object.freeze({ feature: 'Symbol.species', status: 'unsupported', notes: OUT }),
  Object.freeze({ feature: 'Symbol.split', status: 'unsupported', notes: OUT }),
  Object.freeze({ feature: 'Symbol.unscopables', status: 'unsupported', notes: OUT }),
  Object.freeze({ feature: 'Symbol.dispose', status: 'unsupported', notes: OUT }),
  Object.freeze({ feature: 'Symbol.asyncDispose', status: 'unsupported', notes: OUT }),
  Object.freeze({ feature: 'bigint typeof', status: 'unsupported', notes: WAVE }),
  Object.freeze({ feature: 'bigint literal', status: 'unsupported', notes: `${WAVE}; packProgram accepts only number and string constants` }),
  Object.freeze({ feature: 'bigint strict equality with number', status: 'unsupported', notes: `${WAVE}; spec result is false, not implemented because no bigint values exist` }),
  Object.freeze({ feature: 'bigint addition', status: 'unsupported', notes: WAVE }),
  Object.freeze({ feature: 'bigint subtraction', status: 'unsupported', notes: WAVE }),
  Object.freeze({ feature: 'bigint multiplication', status: 'unsupported', notes: WAVE }),
  Object.freeze({ feature: 'bigint negation', status: 'unsupported', notes: WAVE }),
  Object.freeze({ feature: 'bigint comparison', status: 'unsupported', notes: WAVE }),
  Object.freeze({ feature: 'bigint division', status: 'unsupported', notes: `${WAVE}; division was not proven and must not be faked` }),
  Object.freeze({ feature: 'bigint bitwise', status: 'unsupported', notes: `${WAVE}; bitwise must not be faked with ToInt32` }),
  Object.freeze({ feature: 'bigint mixed relational comparison', status: 'unsupported', notes: `${WAVE}; spec throw is TypeError; the z>=4 path currently calls the number relational helper` }),
  Object.freeze({ feature: 'ToBigInt of a number', status: 'unsupported', notes: `${WAVE}; must not be faked` }),
  Object.freeze({ feature: 'ToBigInt of a string', status: 'unsupported', notes: `${WAVE}; must not be faked` }),
  Object.freeze({ feature: 'JSON.stringify bigint', status: 'unsupported', notes: `${WAVE}; spec throw is TypeError. JSON.parse is id 1740. stringify is not wired (pending metadata id 1820 only)` }),
  Object.freeze({ feature: 'bigint wrapper object', status: 'unsupported', notes: `${WAVE}; must not be faked. Kind 16 wrappers are only string, number, and boolean` }),
  Object.freeze({ feature: 'bigint MAX_LIMBS resource limit', status: 'unsupported', notes: `${WAVE}; target outcome is resource-limit, not an unbounded result. No limb heap kind exists` }),
]);
