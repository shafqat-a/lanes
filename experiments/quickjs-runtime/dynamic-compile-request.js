import { dynamicFunctionLimits, DynamicCompilationUnsupported } from './dynamic-function-compiler.js';

export const DYNAMIC_REQUEST_MAGIC = 0x4c444643;
export const DYNAMIC_REQUEST_VERSION = 1;
export const DYNAMIC_REQUEST_HEADER_WORDS = 8;
const MAX_WORDS = 8 + 17 + dynamicFunctionLimits.totalUnits;
const uint = (n, name) => { if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) throw new TypeError(`Invalid ${name}`); return n; };

export function encodeDynamicCompileRequest({ requestId, lane, parameters, body }) {
  uint(requestId, 'request id'); uint(lane, 'lane');
  if (!requestId || !Array.isArray(parameters) || parameters.length > dynamicFunctionLimits.parameters)
    throw new TypeError('Invalid dynamic compilation request');
  const strings = [...parameters, body];
  if (strings.some(s => typeof s !== 'string')) throw new TypeError('Expected pre-coerced string arguments');
  const words = [DYNAMIC_REQUEST_MAGIC, 1, requestId, lane, 1, parameters.length, 0, 0];
  for (const s of strings) {
    if (s.length > dynamicFunctionLimits.stringUnits) throw new RangeError('Dynamic source string capacity exceeded');
    words.push(s.length); for (let i=0;i<s.length;i++) words.push(s.charCodeAt(i));
  }
  if (words.length > MAX_WORDS) throw new RangeError('Dynamic source request capacity exceeded');
  words[6] = words.length;
  return new Uint32Array(words);
}

export function decodeDynamicCompileRequest(input, laneCount) {
  if(!Number.isInteger(laneCount)||laneCount<1||laneCount>1024)throw new RangeError('Invalid lane count');
  if (!(input instanceof Uint32Array) || input.length < 8 || input.length > MAX_WORDS)
    throw new TypeError('Invalid dynamic request buffer');
  const w = input.slice(); // Own the snapshot: never retain mapped GPU memory.
  if (w[0] !== DYNAMIC_REQUEST_MAGIC || w[1] !== 1 || !w[2] || w[3] >= laneCount ||
      w[4] !== 1 || w[5] > dynamicFunctionLimits.parameters || w[6] !== w.length || w[7] !== 0)
    throw new TypeError('Invalid dynamic compilation request header');
  const strings=[]; let pos=8;
  for (let i=0;i<=w[5];i++) {
    if (pos>=w.length) throw new TypeError('Truncated dynamic string');
    const len=w[pos++];
    if (len>dynamicFunctionLimits.stringUnits || pos+len>w.length) throw new TypeError('Invalid dynamic string span');
    let s=''; for(let j=0;j<len;j++){const unit=w[pos++];if(unit>65535)throw new TypeError('Invalid UTF-16 code unit');s+=String.fromCharCode(unit);}
    strings.push(s);
  }
  if(pos!==w.length)throw new TypeError('Trailing dynamic request data');
  return Object.freeze({requestId:w[2],lane:w[3],parameters:Object.freeze(strings.slice(0,-1)),body:strings.at(-1)});
}

// Service owns sequencing only. Syntax errors are guest completions; malformed
// protocol or compiler failures reject the job, never become guest exceptions.
export class DynamicCompileService {
  #compiler; #lanes; #seen=new Set(); #tail=Promise.resolve(); #closed=false; #listeners=new Set();
  constructor(compiler, {laneCount=1}={}) {
    if(typeof compiler?.compileFunction!=='function')throw new TypeError('Expected dynamic function compiler');
    if(!Number.isInteger(laneCount)||laneCount<1||laneCount>1024)throw new RangeError('Invalid lane count');
    this.#compiler=compiler;this.#lanes=laneCount;
  }
  dispose(){if(!this.#closed){this.#closed=true;for(const stop of this.#listeners)stop();this.#listeners.clear();}}
  request(buffer,{signal}={}) {
    if(this.#closed)return Promise.reject(new Error('Dynamic compilation service disposed'));
    signal?.throwIfAborted();
    const request=decodeDynamicCompileRequest(buffer,this.#lanes),key=`${request.lane}:${request.requestId}`;
    if(this.#seen.has(key))return Promise.reject(new Error('Duplicate dynamic compilation request'));
    if(this.#seen.size>=256)return Promise.reject(new RangeError('Dynamic compilation request capacity exceeded'));
    this.#seen.add(key);
    let abort,stop;
    const canceled=new Promise((_,reject)=>{
      if(signal){abort=()=>reject(signal.reason);signal.addEventListener('abort',abort,{once:true});}
      stop=()=>reject(new Error('Dynamic compilation service disposed'));this.#listeners.add(stop);
    });
    const task=this.#tail.then(async()=>{
      if(this.#closed)throw new Error('Dynamic compilation service disposed');
      signal?.throwIfAborted();
      try{
        const artifact=await this.#compiler.compileFunction(request.parameters,request.body);
        if(this.#closed)throw new Error('Dynamic compilation service disposed');
        signal?.throwIfAborted();
        return Object.freeze({requestId:request.requestId,lane:request.lane,completion:'compiled',artifact});
      }catch(error){
        if(this.#closed||signal?.aborted)throw error;
        const completion=error instanceof SyntaxError?'syntax-error':error instanceof RangeError?'resource-limit':error instanceof DynamicCompilationUnsupported?'unsupported':null;
        if(!completion)throw error;
        return Object.freeze({requestId:request.requestId,lane:request.lane,completion,message:error.message});
      }
    });
    // Cancellation rejects queued and active callers promptly. The execution
    // tail still waits for the compile adapter, forbidding concurrent entry.
    this.#tail=task.catch(()=>{});
    return Promise.race([task,canceled]).finally(()=>{if(abort)signal.removeEventListener('abort',abort);this.#listeners.delete(stop);});
  }
}
