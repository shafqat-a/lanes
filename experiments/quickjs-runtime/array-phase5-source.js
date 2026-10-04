// ES2025 23.1.3 join/toString/map/filter/slice and 7.3.22 ArraySpeciesCreate.
// https://tc39.es/ecma262/2025/multipage/indexed-collections.html
// Guest source strings are compiled to bytecode and executed only by the GPU.
// No iterator protocol is involved. Custom constructor/species paths fail
// explicitly until symbols are integrated; see array-phase5-metadata.js.
const receiver=`
 "use strict";
 const object=__lanesToObject(this);
`;
const length=`
 let length=__lanesNumber(object.length);
 if(!(length>0))length=0;
 else if(length>9007199254740991)length=9007199254740991;
 else length=length-length%1;
`;
const species=`
 function create(original,size){
   if(__lanesIsArray(original)){
     const constructor=original.constructor;
     if(constructor!==undefined&&constructor!==Array){
       if(constructor===null||(typeof constructor!=="object"&&typeof constructor!=="function"))throw new TypeError("Array constructor is not a constructor");
       return __lanesUnsupported();
     }
   }
   // ArrayCreate has no mutable public constructor lookup. The intrinsic Array
   // reference is captured privately by the GPU bootstrap compiler.
   return new Array(size);
 }
 function put(target,key,value){
   // CreateDataPropertyOrThrow bypasses inherited numeric setters.
   __lanesDefineProperty(target,key,{value:value,writable:true,enumerable:true,configurable:true});
 }
`;
const integer=`
 function integer(value){
   const number=__lanesNumber(value);
   if(number!==number||number===0)return 0;
   if(number===Infinity||number===-Infinity)return number;
   return number-number%1;
 }
 function clamp(index,length){
   if(index<0){const result=length+index;return result>0?result:0;}
   return index<length?index:length;
 }
`;
export const arrayPhase5Sources=Object.freeze({
 arrayJoin:`function joinBootstrap(separator){${receiver}${length}
   function text(value){
     const primitive=__lanesPrimitive(value,true);
     if(typeof primitive==="symbol")throw new TypeError("Cannot convert a Symbol value to a string");
     
     return __lanesText(primitive);
   }
   const sep=separator===undefined?",":text(separator);
   let result="";
   for(let index=0;index<length;index++){
     if(index>0)result+=sep;
     const element=object[index];
     if(element!==undefined&&element!==null)result+=text(element);
   }
   return result;
 }`,
 arrayToString:`function toStringBootstrap(){${receiver}
   const method=object.join;
   if(typeof method==="function")return __lanesCall(method,object);
   return __lanesCall(__lanesObjectToString,object);
 }`,
 arrayMap:`function mapBootstrap(callback){${receiver}${length}${species}
   if(typeof callback!=="function")throw new TypeError("Callback is not callable");
   const result=create(object,length);
   const thisArg=arguments[1];
   for(let index=0;index<length;index++){
     if(index in object){
       const value=object[index];
       const mapped=__lanesCall(callback,thisArg,value,index,object);
       put(result,index,mapped);
     }
   }
   return result;
 }`,
 arrayFilter:`function filterBootstrap(callback){${receiver}${length}${species}
   if(typeof callback!=="function")throw new TypeError("Callback is not callable");
   const result=create(object,0);
   const thisArg=arguments[1];
   let to=0;
   for(let index=0;index<length;index++){
     if(index in object){
       const value=object[index];
       if(__lanesCall(callback,thisArg,value,index,object)){put(result,to,value);to++;}
     }
   }
   return result;
 }`,
 arraySlice:`function sliceBootstrap(start,end){${receiver}${length}${species}${integer}
   const from=clamp(integer(start),length);
   const final=end===undefined?length:clamp(integer(end),length);
   const count=final>from?final-from:0;
   const result=create(object,count);
   let to=0;
   for(let index=from;index<final;index++){
     if(index in object)put(result,to,object[index]);
     to++;
   }
   result.length=to;
   return result;
 }`,
});
