// ES2025 23.1.3.2 / 23.1.3.2.1. Compiled guest code, executed on GPU.
// https://tc39.es/ecma262/2025/multipage/indexed-collections.html#sec-array.prototype.concat
export const arrayConcatSources = Object.freeze({
  arrayConcat: `function concatBootstrap(item){
    "use strict";
    const object=__lanesToObject(this);
    const result=__lanesArraySpeciesCreate(object,0);
    let n=0;
    for(let a=-1;a<arguments.length;a++){
      const value=a<0?object:arguments[a];
      let spread=false;
      if(value!==null&&(typeof value==="object"||typeof value==="function")){
        const flag=value[Symbol.isConcatSpreadable];
        spread=flag===undefined?__lanesIsArray(value):!!flag;
      }
      if(spread){
        let length=__lanesNumber(value.length);
        if(!(length>0))length=0;
        else if(length>9007199254740991)length=9007199254740991;
        else length-=length%1;
        if(n+length>9007199254740991)throw new TypeError("Concat length overflow");
        for(let k=0;k<length;k++){
          if(k in value){
            const element=value[k];
            if(!__lanesReviverDefine(result,__lanesText(n),element))throw new TypeError("Cannot define concat element");
          }
          n++;
        }
      }else{
        if(n>=9007199254740991)throw new TypeError("Concat length overflow");
        if(!__lanesReviverDefine(result,__lanesText(n),value))throw new TypeError("Cannot define concat element");
        n++;
      }
    }
    result.length=n;
    return result;
  }`,
});
