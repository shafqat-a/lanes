// Single guest realm: ArraySpeciesCreate's foreign-realm intrinsic-Array branch
// is unreachable because host object/constructor inputs are not admitted.
export const arraySpeciesIntrinsics=Object.freeze({
 __lanesArraySpeciesCreate:2384,__lanesIsConstructor:2312,__lanesIsArray:201,
 __lanesToObject:926,__lanesNumber:1164,__lanesCall:113,__lanesReviverDefine:1861,__lanesText:111,
});
const receiver=`"use strict";const object=__lanesToObject(this);
 let length=__lanesNumber(object.length);
 if(!(length>0))length=0;else if(length>9007199254740991)length=9007199254740991;else length=length-length%1;`;
const define=(key,value)=>`if(!__lanesReviverDefine(result,__lanesText(${key}),${value}))throw new TypeError("Cannot define species result element");`;
export const arraySpeciesSources=Object.freeze({
 arraySpeciesCreate:`function arraySpeciesCreateBootstrap(original,length){
 "use strict";
 let constructor;
 if(__lanesIsArray(original)){
   constructor=original.constructor;
   if(constructor!==null&&(typeof constructor==="object"||typeof constructor==="function")){
     constructor=constructor[Symbol.species];
     if(constructor===null)constructor=undefined;
   }
 }
 if(constructor===undefined)return new Array(length);
 if(!__lanesIsConstructor(constructor))throw new TypeError("Array species is not a constructor");
 return new constructor(length);
 }`,
 arrayMap:`function mapBootstrap(callback){${receiver}
 if(typeof callback!=="function")throw new TypeError("Callback is not callable");
 const result=__lanesArraySpeciesCreate(object,length),thisArg=arguments[1];
 for(let index=0;index<length;index++)if(index in object){const value=object[index];const mapped=__lanesCall(callback,thisArg,value,index,object);${define('index','mapped')}}
 return result;
 }`,
 arrayFilter:`function filterBootstrap(callback){${receiver}
 if(typeof callback!=="function")throw new TypeError("Callback is not callable");
 const result=__lanesArraySpeciesCreate(object,0),thisArg=arguments[1];let to=0;
 for(let index=0;index<length;index++)if(index in object){const value=object[index];if(__lanesCall(callback,thisArg,value,index,object)){${define('to','value')}to++;}}
 return result;
 }`,
 arraySlice:`function sliceBootstrap(start,end){${receiver}
 let from=__lanesNumber(start);
 if(from!==from)from=0;else if(from!==Infinity&&from!==-Infinity)from-=from%1;
 if(from<0){from=length+from;if(from<0)from=0;}else if(from>length)from=length;
 let final=length;
 if(end!==undefined){final=__lanesNumber(end);if(final!==final)final=0;else if(final!==Infinity&&final!==-Infinity)final-=final%1;if(final<0){final=length+final;if(final<0)final=0;}else if(final>length)final=length;}
 const count=final>from?final-from:0,result=__lanesArraySpeciesCreate(object,count);let to=0;
 for(let index=from;index<final;index++){if(index in object){const value=object[index];${define('to','value')}}to++;}
 result.length=to;return result;
 }`,
});
export const arraySpeciesPrivateMetadata=Object.freeze({id:2384,name:'arraySpeciesCreate',field:'arraySpeciesCreate',length:2});
export const speciesGetterMethods=Object.freeze([
 ['Array',2381,'arraySpeciesGetter'],['Map',2382,'mapSpeciesGetter'],['Set',2383,'setSpeciesGetter'],
].map(([owner,id,field])=>Object.freeze({owner,id,field,name:'[Symbol.species]',symbol:'species',kind:'getter',length:0,source:`function ${field}Bootstrap(){"use strict";return this;}`})));
