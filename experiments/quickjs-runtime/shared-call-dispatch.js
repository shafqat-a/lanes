// WGSL generation only. Guest calls still execute exclusively on the GPU.
// Keep one physical call() site: Metal otherwise inlines the whole VM into
// every opcode/helper caller. Exact post-call rewrites fail closed on drift.
export const sharedCallRequestWGSL = `
struct CallRequest {
  pending:u32, argc:u32, flags:u32, priorDepth:u32,
  post:u32, continuation:u32, data:V, aux:V,
}
var<private> callRequest:CallRequest;
fn requestCall(l:u32,argc:u32,method:bool,tail:bool) {
  if(states[l].status!=0u){return;}
  if(callRequest.pending!=0u){states[l].status=2u;return;}
  callRequest=CallRequest(1u,argc,select(0u,1u,method)|select(0u,2u,tail),states[l].depth,0u,0u,undef(),undef());
}
fn callPost(l:u32,post:u32,continuation:u32,data:V,aux:V) {
  if(callRequest.pending!=1u){return;}
  callRequest.post=post;callRequest.continuation=continuation;callRequest.data=data;callRequest.aux=aux;
}
fn completeCall(l:u32) {
  let request=callRequest;let entered=states[l].depth>request.priorDepth;
  // Optional frame metadata originally applied even on abrupt call setup.
  if(request.post==2u&&entered){states[l].frames[states[l].depth].tail=request.continuation;states[l].frames[states[l].depth].receiver=request.data;}
  if(request.post==10u&&entered&&request.continuation!=0u){states[l].frames[states[l].depth].tail=request.continuation;}
  if(request.post==3u&&entered){states[l].frames[states[l].depth].tail=request.continuation;states[l].frames[states[l].depth].receiver=request.data;}
  if(states[l].status==0u){
    switch request.post {
      case 1u: {if(entered){states[l].frames[states[l].depth].tail=2u;}else{let ignored=pop(l);}}
      case 3u: {if(!entered){states[l].status=6u;}}
      case 4u: {if(entered){states[l].frames[states[l].depth].tail=request.continuation;states[l].frames[states[l].depth].receiver=request.data;}else{states[l].status=2u;}}
      case 5u: {if(entered){states[l].frames[states[l].depth].tail=41u;states[l].frames[states[l].depth].receiver=request.data;}else{states[l].stack[request.data.x]=pop(l);}}
      case 6u: {if(entered){states[l].frames[states[l].depth].tail=40u;states[l].frames[states[l].depth].receiver=request.data;}else{let result=pop(l);iterationStepResult(l,request.data.x,result);}}
      case 7u: {if(entered){states[l].frames[states[l].depth].tail=3u;states[l].heap[states[l].env].value.z=request.data.x;states[l].heap[states[l].env].value.w=request.data.z;}}
      case 8u: {if(states[l].depth==request.priorDepth+1u){states[l].frames[states[l].depth].tail=request.continuation;states[l].frames[states[l].depth].receiver=request.data;}else{states[l].status=2u;}}
      case 9u: {if(states[l].depth==1u){states[l].frames[1].tail=136u;}else{states[l].status=2u;}}
      case 11u: {if(entered){states[l].frames[states[l].depth].tail=50u;}else{states[l].status=6u;}}
      case 12u: {if(entered){states[l].frames[states[l].depth].tail=104u;}else{states[l].status=2u;}}
      default: {}
    }
  }
  callRequest.pending=0u;callRequest.data=undef();callRequest.aux=undef();
}
`;

