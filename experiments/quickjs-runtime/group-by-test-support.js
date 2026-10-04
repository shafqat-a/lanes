import {createContext,Script} from 'node:vm';
import {groupBySources} from './group-by-source.js';
import {iteratorOpenBootstrapSource,iteratorStepBootstrapSource} from './phase6-protocols/w2-iterator-record/sources.js';
import {iteratorCloseThrowSource} from './phase6-protocols/w3-iterator-close/index.js';
export function createGroupByRealm(helper=true){const context=createContext({});if(helper)new Script(`
const call=Reflect.apply,define=Reflect.defineProperty,create=Object.create,text=String,NativeMap=Map,mapGet=Map.prototype.get,mapSet=Map.prototype.set,ownKeys=Reflect.ownKeys;
function __lanesCall(fn,receiver,...args){return call(fn,receiver,args);}
function __lanesDescriptor(){return create(null);}
function __lanesText(value){return text(value);}
function __lanesReviverDefine(object,key,value){const d=create(null);d.value=value;d.writable=true;d.enumerable=true;d.configurable=true;return define(object,key,d);}
function __lanesCollectionCreate(brand){if(brand!==1)throw new Error('Wrong host brand');return new NativeMap();}
function __lanesMapGet(object,key){return call(mapGet,object,[key]);}
function __lanesMapSet(object,key,value){return call(mapSet,object,[key,value]);}
function __lanesToPropertyKey(value){return ownKeys({[value]:0})[0];}
const __lanesIteratorOpen=(${iteratorOpenBootstrapSource});
const __lanesIteratorStep=(${iteratorStepBootstrapSource});
const __lanesIteratorCloseThrow=(${iteratorCloseThrowSource});
Object.defineProperty(Map,'groupBy',{value:(${groupBySources.mapGroupBy}),writable:true,configurable:true});
Object.defineProperty(Object,'groupBy',{value:(${groupBySources.objectGroupBy}),writable:true,configurable:true});
`).runInContext(context);return context;}
export function evaluateGroupBy(source,input,helper=true){return new Script('('+source+')('+JSON.stringify(input)+')').runInContext(createGroupByRealm(helper),{timeout:3000});}
