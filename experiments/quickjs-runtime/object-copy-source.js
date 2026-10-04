// ES2025 Object.entries / Object.assign. All observation and writes are guest bytecode.
export const objectCopySources=Object.freeze({
 objectEntries:`function objectEntries(value){"use strict";
  const from=__lanesToObject(value),keys=__lanesOwnPropertyKeys(from),result=[];let count=0;
  for(let i=0;i<keys.length;i++){const key=keys[i];if(typeof key!=="string")continue;
    const own=__lanesOwnDescriptor(from,key);if(own!==undefined&&own.enumerable){
      const pair=[key,from[key]],desc=__lanesDescriptor();desc.value=pair;desc.writable=true;desc.enumerable=true;desc.configurable=true;__lanesDefine(result,count++,desc);
    }
  }return result;
 }`,
 objectAssign:`function objectAssign(target){"use strict";
  const to=__lanesToObject(target);
  for(let n=1;n<arguments.length;n++){const source=arguments[n];if(source===null||source===undefined)continue;
    const from=__lanesToObject(source),keys=__lanesOwnPropertyKeys(from);
    for(let i=0;i<keys.length;i++){const key=keys[i],own=__lanesOwnDescriptor(from,key);if(own!==undefined&&own.enumerable)to[key]=from[key];}
  }return to;
 }`
});
export const objectCopyMetadata=[{id:2363,name:'entries',field:'objectEntries',length:1},{id:2364,name:'assign',field:'objectAssign',length:2}];