export function shareCallDispatch(original) {
  let shader=original;
  const changes=[];
  function replace(label,old,next,count=1){const found=shader.split(old).length-1;if(found!==count)throw new Error(`Shared call dispatch drift: ${label}: expected ${count}, got ${found}`);shader=shader.split(old).join(next);changes.push(label);}
  replace('construct post',`  let depth=states[l].depth;call(l,argc,true,false);
  if(ordinaryConstructor&&states[l].status==0u&&states[l].depth>depth){
    states[l].frames[states[l].depth].tail=3u;
    states[l].heap[states[l].env].value.z=constructTarget.x;states[l].heap[states[l].env].value.w=constructTarget.z;
  }`,`  call(l,argc,true,false);
  if(ordinaryConstructor){callPost(l,7u,0u,constructTarget,undef());}`);
  replace('job post',`  call(l,4u,false,false);
  if(states[l].status!=0u){return;}
  if(states[l].depth!=1u){states[l].status=2u;return;}
  states[l].frames[1].tail=136u;`,`  call(l,4u,false,false);callPost(l,9u,136u,undef(),undef());`);
  replace('async helper post',`  let depth=states[l].depth;call(l,1u,false,false);
  if(states[l].status!=0u){return;}
  if(states[l].depth!=depth+1u){states[l].status=2u;return;}
  states[l].frames[states[l].depth].tail=code;states[l].frames[states[l].depth].receiver=data;`,`  call(l,1u,false,false);callPost(l,8u,code,data,undef());`);
  replace('async replacement post',`  let depth=states[l].depth;call(l,argc,false,false);
  if(states[l].status!=0u){return;}
  if(states[l].depth!=depth+1u){states[l].status=2u;return;}
  states[l].frames[states[l].depth].tail=frame.tail;
  states[l].frames[states[l].depth].receiver=frame.receiver;`,`  call(l,argc,false,false);callPost(l,8u,frame.tail,frame.receiver,undef());`);
  replace('property key post',`        if(states[l].depth>depth){states[l].frames[states[l].depth].tail=7u;states[l].frames[states[l].depth].receiver=V(keySlot,0u,0u,0u);continue;}
        if(states[l].status==0u){states[l].status=6u;}`,`        callPost(l,3u,7u,V(keySlot,0u,0u,0u),undef());continue;`);
  // All setters, copy_data_properties and synchronous IteratorClose discard
  // their result, whether the callee enters a frame or is a native intrinsic.
  replace('discard post',`if(states[l].status==0u){if(states[l].depth>depth){states[l].frames[states[l].depth].tail=2u;}else{let ignored=pop(l);}}`,`callPost(l,1u,2u,undef(),undef());`,6);
  // Postfix numeric coercion: no continuation override for other unary ops.
  const postfix=/if\(states\[l\]\.depth>depth&&\(op==(\d+u)\|\|op==(\d+u)\)\)\{\s*states\[l\]\.frames\[states\[l\]\.depth\]\.tail=select\(4u,5u,op==\2\);\s*\}/g;
  const postfixMatches=[...shader.matchAll(postfix)];if(postfixMatches.length!==1)throw new Error('Shared call dispatch postfix drift');
  shader=shader.replace(postfix,(_,inc,dec)=>`callPost(l,10u,select(0u,select(4u,5u,op==${dec}),op==${inc}||op==${dec}),undef(),undef());`);
  replace('local update post',`if(states[l].depth>depth){states[l].frames[states[l].depth].tail=6u;states[l].frames[states[l].depth].receiver=V(c,0u,4u,0u);}`,`callPost(l,2u,6u,V(c,0u,4u,0u),undef());`,2);
  replace('iterator open post',`if(states[l].status==0u){
          if(states[l].depth>depth){states[l].frames[states[l].depth].tail=41u;states[l].frames[states[l].depth].receiver=V(slot,0u,0u,0u);}
          else{states[l].stack[slot]=pop(l);}
        }`,`callPost(l,5u,41u,V(slot,0u,0u,0u),undef());`);
  replace('iterator step post',`if(states[l].status==0u){
          if(states[l].depth>depth){states[l].frames[states[l].depth].tail=40u;states[l].frames[states[l].depth].receiver=V(index,0u,0u,0u);}
          else{let result=pop(l);iterationStepResult(l,index,result);}
        }`,`callPost(l,6u,40u,V(index,0u,0u,0u),undef());`);
  replace('forin post',`if(states[l].status==0u){if(states[l].depth>depth){states[l].frames[states[l].depth].tail=50u;}else{states[l].status=6u;}}`,`callPost(l,11u,50u,undef(),undef());`);
  replace('delegation post',`if(states[l].status==0u){if(states[l].depth>depth){states[l].frames[states[l].depth].tail=104u;}else{states[l].status=2u;}}`,`callPost(l,12u,104u,undef(),undef());`);
  replace('throw close post',`      if(states[l].status==0u){
        if(states[l].depth>callDepth){states[l].frames[states[l].depth].tail=80u;states[l].frames[states[l].depth].receiver=error;}
        else{states[l].status=2u;}
      }`,`      callPost(l,4u,80u,error,undef());`);
  // All remaining calls are terminal dispatches with no post-call mutation.
  // Exact census intentionally forces review when a feature adds another site.
  const count=(shader.match(/\bcall\(l,/g)||[]).length;
  if(count!==49)throw new Error(`Shared call dispatch call-site census drift: ${count}`);
  shader=shader.replace(/\bcall\(l,/g,'requestCall(l,');
  replace('request GC roots','  mark(l,states[l].env); markValue(l,states[l].result);','  mark(l,states[l].env); markValue(l,states[l].result);\n  markValue(l,callRequest.data);markValue(l,callRequest.aux);');
  replace('main loop',`  for (var step=0u;step<params.budget && states[l].status==0u;step++) {`,`  // Pending dispatches are completed atomically with their initiating opcode.
  // They do not consume another guest instruction or escape into a snapshot.
  for (var step=0u;(step<params.budget||callRequest.pending!=0u)&&states[l].status==0u;) {
    if(callRequest.pending!=0u){
      callRequest.pending=2u;
      call(l,callRequest.argc,(callRequest.flags&1u)!=0u,(callRequest.flags&2u)!=0u);
      completeCall(l);
    }else{
      step++;`);
  replace('opcode block end','    }}\n    asyncRejectDispatch(l);','    }}\n    }\n    asyncRejectDispatch(l);');
  replace('snapshot invariant','  output[l].status=select(states[l].status,0u,states[l].status==10u||states[l].status==11u);',`  // Private requests must never outlive this GPU invocation. Abrupt resource
  // exits cancel requests; a running/successful exit with one is an invariant violation.
  if(callRequest.pending!=0u){
    if(states[l].status<2u||states[l].status>8u){states[l].status=2u;}
    callRequest.pending=0u;callRequest.data=undef();callRequest.aux=undef();
  }
  output[l].status=select(states[l].status,0u,states[l].status==10u||states[l].status==11u);`);
  // Declarations can reference functions declared later in WGSL.
  shader=sharedCallRequestWGSL+'\n'+shader;
  if((shader.match(/\bcall\(l,/g)||[]).length!==1)throw new Error('Shared call dispatch must emit one call site');
  return shader;
}
