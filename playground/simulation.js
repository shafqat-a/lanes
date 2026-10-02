import { Lanes } from '../src/index.js';
const $ = id => document.getElementById(id);
const template = count => `function steer(state) {
  let x = state & 1023;
  let y = (state >> 10) & 1023;
  let seed = (state >> 20) & 4095;
  for (let tick = 0; tick < ${count}; tick++) {
    seed = (seed * 109 + 89) & 4095;
    if (((seed >> 8) & 3) === 0) { x += 1; }
    if (((seed >> 8) & 3) === 1) { y += 1; }
    if (((seed >> 8) & 3) === 2) { x -= 1; }
    if (((seed >> 8) & 3) === 3) { y -= 1; }
  }
  return (seed << 20) | ((y & 1023) << 10) | (x & 1023);
}`;
let runtime, cpu, worker, kernel, reference, state, dirty = true, playing = false, busy = false, steps = 0;
const canvas = $('field'), context = canvas.getContext('2d', { alpha: false });
const pixels = context.createImageData(canvas.width, canvas.height);
function draw(values) {
  const start = performance.now(), p = pixels.data;
  for (let i = 0; i < p.length; i += 4) { p[i] = 7; p[i + 1] = 19; p[i + 2] = 28; p[i + 3] = 255; }
  for (const value of values) {
    const x = Math.floor((value & 1023) * canvas.width / 1024);
    const y = Math.floor(((value >> 10) & 1023) * canvas.height / 1024);
    const index = (y * canvas.width + x) * 4;
    p[index] = 110 + ((value >>> 20) & 127); p[index + 1] = 235; p[index + 2] = 200;
  }
  context.putImageData(pixels, 0, 0);
  $('draw-time').textContent = `${(performance.now() - start).toFixed(2)} ms`;
}
function pause() { playing = false; $('play').textContent = 'Play'; }
function reset() {
  pause(); steps = 0; dirty = true;
  let seed = 12345;
  state = Int32Array.from({ length: Number($('size').value) }, () => {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed;
  });
  $('cpu-time').textContent = $('gpu-time').textContent = '—';
  $('comparison').textContent = 'Run a step to compare.';
  $('status').className = ''; $('status').textContent = 'Ready. Each step advances the current field.';
  draw(state);
}
function request(data) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { worker.terminate(); worker = null; reject(new Error('Native worker timed out. Reset and reduce the workload.')); }, 30000);
    worker.onmessage = ({ data }) => { clearTimeout(timeout); data.error ? reject(new Error(data.error)) : resolve(data); };
    worker.onerror = event => { clearTimeout(timeout); reject(new Error(event.message)); };
    worker.postMessage(data);
  });
}
function match(a, b) {
  if (a.length !== b.length) throw new Error('Output length mismatch; results rejected.');
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) throw new Error(`Output mismatch at agent ${i}; results rejected.`);
}
function controls() {
  for (const id of ['step', 'reset', 'source', 'size', 'work', 'mode']) $(id).disabled = busy;
  $('play').disabled = busy && !playing;
}
async function step() {
  if (busy) return;
  busy = true; controls(); $('status').className = ''; $('status').textContent = 'Computing and checking…';
  try {
    const gpuAvailable = runtime.backend === 'gpu';
    if (dirty || !worker) {
      kernel = runtime.compile($('source').value, { numericMode: 'i32' });
      reference = cpu.compile($('source').value, { numericMode: 'i32' });
      $('wgsl').textContent = kernel.wgsl;
      worker?.terminate(); worker = new Worker(new URL('./simulation-worker.js', import.meta.url), { type: 'module' });
      await request({ source: $('source').value });
      const sample = Int32Array.from({ length: 64 }, (_, i) => state[Math.floor(i * state.length / 64)]);
      const expected = await reference.run(sample);
      match((await request({ input: sample })).output, expected);
      // GPU is checked on the full field below; leave its first call cold.
      dirty = false;
    }
    const native = await request({ input: state });
    let gpuOutput, gpuMs, compiled = false;
    if (gpuAvailable) {
      const before = runtime.diagnostics.pipelineCompilations, start = performance.now();
      gpuOutput = await kernel.run(state, { backend: 'gpu' });
      gpuMs = performance.now() - start;
      compiled = before !== runtime.diagnostics.pipelineCompilations;
      match(native.output, gpuOutput);
    }
    state = $('mode').value === 'gpu' && gpuOutput ? gpuOutput : native.output;
    steps++;
    $('cpu-time').textContent = `${native.ms.toFixed(2)} ms`;
    $('gpu-time').textContent = gpuAvailable ? `${gpuMs.toFixed(2)} ms` : 'Unavailable';
    const ratio = gpuAvailable ? native.ms / gpuMs : 0;
    const comparison = native.ms <= 0 || gpuMs <= 0 ? 'Below timer resolution; ratio unavailable'
      : `${ratio >= 1 ? `${ratio.toFixed(2)}× faster` : `${(1 / ratio).toFixed(2)}× slower`} than native compute this step`;
    $('comparison').textContent = gpuAvailable
      ? `${compiled ? 'Cold GPU call (includes compilation)' : 'Cached GPU pipeline'} · ${comparison}.`
      : 'Native JavaScript only. GPU comparison requires WebGPU.';
    draw(state);
    $('status').textContent = gpuAvailable
      ? `${state.length.toLocaleString()} outputs matched · Step ${steps} · Drawing ${$('mode').value === 'gpu' ? 'GPU' : 'native JS'} result.`
      : `Step ${steps} · ${state.length.toLocaleString()} agents · Native JS (sample checked against CPU interpreter).`;
  } catch (error) {
    pause(); dirty = true; $('status').className = 'error'; $('status').textContent = error.message;
    $('cpu-time').textContent = $('gpu-time').textContent = '—';
    $('comparison').textContent = 'No accepted timing result.';
  } finally {
    busy = false; controls();
    if (playing) requestAnimationFrame(() => { if (playing) step(); });
  }
}
$('source').value = template(Number($('work').value));
$('work').onchange = () => { $('source').value = template(Number($('work').value)); reset(); };
$('source').oninput = reset; $('size').onchange = reset;
$('reset').onclick = reset; $('step').onclick = step;
$('play').onclick = () => { if (playing) pause(); else { playing = true; $('play').textContent = 'Pause'; step(); } };
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', () => { pause(); worker?.terminate(); runtime?.dispose(); cpu?.dispose(); });
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
try {
  [runtime, cpu] = await Promise.all([Lanes.create({ backend: 'auto' }), Lanes.create({ backend: 'cpu' })]);
  $('adapter').textContent = runtime.backend === 'gpu' ? 'WebGPU available' : 'Native JS only';
  if (runtime.backend !== 'gpu') { $('mode').value = 'cpu'; $('mode').querySelector('[value="gpu"]').disabled = true; }
  reset(); controls();
} catch (error) { $('status').className = 'error'; $('status').textContent = error.message; }
