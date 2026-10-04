// Host-only generation and control-graph assertions. Never executes guest code.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {shader} from './shader.js';
import {shareCallDispatch} from './shared-call-dispatch.js';
import {shareFinishDispatch} from './shared-finish-dispatch.js';
const dir=mkdtempSync(join(tmpdir(),'lanes-call-generation-'));
try{
 const sourceURL=new URL('./shader.js',import.meta.url);
 let source=readFileSync(sourceURL,'utf8').replace('const unsharedShader =','export const unsharedShader =').replace(/export const shader=.*;\n?$/,'');
 source=source.replace(/(from\s*)['"](\.\.?\/[^'"]+)['"]/g,(_,prefix,specifier)=>prefix+JSON.stringify(new URL(specifier,sourceURL).href));
 const path=join(dir,'unshared.mjs');writeFileSync(path,source);
 const {unsharedShader}=await import(pathToFileURL(path));
 const callShader=shareCallDispatch(unsharedShader);
 assert.equal(shareFinishDispatch(callShader),shader);
 assert.throws(()=>shareFinishDispatch(callShader.replace(/finish\(l,value\)/,'finish(l,undef())').replace('fn construct(l:u32,argumentCount:u32) {','fn construct(l:u32,argumentCount:u32) {finish(l,undef());')),/census drift/);
 assert.throws(()=>shareCallDispatch(unsharedShader.replace('fn construct(l:u32,argumentCount:u32) {','fn construct(l:u32,argumentCount:u32) {call(l,0u,false,false);')),/census drift/);
 assert.throws(()=>shareCallDispatch(unsharedShader.replace('call(l,argc,true,false);','call(l,argc,false,false);')),/construct post/);
 const clean=shader.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
 const functions=new Map();for(const match of clean.matchAll(/\bfn\s+(\w+)\s*\(/g)){
  let start=clean.indexOf('{',match.index),end=start+1,depth=1;while(depth&&end<clean.length){if(clean[end]==='{')depth++;else if(clean[end]==='}')depth--;end++;}assert.equal(depth,0);functions.set(match[1],clean.slice(start+1,end-1));
 }
 const calls=name=>[...functions.get(name).matchAll(/\b(\w+)\s*\(/g)].map(m=>m[1]).filter(n=>functions.has(n));
 const active=[],done=new Set();function visit(name){assert.ok(!active.includes(name),'WGSL recursion: '+[...active,name].join(' -> '));if(done.has(name))return;active.push(name);for(const next of calls(name))visit(next);active.pop();done.add(name);}for(const name of functions.keys())visit(name);
 const reachable=new Set();function noNested(name){assert.notEqual(name,'requestCall','nested call request not reviewed');if(reachable.has(name))return;reachable.add(name);for(const next of calls(name))noNested(next);}noNested('call');noNested('completeCall');
 assert.equal((clean.match(/\bcall\(l,/g)||[]).length,1);
 assert.equal((clean.match(/\brequestCall\(l,/g)||[]).length,49);
 assert.ok(functions.get('collect').includes('markValue(l,callRequest.data);markValue(l,callRequest.aux);'));
 assert.ok(functions.get('requestCall').includes('if(callRequest.pending!=0u)'));
 assert.ok(functions.get('completeCall').includes('callRequest.pending=0u;callRequest.data=undef();callRequest.aux=undef();'));
 assert.ok(functions.get('main').includes('(step<params.budget||callRequest.pending!=0u||finishRequest.pending!=0u)'));
 assert.ok(functions.get('main').includes('callRequest.pending=2u;'));
 assert.ok(functions.get('main').includes('if(callRequest.pending!=0u||finishRequest.pending!=0u){\n    if(states[l].status<2u'));
 assert.equal((clean.match(/\bfinish\(l,/g)||[]).length,1);
 assert.equal((clean.match(/\brequestFinish\(l,/g)||[]).length,10);
 assert.ok(functions.get('collect').includes('markValue(l,finishRequest.value)'));
 const finishSeen=new Set();function finishSafe(name){assert.ok(name!=='requestFinish'&&name!=='requestCall','nested request from actualfinish: '+name);if(finishSeen.has(name))return;finishSeen.add(name);for(const next of calls(name))finishSafe(next);}finishSafe('finish');finishSafe('completeCall');
 console.log(JSON.stringify({singleFinishSite:true,finishRequests:10,singleCallSite:true,requests:49,acyclicFunctions:functions.size,nestedRequestUnreachableFunctions:reachable.size,exactGeneration:true,driftGuards:true,privateRoots:true,guestExecution:false,gpuExecution:false}));
}finally{rmSync(dir,{recursive:true,force:true});}
