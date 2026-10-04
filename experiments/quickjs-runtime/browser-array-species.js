import {createCompiler} from './compiler.js';
import {QuickJSGPU} from './runtime.js';
import {arraySpeciesCases,arraySpeciesResourceCases} from './array-species-cases.js';
const status=document.getElementById('status'),inputs=[0,1,-1,3];
function native(source,input){const frame=document.createElement('iframe');frame.hidden=true;document.body.append(frame);try{return frame.contentWindow.Function(`return (${source})`)()(input);}finally{frame.remove();}}
function expect(condition,message){if(!condition)throw new Error(message);}
let vm;
try{
 const started=performance.now(),compiler=await createCompiler();vm=await QuickJSGPU.create();const results=[];
 const fixtures=arraySpeciesCases.filter(c=>!c.resumption);
 for(const [index,item] of fixtures.entries()){
  status.textContent=`Array species ${index+1}/${fixtures.length}: ${item.feature}`;
  for(const input of inputs)expect(Object.is(native(item.source,input),item.expected),`${item.feature}: fixed native mismatch at ${input}`);
  let result;try{result=await vm.run(compiler.compile(item.source),inputs,{budget:4096,maxDispatches:4096});}catch(error){throw new Error(`${item.feature}: ${error.message}\n${item.source}`);}
  expect(result.backend==='gpu'&&result.done,`${item.feature}: GPU completion required`);
  for(let i=0;i<inputs.length;i++)expect(Object.is(result.values[i],item.expected),`${item.feature}: input ${inputs[i]} actual ${result.values[i]} expected ${item.expected}`);
  const gc=Math.max(...result.collections);if(item.requiresGC)expect(gc>0,`${item.feature}: GC did not execute`);
  results.push({feature:item.feature,checked:inputs.length,expected:item.expected,collections:gc,maxSteps:Math.max(...result.steps)});
 }
 const resume=arraySpeciesCases.find(c=>c.resumption);expect(native(resume.source,resume.input)===resume.expected,'Resumption fixed native mismatch');
 const job=await vm.start(compiler.compile(resume.source),[resume.input]);let final,dispatches=0;
 try{do{final=await job.step(1);dispatches++;if(dispatches>30000)throw new Error('Array species resumption instruction bound');if(dispatches%100===0)status.textContent=`Array species resumption: ${dispatches}`;}while(!final.done);}finally{await job.dispose();}
 expect(final.backend==='gpu'&&final.values[0]===resume.expected,`Array species resumption mismatch: ${final.values[0]}`);
 let resourceChecks=0;for(const item of arraySpeciesResourceCases){let caught;try{await vm.run(compiler.compile(item.source),[item.input],{budget:4096,maxDispatches:4096});}catch(error){caught=error;}
  expect(caught&&/^Resource limit in lane \d+, instruction -?\d+; no CPU fallback$/.test(caught.message),`${item.feature}: expected resource limit, got ${caught?.message}`);resourceChecks++;
 }
 window.quickjsReport={backend:'gpu',programs:results.length+1,checked:results.length*inputs.length+1,resourceChecks,requiredGC:fixtures.filter(c=>c.requiresGC).length,resumptionDispatches:dispatches,results,elapsedMs:performance.now()-started,gaps:['Proxy behavior requires the separate Proxy implementation.','Finite VM heap and execution budgets remain explicit resource boundaries.']};
 status.textContent='Passed';document.getElementById('report').textContent=JSON.stringify(window.quickjsReport,null,2);
}catch(error){window.quickjsError=`${error.name}: ${error.message}\n${error.stack||''}`;status.textContent='Failed';document.getElementById('report').textContent=window.quickjsError;}finally{if(vm)await vm.dispose();}
