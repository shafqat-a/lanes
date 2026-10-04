import {createCompiler} from './compiler.js';
import {QuickJSGPU} from './runtime.js';
import {propertyKeyConversionSources,propertyKeyConversionResumptionSource,propertyKeyConversionUnsupportedSources,propertyKeyNormativeExpectations} from './property-key-conversion-cases.js';
const status=document.getElementById('status'),inputs=[0,1,-1,17];
function oracle(source,input){const frame=document.createElement('iframe');frame.hidden=true;document.body.append(frame);try{return frame.contentWindow.Function(`return (${source})`)()(input);}finally{frame.remove();}}
function expect(condition,message){if(!condition)throw new Error(message);}
let vm;
try{
 const compiler=await createCompiler();vm=await QuickJSGPU.create();const results=[],nativeReferenceDifferences=[];const started=performance.now();
 for(const [index,source]of propertyKeyConversionSources.entries()){
  status.textContent=`Property key conversion ${index+1}/${propertyKeyConversionSources.length}`;
  const native=inputs.map(input=>oracle(source,input)),normative=propertyKeyNormativeExpectations.get(source);
  const expected=normative?inputs.map(normative.expectedForInput):native;
  if(normative&&native.some((value,i)=>!Object.is(value,expected[i])))nativeReferenceDifferences.push({index,source,native,expected,spec:normative.spec,note:normative.note});
  let result;
  try{result=await vm.run(compiler.compile(source),inputs,{budget:4096,maxDispatches:4096});}catch(error){throw new Error(`Case ${index}: ${error.message}\n${source}`);}
  expect(result.backend==='gpu'&&result.done,`Case ${index} requires GPU`);
  for(let i=0;i<inputs.length;i++)expect(Object.is(result.values[i],expected[i]),`Case ${index},input ${inputs[i]}: GPU ${result.values[i]},native ${expected[i]}\n${source}`);
  if(index===propertyKeyConversionSources.length-1)expect(result.collections.some(count=>count>0),'GC stress did not collect');
  results.push({index,checked:inputs.length,maxSteps:Math.max(...result.steps),collections:Math.max(...result.collections)});
 }
 let unsupportedChecks=0;
 for(const source of propertyKeyConversionUnsupportedSources){let error;try{await vm.run(compiler.compile(source),[17],{budget:4096});}catch(e){error=e;}expect(error&&/Unsupported runtime operation/.test(error.message)&&/no CPU fallback/.test(error.message),`Expected explicit key-encoding limit,got ${error?.message}`);unsupportedChecks++;}
 const expected=oracle(propertyKeyConversionResumptionSource,17),job=await vm.start(compiler.compile(propertyKeyConversionResumptionSource),[17]);let result,dispatches=0;
 try{do{result=await job.step(1);if(++dispatches>20000)throw new Error('Key conversion resumption instruction limit');if(dispatches%100===0)status.textContent=`Key callback resumption ${dispatches}`;}while(!result.done);}finally{await job.dispose();}
 expect(result.backend==='gpu'&&Object.is(result.values[0],expected),`Resumption mismatch: GPU ${result.values[0]},native ${expected}`);
 await vm.dispose();vm=undefined;
 window.quickjsReport={backend:'gpu',compiler:'QuickJS/Wasm',programs:propertyKeyConversionSources.length+1,checked:propertyKeyConversionSources.length*inputs.length+1,unsupportedChecks,resumptionDispatches:dispatches,resumptionExpected:expected,elapsedMs:performance.now()-started,results,nativeReferenceDifferences,method:'Ordinary ToPropertyKey and primitive conversion on GPU, fresh-native differential checks, callback and GC retention plus single-instruction resumption.',gaps:['Symbols/BigInt and custom @@toPrimitive']};
 status.textContent='Passed';document.getElementById('report').textContent=JSON.stringify(window.quickjsReport,null,2);
}catch(error){window.quickjsError=`${error.name}: ${error.message}\n${error.stack||''}`;status.textContent='Failed';document.getElementById('report').textContent=window.quickjsError;}
finally{if(vm)await vm.dispose();}
