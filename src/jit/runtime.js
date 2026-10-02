import { lower, sourceText, COMPILER_VERSION } from './ir.js';
import { emitCPU, emitWGSL } from './emit.js';
const runtimeState = new WeakMap(), kernelState = new WeakMap(), batchState = new WeakMap();
const MAX_INPUTS = 16777216;
function inputsCheck(inputs) {
  if (!(inputs instanceof Int32Array)) throw new TypeError('Inputs must be an Int32Array');
  if (inputs.length > MAX_INPUTS) throw new RangeError(`Batch limit is ${MAX_INPUTS} inputs`);
}
function alive(runtime) {
  const state = runtimeState.get(runtime);
  if (state.disposed) throw new Error('Lanes runtime is disposed');
  return state;
}
function backendFor(state, backend = state.backend) {
  if (!['auto', 'cpu', 'gpu'].includes(backend)) throw new TypeError('backend must be auto, cpu, or gpu');
  if (backend === 'cpu') return 'cpu';
  if (!state.device || state.lost) {
    if (backend === 'gpu') throw new Error(state.lost ? `GPU device lost: ${state.lost}` : 'WebGPU is unavailable');
    return 'cpu';
  }
  return 'gpu';
}
async function pipeline(state, compiled) {
  if (state.lost) throw new Error(`GPU device lost: ${state.lost}`);
  if (state.pipelines.has(compiled.key)) { state.stats.pipelineCacheHits++; return state.pipelines.get(compiled.key); }
  state.stats.pipelineCompilations++;
  const promise = (async () => {
    const module = state.device.createShaderModule({ code: compiled.wgsl });
    const info = await module.getCompilationInfo();
    const errors = info.messages.filter(m => m.type === 'error');
    if (errors.length) throw new Error(`WGSL compilation failed: ${errors.map(m => `${m.lineNum}:${m.linePos} ${m.message}`).join('\n')}`);
    return state.device.createComputePipelineAsync({ layout: 'auto', compute: { module, entryPoint: 'main' } });
  })();
  state.pipelines.set(compiled.key, promise);
  try { return await promise; }
  catch (error) { if (state.pipelines.get(compiled.key) === promise) state.pipelines.delete(compiled.key); throw error; }
}
export class Lanes {
  constructor(token, state) {
    if (token !== runtimeState) throw new TypeError('Use Lanes.create()');
    runtimeState.set(this, state);
  }
  static async create({ backend = 'auto', device, gpu = globalThis.navigator?.gpu } = {}) {
    if (!['auto', 'cpu', 'gpu'].includes(backend)) throw new TypeError('backend must be auto, cpu, or gpu');
    let owned = false, fallbackReason = null;
    if (!device && backend !== 'cpu') {
      try {
        const adapter = await gpu?.requestAdapter({ powerPreference: 'high-performance' });
        if (adapter) { device = await adapter.requestDevice(); owned = true; }
        else fallbackReason = 'No WebGPU adapter available';
      } catch (error) { if (backend === 'gpu') throw error; fallbackReason = error.message; }
    }
    if (backend === 'gpu' && !device) throw new Error('WebGPU is unavailable');
    const state = { backend, device, owned, fallbackReason, lost: null, disposed: false,
      kernels: new Map(), pipelines: new Map(), batches: new Set(),
      stats: { pipelineCompilations: 0, pipelineCacheHits: 0, cpuDispatches: 0, gpuDispatches: 0 } };
    if (device) device.lost.then(info => { state.lost = info.message || info.reason || 'unknown'; state.pipelines.clear(); });
    return new Lanes(runtimeState, state);
  }
  get backend() { return backendFor(alive(this)); }
  get diagnostics() {
    const state = runtimeState.get(this);
    return Object.freeze({ ...state.stats, fallbackReason: state.lost ?? state.fallbackReason, disposed: state.disposed });
  }
  compile(source, options = {}) {
    const state = alive(this), text = sourceText(source);
    if (options.numericMode !== 'i32') throw new TypeError('Explicit numericMode: "i32" is required');
    const key = `${COMPILER_VERSION}\0i32\0${text}`;
    if (state.kernels.has(key)) return state.kernels.get(key);
    const ir = lower(text, options), compiled = { key, ir, wgsl: emitWGSL(ir), cpu: emitCPU(ir), runtime: this };
    const kernel = new Kernel(kernelState, compiled); state.kernels.set(key, kernel); return kernel;
  }
  async batch(inputOrLength, { backend } = {}) {
    const state = alive(this);
    let inputs;
    if (typeof inputOrLength === 'number') {
      if (!Number.isSafeInteger(inputOrLength) || inputOrLength < 0 || inputOrLength > MAX_INPUTS) throw new RangeError('Invalid batch length');
      inputs = new Int32Array(inputOrLength);
    } else { inputsCheck(inputOrLength); inputs = inputOrLength.slice(); }
    const selected = backendFor(state, backend);
    const batch = new Batch(batchState, { runtime: this, backend: selected, length: inputs.length,
      data: inputs, buffers: [], groups: new Map(), index: 0, tail: Promise.resolve(), closed: false, closing: null });
    const b = batchState.get(batch); state.batches.add(batch);
    try {
      if (selected === 'gpu' && inputs.length) {
        const device = state.device, bytes = inputs.byteLength;
        if (bytes > Math.min(device.limits.maxBufferSize, device.limits.maxStorageBufferBindingSize) ||
          Math.ceil(inputs.length / 64) > device.limits.maxComputeWorkgroupsPerDimension)
          throw new RangeError('Batch exceeds GPU device limits; split it or select cpu');
        // Push and pop scopes before awaiting, so concurrent batch creation cannot interleave scopes.
        device.pushErrorScope('out-of-memory'); device.pushErrorScope('validation');
        let validation, memory;
        try {
          for (let i = 0; i < 2; i++) b.buffers.push(device.createBuffer({ size: bytes, usage: 128 | 4 | 8 }));
          b.staging = device.createBuffer({ size: bytes, usage: 1 | 8 });
          device.queue.writeBuffer(b.buffers[0], 0, inputs);
        } finally { validation = device.popErrorScope(); memory = device.popErrorScope(); }
        const errors = await Promise.all([validation, memory]);
        if (errors.some(Boolean)) throw new Error(errors.filter(Boolean).map(e => e.message).join('\n'));
        b.data = null;
      }
      if (state.disposed || b.closed) throw new Error('Runtime disposed during batch creation');
      return batch;
    } catch (error) { await batch.dispose(); throw error; }
  }
  async dispose() {
    const state = runtimeState.get(this);
    if (state.closing) return state.closing;
    state.disposed = true;
    state.closing = (async () => {
      await Promise.all([...state.batches].map(b => b.dispose()));
      state.kernels.clear(); state.pipelines.clear();
      if (state.owned) state.device?.destroy();
    })();
    return state.closing;
  }
}
class Kernel {
  constructor(token, compiled) { if (token !== kernelState) throw new TypeError('Use lanes.compile()'); kernelState.set(this, compiled); Object.freeze(this); }
  get wgsl() { return kernelState.get(this).wgsl; }
  get ir() { return kernelState.get(this).ir; }
  async run(inputs, { backend } = {}) {
    const compiled = kernelState.get(this); alive(compiled.runtime); inputsCheck(inputs);
    const batch = await compiled.runtime.batch(inputs, { backend });
    try { await batch.run(this); return await batch.read(); } finally { await batch.dispose(); }
  }
}
class Batch {
  constructor(token, state) { if (token !== batchState) throw new TypeError('Use lanes.batch()'); batchState.set(this, state); Object.freeze(this); }
  get length() { return batchState.get(this).length; }
  get backend() { return batchState.get(this).backend; }
  _enqueue(operation) {
    const b = batchState.get(this);
    try { alive(b.runtime); if (b.closed) throw new Error('Batch is disposed'); }
    catch (error) { return Promise.reject(error); }
    const result = b.tail.then(async () => {
      const state = runtimeState.get(b.runtime);
      if (b.backend === 'gpu' && state.lost) throw new Error(`GPU device lost; resident data is unavailable: ${state.lost}`);
      return operation(b, state);
    });
    b.tail = result.catch(() => {}); return result;
  }
  upload(inputs) {
    inputsCheck(inputs);
    if (inputs.length !== this.length) throw new RangeError('Upload length must match the batch');
    const copy = inputs.slice();
    return this._enqueue((b, state) => {
      if (b.backend === 'cpu') b.data = copy;
      else if (b.length) state.device.queue.writeBuffer(b.buffers[b.index], 0, copy);
      return this;
    });
  }
  run(kernel) {
    const compiled = kernelState.get(kernel), b = batchState.get(this);
    if (!compiled || compiled.runtime !== b.runtime) return Promise.reject(new TypeError('Kernel belongs to a different runtime'));
    return this._enqueue(async (b, state) => {
      if (!b.length) return this;
      if (b.backend === 'cpu') { b.data = compiled.cpu(b.data); state.stats.cpuDispatches++; return this; }
      const p = await pipeline(state, compiled), device = state.device;
      let groups = b.groups.get(p);
      if (!groups) {
        groups = [0, 1].map(index => device.createBindGroup({ layout: p.getBindGroupLayout(0), entries: [
          { binding: 0, resource: { buffer: b.buffers[index] } },
          { binding: 1, resource: { buffer: b.buffers[1 - index] } },
        ] })); b.groups.set(p, groups);
      }
      const encoder = device.createCommandEncoder(), pass = encoder.beginComputePass();
      pass.setPipeline(p); pass.setBindGroup(0, groups[b.index]); pass.dispatchWorkgroups(Math.ceil(b.length / 64)); pass.end();
      device.queue.submit([encoder.finish()]); b.index = 1 - b.index; state.stats.gpuDispatches++; return this;
    });
  }
  read() {
    return this._enqueue(async (b, state) => {
      if (!b.length) return new Int32Array();
      if (b.backend === 'cpu') return b.data.slice();
      const encoder = state.device.createCommandEncoder();
      encoder.copyBufferToBuffer(b.buffers[b.index], 0, b.staging, 0, b.length * 4);
      state.device.queue.submit([encoder.finish()]);
      await b.staging.mapAsync(1);
      try { return new Int32Array(b.staging.getMappedRange()).slice(); } finally { b.staging.unmap(); }
    });
  }
  async dispose() {
    const b = batchState.get(this);
    if (b.closing) return b.closing;
    b.closed = true;
    b.closing = (async () => {
      await b.tail;
      for (const buffer of b.buffers) buffer.destroy(); b.staging?.destroy();
      b.data = null; b.groups.clear(); runtimeState.get(b.runtime).batches.delete(this);
    })(); return b.closing;
  }
}
