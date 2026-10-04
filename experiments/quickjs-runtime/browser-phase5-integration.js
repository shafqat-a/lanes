import {createCompiler} from './compiler.js';
import {QuickJSGPU} from './runtime.js';
import {phase5IntegrationCases} from './phase5-integration-cases.js';
const status=document.getElementById('status'),inputs=[0,1,-1,17];
function native(source,input){const frame=document.createElement('iframe');frame.hidden=true;document.body.append(frame);try{return frame.contentWindow.Function(`return (${source})`)()(input);}finally{frame.remove();}}
function check(ok,message){if(!ok)throw new Error(message);}
let vm;
try{
 const start=performance.now(),compiler=await createCompiler();vm=await QuickJSGPU.create();const results=[];
 for(const fixture of phase5IntegrationCases){
  status.textContent=fixture.feature;check(Object.is(native(fixture.source,fixture.input),fixture.expected),`Fixed oracle ${fixture.feature}`);
  const expected=inputs.map(x=>native(fixture.source,x));let result;
  try{result=await vm.run(compiler.compile(fixture.source),inputs,{budget:4096,maxDispatches:4096});}catch(error){throw new Error(`${fixture.feature}: ${error.message}\n${fixture.source}`);}
  check(result.backend==='gpu'&&result.done,`GPU completion ${fixture.feature}`);
  for(let i=0;i<inputs.length;i++)check(Object.is(result.values[i],expected[i]),`${fixture.feature} input${inputs[i]} GPU ${result.values[i]} native ${expected[i]}`);
  if(fixture.feature==='phase5-integration-gc-builtin-roots')check(result.collections.every(n=>n>0),'GC fixture must actually collect in every lane');
  results.push({feature:fixture.feature,checked:inputs.length,maxSteps:Math.max(...result.steps),collections:Array.from(result.collections)});
 }
 await vm.dispose();vm=undefined;
 window.quickjsReport={backend:'gpu',programs:phase5IntegrationCases.length,checked:phase5IntegrationCases.length*inputs.length,fixedExpectations:phase5IntegrationCases.length,elapsedMs:performance.now()-start,results,method:'Cross-feature fixed native oracles and fresh native realms: Array string coercion, boxed numeric values, public/private mutation, builtin descriptor metadata and retained builtin values after verified GC.'};
 status.textContent='Passed';document.getElementById('report').textContent=JSON.stringify(window.quickjsReport,null,2);
}catch(error){window.quickjsError=`${error.name}: ${error.message}\n${error.stack||''}`;status.textContent='Failed';document.getElementById('report').textContent=window.quickjsError;}
finally{if(vm)await vm.dispose();}
