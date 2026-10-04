import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {arrayConcatSources} from './array-concat-source.js';
import {arraySpeciesSources} from './array-species-source.js';
import {arrayConcatCases} from './array-concat-cases.js';
const setup=`
const __lanesToObject=v=>{if(v==null)throw new TypeError();return Object(v);};
const __lanesNumber=v=>+v,__lanesIsArray=Array.isArray,__lanesText=String;
const __lanesIsConstructor=v=>{try{Reflect.construct(function(){},[],v);return true;}catch{return false;}};
const __lanesReviverDefine=(o,k,v)=>Reflect.defineProperty(o,k,{value:v,writable:true,enumerable:true,configurable:true});
const __lanesArraySpeciesCreate=(${arraySpeciesSources.arraySpeciesCreate});
const concat=(${arrayConcatSources.arrayConcat});
Object.defineProperty(concat,'name',{value:'concat'});
Array.prototype.concat=concat;
`;
let values=0;
for(const c of arrayConcatCases)for(const input of c.inputs){
  const expression=`(${c.source})(${input})`;
  const expected=new Script(expression).runInNewContext();
  const actual=new Script(setup+expression).runInNewContext();
  assert.ok(Object.is(actual,expected),`${c.name}: ${actual} != ${expected}`);
  values++;
}
console.log(JSON.stringify({programs:arrayConcatCases.length,nativeHelperValues:values,gpuExecuted:false}));
