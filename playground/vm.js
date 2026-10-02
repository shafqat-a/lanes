import { JavaScriptVM } from '../src/vm/runtime.js';
import { runVMConformance } from '../test/vm-cases.js';
const $ = id => document.getElementById(id);
let vm, controller;
const examples = {
  numeric: $('source').value,
  strings: `function decorate(x) {
  const suffix = "!";
  function append() { return x + suffix; }
  return append();
}`,
  closure: `function counter(x) {
  function make(start) {
    return step => {
      start += step;
      return start;
    };
  }
  const next = make(x);
  next(0.1);
  return next(0.2);
}`,
  recursion: `function factorial(x) {
  if (x <= 1) { return 1; }
  return x * factorial(x - 1);
}`,
  finally: `function cleanup(x) {
  let total = 0;
  function work() {
    try { throw x; }
    catch (error) { return error + 1; }
    finally { total = 10; }
  }
  const result = work();
  return result + total;
}`,
  gc: `function collect(x) {
  function make(n) { return () => ++n; }
  const kept = make(x);
  let last;
  for (let i = 0; i < 600; i++) {
    last = make(i);
    last();
  }
  return kept() + kept() + last();
}`,
};
$('example').onchange = () => {
  $('source').value = examples[$('example').value];
  $('inputs').value = $('example').value === 'strings' ? '["hello", "", "😀"]' : $('example').value === 'recursion' ? '0, 1, 5, 12' : '0, 1, 2';
};
const format = value => Object.is(value, -0) ? '-0' : String(value);
function setBusy(busy) {
  for (const id of ['run', 'check', 'source', 'inputs', 'example']) $(id).disabled = busy;
  $('cancel').disabled = !busy;
}
function input(text) {
  if (text.trim().startsWith('[')) {
    const values = JSON.parse(text);
    if (!Array.isArray(values)) throw new Error('Expected a JSON array of primitive inputs');
    return values;
  }
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
      }, controller.signal);
      window.vmReport = report;
      $('report').textContent = JSON.stringify(report, null, 2);
      $('status').textContent = `${report.checked.toLocaleString()} results matched native JavaScript. Backend: ${report.backend.toUpperCase()}.`;
    } else {
      const values = input($('inputs').value), p = vm.compile($('source').value);
      const result = await vm.run(p, values, { signal: controller.signal, maxDispatches: 1024 });
      $('output').textContent = result.values.map((value, i) => `${format(values[i])} → ${format(value)} (${result.steps[i]} instructions, ${result.collections[i]} collections)`).join('\n');
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
