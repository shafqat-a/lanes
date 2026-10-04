// Global identifier References retain their resolved/unresolvable base from
// evaluation until GetValue/PutValue. The two stack slots survive callbacks,
// suspended dispatches and GC through the normal operand-stack root tracing.
export const globalReferenceOpcodes = Object.freeze([
  'make_global_ref', 'get_global_ref_value', 'put_global_ref_value',
  'make_local_ref', 'make_argument_ref', 'make_capture_ref',
]);
export function globalReferenceLowering(op, instruction, { text }) {
  if (op === 'make_var_ref') {
    if (typeof instruction.operand !== 'string') throw new SyntaxError('Invalid global reference atom');
    return { op: 'make_global_ref', a: text(instruction.operand), b: 0 };
  }
  if (['make_loc_ref', 'make_arg_ref', 'make_var_ref_ref'].includes(op)) {
    const index=instruction.bytes[5]|(instruction.bytes[6]<<8);
    if(instruction.referenceConst!==0&&instruction.referenceConst!==1)throw new Error('Rebuild compiler: reference binding metadata missing');
    return {op:({make_loc_ref:'make_local_ref',make_arg_ref:'make_argument_ref',make_var_ref_ref:'make_capture_ref'})[op],a:index,b:instruction.referenceConst};
  }
  if (op === 'get_ref_value') return { op: 'get_global_ref_value', a: 0, b: 0 };
  if (op === 'put_ref_value') return { op: 'put_global_ref_value', a: 0, b: 0 };
  return null;
}
export const globalReferenceWGSLCases = () => ({
  ...Object.fromEntries(['make_local_ref','make_argument_ref','make_capture_ref'].map((name,index)=>[name,
    `let binding=cell(l,states[l].env,arg+${index===0?'16u':'0u'},${index===2?'true':'false'});if(states[l].status!=0u){break;}
     push(l,V(binding,ins.z,4u,0u));push(l,undef());`])),
  make_global_ref: `if(!globalMode()){states[l].status=2u;break;}
    let resolved=globalHas(l,arg);if(states[l].status!=0u){break;}
    if(resolved){push(l,V(GLOBAL_OBJECT,0u,4u,0u));}else{push(l,undef());}
    push(l,image[arg]);`,
  get_global_ref_value: `if(states[l].sp<2u){states[l].status=2u;break;}
    let referenceBase=states[l].stack[states[l].sp-2u];
    if(referenceBase.z==4u&&states[l].heap[referenceBase.x].kind==1u){
      let value=states[l].heap[referenceBase.x].value;
      if(value.z==6u){states[l].status=5u;}else{push(l,value);}break;
    }
    if(referenceBase.z==3u){states[l].status=5u;break;}
    if(referenceBase.z!=4u||states[l].heap[referenceBase.x].kind!=2u){states[l].status=2u;break;}
    let referenceKey=keyOf(l,peek(l));if(states[l].status!=0u){break;}
    if(referenceBase.x==GLOBAL_OBJECT&&!globalHas(l,referenceKey)){
      if(states[l].status==0u){if(strictCode(l)){states[l].status=5u;}else{push(l,undef());}}break;
    }
    let value=getProperty(l,referenceBase,referenceKey);if(states[l].status!=0u){break;}
    if(value.z==12u){push(l,referenceBase);push(l,callbackValue(value.x));call(l,0u,true,false);}else{push(l,value);}`,
  put_global_ref_value: `let value=pop(l);let referenceName=pop(l);let referenceBase=pop(l);
    if(referenceBase.z==4u&&states[l].heap[referenceBase.x].kind==1u){
      if(states[l].heap[referenceBase.x].value.z==6u){states[l].status=5u;break;}
      if(referenceBase.y!=0u||(states[l].heap[referenceBase.x].marked&IMMUTABLE_GLOBAL_CELL)!=0u){states[l].status=4u;break;}
      states[l].heap[referenceBase.x].value=value;break;
    }
    if(referenceBase.z==3u&&strictCode(l)){states[l].status=5u;break;}
    if(referenceBase.z!=3u&&(referenceBase.z!=4u||states[l].heap[referenceBase.x].kind!=2u)){states[l].status=2u;break;}
    let referenceKey=keyOf(l,referenceName);if(states[l].status!=0u){break;}
    if(strictCode(l)&&(referenceBase.z==3u||referenceBase.x==GLOBAL_OBJECT)&&!globalHas(l,referenceKey)){if(states[l].status==0u){states[l].status=5u;}break;}
    if(states[l].status!=0u){break;}
    var globalObject=referenceBase;if(referenceBase.z==3u){globalObject=V(GLOBAL_OBJECT,0u,4u,0u);}
    let pending=putProperty(l,globalObject,referenceKey,value,false);
    if(pending.z==12u){push(l,globalObject);push(l,callbackValue(pending.x));push(l,value);let depth=states[l].depth;call(l,1u,true,false);
      if(states[l].status==0u){if(states[l].depth>depth){states[l].frames[states[l].depth].tail=2u;}else{let ignored=pop(l);}}}`,
});
