// Writes phase3-focus.html from the existing focused-page shell.
// The page calls createCompiler and QuickJSGPU. It does not evaluate guest source.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const runtimeDir = join(here, '..', '..');
const templatePath = join(runtimeDir, 'browser-math-phase5.html');
const harnessPath = join(runtimeDir, 'browser-math-phase5.js');
const outPath = join(here, 'phase3-focus.html');

const pageModule = `import { createCompiler } from '../../compiler.js';
import { QuickJSGPU } from '../../runtime.js';
import { PROGRAMS, HARNESS_INPUT } from './programs.js';

const status = document.getElementById('status');
const report = document.getElementById('report');

function classify(error) {
  const message = error && error.message ? error.message : String(error);
  if (/Unsupported/.test(message)) return { kind: 'unsupported', message };
  if (/^Resource limit in lane |^Execution limit;|^Program\\/batch exceeds|^GPU string limit:/.test(message)) return { kind: 'resource-limit', message };
  if (/^TypeError in lane /.test(message)) return { kind: 'throws', name: 'TypeError', message };
  if (/^SyntaxError:/.test(message) || (error && error.name === 'SyntaxError')) return { kind: 'throws', name: 'SyntaxError', message };
  return { kind: 'error', message };
}

function same(expect, actual) {
  if (expect.kind === 'value' || expect.kind === 'typeof') return actual.kind === 'value' && Object.is(actual.value, expect.value);
  if (expect.kind === 'throws') return actual.kind === 'throws' && actual.name === expect.name;
  return actual.kind === expect.kind;
}

let vm;
try {
  const started = performance.now();
  const compiler = await createCompiler();
  const pending = [];
  const results = [];
  for (const program of PROGRAMS) {
    status.textContent = 'Compile ' + program.id;
    let compiled;
    try { compiled = compiler.compile(program.source); }
    catch (error) {
      const actual = classify(error);
      const matched = same(program.expect, actual);
      results.push({ id: program.id, ready: program.ready === true, stage: 'compile', status: program.ready === true ? (matched ? 'passed' : 'failed') : (matched ? 'boundary' : 'failed'), expect: program.expect, actual });
      continue;
    }
    pending.push({ program, compiled });
  }
  if (pending.length) {
    vm = await QuickJSGPU.create();
    for (const item of pending) {
      status.textContent = 'GPU ' + item.program.id;
      let actual;
      try {
        const result = await vm.run(item.compiled, [HARNESS_INPUT], { budget: 4096, maxDispatches: 4096 });
        if (result.backend !== 'gpu' || !result.done) throw new Error(item.program.id + ': GPU completion required');
        actual = { kind: 'value', value: result.values[0] };
      } catch (error) {
        actual = classify(error);
      }
      const matched = same(item.program.expect, actual);
      const unexpectedPass = item.program.ready !== true && actual.kind === 'value';
      results.push({ id: item.program.id, ready: item.program.ready === true, stage: 'gpu', status: unexpectedPass ? 'failed' : (item.program.ready === true ? (matched ? 'passed' : 'failed') : (matched ? 'boundary' : 'failed')), expect: item.program.expect, actual });
    }
  }
  if (vm) { await vm.dispose(); vm = undefined; }
  const counts = { passed: 0, failed: 0, boundary: 0 };
  for (const row of results) counts[row.status] = (counts[row.status] || 0) + 1;
  window.quickjsReport = { backend: 'gpu', suite: 'phase3-focus', harnessInput: HARNESS_INPUT, counts, elapsedMs: performance.now() - started, results, method: 'Existing QuickJSGPU harness. Guest source is not evaluated on the host. ready:false rows that stay unsupported are boundaries, not semantic passes.' };
  status.textContent = counts.failed ? 'Completed with failures' : 'Declared outcomes verified';
  report.textContent = JSON.stringify(window.quickjsReport, null, 2);
} catch (error) {
  window.quickjsError = (error && error.name ? error.name : 'Error') + ': ' + (error && error.message ? error.message : error);
  status.textContent = 'Failed';
  report.textContent = window.quickjsError;
} finally {
  if (vm) await vm.dispose();
}
`;

export function writeFocusPage() {
  if (!existsSync(templatePath) || !existsSync(harnessPath)) {
    const missing = [templatePath, harnessPath].filter(path => !existsSync(path));
    const note = [
      '# Browser harness not found',
      '',
      'phase3-focus.html was not written. A new runner was not invented.',
      '',
      'Looked for:',
      '',
      ...missing.map(path => '- `' + path + '`'),
      '',
      'Program list remains `programs.js`.',
      '',
    ].join('\n');
    writeFileSync(join(here, 'BROWSER.md'), note);
    return { wroteHtml: false, templatePath, harnessPath, outPath };
  }
  const template = readFileSync(templatePath, 'utf8');
  const harness = readFileSync(harnessPath, 'utf8');
  if (!template.includes('id="status"') || !template.includes('id="report"') || !template.includes('type="module"')) {
    throw new Error('Focused-page template is missing status, report, or module script');
  }
  if (!harness.includes('QuickJSGPU') || !harness.includes('createCompiler')) {
    throw new Error('Focused-page harness does not call QuickJSGPU');
  }
  const html = `<!doctype html>
<meta charset="utf-8">
<title>Phase 3 symbol and bigint focus</title>
<p id="status">Starting phase 3 focus</p>
<pre id="report"></pre>
<script type="module">
${pageModule}</script>
`;
  writeFileSync(outPath, html);
  return { wroteHtml: true, templatePath, harnessPath, outPath };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) writeFocusPage();
