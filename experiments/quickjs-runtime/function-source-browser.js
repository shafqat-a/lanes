import {createCompiler} from './compiler.js';
import {QuickJSGPU} from './runtime.js';
import {functionSourceCases,functionSourceResourceCases,functionSourceResumptionSource,functionSourceResumptionExpected} from './function-source-cases.js';
const status=document.getElementById('status'),inputs=[0,1,-1,3,17];
const normative=[],fixtures=functionSourceCases;
function native(source,input){const frame=document.createElement('iframe');frame.hidden=true;document.body.append(frame);try{return frame.contentWindow.Function(`return (${source})`)()(input);}finally{frame.remove();}}
function check(ok,message){if(!ok)throw new Error(message);}
let vm;
try{
 const start=performance.now(),compiler=await createCompiler();vm=await QuickJSGPU.create();const results=[],nativeReferenceDifferences=[];
 for(const fixture of fixtures){
  status.textContent=fixture.feature;const directed=normative.includes(fixture),actual=native(fixture.source,fixture.input);
  if(directed&&actual!==fixture.expected){check(actual===fixture.allowedNativeExpected,`Unexpected native result ${fixture.feature}`);nativeReferenceDifferences.push({feature:fixture.feature,native:actual,ecmascript2025:fixture.expected,reason:fixture.nativeReferenceDifference});}
  else check(Object.is(actual,fixture.expected),`Fixed oracle ${fixture.feature}`);
  const expected=inputs.map(x=>directed?fixture.expected:native(fixture.source,x));let result;
  try{result=await vm.run(compiler.compile(fixture.source),inputs,{budget:4096,maxDispatches:4096});}catch(error){throw new Error(`${fixture.feature}: ${error.message}\n${fixture.source}`);}
  check(result.backend==='gpu'&&result.done,`GPU completion ${fixture.feature}`);
  for(let i=0;i<inputs.length;i++)check(Object.is(result.values[i],expected[i]),`${fixture.feature} input ${inputs[i]} GPU ${result.values[i]} expected ${expected[i]}`);
  results.push({feature:fixture.feature,checked:inputs.length,maxSteps:Math.max(...result.steps),collections:Math.max(...result.collections)});
 }
 check(native(functionSourceResumptionSource,2)===functionSourceResumptionExpected,'Resumption fixed oracle');
 const job=await vm.start(compiler.compile(functionSourceResumptionSource),[2]);let resumed,dispatches=0;
 try{do{resumed=await job.step(1);if(++dispatches>50000)throw new Error('Resumption dispatch bound');if(dispatches%100===0)status.textContent=`Function source resumption ${dispatches}`;}while(!resumed.done);}finally{await job.dispose();}
 check(resumed.backend==='gpu'&&resumed.values[0]===functionSourceResumptionExpected,`Resumption mismatch ${resumed.values[0]}`);
 let resourceChecks=0;
 for(const c of functionSourceResourceCases){check(native(c.source,c.input).length===257,'Resource native oracle');let failed=false;try{await vm.run(compiler.compile(c.source),[c.input],{budget:4096,maxDispatches:4096});}catch(e){if(!String(e.message).includes('Resource limit'))throw e;failed=true;}check(failed,'Expected explicit source resource limit');resourceChecks++;}
 await vm.dispose();vm=undefined;
 window.quickjsReport={backend:'gpu',resourceChecks,programs:fixtures.length+1,checked:fixtures.length*inputs.length+1,resumptionDispatches:dispatches,elapsedMs:performance.now()-start,results,nativeReferenceDifferences,gaps:["Sources over 256 UTF-16 units explicitly hit Resource limit; source-less synthetic internal functions remain Unsupported"]};
 status.textContent='Passed';document.getElementById('report').textContent=JSON.stringify(window.quickjsReport,null,2);
}catch(error){window.quickjsError=`${error.name}: ${error.message}\n${error.stack||''}`;status.textContent='Failed';document.getElementById('report').textContent=window.quickjsError;}
finally{if(vm)await vm.dispose();}
