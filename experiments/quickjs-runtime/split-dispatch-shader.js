// GPU-only split dispatch. All three pipelines execute guest work on the GPU.
import {shader} from './shader.js';
export const CONTROL_WORDS=36;
export const PARAM_WORDS=8;
export const INTERNAL_CALL_STATUS=15;
export const DISPATCH_STAGES=Object.freeze({idle:0,callQueued:1,callCompleted:2,done:3,nativeQueued:4});
export const splitControlWGSL=`
// header16 + CallRequest64 + FinishRequest32 + IntrinsicContext32 =144 bytes.
struct IntrinsicContext {id:u32,base:u32,extra:u32,argc:u32,flags:u32,pad0:u32,pad1:u32,pad2:u32}
struct DispatchControl {epoch:u32,stage:u32,budgetUsed:u32,pad:u32,call:CallRequest,completion:FinishRequest,intrinsic:IntrinsicContext}
@group(0) @binding(6) var<storage,read_write> dispatchControl:array<DispatchControl>;
`;
export const splitMainEntryWGSL=`
  let sameEpoch=dispatchControl[l].epoch==params.epoch;
  if(sameEpoch&&dispatchControl[l].stage==3u){return;}
  var resumedCall=false;
  var budgetUsed=0u;
  if(sameEpoch){
    if(dispatchControl[l].stage!=2u){states[l].status=2u;output[l].status=2u;dispatchControl[l].stage=3u;return;}
    callRequest=dispatchControl[l].call;finishRequest=dispatchControl[l].completion;
    budgetUsed=dispatchControl[l].budgetUsed;
    if(callRequest.pending!=2u||finishRequest.pending>1u){states[l].status=2u;output[l].status=2u;dispatchControl[l].stage=3u;return;}
    // Match unified cancellation if an impossible queued finish carries an error.
    resumedCall=finishRequest.pending==0u||states[l].status==0u;
  }else{
    if(dispatchControl[l].stage!=0u&&dispatchControl[l].stage!=3u){states[l].status=2u;output[l].status=2u;dispatchControl[l].stage=3u;return;}
    dispatchControl[l].epoch=params.epoch;dispatchControl[l].stage=0u;
    dispatchControl[l].budgetUsed=0u;
  }
`;
export const splitCallEntryWGSL=`
@compute @workgroup_size(32)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  let l=gid.x;if(l>=params.count){return;}
  if(dispatchControl[l].epoch!=params.epoch||dispatchControl[l].stage!=1u){return;}
  callRequest=dispatchControl[l].call;finishRequest=dispatchControl[l].completion;
  if(callRequest.pending!=1u||finishRequest.pending!=0u||states[l].status!=0u){states[l].status=2u;}
  else{
    callRequest.pending=2u;
    call(l,callRequest.argc,(callRequest.flags&1u)!=0u,(callRequest.flags&2u)!=0u);
  }
  dispatchControl[l].call=callRequest;dispatchControl[l].completion=finishRequest;
  if(dispatchControl[l].stage!=4u){dispatchControl[l].stage=2u;}
}
`;
export const splitNativeEntryWGSL=`
@compute @workgroup_size(32)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  let l=gid.x;if(l>=params.count){return;}
  if(dispatchControl[l].epoch!=params.epoch||dispatchControl[l].stage!=4u){return;}
  callRequest=dispatchControl[l].call;finishRequest=dispatchControl[l].completion;
  let context=dispatchControl[l].intrinsic;
  if(callRequest.pending!=2u||finishRequest.pending!=0u||states[l].status!=0u){states[l].status=2u;}
  else{
    var receiver=undef();if((context.flags&1u)!=0u){receiver=states[l].stack[context.base];}
    var a=undef();var b=undef();var c=undef();
    if(context.argc>0u){a=states[l].stack[context.base+context.extra];}
    if(context.argc>1u){b=states[l].stack[context.base+context.extra+1u];}
    if(context.argc>2u){c=states[l].stack[context.base+context.extra+2u];}
    let value=objectMethod(l,context.id,receiver,a,b,c);
    states[l].sp=context.base;
    if(states[l].status==0u){if((context.flags&2u)!=0u){requestFinish(l,value);}else{push(l,value);}}
  }
  dispatchControl[l].call=callRequest;dispatchControl[l].completion=finishRequest;
  dispatchControl[l].stage=2u;
}
`;
function functionSpans(source){
 const clean=source.replace(/\/\*[\s\S]*?\*\//g,m=>m.replace(/[^\n]/g,' ')).replace(/\/\/[^\n]*/g,m=>' '.repeat(m.length));
 const result=new Map();
 for(const m of clean.matchAll(/\bfn\s+(\w+)\s*\(/g)){
  const start=clean.indexOf('{',m.index);let end=start+1,depth=1;
  while(depth&&end<clean.length){if(clean[end]==='{')depth++;else if(clean[end]==='}')depth--;end++;}
  if(depth)throw Error(`Split dispatch unbalanced function ${m[1]}`);
  if(result.has(m[1]))throw Error(`Split dispatch duplicate function ${m[1]}`);
  result.set(m[1],{start:m.index,end,body:clean.slice(start+1,end-1)});
 }
 return result;
}
function prune(source){
 const functions=functionSpans(source),live=new Set();
 function visit(name){if(live.has(name))return;live.add(name);for(const m of functions.get(name).body.matchAll(/\b(\w+)\s*\(/g))if(functions.has(m[1]))visit(m[1]);}
 if(!functions.has('main'))throw Error('Split dispatch missing main');visit('main');
 for(const [name,f]of [...functions].reverse())if(!live.has(name))source=source.slice(0,f.start)+source.slice(f.end);
 return {source,live};
}
export function splitDispatchShader(original){
 const privateNames=[...original.matchAll(/var<private>\s+(\w+)\s*:/g)].map(m=>m[1]).sort();
 if(privateNames.join(',')!=='callRequest,finishRequest')throw Error('Split dispatch private-state serialization drift');
 if(/@binding\(6\)/.test(original))throw Error('Split dispatch control binding collision');
 let base=original;
 function replace(text,label,before,after,count=1){const found=text.split(before).length-1;if(found!==count)throw Error(`Split dispatch drift ${label}: expected${count}, got${found}`);return text.split(before).join(after);}
 base=replace(base,'params','struct Params { count: u32, budget: u32, instructions: u32, padding: u32 }','struct Params { count:u32,budget:u32,instructions:u32,padding:u32,epoch:u32,pad0:u32,pad1:u32,pad2:u32 }');
 base=splitControlWGSL+'\n'+base;
 const functions=functionSpans(base),entry=functions.get('main');
 if(!entry)throw Error('Split dispatch main absent');
 const attribute='@compute @workgroup_size(32)';const at=base.lastIndexOf(attribute,entry.start);
 if(at<0||base.slice(at+attribute.length,entry.start).trim()!=='')throw Error('Split dispatch main attributes drift');
 let callText=base.slice(0,at)+splitCallEntryWGSL+base.slice(entry.end);
 const nativeText=base.slice(0,at)+splitNativeEntryWGSL+base.slice(entry.end);
 callText=replace(callText,'native intrinsic yield',
  'else{value=objectMethod(l,fnValue.x,receiver,a,b,c);}states[l].sp=base;',
  'else{dispatchControl[l].intrinsic=IntrinsicContext(fnValue.x,base,extra,argc,select(0u,1u,isMethod)|select(0u,2u,tail),0u,0u,0u);dispatchControl[l].stage=4u;return;}states[l].sp=base;');
 let mainText=base;
 mainText=replace(mainText,'main entry','  let l=gid.x; if (l>=params.count) { return; }','  let l=gid.x; if (l>=params.count) { return; }'+splitMainEntryWGSL);
 mainText=replace(mainText,'initial checkpoints','  asyncRejectDispatch(l);\n  if(finishRequest.pending==0u){jobDispatch(l);}','  if(!sameEpoch){asyncRejectDispatch(l);if(finishRequest.pending==0u){jobDispatch(l);}}');
 mainText=replace(mainText,'loop budget','for (var step=0u;(step<params.budget||callRequest.pending!=0u||finishRequest.pending!=0u)&&states[l].status==0u;) {','for (var step=budgetUsed;resumedCall||((step<params.budget||callRequest.pending!=0u||finishRequest.pending!=0u)&&states[l].status==0u);) {\n    budgetUsed=step;');
 mainText=replace(mainText,'resume before finish','    if(finishRequest.pending!=0u){\n      if(finishRequest.pending!=1u)','    if(resumedCall&&finishRequest.pending==0u){\n      resumedCall=false;completeCall(l);\n    }else if(finishRequest.pending!=0u){\n      resumedCall=false;\n      if(finishRequest.pending!=1u)');
 mainText=replace(mainText,'call yield',`      callRequest.pending=2u;
      call(l,callRequest.argc,(callRequest.flags&1u)!=0u,(callRequest.flags&2u)!=0u);
      if(finishRequest.pending==0u){completeCall(l);}`,`      dispatchControl[l].call=callRequest;dispatchControl[l].completion=finishRequest;
      dispatchControl[l].budgetUsed=step;dispatchControl[l].stage=1u;
      output[l].status=15u;output[l].steps=states[l].steps;output[l].collections=states[l].collections;output[l].pad=states[l].pc;
      return;`);
 // Persist the actual consumed count when a final opcode leaves the loop.
 mainText=replace(mainText,'step accounting','      step++;','      step++;budgetUsed=step;');
 mainText=replace(mainText,'final control','  output[l].status=select(states[l].status,0u,states[l].status==10u||states[l].status==11u);','  dispatchControl[l].call=callRequest;dispatchControl[l].completion=finishRequest;\n  dispatchControl[l].budgetUsed=budgetUsed;dispatchControl[l].stage=3u;\n  output[l].status=select(states[l].status,0u,states[l].status==10u||states[l].status==11u);');
 const main=prune(mainText),call=prune(callText),native=prune(nativeText);
 if(main.live.has('call')||main.live.has('objectMethod'))throw Error('Split main retains actual call intrinsic tree');
 if(!call.live.has('call')||call.live.has('objectMethod')||call.live.has('finish')||call.live.has('completeCall'))throw Error('Split call retains intrinsic tree/completion or misses call');
 if(!native.live.has('objectMethod')||native.live.has('call')||native.live.has('finish')||native.live.has('completeCall'))throw Error('Split native completion/reachability drift');
 return Object.freeze({main:main.source,call:call.source,native:native.source});
}
export const splitShaders=splitDispatchShader(shader);
