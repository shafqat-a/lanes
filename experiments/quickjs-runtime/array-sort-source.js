// ES2025 23.1.3.30 / 23.1.3.34. Abstract lists are private null-prototype
// records: mutable Array.prototype properties cannot affect the sorting work.
// Stable insertion sort is intentionally simple. Existing VM instruction/heap
// limits bound work and report resource failure; no algorithm runs on the CPU.
const sortBody = copy => `
 "use strict";
 if(comparator!==undefined&&typeof comparator!=="function")throw new TypeError("Comparator must be callable");
 const object=__lanesToObject(this);
 let length=__lanesNumber(object.length);
 if(!(length>0))length=0;
 else if(length>9007199254740991)length=9007199254740991;
 else length=length-length%1;
 ${copy ? 'const output=new Array(length);' : ''}
 const items=__lanesDescriptor();
 let count=0;
 for(let index=0;index<length;index++){
   if(${copy ? 'true' : 'index in object'}){items[count]=object[index];count++;}
 }
 function compare(a,b){
   if(a===undefined){if(b===undefined)return 0;return 1;}
   if(b===undefined)return -1;
   if(comparator!==undefined){
     const result=comparator(a,b);
     if(typeof result==="bigint"||typeof result==="symbol")throw new TypeError("Comparator result cannot be converted to Number");
     const number=__lanesNumber(result);
     if(number!==number)return 0;
     return number;
   }
   const left=__lanesToText(a);
   const right=__lanesToText(b);
   if(left<right)return -1;
   if(right<left)return 1;
   return 0;
 }
 for(let index=1;index<count;index++){
   const value=items[index];let position=index;
   while(position>0&&compare(value,items[position-1])<0){items[position]=items[position-1];position--;}
   items[position]=value;
 }
 ${copy ? `for(let index=0;index<count;index++)__lanesDefineProperty(output,index,{value:items[index],writable:true,enumerable:true,configurable:true});
 return output;` : `for(let index=0;index<count;index++)object[index]=items[index];
 for(let index=count;index<length;index++)delete object[index];
 return object;`}
`;
export const arraySortSources=Object.freeze({
 arraySort:`function sortBootstrap(comparator){${sortBody(false)}}`,
 arrayToSorted:`function toSortedBootstrap(comparator){${sortBody(true)}}`,
});
