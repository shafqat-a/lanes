export const jsonStringifyMetadata=Object.freeze([{name:'stringify',id:1820,length:3,field:'jsonStringify'}]);
export const jsonStringifyNewIntrinsics=Object.freeze({__lanesJSONWrapperKind:1821,__lanesJSONWrapperValue:1822});
// Both are side-effect-free, inspect internal slots, and never invoke user code.
// Kind: 0 ordinary/non-wrapper, 1 [[NumberData]], 2 [[StringData]],
// 3 [[BooleanData]], 4 [[BigIntData]]. Include intrinsic wrapper prototypes.
// Value: unwrap kind-16 holder.value, currently used only for BooleanData;
// invalid input must exit Unsupported, not forge a primitive.
export const jsonStringifyIntrinsics=Object.freeze({
 ...jsonStringifyNewIntrinsics,__lanesPrimitive:129,__lanesText:111,
 __lanesNumber:122,__lanesUnsupported:141,__lanesCharCodeAt:931,
 __lanesSlice:933,__lanesDefineProperty:101,__lanesDescriptor:112,
 __lanesCall:113,__lanesIsArray:201,__lanesOwnKeys:140,
});
export const jsonStringifyGaps=Object.freeze([
 'Symbol and BigInt JSON rules use admitted primitive and wrapper operations; Proxy behavior depends on the runtime admission boundary. No host fallback.',
 'JSON.rawJSON proposal is outside the ECMAScript 2025 target and is not implemented.',
 'Guest text/heap/frame/instruction limits remain explicit engine resource completions; cycles specifically throw guest TypeError.',
 'Number decimal formatting inherits the runtime ToString(Number) implementation and its explicit supported bounds.',
]);
