// Strict JSON grammar; no eval, host JSON execution, or public-method calls.
// Data properties always bypass prototype setters (including __proto__).
export const jsonPhase5Sources=Object.freeze({parse:String.raw`function jsonParsePhase5(source,reviver){
 "use strict";
 function objectLike(v){return v!==null&&(typeof v==="object"||typeof v==="function");}
 let primitive=source;if(objectLike(primitive))primitive=__lanesPrimitive(primitive,true);
 if(typeof primitive==="symbol")throw new TypeError("Cannot convert a Symbol value to a string");
 
 const text=__lanesText(primitive);let at=0;const size=text.length;
 function fail(){throw new SyntaxError("Invalid JSON text");}
 function unit(i){return __lanesCharCodeAt(text,i);}
 function whitespace(){while(at<size){const c=unit(at);if(c!==32&&c!==9&&c!==10&&c!==13)break;at++;}}
 function digit(c){return c>=48&&c<=57;}
 function hex(c){if(c>=48&&c<=57)return c-48;if(c>=65&&c<=70)return c-55;if(c>=97&&c<=102)return c-87;return -1;}
 function string(){
  at++;let out="";
  while(at<size){const c=unit(at);at++;
   if(c===34)return out;
   if(c<32)fail();
   if(c!==92){out+=__lanesSlice(text,at-1,at);continue;}
   if(at>=size)fail();const escaped=unit(at);at++;
   if(escaped===34||escaped===92||escaped===47){out+=__lanesCodeUnit(escaped);continue;}
   if(escaped===98){out+="\b";continue;}if(escaped===102){out+="\f";continue;}
   if(escaped===110){out+="\n";continue;}if(escaped===114){out+="\r";continue;}if(escaped===116){out+="\t";continue;}
   if(escaped!==117||at+4>size)fail();let code=0;
   for(let i=0;i<4;i++){const n=hex(unit(at));if(n<0)fail();code=code*16+n;at++;}
   out+=__lanesCodeUnit(code);
  }
  fail();
 }
 function number(){
  const start=at;if(unit(at)===45)at++;
  if(at>=size)fail();
  if(unit(at)===48)at++;
  else{if(unit(at)<49||unit(at)>57)fail();while(at<size&&digit(unit(at)))at++;}
  if(at<size&&unit(at)===46){at++;if(at>=size||!digit(unit(at)))fail();while(at<size&&digit(unit(at)))at++;}
  if(at<size&&(unit(at)===69||unit(at)===101)){at++;if(at<size&&(unit(at)===43||unit(at)===45))at++;if(at>=size||!digit(unit(at)))fail();while(at<size&&digit(unit(at)))at++;}
  return __lanesNumber(__lanesSlice(text,start,at));
 }
 function define(obj,key,value){__lanesDefineProperty(obj,key,{value:value,writable:true,enumerable:true,configurable:true});}
 function value(){
  whitespace();if(at>=size)fail();const c=unit(at);
  if(c===34)return string();
  if(c===45||digit(c))return number();
  if(c===116&&__lanesSlice(text,at,at+4)==="true"){at+=4;return true;}
  if(c===102&&__lanesSlice(text,at,at+5)==="false"){at+=5;return false;}
  if(c===110&&__lanesSlice(text,at,at+4)==="null"){at+=4;return null;}
  if(c===91){
   at++;const result=[];let index=0;whitespace();if(at<size&&unit(at)===93){at++;return result;}
   while(true){const item=value();define(result,index,item);index++;whitespace();if(at>=size)fail();const next=unit(at);at++;
    if(next===93)return result;if(next!==44)fail();}
  }
  if(c===123){
   at++;const result={};whitespace();if(at<size&&unit(at)===125){at++;return result;}
   while(true){whitespace();if(at>=size||unit(at)!==34)fail();const key=string();whitespace();if(at>=size||unit(at)!==58)fail();at++;
    const item=value();define(result,key,item);whitespace();if(at>=size)fail();const next=unit(at);at++;
    if(next===125)return result;if(next!==44)fail();}
  }
  fail();
 }
 // ES2025 InternalizeJSONProperty: all recursive calls and callbacks remain
 // guest bytecode, and each object/array snapshots its traversal before calls.
 function internalize(holder,key){
  const item=holder[key];
  if(objectLike(item)){
   const array=__lanesIsArray(item);
   const keys=array?undefined:__lanesOwnKeys(item,true);
   const length=array?item.length:keys.length;
   for(let i=0;i<length;i++){
    const name=array?__lanesText(i):keys[i];
    const replacement=internalize(item,name);
    if(replacement===undefined)__lanesReviverDelete(item,name);
    else __lanesReviverDefine(item,name,replacement);
   }
  }
  return __lanesCall(reviver,holder,key,item);
 }
 const result=value();whitespace();if(at!==size)fail();
 if(typeof reviver!=="function")return result;
 const holder={};define(holder,"",result);return internalize(holder,"");
}`});
