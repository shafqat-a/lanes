import {createCompiler} from './compiler.js';
import {QuickJSGPU} from './runtime.js';
import {nativeWorkerOutcome} from './native-worker-oracle.js';
import {generatorCases,generatorDelegationCases} from './generator-cases.js';
const status=document.getElementById('status'),report=document.getElementById('report');
const delegation=new URLSearchParams(location.search).get('coreOnly')!=='1';
function expect(value,message){if(!value)throw new Error(message);}
let runtime;
try{
 const started=performance.now(),compiler=await createCompiler();runtime=await QuickJSGPU.create();const results=[],nativeReferenceDifferences=[];
 for(const item of [...generatorCases,...(delegation?generatorDelegationCases:[])]){
  status.textContent=`Generator: ${item.feature}`;
  const inputs=[item.input,item.input+1],expected=[item.expected,item.expectedNext];
  for(let i=0;i<2;i++){
   const reference=await nativeWorkerOutcome(item.source,inputs[i]);
   expect(!('error' in reference),`${item.feature}: native oracle ${reference.error}`);
   if(!Object.is(reference.value,expected[i])){
    const difference=item.nativeReferenceDifference;
    expect(difference&&Object.is(reference.value,difference.values[i]),`${item.feature}: unexpected native ${String(reference.value)} vs ${String(expected[i])}`);
    nativeReferenceDifferences.push({feature:item.feature,input:inputs[i],native:reference.value,normative:expected[i],spec:difference.spec,evidence:difference.evidence,note:difference.note});
   }
  }
  let result;try{result=await runtime.run(compiler.compile(item.source),inputs,{budget:4096,maxDispatches:4096});}catch(e){throw new Error(`${item.feature}: ${e.message}`);}
  expect(result.done&&result.backend==='gpu',`${item.feature}: GPU completion required`);
  for(let i=0;i<2;i++)expect(Object.is(result.values[i],expected[i]),`${item.feature}: GPU ${String(result.values[i])} vs ${String(expected[i])}`);
  if(item.feature.includes('-gc-'))expect(result.collections.every(n=>n>0),`${item.feature}: every lane must collect`);
  results.push({feature:item.feature,checked:2,expected,steps:result.steps,collections:result.collections});
 }
 const resumptions=[];
 for(const name of ['interleaved-independent-generators','finally-yield-retains-return','caught-throw-yields',...(delegation?['delegate-return-done-false-then-next','delegate-missing-throw-closes-with-no-argument']:[])]){
  const item=[...generatorCases,...generatorDelegationCases].find(c=>c.feature===name),job=await runtime.start(compiler.compile(item.source),[item.input]);let result,dispatches=0;
  try{do{result=await job.step(1);if(++dispatches>60000)throw new Error(`${name}: instruction bound`);if(dispatches%100===0)status.textContent=`${name}: ${dispatches} single-instruction dispatches`;}while(!result.done);}finally{await job.dispose();}
  expect(result.backend==='gpu'&&Object.is(result.values[0],item.expected),`${name}: resumed result mismatch`);resumptions.push({feature:name,dispatches,value:result.values[0]});
 }
 window.quickjsReport={backend:'gpu',programs:results.length,checked:results.length*2,resumptions,nativeReferenceDifferences,delegationQualified:delegation,genericIterationDependency:delegation?'included':'not exercised: requires separate iterator integration',results,elapsedMs:performance.now()-started};status.textContent='Passed';report.textContent=JSON.stringify(window.quickjsReport,null,2);
}catch(error){window.quickjsError=`${error.name}: ${error.message}\n${error.stack||''}`;status.textContent='Failed';report.textContent=window.quickjsError;}finally{if(runtime)await runtime.dispose();}
