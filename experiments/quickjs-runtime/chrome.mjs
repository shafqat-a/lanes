// Runs built browser suites with hardware WebGPU; software adapters are rejected.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve(process.env.LANES_BROWSER_ROOT || 'experiments/quickjs-runtime/generated');
const output = resolve(process.env.LANES_CHROME_EVIDENCE || 'experiments/bootstrap/evidence/chrome');
const timeout = Number(process.env.LANES_CHROME_TIMEOUT_MS || 600000);
const args = ['--enable-unsafe-webgpu', '--use-angle=vulkan', '--enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan', '--disable-vulkan-surface'];
if (process.env.LANES_CHROME_DISABLE_GPU_WATCHDOG === '1') args.push('--disable-gpu-watchdog');
const server = createServer(async (req, res) => {
  if (req.url === '/__probe') { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><title>GPU probe</title>'); return; }
  const path = resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
  try {
    const data = await readFile(path);
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json' })[extname(path)] || 'application/octet-stream');
    res.end(data);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
await mkdir(output, { recursive: true });
try {
  browser = await chromium.launch({ executablePath: process.env.LANES_CHROME_BINARY, headless: true, args, timeout: 60000 });
  const cdp = await browser.newBrowserCDPSession();
  const systemInfo = await cdp.send('SystemInfo.getInfo');
  systemInfo.processInfo = (await cdp.send('SystemInfo.getProcessInfo')).processInfo;
  await writeFile(resolve(output, 'system-info.json'), JSON.stringify(systemInfo, null, 2));
  console.log(JSON.stringify({devices: systemInfo.gpu.devices, features: systemInfo.gpu.featureStatus}));
  const page = await browser.newPage();
  page.on('console', message => { if (message.type() === 'warning' || message.type() === 'error') console.error(message.text()); });
  const base = `http://127.0.0.1:${server.address().port}`;
  // Probe a blank same-origin page, without starting a runtime suite.
  await page.goto(base + '/__probe');
  const adapter = await page.evaluate(async () => {
    const adapter = await navigator.gpu?.requestAdapter();
    if (!adapter) throw new Error('No WebGPU adapter');
    const i = adapter.info;
    const info = { vendor: i.vendor, architecture: i.architecture, device: i.device, description: i.description, isFallbackAdapter: i.isFallbackAdapter ?? adapter.isFallbackAdapter };
    if (info.isFallbackAdapter || /swiftshader|llvmpipe|software/i.test(JSON.stringify(info))) throw new Error('Software WebGPU adapter rejected: ' + JSON.stringify(info));
    if (!info.vendor) throw new Error('Adapter identity unavailable; cannot establish hardware execution');
    const device = await adapter.requestDevice();
    try {
      const data = device.createBuffer({ size: 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
      const read = device.createBuffer({ size: 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
      const pipeline = await device.createComputePipelineAsync({ layout: 'auto', compute: { module: device.createShaderModule({ code: '@group(0) @binding(0) var<storage,read_write> value:u32; @compute @workgroup_size(1) fn main(){value=42u;}' }), entryPoint: 'main' } });
      const group = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: data } }] });
      const encoder = device.createCommandEncoder(), pass = encoder.beginComputePass();
      pass.setPipeline(pipeline); pass.setBindGroup(0, group); pass.dispatchWorkgroups(1); pass.end(); encoder.copyBufferToBuffer(data, 0, read, 0, 4); device.queue.submit([encoder.finish()]);
      await read.mapAsync(GPUMapMode.READ); const value = new Uint32Array(read.getMappedRange())[0]; read.unmap();
      if (value !== 42) throw new Error('GPU smoke mismatch: ' + value);
      return { ...info, smokeValue: value };
    } finally { device.destroy(); }
  });
  const environment = { date: new Date().toISOString(), browser: browser.version(), adapter, args };
  await writeFile(resolve(output, 'environment.json'), JSON.stringify(environment, null, 2));
  console.log(JSON.stringify(environment));
  for (const name of process.argv.slice(2)) {
    if (!/^[a-z0-9-]+$/.test(name)) throw new Error('Invalid suite name');
    console.log('GPU START ' + name);
    let progress = '';
    const tick = setInterval(async () => {
      try { progress = await page.locator('#status').textContent({ timeout: 1000 }); console.log('Progress: ' + progress); } catch {}
    }, 30000);
    try {
      await page.goto(base + '/' + (name === 'phase4-next' ? 'phase4.html?suite=next' : name + '.html'));
      await page.waitForFunction(() => window.quickjsReport || window.quickjsError, { }, { timeout });
      const state = await page.evaluate(() => ({ report: window.quickjsReport, error: window.quickjsError, diagnostics: window.quickjsDiagnostics }));
      const result = { ...environment, suite: name, ...state };
      await writeFile(resolve(output, name + '.json'), JSON.stringify(result, null, 2));
      if (state.error) throw new Error(state.error);
      const r = state.report;
      if (r.backend !== 'gpu' || r.failures?.length || r.counts?.failed || r.resumptionFailures || r.outcomeViolations || r.mismatches) throw new Error('GPU suite failed');
      console.log(JSON.stringify({ suite: name, status: 'pass', programs: r.programs, checked: r.checked, counts: r.counts, timings: r.timings }));
    } catch (error) {
      const diagnostics = await page.evaluate(() => window.quickjsDiagnostics).catch(() => undefined);
      await writeFile(resolve(output, name + '-failure.json'), JSON.stringify({ ...environment, suite: name, lastProgress: progress, diagnostics, error: error.message }, null, 2));
      throw error;
    } finally { clearInterval(tick); }
  }
} finally {
  await browser?.close();
  server.close();
}
