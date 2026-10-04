// Guest helpers for QuickJS synchronous yield* opcodes. Generic for_of_start
// supplies its internal IteratorRecord; cached next and iterator identities must
// be used directly (a yield* next supplies one argument, including undefined).
export const generatorDelegationSources=Object.freeze({
 generatorIteratorNext:`function generatorIteratorNextBootstrap(record,value){
  "use strict";
  return __lanesCall(record.next,record.iterator,value);
 }`,
 generatorIteratorCall:`function generatorIteratorCallBootstrap(record,value,flags){
  "use strict";
  const iterator=record.iterator;
  const method=flags&1?iterator.throw:iterator.return;
  const result=__lanesDescriptor();
  if(method===null||method===undefined){result.value=value;result.done=true;return result;}
  result.value=flags&2?__lanesCall(method,iterator):__lanesCall(method,iterator,value);
  result.done=false;return result;
 }`,
});
export const generatorDelegationBuiltinFields=Object.freeze({2504:'generatorIteratorNext',2505:'generatorIteratorCall'});
export const generatorDelegationOpcodes=Object.freeze(['iterator_next','iterator_call','iterator_check_object']);
export function generatorDelegationLowering(op,instruction){
 if(op==='iterator_call'){
  if(!Number.isInteger(instruction.operand)||instruction.operand<0||instruction.operand>3)throw new SyntaxError('Invalid generator iterator_call flags');
  return {op,a:instruction.operand,b:0};
 }
 if(generatorDelegationOpcodes.includes(op))return {op,a:0,b:0};
 return null;
}
export const generatorDelegationContinuations=({F})=>[{code:104,body:`
  let value=getProperty(l,returned,fieldKey(${F.value}u));
  let missing=getProperty(l,returned,fieldKey(${F.done}u));
  if(states[l].status==0u){push(l,value);push(l,missing);}
`}];
export const generatorDelegationCasesWGSL=({L})=>({
 iterator_check_object:'let value=peek(l);if(value.z!=4u&&value.z!=5u&&value.z!=11u){states[l].status=4u;}',
 iterator_next:`if(states[l].sp<states[l].frames[states[l].depth].base+4u){states[l].status=2u;break;}
  let value=pop(l);let record=states[l].stack[states[l].sp-3u];
  if(states[l].sp+3u>${L.stack}u){states[l].status=3u;break;}
  push(l,V(2504u,0u,11u,0u));push(l,record);push(l,value);call(l,2u,false,false);`,
 iterator_call:`if(states[l].sp<states[l].frames[states[l].depth].base+4u){states[l].status=2u;break;}
  let value=pop(l);let record=states[l].stack[states[l].sp-3u];
  if(states[l].sp+4u>${L.stack}u){states[l].status=3u;break;}
  push(l,V(2505u,0u,11u,0u));push(l,record);push(l,value);push(l,num(fromUnsigned(arg)));
  let depth=states[l].depth;call(l,3u,false,false);
  if(states[l].status==0u){if(states[l].depth>depth){states[l].frames[states[l].depth].tail=104u;}else{states[l].status=2u;}}`,
});
