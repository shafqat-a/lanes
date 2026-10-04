import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {promiseSuite,optionalCaseModules,normalizeCase} from './promise-gpu-suite.js';
import {allowedNativePromiseValue} from './native-promise-worker-oracle.js';
const records=[...promiseSuite.records];
for(const path of optionalCaseModules)for(const [name,value] of Object.entries(await import(path))){
 if(!Array.isArray(value)||!value.some(r=>r&&typeof r.source==='string'))continue;
 for(const item of value)if(item&&typeof item.source==='string')records.push(normalizeCase(item,`${path.slice(2,-3)}/${name}`,/Boundary/.test(name)));
}
assert.equal(records.length,583);
const evidence=JSON.parse(readFileSync(new URL('../bootstrap/evidence/quickjs-safari-promise-species-pristine-native.json',import.meta.url)));
const selected=records.filter(r=>r.nativeEvidence==='quickjs-safari-promise-species-pristine-native.json');
assert.equal(selected.length,5);let checks=0;
for(const item of selected)for(const [i,input] of item.inputs.entries()){
 const row=evidence.report.rows.find(r=>r.name===item.name&&Object.is(r.input,input));assert.ok(row,item.name);
 assert.equal(row.expected,item.expected[i]);assert.equal(row.settlement,item.settlement);
 assert.ok(allowedNativePromiseValue(item,input,row.native));
 assert.ok(!Object.is(row.native.value,item.expected[i]),'GPU oracle remains normative');
 assert.ok(!allowedNativePromiseValue(item,99,row.native));
 assert.ok(!allowedNativePromiseValue(item,input,{...row.native,value:'unobserved'}));
 assert.ok(!allowedNativePromiseValue(item,input,{...row.native,settlement:'rejected'}));
 assert.ok(!allowedNativePromiseValue(item,input,{...row.native,nativeError:'error'}));
 assert.ok(!allowedNativePromiseValue({...item,expected:undefined},input,row.native));
 assert.ok(!allowedNativePromiseValue({...item,hasSettlement:false},input,row.native));
 assert.ok(item.spec.startsWith('https://tc39.es/ecma262/2025/'));checks+=10;
}
const aggregate=records.find(r=>r.name.endsWith(':any-all-rejected-aggregate'));
assert.deepEqual(aggregate.expected,['true:true:a,b3:string:0:false','true:true:a,b4:string:0:false']);
assert.equal(aggregate.allowedNativeExpected,undefined);
console.log(JSON.stringify({records:records.length,exactObservedFixtures:selected.length,checks,aggregateMessageWordingUnconstrained:true,gpuExpectationsUnchanged:true,gpuExecuted:false}));
