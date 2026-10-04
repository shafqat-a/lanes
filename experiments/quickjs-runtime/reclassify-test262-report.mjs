import { readFile, writeFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { classifyTest262Outcome } from './test262-outcome.js';
const [input, output] = process.argv.slice(2);
if (!input || !output || resolve(input) === resolve(output)) throw new Error('Usage: reclassify-test262-report.mjs INPUT_JSON DISTINCT_OUTPUT_JSON');
const bytes = await readFile(input), original = JSON.parse(bytes);
const report = original.report ?? original;
if (report.fullTest262 !== false || !Array.isArray(report.records)) throw new Error('Expected adapted Test262 report');
const counts = { ...report.counts, passed: 0, failed: 0, unsupported: 0, resourceLimited: 0, referenceRejected: 0 };
const records = report.records.map(record => {
  const status = ['failed', 'unsupported', 'resourceLimited'].includes(record.status)
    ? classifyTest262Outcome(record.error, record.stage) : record.status;
  if (['passed', 'failed', 'unsupported', 'resourceLimited', 'referenceRejected'].includes(status)) counts[status]++;
  return { ...record, originalStatus: record.status, status };
});
const classifier = await readFile(new URL('./test262-outcome.js', import.meta.url));
const derived = { ...report, counts, records,
  reclassification: {
    date: new Date().toISOString(), sourceFile: basename(input), sourceSha256: createHash('sha256').update(bytes).digest('hex'),
    classifierSha256: createHash('sha256').update(classifier).digest('hex'), originalCounts: report.counts,
    rerun: false, explanation: 'Classification-only derivation of existing diagnostics. Original statuses retained on every record. No tests rerun; resource-limited outcomes are unresolved, not passes or proof of correct semantics.',
  },
};
await writeFile(output, JSON.stringify(original.report ? { ...original, report: derived } : derived, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, counts, rerun: false }));
