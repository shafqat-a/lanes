// Self-hosted ES2025 Array.prototype.toReversed/toSpliced/with.
// https://tc39.es/ecma262/2025/multipage/indexed-collections.html
// Sources are compiled, never evaluated on the host by the production runtime.
// Every output index is an own data property: absent source slots become
// undefined. No HasProperty, constructor/species read, or iterator is involved.
const setup=`
 "use strict";
 const object=__lanesToObject(this);
 let length=__lanesNumber(object.length);
 if(!(length>0))length=0;
 else if(length>9007199254740991)length=9007199254740991;
 else length=length-length%1;
 function put(target,index,value){
   __lanesDefineProperty(target,index,{value:value,writable:true,enumerable:true,configurable:true});
 }
`;
const integer=`
 function integer(value){
   const number=__lanesNumber(value);
   if(number!==number||number===0)return 0;
   if(number===Infinity||number===-Infinity)return number;
   return number-number%1;
 }
`;
export const arrayCopySources=Object.freeze({
 arrayToReversed:`function toReversedBootstrap(){${setup}
   const result=new Array(length);
   for(let index=0;index<length;index++)put(result,index,object[length-index-1]);
   return result;
 }`,
 arrayToSpliced:`function toSplicedBootstrap(start,skipCount){${setup}${integer}
   const relativeStart=integer(start);
   let from=relativeStart;
   if(from<0){from=length+from;if(from<0)from=0;}
   else if(from>length)from=length;
   let inserted=arguments.length>2?arguments.length-2:0;
   let skipped=0;
   if(arguments.length===1)skipped=length-from;
   else if(arguments.length>1){
     skipped=integer(skipCount);
     if(!(skipped>0))skipped=0;
     else if(skipped>length-from)skipped=length-from;
   }
   // Reorder the integer arithmetic to avoid rounding len+insertCount above
   // MAX_SAFE_INTEGER before subtracting a large deletion count.
   const size=length-skipped+inserted;
   if(size>9007199254740991)throw new TypeError("Array-like length overflow");
   const result=new Array(size);
   let target=0;
   for(;target<from;target++)put(result,target,object[target]);
   for(let item=0;item<inserted;item++){put(result,target,arguments[item+2]);target++;}
   for(let index=from+skipped;index<length;index++){put(result,target,object[index]);target++;}
   return result;
 }`,
 arrayWith:`function withBootstrap(index,value){${setup}${integer}
   const relativeIndex=integer(index);
   const actualIndex=relativeIndex>=0?relativeIndex:length+relativeIndex;
   if(actualIndex<0||actualIndex>=length)throw new RangeError("Array index out of range");
   const result=new Array(length);
   for(let current=0;current<length;current++){
     const element=current===actualIndex?value:object[current];
     put(result,current,element);
   }
   return result;
 }`,
});
