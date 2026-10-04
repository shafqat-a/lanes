// Host API serialization/lifecycle only. The mock does not execute guest code.
import test from 'node:test';
import assert from 'node:assert/strict';
import {QuickJSGPU} from './runtime.js';
import {packProgram,REVISION} from './program.js';
import {SNAPSHOT_WORDS} from './shader.js';
const program=packProgram({format:1,quickjs:REVISION,features:['template-to-string'],functions:[{name:'f',args:1,locals:0,refs:[],stack:1,kind:0,hasPrototype:1,strict:1,length:1,constants:[],instructions:[{pc:0,op:'return_undef',operand:0}]}]},'f');
function fixture(status,value,extra=[]){
 const words=new Uint32Array(SNAPSHOT_WORDS);words.set([status,1,0,0,...value,...extra]);const buffers=[];
 const device={lost:new Promise(()=>{}),limits:{maxStorageBufferBindingSize:1e9,maxBufferSize:1e9,maxStorageBuffersPerShaderStage:8,maxBindingsPerBindGroup:1000},pushErrorScope(){},popErrorScope(){return Promise.resolve(null);},createBindGroupLayout(){return{};},createPipelineLayout(){return{};},createShaderModule(){return {getCompilationInfo:async()=>({messages:[]})};},createComputePipelineAsync:async()=>({getBindGroupLayout(){}}),createBuffer({size}){const b={size,destroyed:0,destroy(){this.destroyed++;},mapAsync:async()=>{},getMappedRange(){return words.slice(0,size/4).buffer;},unmap(){}};buffers.push(b);return b;},createBindGroup(){return{};},queue:{writeBuffer(){},submit(){}},createCommandEncoder(){return {beginComputePass(){return {setPipeline(){},setBindGroup(){},dispatchWorkgroups(){},end(){}};},copyBufferToBuffer(){},finish(){}};}};
 return {runtime:new QuickJSGPU(device),buffers,words};
}
for(const status of [12,13])for(const [label,value,payload,expected] of [
 ['utf16',[0,4,7,0],[65,0xd800,0xdc00,0xdfff],'A\ud800\udc00\udfff'],
 ['negative-bigint',[0xffffffff,3,18,0],[7,0,1],-((1n<<64n)+7n)],
])test(`${status===12?'fulfilled':'rejected'} ${label} payload decoding`,async()=>{
 const {runtime,buffers}=fixture(status,value,payload);try{const result=await runtime.run(program,[3],{promiseResults:'settle',maxDispatches:1});assert.equal(result.done,true);assert.deepEqual(result.settlements,[status===12?'fulfilled':'rejected']);assert.deepEqual(result.values,[expected]);}finally{await runtime.dispose();}assert.ok(buffers.every(b=>b.destroyed===1));
});
test('pending settlement is terminal and has no stale value',async()=>{const{runtime}=fixture(14,[0,0,4,0]);try{const r=await runtime.run(program,[3],{promiseResults:'settle',maxDispatches:1});assert.equal(r.done,true);assert.deepEqual(r.values,[undefined]);assert.deepEqual(r.settlements,['pending']);}finally{await runtime.dispose();}});
test('settlement requires explicit host opt-in',async()=>{const{runtime,buffers}=fixture(12,[0,0,3,0]);try{await assert.rejects(runtime.run(program,[3],{maxDispatches:1}),/requires \{ promiseResults: 'settle' \}/);}finally{await runtime.dispose();}assert.ok(buffers.every(b=>b.destroyed===1));});
test('settled object remains an explicit output boundary',async()=>{const{runtime}=fixture(13,[1,0,4,0]);try{await assert.rejects(runtime.run(program,[3],{promiseResults:'settle',maxDispatches:1}),/Object\/function results/);}finally{await runtime.dispose();}});
