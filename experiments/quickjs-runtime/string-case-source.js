// Full Unicode Default Case Conversion over UTF-16, including expansions and
// locale-insensitive Final_Sigma. Tables are GPU constants, never host calls.
function source(lower){return `function string${lower?'ToLower':'ToUpper'}CaseBootstrap(){
 "use strict";
 let value=this;
 if(value===null||value===undefined)throw new TypeError("String receiver is null or undefined");
 if(typeof value==="object"||typeof value==="function")value=__lanesPrimitive(value,true);
 if(typeof value==="symbol")throw new TypeError("Cannot convert Symbol to string");
 
 const text=__lanesText(value),length=text.length;let out="";let beforeCased=false;
 function point(at){const first=__lanesCharCodeAt(text,at);if(first>=55296&&first<=56319&&at+1<length){const second=__lanesCharCodeAt(text,at+1);if(second>=56320&&second<=57343)return 65536+(first-55296)*1024+second-56320;}return first;}
 function encode(cp){if(cp<=65535)return __lanesCodeUnit(cp);const n=cp-65536;return __lanesCodeUnit(55296+(n>>>10))+__lanesCodeUnit(56320+(n&1023));}
 for(let at=0;at<length;){const cp=point(at);at+=cp>65535?2:1;
 ${lower?`let finalSigma=false;
 if(cp===931&&beforeCased){finalSigma=true;let nextAt=at;while(nextAt<length){const next=point(nextAt);nextAt+=next>65535?2:1;const flags=__lanesUnicodeCaseFlags(next);if((flags&2)!==0)continue;finalSigma=(flags&1)===0;break;}}
 if(finalSigma)out+=encode(962);
 else `:''}{for(let index=0;index<3;index++){const mapped=__lanesUnicodeCasePoint(cp,${lower?1:0},index);if(mapped<0)break;out+=encode(mapped);}}
 ${lower?'const flags=__lanesUnicodeCaseFlags(cp);if((flags&2)===0)beforeCased=(flags&1)!==0;':''}
 }
 return out;
}`;}
export const stringCaseSources=Object.freeze({stringToUpperCase:source(false),stringToLowerCase:source(true)});
