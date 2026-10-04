import test from 'node:test';
import assert from 'node:assert/strict';
import { QuickJSGPU } from './runtime.js';
import { stringCaseStorage } from './string-case-buffer.js';
import {SNAPSHOT_WORDS} from './shader.js';
import { packProgram, REVISION } from './program.js';

const program = packProgram({ format: 1, quickjs: REVISION, features: ['template-to-string'], functions: [{
  name: 'f', args: 1, locals: 0, refs: [], stack: 1, kind: 0,
  hasPrototype: 1, strict: 1, length: 1, constants: [],
  instructions: [{ pc: 0, op: 'return_undef', operand: 0 }],
}] }, 'f');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
};
function deviceFixture(resultTag = 3) {
  const lost = deferred(), mapped = deferred(), allocated = deferred();
  const buffers = [];
  const device = {
    lost: lost.promise, buffers, submissions: 0, destroyed: 0, scopes: [],
    limits: { maxStorageBufferBindingSize: 1e9, maxBufferSize: 1e9, maxStorageBuffersPerShaderStage: 8, maxBindingsPerBindGroup: 1000 },
    pushErrorScope() {},
    popErrorScope() { return device.scopes.shift() ?? Promise.resolve(null); },
    createBindGroupLayout(descriptor) { return descriptor; },
    createPipelineLayout(descriptor) { return descriptor; },
    createShaderModule() { return { getCompilationInfo: () => Promise.resolve({ messages: [] }) }; },
    createComputePipelineAsync() { device.pipelineCount=(device.pipelineCount??0)+1;return Promise.resolve({ kind:device.pipelineCount,getBindGroupLayout() {} }); },
    createBuffer({ size, usage }) {
      const buffer = { size, usage, destroyed: 0, destroy() { this.destroyed++; },
        mapAsync() { mapped.resolve(); return device.mapResult ?? Promise.resolve(); },
        getMappedRange() { if(device.snapshot) return device.snapshot(size).buffer; const data = new Uint32Array(size / 4); data[0] = 1; data[6] = resultTag; return data.buffer; },
        unmap() { buffer.unmapped = (buffer.unmapped ?? 0) + 1; },
      };
      buffers.push(buffer);
      if (buffers.length === 8) allocated.resolve();
      return buffer;
    },
    createBindGroup(descriptor) { device.bindGroup = descriptor; return {}; },
    createCommandEncoder() { return {
      beginComputePass: () => ({ setPipeline(pipeline) { (device.passes??=[]).push(pipeline.kind); }, setBindGroup() {}, dispatchWorkgroups() {}, end() {} }),
      copyBufferToBuffer() {}, finish() {},
    }; },
    queue: { writeBuffer(buffer, offset, data) { (device.writes ??= []).push({ buffer, offset, data }); }, submit() { device.submissions++; } },
    destroy() { device.destroyed++; },
  };
  return { device, lost, mapped, allocated };
}
function cleaned(device) { assert.equal(device.buffers.length, 8); assert.ok(device.buffers.every(b => b.destroyed === 1)); }

test('successful run cleans buffers while preserving caller-owned device', async () => {
  const { device } = deviceFixture();
  const vm = await QuickJSGPU.create({ device });
  const result = await vm.run(program, [0]);
  assert.equal(result.backend, 'gpu'); assert.equal(result.done, true);
  assert.deepEqual(result.values, [undefined]); cleaned(device);
  await vm.dispose(); assert.equal(device.destroyed, 0);
});

test('dispose interrupts hung mapping and prevents already queued dispatch', async () => {
  const { device, mapped } = deviceFixture(); device.mapResult = deferred().promise;
  const vm = new QuickJSGPU(device), job = await vm.start(program, [0]);
  const first = assert.rejects(job.step(), /disposed/);
  const queued = assert.rejects(job.step(), /disposed/);
  await mapped.promise; await job.dispose(); await Promise.all([first, queued]);
  assert.equal(device.submissions, 1); cleaned(device); await vm.dispose();
});

test('dispose during allocation closes buffers and does not return a job', async () => {
  const { device, allocated } = deviceFixture();
  device.scopes.push(Promise.resolve(null), Promise.resolve(null), Promise.resolve(null), deferred().promise);
  const vm = new QuickJSGPU(device);
  const starting = assert.rejects(vm.start(program, [0]), /disposed/);
  await allocated.promise; await vm.dispose(); await starting; cleaned(device);
});

