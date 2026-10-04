// Compare compiler artifacts without executing guest JavaScript or using a GPU.
// Each compiler compiles its own bootstraps; packed code/image comparisons are
// exact, not raw-bytecode comparisons (raw atom IDs vary across compiler builds).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { sources, stringSources } from './cases.js';
import { attachBootstrap, bootstrapSources } from './bootstrap.js';
import { entrySource, packProgram } from './program.js';
import { arraySearchNegativeSources, arraySearchResumptionSource } from './array-search-cases.js';
import { arrayMethodResumptionSource } from './array-method-cases.js';
import { arrayReduceNegativeSources } from './array-reduce-cases.js';
import { arrayMutationNegativeSources } from './array-mutation-cases.js';
import { arrayShiftNegativeSources } from './array-shift-cases.js';
import { arrayExtendedResumptions } from './array-extended-cases.js';
import { arrayBuiltinMetadataUnsupportedSources } from './array-builtin-metadata-cases.js';
import { objectOperationNegativeSources, objectOperationUnsupportedSources, objectOperationResumptionSource } from './object-operation-cases.js';
import { stringSearchNegativeSources, stringSearchResumptionSource } from './string-search-cases.js';
import { stringSearchIntegrationNegativeSources, stringSearchIntegrationUnsupportedSources } from './string-search-integration-cases.js';
import { propertyKeyUnsupportedSources } from './property-key-negative-cases.js';

const directory = dirname(fileURLToPath(import.meta.url));
const options = { suites: [], current: resolve(directory, 'generated/compiler'), output: resolve(directory, '../bootstrap/evidence/quickjs-compiler-delta.json') };
for (let index = 2; index < process.argv.length; index++) {
  const key = process.argv[index];
  if (!['--baseline', '--current', '--output', '--suite'].includes(key) || !process.argv[index + 1])
    throw new Error('Usage: node check-compiler-delta.mjs --baseline PATH [--current PATH] [--output PATH] [--suite PATH ...]');
  const value = resolve(process.argv[++index]);
  if (key === '--suite') options.suites.push(value); else options[key.slice(2)] = value;
}
if (!options.baseline) throw new Error('--baseline is required');
if (options.baseline === options.current) throw new Error('Baseline and current compiler paths must differ');
const hash = value => createHash('sha256').update(value).digest('hex');
const compilerHashes = () => ({ baseline: hash(readFileSync(options.baseline)), current: hash(readFileSync(options.current)) });
const hashesBefore = compilerHashes();
const startedAt = new Date().toISOString();
const compileRaw = (compiler, source) => {
  const result = JSON.parse(execFileSync(compiler, [source], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 30000 }));
  if (result.error) throw new SyntaxError(result.error);
  return result;
};
const compileBootstraps = compiler => Object.fromEntries(Object.entries(bootstrapSources)
  .map(([name, source]) => [name, compileRaw(compiler, source)]));
const beforeBootstrap = compileBootstraps(options.baseline);
const afterBootstrap = compileBootstraps(options.current);
const metadata = program => ({
  name: program.name, functions: program.functions, typeTable: program.typeTable,
  format: program.raw.format, quickjs: program.raw.quickjs,
  bootstrapFunctions: program.raw.bootstrapFunctions,
  functionMetadata: program.raw.functions.map(fn => ({
    name: fn.name, args: fn.args, length: fn.length, hasPrototype: fn.hasPrototype,
    locals: fn.locals, stack: fn.stack, strict: fn.strict, kind: fn.kind, refs: fn.refs,
  })),
});
const normalizedRaw = raw => ({
  format: raw.format, quickjs: raw.quickjs,
  functions: raw.functions.map(fn => ({ ...fn, instructions: fn.instructions.map(instruction => ({
    op: instruction.op, operand: instruction.operand, pc: instruction.pc,
    // These bytes carry semantic flags, not compiler-local atom identities.
    ...(instruction.op === 'throw_error' ? { errorKind: instruction.bytes[5] } : {}),
    ...(instruction.op === 'define_method' ? { methodKind: instruction.bytes[5] & 3 } : {}),
  })) })),
});
const changedBootstraps = Object.keys(bootstrapSources).filter(name =>
  !isDeepStrictEqual(normalizedRaw(beforeBootstrap[name]), normalizedRaw(afterBootstrap[name])));

const inventory = new Map();
const inventoryCounts = {};
function add(group, list, details = []) {
  inventoryCounts[group] = list.length;
  for (const [index, source] of list.entries()) {
    if (!inventory.has(source)) inventory.set(source, []);
    inventory.get(source).push({ group, index, ...details[index] });
  }
}
const suiteInputs = [];
if (options.suites.length === 0) {
add('main', [...sources, ...stringSources]);
add('dedicatedValidation', [
  ...arraySearchNegativeSources, ...arrayReduceNegativeSources, ...arrayMutationNegativeSources, ...arrayShiftNegativeSources,
  ...arrayBuiltinMetadataUnsupportedSources, ...objectOperationNegativeSources, ...objectOperationUnsupportedSources,
  ...stringSearchNegativeSources, ...stringSearchIntegrationNegativeSources, ...stringSearchIntegrationUnsupportedSources,
  ...propertyKeyUnsupportedSources,
]);
add('dedicatedResumption', [arrayMethodResumptionSource, arraySearchResumptionSource, objectOperationResumptionSource,
  stringSearchResumptionSource, ...arrayExtendedResumptions.map(item => item.source)]);
} else {
  for (const path of options.suites) {
    const contents = readFileSync(path);
    const suite = JSON.parse(contents.toString('utf8'));
    if (!Array.isArray(suite.cases) || suite.cases.some(item => typeof item.source !== 'string'))
      throw new TypeError(`Expected an exported Test262 suite with source cases: ${path}`);
    const group = `suite:${basename(path)}`;
    if (group in inventoryCounts) throw new Error(`Duplicate suite group: ${group}`);
    add(group, suite.cases.map(item => item.source), suite.cases.map(item => ({
      file: item.file, strict: item.strict, originalSourceHash: item.sourceHash,
    })));
    suiteInputs.push({ path, sha256: hash(contents), commit: suite.commit, scope: suite.scope,
      fullTest262: suite.fullTest262, cases: suite.cases.length });
  }
}


