import test from 'node:test';import assert from 'node:assert/strict';
import {planDynamicAppend,validateDynamicAppendPayload} from './dynamic-append-plan.js';
const arena={functionCount:300,functionCapacity:512,codeRows:30000,codeCapacity:40000,imageRows:5000,imageCapacity:10000};
test('append reservations never shift old code, image or function identities',()=>{
 const p=planDynamicAppend(arena,{functions:2,codeRows:12,imageRows:20});
 assert.equal(p.functionBase,300);assert.equal(p.functionTableStart,600);assert.equal(p.codeStart,30000);assert.equal(p.imageStart,5000);
 const q=planDynamicAppend(p.next,{functions:1,codeRows:2,imageRows:3});assert.equal(q.functionBase,302);assert.equal(q.codeStart,30012);assert.equal(q.imageStart,5020);assert.equal(arena.codeRows,30000);
 assert.throws(()=>planDynamicAppend({...arena,imageRows:100},{functions:1,codeRows:1,imageRows:1}),/prefix/);
 assert.throws(()=>planDynamicAppend(arena,{functions:213,codeRows:1,imageRows:1}),RangeError);
});
test('owned payload snapshots reject old-code or old-image overwrite metadata',()=>{
 const p=planDynamicAppend(arena,{functions:1,codeRows:2,imageRows:3});
 const payload={code:new Uint32Array(8),image:new Uint32Array(12),functions:new Uint32Array([30000,0,0,0,5001,0,0,0])};
 const v=validateDynamicAppendPayload(p,payload);payload.code[0]=99;assert.equal(v.code[0],0);
 payload.functions[0]=29999;assert.throws(()=>validateDynamicAppendPayload(p,payload),/escapes/);
 payload.functions[0]=30000;payload.functions[4]=4999;assert.throws(()=>validateDynamicAppendPayload(p,payload),/escapes/);
});
