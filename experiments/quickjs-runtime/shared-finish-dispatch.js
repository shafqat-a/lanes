// Final WGSL generation pass: one physical completion path, preserving the
// original finish -> call post-action -> error/job checkpoint ordering.
export const sharedFinishRequestWGSL=`
struct FinishRequest {pending:u32,value:V}
var<private> finishRequest:FinishRequest;
fn requestFinish(l:u32,value:V) {
  if(states[l].status!=0u){return;}
  if(finishRequest.pending!=0u){states[l].status=2u;return;}
  finishRequest=FinishRequest(1u,value);
}
`;
export function shareFinishDispatch(original){
 let shader=original;
 function replace(label,a,b,count=1){const found=shader.split(a).length-1;if(found!==count)throw new Error(`Shared finish dispatch drift: ${label}: expected ${count}, got ${found}`);shader=shader.split(a).join(b);}
 const count=(shader.match(/\bfinish\(l,/g)||[]).length;
 if(count!==10)throw new Error(`Shared finish dispatch census drift: ${count}`);
 shader=shader.replace(/\bfinish\(l,/g,'requestFinish(l,');
 replace('root','  markValue(l,callRequest.data);markValue(l,callRequest.aux);','  markValue(l,callRequest.data);markValue(l,callRequest.aux);markValue(l,finishRequest.value);');
 replace('budget','(step<params.budget||callRequest.pending!=0u)','(step<params.budget||callRequest.pending!=0u||finishRequest.pending!=0u)');
 replace('central dispatch',`    if(callRequest.pending!=0u){
      callRequest.pending=2u;
      call(l,callRequest.argc,(callRequest.flags&1u)!=0u,(callRequest.flags&2u)!=0u);
      completeCall(l);
    }else{`,`    if(finishRequest.pending!=0u){
      if(finishRequest.pending!=1u){states[l].status=2u;break;}
      finishRequest.pending=2u;
      finish(l,finishRequest.value);
      finishRequest.pending=0u;finishRequest.value=undef();
      if(callRequest.pending==2u){completeCall(l);}
    }else if(callRequest.pending!=0u){
      if(callRequest.pending!=1u){states[l].status=2u;break;}
      callRequest.pending=2u;
      call(l,callRequest.argc,(callRequest.flags&1u)!=0u,(callRequest.flags&2u)!=0u);
      if(finishRequest.pending==0u){completeCall(l);}
    }else{`);
 replace('opcode completion checkpoint','    }}\n    }\n    asyncRejectDispatch(l);','    }}\n    }\n    if(finishRequest.pending!=0u){continue;}\n    asyncRejectDispatch(l);');
 replace('async completion checkpoints','    asyncRejectDispatch(l);','    asyncRejectDispatch(l);\n    if(finishRequest.pending!=0u){continue;}',2);
 replace('initial job checkpoint','  asyncRejectDispatch(l);\n  jobDispatch(l);','  asyncRejectDispatch(l);\n  if(finishRequest.pending==0u){jobDispatch(l);}');
 replace('snapshot guard','  if(callRequest.pending!=0u){\n    if(states[l].status<2u||states[l].status>8u)', '  if(callRequest.pending!=0u||finishRequest.pending!=0u){\n    if(states[l].status<2u||states[l].status>8u)');
 replace('snapshot clear','    callRequest.pending=0u;callRequest.data=undef();callRequest.aux=undef();','    callRequest.pending=0u;callRequest.data=undef();callRequest.aux=undef();\n    finishRequest.pending=0u;finishRequest.value=undef();');
 shader=sharedFinishRequestWGSL+'\n'+shader;
 if((shader.match(/\bfinish\(l,/g)||[]).length!==1)throw new Error('Shared finish dispatch must emit one finish site');
 return shader;
}
