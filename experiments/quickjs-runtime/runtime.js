import { checkProgram, numberWords } from './program.js';
import { STATE_WORDS, SNAPSHOT_WORDS } from './shader.js';
import {splitShaders, CONTROL_WORDS, PARAM_WORDS, INTERNAL_CALL_STATUS} from './split-dispatch-shader.js';
import {createSplitPipelineLayout} from './split-pipeline-layout.js';
import { stringCaseStorage } from './string-case-buffer.js';
import { packBigIntInput, unpackBigIntOutput } from './bigint-transfer.js';

function deferred() {
  const listeners = new Set();
  let settled = false, reason;
  return {
    subscribe(listener) {
      if (settled) listener(reason); else listeners.add(listener);
      return () => listeners.delete(listener);
    },
    resolve(error) {
      if (settled) return;
      settled = true; reason = error;
      for (const listener of listeners) listener(error);
      listeners.clear();
    },
  };
}
async function interruptible(promise, stopped, signal) {
  let abort, unsubscribe;
  const interrupted = new Promise((_, reject) => {
    unsubscribe = stopped.subscribe(reject);
    if (signal) {
      abort = () => reject(signal.reason);
      if (signal.aborted) abort();
      else signal.addEventListener('abort', abort, { once: true });
    }
  });
  try { return await Promise.race([promise, interrupted]); }
  finally {
    unsubscribe();
    if (abort) signal.removeEventListener('abort', abort);
  }
}
function positive(n, max, name) {
  if (!Number.isInteger(n) || n < 1 || n > max) throw new RangeError(`${name} must be 1..${max}`);
}
function inputWords(value, image) {
  if (typeof value === 'bigint') return packBigIntInput(value, image);
  if (typeof value === 'string') {
    if (value.length > 256) throw new RangeError('GPU string limit: 256 UTF-16 code units');
    const start = image.length / 4;
    for (let i = 0; i < value.length; i++) image.push(value.charCodeAt(i), 0, 0, 0);
    const index = image.length / 4, words = [start, value.length, 7, index]; image.push(...words); return words;
  }
  if (typeof value === 'number') return numberWords(value);
  if (typeof value === 'boolean') return numberWords(Number(value), 1);
  if (value === null) return [0, 0, 2, 0];
  if (value === undefined) return [0, 0x7ff80000, 3, 0];
  throw new TypeError('QuickJS GPU input currently accepts Number, BigInt, Boolean, String, null, undefined');
}
function decode(words, offset, image) {
  const tag = words[offset + 2];
  if (tag === 0 || tag === 1) {
    const n = new DataView(words.buffer, words.byteOffset + offset * 4, 8).getFloat64(0, true);
    return tag === 1 ? n !== 0 : n;
  }
  if (tag === 2) return null;
  if (tag === 3) return undefined;
  if (tag === 7) {
    let text = ''; const start = words[offset], length = words[offset + 1];
    for (let i = 0; i < length; i++) text += String.fromCharCode(words[offset + 4 + i]);
    return text;
  }
  if (tag === 18) return unpackBigIntOutput(words, offset);
  if (tag === 17) throw new TypeError('Unsupported GPU output: Symbol values cannot cross the QuickJS GPU boundary yet');
  throw new TypeError('Object/function results cannot cross the QuickJS GPU boundary yet');
}
export class QuickJSGPU {
  #device; #owned; #pipeline; #lost; #disposed = false; #jobs = new Set(); #stopped = deferred(); #disposing;
  static async create({ device, gpu = globalThis.navigator?.gpu } = {}) {
    let owned = false;
    if (!device) {
      const adapter = await gpu?.requestAdapter();
      if (!adapter) throw new Error('QuickJS GPU experiment requires WebGPU; no CPU fallback executed');
      device = await adapter.requestDevice(); owned = true;
    }
    return new QuickJSGPU(device, owned);
  }
  constructor(device, owned = false) {
    this.#device = device; this.#owned = owned;
    device.lost.then(info => {
      this.#lost = info.message || 'device lost';
      this.#stopped.resolve(new Error(`GPU lost: ${this.#lost}; no CPU replay`));
      for (const job of this.#jobs) void job.dispose();
    });
  }
  #check() {
    if (this.#disposed) throw new Error('QuickJS GPU runtime disposed');
    if (this.#lost) throw new Error(`GPU lost: ${this.#lost}; no CPU replay`);
  }
  async #getPipeline() {
    if (!this.#pipeline) this.#pipeline = (async () => {
      const layout=createSplitPipelineLayout(this.#device);
      const pipelines={layout:layout.group};
      for(const [name,shader] of Object.entries(splitShaders)){
      this.#device.pushErrorScope('validation');
      let module, creationError;
      try { module = this.#device.createShaderModule({ code: shader }); }
      catch (error) { creationError = error; }
      const scope = this.#device.popErrorScope();
      // Observe both rejections and always pop the scope, including a synchronous
      // shader-module failure. Error scopes belong to the shared device.
      const [info, validation] = await Promise.all([
        creationError ? Promise.reject(creationError) : Promise.resolve().then(() => module.getCompilationInfo()),
        scope,
      ]);
      const errors = info.messages.filter(m => m.type === 'error');
      if (errors.length) throw new Error(errors.map(m => `${m.lineNum}:${m.linePos} ${m.message}`).join('\n'));
      if (validation) throw new Error(validation.message);
      pipelines[name]=await this.#device.createComputePipelineAsync({ layout: layout.pipeline, compute: { module, entryPoint: 'main' } });
      }
      return pipelines;
    })();
    return this.#pipeline;
  }
  async start(program, inputs, { signal, promiseResults } = {}) {
    signal?.throwIfAborted();
    if (promiseResults !== undefined && promiseResults !== 'settle') throw new TypeError("promiseResults must be undefined or 'settle'");
    this.#check(); checkProgram(program);
    if (!Array.isArray(inputs) && !(inputs instanceof Float64Array)) throw new TypeError('Expected input array');
    positive(inputs.length, 1024, 'Batch size');
    const count = inputs.length, device = this.#device;
    const limit = Math.min(device.limits.maxStorageBufferBindingSize, device.limits.maxBufferSize);
    if (stringCaseStorage.byteLength > limit) throw new RangeError('Unicode tables exceed GPU buffer limits');
    if (device.limits.maxStorageBuffersPerShaderStage < 6 || device.limits.maxBindingsPerBindGroup < 7) throw new RangeError('Split runtime exceeds GPU binding limits');
    if (count * CONTROL_WORDS * 4 > limit || count * STATE_WORDS * 4 > limit || program.image.byteLength > limit || program.code.byteLength > limit) throw new RangeError('Program/batch exceeds GPU buffer limits');
    const initial = new Uint32Array(count * STATE_WORDS), imageWords = [...program.image];
    Array.from(inputs).forEach((value, i) => initial.set(inputWords(value, imageWords), i * STATE_WORDS + 8));
    const imageData = new Uint32Array(imageWords);
    if (imageData.byteLength > limit) throw new RangeError('Input values exceed GPU buffer limits');
    const pipeline = await interruptible(this.#getPipeline(), this.#stopped, signal); this.#check();
    const buffers = [], make = (size, usage) => { const b = device.createBuffer({ size, usage }); buffers.push(b); return b; };
    let state, params, staging, out, group;
    device.pushErrorScope('out-of-memory'); device.pushErrorScope('validation');
    let error;
    try {
      const code = make(program.code.byteLength, 128 | 8), image = make(imageData.byteLength, 128 | 8);
      state = make(initial.byteLength, 128 | 8); params = make(PARAM_WORDS * 4, 64 | 8);
      // Immutable Unicode data is uploaded per job and shares its cancellation,
      // allocation-failure, and device-loss cleanup path. No guest work on CPU.
      const unicode = make(stringCaseStorage.byteLength, 128 | 8);
      out = make(count * SNAPSHOT_WORDS * 4, 128 | 4); staging = make(count * SNAPSHOT_WORDS * 4, 1 | 8);
      const control=make(count * CONTROL_WORDS * 4, 128 | 8);
      device.queue.writeBuffer(code, 0, program.code); device.queue.writeBuffer(image, 0, imageData); device.queue.writeBuffer(state, 0, initial);
      device.queue.writeBuffer(unicode, 0, stringCaseStorage);
      group = device.createBindGroup({ layout: pipeline.layout, entries: [code, image, state, params, out, unicode, control].map((buffer, binding) => ({ binding, resource: { buffer } })) });
    } catch (e) { error = e; }
    const scopesPromise = Promise.all([device.popErrorScope(), device.popErrorScope()]);
    try {
      const scopes = await interruptible(scopesPromise, this.#stopped, signal);
      error ||= scopes.find(Boolean);
      this.#check(); signal?.throwIfAborted();
    } catch (e) { error ||= e; }
    if (error) { buffers.forEach(b => b.destroy()); throw error; }
    let tail = Promise.resolve(), disposed = false, epoch = 0;
    const stopped = deferred();
    const wait = promise => interruptible(promise, stopped);
    const job = {
      backend: 'gpu',
      step: (budget = 256) => {
        positive(budget, 4096, 'Budget');
        if (disposed) return Promise.reject(new Error('Job disposed'));
        const task = tail.then(async () => {
          this.#check();
          if (disposed) throw new Error('Job disposed');
          if(epoch===0xffffffff) throw new RangeError('GPU step epoch exhausted; create a new job');
          epoch++;
          let words;
          // Scheduling only: all guest calls, completion and budget accounting
          // remain in WGSL. Internal status 15 never escapes the public API.
          do {
            this.#check();
            if(disposed) throw new Error('Job disposed');
            device.pushErrorScope('validation');
            let dispatchError;
            try {
              device.queue.writeBuffer(params, 0, new Uint32Array([count, budget, program.code.length / 4, program.typeTable, epoch, 0, 0, 0]));
              const encoder=device.createCommandEncoder();
              for(const stage of [pipeline.main,pipeline.call,pipeline.native]){
                const pass=encoder.beginComputePass();
                pass.setPipeline(stage);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(count/32));pass.end();
              }
              encoder.copyBufferToBuffer(out,0,staging,0,count*SNAPSHOT_WORDS*4);
              device.queue.submit([encoder.finish()]);
            } catch(error) { dispatchError=error; }
            const validation=await wait(device.popErrorScope());
            if(dispatchError||validation) throw dispatchError||validation;
            await wait(staging.mapAsync(1));
            try { words=new Uint32Array(staging.getMappedRange()).slice(); } finally { staging.unmap(); }
            this.#check();
          } while(Array.from({length:count},(_,i)=>words[i*SNAPSHOT_WORDS]).includes(INTERNAL_CALL_STATUS));
          const values = [], statuses = [], steps = [], collections = [], settlements = [];
          for (let i = 0; i < count; i++) {
            const status = words[i * SNAPSHOT_WORDS]; statuses.push(status); steps.push(words[i * SNAPSHOT_WORDS + 1]); collections.push(words[i * SNAPSHOT_WORDS + 2]);
            // 12/13/14: script and guest job queue completed on GPU with a promise result.
            const settlement = status >= 12 && status <= 14 ? ['fulfilled', 'rejected', 'pending'][status - 12] : undefined;
            if (settlement && promiseResults !== 'settle') throw new TypeError(`Promise result (${settlement}) in lane ${i} requires { promiseResults: 'settle' }; no CPU fallback`);
            settlements.push(settlement);
            if (status >= 2 && !settlement) {
              const reasons = { 2: 'Invalid bytecode state', 3: 'Resource limit', 4: 'TypeError', 5: 'ReferenceError', 6: 'Unsupported runtime operation', 7: 'Uncaught guest exception', 8: 'RangeError' };
              throw new Error(`${reasons[status]} in lane ${i}, instruction ${words[i * SNAPSHOT_WORDS + 3] - 1}; no CPU fallback`);
            }
            values.push(status === 1 || status === 12 || status === 13 ? decode(words, i * SNAPSHOT_WORDS + 4, program.image) : undefined);
          }
          return { backend: 'gpu', done: statuses.every(s => s === 1 || (s >= 12 && s <= 14)), values, statuses, steps, collections, settlements };
        });
        tail = task.catch(() => {}); return task;
      },
      dispose: async () => {
        if (disposed) return tail;
        disposed = true;
        stopped.resolve(new Error('Job disposed; no CPU replay'));
        // Destroying a buffer cancels a pending map. Do not wait for the map
        // before destroying it: device loss and cancellation must settle jobs.
        buffers.forEach(b => b.destroy()); this.#jobs.delete(job);
        await tail;
      },
    };
    this.#jobs.add(job); return Object.freeze(job);
  }
  async run(program, inputs, { budget = 256, maxDispatches = 1024, signal, promiseResults } = {}) {
    positive(budget, 4096, 'Budget'); positive(maxDispatches, 100000, 'Dispatch limit'); signal?.throwIfAborted();
    const job = await this.start(program, inputs, { signal, promiseResults });
    const abort = () => { void job.dispose(); };
    signal?.addEventListener('abort', abort, { once: true });
    try {
      for (let i = 0; i < maxDispatches; i++) {
        signal?.throwIfAborted();
        const result = await interruptible(job.step(budget), this.#stopped, signal);
        signal?.throwIfAborted(); if (result.done) return result;
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      throw new Error('Execution limit; use start()/step() to resume');
    } finally { signal?.removeEventListener('abort', abort); await job.dispose(); }
  }
  dispose() {
    if (this.#disposing) return this.#disposing;
    this.#disposed = true;
    this.#stopped.resolve(new Error('QuickJS GPU runtime disposed; no CPU replay'));
    this.#disposing = (async () => {
      await Promise.all([...this.#jobs].map(j => j.dispose()));
      if (this.#owned) this.#device.destroy();
    })();
    return this.#disposing;
  }
}
