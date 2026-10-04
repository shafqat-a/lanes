import {createContext,Script} from 'node:vm';
import {arraySpeciesSources} from './array-species-source.js';
export function createArraySpeciesRealm(helper=true){const context=createContext({});if(helper)new Script(`
const nativeArray=Array,nativeIsArray=Array.isArray,nativeObject=Object,nativeCreate=Object.create,nativeApply=Reflect.apply,nativeConstruct=Reflect.construct,nativeProxy=Proxy,nativeDefine=Reflect.defineProperty,nativeText=String;
function __lanesIsArray(v){return nativeIsArray(v);}
function __lanesIsConstructor(v){try{nativeConstruct(new nativeProxy(v,{construct(){return {};}}),[]);return true;}catch(e){return false;}}
function __lanesToObject(v){if(v===null||v===undefined)throw new TypeError();return nativeObject(v);}
function __lanesNumber(v){return +v;}
function __lanesText(v){return nativeText(v);}
function __lanesCall(fn,receiver,...args){return nativeApply(fn,receiver,args);}
function __lanesReviverDefine(object,key,value){const d=nativeCreate(null);d.value=value;d.writable=true;d.enumerable=true;d.configurable=true;return nativeDefine(object,key,d);}
const __lanesArraySpeciesCreate=(function(Array){return (${arraySpeciesSources.arraySpeciesCreate});})(nativeArray);
Array.prototype.map=(${arraySpeciesSources.arrayMap});Array.prototype.filter=(${arraySpeciesSources.arrayFilter});Array.prototype.slice=(${arraySpeciesSources.arraySlice});
`).runInContext(context);return context;}
export function evaluateArraySpecies(source,input,helper=true){return new Script('('+source+')('+JSON.stringify(input)+')').runInContext(createArraySpeciesRealm(helper),{timeout:3000});}
