import {createCompiler} from './compiler.js';
import {QuickJSGPU} from './runtime.js';
import {dispatchBoundaryCases} from './dispatch-boundary-cases.js';
import {constructorResumeCases} from './constructor-resume-cases.js';
import {prototypeMutationCases} from './prototype-mutation-cases.js';
const cases=[...dispatchBoundaryCases,...constructorResumeCases,...prototypeMutationCases];
const status=document.getElementById('status'),out=document.getElementById('report');
function check(value,message){if(!value)throw new Error(message);}
async function native(source,input){const frame=document.createElement('iframe');frame.hidden=true;document.body.append(frame);try{return await frame.contentWindow.Function(`return (${source})`)()(input);}finally{frame.remove();}}
let vm;
try{
 const start=performance.now(),compiler=await createCompiler();vm=await QuickJSGPU.create();const results=[],nativeReferenceDifferences=[];let checked=0;
 for(const c of cases){
  const inputs=[7,8],reference=await Promise.all(inputs.map(x=>native(c.source,x)));
  const expected=c.expectedForInput?inputs.map(c.expectedForInput):reference;
  check(Object.is(expected[0],c.expected),`Fixed native expectation ${c.name}`);
  for(let i=0;i<inputs.length;i++)if(!Object.is(reference[i],expected[i])){
   check(c.referenceDifference&&Object.is(reference[i],c.referenceDifference.expected),`Unexpected native reference ${c.name}: ${reference[i]}`);
   nativeReferenceDifferences.push({name:c.name,input:inputs[i],native:reference[i],normative:expected[i],spec:c.referenceDifference.spec});
  }
  const program=compiler.compile(c.source),runs=[];
  for(const budget of c.budgets){status.textContent=`${c.name}: budget ${budget}`;
   const result=await vm.run(program,inputs,{budget,maxDispatches:20000,promiseResults:'settle'});
   check(result.backend==='gpu'&&result.done,`GPU completion ${c.name}`);
   for(let i=0;i<inputs.length;i++){check(Object.is(result.values[i],expected[i]),`${c.name} budget ${budget} input ${inputs[i]}: ${result.values[i]} expected ${expected[i]}`);check(result.settlements[i]===(c.async?'fulfilled':undefined),`Settlement ${c.name}: ${result.settlements[i]}`);checked++;}
   if(c.requiresGC)check(result.collections.every(n=>n>0),`Required GC ${c.name}`);
   runs.push({budget,steps:Array.from(result.steps),collections:Array.from(result.collections)});
  }
  check(runs[0].steps.every((n,i)=>n===runs[1].steps[i]),`Guest instruction counts changed with budget: ${c.name}`);
  results.push({name:c.name,requiresGC:c.requiresGC,runs});
 }
 window.quickjsReport={backend:'gpu',programs:cases.length,checked,requiredGC:cases.filter(c=>c.requiresGC).length,singleInstructionPrograms:cases.filter(c=>c.budgets.includes(1)).length,nativeReferenceDifferences,elapsedMs:performance.now()-start,results};status.textContent='Passed';out.textContent=JSON.stringify(window.quickjsReport,null,2);
}catch(error){window.quickjsError=`${error.name}: ${error.message}\n${error.stack||''}`;status.textContent='Failed';out.textContent=window.quickjsError;}finally{if(vm)await vm.dispose();}
