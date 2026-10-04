// Promise + async wave, worker 3: Promise.prototype.then / catch / finally,
// PerformPromiseThen, NewPromiseReactionJob body and SpeciesConstructor.
// ES2025 27.2.5.1 catch, 27.2.5.3 finally, 27.2.5.4 then, 27.2.5.4.1
// PerformPromiseThen, 27.2.2.1 NewPromiseReactionJob, 7.3.22 SpeciesConstructor.
//
// Guest sources below are strict bootstrap helpers compiled by QuickJS
// (intrinsic roots) and executed by the WGSL VM. The WGSL strings are two tiny
// intrinsics (the @@species symbol value and IsConstructor), function
// metadata and Promise.prototype installation. Nothing here runs guest
// semantics on the host. This module never writes files; the parent composes
// `promiseThenIntegrationEdits` in promise-integration-patch.js.
import { PROMISE_IDS, PROMISE_NODES, PROMISE_HELPER_RANGES, PROMISE_INTRINSIC_RANGES } from './promise-ids.js';

// Well-known symbol cells are nodes 31.. in phase3WellKnownNames order
// ('asyncIterator','hasInstance','isConcatSpreadable','iterator','match',
// 'matchAll','replace','search','species',...): species = 31 + 8 = 39.
// check-promise-then.mjs asserts this against phase3-values.js.
export const SPECIES_SYMBOL_NODE = 39;

export const PROMISE_THEN_IDS = Object.freeze({
  then: PROMISE_IDS.then,          // 2802 Promise.prototype.then
  catch: PROMISE_IDS.catch,        // 2803 Promise.prototype.catch
  finally: PROMISE_IDS.finally,    // 2804 Promise.prototype.finally
  performThen: 2830,               // __promisePerformThen(promise, onFulfilled, onRejected, capability)
  reactionJob: 2831,               // __promiseReactionJob(reaction, argument)
  speciesConstructor: 2832,        // __promiseSpeciesConstructor(O, defaultConstructor)
  speciesSymbol: 2855,             // WGSL: __lanesSpeciesSymbol() -> Symbol.species (cell 39)
  isConstructor: 2856,             // WGSL: __lanesSpeciesIsConstructor(v) -> boolean, never throws
                                   // (distinct from worker 1's __lanesPromiseIsConstructor 2847, see notes)
});
// 2833, 2834 (helpers) and 2857..2859 (intrinsics) stay unused.

// ---------------------------------------------------------------- guest --
// Guest-visible dependency names (owned by other workers, resolved through
// bootstrap privateBuiltins by the parent): __promiseNewCapability 2821,
// __promiseResolve 2827, __lanesPromiseState 2841, __lanesPromiseResult 2842,
// __lanesPromiseAddReaction 2844, __lanesPromiseMarkHandled 2845,
// __lanesPromiseIsHandled 2846, __lanesEnqueueJob 2910; existing
// __lanesCall 113 and __lanesDescriptor 112 (null-prototype object).

// 7.3.22 SpeciesConstructor(O, defaultConstructor). Get(O,"constructor") is
// performed exactly once; Get(C, @@species) is an ordinary guest property read
// keyed by the real well-known symbol (accessors run as guest calls).
const speciesConstructorSource = `function promiseSpeciesConstructorBootstrap(O, defaultConstructor) {
  "use strict";
  const C = O.constructor;
  if (C === undefined) return defaultConstructor;
  if (C === null || (typeof C !== "object" && typeof C !== "function")) throw new TypeError("object.constructor is not an object");
  const S = C[__lanesSpeciesSymbol()];
  if (S === undefined || S === null) return defaultConstructor;
  if (__lanesSpeciesIsConstructor(S)) return S;
  throw new TypeError("object.constructor[Symbol.species] is not a constructor");
}`;

// 27.2.5.4 Promise.prototype.then(onFulfilled, onRejected).
const thenSource = `function promiseThenBootstrap(onFulfilled, onRejected) {
  "use strict";
  const promise = this;
  if (__lanesPromiseState(promise) < 0) throw new TypeError("Method Promise.prototype.then called on incompatible receiver");
  const C = __promiseSpeciesConstructor(promise, __lanesPromiseIntrinsic);
  const capability = __promiseNewCapability(C);
  return __promisePerformThen(promise, onFulfilled, onRejected, capability);
}`;

