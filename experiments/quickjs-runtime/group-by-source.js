// ES2025 GroupBy, Map.groupBy and Object.groupBy. All iteration/callbacks execute
// as GPU guest bytecode. Accumulation objects are inaccessible until completion.
export const groupByMetadata=Object.freeze([
 {name:'groupBy',id:2212,length:2,field:'mapGroupBy'},
 {name:'groupBy',id:2380,length:2,field:'objectGroupBy'},
]);
export const groupByIntrinsics=Object.freeze({
 __lanesIteratorOpen:1270,__lanesIteratorStep:1271,__lanesIteratorCloseThrow:2440,
 __lanesCall:113,__lanesToPropertyKey:900,__lanesDescriptor:112,
 __lanesCollectionCreate:2260,__lanesMapGet:2263,__lanesMapSet:2264,
 __lanesReviverDefine:1861,__lanesText:111,
});
function source(map){return `function ${map?'map':'object'}GroupByBootstrap(items,callback){
 "use strict";
 if(items===null||items===undefined)throw new TypeError("Cannot group null or undefined");
 if(typeof callback!=="function")throw new TypeError("GroupBy callback is not callable");
 const record=__lanesIteratorOpen(items);
 const groups=${map?'__lanesCollectionCreate(1)':'__lanesDescriptor()'};
 let index=0;
 for(;;){
   if(index>=9007199254740991){const error=new TypeError("GroupBy index overflow");throw __lanesIteratorCloseThrow(record,error);}
   const value=__lanesIteratorStep(record);
   if(value===record)return groups;
   let key;
   try{key=__lanesCall(callback,undefined,value,index);${map?'':'key=__lanesToPropertyKey(key);'}}
   catch(error){throw __lanesIteratorCloseThrow(record,error);}
   let elements=${map?'__lanesMapGet(groups,key)':'groups[key]'};
   if(elements===undefined){
     elements=[];
     ${map?'__lanesMapSet(groups,key,elements);':'if(!__lanesReviverDefine(groups,key,elements))throw new TypeError("Cannot create group");'}
   }
   if(!__lanesReviverDefine(elements,__lanesText(elements.length),value))throw new TypeError("Cannot append group element");
   index++;
 }
}`;}
export const groupBySources=Object.freeze({mapGroupBy:source(true),objectGroupBy:source(false)});
export const groupByMethods=Object.freeze(groupByMetadata.map(m=>Object.freeze({...m,owner:m.id===2212?'Map':'Object',source:groupBySources[m.field]})));
