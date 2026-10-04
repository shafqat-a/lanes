import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {classifyPropertyTest262,wrapPropertyTest262,propertyHarnessPlan,test262Variants} from './test262-property-harness.js';
import {upstreamHarnessSources,upstreamHarnessRevision} from './test262-upstream-harness-sources.js';
const fixture=(body,metadata='includes: [propertyHelper.js]')=>`/*---\n${metadata}\n---*/\n${body}`;
const run=(body,strict)=>vm.runInNewContext(`(${wrapPropertyTest262(fixture(body),strict)})(0)`,{}, {timeout:3000});

test('every supplied upstream source is byte-exact against the pinned manifest',()=>{
 const manifest=JSON.parse(readFileSync(new URL('./test262-upstream-harness-manifest.json',import.meta.url)));
 assert.equal(manifest.revision,upstreamHarnessRevision);
 for(const [name,record] of Object.entries(manifest.files)){
  const source=upstreamHarnessSources[name];assert.equal(Buffer.byteLength(source),record.bytes);
  assert.equal(createHash('sha256').update(source).digest('hex'),record.sha256);
  assert.match(source,/Copyright/);
 }
 assert.deepEqual(propertyHarnessPlan(['propertyHelper.js','compareArray.js']).map(x=>x.name),['sta.js','assert.js','propertyHelper.js','compareArray.js']);
 assert.throws(()=>propertyHarnessPlan(['unknown.js']),/Unsupported Test262 include/);
});

const directed=[
 ['data flags and restoration',`var o={a:9};verifyProperty(o,'a',{value:9,writable:true,enumerable:true,configurable:true},{restore:true});assert.sameValue(o.a,9);assert.sameValue(Object.keys(o).length,1);`],
 ['readonly nonconfigurable',`var o={};Object.defineProperty(o,'a',{value:NaN});verifyProperty(o,'a',{value:NaN,writable:false,enumerable:false,configurable:false});`],
 ['absent property',`verifyProperty({},'a',undefined);`],
 ['signed zero distinguishes',`var o={a:-0};assert.throws(Test262Error,function(){verifyProperty(o,'a',{value:0});});verifyProperty(o,'a',{value:-0});`],
 ['wrong descriptor is a real failure',`assert.throws(Test262Error,function(){verifyProperty({a:1},'a',{writable:false});});`],
 ['missing own property fails',`assert.throws(Test262Error,function(){verifyProperty(Object.create({a:1}),'a',{value:1});});`],
 ['symbol key enumeration',`var k=Symbol('key'),o={[k]:3};verifyProperty(o,k,{value:3,writable:true,enumerable:true,configurable:true},{restore:true});assert.sameValue(o[k],3);`],
 ['legacy helper definitions',`var o={a:1};verifyEqualTo(o,'a',1);verifyWritable(o,'a');verifyEnumerable(o,'a');verifyConfigurable(o,'a');Object.defineProperty(o,'b',{value:2});verifyNotWritable(o,'b');verifyNotEnumerable(o,'b');verifyNotConfigurable(o,'b');`],
 ['callable descriptor helper',`var o={};Object.defineProperty(o,'m',{value:function m(a){},writable:true,configurable:true});verifyCallableProperty(o,'m','m',1,undefined,{restore:true});assert.sameValue(typeof o.m,'function');`],
 ['accessor helper',`var o={get a(){return 3;},set a(v){}};verifyAccessorProperty(o,'a',{get:{name:'get a',length:0},set:{name:'set a',length:1},enumerable:true,configurable:true},{restore:true});assert.sameValue(o.a,3);`],
 ['primordial aliases',`var o={a:1};verifyPrimordialProperty(o,'a',{value:1});var f={};Object.defineProperty(f,'m',{value:function m(){},writable:true,configurable:true});verifyPrimordialCallableProperty(f,'m','m',0,undefined,{restore:true});var a={get x(){return 1;}};verifyPrimordialAccessorProperty(a,'x',{get:{},enumerable:true},{restore:true});`],
 ['captured primordials survive mutation',`var o={a:1};Object.getOwnPropertyDescriptor=function(){throw 'bad';};Object.prototype.hasOwnProperty=function(){throw 'bad';};Array.prototype.push=function(){throw 'bad';};verifyProperty(o,'a',{value:1,writable:true,enumerable:true,configurable:true},{restore:true});assert.sameValue(o.a,1);`],
 ['sloppy harness retained for strict test',`var count=0,target={};Object.defineProperty(target,'x',{value:1,writable:false});var p=new Proxy(target,{set:function(){count++;return false;}});verifyNotWritable(p,'x');assert.sameValue(count,1);`],
 ['array length sentinel restores',`var a=[];verifyWritable(a,'length');assert.sameValue(a.length,0);`],
 ['assert dependencies preserve diagnostic',`assert.throws(Test262Error,function(){assert.sameValue(1,2);});assert.compareArray([1,NaN,-0],[1,NaN,-0]);`],
];
for(const [name,body] of directed)for(const strict of [false,true])test(`${name} (${strict?'strict':'sloppy'})`,()=>assert.equal(run(body,strict),true));

test('original test bytes and original harness sources appear verbatim',()=>{
 const body=fixture('// spacing and original source\nverifyProperty({}, "x", undefined);');
 const source=wrapPropertyTest262(body,true);assert.ok(source.includes(body));
 for(const item of propertyHarnessPlan(['propertyHelper.js']))assert.ok(source.includes(item.source));
});

test('block-list metadata and all variants remain explicit',()=>{
 for(const [metadata,body,reason] of [
  ['flags: [async]\nincludes: [propertyHelper.js]','', 'unsupported-flag:async'],
  ['flags: [module]\nincludes: [propertyHelper.js]','', 'unsupported-flag:module'],
  ['flags: [raw]\nincludes: [propertyHelper.js]','', 'unsupported-flag:raw'],
  ['negative:\n  phase: runtime\n  type: TypeError\nincludes: [propertyHelper.js]','', 'negative-test-requires-script-harness'],
  ['includes: [propertyHelper.js, other.js]','', 'unsupported-include:other.js'],
  ['includes: [propertyHelper.js]','$262.createRealm();','unsupported-host-helper:$262'],
  ['includes: [propertyHelper.js]','this.x=1;','top-level-this-requires-script-semantics'],
  ['includes: [propertyHelper.js]','arguments;','top-level-arguments-requires-script-semantics'],
 ]){
  const source=fixture(body,metadata),result=classifyPropertyTest262(source);
  assert.equal(result.eligible,false);assert.equal(result.reason,reason);assert.ok(test262Variants(source).length>0);
  assert.throws(()=>wrapPropertyTest262(source,false),/Excluded Test262 source/);
 }
});

test('multiline includes and strict mode validation',()=>{
 const body=fixture('verifyProperty({},"a",undefined);','flags: [onlyStrict]\nincludes:\n  - "propertyHelper.js"\n  - compareArray.js');
 assert.deepEqual(classifyPropertyTest262(body),{eligible:true,modes:[true],includes:['propertyHelper.js','compareArray.js']});
 assert.throws(()=>wrapPropertyTest262(body,false),/mode not present/);
 assert.equal(vm.runInNewContext(`(${wrapPropertyTest262(body,true)})(0)`),true);
});

test('upstream assertion diagnostic source is complete even where classifier stays conservative',()=>{
 const source=propertyHarnessPlan(['propertyHelper.js']).map(x=>x.source).join('\n');
 assert.equal(vm.runInNewContext(source+"\ncompareArray.format([1,2]);",{},{timeout:3000}),'[1, 2]');
});
