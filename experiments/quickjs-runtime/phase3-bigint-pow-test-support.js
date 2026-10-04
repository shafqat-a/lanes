import {parse} from 'acorn';
import {fromLimbs,fromU32,mul,neg,RESOURCE_LIMIT,isResourceLimit} from './phase3/bigint-source/limbs.js';
// Test-only limb arithmetic model. Uses the independent existing u32 limb
// multiplication library, then checks against native BigInt exponentiation.
export function powLimbModel(base,exponent,onAllocate=()=>{}){
 if(exponent.sign<0)throw new RangeError('negative exponent');
 if(exponent.length===0){onAllocate(2);return fromU32(1);}
 if(base.length===0)return base;
 if(base.length===1&&base.limbs[0]===1){if(base.sign>0||(exponent.limbs[0]&1))return base;onAllocate(1);return neg(base);}
 if(exponent.length>1||exponent.limbs[0]>=2048)return RESOURCE_LIMIT;
 let e=exponent.limbs[0];if(e===1)return base;let factor=base,result=fromU32(1);onAllocate(2);
 while(e){if(e&1){result=mul(result,factor);if(isResourceLimit(result))return result;onAllocate(1+Math.ceil(result.length/4));}e>>>=1;if(e){factor=mul(factor,factor);if(isResourceLimit(factor))return factor;onAllocate(1+Math.ceil(factor.length/4));}}
 return result;
}
export function limbInput(n){const sign=n<0n?-1:n>0n?1:0;let value=n<0n?-n:n;const limbs=[];while(value){limbs.push(Number(value&0xffffffffn));value>>=32n;}return fromLimbs(sign,limbs);}
export function limbOutput(v){let n=0n;for(let i=v.length-1;i>=0;i--)n=(n<<32n)+BigInt(v.limbs[i]);return v.sign<0?-n:n;}
export function powHelperProgram(source){
 const ast=parse(source,{ecmaVersion:'latest'});
 function emit(node){
  if(node.type==='BinaryExpression'&&node.operator==='**')return `__pow(${emit(node.left)},${emit(node.right)})`;
  // Assignment references require engine machinery; keep **= in the independent
  // native fixture and qualify it on GPU, not an inaccurate host rewrite.
  const children=Object.values(node).flatMap(v=>Array.isArray(v)?v:v&&typeof v==='object'?[v]:[]).filter(v=>v&&typeof v.type==='string').sort((a,b)=>a.start-b.start||b.end-a.end);
  let out='',cursor=node.start;for(const child of children){if(child.start<cursor)continue;out+=source.slice(cursor,child.start)+emit(child);cursor=child.end;}return out+source.slice(cursor,node.end);
 }
 return emit(ast);
}