function compile(compiler, bootstrap, source) {
  try { return { program: packProgram(attachBootstrap(compileRaw(compiler, source), bootstrap), entrySource(source)) }; }
  catch (error) { return { error: { name: error.name, message: error.message } }; }
}
function wordDifference(before, after) {
  let firstDifference = null, differingWords = 0;
  for (let index = 0; index < Math.max(before.length, after.length); index++) {
    if (before[index] !== after[index]) { differingWords++; if (firstDifference === null) firstDifference = index; }
  }
  return { beforeWords: before.length, afterWords: after.length, differingWords, firstDifference,
    beforeSha256: hash(new Uint8Array(before.buffer, before.byteOffset, before.byteLength)),
    afterSha256: hash(new Uint8Array(after.buffer, after.byteOffset, after.byteLength)) };
}
const changedPrograms = [], unchangedRejections = [];
let unchangedPrograms = 0, comparedPrograms = 0, processedSources = 0;
for (const [source, locations] of inventory) {
  processedSources++;
  if (processedSources % 500 === 0) process.stderr.write(`Compiler delta: ${processedSources}/${inventory.size} sources\n`);
  const before = compile(options.baseline, beforeBootstrap, source);
  const after = compile(options.current, afterBootstrap, source);
  if (before.error || after.error) {
    if (isDeepStrictEqual(before.error, after.error)) unchangedRejections.push({ sourceSha256: hash(source), locations, error: before.error });
    else changedPrograms.push({ source, sourceSha256: hash(source), locations, admissionChanged: true, beforeError: before.error ?? null, afterError: after.error ?? null });
    continue;
  }
  comparedPrograms++;
  const codeChanged = !isDeepStrictEqual(before.program.code, after.program.code);
  const imageChanged = !isDeepStrictEqual(before.program.image, after.program.image);
  const metadataChanged = !isDeepStrictEqual(metadata(before.program), metadata(after.program));
  if (!codeChanged && !imageChanged && !metadataChanged) { unchangedPrograms++; continue; }
  const record = { source, sourceSha256: hash(source), locations, codeChanged, imageChanged, metadataChanged };
  if (codeChanged) record.code = wordDifference(before.program.code, after.program.code);
  if (imageChanged) record.image = wordDifference(before.program.image, after.program.image);
  if (metadataChanged) record.metadataFieldsChanged = Object.keys(metadata(before.program))
    .filter(key => !isDeepStrictEqual(metadata(before.program)[key], metadata(after.program)[key]));
  changedPrograms.push(record);
}
const changedInventoryCounts = Object.fromEntries(Object.keys(inventoryCounts).map(group => [group,
  changedPrograms.reduce((count, item) => count + item.locations.filter(location => location.group === group).length, 0),
]));
const hashesAfter = compilerHashes();
const artifactsUnchangedDuringComparison = isDeepStrictEqual(hashesBefore, hashesAfter);
const report = {
  startedAt, finishedAt: new Date().toISOString(), baseline: options.baseline, current: options.current,
  compilerSha256: hashesBefore, artifactsUnchangedDuringComparison,
  comparison: 'Exact packed Uint32 code/image plus name/functions/typeTable and compiler function metadata; each compiler compiles its own bootstrap sources. Raw atom IDs are excluded.',
  scope: options.suites.length ? 'Only the supplied exported Test262 suites. Compiler artifact comparison, not guest execution, GPU execution, or a conformance claim.' : 'Current main corpus plus dedicated exported validation/resumption fixtures. Inline validation.js checks are not an exhaustive second inventory. No guest execution, GPU execution, or conformance claim.',
  suiteInputs,
  guestExecuted: false, gpuExecuted: false,
  inventoryCounts, uniqueSources: inventory.size, comparedPrograms, unchangedPrograms,
  changedProgramCount: changedPrograms.length, changedInventoryCounts, unchangedRejectedCount: unchangedRejections.length,
  changedBootstraps, changedPrograms, unchangedRejections,
};
if (!artifactsUnchangedDuringComparison) report.compilerSha256After = hashesAfter;
mkdirSync(dirname(options.output), { recursive: true });
writeFileSync(options.output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output: options.output, ...inventoryCounts, uniqueSources: inventory.size,
  comparedPrograms, unchangedPrograms, changedPrograms: changedPrograms.length,
  unchangedRejections: unchangedRejections.length, changedInventoryCounts, changedBootstraps,
  artifactsUnchangedDuringComparison, gpuExecuted: false }));
if (!artifactsUnchangedDuringComparison) process.exitCode = 1;
