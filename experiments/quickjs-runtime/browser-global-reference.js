import {createCompiler} from './compiler.js';
import {QuickJSGPU} from './runtime.js';
import {globalReferenceCases,globalReferenceSpec} from './global-reference-cases.js';
const status=document.getElementById('status'),report=document.getElementById('report');
function native(source,input){const frame=document.createElement('iframe');frame.hidden=true;document.body.append(frame);try{return frame.contentWindow.Function(`return (${source})`)()(input);}finally{frame.remove();}}
function require(ok,message){if(!ok)throw new Error(message);}
let vm;
try{
 const start=performance.now(),compiler=await createCompiler();vm=await QuickJSGPU.create();const results=[],nativeDifferences=[];
 for(const item of globalReferenceCases){
  status.textContent=`Global references: ${item.feature}`;
  const inputs=[item.input,item.input+1],expected=[item.expected,item.expectedNext],observed=inputs.map(x=>native(item.source,x));
  for(let i=0;i<2;i++)if(!Object.is(observed[i],expected[i]))nativeDifferences.push({feature:item.feature,input:inputs[i],native:observed[i],normative:expected[i]});
  const result=await vm.run(compiler.compile(item.source),inputs,{budget:4096,maxDispatches:4096});
  require(result.done&&result.backend==='gpu',`${item.feature}: GPU completion required`);
  for(let i=0;i<2;i++)require(Object.is(result.values[i],expected[i]),`${item.feature}, input${inputs[i]}: GPU${result.values[i]} vs normative${expected[i]}`);
  if(item.feature==='reference-survives-gc-in-rhs')require(result.collections.every(n=>n>0),'GC reference fixture must collect in every lane');
  results.push({feature:item.feature,inputs,expected,observed,steps:result.steps,collections:result.collections});
 }
 const resumptions=[];
 for(const feature of ['strict-unresolved-created-in-callback','compound-read-before-rhs-and-write-current-binding','captured-const-tdz-rhs-throw-wins']){
  const item=globalReferenceCases.find(c=>c.feature===feature),job=await vm.start(compiler.compile(item.source),[item.input]);let result,dispatches=0;
  try{do{result=await job.step(1);if(++dispatches>60000)throw new Error(`Resumption bound: ${feature}`);if(dispatches%100===0)status.textContent=`${feature}: ${dispatches} single instructions`;}while(!result.done);}finally{await job.dispose();}
  require(result.backend==='gpu'&&Object.is(result.values[0],item.expected),`${feature}: resumption mismatch`);resumptions.push({feature,dispatches,value:result.values[0]});
 }
 window.quickjsReport={backend:'gpu',programs:results.length,checked:results.length*2,resumptions,nativeDifferences,spec:globalReferenceSpec,results,elapsedMs:performance.now()-start};status.textContent='Passed';report.textContent=JSON.stringify(window.quickjsReport,null,2);
}catch(error){window.quickjsError=`${error.name}: ${error.message}\n${error.stack||''}`;status.textContent='Failed';report.textContent=window.quickjsError;}finally{if(vm)await vm.dispose();}
