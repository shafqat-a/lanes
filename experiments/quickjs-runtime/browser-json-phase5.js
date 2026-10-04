import {createCompiler} from './compiler.js';
import {QuickJSGPU} from './runtime.js';
import {jsonPhase5Cases,jsonPhase5SyntaxSources,jsonPhase5ResumptionSource,jsonPhase5ResumptionExpected,jsonPhase5ReviverCoercionSource,jsonPhase5ResourceCases} from './json-phase5-cases.js';
const status=document.getElementById('status'),inputs=[0,1,-1,17];
const fixtures=[...jsonPhase5Cases,{feature:"json-reviver-source-coercion-identity",source:jsonPhase5ReviverCoercionSource,input:17,expected:"true:0:17"},...jsonPhase5SyntaxSources.map((source,i)=>({feature:'json-syntax-'+i,source,input:17,expected:true}))];
function native(source,input){const frame=document.createElement('iframe');frame.hidden=true;document.body.append(frame);try{return frame.contentWindow.Function(`return (${source})`)()(input);}finally{frame.remove();}}
function check(ok,message){if(!ok)throw new Error(message);}
let vm;
try{
 const start=performance.now(),compiler=await createCompiler();vm=await QuickJSGPU.create();const results=[];
 for(const fixture of fixtures){
  status.textContent=fixture.feature;check(Object.is(native(fixture.source,fixture.input),fixture.expected),`Fixed oracle ${fixture.feature}`);
  const expected=inputs.map(x=>native(fixture.source,x));let result;
  try{result=await vm.run(compiler.compile(fixture.source),inputs,{budget:4096,maxDispatches:4096});}catch(error){throw new Error(`${fixture.feature}: ${error.message}\n${fixture.source}`);}
  check(result.backend==='gpu'&&result.done,`GPU completion ${fixture.feature}`);
  for(let i=0;i<inputs.length;i++)check(Object.is(result.values[i],expected[i]),`${fixture.feature} input${inputs[i]} GPU ${result.values[i]} native ${expected[i]}`);
  results.push({feature:fixture.feature,checked:inputs.length,maxSteps:Math.max(...result.steps),collections:Math.max(...result.collections)});
 }
 let resourceLimited=0;
 for(const fixture of jsonPhase5ResourceCases){check(Object.is(native(fixture.source,fixture.input),fixture.expected),'Resource fixture native oracle');let failure;
  try{await vm.run(compiler.compile(fixture.source),[fixture.input],{budget:4096,maxDispatches:256});}catch(caught){failure=caught;}
  check(failure&&/^Resource limit in lane \d+, instruction -?\d+; no CPU fallback$/.test(failure.message),`Expected nested JSON resource boundary: ${failure?.message}`);resourceLimited++;
 }
 check(native(jsonPhase5ResumptionSource,17)===jsonPhase5ResumptionExpected,'Resumption fixed oracle');
 const job=await vm.start(compiler.compile(jsonPhase5ResumptionSource),[17]);let resumed,dispatches=0;
 try{do{resumed=await job.step(1);if(++dispatches>50000)throw new Error('Resumption dispatch bound');if(dispatches%100===0)status.textContent=`JSON resumption ${dispatches}`;}while(!resumed.done);}finally{await job.dispose();}
 check(resumed.backend==='gpu'&&resumed.values[0]===jsonPhase5ResumptionExpected,`Resumption mismatch ${resumed.values[0]}`);
 await vm.dispose();vm=undefined;
 window.quickjsReport={backend:'gpu',programs:fixtures.length+1,checked:fixtures.length*inputs.length+1,syntaxIdentityPrograms:jsonPhase5SyntaxSources.length,unsupportedChecks:0,resourceLimited,resumptionDispatches:dispatches,elapsedMs:performance.now()-start,results,method:'JSON grammar and guest SyntaxError compared with fresh native realms and fixed expectations; data-property creation, UTF-16 escapes/lone surrogates, source-coercion exception identity before reviver callbacks, and one-instruction resumption.',gaps:['ES2025 two-argument reviver semantics; newer source context is outside this target','Guest string, heap and frame limits remain resource boundaries']};
 status.textContent='Passed';document.getElementById('report').textContent=JSON.stringify(window.quickjsReport,null,2);
}catch(error){window.quickjsError=`${error.name}: ${error.message}\n${error.stack||''}`;status.textContent='Failed';document.getElementById('report').textContent=window.quickjsError;}
finally{if(vm)await vm.dispose();}
