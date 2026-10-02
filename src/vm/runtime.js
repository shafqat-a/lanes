import { compileVM } from './compiler.js';
import { checkProgram, encode, decode, STATE_WORDS } from './values.js';
import { initialCPU, advanceCPU } from './cpu.js';
import { vmShader } from './shader.js';
export { compileVM } from './compiler.js';
export { VM_STATUS } from './values.js';
function integer(value, max, name) {
  if (!Number.isInteger(value) || value < 1 || value > max) throw new RangeError(`${name} must be an integer between 1 and ${max}`);
}
// An unavailable device chooses CPU for a new runtime. No feature fallback,
// pipeline-error fallback, or device-loss replay is permitted.
export class JavaScriptVM {
  #device; #owned; #lost; #disposed = false; #pipeline; #jobs = new Set();
  static async create({ backend = 'auto', gpu = globalThis.navigator?.gpu, device } = {}) {
    if (!['auto', 'gpu', 'cpu'].includes(backend)) throw new TypeError('Invalid backend');
    let owned = false;
    if (backend !== 'cpu' && !device && gpu) {
      // API errors propagate. Only absent API/adapter selects CPU.
      const adapter = await gpu.requestAdapter();
      if (adapter) { device = await adapter.requestDevice(); owned = true; }
    }
    if (backend === 'gpu' && !device) throw new Error('No GPU available');
    return new JavaScriptVM(backend === 'cpu' ? undefined : device, owned);
  }
  constructor(device, owned = false) {
    this.#device = device; this.#owned = owned;
    if (device) device.lost.then(info => { this.#lost = info.message || 'GPU device lost'; });
  }
  get backend() { return this.#device ? 'gpu' : 'cpu'; }
  #check() { if (this.#disposed) throw new Error('VM disposed'); if (this.#lost) throw new Error(`GPU device lost: ${this.#lost}. No CPU replay performed.`); }
  compile(source) { this.#check(); return compileVM(source); }
  async #getPipeline() {
    if (!this.#pipeline) this.#pipeline = (async () => {
      const module = this.#device.createShaderModule({ code: vmShader });
      const info = await module.getCompilationInfo();
      const errors = info.messages.filter(m => m.type === 'error');
      if (errors.length) throw new Error(errors.map(e => e.message).join('\n'));
      return this.#device.createComputePipelineAsync({ layout: 'auto', compute: { module, entryPoint: 'main' } });
    })();
    return this.#pipeline;
  }
  async start(program, inputs) {
    this.#check(); checkProgram(program);
    if (!Array.isArray(inputs) && !(inputs instanceof Float64Array)) throw new TypeError('Expected an Array or Float64Array of primitive inputs');
    if (inputs.length > 4096) throw new RangeError('Experimental VM batch limit: 4096 instances');
    const values = Array.from(inputs), count = values.length;
    const raw = new Uint32Array(Math.max(1, count) * STATE_WORDS);
    for (let i = 0; i < count; i++) encode(values[i], raw, i * STATE_WORDS + 8);
    const device = this.#device, buffers = [];
    let group, stateBuffer, staging, params, pipeline, cpuStates;
    try {
      if (device && count) {
        pipeline = await this.#getPipeline(); this.#check();
        const limit = Math.min(device.limits.maxStorageBufferBindingSize, device.limits.maxBufferSize);
        if (raw.byteLength > limit || Math.ceil(count / 32) > device.limits.maxComputeWorkgroupsPerDimension) throw new RangeError('VM batch exceeds GPU limits');
        const buffer = (size, usage) => { const b = device.createBuffer({ size, usage }); buffers.push(b); return b; };
        const words = new Uint32Array(program.instructions);
        const constants = new Uint32Array(Math.max(1, program.constants.length) * 4);
        program.constants.forEach((value, i) => encode(value, constants, i * 4));
        device.pushErrorScope('out-of-memory'); device.pushErrorScope('validation');
        let allocationError;
        try {
          const code = buffer(words.byteLength, 128 | 8), literals = buffer(constants.byteLength, 128 | 8);
          stateBuffer = buffer(raw.byteLength, 128 | 8 | 4); staging = buffer(raw.byteLength, 1 | 8); params = buffer(16, 64 | 8);
          device.queue.writeBuffer(code, 0, words); device.queue.writeBuffer(literals, 0, constants); device.queue.writeBuffer(stateBuffer, 0, raw);
          group = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [code, literals, stateBuffer, params].map((buffer, binding) => ({ binding, resource: { buffer } })) });
        } catch (error) { allocationError = error; }
        // Pop both scopes before awaiting, so concurrent jobs cannot interleave scopes.
        const scopeResults = await Promise.all([device.popErrorScope(), device.popErrorScope()]);
        if (allocationError) throw allocationError;
        const failure = scopeResults.find(Boolean);
        if (failure) throw new Error(`GPU VM allocation failed: ${failure.message}`);
      } else { cpuStates = initialCPU(values); }
      let disposed = false, tail = Promise.resolve();
      const enqueue = work => {
        if (disposed) return Promise.reject(new Error('VM job disposed'));
        const task = tail.then(() => { this.#check(); return work(); });
        tail = task.catch(() => {}); return task;
      };
      const snapshot = () => {
        const statuses = new Uint32Array(count), steps = new Uint32Array(count), output = Array(count).fill(undefined);
        for (let i = 0; i < count; i++) {
          statuses[i] = cpuStates ? cpuStates[i].status : raw[i * STATE_WORDS + 1];
          steps[i] = cpuStates ? cpuStates[i].steps : raw[i * STATE_WORDS + 2];
          if (statuses[i] === 1) output[i] = cpuStates ? cpuStates[i].value : decode(raw, i * STATE_WORDS + 4);
        }
        return { backend: this.backend, values: output, statuses, steps, done: statuses.every(s => s === 1) };
      };
      const job = {
        backend: this.backend,
        step: (budget = 256) => {
          integer(budget, 4096, 'Dispatch budget');
          return enqueue(async () => {
            if (cpuStates) advanceCPU(program, cpuStates, budget);
            else {
              device.pushErrorScope('validation');
              let dispatchError;
              try {
                device.queue.writeBuffer(params, 0, new Uint32Array([count, budget, program.instructions.length / 4, 0]));
                const encoder = device.createCommandEncoder(), pass = encoder.beginComputePass();
                pass.setPipeline(pipeline); pass.setBindGroup(0, group); pass.dispatchWorkgroups(Math.ceil(count / 32)); pass.end();
                encoder.copyBufferToBuffer(stateBuffer, 0, staging, 0, raw.byteLength); device.queue.submit([encoder.finish()]);
              } catch (error) { dispatchError = error; }
              const validation = await device.popErrorScope();
              if (dispatchError) throw dispatchError;
              if (validation) throw new Error(`GPU VM dispatch failed: ${validation.message}`);
              await staging.mapAsync(1);
              try { raw.set(new Uint32Array(staging.getMappedRange())); } finally { staging.unmap(); }
              this.#check();
            }
            const result = snapshot();
            if (result.statuses.some(s => s === 2)) throw new Error('Invalid VM instruction state');
            return result;
          });
        },
        dispose: async () => {
          if (disposed) return tail;
          disposed = true; await tail;
          for (const b of buffers) b.destroy(); this.#jobs.delete(job);
        },
      };
      this.#check(); this.#jobs.add(job); return Object.freeze(job);
    } catch (error) { for (const b of buffers) b.destroy(); throw error; }
  }
  async run(program, inputs, { budget = 256, maxDispatches = 1024, signal } = {}) {
    integer(budget, 4096, 'Dispatch budget'); integer(maxDispatches, 100000, 'Dispatch count');
    signal?.throwIfAborted();
    const job = await this.start(program, inputs);
    try {
      for (let i = 0; i < maxDispatches; i++) {
        signal?.throwIfAborted(); const result = await job.step(budget); signal?.throwIfAborted();
        if (result.done) return result;
        // Allow browser cancellation and rendering between bounded dispatches.
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      throw new Error('VM execution limit reached; use start()/step() for resumable execution');
    } finally { await job.dispose(); }
  }
  async dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    await Promise.all([...this.#jobs].map(job => job.dispose()));
    if (this.#owned) this.#device.destroy();
  }
}
