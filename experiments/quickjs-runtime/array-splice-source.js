// ES2025 23.1.3.31: strict Set/Delete operations preserve partial mutations on failure.
// https://tc39.es/ecma262/2025/multipage/indexed-collections.html#sec-array.prototype.splice
export const arraySpliceSources=Object.freeze({
 arraySplice:`function spliceBootstrap(start,deleteCount){
  "use strict";
  const object=__lanesToObject(this),number=__lanesNumber;
  function integer(value){const n=number(value);if(n!==n||n===0)return 0;if(n===Infinity||n===-Infinity)return n;return n-n%1;}
  let length=number(object.length);if(!(length>0))length=0;else if(length>9007199254740991)length=9007199254740991;else length-=length%1;
  const relativeStart=integer(start);
  let actualStart=relativeStart<0?length+relativeStart:relativeStart;
  if(actualStart<0)actualStart=0;if(actualStart>length)actualStart=length;
  let itemCount=0,actualDeleteCount=0;
  if(arguments.length===1)actualDeleteCount=length-actualStart;
  else if(arguments.length>1){
   itemCount=arguments.length-2;
   actualDeleteCount=integer(deleteCount);
   if(!(actualDeleteCount>0))actualDeleteCount=0;
   if(actualDeleteCount>length-actualStart)actualDeleteCount=length-actualStart;
  }
  if(length-actualDeleteCount+itemCount>9007199254740991)throw new TypeError("Splice length overflow");
  const result=__lanesArraySpeciesCreate(object,actualDeleteCount);
  for(let k=0;k<actualDeleteCount;k++){
   const from=actualStart+k;
   if(from in object){const value=object[from];if(!__lanesReviverDefine(result,__lanesText(k),value))throw new TypeError("Cannot define deleted element");}
  }
  result.length=actualDeleteCount;
  if(itemCount<actualDeleteCount){
   for(let k=actualStart;k<length-actualDeleteCount;k++){
    const from=k+actualDeleteCount,to=k+itemCount;
    if(from in object)object[to]=object[from];else delete object[to];
   }
   for(let k=length;k>length-actualDeleteCount+itemCount;k--)delete object[k-1];
  }else if(itemCount>actualDeleteCount){
   for(let k=length-actualDeleteCount;k>actualStart;k--){
    const from=k+actualDeleteCount-1,to=k+itemCount-1;
    if(from in object)object[to]=object[from];else delete object[to];
   }
  }
  for(let k=0;k<itemCount;k++)object[actualStart+k]=arguments[k+2];
  object.length=length-actualDeleteCount+itemCount;
  return result;
 }`
});
export const arraySpliceMetadata=Object.freeze([{id:1408,name:'splice',field:'arraySplice',length:2}]);
