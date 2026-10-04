import { createCompiler } from './compiler.js';
import { QuickJSGPU } from './runtime.js';
import { stringExtractCases, stringExtractNegativeSources, stringExtractResumptionSource, stringExtractResumptionExpected, stringExtractTaggedTemplateSources, stringExtractCompilerGapCases, stringExtractUnsupportedCases } from './string-extract-cases.js';
const status=document.getElementById('status'),inputs=[0,1,-1,17];
function nativeResult(source,input){
 const frame=document.createElement('iframe');frame.hidden=true;document.body.append(frame);
 try{return frame.contentWindow.Function(`return (${source})`)()(input);}finally{frame.remove();}
}
function expect(condition,message){if(!condition)throw new Error(message);}
// Compare thrown primitives and error names inside the guest, preserving
// identity checks for TypeError while avoiding cross-realm Error constructors.
const exceptionPrograms=stringExtractNegativeSources.map(source=>`function f(x){const run=(${source});try{run(x);return "did-not-throw";}catch(e){if(e instanceof TypeError)return "TypeError";return "thrown:"+e;}}`);
const sources=[...stringExtractCases,...exceptionPrograms];
let vm;
try{
 const started=performance.now(),compiler=await createCompiler();
 // Formerly rejected tagged templates are admitted: they are in stringExtractCases
 // and run below on the GPU against fresh native iframe realms with the same inputs.
 for(const source of stringExtractTaggedTemplateSources)expect(sources.includes(source),`Tagged template program not run on GPU: ${source}`);
 vm=await QuickJSGPU.create();const results=[];
 // Former compiler gaps: fixed ES2025 expectations, not native references.
 for(const fixture of stringExtractCompilerGapCases){
  const result=await vm.run(compiler.compile(fixture.source),[fixture.input],{budget:4096,maxDispatches:4096});
  expect(result.backend==='gpu'&&result.done&&Object.is(result.values[0],fixture.expected),`Template fixture ${fixture.feature}: GPU ${result.values[0]}, expected ${fixture.expected}`);
  results.push({feature:fixture.feature,checked:1,maxSteps:result.steps[0],collections:result.collections[0]});
 }
 for(const [index,source] of sources.entries()){
  status.textContent=`GPU String extraction ${index+1}/${sources.length}`;
  const expected=inputs.map(input=>nativeResult(source,input));
  let result;try{result=await vm.run(compiler.compile(source),inputs,{budget:4096,maxDispatches:4096});}catch(error){throw new Error(`Program ${index}: ${error.message}\n${source}`);}
  expect(result.backend==='gpu'&&result.done,`GPU completion required ${index}`);
  for(let i=0;i<inputs.length;i++)expect(Object.is(result.values[i],expected[i]),`Program ${index}, input ${inputs[i]}: GPU ${result.values[i]}, native ${expected[i]}\n${source}`);
  results.push({index,checked:inputs.length,maxSteps:Math.max(...result.steps),collections:Math.max(...result.collections)});
 }
 let unsupportedChecks=0;
 for(const fixture of stringExtractUnsupportedCases){
  expect(Object.is(nativeResult(fixture.source,fixture.input),fixture.expected),'Unsupported fixture native oracle mismatch');
  let error;try{await vm.run(compiler.compile(fixture.source),[fixture.input],{budget:4096,maxDispatches:4096});}catch(caught){error=caught;}
  expect(error&&/Unsupported runtime operation/.test(error.message)&&/no CPU fallback/.test(error.message),`Expected explicit unsupported ${fixture.reason}: ${error?.message}`);unsupportedChecks++;
 }
 expect(nativeResult(stringExtractResumptionSource,17)===stringExtractResumptionExpected,'Fixed native resumption mismatch');
 const job=await vm.start(compiler.compile(stringExtractResumptionSource),[17]);let resumed,dispatches=0;
 try{do{resumed=await job.step(1);if(++dispatches>40000)throw new Error('String extraction resumption bound');if(dispatches%100===0)status.textContent=`String extraction resumption ${dispatches}`;}while(!resumed.done);}finally{await job.dispose();}
 expect(resumed.backend==='gpu'&&resumed.values[0]===stringExtractResumptionExpected,`Resumption mismatch ${resumed.values[0]}`);
 await vm.dispose();vm=undefined;
 window.quickjsReport={backend:'gpu',compiler:'QuickJS/Wasm',programs:sources.length+1,checked:sources.length*inputs.length+1,exceptionPrograms:exceptionPrograms.length,taggedTemplatePrograms:stringExtractTaggedTemplateSources.length,unsupportedChecks,resumptionDispatches:dispatches,resumptionExpected:stringExtractResumptionExpected,elapsedMs:performance.now()-started,results,method:'concat, substring and Annex B substr compared with fresh native realms; guest exception identity and thrown values, private span extraction despite prototype mutation, and one-instruction resumption.',templateGapFixtures:stringExtractCompilerGapCases.length,gaps:['Symbols, BigInt and custom Symbol.toPrimitive unsupported','String results limited to256 UTF-16 units']};
 status.textContent='Passed';document.getElementById('report').textContent=JSON.stringify(window.quickjsReport,null,2);
}catch(error){window.quickjsError=`${error.name}: ${error.message}\n${error.stack||''}`;status.textContent='Failed';document.getElementById('report').textContent=window.quickjsError;}
finally{if(vm)await vm.dispose();}
