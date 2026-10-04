// Static call-site expansion estimate only: this is not Metal IR or compile time.
// Helpful for finding repeated deep helper trees before device qualification.
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const moduleArg=process.argv.indexOf('--module'),outputArg=process.argv.indexOf('--output');
const {shader}=await import(moduleArg<0?'./shader.js':pathToFileURL(resolve(process.argv[moduleArg+1])).href);
const clean=shader.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
const functions=new Map();
for(const m of clean.matchAll(/\bfn\s+(\w+)\s*\(/g)){
 assert(!functions.has(m[1]),`duplicate ${m[1]}`);
 const start=clean.indexOf('{',m.index);let end=start+1,depth=1;
 while(depth&&end<clean.length){if(clean[end]==='{')depth++;else if(clean[end]==='}')depth--;end++;}
 assert.equal(depth,0,`balanced ${m[1]}`);functions.set(m[1],{body:clean.slice(start+1,end-1),calls:new Map(),incoming:0});
}
for(const f of functions.values())for(const m of f.body.matchAll(/\b(\w+)\s*\(/g))if(functions.has(m[1])){f.calls.set(m[1],(f.calls.get(m[1])||0)+1);functions.get(m[1]).incoming++;}
const active=new Set();function expanded(name){const f=functions.get(name);if(f.expanded!==undefined)return f.expanded;assert(!active.has(name),`recursive WGSL ${name}`);active.add(name);let size=BigInt(f.body.length);for(const [callee,count] of f.calls)size+=BigInt(count)*expanded(callee);active.delete(name);return f.expanded=size;}
for(const name of functions.keys())expanded(name);
const ranked=[...functions].map(([name,f])=>({name,bodyBytes:f.body.length,expandedBytes:f.expanded.toString(),incomingSites:f.incoming,directCalls:[...f.calls].map(([callee,count])=>({callee,count,contribution:(BigInt(count)*functions.get(callee).expanded).toString()})).sort((a,b)=>BigInt(a.contribution)>BigInt(b.contribution)?-1:1).slice(0,8)})).sort((a,b)=>BigInt(a.expandedBytes)>BigInt(b.expandedBytes)?-1:1);
const report={timestamp:new Date().toISOString(),method:'Recursive textual body-size sum weighted by static call-site multiplicity; no optimizer/loop-unrolling model, no GPU execution',functions:functions.size,shaderBytes:shader.length,mainExpandedBytes:functions.get('main')?.expanded.toString(),largest:ranked.slice(0,15)};
if(outputArg>=0)writeFileSync(process.argv[outputArg+1],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
