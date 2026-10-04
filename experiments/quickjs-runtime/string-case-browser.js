import {createCompiler} from './compiler.js';
import {QuickJSGPU} from './runtime.js';
import {stringCaseCases,stringCaseVersionCases,stringCaseResumptionSource,stringCaseResumptionExpected} from './string-case-cases.js';
import {stringCaseReviewCases,stringCaseReviewResourceCases} from './string-case-review-cases.js';
import {stringCaseGaps} from './string-case-metadata.js';
const status=document.getElementById('status'),inputs=[0,1,-1,3,17];
function native(source,input){const frame=document.createElement('iframe');frame.hidden=true;document.body.append(frame);try{return frame.contentWindow.Function(`return (${source})`)()(input);}finally{frame.remove();}}
function check(ok,message){if(!ok)throw new Error(message);}
let vm;
try{
 const start=performance.now(),compiler=await createCompiler();vm=await QuickJSGPU.create();const results=[],nativeVersionDifferences=[];
 const fixtures=[...stringCaseCases,...stringCaseReviewCases,...stringCaseVersionCases];
 for(const fixture of fixtures){
  status.textContent=fixture.feature;const pinned=stringCaseVersionCases.includes(fixture);
  const fixedNative=native(fixture.source,fixture.input);
  if(pinned){if(fixedNative!==fixture.expected)nativeVersionDifferences.push({feature:fixture.feature,native:fixedNative,pinnedUnicode17:fixture.expected});}
  else check(Object.is(fixedNative,fixture.expected),`Fixed oracle ${fixture.feature}`);
  const expected=inputs.map(x=>pinned?fixture.expected:native(fixture.source,x));let result;
  try{result=await vm.run(compiler.compile(fixture.source),inputs,{budget:4096,maxDispatches:4096});}catch(error){throw new Error(`${fixture.feature}: ${error.message}\n${fixture.source}`);}
  check(result.backend==='gpu'&&result.done,`GPU completion ${fixture.feature}`);
  for(let i=0;i<inputs.length;i++)check(Object.is(result.values[i],expected[i]),`${fixture.feature} input ${inputs[i]} GPU ${result.values[i]} expected ${expected[i]}`);
  results.push({feature:fixture.feature,checked:inputs.length,maxSteps:Math.max(...result.steps),collections:Math.max(...result.collections)});
 }
 let resourceLimited=0;
 for(const fixture of stringCaseReviewResourceCases){
  check(native(fixture.source,17).length===fixture.nativeLength,'Resource native oracle');let error;
  try{await vm.run(compiler.compile(fixture.source),[17],{budget:4096,maxDispatches:256});}catch(caught){error=caught;}
  check(error&&/^Resource limit in lane \d+, instruction -?\d+; no CPU fallback$/.test(error.message),`Expected explicit resource completion: ${error?.message}`);resourceLimited++;
 }
 check(native(stringCaseResumptionSource,3)===stringCaseResumptionExpected,'Resumption fixed oracle');
 const job=await vm.start(compiler.compile(stringCaseResumptionSource),[3]);let resumed,dispatches=0;
 try{do{resumed=await job.step(1);if(++dispatches>50000)throw new Error('Resumption dispatch bound');if(dispatches%100===0)status.textContent=`Unicode casing resumption ${dispatches}`;}while(!resumed.done);}finally{await job.dispose();}
 check(resumed.backend==='gpu'&&resumed.values[0]===stringCaseResumptionExpected,`Resumption mismatch ${resumed.values[0]}`);
 await vm.dispose();vm=undefined;
 window.quickjsReport={backend:'gpu',unicodeVersion:'17.0.0',programs:fixtures.length+1,checked:fixtures.length*inputs.length+1,resourceLimited,resumptionDispatches:dispatches,elapsedMs:performance.now()-start,results,nativeVersionDifferences,gaps:stringCaseGaps};
 status.textContent='Passed';document.getElementById('report').textContent=JSON.stringify(window.quickjsReport,null,2);
}catch(error){window.quickjsError=`${error.name}: ${error.message}\n${error.stack||''}`;status.textContent='Failed';document.getElementById('report').textContent=window.quickjsError;}
finally{if(vm)await vm.dispose();}
