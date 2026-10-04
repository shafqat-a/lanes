import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeDynamicCompileRequest as encode,decodeDynamicCompileRequest as decode,DynamicCompileService} from './dynamic-compile-request.js';
const packet=(requestId=1,lane=0)=>encode({requestId,lane,parameters:['x'],body:'return x+1'});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
test('owned UTF16 snapshots preserve strings and reject malformed wire data',()=>{
 const w=encode({requestId:4,lane:2,parameters:['a="😀"'],body:'return a'}),r=decode(w,3);w.fill(0);
 assert.equal(r.parameters[0],'a="😀"');assert.equal(r.body,'return a');assert(Object.isFrozen(r.parameters));
 for(const [index,value] of [[0,0],[1,2],[2,0],[3,1],[4,9],[5,100],[6,8],[7,1],[8,257],[9,65536]]){const b=packet();b[index]=value;assert.throws(()=>decode(b,1));}
 const b=packet();assert.throws(()=>decode(b.subarray(0,b.length-1),1));
});
test('duplicate identity rejected; lanes are independent; syntax is a guest completion',async()=>{
 const service=new DynamicCompileService({compileFunction(p,b){if(b==='bad')throw new SyntaxError('bad body');return {p,b};}},{laneCount:2});
 assert.equal((await service.request(packet())).completion,'compiled');
 await assert.rejects(service.request(packet()),/Duplicate/);
 assert.equal((await service.request(packet(1,1))).lane,1);
 const r=await service.request(encode({requestId:2,lane:0,parameters:[],body:'bad'}));assert.equal(r.completion,'syntax-error');
 service.dispose();await assert.rejects(service.request(packet(3)),/disposed/);
});
test('queued cancellation is prompt and never invokes compiler',async()=>{
 const d=deferred();let calls=0;const service=new DynamicCompileService({compileFunction(){calls++;return d.promise;}});
 const first=service.request(packet());await Promise.resolve();const abort=new AbortController();
 const second=service.request(packet(2),{signal:abort.signal});abort.abort(new Error('canceled'));
 await assert.rejects(second,/canceled/);assert.equal(calls,1);d.resolve({});await first;
 await new Promise(resolve=>setTimeout(resolve,0));assert.equal(calls,1);service.dispose();
});
test('active abort does not overlap compiler calls or publish a late response',async()=>{
 const d=deferred();let calls=0;const service=new DynamicCompileService({compileFunction(){return ++calls===1?d.promise:{second:true};}});
 const abort=new AbortController(),first=service.request(packet(),{signal:abort.signal});await Promise.resolve();
 abort.abort(new Error('abort active'));await assert.rejects(first,/abort active/);
 const second=service.request(packet(2));await Promise.resolve();assert.equal(calls,1);
 d.resolve({late:true});assert.equal((await second).artifact.second,true);assert.equal(calls,2);service.dispose();
});
test('dispose interrupts active and queued requests and observes late compiler rejection',async()=>{
 const d=deferred();let calls=0;const service=new DynamicCompileService({compileFunction(){calls++;return d.promise;}});
 const first=service.request(packet());await Promise.resolve();const second=service.request(packet(2));
 service.dispose();await assert.rejects(first,/disposed/);await assert.rejects(second,/disposed/);
 d.reject(new Error('late compiler error'));await new Promise(resolve=>setTimeout(resolve,0));assert.equal(calls,1);
});
test('host compiler malfunction is not a catchable guest syntax error',async()=>{
 const service=new DynamicCompileService({compileFunction(){throw new Error('compiler disconnected');}});
 await assert.rejects(service.request(packet()),/compiler disconnected/);service.dispose();
});
