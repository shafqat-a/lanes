// Start safaridriver -p 4445 and npm run dev on the Mac before running this.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const driver = process.env.LANES_WEBDRIVER_URL ?? 'http://127.0.0.1:4445';
const site = process.env.LANES_DEMO_URL ?? 'http://127.0.0.1:4173/simulation.html';
let session;
async function command(path, body, method = body === undefined ? 'GET' : 'POST') {
  const response = await fetch(`${driver}${path}`, { method, headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(60000) });
  const { value } = await response.json();
  if (!response.ok || value?.error) throw new Error(JSON.stringify(value));
  return value;
}
const js = script => command(`/session/${session}/execute/sync`, { script, args: [] });
async function waitFor(script) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (await js(script)) return;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out: ${await js("return document.getElementById('status')?.textContent")}`);
}
try {
  const created = await command('/session', { capabilities: { alwaysMatch: { browserName: 'safari' } } });
  session = created.sessionId;
  await command(`/session/${session}/url`, { url: site });
  await waitFor("return document.getElementById('status')?.textContent.includes('Ready')");
  assert.equal(await js("return document.getElementById('adapter').textContent"), 'WebGPU available');
  const rows = [];
  for (const size of [1024, 16384, 65536]) {
    await js(`const el=document.getElementById('size');el.value='${size}';el.dispatchEvent(new Event('change'));`);
    const before = await js("return document.getElementById('field').toDataURL()");
    await js("document.getElementById('step').click()");
    await waitFor("return document.getElementById('status').textContent.includes('outputs matched')");
    assert.notEqual(await js("return document.getElementById('field').toDataURL()"), before);
    const row = await js("return Object.fromEntries(['status','cpu-time','gpu-time','draw-time','comparison'].map(id=>[id,document.getElementById(id).textContent]))");
    rows.push(row); console.log(row);
  }
  await js("document.getElementById('mode').value='cpu';document.getElementById('step').click()");
  await waitFor("return document.getElementById('status').textContent.includes('Drawing native JS result')");
  await js("document.getElementById('play').click()");
  await waitFor("return Number(document.getElementById('status').textContent.match(/Step (\\d+)/)?.[1]) >= 3");
  await js("document.getElementById('play').click()");
  await waitFor("return !document.getElementById('reset').disabled");
  await js("document.getElementById('reset').click()");
  await waitFor("return document.getElementById('status').textContent.includes('Ready')");
  for (const [source, expected] of [
    ['function edit(x) { return x * 37 + 1; }', 'outputs matched'],
    ['function invalid(x) { return x / 2; }', 'Unsupported operator'],
  ]) {
    await js(`const el=document.getElementById('source');el.value=${JSON.stringify(source)};el.dispatchEvent(new Event('input'));document.getElementById('step').click()`);
    await waitFor(`return document.getElementById('status').textContent.includes(${JSON.stringify(expected)})`);
  }
  await mkdir('results', { recursive: true });
  await writeFile('results/safari-demo.json', JSON.stringify({ date: new Date().toISOString(), site,
    capabilities: created.capabilities, checks: ['GPU equality at three sizes', 'native mode', 'play/pause', 'reset', 'edited function', 'invalid source'], rows }, null, 2) + '\n');
  console.log('Safari GPU and interaction checks passed. Saved results/safari-demo.json');
} finally { if (session) await command(`/session/${session}`, undefined, 'DELETE'); }