// 27.2.5.1 Promise.prototype.catch(onRejected): Invoke(promise, "then", ...).
// Generic: no brand check, the receiver's (possibly patched) then is used and
// a primitive receiver reads through ToObject (strict get_field semantics).
const catchSource = `function promiseCatchBootstrap(onRejected) {
  "use strict";
  return this.then(undefined, onRejected);
}`;

// 27.2.5.3 Promise.prototype.finally(onFinally). thenFinally/catchFinally are
// anonymous arrow closures passed directly as call arguments (no
// NamedEvaluation): name "", length 1, no [[Construct]], no prototype —
// matching CreateBuiltinFunction(..., 1, "", « »). valueThunk/thrower likewise
// have length 0 and name "". Private names resolve only in the intrinsic root
// scope, so __promiseResolve is bound to a root local before the arrows close
// over it (check-promise-then.mjs rejects private names in nested functions).
const finallySource = `function promiseFinallyBootstrap(onFinally) {
  "use strict";
  const promise = this;
  if (promise === null || (typeof promise !== "object" && typeof promise !== "function")) throw new TypeError("Method Promise.prototype.finally called on a non-object");
  const C = __promiseSpeciesConstructor(promise, __lanesPromiseIntrinsic);
  if (typeof onFinally !== "function") return promise.then(onFinally, onFinally);
  const promiseResolve = __promiseResolve;
  return promise.then(value => {
    const result = onFinally();
    const p = promiseResolve(C, result);
    return p.then(() => value);
  }, reason => {
    const result = onFinally();
    const p = promiseResolve(C, result);
    return p.then(() => { throw reason; });
  });
}`;

// 27.2.5.4.1 PerformPromiseThen(promise, onFulfilled, onRejected, resultCapability).
// Reaction record = null-prototype object {capability, type (0 fulfill / 1
// reject), handler (callable or undefined)} (contract "Reactions").
const performThenSource = `function promisePerformThenBootstrap(promise, onFulfilled, onRejected, capability) {
  "use strict";
  const state = __lanesPromiseState(promise);
  if (state < 0) throw new TypeError("PerformPromiseThen requires a promise");
  if (typeof onFulfilled !== "function") onFulfilled = undefined;
  if (typeof onRejected !== "function") onRejected = undefined;
  const fulfillReaction = __lanesDescriptor();
  fulfillReaction.capability = capability;
  fulfillReaction.type = 0;
  fulfillReaction.handler = onFulfilled;
  const rejectReaction = __lanesDescriptor();
  rejectReaction.capability = capability;
  rejectReaction.type = 1;
  rejectReaction.handler = onRejected;
  if (state === 0) {
    __lanesPromiseAddReaction(promise, fulfillReaction, rejectReaction);
  } else if (state === 1) {
    __lanesEnqueueJob(1, fulfillReaction, __lanesPromiseResult(promise), undefined);
  } else {
    if (!__lanesPromiseIsHandled(promise)) {
      // HostPromiseRejectionTracker(promise, "handle"): this host has no
      // rejection tracker, so the operation is an intentional no-op.
    }
    __lanesEnqueueJob(1, rejectReaction, __lanesPromiseResult(promise), undefined);
  }
  __lanesPromiseMarkHandled(promise);
  if (capability === undefined) return undefined;
  return capability.promise;
}`;

// 27.2.2.1 NewPromiseReactionJob job body (job type 1, run by worker 7's
// 2911 runner). The spec asserts handlerResult is not abrupt when the
// capability is undefined (Await / async-from-sync closures never throw);
// a violation is rethrown so it surfaces as an uncaught job exception
// (status 7) instead of being silently dropped.
const reactionJobSource = `function promiseReactionJobBootstrap(reaction, argument) {
  "use strict";
  const capability = reaction.capability;
  const type = reaction.type;
  const handler = reaction.handler;
  let handlerResult = argument;
  let abrupt = false;
  if (handler === undefined) {
    abrupt = type !== 0;
  } else {
    try {
      handlerResult = __lanesCall(handler, undefined, argument);
    } catch (error) {
      handlerResult = error;
      abrupt = true;
    }
  }
  if (capability === undefined) {
    if (abrupt) throw handlerResult;
    return undefined;
  }
  if (abrupt) return __lanesCall(capability.reject, undefined, handlerResult);
  return __lanesCall(capability.resolve, undefined, handlerResult);
}`;

