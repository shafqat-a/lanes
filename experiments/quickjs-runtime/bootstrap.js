import {arrayConcatSources} from './array-concat-source.js';
import {arrayFlattenSources} from './array-flatten-source.js';
import {arraySpliceSources} from './array-splice-source.js';
import {objectCopySources} from './object-copy-source.js';
import {prototypeSources,prototypeIntrinsics} from './prototype-source.js';
import {generatorDelegationSources} from './generator-delegation-source.js';
import {asyncGeneratorSources,asyncGeneratorPrivateBuiltins} from './async-generator-source.js';
import {promiseThenSources,promiseThenPrivateBuiltins} from './promise-then-source.js';
import { arrayFromSources, arrayFromIntrinsics } from './array-from-source.js';
import { phase3BigintPowSource, phase3BigintPowIntrinsics } from './phase3-bigint-pow.js';
import { bigintRelationalSource, bigintEqualitySource, bigintComparisonPrimitiveSource, phase3BigintComparisonIntrinsics } from './phase3-bigint-comparison.js';
import { phase3BigintWidthSources, phase3BigintWidthIntrinsics } from './phase3-bigint-width.js';
import { phase3BigintConversionSources, phase3BigintConversionIntrinsics } from './phase3-bigint-conversion-source.js';
import { jsonReviverNewIntrinsics } from './json-reviver-metadata.js';
import { stringCaseSources } from './string-case-source.js';
import { stringCaseNewIntrinsics } from './string-case-metadata.js';
import { arraySortSources } from './array-sort-source.js';
import { jsonStringifyMetadata, jsonStringifyNewIntrinsics } from './json-stringify-metadata.js';
import { jsonStringifySources } from './json-stringify-source.js';
import { arrayCopyMetadata } from './array-copy-metadata.js';
import { numberParseMetadata } from './number-parse-metadata.js';
import { jsonPhase5Metadata, jsonPhase5NewIntrinsics, jsonPhase5CodeUnitWGSL } from './json-phase5-metadata.js';
import { arrayCopySources } from './array-copy-source.js';
import { numberParseSources } from './number-parse-source.js';
import { jsonPhase5Sources } from './json-phase5-source.js';
import { arrayPhase5Sources } from './array-phase5-source.js';
import { stringPhase5Sources } from './string-phase5-source.js';
import { stringPhase5Metadata } from './string-phase5-metadata.js';
import { mathPhase5Sources } from './math-phase5-source.js';
import { stringExtractMetadata, stringExtractSources } from './string-extract-source.js';
import { numberPowSource } from './number-pow-source.js';
import { propertyKeyOperationSources } from './property-key-conversion-source.js';
import { stringSearchSources } from './string-search-source.js';
import { stringSearchMetadata } from './string-search-metadata.js';
import { objectOperationSources } from './object-operation-source.js';
import { arraySources } from './array-source.js';
import { numberTextSource } from './number-text-source.js';
import { textSource, errorSource, errorTextSource } from './error-source.js';
import { numberSource } from './number-source.js';
import { primitiveSource, relationalSource, equalitySource, additionSource } from './comparison-source.js';
import { boxingIntrinsics } from './boxing-metadata.js';
import { boxingSources } from './boxing-source.js';
import { phase4BootstrapSources, phase4PrivateBuiltins, protocolBootstrapSources } from './phase4-registry.js';
import { asyncIterationSources, asyncIterationPrivateBuiltins } from './async-iteration-source.js';
import { asyncFunctionSources, asyncFunctionPrivateBuiltins } from './async-function-source.js';
import { promiseJobSources, promiseJobPrivateBuiltins } from './promise-jobs-source.js';
import { promiseCombinatorsSources, promiseCombinatorsIntrinsics } from './promise-combinators-source.js';
import { promiseResolveSources, promiseResolveHelperNames } from './promise-resolve-source.js';
import { promiseCoreSources, promiseCoreIntrinsics } from './promise-core-source.js';
import { collectionIntrinsics } from './stdlib-ids.js';
import { stdlibBootstrapSources, stdlibNewIntrinsics } from './stdlib-registry.js';
// Adapted from engine262 a600354c2954300d62d108bf9ed3459a8e4a289b:
// src/intrinsics/Object.mts (Object_defineProperty),
// src/abstract-ops/spec-types.mts (ToPropertyDescriptor), and
// src/abstract-ops/type-conversion.mts (OrdinaryToPrimitive).
// Copyright (c) 2018 engine262 Contributors. See engine262-LICENSE.txt.
// This source is compiled, never evaluated by the host. QuickJS bytecode runs
// through the GPU VM, including getter calls and abrupt completions.
// Symbols and complete numeric-to-string conversion remain unsupported.
export const descriptorSource = `function definePropertyBootstrap(target, key, attributes) {
  "use strict";
  function object(value) {
    return value !== null && (typeof value === "object" || typeof value === "function");
  }
  if (!object(target)) throw new TypeError("Target is not an object");
  const name = __lanesToPropertyKey(key);
  const desc = __lanesToDescriptor(attributes);
  if (name === "length" && __lanesIsArray(target) && "value" in desc) {
    const value = desc.value;
    const length = __lanesNumber(value) >>> 0;
    if (length !== __lanesNumber(value)) throw new RangeError("Invalid array length");
    desc.value = length;
  }
  return __lanesDefine(target, name, desc);
}`;

