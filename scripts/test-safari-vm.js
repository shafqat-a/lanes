import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const driver = process.env.LANES_WEBDRIVER_URL ?? 'http://127.0.0.1:4445';
const site = process.env.LANES_VM_URL ?? 'http://127.0.0.1:4173/vm.html';
let session;
async function command(path, body, method = body === undefined ? 'GET' : 'POST') {
  const response = await fetch(`${driver}${path}`, { method, headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(60000) });
  const { value } = await response.json();
  if (!response.ok || typeof value?.error === 'string') throw new Error(JSON.stringify(value));
  return value;
}
const js = script => command(`/session/${session}/execute/sync`, { script, args: [] });
async function waitFor(text) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const state = await js("return {text:document.getElementById('status')?.textContent,error:document.getElementById('status')?.className==='error'}");
    if (state.text?.includes(text)) return;
    if (state.error) throw new Error(state.text);
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${text}`);
}
try {
  const created = await command('/session', { capabilities: { alwaysMatch: { browserName: 'safari' } } });
  session = created.sessionId;
  await command(`/session/${session}/url`, { url: site }); await waitFor('Ready');
  assert.equal(await js("return document.getElementById('adapter').textContent"), 'GPU VM');
  await js("document.getElementById('run').click()"); await waitFor('Backend: GPU');
  assert.match(await js("return document.getElementById('output').textContent"), /0 → 0.9999999999999999/);
  await js("document.getElementById('check').click()"); await waitFor('results matched native JavaScript');
  const report = await js('return window.vmReport'); assert.ok(report.checked > 80000); assert.equal(report.backend, 'gpu');
  await js("document.getElementById('source').value='function f(x) { return [x]; }';document.getElementById('run').click()");
  await waitFor('does not support');
  assert.equal(await js("return document.getElementById('adapter').textContent"), 'GPU VM');
  await mkdir('results', { recursive: true });
  await writeFile('results/safari-vm.json', JSON.stringify({ date: new Date().toISOString(), site, capabilities: created.capabilities, report }, null, 2) + '\n');
  console.log('Safari GPU VM passed:', report);
} finally { if (session) await command(`/session/${session}`, undefined, 'DELETE'); }