test('abort during mapping settles run with original reason and cleans resources', async () => {
  const { device, mapped } = deviceFixture(); device.mapResult = deferred().promise;
  const vm = new QuickJSGPU(device), controller = new AbortController();
  const reason = new Error('caller canceled');
  const running = assert.rejects(vm.run(program, [0], { signal: controller.signal }), error => error === reason);
  await mapped.promise; controller.abort(reason); await running;
  cleaned(device); await vm.dispose();
});

test('abort while compiling allocates no buffers and leaves shared compilation reusable', async () => {
  const { device } = deviceFixture(), pipeline = deferred(), compiling = deferred();
  device.createComputePipelineAsync = () => { compiling.resolve(); return pipeline.promise; };
  const vm = new QuickJSGPU(device), controller = new AbortController();
  const running = assert.rejects(vm.run(program, [0], { signal: controller.signal }), /canceled/);
  await compiling.promise; controller.abort(new Error('canceled')); await running;
  assert.equal(device.buffers.length, 0);
  pipeline.resolve({ getBindGroupLayout() {} });
  assert.equal((await vm.run(program, [0])).done, true); await vm.dispose();
});

test('loss interrupts stuck GPU operations without CPU replay', async () => {
  const { device, mapped, lost } = deviceFixture(); device.mapResult = deferred().promise;
  const vm = new QuickJSGPU(device);
  const running = assert.rejects(vm.run(program, [0]), /GPU lost: unplugged; no CPU replay/);
  await mapped.promise; lost.resolve({ message: 'unplugged' }); await running;
  cleaned(device); await assert.rejects(vm.start(program, [0]), /GPU lost/); await vm.dispose();
});

test('owned device disposal is idempotent even while jobs are in flight', async () => {
  const { device, mapped } = deviceFixture(); device.mapResult = deferred().promise;
  const vm = await QuickJSGPU.create({ gpu: { requestAdapter: async () => ({ requestDevice: async () => device }) } });
  const running = assert.rejects(vm.run(program, [0]), /disposed/);
  await mapped.promise; const a = vm.dispose(), b = vm.dispose(); assert.equal(a, b);
  await Promise.all([a, b, running]); cleaned(device); assert.equal(device.destroyed, 1);
});

test('rejected allocation validation scope cleans every allocated buffer', async () => {
  const { device } = deviceFixture();
  device.scopes.push(Promise.resolve(null));
  const vm = new QuickJSGPU(device);
  device.createBindGroup = () => { device.scopes.push(Promise.reject(new Error('scope failed'))); return {}; };
  await assert.rejects(vm.start(program, [0]), /scope failed/); cleaned(device); await vm.dispose();
});

test('shader creation failure balances shared-device error scopes', async () => {
  const { device } = deviceFixture(); let balance = 0;
  device.pushErrorScope = () => { balance++; };
  device.popErrorScope = () => { balance--; return Promise.resolve(null); };
  device.createShaderModule = () => { throw new Error('shader creation failed'); };
  const vm = new QuickJSGPU(device);
  await assert.rejects(vm.start(program, [0]), /shader creation failed/);
  assert.equal(balance, 0); assert.equal(device.buffers.length, 0); await vm.dispose();
});

test('pre-aborted runs do not allocate or submit GPU work', async () => {
  const { device } = deviceFixture(), vm = new QuickJSGPU(device);
  const signal = AbortSignal.abort(new Error('already canceled'));
  await assert.rejects(vm.run(program, [0], { signal }), /already canceled/);
  assert.equal(device.buffers.length, 0); assert.equal(device.submissions, 0); await vm.dispose();
});


test('Unicode lookup tables are uploaded once per job and bound read-only at binding5', async () => {
  const {device}=deviceFixture(),vm=new QuickJSGPU(device);
  const job=await vm.start(program,[0]);
  const entries=device.bindGroup.entries;
  assert.deepEqual(entries.map(e=>e.binding),[0,1,2,3,4,5,6]);
  const table=entries[5].resource.buffer;
  assert.equal(table.size,stringCaseStorage.byteLength);
  assert.equal(table.usage,128|8);
  const writes=device.writes.filter(w=>w.buffer===table);
  assert.equal(writes.length,1);assert.equal(writes[0].offset,0);
  assert.deepEqual(writes[0].data,stringCaseStorage);
  await job.dispose();cleaned(device);await vm.dispose();
});

test('Unicode storage and binding limits reject before shader compilation or allocations', async () => {
  for(const limit of ['size','storageBindings','bindings']){
    const {device}=deviceFixture(),vm=new QuickJSGPU(device);
    device.createShaderModule=()=>{throw new Error('unexpected compilation');};
    if(limit==='size')device.limits.maxStorageBufferBindingSize=stringCaseStorage.byteLength-1;
    if(limit==='storageBindings')device.limits.maxStorageBuffersPerShaderStage=4;
    if(limit==='bindings')device.limits.maxBindingsPerBindGroup=5;
    await assert.rejects(vm.start(program,[0]),/(Unicode tables exceed GPU buffer limits|Split runtime exceeds GPU binding limits)/);
    assert.equal(device.buffers.length,0);await vm.dispose();
  }
});

