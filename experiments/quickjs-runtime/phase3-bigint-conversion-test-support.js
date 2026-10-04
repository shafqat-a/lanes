import {Script,createContext} from 'node:vm';
import {phase3BigintConversionSources as sources} from './phase3-bigint-conversion-source.js';
// Host-only oracle adapter. Production guest parsing and arithmetic never use
// these native stand-ins. It deliberately preserves private method identities.
export function bigintConversionContext(){
 const context=createContext({});
 new Script(`const NativeBigInt=BigInt,NativeNumber=Number;
 const bigintValueOf=BigInt.prototype.valueOf,bigintToString=BigInt.prototype.toString;
 const reflectApply=Reflect.apply,charCodeAt=String.prototype.charCodeAt,slice=String.prototype.slice;
 function __lanesCall(fn,receiver){return reflectApply(fn,receiver,Array.prototype.slice.call(arguments,2));}
 function __lanesPrimitive(v,stringHint){if(v===null||(typeof v!=="object"&&typeof v!=="function"))return v;
  const names=stringHint?["toString","valueOf"]:["valueOf","toString"];
  const exotic=v[Symbol.toPrimitive];if(exotic!==undefined&&exotic!==null){if(typeof exotic!=="function")throw new TypeError();const p=reflectApply(exotic,v,[stringHint?"string":"number"]);if(p!==null&&(typeof p==="object"||typeof p==="function"))throw new TypeError();return p;}
  for(const name of names){const fn=v[name];if(typeof fn==="function"){const p=reflectApply(fn,v,[]);if(p===null||(typeof p!=="object"&&typeof p!=="function"))return p;}}throw new TypeError();}
 const __lanesBigIntValueOf=bigintValueOf,__lanesNumberConstructor=NativeNumber;
 function __lanesText(v){if(typeof v==="symbol")throw new TypeError();return String(v);}
 function __lanesCharCodeAt(s,i){return reflectApply(charCodeAt,s,[i]);}
 function __lanesSlice(s,a,b){return reflectApply(slice,s,[a,b]);}
 function __lanesBigIntFromNumber(n){return NativeNumber.isFinite(n)&&NativeNumber.isInteger(n)?NativeBigInt(n):undefined;}
 function __lanesBigIntFromDigits(s,base,negative){let n=0n;for(let i=0;i<s.length;i++){const c=__lanesCharCodeAt(s,i);const d=c<=57?c-48:c<=90?c-55:c-87;n=n*NativeBigInt(base)+NativeBigInt(d);}return negative?-n:n;}
 function __lanesBigIntToText(v,r){return reflectApply(bigintToString,v,[r]);}
 const __lanesBigIntParseString=(${sources.bigintParseString});
 const __lanesNumber=(${sources.toNumberStrict});
 const guestBigIntBody=(${sources.bigintCall});const guestBigInt=({BigInt(value){return guestBigIntBody(value)}}).BigInt,guestBigIntToString=(${sources.bigintToString});
 Object.defineProperty(guestBigInt,"prototype",{value:NativeBigInt.prototype});
 BigInt=guestBigInt;BigInt.prototype.toString=guestBigIntToString;`).runInContext(context);
 return context;
}
export function evaluateBigintConversion(source,input){return new Script(`(${source})(${JSON.stringify(input)})`).runInContext(bigintConversionContext(),{timeout:3000});}
// u32 transcriptions of conversion kernels, exclusively for differential tests.
export function fromDigitsModel(text,radix,negative=false){const out=[];for(const ch of text){const code=ch.charCodeAt(0),digit=code<=57?code-48:code<=90?code-55:code-87;let carry=digit;for(let i=0;i<out.length;i++){const low=(out[i]&65535)*radix+carry,high=(out[i]>>>16)*radix+(low>>>16);out[i]=((high<<16)|(low&65535))>>>0;carry=high>>>16;}if(carry)out.push(carry);if(out.length>64)return{status:3};}return{value:fromWords(out,negative)};}
export function fromWords(words,negative=false){let n=0n;for(let i=words.length-1;i>=0;i--)n=(n<<32n)+BigInt(words[i]);return negative?-n:n;}
export function toWords(n){if(n<0n)n=-n;const out=[];while(n){out.push(Number(n&0xffffffffn));n>>=32n;}return out;}
const buffer=new ArrayBuffer(8),view=new DataView(buffer);
export function fromNumberModel(n){view.setFloat64(0,n,true);const low=view.getUint32(0,true),high=view.getUint32(4,true),exponent=(high>>>20)&2047,fractionHigh=high&1048575;if(exponent===2047)return undefined;const out=new Uint32Array(64);if(exponent===0)return low||fractionHigh?undefined:0n;const power=exponent-1023,mantissaHigh=fractionHigh|1048576;let length=0;
 for(let bit=0;bit<53;bit++){const present=bit<32?((low>>>bit)&1):((mantissaHigh>>>(bit-32))&1);if(present){const destinationBit=power-52+bit;if(destinationBit<0)return undefined;const index=destinationBit>>>5;out[index]|=1<<(destinationBit&31);length=Math.max(length,index+1);}}return fromWords(out.slice(0,length),!!(high&0x80000000));}
export function toNumberModel(value){const words=toWords(value),length=words.length;if(!length)return 0;const sign=value<0n?0x80000000:0;let bits=(length-1)*32+32-Math.clz32(words.at(-1));if(bits>1024)return value<0n?-Infinity:Infinity;let low=0,high=0;for(let i=0;i<Math.min(53,bits);i++){const sourceBit=bits-1-i,bit=(words[sourceBit>>>5]>>>(sourceBit&31))&1,destinationBit=52-i;if(destinationBit<32)low=(low|(bit<<destinationBit))>>>0;else high|=bit<<(destinationBit-32);}
 if(bits>53){const discarded=bits-53,guardIndex=discarded-1,guard=((words[guardIndex>>>5]>>>(guardIndex&31))&1)!==0;let sticky=false;for(let i=0;i<guardIndex;i++)if(((words[i>>>5]>>>(i&31))&1)!==0){sticky=true;break;}if(guard&&(sticky||(low&1))){low=(low+1)>>>0;if(low===0)high++;if(high===2097152){high=1048576;low=0;bits++;}}}
 if(bits>1024)return value<0n?-Infinity:Infinity;view.setUint32(0,low,true);view.setUint32(4,(sign|((bits+1022)<<20)|(high&1048575))>>>0,true);return view.getFloat64(0,true);}
export function toTextModel(value,radix){const words=toWords(value),negative=value<0n;let length=words.length;const digits=[];do{if(digits.length>=256)return{status:3};let carry=0;for(let j=length;j>0;j--){const i=j-1,upper=carry*65536+(words[i]>>>16),upperQuotient=Math.floor(upper/radix);carry=upper%radix;const lower=carry*65536+(words[i]&65535),lowerQuotient=Math.floor(lower/radix);carry=lower%radix;words[i]=((upperQuotient<<16)|lowerQuotient)>>>0;}digits.push(String.fromCharCode(carry+(carry<10?48:87)));while(length&&!words[length-1])length--;}while(length);if(digits.length+(negative?1:0)>256)return{status:3};return{value:(negative?'-':'')+digits.reverse().join('')};}
