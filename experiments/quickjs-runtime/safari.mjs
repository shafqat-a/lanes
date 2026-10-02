// Uses an already running Safari WebDriver. Creates/deletes only its own session.
const driver = process.env.LANES_WEBDRIVER_URL || 'http://127.0.0.1:4445';
const site = process.env.LANES_QUICKJS_URL || 'http://127.0.0.1:4178/';
let session;
async function request(path, body, method = body === undefined ? 'GET' : 'POST') {
  const response = await fetch(driver + path, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(60000) });
  const { value } = await response.json();
  if (!response.ok || value?.error) throw new Error(JSON.stringify(value));
  return value;
}
try {
  const created = await request('/session', { capabilities: { alwaysMatch: { browserName: 'safari' } } }); session = created.sessionId;
  await request(`/session/${session}/url`, { url: site });
  const until = Date.now() + 120000;
  while (Date.now() < until) {
    const state = await request(`/session/${session}/execute/sync`, { script: 'return {report:window.quickjsReport,error:window.quickjsError}', args: [] });
    if (state.error) throw new Error(state.error);
    if (state.report) { console.log(JSON.stringify({ date: new Date().toISOString(), capabilities: created.capabilities, report: state.report }, null, 2)); break; }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (Date.now() >= until) throw new Error('Safari test timed out');
} finally { if (session) await request(`/session/${session}`, undefined, 'DELETE'); }