export const privateBuiltins = Object.freeze({
  ...prototypeIntrinsics,
  ...phase3BigintPowIntrinsics,
  ...arrayFromIntrinsics,
  __lanesSymbolText:1003,
  ...promiseThenPrivateBuiltins,
  ...phase3BigintComparisonIntrinsics,
  ...jsonReviverNewIntrinsics,
  ...jsonPhase5NewIntrinsics,
  ...stringCaseNewIntrinsics,
  ...jsonStringifyNewIntrinsics,
  __lanesPow: 960, __lanesObjectToString: 155,
  __lanesUnsupported: 141, __lanesToDescriptor: 139, __lanesOwnKeys: 140, __lanesOwnDescriptor: 901, __lanesOwnHas: 902, __lanesToPropertyKey: 900,
  __lanesDefineProperty: 101, __lanesPreventExtensions: 108, __lanesIsExtensible: 109,
  __lanesArrayObject: 138, __lanesDefine: 110, __lanesText: 111, __lanesDescriptor: 112, __lanesCall: 113,
  __lanesApply: 114, __lanesLength: 115,
  __lanesBind: 116, __lanesBoundLength: 117, __lanesBoundMetadata: 118, __lanesHasOwnLength: 119,
  __lanesNumber: 122, __lanesFromBits: 123,
  __lanesArrayLengthStore: 126, __lanesIsArray: 201, __lanesPrimitive: 129, __lanesError: 133, __lanesToText: 134, __lanesNumberWord: 135,
  ...boxingIntrinsics,
  ...phase4PrivateBuiltins,
  ...promiseCoreIntrinsics,
  ...promiseResolveHelperNames,
  ...promiseCombinatorsIntrinsics,
  ...promiseJobPrivateBuiltins,
  ...asyncFunctionPrivateBuiltins,
  ...asyncGeneratorPrivateBuiltins,
  ...asyncIterationPrivateBuiltins,
  ...phase3BigintConversionIntrinsics,
  ...phase3BigintWidthIntrinsics,
  ...collectionIntrinsics,
  ...stdlibNewIntrinsics,
});

// Adapted from the same engine262 revision: FunctionPrototype.mts
// (FunctionProto_apply) and abstract-ops/object-operations.mts
// (CreateListFromArrayLike). Numeric length coercion is currently partial.
export const applySource = `function applyBootstrap(thisArg, argArray) {
  "use strict";
  const target = this;
  if (typeof target !== "function") throw new TypeError("Apply target is not callable");
  if (argArray === null || argArray === undefined) return __lanesCall(target, thisArg);
  if (typeof argArray !== "object" && typeof argArray !== "function") throw new TypeError("Apply arguments are not an object");
  const length = __lanesLength(__lanesNumber(argArray.length));
  const list = __lanesDescriptor();
  list.length = length;
  for (let i = 0; i < length; i++) list[i] = argArray[i];
  return __lanesApply(target, thisArg, list);
}`;

// FunctionProto_bind / BoundFunctionCreate from the same FunctionPrototype.mts.
export const bindSource = `function bindBootstrap(thisArg) {
  "use strict";
  const target = this;
  if (typeof target !== "function") throw new TypeError("Bind target is not callable");
  const list = __lanesDescriptor();
  const count = arguments.length > 0 ? arguments.length - 1 : 0;
  list.length = count;
  for (let i = 0; i < count; i++) list[i] = arguments[i + 1];
  const bound = __lanesBind(target, thisArg, list);
  let length = 0;
  if (__lanesHasOwnLength(target)) {
    const targetLength = target.length;
    if (typeof targetLength === "number") length = __lanesBoundLength(targetLength, count);
  }
  let name = target.name;
  if (typeof name !== "string") name = "";
  return __lanesBoundMetadata(bound, length, "bound " + name);
}`;

