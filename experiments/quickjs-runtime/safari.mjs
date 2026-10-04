// Uses an already running Safari WebDriver. Creates/deletes only its own session.
const driver = process.env.LANES_WEBDRIVER_URL || 'http://127.0.0.1:4445';
const site = process.env.LANES_QUICKJS_URL || 'http://127.0.0.1:4178/';
const timeout = Number(process.env.LANES_QUICKJS_TIMEOUT_MS || 120000);
if (!Number.isSafeInteger(timeout) || timeout < 1000 || timeout > 3600000) throw new RangeError('Invalid Safari test timeout');
let session;
let runError;
let stopped = false;
const stop = () => { stopped = true; };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
async function request(path, body, method = body === undefined ? 'GET' : 'POST') {
  const response = await fetch(driver + path, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(60000) });
  const { value } = await response.json();
  if (!response.ok || value?.error) throw new Error(JSON.stringify(value));
  return value;
}
try {
  const page = await fetch(site, { signal: AbortSignal.timeout(10000) });
  await page.body?.cancel();
  if (!page.ok) throw new Error(`Safari test page HTTP ${page.status}: ${site}`);
  const created = await request('/session', { capabilities: { alwaysMatch: { browserName: 'safari' } } }); session = created.sessionId;
  await request(`/session/${session}/url`, { url: site });
  const until = Date.now() + timeout;
  let progressAt = Date.now(), progress = '';
  while (Date.now() < until) {
    if (stopped) throw new Error('Safari test canceled');
    // JSON escapes lone UTF-16 surrogates before Safari WebDriver serializes them.
    const state = JSON.parse(await request(`/session/${session}/execute/sync`, { script: 'return JSON.stringify({report:window.quickjsReport,error:window.quickjsError,status:document.getElementById("status")?.textContent})', args: [] }));
    progress = state.status || '';
    if (state.error) throw new Error(state.error);
    if (state.report) { console.log(JSON.stringify({ date: new Date().toISOString(), capabilities: created.capabilities, report: state.report }, null, 2)); break; }
    if (Date.now() - progressAt >= 30000) { console.error(`Safari progress: ${progress}`); progressAt = Date.now(); }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (Date.now() >= until) throw new Error(`Safari test timed out: ${progress}`);
} catch (error) {
  runError = error;
  throw error;
} finally {
  try {
    if (session) await request(`/session/${session}`, undefined, 'DELETE');
  } catch (error) {
    if (!runError) throw error;
    console.error(`Safari session cleanup failed after original error: ${error.message}`);
  }
  finally { process.off('SIGINT', stop); process.off('SIGTERM', stop); }
}
