import { create } from 'webgpu';
export async function openDevice({ timestamps = false } = {}) {
  const options = [];
  if (process.env.LANES_BACKEND) options.push(`backend=${process.env.LANES_BACKEND}`);
  if (process.env.LANES_ADAPTER) options.push(`adapter=${process.env.LANES_ADAPTER}`);
  const gpu = create(options);
  const adapter = await gpu.requestAdapter();
  if (!adapter) throw new Error('No WebGPU adapter available. GPU checks were not run.');
  const device = await adapter.requestDevice({ requiredFeatures:
    timestamps && adapter.features.has('timestamp-query') ? ['timestamp-query'] : [] });
  device.addEventListener('uncapturederror', event => { throw new Error(event.error.message); });
  return { gpu, adapter, device };
}