// Bootstrap field name -> source (spread into bootstrap.js bootstrapSources).
export const promiseThenSources = Object.freeze({
  promiseThen: thenSource,
  promiseCatch: catchSource,
  promiseFinally: finallySource,
  promisePerformThen: performThenSource,
  promiseReactionJob: reactionJobSource,
  promiseSpeciesConstructor: speciesConstructorSource,
});

// Public methods (installed on %Promise.prototype%, node 91) and private
// helpers. `field` is the bootstrap field the call() dispatch maps the id to.
export const promiseThenMetadata = Object.freeze([
  Object.freeze({ id: PROMISE_THEN_IDS.then, name: 'then', length: 2, field: 'promiseThen', owner: 'Promise.prototype' }),
  Object.freeze({ id: PROMISE_THEN_IDS.catch, name: 'catch', length: 1, field: 'promiseCatch', owner: 'Promise.prototype' }),
  Object.freeze({ id: PROMISE_THEN_IDS.finally, name: 'finally', length: 1, field: 'promiseFinally', owner: 'Promise.prototype' }),
]);
export const promiseThenHelpers = Object.freeze([
  Object.freeze({ id: PROMISE_THEN_IDS.performThen, name: '__promisePerformThen', field: 'promisePerformThen' }),
  Object.freeze({ id: PROMISE_THEN_IDS.reactionJob, name: '__promiseReactionJob', field: 'promiseReactionJob' }),
  Object.freeze({ id: PROMISE_THEN_IDS.speciesConstructor, name: '__promiseSpeciesConstructor', field: 'promiseSpeciesConstructor' }),
]);

// Names this module adds to bootstrap privateBuiltins (intrinsic roots only).
// __lanesPromiseIntrinsic resolves to the tag-11 %Promise% value (id 2800),
// so the default constructor never goes through a mutable global lookup.
export const promiseThenPrivateBuiltins = Object.freeze({
  __promisePerformThen: PROMISE_THEN_IDS.performThen,
  __promiseReactionJob: PROMISE_THEN_IDS.reactionJob,
  __promiseSpeciesConstructor: PROMISE_THEN_IDS.speciesConstructor,
  __lanesSpeciesSymbol: PROMISE_THEN_IDS.speciesSymbol,
  __lanesSpeciesIsConstructor: PROMISE_THEN_IDS.isConstructor,
  __lanesPromiseIntrinsic: PROMISE_IDS.ctor,
});

// Names the helpers call that other owners must register (contract ids).
export const promiseThenDependencies = Object.freeze({
  __promiseNewCapability: 2821,    // worker 1
  __promiseResolve: 2827,          // worker 2
  __lanesPromiseState: 2841,       // worker 1
  __lanesPromiseResult: 2842,      // worker 1
  __lanesPromiseAddReaction: 2844, // worker 1
  __lanesPromiseMarkHandled: 2845, // worker 1
  __lanesPromiseIsHandled: 2846,   // worker 1
  __lanesEnqueueJob: 2910,         // worker 7
  __lanesCall: 113,                // existing
  __lanesDescriptor: 112,          // existing (null-prototype ordinary object)
});

// FIELDS additions (append-only; program.js pushes names that are absent).
export const promiseThenFields = Object.freeze([
  ...promiseThenMetadata.map(m => m.name),
  ...Object.keys(promiseThenSources),
]);

// ----------------------------------------------------------------- WGSL --
// Module-scope function. IsConstructor (ES2025 7.2.4): bound functions follow
// their target; %Promise% (2800), Symbol (1000), BigInt (1150), Map (2200) and
// Set (2220) have [[Construct]]; generator / async closures (function-info bits
// 18/19) never do even though generators carry a prototype; everything else is
// phase4-classes.js classIsConstructor.
export const promiseThenWGSLFunctions = ({ L }) => `
fn promiseThenIsConstructor(l:u32,value:V)->bool {
  var v=value;
  for(var i=0u;i<${L.frames}u&&v.z==5u&&states[l].heap[v.x].kind==12u;i++){let bound=states[l].heap[v.x].value;v=V(bound.x,0u,bound.z,0u);}
  if(v.z==11u&&(v.x==${PROMISE_IDS.ctor}u||v.x==1000u||v.x==1150u||v.x==2200u||v.x==2220u)){return true;}
  if(v.z==5u&&states[l].heap[v.x].kind==5u&&(image[states[l].heap[v.x].value.x*2u].w&0xc0000u)!=0u){return false;}
  return classIsConstructor(l,v);
}
`;

