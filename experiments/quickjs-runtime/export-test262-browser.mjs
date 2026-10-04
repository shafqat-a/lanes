import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { wrapTest262, classifyTest262 } from './test262-property-harness.js';

const [reportPath, checkoutPath, outputPath] = process.argv.slice(2);
if (!reportPath || !checkoutPath) throw new Error('Usage: export-test262-browser.mjs REPORT_JSON TEST262_CHECKOUT [OUTPUT_JSON]');
const report = JSON.parse(await readFile(reportPath, 'utf8'));
if (report.fullTest262 !== false) throw new Error('Expected an explicitly adapted report');
const checkout = resolve(checkoutPath);
const commit = execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (commit !== report.commit) throw new Error('Test262 revision does not match the report');
const harnessManifest = JSON.parse(await readFile(new URL('./test262-upstream-harness-manifest.json', import.meta.url), 'utf8'));
const cases = [], seen = new Set();
for (const record of report.records) {
  if (record.status === 'excludedHarness' || record.status === 'referenceRejected') continue;
  if (!['eligible', 'compiled', 'passed', 'failed', 'unsupported', 'resourceLimited'].includes(record.status)) throw new Error(`Unknown record status: ${record.status}`);
  const key = `${record.file}:${record.strict}`;
  if (seen.has(key)) throw new Error(`Duplicate variant: ${key}`);
  seen.add(key);
  const path = resolve(checkout, record.file);
  if (!path.startsWith(checkout + sep + 'test' + sep)) throw new Error('Invalid test path');
  const body = await readFile(path, 'utf8');
  if (record.sourceHash && createHash('sha256').update(body).digest('hex') !== record.sourceHash)
    throw new Error(`Test source changed since inventory: ${record.file}`);
  const classification = classifyTest262(body);
  if (!classification.eligible || !classification.modes.includes(record.strict))
    throw new Error(`Report variant no longer eligible: ${record.file} (${classification.reason ?? 'strict mode'})`);
  cases.push({ file: record.file, strict: record.strict, sourceHash: record.sourceHash, source: wrapTest262(body, record.strict) });
}
const output = outputPath ? resolve(outputPath) : fileURLToPath(new URL('./generated/test262-suite.json', import.meta.url));
await mkdir(dirname(output), { recursive: true });
await copyFile(join(checkout, 'LICENSE'), join(dirname(output), 'test262-LICENSE.txt'));
await copyFile(new URL('./test262-upstream-harness-LICENSE.txt', import.meta.url), join(dirname(output), 'test262-upstream-harness-LICENSE.txt'));
await writeFile(output, JSON.stringify({ commit, fullTest262: false, schemaVersion: report.schemaVersion ?? 1,
  scope: report.scope ?? 'descriptors', folders: report.folders, selectionPaths: report.selectionPaths ?? report.folders, sourceFiles: report.counts.files,
  selectedVariants: report.counts.variants ?? null,
  excludedHarnessVariants: report.counts.excludedHarnessVariants ?? null,
  exclusionRecords: report.records.filter(r => r.status === 'excludedHarness' || r.status === 'referenceRejected'),
  excludedHarnessFiles: report.counts.excludedHarness,
  exclusionsByReason: report.exclusionsByReason ?? {},
  inventoryOnlySource: report.inventoryOnly ?? false,
  omittedCompileUnsupportedVariants: 0,
  previousCompileUnsupportedVariants: report.records.filter(r => r.status === 'unsupported' && r.stage === 'compile').length,
  omittedReferenceRejectedVariants: report.counts.referenceRejected,
  harnessManifest, method: report.method, license: './test262-LICENSE.txt', cases }));
console.log(JSON.stringify({ output, variants: cases.length, commit }));
