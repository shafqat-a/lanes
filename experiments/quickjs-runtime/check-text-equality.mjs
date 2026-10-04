// Exercise the generated WGSL comparator, including mixed image/heap strings.
import assert from 'node:assert/strict';
import {shader} from './shader.js';
let start=shader.indexOf('fn textEqual(');start=shader.indexOf('{',start)+1;
let end=start,depth=1;while(depth){if(shader[end]==='{')depth++;if(shader[end]==='}')depth--;end++;}
const body=shader.slice(start,end-1).replace(/\b(\d+)u\b/g,'$1').replace(/\bvar\b/g,'let');
const compare=new Function('a','b','unit',`const l=0;${body}`);
let checks=0;
const strings=['','length','caller','callee','foobar','arguments','prototype','name','😀','\ud800','\udc00','a\0b'];
for(let n=1;n<=32;n++){
 strings.push('a'.repeat(n));
 for(let i=0;i<n;i++)strings.push('a'.repeat(i)+'b'+'a'.repeat(n-i-1));
}
for(const left of strings)for(const right of strings){
 const a={y:left.length,w:1,text:left},b={y:right.length,w:0,text:right};
 const result=compare(a,b,(_l,v,i)=>{assert(i<v.y);return v.text.charCodeAt(i);});
 assert.equal(result,left===right,`${JSON.stringify(left)} vs ${JSON.stringify(right)}`);
 checks++;
}
console.log(JSON.stringify({actualWGSLTextEqualityChecks:checks,gpuExecuted:false}));
