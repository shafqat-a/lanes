import {createCompiler} from './compiler.js';
import {QuickJSGPU} from './runtime.js';
import {scriptEntryCases,scriptEntryRejectedCases} from './script-entry-cases.js';
const status=document.getElementById('status'),out=document.getElementById('report');
const report={backend:'gpu',scope:'fresh-realm scripts',programs:0,checked:0,negativeChecks:0,gcProbes:[],resumptions:[],failures:[]};
let vm;
try{
 const compiler=await createCompiler();vm=await QuickJSGPU.create();
 for(const c of scriptEntryRejectedCases){
  let error;try{compiler.compileScript(c.source);}catch(e){error=e;}
  if(error instanceof SyntaxError)report.negativeChecks++;
  else report.failures.push({name:c.name,message:error?.message??'Expected compile rejection'});
 }
 for(const c of scriptEntryCases){
  const runs=[];let program;
  try{program=compiler.compileScript(c.source);}catch(e){report.failures.push({name:c.name,message:e.message});continue;}
  for(const budget of c.budgets){
   status.textContent=`${c.name}: budget ${budget}`;
   try{
    const r=await vm.run(program,c.inputs,{budget,maxDispatches:100000});
    if(r.backend!=='gpu'||!r.done)throw new Error('GPU completion required');
    for(let i=0;i<c.inputs.length;i++){
     if(!Object.is(r.values[i],c.expected))throw new Error(`lane ${i}: GPU ${String(r.values[i])}, expected ${String(c.expected)}`);
     report.checked++;
    }
    if(c.requiresGC&&!r.collections.every(n=>n>0))throw new Error('Required GC did not occur');
    runs.push({budget,steps:r.steps,collections:r.collections});
   }catch(e){report.failures.push({name:c.name,budget,message:e.message});}
  }
  if(runs.length===c.budgets.length){
   report.programs++;
   if(runs[0].steps.some((n,i)=>n!==runs[1].steps[i]))report.failures.push({name:c.name,message:'Instruction counts differ by budget'});
   report.resumptions.push({name:c.name,runs});
   if(c.requiresGC)report.gcProbes.push({name:c.name,runs});
  }
 }
 if(report.failures.length)throw new Error(`${report.failures.length} Script entry failures`);
 window.quickjsReport=report;status.textContent='Passed';out.textContent=JSON.stringify(report,null,2);
}catch(e){window.quickjsFailedReport=report;window.quickjsError=`${e.name}: ${e.message}\n${JSON.stringify(report)}\n${e.stack||''}`;status.textContent='Failed';out.textContent=window.quickjsError;}
finally{if(vm)await vm.dispose();}
