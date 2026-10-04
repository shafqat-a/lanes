import {stdlibComparisonContract} from './stdlib-numeric-comparison.js';
// DRAFT aggregator for the standard-library GPU page (browser-stdlib.js).
// Written by worker 8; the parent owns reconciliation of export names.
//
// Shape consumed by the page:
//   stdlibSuite = {
//     genericIteration: boolean,   // true only after Grok's generic iterator protocol is merged
//     features: [names],           // dependencies satisfied by the integrated runtime (see `requires`)
//     groups: [{ name, cases, unsupported, resumption: [{source,input,expected}], gcCases }],
//   }
// Case records are normalized to
//   { name, source, inputs, expected?, specNote?, orderSensitive?, requires?, requiresGenericIteration?, requiredGC? }
// Unsupported records are normalized to
//   { name, source, input, rejection: 'runtime'|'compile', requiresGenericIteration?, specExpected?, reason? }
//
// Worker modules are imported as namespaces and validated eagerly: a missing
// required export throws at module evaluation (the page reports it as an
// error). Nothing is silently skipped.
import {stdlibProtocolIntegrationCases} from './stdlib-protocol-integration-cases.js';
import * as mapCore from './stdlib-map-core-cases.js';
import * as mapExtra from './stdlib-map-extra-cases.js';
import * as setCore from './stdlib-set-core-cases.js';
import * as setExtra from './stdlib-set-extra-cases.js';
import * as iterators from './stdlib-collection-iterators-cases.js';
import * as reflect from './stdlib-reflect-cases.js';
import * as numeric from './stdlib-numeric-cases.js';
import { stdlibConformanceCases, stdlibConformanceUnsupported } from './stdlib-conformance-cases.js';
import { stdlibGCCases, stdlibResumptionSources } from './stdlib-gc-cases.js';

function need(module, label, name, type) {
  const value = module[name];
  if (type === 'array' ? !Array.isArray(value) : typeof value !== type) {
    throw new Error(`stdlib-gpu-suite: ${label} must export ${name} (${type})`);
  }
  return value;
}

// Accepts both record styles used by the workers:
//   { inputs:[...], expected?:[...] }  and  { input, expected }  (single input, fixed expectation).
// A present `expected` is used instead of the native oracle; the page records
// any native disagreement. `gc`/`requiresGC`/`requiredGC` all mean required collection.
function caseRecord(item, label) {
  const name = item.id || item.feature || item.name;
  const single = !Array.isArray(item.inputs) && 'input' in item;
  const inputs = single ? [item.input] : item.inputs;
  const expected = single ? ('expected' in item ? [item.expected] : undefined) : item.expected;
  if (!name || typeof item.source !== 'string' || !Array.isArray(inputs) || inputs.length === 0) {
    throw new Error(`stdlib-gpu-suite: malformed case in ${label}: ${JSON.stringify(item).slice(0, 200)}`);
  }
  if (expected !== undefined && (!Array.isArray(expected) || expected.length !== inputs.length)) {
    throw new Error(`stdlib-gpu-suite: ${label}/${name}: expected must be one value per input`);
  }
  return Object.freeze({
    name: `${label}:${name}`, source: item.source, inputs, expected,
    comparison:stdlibComparisonContract(label,name),
    specNote: item.specNote || (expected !== undefined ? 'worker fixed expectation' : undefined),
    orderSensitive: !!item.orderSensitive, requires: [...(item.requires || []),...(item.source.includes('Array.from(')?['Array.from']:[])],
    requiresGenericIteration: !!item.requiresGenericIteration, requiredGC: !!(item.requiredGC || item.requiresGC || item.gc),
  });
}

// rejection: 'runtime' (status 6: /Unsupported/ + /no CPU fallback/), 'resource'
// (status 3: /Resource limit/ + /no CPU fallback/) or 'compile' (compiler SyntaxError).
function unsupportedRecord(item, label, index, specExpected) {
  const entry = typeof item === 'string' ? { source: item } : item;
  if (typeof entry.source !== 'string') throw new Error(`stdlib-gpu-suite: malformed unsupported entry in ${label}`);
  // Worker 2 documents compile-time rejections as `expected: 'SyntaxError: …'`; worker 6 uses `status`.
  const rejection = entry.rejection || (typeof entry.expected === 'string' && /^SyntaxError/.test(entry.expected) ? 'compile'
    : entry.status === 3 ? 'resource' : 'runtime');
  if (entry.status !== undefined && entry.status !== 3 && entry.status !== 6) throw new Error(`stdlib-gpu-suite: ${label}: unsupported status ${entry.status}`);
  return Object.freeze({
    name: `${label}:${entry.id || entry.feature || 'boundary-' + index}`, source: entry.source,
    input: entry.input ?? entry.inputs?.[0] ?? 3, rejection,
    expectedCompileError: rejection==='compile'&&typeof entry.expected==='string'&&entry.expected.startsWith('SyntaxError: ')?{name:'SyntaxError',message:entry.expected.slice(13)}:undefined,
    requiresGenericIteration: !!entry.requiresGenericIteration || specExpected !== undefined, specExpected: entry.specExpected ?? specExpected, reason: entry.reason || entry.expected,
  });
}

