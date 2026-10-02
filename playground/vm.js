import { JavaScriptVM } from '../src/vm/runtime.js';
import { runVMConformance } from '../test/vm-cases.js';
const $ = id => document.getElementById(id);
let vm, controller;
const format = value => Object.is(value, -0) ? '-0' : String(value);
function setBusy(busy) {
  for (const id of ['run', 'check', 'source', 'inputs']) $(id).disabled = busy;
  $('cancel').disabled = !busy;
}
function input(text) {
  return text.split(',').map(token => {
    const value = token.trim();
    if (!value) throw new Error('Empty input token');
    if (value === 'undefined') return undefined;
    if (value === 'null') return null;
    if (value === 'true') return true;
    if (value === 'false') return false;
    const number = Number(value);
    if (Number.isNaN(number) && value !== 'NaN') throw new Error(`Invalid input: ${value}`);
    return number;
  });
}
async function work(check) {
  controller = new AbortController(); setBusy(true); $('status').className = '';
  window.vmReport = undefined;
  $('status').textContent = 'Running…'; $('report').textContent = '—'; $('output').textContent = '—';
  try {
    if (check) {
      const report = await runVMConformance(vm, ({ checked }) => {
        controller.signal.throwIfAborted(); $('status').textContent = `${checked.toLocaleString()} values checked…`;
      });
      window.vmReport = report;
      $('report').textContent = JSON.stringify(report, null, 2);
      $('status').textContent = `${report.checked.toLocaleString()} results matched native JavaScript. Backend: ${report.backend.toUpperCase()}.`;
    } else {
      const values = input($('inputs').value), p = vm.compile($('source').value);
      const result = await vm.run(p, values, { signal: controller.signal, maxDispatches: 1024 });
      $('output').textContent = result.values.map((value, i) => `${format(values[i])} → ${format(value)} (${result.steps[i]} instructions)`).join('\n');
      $('status').textContent = `${values.length} instances finished. Backend: ${result.backend.toUpperCase()}.`;
    }
  } catch (error) { $('status').className = 'error'; $('status').textContent = error.message; }
  finally { setBusy(false); }
}
$('run').onclick = () => work(false); $('check').onclick = () => work(true);
$('cancel').onclick = () => controller?.abort();
window.addEventListener('pagehide', () => { controller?.abort(); vm?.dispose(); });
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
try {
  vm = await JavaScriptVM.create();
  $('adapter').textContent = vm.backend === 'gpu' ? 'GPU VM' : 'CPU VM — no GPU';
  $('status').textContent = 'Ready. Unsupported features are errors, not CPU fallback triggers.';
  setBusy(false);
} catch (error) { $('status').className = 'error'; $('status').textContent = error.message; }
