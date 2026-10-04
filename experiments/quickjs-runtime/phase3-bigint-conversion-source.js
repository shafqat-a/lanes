// Strict guest bytecode; private WGSL intrinsics perform only canonical limb work.
const whitespace=`function space(c){return c===9||c===11||c===12||c===32||c===160||c===65279||c===10||c===13||c===8232||c===8233||c===5760||(c>=8192&&c<=8202)||c===8239||c===8287||c===12288;}`;
export const phase3BigintParseStringSource=`function bigintParseStringBootstrap(p){"use strict";
 ${whitespace}
 let begin=0,end=p.length;while(begin<end&&space(__lanesCharCodeAt(p,begin)))begin++;
 while(end>begin&&space(__lanesCharCodeAt(p,end-1)))end--;
 if(begin===end)return __lanesBigIntFromNumber(0);
 let negative=false,signed=false,radix=10;
 let first=__lanesCharCodeAt(p,begin);
 if(first===43||first===45){negative=first===45;signed=true;begin++;}
 if(!signed&&end-begin>=2&&__lanesCharCodeAt(p,begin)===48){
  const prefix=__lanesCharCodeAt(p,begin+1);
  if(prefix===120||prefix===88){radix=16;begin+=2;}
  else if(prefix===111||prefix===79){radix=8;begin+=2;}
  else if(prefix===98||prefix===66){radix=2;begin+=2;}
 }
 if(begin===end)return undefined;
 for(let i=begin;i<end;i++){
  const c=__lanesCharCodeAt(p,i);let digit=-1;
  if(c>=48&&c<=57)digit=c-48;else if(c>=65&&c<=90)digit=c-55;else if(c>=97&&c<=122)digit=c-87;
  if(digit<0||digit>=radix)return undefined;
 }
 return __lanesBigIntFromDigits(__lanesSlice(p,begin,end),radix,negative);
}`;
export const phase3BigintConversionSources=Object.freeze({
 bigintParseString:phase3BigintParseStringSource,
 addition:`function additionBootstrap(left,right){"use strict";
 const a=__lanesPrimitive(left),b=__lanesPrimitive(right);
 if(typeof a==="string"||typeof b==="string")return __lanesText(a)+__lanesText(b);
 return (typeof a==="bigint"?a:__lanesNumber(a))+(typeof b==="bigint"?b:__lanesNumber(b));
 }`,
 binaryNumber:`function binaryNumberBootstrap(left,right,operation){"use strict";
  function numeric(value){const p=__lanesPrimitive(value,false);return typeof p==="bigint"?p:__lanesNumber(p);}
  const a=numeric(left),b=numeric(right);
  if(operation===0)return a-b;if(operation===1)return a*b;if(operation===2)return a/b;if(operation===3)return a%b;
  if(operation===4)return a&b;if(operation===5)return a|b;if(operation===6)return a^b;if(operation===7)return a<<b;if(operation===8)return a>>b;return a>>>b;
 }`,
 unaryNumber:`function unaryNumberBootstrap(value,operation){"use strict";
  const p=__lanesPrimitive(value,false);const n=typeof p==="bigint"?p:__lanesNumber(p);
  if(operation===5)return n;
  if(operation===0)return +n;if(operation===1)return -n;
  if(operation===3)return typeof n==="bigint"?n+1n:n+1;
  if(operation===4)return typeof n==="bigint"?n-1n:n-1;
  return ~n;
 }`,
 bigintCall:`function bigintCallBootstrap(value){"use strict";
 const p=__lanesPrimitive(value,false);const type=typeof p;
 if(type==="bigint")return p;
 if(type==="boolean")return __lanesBigIntFromNumber(p?1:0);
 if(type==="number"){const result=__lanesBigIntFromNumber(p);if(result===undefined)throw new RangeError("Cannot convert non-integer to BigInt");return result;}
 if(type!=="string")throw new TypeError("Cannot convert value to BigInt");
 const parsed=__lanesBigIntParseString(p);if(parsed===undefined)throw new SyntaxError("Invalid BigInt string");return parsed;
}`,
 bigintToString:`function bigintToStringBootstrap(radix){"use strict";
 const value=__lanesCall(__lanesBigIntValueOf,this);
 let base=10;
 if(radix!==undefined){base=__lanesNumber(radix);if(base!==base||base===0)base=0;else if(base!==Infinity&&base!==-Infinity)base-=base%1;
  if(base<2||base>36)throw new RangeError("BigInt radix must be between 2 and 36");}
 return __lanesBigIntToText(value,base);
}`,
 toNumberStrict:`function toNumberStrictBootstrap(value){"use strict";
 const primitive=__lanesPrimitive(value,false);
 if(typeof primitive==="bigint")throw new TypeError("Cannot convert a BigInt value to a number");
 return __lanesCall(__lanesNumberConstructor,undefined,primitive);
}`,
});
export const phase3BigintConversionIntrinsics=Object.freeze({__lanesBigIntValueOf:1152,__lanesBigIntFromDigits:1160,__lanesBigIntFromNumber:1161,__lanesBigIntToText:1162,__lanesBigIntToNumber:1163,__lanesNumber:1164,__lanesNumberConstructor:122,__lanesBigIntParseString:1166});
export const phase3BigintConversionMetadata=Object.freeze([
 {id:1150,name:'BigInt',length:1,field:'bigintCall'},
 {id:1151,name:'toString',length:0,field:'bigintToString'},
 {id:1164,name:'',length:1,field:'toNumberStrict',private:true},
 {id:1166,name:'',length:1,field:'bigintParseString',private:true},
]);
