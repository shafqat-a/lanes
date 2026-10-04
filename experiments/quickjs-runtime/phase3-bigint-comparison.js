// https://tc39.es/ecma262/2025/multipage/abstract-operations.html#sec-islessthan
// https://tc39.es/ecma262/2025/multipage/abstract-operations.html#sec-islooselyequal
// Exact ES2025 mixed BigInt/Number comparison. No allocation or conversion to
// Number: compare the integer magnitude with binary64's exact significand.
// Return -1/0/1, or 2 for unordered (NaN). Every limb remains guest GPU state.
export const phase3BigintComparisonWGSL=`
fn bigintNumberCompare(l:u32,a:V,b:V)->i32 {
 if(a.z!=18u||b.z!=0u){states[l].status=2u;return 2;}
 let h=bigint_header(l,a);if(states[l].status!=0u){return 2;}
 let header=states[l].heap[h].value;
 let negative=header.x==0xffffffffu;
 let n=b.xy;
 if(nan(n)){return 2;}
 if(inf(n)){return select(-1,1,(n.y&0x80000000u)!=0u);}
 if(zero(n)){if(header.y==0u){return 0;}return select(1,-1,negative);}
 let numberNegative=(n.y&0x80000000u)!=0u;
 if(header.y==0u){return select(-1,1,numberNegative);}
 if(negative!=numberNegative){return select(1,-1,negative);}
 let polarity=select(1,-1,negative);
 // Subnormal numbers have no leading hidden bit and magnitude below one.
 let biased=(n.y>>20u)&2047u;
 if(biased<1023u){return polarity;}
 let e=i32(biased)-1023;
 let top=bigint_limb(l,h,header.y-1u);
 let integerBits=(header.y-1u)*32u+32u-countLeadingZeros(top);
 let numberBits=u32(e)+1u;
 if(integerBits<numberBits){return -polarity;}
 if(integerBits>numberBits){return polarity;}
 let significand=sig(n);
 var i=header.y;
 loop {
  if(i==0u){break;}i--;
  let shift=e-52-i32(i*32u);
  var limb=0u;
  if(shift>=0){limb=left(significand,u32(shift)).x;}
  else{limb=right(significand,u32(-shift)).x;}
  let own=bigint_limb(l,h,i);
  if(own<limb){return -polarity;}
  if(own>limb){return polarity;}
 }
 // Integer parts match. A nonzero fractional tail makes |Number| larger.
 if(e<52){let amount=u32(52-e);if(any(left(right(significand,amount),amount)!=significand)){return -polarity;}}
 return 0;
}
`;
export const phase3BigintComparisonDispatchWGSL='if(id==1165u){let result=bigintNumberCompare(l,original,b);return num(fromSigned(bitcast<u32>(result)));}';
export const phase3BigintComparisonIntrinsics=Object.freeze({__lanesBigIntNumberCompare:1165,__lanesBigIntParseString:1166,__lanesComparisonPrimitive:1167});
export const bigintRelationalSource=`function relationalBootstrap(left,right,operation){"use strict";
 let a=__lanesComparisonPrimitive(left,"number"),b=__lanesComparisonPrimitive(right,"number");
 let ta=typeof a,tb=typeof b;
 if(ta==="bigint"&&tb==="string"){b=__lanesBigIntParseString(b);if(b===undefined)return false;tb="bigint";}
 else if(ta==="string"&&tb==="bigint"){a=__lanesBigIntParseString(a);if(a===undefined)return false;ta="bigint";}
 if(ta==="bigint"||tb==="bigint"){
  let order;
  if(ta==="bigint"&&tb==="bigint")order=a<b?-1:a>b?1:0;
  else if(ta==="bigint")order=__lanesBigIntNumberCompare(a,__lanesNumber(b));
  else{order=__lanesBigIntNumberCompare(b,__lanesNumber(a));if(order!==2)order=-order;}
  if(order===2)return false;
  if(operation===0)return order<0;if(operation===1)return order<=0;if(operation===2)return order>0;return order>=0;
 }
 if(ta!=="string"||tb!=="string"){a=__lanesNumber(a);b=__lanesNumber(b);}
 if(operation===0)return a<b;if(operation===1)return a<=b;if(operation===2)return a>b;return a>=b;
}`;
export const bigintEqualitySource=`function equalityBootstrap(left,right,negate){"use strict";
 function object(v){return v!==null&&(typeof v==="object"||typeof v==="function");}
 let a=left,b=right,equal=false;
 while(true){
  const ta=typeof a,tb=typeof b;
  if(ta===tb){equal=a===b;break;}
  if(a===null||a===undefined||b===null||b===undefined){equal=(a===null||a===undefined)&&(b===null||b===undefined);break;}
  if(ta==="boolean"){a=__lanesNumber(a);continue;}if(tb==="boolean"){b=__lanesNumber(b);continue;}
  if(ta==="number"&&tb==="string"){b=__lanesNumber(b);continue;}if(ta==="string"&&tb==="number"){a=__lanesNumber(a);continue;}
  if(ta==="bigint"&&tb==="string"){b=__lanesBigIntParseString(b);equal=b!==undefined&&a===b;break;}
  if(ta==="string"&&tb==="bigint"){a=__lanesBigIntParseString(a);equal=a!==undefined&&a===b;break;}
  if(ta==="bigint"&&tb==="number"){equal=__lanesBigIntNumberCompare(a,b)===0;break;}
  if(ta==="number"&&tb==="bigint"){equal=__lanesBigIntNumberCompare(b,a)===0;break;}
  if(object(a)&&!object(b)){a=__lanesComparisonPrimitive(a,"default");continue;}
  if(!object(a)&&object(b)){b=__lanesComparisonPrimitive(b,"default");continue;}
  break;
 }
 return negate?!equal:equal;
}`;
// Replace only the eq/neq and relational instruction blocks in shader.js.
// Same-kind primitives retain existing low-level fast paths. Mixed Symbol or
// BigInt uses guest abstract operations, preserving observable coercion order.
export function bigintComparisonOpcodeCases({OP}){
 const result={};
 for(const [index,name]of ['lt','lte','gt','gte'].entries())result[name]=`
 let b=pop(l);let a=pop(l);
 if(a.z==18u&&b.z==18u){let cmp=phase3BigintCmp(l,a,b);if(states[l].status!=0u){break;}push(l,boolean(${['cmp<0','cmp<=0','cmp>0','cmp>=0'][index]}));break;}
 if((a.z>=4u||b.z>=4u)&&!(a.z==7u&&b.z==7u)){push(l,V(130u,0u,11u,0u));push(l,a);push(l,b);push(l,num(fromUnsigned(${index}u)));call(l,3u,false,false);}
 else{push(l,binary(l,op,a,b));}`;
 result['eq neq']=`let b=pop(l);let a=pop(l);
 if(a.z!=b.z&&(a.z>=4u||b.z>=4u)){push(l,V(131u,0u,11u,0u));push(l,a);push(l,b);push(l,boolean(op==${OP.neq}u));call(l,3u,false,false);}
 else{push(l,binary(l,op,a,b));}`;
 return result;
}

export const bigintComparisonPrimitiveSource=`function comparisonPrimitiveBootstrap(value,hint){"use strict";
 function object(v){return v!==null&&(typeof v==="object"||typeof v==="function");}
 if(!object(value))return value;
 const exotic=value[Symbol.toPrimitive];
 if(exotic!==undefined&&exotic!==null){
  if(typeof exotic!=="function")throw new TypeError("Cannot convert object to primitive value");
  const result=__lanesCall(exotic,value,hint);
  if(object(result))throw new TypeError("Cannot convert object to primitive value");
  return result;
 }
 let method=hint==="string"?value.toString:value.valueOf;
 if(typeof method==="function"){const result=__lanesCall(method,value);if(!object(result))return result;}
 method=hint==="string"?value.valueOf:value.toString;
 if(typeof method==="function"){const result=__lanesCall(method,value);if(!object(result))return result;}
 throw new TypeError("Cannot convert object to primitive value");
}`;
export const phase3BigintComparisonMetadata=Object.freeze([{id:1167,name:'',length:2,field:'comparisonToPrimitive',private:true}]);
