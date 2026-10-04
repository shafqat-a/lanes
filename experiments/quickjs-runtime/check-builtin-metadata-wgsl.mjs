import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {builtinMetadataRows,builtinMetadataWGSL} from './builtin-metadata-wgsl.js';
const dir=mkdtempSync(join(tmpdir(),'lanes-metadata-'));
try {
 const url=new URL('./shader.js',import.meta.url);
 let source=readFileSync(url,'utf8').replace(/(from\s*)['"](\.\.?\/[^'"]+)['"]/g,(_,p,s)=>p+JSON.stringify(new URL(s,url).href));
 source+='\nexport const metadataTest={methods:[...phase5Methods,...boxingMethods,...objectStaticPlaceholders,...stringSearchMetadata,...stringExtractMetadata],fields:F};\n';
 const path=join(dir,'source.mjs');writeFileSync(path,source);
 const {metadataTest:{methods,fields}}=await import(pathToFileURL(path));
 const rows=builtinMetadataRows(methods,fields);
 let code=builtinMetadataWGSL(methods,fields).replace(/\b(\d+)u\b/g,'$1').replace(/0xffffffffu/g,'0xffffffff').replace(/switch obj.x/g,'switch(obj.x)').replace(/case (\d+):\{([^}]*)\}/g,'case $1:{$2break;}');
 const run=new Function('obj','key','states','image','field','lengthKey','fieldKey','num','fromUnsigned','undef',`const l=0;${code};return 'fallthrough';`);
 let comparisons=0;
 for(let id=0;id<2700;id++)for(const tag of [4,11])for(const key of ['name','length','other']){
  const expected=tag===11?methods.find(m=>m.id===id):undefined;
  const states=[{status:0}];
  const image=new Proxy({},{get:(_,p)=>'name:'+p});
  const actual=run({x:id,z:tag},key,states,image,(_l,k,f)=>k==='name'&&f===fields.name,(_l,k)=>k==='length',x=>x,x=>x,x=>x,()=>undefined);
  assert.equal(actual,!expected?'fallthrough':key==='name'?'name:'+fields[expected.name]:key==='length'?expected.length:undefined);
  assert.equal(states[0].status,expected&&key==='other'?6:0);comparisons++;
 }
 assert.equal(builtinMetadataRows([{id:1,name:'a',length:1},{id:1,name:'b',length:2}],{a:3,b:4})[0].nameField,3);
 assert.throws(()=>builtinMetadataRows([{id:1,name:'missing',length:0}],{}),/Invalid builtin/);
 assert.equal((code.match(/fromUnsigned\(/g)||[]).length,1);
 console.log(JSON.stringify({metadataRows:rows.length,comparisons,firstMatchPreserved:true,sharedConversionSites:1,gpuExecution:false}));
}finally{rmSync(dir,{recursive:true,force:true});}