const arrayLengthSource = strict => `function arrayLengthBootstrap(value) {
  "use strict";
  const length = __lanesNumber(value) >>> 0;
  if (length !== __lanesNumber(value)) throw new RangeError("Invalid array length");
  return __lanesArrayLengthStore(this, length, ${strict});
}`;

export const bootstrapSources = Object.freeze({
  ...arrayFlattenSources,
  ...arraySpliceSources,
  ...prototypeSources,
  ...objectCopySources,
  ...arrayConcatSources,
  ...arrayFromSources,
  ...Object.fromEntries(jsonStringifyMetadata.map(m=>[m.field,jsonStringifySources[m.name]])),
  ...stringCaseSources,...arraySortSources,...arrayCopySources,...numberParseSources,
  ...Object.fromEntries(jsonPhase5Metadata.map(m=>[m.field,jsonPhase5Sources[m.name]])),
  ...arrayPhase5Sources, ...mathPhase5Sources,
  ...Object.fromEntries(stringPhase5Metadata.map(m=>[m.field,stringPhase5Sources[m.name]])),
  ...arraySources, ...objectOperationSources, ...propertyKeyOperationSources, ...boxingSources,
  ...Object.fromEntries(stringExtractMetadata.map(({name,field})=>[field,stringExtractSources[name]])),
  ...Object.fromEntries(stringSearchMetadata.map(({name, field}) => [field, stringSearchSources[name]])),
  defineProperty: descriptorSource, apply: applySource, bind: bindSource, toNumber: numberSource,
  toPrimitive: primitiveSource, relational: bigintRelationalSource, equality: bigintEqualitySource, addition: additionSource,
  comparisonToPrimitive: bigintComparisonPrimitiveSource,
  numericPow: phase3BigintPowSource,
  stringCall: `function stringBootstrap(value) {
    if (arguments.length === 0) return "";
    if (typeof value === "symbol") return __lanesCall(__lanesSymbolText,value);
    return __lanesToText(value);
  }`,
  numberText: numberTextSource, numberPow: numberPowSource,
  toText: textSource, errorCreate: errorSource, errorText: errorTextSource,
  binaryNumber: `function binaryNumberBootstrap(left, right, operation) {
    const a = __lanesNumber(left);
    const b = __lanesNumber(right);
    if (operation === 0) return a - b;
    if (operation === 1) return a * b;
    if (operation === 2) return a / b;
    if (operation === 3) return a % b;
    if (operation === 4) return a & b;
    if (operation === 5) return a | b;
    if (operation === 6) return a ^ b;
    if (operation === 7) return a << b;
    if (operation === 8) return a >> b;
    return a >>> b;
  }`,
  unaryNumber: `function unaryNumberBootstrap(value, operation) {
    const number = __lanesNumber(value);
    if (operation === 0) return +number;
    if (operation === 1) return -number;
    if (operation === 3) return number + 1;
    if (operation === 4) return number - 1;
    return ~number;
  }`,
  arrayLengthSet: arrayLengthSource(false), arrayLengthSetStrict: arrayLengthSource(true),
  ...phase4BootstrapSources,
  ...phase3BigintConversionSources,
  ...phase3BigintWidthSources,
  ...protocolBootstrapSources,
  ...generatorDelegationSources,
  ...asyncIterationSources,
  ...asyncGeneratorSources,
  ...asyncFunctionSources,
  ...promiseJobSources,
  ...promiseCombinatorsSources,
  ...promiseThenSources,
  ...promiseResolveSources,
  ...promiseCoreSources,
  ...stdlibBootstrapSources,
});

export function attachBootstrap(raw, bootstraps) {
  if (raw.error) throw new SyntaxError(raw.error);
  const functions = [...raw.functions], bootstrapFunctions = {};
  for (const [field, bootstrap] of Object.entries(bootstraps)) {
    if (bootstrap.error) throw new SyntaxError(bootstrap.error);
    if (raw.format !== bootstrap.format || raw.quickjs !== bootstrap.quickjs || String(raw.features) !== String(bootstrap.features)) throw new Error('Bootstrap compiler revision mismatch');
    const offset = functions.length;
    bootstrapFunctions[field] = offset;
    functions.push(...bootstrap.functions.map((fn, index) => ({
      ...fn, intrinsicRoot: index === 0, hasPrototype: 0,
      constants: fn.constants.map(c => 'function' in c ? { ...c, function: c.function + offset } : c),
    })));
  }
  return { ...raw, functions, bootstrapFunctions };
}
