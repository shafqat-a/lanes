// Guest code only. ES2025 numbers-and-dates.html. Numeric arithmetic executes
// through the VM's binary64 implementation; rounding clears fraction bits.
const conversion=`function number(value){
  const primitive=__lanesPrimitive(value,false);
  if(typeof primitive==="bigint"||typeof primitive==="symbol")throw new TypeError("Cannot convert value to Number");
  return __lanesNumber(primitive);
}`;
const truncation=`function trunc(value){
  const high=__lanesNumberWord(value,true)>>>0;
  const exponent=((high>>>20)&2047)-1023;
  if(exponent>=52)return value;
  if(exponent<0)return __lanesFromBits(0,high&0x80000000);
  if(exponent<20)return __lanesFromBits(0,high&~(0x000fffff>>>exponent));
  const low=__lanesNumberWord(value,false)>>>0;
  return __lanesFromBits(low&~(0xffffffff>>>(exponent-20)),high);
}`;
const unary=(name,body)=>`function ${name}Bootstrap(value){"use strict";${conversion}${truncation}const n=number(value);${body}}`;
export const mathPhase5Sources=Object.freeze({
  numberIsFinite:`function numberIsFiniteBootstrap(value){"use strict";return typeof value==="number"&&value===value&&value!==Infinity&&value!==-Infinity;}`,
  numberIsNaN:`function numberIsNaNBootstrap(value){"use strict";return typeof value==="number"&&value!==value;}`,
  numberIsInteger:`function numberIsIntegerBootstrap(value){"use strict";${truncation}return typeof value==="number"&&value===value&&value!==Infinity&&value!==-Infinity&&trunc(value)===value;}`,
  numberIsSafeInteger:`function numberIsSafeIntegerBootstrap(value){"use strict";${truncation}return typeof value==="number"&&value>=-9007199254740991&&value<=9007199254740991&&trunc(value)===value;}`,
  mathAbs:unary('mathAbs','return __lanesFromBits(__lanesNumberWord(n,false),__lanesNumberWord(n,true)&0x7fffffff);'),
  mathSign:unary('mathSign','if(n===0||n!==n)return n;return n<0?-1:1;'),
  mathTrunc:unary('mathTrunc','return trunc(n);'),
  mathFloor:unary('mathFloor','const t=trunc(n);return t>n?t-1:t;'),
  mathCeil:unary('mathCeil','const t=trunc(n);return t<n?t+1:t;'),
  mathRound:unary('mathRound','const t=trunc(n);const fraction=n-t;if(fraction>=0.5)return t+1;if(fraction< -0.5)return t-1;return t;'),
  ...Object.fromEntries(['min','max'].map(name=>['math'+name[0].toUpperCase()+name.slice(1),`function math${name}Bootstrap(a,b){"use strict";${conversion}
    let result=${name==='min'?'':'-'}Infinity;let nan=false;
    for(let i=0;i<arguments.length;i++){
      const n=number(arguments[i]);
      if(n!==n)nan=true;
      else if(n${name==='min'?'<':'>'}result||(n===0&&result===0&&${name==='min'?'':'!'}(__lanesNumberWord(n,true)&0x80000000)))result=n;
    }
    return nan?NaN:result;
  }`])),
  // Numeric operands only after observable ToNumber left then right. The pow
  // opcode routes to the existing software fdlibm helper/private identity960.
  mathPow:`function mathPowBootstrap(base,exponent){"use strict";${conversion}const x=number(base);const y=number(exponent);return x**y;}`,
});
export const mathPhase5Intrinsics=Object.freeze({__lanesPrimitive:129,__lanesNumber:122,__lanesNumberWord:135,__lanesFromBits:123});
