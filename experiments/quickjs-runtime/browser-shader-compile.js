// Diagnostic only: compilation timings are not guest execution/conformance.
import { splitShaders } from './split-dispatch-shader.js';
import { createSplitPipelineLayout } from './split-pipeline-layout.js';
const status = document.getElementById('status');
const output = document.getElementById('report');
let device;
const diagnostics = { diagnosticOnly: true, guestProgramsExecuted: 0, shaderBytes: Object.fromEntries(Object.entries(splitShaders).map(([name,source])=>[name,new TextEncoder().encode(source).length])), timings: {} };
window.quickjsDiagnostics = diagnostics;
try {
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error('WebGPU adapter unavailable');
  const info = adapter.info;
  diagnostics.adapter = { vendor: info?.vendor, architecture: info?.architecture, description: info?.description, isFallbackAdapter: info?.isFallbackAdapter ?? adapter.isFallbackAdapter };
  if (diagnostics.adapter.isFallbackAdapter) throw new Error('Software adapter cannot qualify hardware GPU execution');
  device = await adapter.requestDevice();
  const timings = diagnostics.timings;
  async function stage(name, work) {
    status.textContent = name;
    diagnostics.stage = name;
    const start = performance.now();
    const result = await work();
    timings[name] = performance.now() - start;
    output.textContent = JSON.stringify(timings, null, 2);
    return result;
  }
  await stage('control-pipeline', () => device.createComputePipelineAsync({
    layout: 'auto', compute: { entryPoint: 'main', module: device.createShaderModule({
      code: '@compute @workgroup_size(1) fn main() {}',
    }) },
  }));
  const layout=createSplitPipelineLayout(device);
  for(const [name,shader] of Object.entries(splitShaders)){
  const module = device.createShaderModule({ code: shader });
  const compilation = await stage(`${name}-wgsl-validation`, () => module.getCompilationInfo());
  const errors = compilation.messages.filter(message => message.type === 'error');
  if (errors.length) throw new Error(errors.map(message => `${message.lineNum}:${message.linePos} ${message.message}`).join('\n'));
  await stage(`${name}-compute-pipeline`, () => device.createComputePipelineAsync({
    layout: layout.pipeline, compute: { module, entryPoint: 'main' },
  }));
  }
  window.quickjsReport = { backend: 'gpu', ...diagnostics };
  status.textContent = 'Compiled';
  output.textContent = JSON.stringify(window.quickjsReport, null, 2);
} catch (error) {
  window.quickjsError = `${status.textContent}: ${error.name}: ${error.message}`;
  output.textContent = window.quickjsError;
} finally {
  device?.destroy();
}
