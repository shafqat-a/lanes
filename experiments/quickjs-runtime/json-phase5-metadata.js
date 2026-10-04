export const jsonPhase5Metadata=Object.freeze([Object.freeze({name:'parse',id:1740,length:2,field:'jsonParse'})]);
// NEW private runtime dependency. Input is an already validated integer code
// unit0..65535; output is one UTF-16 code unit, including an unpaired surrogate.
// Must allocate guest text normally, never call a host character constructor.
export const jsonPhase5NewIntrinsics=Object.freeze({__lanesCodeUnit:1770});
export const jsonPhase5Intrinsics=Object.freeze({__lanesPrimitive:129,__lanesText:111,__lanesNumber:122,__lanesUnsupported:141,__lanesCharCodeAt:931,__lanesSlice:933,__lanesDefineProperty:101,__lanesCodeUnit:1770});
export const jsonPhase5Gaps=Object.freeze([
 'Callable revivers use ES2025 postorder traversal with exactly two callback arguments. Newer reviver source-context arguments are outside this target; guest resource and unsupported-operation boundaries remain explicit.',
 'JSON.stringify has a separate implementation and conformance suite. Symbols, BigInt and custom Symbol.toPrimitive follow separately declared conversion capabilities.',
 'Guest input/output string, heap, recursion/frame and execution limits remain explicit resource limits, not JSON SyntaxError.',
]);
// Paste into objectMethod(l,id,receiver,original,b,c) before its generic
// unsupported-id branch. Registration in privateBuiltins and a rooted JSON
// global plus normal metadata/call routing are coordinator-owned.
export const jsonPhase5CodeUnitWGSL=String.raw`
if(id==1770u){
  if(original.z!=0u){states[l].status=6u;return undef();}
  let codeUnit=toBits(original.xy);
  if(codeUnit>65535u||!equalNumber(fromUnsigned(codeUnit),original.xy)){states[l].status=6u;return undef();}
  let textNode=alloc(l,10u,V(codeUnit,0u,0u,0u),1u,0u);
  return V(textNode,1u,7u,0u);
}`;
