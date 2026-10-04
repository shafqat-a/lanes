import {privateBuiltins} from './bootstrap.js';
export const nonreservedPrivateHelperNames=Object.freeze(Object.keys(privateBuiltins).filter(name=>!name.startsWith('__lanes')));
export const privateHelperIsolationCases=Object.freeze(nonreservedPrivateHelperNames.map(name=>({
 name,
 unresolved:`function f(x){return ${name}(x);}`,
 isolated:`function f(x){let caught=false;function nested(){return ${name}(x);}try{nested();}catch(e){caught=e instanceof ReferenceError;}const absent=typeof ${name}==='undefined'&&globalThis[${JSON.stringify(name)}]===undefined;function local(){const ${name}=v=>v+1;return ${name}(x);}return caught&&absent&&local()===x+1;}`,
})));
