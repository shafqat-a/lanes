import {createCompiler} from './compiler.js';
import {QuickJSGPU} from './runtime.js';
const status=document.getElementById('status'),inputs=[0n,1n,-1n,0xffffffffn,0x100000000n,-9007199254740993n,(1n<<1023n)+3n,-((1n<<1023n)+3n)];
const fixtures=[
 ['identity','function f(x){return x;}',x=>x],
 ['addition','function f(x){return x+123n;}',x=>x+123n],
 ['subtraction','function f(x){return x-123n;}',x=>x-123n],
 ['multiplication','function f(x){return x*7n;}',x=>x*7n],
 ['negation','function f(x){return -x;}',x=>-x],
 ['retained after GC','function f(x){const held={x};for(let i=0;i<1000;i++){const garbage={i};}return held.x;}',x=>x,true],
];
const check=(ok,text)=>{if(!ok)throw new Error(text);};let vm;
try{
 const compiler=await createCompiler();vm=await QuickJSGPU.create();const results=[];let checked=0;
 for(const [feature,source,oracle,gc] of fixtures){
  status.textContent=feature;const result=await vm.run(compiler.compile(source),inputs,{budget:4096,maxDispatches:4096});
  check(result.backend==='gpu'&&result.done,feature+': GPU completion');
  for(let i=0;i<inputs.length;i++)check(result.values[i]===oracle(inputs[i]),feature+': exact BigInt value lane '+i);
  if(gc)check(result.collections.every(n=>n>0),feature+': collection required');
  checked+=inputs.length;results.push({feature,checked:inputs.length,collections:Array.from(result.collections)});
 }
 const max=(1n<<2048n)-1n,identity=compiler.compile('function f(x){return x;}');
 const limits=await vm.run(identity,[max,-max]);check(limits.values[0]===max&&limits.values[1]===-max,'2048-bit transfer');checked+=2;
 let inputLimits=0;for(const value of [max+1n,-max-1n]){try{await vm.run(identity,[value]);throw new Error('Oversized input admitted');}catch(error){check(error instanceof RangeError&&/64 limbs/.test(error.message),'input limit error');inputLimits++;}}
 const job=await vm.start(compiler.compile('function f(x){return (x+3n)*7n;}'),[-9007199254740993n]);let result,dispatches=0;
 try{do{result=await job.step(1);if(++dispatches>5000)throw new Error('Resumption bound');}while(!result.done);}finally{await job.dispose();}
 check(result.backend==='gpu'&&result.values[0]===(-9007199254740993n+3n)*7n,'resumed BigInt output');checked++;
 await vm.dispose();vm=undefined;
 window.quickjsReport={backend:'gpu',programs:fixtures.length+2,checked,inputLimitChecks:inputLimits,resumptionDispatches:dispatches,results,method:'Host BigInt used only to marshal API values and as independent test oracle; all guest arithmetic executes through WGSL.'};
 status.textContent='Passed';document.getElementById('report').textContent=JSON.stringify(window.quickjsReport,null,2);
}catch(error){window.quickjsError=error.stack;status.textContent='Failed';}finally{await vm?.dispose();}
