import {createCompiler} from './compiler.js';
import {QuickJSGPU} from './runtime.js';
import {dispatchStateMachineCases} from './dispatch-state-machine-cases.js';
import {sharedFinishCases} from './shared-finish-cases.js';
const fixtures=[...dispatchStateMachineCases,...sharedFinishCases];
const status=document.getElementById('status'),out=document.getElementById('report');
function check(v,message){if(!v)throw new Error(message);}
async function native(c){const frame=document.createElement('iframe');frame.hidden=true;document.body.append(frame);try{return await frame.contentWindow.Function(`return (${c.source})`)()(c.input);}finally{frame.remove();}}
let vm;const jobs=new Set();
try{
 const start=performance.now(),compiler=await createCompiler();vm=await QuickJSGPU.create();const results=[],nativeReferenceDifferences=[];
 for(const c of fixtures){
  status.textContent=c.feature;const reference=await native(c);
  if(!Object.is(reference,c.expected)){
   check(c.referenceDifference&&Object.is(reference,c.referenceDifference.expected),`${c.feature}: fixed native oracle: ${reference}, expected ${c.expected}`);
   nativeReferenceDifferences.push({feature:c.feature,native:reference,normative:c.expected,spec:c.referenceDifference.spec});
  }
  const program=compiler.compile(c.source);let fast;
  try{fast=await vm.run(program,[c.input],{promiseResults:'settle',budget:4096,maxDispatches:4096});}catch(e){throw new Error(`${c.feature}: ${e.name}: ${e.message}\n${e.stack||''}`);}
  check(fast.backend==='gpu'&&fast.done&&Object.is(fast.values[0],c.expected)&&fast.settlements[0]===c.settlement,`${c.feature}: result/settlement`);
  if(c.expectedSteps!==undefined)check(fast.steps[0]===c.expectedSteps,`${c.feature}: expected ${c.expectedSteps} guest instructions, got ${fast.steps[0]}`);
  if(c.requiresGC)check(fast.collections[0]>0,`${c.feature}: collection required`);
  let dispatches=0;
  if(c.resumption){const job=await vm.start(program,[c.input],{promiseResults:'settle'});jobs.add(job);let slow;try{do{slow=await job.step(1);check(++dispatches<=50000,`${c.feature}: dispatch bound`);}while(!slow.done);}finally{await job.dispose();jobs.delete(job);}
   check(slow.backend==='gpu'&&Object.is(slow.values[0],c.expected)&&slow.settlements[0]===c.settlement,`${c.feature}: step(1) result`);
   check(slow.steps[0]===fast.steps[0],`${c.feature}: budgets changed guest instruction count ${slow.steps[0]} vs ${fast.steps[0]}`);
  }
  results.push({feature:c.feature,steps:fast.steps[0],collections:fast.collections[0],resumptionDispatches:dispatches});
 }
 window.quickjsReport={backend:'gpu',programs:results.length,checked:results.length+results.filter(r=>r.resumptionDispatches).length,results,nativeReferenceDifferences,elapsedMs:performance.now()-start};status.textContent='Passed';out.textContent=JSON.stringify(window.quickjsReport,null,2);
}catch(e){window.quickjsError=`${e.name}: ${e.message}\n${e.stack||''}`;status.textContent='Failed';out.textContent=window.quickjsError;}finally{for(const job of jobs)await job.dispose();if(vm)await vm.dispose();}
