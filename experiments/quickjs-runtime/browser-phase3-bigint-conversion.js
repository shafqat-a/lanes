import {createCompiler} from './compiler.js';
import {QuickJSGPU} from './runtime.js';
import {phase3BigintConversionCases,phase3BigintConversionResumption,phase3BigintConversionResourceCases} from './phase3-bigint-conversion-cases.js';
const status=document.getElementById('status'),inputs=[0,1,-1,17];
function check(ok,message){if(!ok)throw new Error(message);}
function native(source,input){const frame=document.createElement('iframe');frame.hidden=true;document.body.append(frame);try{return frame.contentWindow.Function('return ('+source+')')()(input);}finally{frame.remove();}}
let vm;
try{
 const started=performance.now(),compiler=await createCompiler();vm=await QuickJSGPU.create();const results=[],nativeReferenceDifferences=[];
 function expectedValue(c,input){const actual=native(c.source,input);if(c.nativeReferenceDifference&&!Object.is(actual,c.expected)){const difference=c.nativeReferenceDifference;check(c.feature==='invalid-string-6'&&Object.is(actual,difference.observed)&&Object.is(c.expected,difference.expected),'Unexpected native divergence '+c.feature);nativeReferenceDifferences.push({feature:c.feature,input,native:actual,nativeDiagnostic:native(difference.nativeDiagnosticSource,input),normative:c.expected,reason:difference.reason,specification:difference.specification});return c.expected;}return actual;}
 for(const c of phase3BigintConversionCases){
  status.textContent=c.feature;check(Object.is(expectedValue(c,c.input),c.expected),'Fixed oracle '+c.feature);
  const expected=inputs.map(input=>expectedValue(c,input));let result;
  try{result=await vm.run(compiler.compile(c.source),inputs,{budget:4096,maxDispatches:4096});}catch(error){throw new Error(c.feature+': '+error.message);}
  check(result.backend==='gpu'&&result.done,'GPU completion '+c.feature);
  result.values.forEach((value,index)=>check(Object.is(value,expected[index]),c.feature+' mismatch input '+inputs[index]));
  if(c.requiresGC)check(result.collections.every(n=>n>0),'Required collection '+c.feature);
  results.push({feature:c.feature,checked:inputs.length,collections:Array.from(result.collections),maxSteps:Math.max(...result.steps)});
 }
 const boundaries=[];
 for(const c of phase3BigintConversionResourceCases){
  check(Object.is(native(c.source,c.input),c.expected),'Resource native oracle '+c.feature);let failure;
  try{await vm.run(compiler.compile(c.source),[c.input],{budget:4096});}catch(error){failure=error;}
  check(failure&&/^Resource limit in lane \d+, instruction -?\d+; no CPU fallback$/.test(failure.message),'Resource boundary '+c.feature+': '+failure?.message);
  boundaries.push({feature:c.feature,status:'resourceLimited',message:failure.message});
 }
 const c=phase3BigintConversionResumption;check(native(c.source,c.input)===c.expected,'Resumption oracle');
 const job=await vm.start(compiler.compile(c.source),[c.input]);let resumed,dispatches=0;
 try{do{resumed=await job.step(1);dispatches++;if(dispatches>50000)throw new Error('Resumption bound');if(dispatches%100===0)status.textContent='BigInt conversion resumption '+dispatches;}while(!resumed.done);}finally{await job.dispose();}
 check(resumed.backend==='gpu'&&Object.is(resumed.values[0],c.expected),'Resumption mismatch');
 await vm.dispose();vm=undefined;
 window.quickjsReport={backend:'gpu',nativeReferenceDifferences,programs:phase3BigintConversionCases.length+1,checked:phase3BigintConversionCases.length*inputs.length+1,resourceLimited:boundaries.length,requiredGC:phase3BigintConversionCases.filter(c=>c.requiresGC).length,resumptionDispatches:dispatches,elapsedMs:performance.now()-started,results,boundaries,method:'Fixed native oracles for constructor grammar, binary64 rounding, radix formatting, strict implicit ToNumber, text resources and retained-result GC. Guest conversions use only WGSL and guest bytecode.'};
 status.textContent='Passed';document.getElementById('report').textContent=JSON.stringify(window.quickjsReport,null,2);
}catch(error){window.quickjsError=error.name+': '+error.message+'\n'+(error.stack||'');status.textContent='Failed';document.getElementById('report').textContent=window.quickjsError;}
finally{if(vm)await vm.dispose();}
