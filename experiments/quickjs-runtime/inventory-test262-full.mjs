// Inventory every upstream test without treating adapted-harness admission as
// ES2025 applicability or as an execution result.
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { classifyTest262, test262Variants } from './test262-property-harness.js';

const [checkoutArg, outputArg] = process.argv.slice(2);
if (!checkoutArg || !outputArg) throw new Error('Usage: node inventory-test262-full.mjs TEST262_CHECKOUT OUTPUT_JSON');
const checkout = resolve(checkoutArg);
const git = (...args) => execFileSync('git', ['-C', checkout, ...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim();
const commit = git('rev-parse', 'HEAD');
// Read Git objects, so sparse checkouts cannot silently omit tests.
const files = git('ls-tree', '-r', '--full-tree', 'HEAD', 'test').split('\n')
  .map(line => { const [header, path] = line.split('\t'); return { oid: header.split(' ')[2], path }; })
  .filter(file => file.path?.endsWith('.js')).sort((a,b) => a.path.localeCompare(b.path));
const blobs = execFileSync('git', ['-C', checkout, 'cat-file', '--batch'], {
  input: files.map(file => file.oid).join('\n') + '\n', maxBuffer: 512 * 1024 * 1024,
});
let cursor = 0;
const records = [], byArea = {}, harnessGaps = {};
let admittedFiles = 0, admittedVariants = 0, fixtures = 0;
for (const file of files) {
  const newline = blobs.indexOf(10, cursor);
  const [oid, type, sizeText] = blobs.subarray(cursor, newline).toString().split(' ');
  const size = Number(sizeText);
  if (oid !== file.oid || type !== 'blob' || !Number.isSafeInteger(size)) throw new Error('Invalid git blob response');
  const bytes = blobs.subarray(newline + 1, newline + 1 + size);
  cursor = newline + 1 + size + 1;
  const body = bytes.toString('utf8'), name = file.path;
  const fixture = name.endsWith('_FIXTURE.js');
  const admission = fixture ? { eligible: false, reason: 'upstream-fixture' } : classifyTest262(body);
  const variants = admission.eligible ? test262Variants(body).length : 0;
  const area = name.split('/').slice(0, 3).join('/');
  byArea[area] = (byArea[area] ?? 0) + 1;
  if (fixture) fixtures++;
  else if (admission.eligible) { admittedFiles++; admittedVariants += variants; }
  else harnessGaps[admission.reason] = (harnessGaps[admission.reason] ?? 0) + 1;
  records.push({ path: name, sha256: createHash('sha256').update(bytes).digest('hex'),
    fixture, adaptedHarnessEligible: admission.eligible, adaptedVariants: variants,
    admissionReason: admission.reason ?? null, execution: 'not-run', es2025Applicability: 'unreviewed' });
}
const report = {
  schemaVersion: 1, commit, checkoutDirty: git('status', '--porcelain').length > 0,
  method: 'All committed JavaScript files under test/, read from Git objects including sparse-checkout omissions. No directory or pass-based filtering. Eligibility describes the existing adapted function harness only; no guest program is executed.',
  scopePolicy: 'This upstream revision may contain post-ES2025 proposals. Release applicability remains unreviewed; this inventory is not a conformance result.',
  counts: { files: records.length, tests: records.length - fixtures, fixtures, adaptedHarnessEligibleFiles: admittedFiles,
    adaptedHarnessEligibleVariants: admittedVariants, harnessBlockedFiles: records.length - fixtures - admittedFiles, executed: 0 },
  byArea, harnessGaps, records,
};
await writeFile(outputArg, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ commit, counts: report.counts, output: outputArg }));
