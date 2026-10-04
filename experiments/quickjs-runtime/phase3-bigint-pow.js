// ES2025 BigInt::exponentiate. All arithmetic is GPU sign-magnitude limbs.
// https://tc39.es/ecma262/2025/multipage/ecmascript-data-types-and-values.html#sec-numeric-types-bigint-exponentiate
export const phase3BigintPowContract=Object.freeze({maxBits:2048,maxNontrivialExponent:2047,maxSquaringIterations:11,negativeExponentStatus:8,resourceStatus:3});
export const phase3BigintPowWGSL=String.raw`
fn phase3BigintOne(l:u32)->V {
 let chunk=alloc(l,19u,V(1u,0u,0u,0u),0u,0u);if(chunk==0u){return undef();}
 let header=alloc(l,19u,V(1u,1u,0u,0u),0x42490000u,chunk);if(header==0u){return undef();}
 return V(header,1u,18u,0u);
}
fn phase3BigintPow(l:u32,base:V,exponentValue:V)->V {
 let ah=bigint_header(l,base);let bh=bigint_header(l,exponentValue);
 if(states[l].status!=0u){return undef();}
 let a=states[l].heap[ah].value;let b=states[l].heap[bh].value;
 // Negative exponent wins even for zero and unit bases.
 if(b.x==0xffffffffu){states[l].status=8u;return undef();}
 if(b.y==0u){return phase3BigintOne(l);}
 if(a.y==0u){return base;}
 if(a.y==1u&&bigint_limb(l,ah,0u)==1u){
  if(a.x==1u||(bigint_limb(l,bh,0u)&1u)!=0u){return base;}
  return phase3BigintNeg(l,base);
 }
 // For |base|>=2, exponent>=2048 necessarily needs at least2049 bits.
 if(b.y>1u){states[l].status=3u;return undef();}
 var e=bigint_limb(l,bh,0u);
 if(e>=2048u){states[l].status=3u;return undef();}
 if(e==1u){return base;}
 let bits=(a.y-1u)*32u+32u-countLeadingZeros(bigint_limb(l,ah,a.y-1u));
 if((bits-1u)*e>=2048u){states[l].status=3u;return undef();}
 var result=phase3BigintOne(l);var factor=base;
 for(var i=0u;i<11u&&e!=0u&&states[l].status==0u;i++){
  if((e&1u)!=0u){result=phase3BigintMul(l,result,factor);}
  e=e>>1u;
  // An unused final square could exceed the bound despite a valid result.
  if(e!=0u&&states[l].status==0u){factor=phase3BigintMul(l,factor,factor);}
 }
 if(states[l].status!=0u){return undef();}
 if(e!=0u){states[l].status=2u;return undef();}
 return result;
}
`;
export const phase3BigintPowDispatchWGSL='if(id==1169u){return phase3BigintPow(l,original,b);}';
export const phase3BigintPowSource=`function numericPowBootstrap(left,right){"use strict";
 const lp=__lanesComparisonPrimitive(left,"number");
 const a=typeof lp==="bigint"?lp:__lanesNumber(lp);
 const rp=__lanesComparisonPrimitive(right,"number");
 const b=typeof rp==="bigint"?rp:__lanesNumber(rp);
 if(typeof a!==typeof b)throw new TypeError("Cannot mix BigInt and other types");
 if(typeof a==="bigint")return __lanesBigIntPow(a,b);
 return __lanesPow(a,b);
}`;
export const phase3BigintPowIntrinsics=Object.freeze({__lanesBigIntPow:1169});
export const phase3BigintPowMetadata=Object.freeze([{id:1168,name:'',length:2,field:'numericPow',private:true}]);
export const phase3BigintPowOpcode='let b=pop(l);let a=pop(l);push(l,V(1168u,0u,11u,0u));push(l,a);push(l,b);call(l,2u,false,false);';
