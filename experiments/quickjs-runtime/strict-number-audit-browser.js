import {createCompiler} from './compiler.js';
import {QuickJSGPU} from './runtime.js';
import {strictNumberAuditCases,strictNumberAuditPendingCases} from './strict-number-audit-cases.js';
const status=document.getElementById('status'),inputs=[0,3,17];
// The formerly pending String-wrapper iterator conversion is required here.
// This page never accepts Unsupported as a successful result.
const normative=[],fixtures=[...strictNumberAuditCases,...strictNumberAuditPendingCases];
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
 await vm.dispose();vm=undefined;
 window.quickjsReport={backend:'gpu',programs:fixtures.length,checked:fixtures.length*inputs.length,requiredFormerBoundaries:strictNumberAuditPendingCases.map(c=>({feature:c.feature,expected:c.expected,status:'required positive'})),elapsedMs:performance.now()-start,results,nativeReferenceDifferences,gaps:[]};
 status.textContent='Passed';document.getElementById('report').textContent=JSON.stringify(window.quickjsReport,null,2);
}catch(error){window.quickjsError=`${error.name}: ${error.message}\n${error.stack||''}`;status.textContent='Failed';document.getElementById('report').textContent=window.quickjsError;}
finally{if(vm)await vm.dispose();}
