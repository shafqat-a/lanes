// ES2025 §19.2.4 / §19.2.5:
// https://tc39.es/ecma262/2025/multipage/global-object.html#sec-parseint-string-radix
// Step14 permits approximation for other radices; this implementation chooses
// the exact mathematical integer for every radix, including decimal >20digits.
// Guest algorithms only. parseInt uses the existing exact uint32-limb engine,
// never a loop that rounds a growing integer after every digit. Products are
// bounded by 2^32*36 and so are exact binary64 integers; encode rounds once.
// parseFloat scans StrDecimalLiteral's longest prefix, then delegates the
// accepted substring to the existing correctly rounded guest number parser.
import {numberSource} from './number-source.js';
const first=numberSource.indexOf('  function words()'),last=numberSource.indexOf('  function space(c)');
if(first<0||last<=first)throw Error('Exact number parser limb helper markers changed');
const exactInteger=numberSource.slice(first,last);
const conversion=`function text(value){
 const primitive=__lanesPrimitive(value,true);
 if(typeof primitive==="symbol")throw new TypeError("Cannot convert a Symbol value to string");
 
 return __lanesText(primitive);
}
function space(c){return c===9||c===10||c===11||c===12||c===13||c===32||c===160||c===5760||(c>=8192&&c<=8202)||c===8232||c===8233||c===8239||c===8287||c===12288||c===65279;}
function decimal(c){return c>=48&&c<=57;}`;
export const numberParseSources=Object.freeze({
 numberParseInt:`function numberParseIntBootstrap(value,radix){"use strict";${conversion}${exactInteger}
 const input=text(value);
 let start=0;while(start<input.length&&space(__lanesCharCodeAt(input,start)))start++;
 let negative=false;
 let c=__lanesCharCodeAt(input,start);
 if(c===43||c===45){negative=c===45;start++;}
 const primitive=__lanesPrimitive(radix,false);
 if(typeof primitive==="symbol"||typeof primitive==="bigint")throw new TypeError("Cannot convert radix to Number");
 let base=__lanesNumber(primitive)|0;
 let strip=true;
 if(base!==0){if(base<2||base>36)return NaN;if(base!==16)strip=false;}else base=10;
 if(strip&&__lanesCharCodeAt(input,start)===48){c=__lanesCharCodeAt(input,start+1);if(c===88||c===120){start+=2;base=16;}}
 const n=words(),d=words();d[0]=1;let count=0;
 while(start<input.length){c=__lanesCharCodeAt(input,start);let digit=-1;if(c>=48&&c<=57)digit=c-48;else if(c>=65&&c<=90)digit=c-55;else if(c>=97&&c<=122)digit=c-87;if(digit<0||digit>=base)break;multiply(n,base,digit);count++;start++;}
 if(count===0)return NaN;return encode(n,d,negative);
 }`,
 numberParseFloat:`function numberParseFloatBootstrap(value){"use strict";${conversion}
 const input=text(value);let start=0;while(start<input.length&&space(__lanesCharCodeAt(input,start)))start++;
 let end=start;let negative=false;let c=__lanesCharCodeAt(input,end);if(c===43||c===45){negative=c===45;end++;}
 if(__lanesSlice(input,end,end+8)==="Infinity")return negative?-Infinity:Infinity;
 let count=0;while(end<input.length&&decimal(__lanesCharCodeAt(input,end))){end++;count++;}
 if(__lanesCharCodeAt(input,end)===46){end++;while(end<input.length&&decimal(__lanesCharCodeAt(input,end))){end++;count++;}}
 if(count===0)return NaN;
 const exponent=end;c=__lanesCharCodeAt(input,end);
 if(c===69||c===101){end++;c=__lanesCharCodeAt(input,end);if(c===43||c===45)end++;const digits=end;while(end<input.length&&decimal(__lanesCharCodeAt(input,end)))end++;if(end===digits)end=exponent;}
 return __lanesNumber(__lanesSlice(input,start,end));
 }`,
});