test('Unicode upload failure destroys every job buffer and preserves caller device', async () => {
  const {device}=deviceFixture(),vm=new QuickJSGPU(device);
  device.queue.writeBuffer=(buffer,offset,data)=>{if(data===stringCaseStorage)throw new Error('Unicode upload failed');};
  await assert.rejects(vm.start(program,[0]),/Unicode upload failed/);
  cleaned(device);await vm.dispose();assert.equal(device.destroyed,0);
});

test('Unicode allocation failure destroys buffers allocated before the table', async () => {
  const {device}=deviceFixture(),vm=new QuickJSGPU(device),create=device.createBuffer;
  device.createBuffer=descriptor=>{if(descriptor.size===stringCaseStorage.byteLength)throw new Error('Unicode allocation failed');return create(descriptor);};
  await assert.rejects(vm.start(program,[0]),/Unicode allocation failed/);
  assert.equal(device.buffers.length,4);assert.ok(device.buffers.every(b=>b.destroyed===1));
  await vm.dispose();
});


for (const [kind, tag] of [['Symbol', 17]]) {
  test(`${kind} output rejects explicitly and releases mapped buffers`, async () => {
    const { device } = deviceFixture(tag);
    const vm = await QuickJSGPU.create({ device });
    await assert.rejects(vm.run(program, [0]), error =>
      error instanceof TypeError && error.message ===
        `Unsupported GPU output: ${kind} values cannot cross the QuickJS GPU boundary yet`);
    assert.equal(device.submissions, 1);
    assert.equal(device.buffers.reduce((n, b) => n + (b.unmapped ?? 0), 0), 1);
    cleaned(device);
    await vm.dispose();
    assert.equal(device.destroyed, 0);
  });
}


test('BigInt output unmarshals and releases mapped buffers', async () => {
  const {device}=deviceFixture(18),vm=await QuickJSGPU.create({device});
  const result=await vm.run(program,[123n]);
  assert.deepEqual(result.values,[0n]);assert.equal(result.backend,'gpu');
  cleaned(device);await vm.dispose();assert.equal(device.destroyed,0);
});

test('internal call rounds preserve a single public budget and epoch across mixed lanes', async () => {
  const {device}=deviceFixture(),vm=new QuickJSGPU(device);
  device.snapshot=size=>{
    const words=new Uint32Array(size/4);
    for(let lane=0;lane<2;lane++){
      const base=lane*SNAPSHOT_WORDS;
      words[base]=lane===1&&device.submissions<3?15:1;
      words[base+1]=lane===0?4:7;words[base+6]=3;
    }
    return words;
  };
  const job=await vm.start(program,[0,1]);
  const first=await job.step(7);
  assert.equal(device.submissions,3);
  assert.deepEqual(device.passes,[1,2,3,1,2,3,1,2,3]);
  assert.deepEqual(first.statuses,[1,1]);assert.deepEqual(first.steps,[4,7]);
  let uniforms=device.writes.filter(w=>w.buffer.usage===(64|8));
  assert.deepEqual(uniforms.map(w=>[w.data[1],w.data[4]]),[[7,1],[7,1],[7,1]]);
  await job.step(1);
  uniforms=device.writes.filter(w=>w.buffer.usage===(64|8));
  assert.deepEqual([uniforms.at(-1).data[1],uniforms.at(-1).data[4]],[1,2]);
  await job.dispose();cleaned(device);await vm.dispose();
});

test('disposal during repeated internal call rounds stops scheduling and cleans control storage', async () => {
  const {device}=deviceFixture(),vm=new QuickJSGPU(device);
  const secondMap=deferred(),hang=deferred();
  device.snapshot=size=>{const words=new Uint32Array(size/4);words[0]=15;return words;};
  const create=device.createBuffer;
  device.createBuffer=descriptor=>{
    const buffer=create(descriptor);
    if(descriptor.usage===(1|8)) buffer.mapAsync=()=>{
      if(device.submissions===2){secondMap.resolve();return hang.promise;}
      return Promise.resolve();
    };
    return buffer;
  };
  const job=await vm.start(program,[0]);
  const stepping=assert.rejects(job.step(1),/disposed/);
  await secondMap.promise;await job.dispose();await stepping;
  assert.equal(device.submissions,2);cleaned(device);await vm.dispose();
});
