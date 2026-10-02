// Persistent buffers, independent GPU timestamps, and separately measured wall-clock phases.
// Experiments only: callers must serialize calls and dispose after completion.
export async function prepare(device, shader, inputs, program = null, budget = 1000000) {
  const created = [], own = resource => { created.push(resource); return resource; };
  const buffer = (size, usage) => own(device.createBuffer({ size, usage }));
  const start = performance.now();
  try {
    const module = device.createShaderModule({ code: shader });
    const info = await module.getCompilationInfo();
    const errors = info.messages.filter(m => m.type === 'error');
    if (errors.length) throw new Error(errors.map(m => m.message).join('\n'));
    const pipeline = await device.createComputePipelineAsync({ layout: 'auto', compute: { module, entryPoint: 'main' } });
    const pipelineMs = performance.now() - start;
    const input = buffer(inputs.byteLength, 128 | 8);
    const output = buffer(inputs.length * 8, 128 | 4);
    const staging = buffer(inputs.length * 8, 1 | 8);
    let bindings = [input, output];
    if (program) {
      const words = new Uint32Array(program.instructions);
      const bytecode = buffer(words.byteLength, 128 | 8), params = buffer(16, 64 | 8);
      device.queue.writeBuffer(bytecode, 0, words);
      device.queue.writeBuffer(params, 0, new Uint32Array([inputs.length, budget, words.length / 4, 0]));
      bindings = [bytecode, input, output, params];
    }
    const group = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0),
      entries: bindings.map((b, binding) => ({ binding, resource: { buffer: b } })) });
    const timestamps = device.features.has('timestamp-query');
    const query = timestamps ? own(device.createQuerySet({ type: 'timestamp', count: 2 })) : null;
    const resolved = timestamps ? buffer(16, 512 | 4) : null;
    const queryRead = timestamps ? buffer(16, 1 | 8) : null;
    // Finish initialization before timed input upload.
    await device.queue.onSubmittedWorkDone();
    const uploadStart = performance.now();
    device.queue.writeBuffer(input, 0, inputs);
    await device.queue.onSubmittedWorkDone();
    const uploadMs = performance.now() - uploadStart;
    return {
      pipelineMs, uploadMs,
      async run({ repeats = 1, readback = true, upload = false } = {}) {
        if (!Number.isInteger(repeats) || repeats < 1 || repeats > 100) throw new RangeError('Invalid repeats');
        const wallStart = performance.now();
        if (upload) device.queue.writeBuffer(input, 0, inputs);
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginComputePass(query ? { timestampWrites: { querySet: query,
          beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 } } : {});
        pass.setPipeline(pipeline); pass.setBindGroup(0, group);
        for (let i = 0; i < repeats; i++) pass.dispatchWorkgroups(Math.ceil(inputs.length / 64));
        pass.end();
        device.queue.submit([encoder.finish()]);
        await device.queue.onSubmittedWorkDone();
        const dispatchWallMs = performance.now() - wallStart;
        let values, statuses, readbackMs = 0;
        if (readback) {
          const readStart = performance.now();
          const copy = device.createCommandEncoder();
          copy.copyBufferToBuffer(output, 0, staging, 0, inputs.length * 8);
          device.queue.submit([copy.finish()]);
          await staging.mapAsync(1);
          const raw = new Int32Array(staging.getMappedRange());
          values = new Int32Array(inputs.length); statuses = new Uint32Array(inputs.length);
          for (let i = 0; i < inputs.length; i++) { values[i] = raw[i * 2]; statuses[i] = raw[i * 2 + 1]; }
          staging.unmap(); readbackMs = performance.now() - readStart;
        }
        // Capture wall total before query extraction so instrumentation readback isn't hidden in GPU execution.
        const totalMs = performance.now() - wallStart;
        let gpuMs = null;
        if (query) {
          const copy = device.createCommandEncoder();
          copy.resolveQuerySet(query, 0, 2, resolved, 0);
          copy.copyBufferToBuffer(resolved, 0, queryRead, 0, 16);
          device.queue.submit([copy.finish()]);
          await queryRead.mapAsync(1);
          const times = new BigUint64Array(queryRead.getMappedRange());
          gpuMs = Number(times[1] - times[0]) / 1e6;
          queryRead.unmap();
        }
        return { values, statuses, dispatchWallMs, readbackMs, totalMs, gpuMs, repeats };
      },
      dispose() { for (const resource of created) resource.destroy(); },
    };
  } catch (error) { for (const resource of created) resource.destroy(); throw error; }
}
