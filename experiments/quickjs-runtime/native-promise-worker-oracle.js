import {nativeWorkerOutcome} from './native-worker-oracle.js';
// Fifty milliseconds is the existing pending-reference policy. Its timer lives
// inside the isolated realm; the outer worker deadline can stop microtask loops.
export const promiseOracleSource = `function(payload) {
  const NativePromise=Promise,nativeResolve=Promise.resolve,nativeThen=Promise.prototype.then;
  const apply=Reflect.apply,delay=setTimeout,cancel=clearTimeout;
  return new NativePromise(finish=>{
    let value;
    try {value=Function('return ('+payload.source+')')()(payload.input);}
    catch(e){finish({settlement:'sync-throw',value:String(e?.name)+': '+String(e?.message)});return;}
    const thenable=(typeof value==='object'||typeof value==='function')&&value!==null&&typeof value.then==='function';
    if(!thenable){finish({settlement:undefined,value});return;}
    let done=false,timer;
    const settle=(settlement,result)=>{if(done)return;done=true;cancel(timer);finish({settlement,value:result});};
    timer=delay(()=>settle('pending',undefined),50);
    // Never call fixture-mutated Promise.race/resolve or a Promise's own then.
    // Captured resolve also assimilates generic thenables when returned.
    const normalized=apply(nativeResolve,NativePromise,[value]);
    apply(nativeThen,normalized,[v=>settle('fulfilled',v),e=>settle('rejected',e)]);
  });
}`;
export async function nativePromiseWorkerOutcome(source,input,options){
 const result=await nativeWorkerOutcome(promiseOracleSource,{source,input},options);
 if('error' in result)return {nativeError:result.error,name:result.name,timeout:!!result.timeout};
 return result.value;
}

// Explicit fixture-scoped native defects never supply a GPU expected value.
export function allowedNativePromiseError(item,input,outcome){
 const allowed=item.nativeOracleError;
 return !!(allowed && item.expected!==undefined && item.hasSettlement &&
  allowed.inputs.some(x=>Object.is(x,input)) && outcome.name===allowed.name &&
  outcome.nativeError===allowed.nativeError && outcome.timeout===allowed.timeout);
}

export function allowedNativePromiseValue(item,input,outcome){
 const index=item.inputs.findIndex(x=>Object.is(x,input));
 return !!(index>=0 && item.expected!==undefined && item.hasSettlement &&
  item.nativeReferenceDifference && item.allowedNativeExpected &&
  !outcome.nativeError && outcome.settlement===item.settlement &&
  Object.is(outcome.value,item.allowedNativeExpected[index]));
}
