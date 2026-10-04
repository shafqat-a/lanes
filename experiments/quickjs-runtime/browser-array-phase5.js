import {createCompiler} from './compiler.js';
import {QuickJSGPU} from './runtime.js';
import {arrayPhase5Cases,arrayPhase5UnsupportedCases,arrayPhase5ResourceCases,arrayPhase5ResumptionSource,arrayPhase5ResumptionExpected} from './array-phase5-cases.js';
import {arrayPhase5Gaps,arrayPhase5Metadata} from './array-phase5-metadata.js';
const status=document.getElementById('status'),inputs=[0,1,-1,3,17];
function native(source,input){const frame=document.createElement('iframe');frame.hidden=true;document.body.append(frame);try{return frame.contentWindow.Function(`return (${source})`)()(input);}finally{frame.remove();}}
function expect(ok,message){if(!ok)throw new Error(message);}
let vm;
try{
 const started=performance.now(),compiler=await createCompiler();vm=await QuickJSGPU.create();const results=[];
 for(const [index,item] of arrayPhase5Cases.entries()){
  status.textContent=`Array phase5 ${index+1}/${arrayPhase5Cases.length}: ${item.feature}`;
  const expected=inputs.map(input=>native(item.source,input));let result;
  try{result=await vm.run(compiler.compile(item.source),inputs,{budget:4096,maxDispatches:4096});}catch(error){throw new Error(`${item.feature}: ${error.message}\n${item.source}`);}
  expect(result.done&&result.backend==='gpu',`${item.feature}: GPU completion required`);
  for(let i=0;i<inputs.length;i++)expect(Object.is(result.values[i],expected[i]),`${item.feature}, input ${inputs[i]}: GPU ${result.values[i]}, native ${expected[i]}\n${item.source}`);
  results.push({index,feature:item.feature,checked:inputs.length,expected,maxSteps:Math.max(...result.steps),collections:Math.max(...result.collections)});
 }
 let unsupportedChecks=0,resourceChecks=0;
 for(const item of arrayPhase5UnsupportedCases){
  let error;try{await vm.run(compiler.compile(item.source),[3],{budget:4096});}catch(caught){error=caught;}
  expect(error&&/Unsupported runtime operation/.test(error.message)&&/no CPU fallback/.test(error.message),`${item.feature}: expected uncatchable Unsupported, got ${error?.message}`);unsupportedChecks++;
 }
 for(const item of arrayPhase5ResourceCases){
  let error;try{await vm.run(compiler.compile(item.source),[3],{budget:4096,maxDispatches:32});}catch(caught){error=caught;}
  expect(error&&/resource|heap|stack|frame|limit/i.test(error.message)&&/no CPU fallback/.test(error.message),`${item.feature}: expected explicit resource limit, got ${error?.message}`);resourceChecks++;
 }
 expect(native(arrayPhase5ResumptionSource,3)===arrayPhase5ResumptionExpected,'Fixed native resumption mismatch');
 const job=await vm.start(compiler.compile(arrayPhase5ResumptionSource),[3]);let resumed,dispatches=0;
 try{do{resumed=await job.step(1);if(++dispatches>30000)throw new Error('Array phase5 resumption instruction bound');if(dispatches%100===0)status.textContent=`Array callbacks/coercion: ${dispatches} single-instruction dispatches`;}while(!resumed.done);}finally{await job.dispose();}
 expect(resumed.backend==='gpu'&&resumed.values[0]===arrayPhase5ResumptionExpected,`Resumption mismatch ${resumed.values[0]}`);
 await vm.dispose();vm=undefined;
 window.quickjsReport={backend:'gpu',compiler:'QuickJS/Wasm',programs:results.length+1,checked:results.length*inputs.length+1,unsupportedChecks,resourceChecks,
  inputs,methods:arrayPhase5Metadata.map(item=>item.name),resumptionDispatches:dispatches,resumptionExpected:arrayPhase5ResumptionExpected,
  elapsedMs:performance.now()-started,results,gaps:arrayPhase5Gaps,nativeReference:'Fresh isolated iframe per program/input; no host guest execution in the GPU path.'};
 status.textContent='Passed';document.getElementById('report').textContent=JSON.stringify(window.quickjsReport,null,2);
}catch(error){window.quickjsError=`${error.name}: ${error.message}\n${error.stack||''}`;status.textContent='Failed';document.getElementById('report').textContent=window.quickjsError;}finally{if(vm)await vm.dispose();}
