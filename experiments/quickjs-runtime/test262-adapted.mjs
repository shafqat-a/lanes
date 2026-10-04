import { classifyTest262Outcome } from './test262-outcome.js';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { createCompiler } from './compiler.js';
import { wrapTest262 } from './test262-property-harness.js';
import { collectTest262Inventory, test262Scopes } from './test262-inventory.js';

// An explicitly adapted subset runner, not the Test262 harness or a compliance claim.
const args = process.argv.slice(2);
const inventoryOnly = args.includes('--inventory-only'), compileOnly = args.includes('--compile-only');
const checkoutArg = args.find(arg => !arg.startsWith('--'));
const scope = args.find(arg => arg.startsWith('--scope='))?.slice(8) ?? 'descriptors';
if (!checkoutArg || args.filter(a => !a.startsWith('--')).length !== 1 ||
    args.some(a => a.startsWith('--') && !['--inventory-only', '--compile-only', `--scope=${scope}`].includes(a)) ||
    (inventoryOnly && compileOnly))
  throw new Error(`Usage: test262-adapted.mjs TEST262_CHECKOUT [--inventory-only|--compile-only] [--scope=${Object.keys(test262Scopes).join('|')}]`);
const checkout = resolve(checkoutArg);
const compiler = inventoryOnly ? null : await createCompiler();
const report = await collectTest262Inventory(checkout, scope, { compiler });
let context, vm;
try {
  if (!inventoryOnly && !compileOnly) {
    const [{ QuickJSGPU }, { openDevice }] = await Promise.all([import('./runtime.js'), import('../../scripts/device.js')]);
    context = await openDevice();
    vm = await QuickJSGPU.create({ device: context.device });
    for (const record of report.records) {
      if (record.status !== 'compiled') continue;
      const source = wrapTest262(await readFile(join(checkout, record.file), 'utf8'), record.strict);
      try {
        const result = await vm.run(compiler.compile(source), [0], { budget: 4096, maxDispatches: 32 });
        if (result.values[0] !== true || result.backend !== 'gpu') throw new Error('Expected true on GPU');
        report.counts.passed++; record.status = 'passed';
      } catch (error) {
        const status = classifyTest262Outcome(error, 'runtime');
        report.counts[status]++; Object.assign(record, { status, stage: 'runtime', reason: error.message, error: error.message });
      }
    }
  }
  const info = context?.adapter.info;
  console.log(JSON.stringify({ ...report,
    date: new Date().toISOString(), commit: execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    adapter: info ? { vendor: info.vendor, device: info.device } : null, inventoryOnly, compileOnly,
    nativeReference: 'Node isolated realm with 1 second execution timeout per adapted variant',
  }, null, 2));
} finally { await vm?.dispose(); context?.device.destroy(); }