function workerGroup(name, module, prefix, casesName) {
  const label = name;
  const resumptionSource = need(module, label, `${prefix}ResumptionSource`, 'string');
  const expected = module[`${prefix}ResumptionExpected`];
  if (expected === undefined) throw new Error(`stdlib-gpu-suite: ${label} must export ${prefix}ResumptionExpected`);
  const inputs = module[`${prefix}ResumptionInputs`], input = module[`${prefix}ResumptionInput`];
  // Optional: values the boundary sources produce once generic iteration merges (same order).
  const postMerge = module[`${prefix}UnsupportedPostMergeExpected`];
  return {
    name,
    cases: [...need(module, label, casesName, 'array'), ...(module[`${prefix}PostMergeCases`] || [])].map(item => caseRecord(item, label)),
    unsupported: need(module, label, `${prefix}UnsupportedSources`, 'array').map((item, i) => unsupportedRecord(item, label, i, postMerge?.[i])),
    // Default resumption input 3 matches the existing phase-5 convention when a worker exports no input.
    resumption: [{ name: `${label}:resumption`, source: resumptionSource, input: Array.isArray(inputs) ? inputs[0] : input ?? 3, expected }],
    gcCases: (module[`${prefix}GCCases`] || []).map(item => caseRecord({ ...item, requiredGC: true }, label)),
  };
}

const groups = [
  {name:'protocol-integration',cases:stdlibProtocolIntegrationCases.map(c=>caseRecord(c,'protocol-integration')),unsupported:[],resumption:[],gcCases:[]},
  workerGroup('map-core', mapCore, 'mapCore', 'mapCoreCases'),
  workerGroup('map-extra', mapExtra, 'mapExtra', 'mapExtraCases'),
  workerGroup('set-core', setCore, 'setCore', 'setCoreCases'),
  workerGroup('set-extra', setExtra, 'setExtra', 'setExtraCases'),
  workerGroup('collection-iterators', iterators, 'collectionIterator', 'collectionIteratorCases'),
  workerGroup('reflect', reflect, 'reflect', 'reflectCases'),
  workerGroup('numeric', numeric, 'numeric', 'numericCases'),
  {
    name: 'conformance',
    cases: stdlibConformanceCases.map(item => caseRecord(item, `conformance-${item.group}`)),
    unsupported: stdlibConformanceUnsupported.map((item, i) => unsupportedRecord(item, 'conformance', i)),
    resumption: stdlibResumptionSources.map(item => ({ name: `conformance:${item.id}`, source: item.source, input: item.input, expected: item.expected })),
    gcCases: stdlibGCCases.map(item => caseRecord(item, 'conformance-gc')),
  },
];

const seen = new Set();
for (const group of groups) for (const record of [...group.cases, ...group.unsupported, ...group.resumption, ...group.gcCases]) {
  if (seen.has(record.name)) throw new Error(`stdlib-gpu-suite: duplicate record ${record.name}`);
  seen.add(record.name);
}

export const stdlibSuite = Object.freeze({
  // Flip only when the generic iterator protocol (1270–1273 / 2400–2499) is merged.
  genericIteration: true,
  // Dependencies the integrated runtime provides. A case whose `requires` is not
  // covered is not run and is listed as an explicit gap (never counted as passed).
  // Parent: extend when worker 7 / Grok land the corresponding features.
  // Present today (stdlib-registry.js installs them): the intra-wave names the
  // worker fixtures use, and worker 7's Math functions. Absent on purpose:
  // Generator and later APIs require their own explicit feature entries.
  features: Object.freeze([
    'Array.from', 'Map.groupBy', 'Map[@@species]', 'Set[@@species]', 'Object.groupBy',
    '%IteratorPrototype%', 'Map.prototype.forEach', 'Map.prototype[@@toStringTag]', 'Map.prototype[@@iterator]', 'mapConstruct',
    'setForEach', 'setSize', 'setKeys', 'setToStringTag',
    'Math.sqrt', 'Math.cbrt', 'Math.hypot', 'Math.clz32', 'Math.imul', 'Math.fround',
  ]),
  groups: Object.freeze(groups.map(Object.freeze)),
});
