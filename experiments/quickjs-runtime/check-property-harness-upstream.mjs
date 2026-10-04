import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createCompiler} from './compiler.js';
import {classifyPropertyTest262,wrapPropertyTest262,upstreamHarnessRevision,test262Variants} from './test262-property-harness.js';
import {propertyHarnessIntegrationPatch} from './test262-property-integration-patch.js';
const checkout=process.argv[2]||'/tmp/lanes-bootstrap-xcCerK/test262';
const git=(...args)=>execFileSync('git',['-C',checkout,...args],{encoding:'utf8',maxBuffer:1<<26});
assert.equal(git('rev-parse','HEAD').trim(),upstreamHarnessRevision,'Pinned checkout revision required');
const records=[],compiler=await createCompiler();
// Deterministic first 20 upstream files, selected by include and directory only,
// never by pass result. Every selected strict/sloppy variant gets a record.
const names=git('grep','-l','propertyHelper.js',upstreamHarnessRevision,'--','test/built-ins/Object/defineProperty/').trim().split('\n').filter(Boolean).slice(0,20);
for(const line of names){
 const file=line.slice(line.indexOf(':')+1),body=git('show',`${upstreamHarnessRevision}:${file}`),admission=classifyPropertyTest262(body);
 for(const variant of test262Variants(body)){
  const record={file,...variant};records.push(record);
  if(!admission.eligible){Object.assign(record,{status:'excludedHarness',reason:admission.reason});continue;}
  const source=wrapPropertyTest262(body,variant.strict);
  try{assert.equal(vm.runInNewContext(`(${source})(0)`,{}, {timeout:1000}),true);record.native='passed';}catch(e){Object.assign(record,{status:'referenceRejected',error:String(e)});continue;}
  try{compiler.compile(source);record.status='compiled';}catch(e){Object.assign(record,{status:'compileBlocked',error:String(e)});}
 }
}
const files=Object.fromEntries(['test262-inventory.js','test262-adapted.mjs','export-test262-browser.mjs','inventory-test262-full.mjs'].map(n=>[n,readFileSync(new URL(n,import.meta.url),'utf8')]));
const patched=propertyHarnessIntegrationPatch(files);assert.equal(Object.keys(patched).length,4);
console.log(JSON.stringify({revision:upstreamHarnessRevision,selectedFiles:names.length,variantRecords:records.length,gpuExecuted:false,liveHarnessModified:false,counts:records.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{}),records},null,2));
