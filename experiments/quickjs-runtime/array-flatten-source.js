// ES2025 FlattenIntoArray: getters, callbacks, species and recursion run in guest bytecode.
// https://tc39.es/ecma262/2025/multipage/indexed-collections.html#sec-flattenintoarray
const start=`"use strict";
 const object=__lanesToObject(this);
 const number=__lanesNumber,isArray=__lanesIsArray,define=__lanesReviverDefine,text=__lanesText,call=__lanesCall;
 function lengthOf(value){let n=number(value.length);if(!(n>0))return 0;if(n>9007199254740991)return 9007199254740991;return n-n%1;}
 function flatten(target,source,length,index,depth,mapper,thisArg){
  for(let k=0;k<length;k++){
   if(k in source){
    let element=source[k];
    if(mapper!==undefined)element=call(mapper,thisArg,element,k,source);
    if(depth>0&&isArray(element)){
     const elementLength=lengthOf(element);
     index=flatten(target,element,elementLength,index,depth-1,undefined,undefined);
    }else{
     if(index>=9007199254740991)throw new TypeError("Flattened array too large");
     if(!define(target,text(index),element))throw new TypeError("Cannot define flattened element");
     index++;
    }
   }
  }return index;
 }
 const length=lengthOf(object);
`;
export const arrayFlattenSources=Object.freeze({
 arrayFlat:`function flatBootstrap(depth){${start}
  let actualDepth=1;
  if(depth!==undefined){actualDepth=number(depth);if(actualDepth!==actualDepth||actualDepth===0)actualDepth=0;else if(actualDepth!==Infinity&&actualDepth!==-Infinity)actualDepth-=actualDepth%1;}
  const result=__lanesArraySpeciesCreate(object,0);
  flatten(result,object,length,0,actualDepth,undefined,undefined);
  return result;
 }`,
 arrayFlatMap:`function flatMapBootstrap(mapper,thisArg){${start}
  if(typeof mapper!=="function")throw new TypeError("Mapper must be callable");
  const result=__lanesArraySpeciesCreate(object,0);
  flatten(result,object,length,0,1,mapper,thisArg);
  return result;
 }`
});
export const arrayFlattenMetadata=Object.freeze([
 {id:1406,name:'flat',field:'arrayFlat',length:0},
 {id:1407,name:'flatMap',field:'arrayFlatMap',length:1}
]);
