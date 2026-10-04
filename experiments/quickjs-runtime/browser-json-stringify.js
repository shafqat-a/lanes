import {createCompiler} from './compiler.js';
import {QuickJSGPU} from './runtime.js';
import {jsonStringifyCases,jsonStringifyResumptionSource,jsonStringifyResumptionExpected,jsonStringifyResourceCases} from './json-stringify-cases.js';
import {jsonStringifyGaps} from './json-stringify-metadata.js';
const status=document.getElementById('status'),inputs=[0,1,-1,3,17];
function native(source,input){const frame=document.createElement('iframe');frame.hidden=true;document.body.append(frame);try{return frame.contentWindow.Function(`return (${source})`)()(input);}finally{frame.remove();}}
function check(ok,message){if(!ok)throw new Error(message);}
let vm;
try{
 const start=performance.now(),compiler=await createCompiler();vm=await QuickJSGPU.create();const results=[];
 for(const fixture of jsonStringifyCases){
  status.textContent=fixture.feature;
  check(Object.is(native(fixture.source,fixture.input),fixture.expected),`Fixed oracle ${fixture.feature}`);
  const expected=inputs.map(x=>native(fixture.source,x));let result;
  try{result=await vm.run(compiler.compile(fixture.source),inputs,{budget:4096,maxDispatches:4096});}catch(error){throw new Error(`${fixture.feature}: ${error.message}\n${fixture.source}`);}
  check(result.backend==='gpu'&&result.done,`GPU completion ${fixture.feature}`);
  for(let i=0;i<inputs.length;i++)check(Object.is(result.values[i],expected[i]),`${fixture.feature} input ${inputs[i]} GPU ${result.values[i]} native ${expected[i]}`);
  results.push({feature:fixture.feature,checked:inputs.length,maxSteps:Math.max(...result.steps),collections:Math.max(...result.collections)});
 }
 let resourceLimited=0;
 for(const fixture of jsonStringifyResourceCases){
  check(Object.is(native(fixture.source,fixture.input),fixture.expected),'Resource native oracle');let error;
  try{await vm.run(compiler.compile(fixture.source),[fixture.input],{budget:4096,maxDispatches:256});}catch(caught){error=caught;}
  check(error&&/^Resource limit in lane \d+, instruction -?\d+; no CPU fallback$/.test(error.message),`Expected explicit resource completion: ${error?.message}`);resourceLimited++;
 }
 check(native(jsonStringifyResumptionSource,3)===jsonStringifyResumptionExpected,'Resumption fixed oracle');
 const job=await vm.start(compiler.compile(jsonStringifyResumptionSource),[3]);let resumed,dispatches=0;
 try{do{resumed=await job.step(1);if(++dispatches>50000)throw new Error('Resumption dispatch bound');if(dispatches%100===0)status.textContent=`Stringify resumption ${dispatches}`;}while(!resumed.done);}finally{await job.dispose();}
 check(resumed.backend==='gpu'&&resumed.values[0]===jsonStringifyResumptionExpected,`Resumption mismatch ${resumed.values[0]}`);
 await vm.dispose();vm=undefined;
 window.quickjsReport={backend:'gpu',programs:jsonStringifyCases.length+1,checked:jsonStringifyCases.length*inputs.length+1,resourceLimited,resumptionDispatches:dispatches,elapsedMs:performance.now()-start,results,gaps:jsonStringifyGaps};
 status.textContent='Passed';document.getElementById('report').textContent=JSON.stringify(window.quickjsReport,null,2);
}catch(error){window.quickjsError=`${error.name}: ${error.message}\n${error.stack||''}`;status.textContent='Failed';document.getElementById('report').textContent=window.quickjsError;}
finally{if(vm)await vm.dispose();}
