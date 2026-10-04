// Test reference only: guest execution remains on the GPU.
export const nativeOracleWorkerSource = `onmessage = async ({data}) => {
  try {
    const value = await Function('return (' + data.source + ')')()(data.input);
    postMessage({value});
  } catch (e) {
    postMessage({error: String(e?.name) + ': ' + String(e?.message), name: e?.name, message: e?.message});
  }
};`;
export function nativeWorkerOutcome(source, input, {timeoutMs=5000, createWorker}={}) {
  return new Promise(resolve => {
    let worker, url, timer, done=false;
    const finish = result => {
      if(done)return; done=true; clearTimeout(timer);
      if(worker)worker.terminate();
      if(url)URL.revokeObjectURL(url);
      resolve(result);
    };
    try {
      if(createWorker)worker=createWorker(nativeOracleWorkerSource);
      else {url=URL.createObjectURL(new Blob([nativeOracleWorkerSource],{type:'text/javascript'}));worker=new Worker(url);}
      worker.onmessage=e=>finish(e.data);
      worker.onerror=e=>finish({error:`NativeWorkerError: ${e.message}`,name:'NativeWorkerError',message:e.message});
      timer=setTimeout(()=>finish({error:`NativeOracleTimeout: exceeded ${timeoutMs}ms`,name:'NativeOracleTimeout',message:`exceeded ${timeoutMs}ms`,timeout:true}),timeoutMs);
      worker.postMessage({source,input});
    } catch(e) {finish({error:`${e.name}: ${e.message}`,name:e.name,message:e.message});}
  });
}
