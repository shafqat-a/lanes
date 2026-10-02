import { readFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, relative } from 'node:path';
import { createCompiler } from './compiler.js';
import { QuickJSGPU } from './runtime.js';
import { openDevice } from '../../scripts/device.js';
import { parse } from 'acorn';
import { Script } from 'node:vm';
import { wrapTest262 } from './test262-harness.js';

// An explicitly adapted subset runner, not the Test262 harness or a compliance claim.
const checkout = resolve(process.argv[2]);
const folders = ['test/built-ins/Object/defineProperty', 'test/built-ins/Object/getOwnPropertyDescriptor'];
const files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) await walk(`${dir}/${entry.name}`);
    else if (entry.name.endsWith('.js')) files.push(`${dir}/${entry.name}`);
  }
}
for (const dir of folders) await walk(`${checkout}/${dir}`);
const compiler = await createCompiler(), context = await openDevice(), vm = await QuickJSGPU.create({ device: context.device });
const records = [], counts = { files: files.length, passed: 0, failed: 0, unsupported: 0, excludedHarness: 0, referenceRejected: 0 };
function usesTopLevelThis(source) {
  const pending = [[parse(source, { ecmaVersion: 2025 }), 0]];
  while (pending.length) {
    const [node, depth] = pending.pop();
    if (node.type === 'ThisExpression' && depth === 0) return true;
    const next = depth + Number(node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration');
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) { for (const child of value) if(child?.type) pending.push([child,next]); }
      else if(value?.type) pending.push([value,next]);
    }
  }
  return false;
}
try {
  for (const path of files.sort()) {
    const body = await readFile(path, 'utf8'), file = relative(checkout, path);
    // Explicitly exclude unsupported harness/parse/module contexts. Never report these as passes.
    if (/includes:|negative:|flags:.*(?:module|async)|assert\s*\(|assert\.(?!sameValue\b|notSameValue\b)|\$DONE|\$DONOTEVALUATE/.test(body)) {
      counts.excludedHarness++; records.push({ file, status: 'excludedHarness' }); continue;
    }
    if (usesTopLevelThis(body)) {
      counts.excludedHarness++; records.push({ file, status: 'excludedHarness', reason: 'Top-level this requires script/global semantics; function wrapper is not equivalent' }); continue;
    }
    const modes = /flags:.*onlyStrict/.test(body) ? [true] : /flags:.*noStrict/.test(body) ? [false] : [false, true];
    for (const strict of modes) {
      const source = wrapTest262(body, strict);
      // Validate the adapted body independently in a fresh native realm. A
      // wrapper/harness mismatch must never masquerade as a GPU engine defect.
      try {
        const reference = new Script(`(${source})(0)`).runInNewContext({}, { timeout: 1000 });
        if (reference !== true) throw new Error('Adapted native reference did not return true');
      } catch (error) {
        counts.referenceRejected++;
        records.push({ file, strict, status: 'referenceRejected', error: String(error) });
        continue;
      }
      let program;
      try { program = compiler.compile(source); }
      catch (error) { counts.unsupported++; records.push({ file, strict, status: 'unsupported', stage: 'compile', error: error.message }); continue; }
      try {
        const result = await vm.run(program, [0], { budget: 4096, maxDispatches: 32 });
        if (result.values[0] !== true || result.backend !== 'gpu') throw new Error('Expected true on GPU');
        counts.passed++; records.push({ file, strict, status: 'passed' });
      } catch (error) {
        const status = /Unsupported|Resource limit/.test(error.message) ? 'unsupported' : 'failed';
        counts[status]++; records.push({ file, strict, status, stage: 'runtime', error: error.message });
      }
    }
  }
  const info = context.adapter.info;
  console.log(JSON.stringify({
    date: new Date().toISOString(), commit: execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    adapter: { vendor: info.vendor, device: info.device }, folders, counts,
    method: 'Original test bodies wrapped in a function with an adapted GPU assert object. Default tests tried in sloppy and strict function modes. Top-level script semantics and the full upstream harness are not reproduced.',
    fullTest262: false, nativeReference: 'Node isolated realm with 1 second execution timeout per adapted variant', records,
  }, null, 2));
} finally { await vm.dispose(); context.device.destroy(); }
