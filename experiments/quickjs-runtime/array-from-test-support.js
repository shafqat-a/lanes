import {createContext,Script} from 'node:vm';
import {arrayFromSources} from './array-from-source.js';
import {iteratorStepBootstrapSource} from './phase6-protocols/w2-iterator-record/sources.js';
import {iteratorCloseThrowSource} from './phase6-protocols/w3-iterator-close/index.js';
export function createArrayFromRealm(helper=true){
 const context=createContext({});
 if(helper)new Script(`
 const nativeApply=Reflect.apply,nativeConstruct=Reflect.construct,nativeObject=Object,nativeDefine=Reflect.defineProperty;
 const nativeNumber=Number,nativeText=String,nativeCreate=Object.create,nativeProxy=Proxy;
 function __lanesIsConstructor(value){try{nativeConstruct(new nativeProxy(value,{construct(){return {};}}),[]);return true;}catch(e){return false;}}
 function __lanesCall(fn,receiver,...args){return nativeApply(fn,receiver,args);}
 function __lanesDescriptor(){return nativeCreate(null);}
 function __lanesToObject(value){if(value===null||value===undefined)throw new TypeError();return nativeObject(value);}
 function __lanesNumber(value){return +value;}
 function __lanesText(value){return nativeText(value);}
 function __lanesReviverDefine(object,key,value){const d=nativeCreate(null);d.value=value;d.writable=true;d.enumerable=true;d.configurable=true;return nativeDefine(object,key,d);}
 const __lanesIteratorStep=(${iteratorStepBootstrapSource});
 const __lanesIteratorCloseThrow=(${iteratorCloseThrowSource});
 Object.defineProperty(Array,'from',{value:(${arrayFromSources.arrayFrom}),writable:true,configurable:true});
 `).runInContext(context);
 return context;
}
export function evaluateArrayFrom(source,input,helper=true){return new Script('('+source+')('+JSON.stringify(input)+')').runInContext(createArrayFromRealm(helper),{timeout:3000});}
