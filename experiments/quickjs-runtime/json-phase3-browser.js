import {createCompiler} from './compiler.js';
import {QuickJSGPU} from './runtime.js';
import {jsonPhase3Cases,jsonPhase3CoercionCases,jsonPhase3BigIntPendingCases} from './json-phase3-cases.js';
const status=document.getElementById('status'),inputs=[0,3,17];
function native(source,input){const frame=document.createElement('iframe');frame.hidden=true;document.body.append(frame);try{return frame.contentWindow.Function(`return (${source})`)()(input);}finally{frame.remove();}}
function check(ok,message){if(!ok)throw new Error(message);}
let vm;
try{
 const start=performance.now(),compiler=await createCompiler();vm=await QuickJSGPU.create();const results=[];
 const fixtures=jsonPhase3Cases;
 for(const c of fixtures){status.textContent=c.feature;check(Object.is(native(c.source,c.input),c.expected),`Fixed oracle ${c.feature}`);const expected=inputs.map(x=>native(c.source,x));let result;
  try{result=await vm.run(compiler.compile(c.source),inputs,{budget:4096,maxDispatches:4096});}catch(e){throw new Error(`${c.feature}: ${e.message}\n${c.source}`);}
  check(result.backend==='gpu'&&result.done,`GPU completion ${c.feature}`);for(let i=0;i<inputs.length;i++)check(Object.is(result.values[i],expected[i]),`${c.feature}: GPU ${result.values[i]}, native ${expected[i]}`);
  results.push({feature:c.feature,checked:inputs.length,maxSteps:Math.max(...result.steps)});
 }
 const boundaries=[];
 for(const c of [...jsonPhase3CoercionCases,...jsonPhase3BigIntPendingCases]){status.textContent=c.feature;check(Object.is(native(c.source,c.input),c.expected),`Pending normative oracle ${c.feature}`);let error;
  try{await vm.run(compiler.compile(c.source),[c.input],{budget:4096,maxDispatches:4096});}catch(e){error=e;}
  check(error&&/^Unsupported runtime operation in lane \d+, instruction -?\d+; no CPU fallback$/.test(error.message),`Expected explicit pending JSON conversion boundary ${c.feature}: ${error?.message}`);
  boundaries.push({feature:c.feature,nativeExpected:c.expected,status:'explicitly unsupported; not a conformance pass'});
 }
 await vm.dispose();vm=undefined;
 window.quickjsReport={backend:'gpu',programs:fixtures.length,checked:fixtures.length*inputs.length,unsupportedChecks:boundaries.length,results,boundaries,elapsedMs:performance.now()-start};
 status.textContent='Passed supported cases and explicit boundaries';document.getElementById('report').textContent=JSON.stringify(window.quickjsReport,null,2);
}catch(error){window.quickjsError=`${error.name}: ${error.message}\n${error.stack||''}`;status.textContent='Failed';document.getElementById('report').textContent=window.quickjsError;}
finally{if(vm)await vm.dispose();}
