import {createCompiler} from './compiler.js';
import {QuickJSGPU} from './runtime.js';
import {phase6ReviewCases} from './phase6-review-cases.js';
import {phase6MetadataCases,phase6MetadataResourceCase} from './phase6-metadata-cases.js';
const status=document.getElementById('status'),fixtures=[...phase6ReviewCases,...phase6MetadataCases];
function native(source,input){const frame=document.createElement('iframe');frame.hidden=true;document.body.append(frame);try{return frame.contentWindow.Function(`return (${source})`)()(input);}finally{frame.remove();}}
function check(ok,message){if(!ok)throw new Error(message);}
let vm;
try{
 const start=performance.now(),compiler=await createCompiler();vm=await QuickJSGPU.create();const results=[],nativeReferenceDifferences=[];let checked=0;
 for(const fixture of fixtures){
  status.textContent=fixture.feature;const inputs=[0,3,17];
  for(const input of inputs){
   let value,error;try{value=native(fixture.source,input);}catch(caught){error=caught;}
   if(error){check(fixture.allowedNativeException!==undefined&&error.name===fixture.allowedNativeException,`Unexpected native exception ${fixture.feature}: ${error.name}`);nativeReferenceDifferences.push({feature:fixture.feature,input,nativeException:error.name,expected:fixture.expected,reason:fixture.nativeReferenceDifference,spec:fixture.spec});}
   else check(Object.is(value,fixture.expected),`Fixed native oracle ${fixture.feature}`);
  }
  let result;
  try{result=await vm.run(compiler.compile(fixture.source),inputs,{budget:4096,maxDispatches:4096});}
  catch(error){throw new Error(`${fixture.feature} [status: ${status.textContent}] ${error.name}: ${error.message}\n${error.stack||''}\nSource: ${fixture.source}`);}

  check(result.backend==='gpu'&&result.done,`GPU completion ${fixture.feature}`);
  for(let i=0;i<inputs.length;i++){check(Object.is(result.values[i],fixture.expected),`${fixture.feature} GPU ${result.values[i]} expected ${fixture.expected}`);if(fixture.requiresGC)check(result.collections[i]>0,`Required GC ${fixture.feature} lane ${i}`);}
  checked+=inputs.length;results.push({feature:fixture.feature,checked:inputs.length,steps:[...result.steps],collections:[...result.collections]});
 }
 const resume=phase6ReviewCases.find(c=>c.feature==='protocol-review-arrow-prototype-getter');
 const result=await vm.run(compiler.compile(resume.source),[3],{budget:1,maxDispatches:16384});
 check(result.backend==='gpu'&&result.done&&result.values[0]===true, 'Prototype getter single-instruction resumption');checked++;
 results.push({feature:resume.feature+'-budget-one',checked:1,steps:[...result.steps],collections:[...result.collections]});
 check(native(phase6MetadataResourceCase.source,3)===3000,'Resource native validity');
 let resource=false;try{await vm.run(compiler.compile(phase6MetadataResourceCase.source),[3],{budget:4096,maxDispatches:4096});}catch(error){if(!String(error.message).includes('Resource limit'))throw error;resource=true;}
 check(resource,'Retained heap exhaustion must report Resource limit');
 await vm.dispose();vm=undefined;window.quickjsReport={backend:'gpu',nativeReferenceDifferences,resourceChecks:1,programs:fixtures.length+1,checked,elapsedMs:performance.now()-start,results,gaps:[]};
 status.textContent='Passed';document.getElementById('report').textContent=JSON.stringify(window.quickjsReport,null,2);
}catch(error){window.quickjsError=`${error.name}: ${error.message}\n${error.stack||''}`;status.textContent='Failed';document.getElementById('report').textContent=window.quickjsError;}
finally{if(vm)await vm.dispose();}
