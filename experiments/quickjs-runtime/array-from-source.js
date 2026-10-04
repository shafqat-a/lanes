// ES2025 23.1.2.1. Guest bytecode only; no host execution in production.
// GetIteratorFromMethod is expanded here to avoid a second @@iterator lookup.
// Step/throw-close reuse the shared generic iterator-record ABI.
export const arrayFromMetadata=Object.freeze([{name:'from',id:203,length:1,field:'arrayFrom'}]);
export const arrayFromIntrinsics=Object.freeze({
 __lanesIsConstructor:2312,__lanesCall:113,__lanesDescriptor:112,
 __lanesIteratorStep:1271,__lanesIteratorCloseThrow:2440,
 __lanesToObject:926,__lanesNumber:1164,__lanesText:111,__lanesReviverDefine:1861,
});
export const arrayFromSources=Object.freeze({arrayFrom:`function arrayFromBootstrap(items,mapper,thisArg){
 "use strict";
 const C=this;
 const mapping=mapper!==undefined;
 if(mapping&&typeof mapper!=="function")throw new TypeError("Array.from mapper is not callable");
 // Ordinary Get also rejects null/undefined before any constructor call.
 const usingIterator=items[Symbol.iterator];
 if(usingIterator!==undefined&&usingIterator!==null){
   if(typeof usingIterator!=="function")throw new TypeError("Array.from iterator is not callable");
   const result=__lanesIsConstructor(C)?new C():[];
   const iterator=__lanesCall(usingIterator,items);
   if(iterator===null||(typeof iterator!=="object"&&typeof iterator!=="function"))throw new TypeError("Array.from iterator is not an object");
   const next=iterator.next;
   const record=__lanesDescriptor();
   record.kind=3;record.iterator=iterator;record.next=next;
   record.object=undefined;record.index=0;
   let index=0;
   for(;;){
     if(index>=9007199254740991){
       const error=new TypeError("Array.from length overflow");
       throw __lanesIteratorCloseThrow(record,error);
     }
     const key=__lanesText(index);
     // Step/value abrupt completions deliberately do not close the iterator.
     const value=__lanesIteratorStep(record);
     if(value===record){result.length=index;return result;}
     try{
       const mapped=mapping?__lanesCall(mapper,thisArg,value,index):value;
       if(!__lanesReviverDefine(result,key,mapped))throw new TypeError("Array.from cannot define element");
     }catch(error){throw __lanesIteratorCloseThrow(record,error);}
     index++;
   }
 }
 const object=__lanesToObject(items);
 let length=__lanesNumber(object.length);
 if(!(length>0))length=0;
 else if(length>9007199254740991)length=9007199254740991;
 else length=length-length%1;
 const result=__lanesIsConstructor(C)?new C(length):new Array(length);
 for(let index=0;index<length;index++){
   const value=object[index];
   const mapped=mapping?__lanesCall(mapper,thisArg,value,index):value;
   if(!__lanesReviverDefine(result,__lanesText(index),mapped))throw new TypeError("Array.from cannot define element");
 }
 result.length=length;
 return result;
}`});
