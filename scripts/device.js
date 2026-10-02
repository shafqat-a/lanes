import { create } from 'webgpu';
export async function openDevice() {
  const gpu = create(process.env.LANES_BACKEND ? [`backend=${process.env.LANES_BACKEND}`] : []);
  const adapter = await gpu.requestAdapter();
  if (!adapter) throw new Error('No WebGPU adapter available. GPU checks were not run.');
  const device = await adapter.requestDevice();
  device.addEventListener('uncapturederror', event => { throw new Error(event.error.message); });
  return { gpu, adapter, device };
}
