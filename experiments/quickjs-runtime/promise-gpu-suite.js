// Promise + async wave GPU suite description (worker 8). DOM-free so node can
// import it for static validation; browser-promise.js executes it.
//
// Record shape (normalized):
//   { name, group, source, inputs:[n, n+1], expected:[v, v'], settlement,
//     promiseOnly, gc, resumption, resource, expectedStatus }
// settlement: 'fulfilled'|'rejected'|'pending' (GPU status 12/13/14 exposed as
// result.settlements[i] under {promiseResults:'settle'}) or undefined (status 1,
// plain value). Resource fixtures must fail with runtime.js' status-3 message.
import { promiseConformanceCases } from './promise-conformance-cases.js';

// Every listed worker fixture module is statically bundled and required.
// The legacy export name is retained for checker compatibility.
export const optionalCaseModules = Object.freeze([
  './promise-core-cases.js', './promise-resolve-cases.js', './promise-then-cases.js',
  './promise-combinators-cases.js', './async-function-cases.js', './async-generator-cases.js',
  './promise-jobs-cases.js', './async-iteration-cases.js',
]);

export const SETTLEMENTS = Object.freeze(['fulfilled', 'rejected', 'pending']);
export const RUN_OPTIONS = Object.freeze({ budget: 4096, maxDispatches: 4096, promiseResults: 'settle' });
// Upper bound on single-instruction dispatches for a resumption fixture. Promise
// machinery runs as guest bootstrap code, so a few thousand instructions per
// job turn are normal; exceeding the bound is a failure, never a pass.
export const RESUMPTION_DISPATCH_LIMIT = 150000;
export const STATUS_MESSAGES = Object.freeze({ 3: /Resource limit/, 6: /Unsupported runtime operation/, 7: /Uncaught guest exception/ });
export const isStatusRejection = (error, status) => !!error && STATUS_MESSAGES[status].test(error.message) && /no CPU fallback/.test(error.message);

// `boundary`: the record comes from an export a worker labels as a boundary
// (e.g. promiseCoreBoundaryCases); a status-6 rejection is then a reported gap.
export function normalizeCase(item, group, boundary = false) {
  const name = item.feature || item.name || item.id;
  if (!name || typeof item.source !== 'string') throw new Error(`promise-gpu-suite: malformed record in ${group}`);
  const inputs = Array.isArray(item.inputs) ? item.inputs : [item.input, ...('expectedNext' in item ? [item.input + 1] : [])];
  const expected = Array.isArray(item.inputs) ? item.expected : 'expected' in item || 'settlement' in item ? [item.expected, ...('expectedNext' in item ? [item.expectedNext] : [])] : undefined;
  if (inputs.some(v => typeof v !== 'number')) throw new Error(`promise-gpu-suite: ${group}/${name}: numeric inputs required`);
  if (expected !== undefined && expected.length !== inputs.length) throw new Error(`promise-gpu-suite: ${group}/${name}: one expectation per input`);
  // Worker 7 marks synchronous (status 1) results as 'none'.
  const settlement = item.settlement === 'none' ? undefined : item.settlement;
  if (settlement !== undefined && !SETTLEMENTS.includes(settlement)) throw new Error(`promise-gpu-suite: ${group}/${name}: bad settlement`);
  return Object.freeze({
    name: `${group}:${name}`, group, source: item.source, inputs, expected,
    allowedNativeExpected:item.nativeReferenceDifference?(item.nativeExpected??item.v8):undefined,
    nativeReferenceDifference:item.nativeReferenceDifference,
    nativeOracleError:item.nativeOracleError,
    nativeEvidence:item.nativeEvidence,
    spec:item.spec??(item.nativeReferenceDifference?'https://tc39.es/ecma262/2025/multipage/control-abstraction-objects.html#sec-%asyncfromsynciteratorprototype%.next':undefined),
    settlement, hasSettlement: 'settlement' in item,
    promiseOnly: item.promiseOnly ?? !/\basync\b|\bawait\b/.test(item.source),
    gc: !!(item.gc || item.requiredGC || item.requiresGC), resumption: !!item.resumption,
    resource: item.resource ?? (item.gpuOutcome==='resource'?'declared GPU resource bound':undefined), expectedStatus: item.expectedStatus ?? (item.resource||item.gpuOutcome==='resource' ? 3 : undefined),
    dependsOn: item.dependsOn ?? (boundary ? `${group} boundary` : undefined),
  });
}

export const conformanceRecords = Object.freeze(promiseConformanceCases.map(c => normalizeCase(c, 'conformance')));

// Fixture used to prove the opt-in: without {promiseResults:'settle'} the host
// refuses a settled promise result (runtime.js, promise-integration-patch.js).
export const optInProbe = Object.freeze({ name: 'conformance:opt-in-required', source: 'function f(x){return Promise.resolve(x);}', input: 3, error: /requires \{ promiseResults: 'settle' \}/ });

export const promiseSuite = Object.freeze({
  records: conformanceRecords,
  resumption: conformanceRecords.filter(r => r.resumption).map(r => r.name),
  coreOnlyNote: 'coreOnly=1 runs only fixtures without async/await syntax (Promise built-ins and job queue). It does NOT qualify the wave: async functions, async generators and for-await are not exercised.',
});
