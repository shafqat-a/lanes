import { Lanes } from '../src/index.js';
const byId = id => document.getElementById(id);
const examples = {
  simulation: `function simulate(x) {
  let state = x;
  for (let tick = 0; tick < 32; tick++) {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    if ((state & 7) === 0) {
      state += tick;
    }
  }
  return state;
}`,
  hash: `function hash(x) {
  let h = x;
  for (let round = 0; round < 16; round++) {
    h = (h ^ (h >> 16)) * 73244475;
    h = (h ^ (h >> 16)) * 73244475;
    h ^= h >> 16;
  }
  return h;
}`,
  rules: `function score(x) {
  let score = 0;
  for (let rule = 0; rule < 32; rule++) {
    const value = (x ^ (rule * 1103515245)) & 1023;
    if (value > 700) {
      score += value;
    } else {
      score -= 3;
    }
  }
  return score;
}`,
};
byId('source').value = examples.simulation;
byId('example').addEventListener('change', event => { byId('source').value = examples[event.target.value]; });
const cpu = await Lanes.create({ backend: 'cpu' });
const runtime = await Lanes.create({ backend: 'auto' });
byId('adapter').textContent = runtime.backend === 'gpu' ? 'WebGPU available' : 'CPU fallback';
byId('status').textContent = runtime.backend === 'gpu' ? 'Ready. Results will be checked against the CPU fallback.' : 'WebGPU is unavailable. You can still run the CPU fallback and inspect WGSL.';
byId('run').disabled = false;
byId('run').addEventListener('click', async () => {
  byId('run').disabled = true; byId('status').className = ''; byId('status').textContent = 'Compiling and running…';
  try {
    // Let the running status paint before synchronous CPU fallback work.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const source = byId('source').value;
    const kernel = runtime.compile(source, { numericMode: 'i32' });
    const reference = cpu.compile(source, { numericMode: 'i32' });
    const inputs = Int32Array.from({ length: Number(byId('size').value) }, (_, i) => i + 1);
    byId('wgsl').textContent = kernel.wgsl;
    let start = performance.now(); const expected = await reference.run(inputs); const cpuMs = performance.now() - start;
    start = performance.now(); const result = await kernel.run(inputs); const firstMs = performance.now() - start;
    start = performance.now(); const warm = await kernel.run(inputs); const warmMs = performance.now() - start;
    for (let i = 0; i < inputs.length; i++) if (result[i] !== expected[i] || warm[i] !== expected[i]) throw new Error(`Output mismatch at input ${i}; timing results rejected.`);
    const rows = [['CPU fallback', cpuMs], [`${runtime.backend.toUpperCase()} first call`, firstMs], [`${runtime.backend.toUpperCase()} repeated call`, warmMs]];
    byId('timings').replaceChildren(...rows.map(([name, ms]) => {
      const row = document.createElement('tr');
      for (const text of [name, `${ms.toFixed(3)} ms`]) { const cell = document.createElement('td'); cell.textContent = text; row.append(cell); }
      return row;
    }));
    byId('output').textContent = Array.from(result.slice(0, 8)).join(', ');
    byId('status').textContent = `${inputs.length.toLocaleString()} outputs matched. Backend: ${runtime.backend.toUpperCase()}.`;
  } catch (error) {
    byId('status').className = 'error'; byId('status').textContent = error.message;
    byId('timings').replaceChildren(); byId('output').textContent = 'No accepted result.';
  } finally { byId('run').disabled = false; }
});
