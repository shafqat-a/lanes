import { OP, STATUS, MAX_REGISTERS, validateRun } from './bytecode.js';

export const interpreterShader = `
@group(0) @binding(0) var<storage, read> code: array<u32>;
@group(0) @binding(1) var<storage, read> inputs: array<i32>;
@group(0) @binding(2) var<storage, read_write> output: array<vec2<i32>>;
struct Params { count: u32, budget: u32, instructions: u32, padding: u32 }
@group(0) @binding(3) var<uniform> params: Params;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let lane = id.x;
  if (lane >= params.count) { return; }
  var r: array<i32, ${MAX_REGISTERS}>;
  r[0] = inputs[lane];
  var pc = 0u;
  for (var step = 0u; step < params.budget; step++) {
    if (pc >= params.instructions) {
      output[lane] = vec2<i32>(0, ${STATUS.INVALID}); return;
    }
    let base = pc * 4u;
    let op = code[base]; let d = code[base+1u]; let a = code[base+2u]; let b = code[base+3u];
    pc++;
    switch op {
      case ${OP.CONST}u: { r[d] = bitcast<i32>(a); }
      case ${OP.MOVE}u: { r[d] = r[a]; }
      case ${OP.ADD}u: { r[d] = bitcast<i32>(bitcast<u32>(r[a]) + bitcast<u32>(r[b])); }
      case ${OP.SUB}u: { r[d] = bitcast<i32>(bitcast<u32>(r[a]) - bitcast<u32>(r[b])); }
      case ${OP.MUL}u: { r[d] = bitcast<i32>(bitcast<u32>(r[a]) * bitcast<u32>(r[b])); }
      case ${OP.LT}u: { r[d] = select(0, 1, r[a] < r[b]); }
      case ${OP.LE}u: { r[d] = select(0, 1, r[a] <= r[b]); }
      case ${OP.EQ}u: { r[d] = select(0, 1, r[a] == r[b]); }
      case ${OP.NE}u: { r[d] = select(0, 1, r[a] != r[b]); }
      case ${OP.AND}u: { r[d] = r[a] & r[b]; }
      case ${OP.OR}u: { r[d] = r[a] | r[b]; }
      case ${OP.XOR}u: { r[d] = r[a] ^ r[b]; }
      case ${OP.SHL}u: { r[d] = r[a] << (bitcast<u32>(r[b]) & 31u); }
      case ${OP.SHR}u: { r[d] = r[a] >> (bitcast<u32>(r[b]) & 31u); }
      case ${OP.JZ}u: { if (r[d] == 0) { pc = a; } }
      case ${OP.JMP}u: { pc = a; }
      case ${OP.RET}u: { output[lane] = vec2<i32>(r[d], ${STATUS.DONE}); return; }
      default: { output[lane] = vec2<i32>(0, ${STATUS.INVALID}); return; }
    }
  }
  output[lane] = vec2<i32>(0, ${STATUS.BUDGET});
}`;

/** Caller owns device lifetime. Pipeline construction is separate from run timings. */
export async function createGPU(device) {
  const module = device.createShaderModule({ code: interpreterShader });
  const info = await module.getCompilationInfo();
  const errors = info.messages.filter(m => m.type === 'error');
  if (errors.length) throw new Error(errors.map(m => m.message).join('\n'));
  const pipeline = await device.createComputePipelineAsync({ layout: 'auto', compute: { module, entryPoint: 'main' } });
  return {
    async run(program, inputs, { budget = 10000 } = {}) {
      validateRun(program, inputs, budget);
      if (!inputs.length) return { values: new Int32Array(), statuses: new Uint32Array() };
      const outputSize = inputs.length * 8;
      if (Math.ceil(inputs.length / 64) > device.limits.maxComputeWorkgroupsPerDimension)
        throw new RangeError('Batch exceeds device dispatch limit');
      const words = new Uint32Array(program.instructions);
      for (const size of [outputSize, inputs.byteLength, words.byteLength]) {
        if (size > Math.min(device.limits.maxStorageBufferBindingSize, device.limits.maxBufferSize))
          throw new RangeError('Batch or program exceeds device buffer limits');
      }
      const buffers = [];
      const buffer = (size, usage) => {
        const result = device.createBuffer({ size, usage }); buffers.push(result); return result;
      };
      try {
        // WebGPU flag values: COPY_SRC=4, COPY_DST=8, UNIFORM=64, STORAGE=128, MAP_READ=1.
        const bytecode = buffer(words.byteLength, 128 | 8);
        const input = buffer(inputs.byteLength, 128 | 8);
        const output = buffer(outputSize, 128 | 4);
        const params = buffer(16, 64 | 8);
        const staging = buffer(outputSize, 1 | 8);
        device.queue.writeBuffer(bytecode, 0, words);
        device.queue.writeBuffer(input, 0, inputs);
        device.queue.writeBuffer(params, 0, new Uint32Array([inputs.length, budget, words.length / 4, 0]));
        const bindGroup = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0),
          entries: [bytecode, input, output, params].map((b, binding) => ({ binding, resource: { buffer: b } })) });
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginComputePass();
        pass.setPipeline(pipeline); pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(Math.ceil(inputs.length / 64)); pass.end();
        encoder.copyBufferToBuffer(output, 0, staging, 0, outputSize);
        device.queue.submit([encoder.finish()]);
        await staging.mapAsync(1);
        const raw = new Int32Array(staging.getMappedRange());
        const values = new Int32Array(inputs.length), statuses = new Uint32Array(inputs.length);
        for (let i = 0; i < inputs.length; i++) { values[i] = raw[i * 2]; statuses[i] = raw[i * 2 + 1]; }
        staging.unmap();
        return { values, statuses };
      } finally { for (const b of buffers) b.destroy(); }
    }
  };
}
