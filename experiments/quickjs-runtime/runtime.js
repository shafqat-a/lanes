import { checkProgram, numberWords } from './program.js';
import { shader, STATE_WORDS, SNAPSHOT_WORDS } from './shader.js';

function positive(n, max, name) {
  if (!Number.isInteger(n) || n < 1 || n > max) throw new RangeError(`${name} must be 1..${max}`);
}
function inputWords(value, image) {
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
  throw new TypeError('QuickJS GPU input currently accepts Number, Boolean, String, null, undefined');
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
  throw new TypeError('Object/function results cannot cross the QuickJS GPU boundary yet');
}
export class QuickJSGPU {
  #device; #owned; #pipeline; #lost; #disposed = false; #jobs = new Set();
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
    device.lost.then(info => { this.#lost = info.message || 'device lost'; });
  }
  #check() {
    if (this.#disposed) throw new Error('QuickJS GPU runtime disposed');
    if (this.#lost) throw new Error(`GPU lost: ${this.#lost}; no CPU replay`);
  }
  async #getPipeline() {
    if (!this.#pipeline) this.#pipeline = (async () => {
      this.#device.pushErrorScope('validation');
      const module = this.#device.createShaderModule({ code: shader });
      const scope = this.#device.popErrorScope();
      const info = await module.getCompilationInfo();
      const validation = await scope;
      const errors = info.messages.filter(m => m.type === 'error');
      if (errors.length) throw new Error(errors.map(m => `${m.lineNum}:${m.linePos} ${m.message}`).join('\n'));
      if (validation) throw new Error(validation.message);
      return this.#device.createComputePipelineAsync({ layout: 'auto', compute: { module, entryPoint: 'main' } });
    })();
    return this.#pipeline;
  }
  async start(program, inputs) {
    this.#check(); checkProgram(program);
    if (!Array.isArray(inputs) && !(inputs instanceof Float64Array)) throw new TypeError('Expected input array');
    positive(inputs.length, 1024, 'Batch size');
    const count = inputs.length, device = this.#device;
    const limit = Math.min(device.limits.maxStorageBufferBindingSize, device.limits.maxBufferSize);
    if (count * STATE_WORDS * 4 > limit || program.image.byteLength > limit || program.code.byteLength > limit) throw new RangeError('Program/batch exceeds GPU buffer limits');
    const initial = new Uint32Array(count * STATE_WORDS), imageWords = [...program.image];
    Array.from(inputs).forEach((value, i) => initial.set(inputWords(value, imageWords), i * STATE_WORDS + 8));
    const imageData = new Uint32Array(imageWords);
    if (imageData.byteLength > limit) throw new RangeError('Input strings exceed GPU buffer limits');
    const pipeline = await this.#getPipeline(); this.#check();
    const buffers = [], make = (size, usage) => { const b = device.createBuffer({ size, usage }); buffers.push(b); return b; };
    let state, params, staging, out, group;
    device.pushErrorScope('out-of-memory'); device.pushErrorScope('validation');
    let error;
    try {
      const code = make(program.code.byteLength, 128 | 8), image = make(imageData.byteLength, 128 | 8);
      state = make(initial.byteLength, 128 | 8); params = make(16, 64 | 8);
      out = make(count * SNAPSHOT_WORDS * 4, 128 | 4); staging = make(count * SNAPSHOT_WORDS * 4, 1 | 8);
      device.queue.writeBuffer(code, 0, program.code); device.queue.writeBuffer(image, 0, imageData); device.queue.writeBuffer(state, 0, initial);
      group = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [code, image, state, params, out].map((buffer, binding) => ({ binding, resource: { buffer } })) });
    } catch (e) { error = e; }
    const scopes = await Promise.all([device.popErrorScope(), device.popErrorScope()]);
    error ||= scopes.find(Boolean);
    if (error) { buffers.forEach(b => b.destroy()); throw error; }
    let tail = Promise.resolve(), disposed = false;
    const job = {
      backend: 'gpu',
      step: (budget = 256) => {
        positive(budget, 4096, 'Budget');
        if (disposed) return Promise.reject(new Error('Job disposed'));
        const task = tail.then(async () => {
          this.#check(); device.pushErrorScope('validation');
          let dispatchError;
          try {
            device.queue.writeBuffer(params, 0, new Uint32Array([count, budget, program.code.length / 4, program.typeTable]));
            const encoder = device.createCommandEncoder(), pass = encoder.beginComputePass();
            pass.setPipeline(pipeline); pass.setBindGroup(0, group); pass.dispatchWorkgroups(Math.ceil(count / 32)); pass.end();
            encoder.copyBufferToBuffer(out, 0, staging, 0, count * SNAPSHOT_WORDS * 4); device.queue.submit([encoder.finish()]);
          } catch (e) { dispatchError = e; }
          const validation = await device.popErrorScope();
          if (dispatchError || validation) throw dispatchError || validation;
          await staging.mapAsync(1); let words;
          try { words = new Uint32Array(staging.getMappedRange()).slice(); } finally { staging.unmap(); }
          this.#check();
          const values = [], statuses = [], steps = [], collections = [];
          for (let i = 0; i < count; i++) {
            const status = words[i * SNAPSHOT_WORDS]; statuses.push(status); steps.push(words[i * SNAPSHOT_WORDS + 1]); collections.push(words[i * SNAPSHOT_WORDS + 2]);
            if (status >= 2) {
              const reasons = { 2: 'Invalid bytecode state', 3: 'Resource limit', 4: 'TypeError', 5: 'ReferenceError', 6: 'Unsupported runtime operation', 7: 'Uncaught guest exception', 8: 'RangeError' };
              throw new Error(`${reasons[status]} in lane ${i}, instruction ${words[i * SNAPSHOT_WORDS + 3] - 1}; no CPU fallback`);
            }
            values.push(status === 1 ? decode(words, i * SNAPSHOT_WORDS + 4, program.image) : undefined);
          }
          return { backend: 'gpu', done: statuses.every(s => s === 1), values, statuses, steps, collections };
        });
        tail = task.catch(() => {}); return task;
      },
      dispose: async () => {
        if (disposed) return tail;
        disposed = true; await tail; buffers.forEach(b => b.destroy()); this.#jobs.delete(job);
      },
    };
    this.#jobs.add(job); return Object.freeze(job);
  }
  async run(program, inputs, { budget = 256, maxDispatches = 1024, signal } = {}) {
    positive(budget, 4096, 'Budget'); positive(maxDispatches, 100000, 'Dispatch limit'); signal?.throwIfAborted();
    const job = await this.start(program, inputs);
    try {
      for (let i = 0; i < maxDispatches; i++) {
        signal?.throwIfAborted(); const result = await job.step(budget); if (result.done) return result;
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      throw new Error('Execution limit; use start()/step() to resume');
    } finally { await job.dispose(); }
  }
  async dispose() {
    if (this.#disposed) return;
    this.#disposed = true; await Promise.all([...this.#jobs].map(j => j.dispose()));
    if (this.#owned) this.#device.destroy();
  }
}