// objectMethod prelude (ids reach objectMethod only when call() did not map
// them to a bootstrap helper). 119 = __lanesHasOwnLength (bind of then/catch/finally).
export const promiseThenObjectMethodWGSL = `if(id==${PROMISE_THEN_IDS.speciesSymbol}u){return V(${SPECIES_SYMBOL_NODE}u,0u,17u,0u);}
  if(id==${PROMISE_THEN_IDS.isConstructor}u){return boolean(promiseThenIsConstructor(l,original));}
  if(id==119u&&original.z==11u&&original.x>=${PROMISE_THEN_IDS.then}u&&original.x<=${PROMISE_THEN_IDS.finally}u){return boolean(true);}`;

// call() dispatch: tag-11 id -> bootstrap field (same shape as phase5Methods).
export const promiseThenDispatchWGSL = ({ F }) => [...promiseThenMetadata, ...promiseThenHelpers]
  .map(m => { if (!(m.field in F)) throw new Error(`promise-then: FIELDS lacks ${m.field}`); return `if(fnValue.x==${m.id}u){field=${F[m.field]}u;}`; })
  .join('\n    ');

// getProperty on the tag-11 method values: own name/length; every other key is
// looked up on %Function.prototype% (node 3) by the ordinary walk that follows.
export const promiseThenPropertyWGSL = ({ F }) => {
  for (const m of promiseThenMetadata) if (!(m.name in F)) throw new Error(`promise-then: FIELDS lacks ${m.name}`);
  const [t, c, f] = promiseThenMetadata;
  return `if(obj.z==11u&&obj.x>=${t.id}u&&obj.x<=${f.id}u){
    if(field(l,key,${F.name}u)){var methodName=${F[t.name]}u;if(obj.x==${c.id}u){methodName=${F[c.name]}u;}if(obj.x==${f.id}u){methodName=${F[f.name]}u;}return image[fieldKey(methodName)];}
    if(lengthKey(l,key)){var methodLength=${t.length}u;if(obj.x!=${t.id}u){methodLength=${c.length}u;}return num(fromUnsigned(methodLength));}
    obj=V(3u,0u,4u,0u);
  }`;
};

// main() init, after worker 1 has written node 91 in place. A misordered
// composition fails loudly (status 2) instead of losing the properties.
// Flags 5 = writable, non-enumerable, configurable (ES2025 clause 18).
export const promiseThenInitWGSL = ({ F }) => [
  `if(states[l].heap[${PROMISE_NODES.promiseProto}u].kind!=2u){states[l].status=2u;}`,
  ...promiseThenMetadata.map(m => `dataProperty(l,${PROMISE_NODES.promiseProto}u,fieldKey(${F[m.name]}u),V(${m.id}u,0u,11u,0u),5u);`),
].join('\n    ');

