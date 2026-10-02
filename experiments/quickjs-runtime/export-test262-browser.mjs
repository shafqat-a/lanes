import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { wrapTest262 } from './test262-harness.js';

const [reportPath, checkoutPath] = process.argv.slice(2);
if (!reportPath || !checkoutPath) throw new Error('Usage: export-test262-browser.mjs REPORT_JSON TEST262_CHECKOUT');
const report = JSON.parse(await readFile(reportPath, 'utf8'));
if (report.fullTest262 !== false) throw new Error('Expected an explicitly adapted report');
const checkout = resolve(checkoutPath);
const commit = execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (commit !== report.commit) throw new Error('Test262 revision does not match the report');
const cases = [];
for (const record of report.records) {
  if (record.status === 'excludedHarness' || record.status === 'referenceRejected') continue;
  const path = resolve(checkout, record.file);
  if (!path.startsWith(checkout + sep + 'test' + sep)) throw new Error('Invalid test path');
  cases.push({ file: record.file, strict: record.strict,
    source: wrapTest262(await readFile(path, 'utf8'), record.strict) });
}
const output = fileURLToPath(new URL('./generated/test262-suite.json', import.meta.url));
await mkdir(dirname(output), { recursive: true });
await copyFile(join(checkout, 'LICENSE'), join(dirname(output), 'test262-LICENSE.txt'));
await writeFile(output, JSON.stringify({ commit, fullTest262: false, sourceFiles: report.counts.files,
  excludedHarnessFiles: report.counts.excludedHarness,
  omittedCompileUnsupportedVariants: 0,
  previousCompileUnsupportedVariants: report.records.filter(r => r.status === 'unsupported' && r.stage === 'compile').length,
  omittedReferenceRejectedVariants: report.counts.referenceRejected,
  method: report.method, license: './test262-LICENSE.txt', cases }));
console.log(JSON.stringify({ output, variants: cases.length, commit }));
