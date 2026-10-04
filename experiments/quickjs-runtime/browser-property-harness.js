import {createCompiler} from './compiler.js';
import {QuickJSGPU} from './runtime.js';
import {wrapPropertyTest262, upstreamHarnessRevision} from './test262-property-harness.js';

const fixtures = [
  ['data-descriptor', 'const o={x:1};verifyProperty(o,"x",{value:1,writable:true,enumerable:true,configurable:true});'],
  ['readonly', 'const o={};Object.defineProperty(o,"x",{value:7});verifyProperty(o,"x",{value:7,writable:false,enumerable:false,configurable:false});'],
  ['restore', 'const o={x:3};verifyProperty(o,"x",{value:3,writable:true,enumerable:true,configurable:true},{restore:true});assert.sameValue(o.x,3);'],
  ['negative-assertion', 'const o={x:1};assert.throws(Test262Error,function(){verifyProperty(o,"x",{value:2});});'],
  ['symbol-key', 'const key=Symbol("x"),o={};Object.defineProperty(o,key,{value:4,writable:true,enumerable:false,configurable:true});verifyProperty(o,key,{value:4,writable:true,enumerable:false,configurable:true},{restore:true});'],
  ['signed-zero', 'const o={x:-0};verifyProperty(o,"x",{value:-0},{restore:true});assert.throws(Test262Error,function(){verifyProperty(o,"x",{value:0});});'],
];
let vm;
try {
  const compiler=await createCompiler(); vm=await QuickJSGPU.create();
  const records=[];
  for(const [name,body] of fixtures) for(const strict of [false,true]) {
    document.getElementById('status').textContent=`${name} ${strict?'strict':'sloppy'}`;
    const original=`/*---\nincludes: [propertyHelper.js]\n---*/\n${body}`;
    const source=wrapPropertyTest262(original,strict);
    const result=await vm.run(compiler.compile(source),[0],{budget:4096,maxDispatches:4096});
    if(result.backend!=='gpu'||!result.done||result.values[0]!==true) throw new Error(`${name}/${strict}: GPU assertion failed`);
    records.push({name,strict,status:'passed',steps:Array.from(result.steps)});
  }
  window.quickjsReport={backend:'gpu',programs:records.length,checked:records.length,harnessRevision:upstreamHarnessRevision,
    fullTest262:false,note:'Directed upstream propertyHelper verification; function-adapted harness, not full Script conformance.',records};
  document.getElementById('status').textContent='Passed';
  document.getElementById('report').textContent=JSON.stringify(window.quickjsReport,null,2);
} catch(error) { window.quickjsError=`${document.getElementById('status').textContent}: ${error.name}: ${error.message}\n${error.stack||''}`;document.getElementById('status').textContent='Failed'; }
finally { if(vm)await vm.dispose(); }