// ------------------------------------------------------ integration edits --
// Anchors are exact, unique substrings of generatorIntegrationPatch(live,
// {iteratorPrototypeNode:77}) output (verified by check-promise-then.mjs).
// Every insertion is 'before'/'after' and independent of other workers' text,
// except E11, which must follow worker 1's node-91 initialization (guarded).
export const promiseThenIntegrationEdits = Object.freeze([
  { file: 'program.js', anchor: "import {generatorFields,GENERATOR_KIND_BIT} from './generator-source.js';\n", position: 'after',
    text: "import {promiseThenFields} from './promise-then-source.js';\n", why: 'FIELDS additions' },
  { file: 'program.js', anchor: 'export const FIELDS =', position: 'before',
    text: 'for(const name of promiseThenFields)if(!fieldNames.includes(name))fieldNames.push(name);\n', why: 'append then/catch/finally names and helper fields (append-only)' },
  { file: 'bootstrap.js', anchor: "import {generatorDelegationSources} from './generator-delegation-source.js';\n", position: 'after',
    text: "import {promiseThenSources,promiseThenPrivateBuiltins} from './promise-then-source.js';\n", why: 'guest helper sources' },
  { file: 'bootstrap.js', anchor: '  __lanesSymbolText:1003,', position: 'after',
    text: '\n  ...promiseThenPrivateBuiltins,', why: 'private names for 2830/2831/2832/2855/2856 and %Promise% (2800)' },
  { file: 'bootstrap.js', anchor: '  ...generatorDelegationSources,', position: 'after',
    text: '\n  ...promiseThenSources,', why: 'compile helpers as intrinsic roots' },
  { file: 'shader.js', anchor: "import {generatorGCWGSL,generatorClosureWGSL,generatorInitWGSL,generatorMetadata} from './generator-source.js';\n", position: 'after',
    text: "import {promiseThenWGSLFunctions,promiseThenObjectMethodWGSL,promiseThenDispatchWGSL,promiseThenPropertyWGSL,promiseThenInitWGSL} from './promise-then-source.js';\n", why: 'WGSL builders' },
  { file: 'shader.js', anchor: '  if(obj.z==11u&&obj.x==2000u){', position: 'before',
    text: '  ${promiseThenPropertyWGSL({F})}\n', why: 'then/catch/finally name+length; other keys inherit from Function.prototype' },
  { file: 'shader.js', anchor: '    if(fnValue.x==960u){field=${F.numberPow}u;}', position: 'after',
    text: '\n    ${promiseThenDispatchWGSL({F})}', why: 'tag-11 ids 2802..2804, 2830..2832 -> bootstrap helpers' },
  { file: 'shader.js', anchor: 'fn instanceOf(l:u32,value:V,original:V)->V {', position: 'before',
    text: '${promiseThenWGSLFunctions({L})}\n', why: 'IsConstructor for SpeciesConstructor' },
  { file: 'shader.js', anchor: '  var id=method;if(id==901u){id=102u;}if(id==902u){id=107u;}\n  let a=objectView(l,original);', position: 'after',
    text: '\n  ${promiseThenObjectMethodWGSL}', why: 'intrinsics 2855 (@@species symbol) and 2856 (IsConstructor); HasOwnLength for bind' },
  { file: 'shader.js', anchor: '    if(states[l].result.z==18u){states[l].result=materialize_bigint(l,states[l].result.x);}', position: 'before',
    text: '    ${promiseThenInitWGSL({F})}\n', why: 'install then/catch/finally on %Promise.prototype% (node 91) after worker 1 initializes it' },
]);

export function applyPromiseThenEdits(files, edits = promiseThenIntegrationEdits) {
  const out = { ...files };
  for (const e of edits) {
    const s = out[e.file];
    if (typeof s !== 'string' || s.split(e.anchor).length !== 2) throw new Error(`promise-then anchor drift: ${e.file}: ${e.anchor.slice(0, 80)}`);
    out[e.file] = s.replace(e.anchor, () => e.position === 'before' ? e.text + e.anchor : e.position === 'after' ? e.anchor + e.text : e.text);
  }
  return out;
}

// ----------------------------------------------------------------- gaps --
export const promiseThenGaps = Object.freeze([
  'Symbol.species: SpeciesConstructor performs the real Get(C, @@species) with the well-known symbol value from intrinsic 2855 (cell 39), so user constructors without a species, species = undefined/null, a constructor species and a non-constructor species are all exact. No path of then/catch/finally uses __lanesUnsupported. Boundaries inherited from the core: (a) guest code cannot spell Symbol.species (node-26 prototypeGap -> status 6) until the parent exposes it; it can only obtain the symbol via Object.getOwnPropertySymbols(Promise) once worker 4 installs get [@@species] (2812) on node 90; (b) Get(%Promise%, @@species) needs worker 1 objectView(V(2800,11)) <-> node 90 — without worker 4 the property is absent and the default %Promise% is (correctly) returned; (c) a tag-11 constructor whose getProperty is not mapped by the core (e.g. p.constructor = Array.prototype.push) reaches the existing status-6 getProperty boundary, never a wrong value.',
  'IsConstructor (2856) knows %Promise%, Symbol, BigInt, Map, Set and classIsConstructor builtins; a later constructor builtin (e.g. AggregateError from worker 4) must be added to promiseThenIsConstructor or species of that value is a TypeError.',
  'HostPromiseRejectionTracker is a documented no-op (no host tracker); [[PromiseIsHandled]] is still read and set exactly as specified.',
  'A job whose capability.resolve/reject throws (custom species capability executors) is an uncaught job exception -> status 7 per the worker-7 contract (spec: HostReportErrors, queue continues).',
  'then/catch/finally are tag-11 values without backing nodes: own keys are name/length only through getProperty; Object.getOwnPropertyNames/defineProperty/delete on them and Function.prototype.toString of them keep the existing builtin-function status-6 boundary.',
  'Property creation order on %Promise.prototype% follows dataProperty insertion (implementation-defined in ES2025).',
]);
