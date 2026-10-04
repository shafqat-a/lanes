import {createCompiler} from './compiler.js';
import {QuickJSGPU} from './runtime.js';
import {arrayFlattenCases,arrayFlattenResourceCases} from './array-flatten-cases.js';
import {arraySpliceCases} from './array-splice-cases.js';
import {nativeWorkerOutcome} from './native-worker-oracle.js';
const status=document.getElementById('status'),output=document.getElementById('report');
const singleStep=new Set(['flatten:flat-depth-before-species','flatten:flatmap-callback-order','splice:ordinary']);
const report={backend:'gpu',programs:0,checked:0,negativeChecks:0,resumptions:[],gcProbes:[],nativeReferenceDifferences:[],failures:[]};
let vm;
try{
 const compiler=await createCompiler();vm=await QuickJSGPU.create();
 for(const c of [...arrayFlattenCases,...arraySpliceCases]){
  status.textContent=c.name;
  const expected=[];
  for(const input of c.inputs){
   const native=await nativeWorkerOutcome(c.source,input);
   if('error' in native)throw new Error(`${c.name}: native ${native.error}`);
   const value=Object.hasOwn(c,'expected')?c.expected:native.value;
   if(!Object.is(value,native.value)){
    if(!c.nativeReferenceDifference||!Object.is(native.value,c.allowedNativeExpected))throw new Error(`${c.name}: unexpected native mismatch`);
    report.nativeReferenceDifferences.push({name:c.name,input,native:native.value,expected:value,spec:c.spec});
   }
   expected.push(value);
  }
  const program=compiler.compile(c.source),budgets=c.requiresGC?[31,4096]:singleStep.has(c.name)?[1,4096]:[4096];
  const runs=[];
  for(const budget of budgets){
   status.textContent=`${c.name}: budget ${budget}`;
   try{
    const r=await vm.run(program,c.inputs,{budget,maxDispatches:100000});
    if(!r.done||r.backend!=='gpu')throw new Error('GPU completion required');
    for(let i=0;i<c.inputs.length;i++){
     if(!Object.is(r.values[i],expected[i]))throw new Error(`input ${c.inputs[i]}: GPU ${String(r.values[i])}, expected ${String(expected[i])}`);
     report.checked++;
    }
    if(c.requiresGC&&!r.collections.every(n=>n>0))throw new Error('Required GC did not occur');
    runs.push({budget,steps:r.steps,collections:r.collections});
   }catch(e){report.failures.push({name:c.name,budget,message:e.message});}
  }
  if(runs.length===budgets.length){
   report.programs++;
   if(runs.length>1){
    if(runs[0].steps.some((n,i)=>n!==runs[1].steps[i]))report.failures.push({name:c.name,message:'Instruction count changed with budget'});
    report.resumptions.push({name:c.name,runs});
   }
   if(c.requiresGC)report.gcProbes.push({name:c.name,runs});
  }
 }
 for(const c of arrayFlattenResourceCases){
  status.textContent=c.name;let error;
  try{await vm.run(compiler.compile(c.source),[c.input],{budget:4096,maxDispatches:100000});}catch(e){error=e;}
  if(error&&/Resource limit/.test(error.message)&&/no CPU fallback/.test(error.message))report.negativeChecks++;
  else report.failures.push({name:c.name,message:error?.message??'Expected resource boundary'});
 }
 if(report.failures.length)throw new Error(`${report.failures.length} Array completion failures`);
 window.quickjsReport=report;status.textContent='Passed';output.textContent=JSON.stringify(report,null,2);
}catch(e){window.quickjsFailedReport=report;window.quickjsError=`${e.name}: ${e.message}\n${JSON.stringify(report)}\n${e.stack||''}`;status.textContent='Failed';output.textContent=window.quickjsError;}
finally{if(vm)await vm.dispose();}
