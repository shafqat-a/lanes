// Promise + async GPU page (worker 8). Every guest value and every promise job
// runs in WGSL on the GPU; the browser's own engine is only the oracle (a
// fresh bounded Worker per input, with 50ms pending detection and a separate
// 5s worker-termination deadline). Requires the parent's host option
// {promiseResults:'settle'} (result.settlements[i] from statuses 12/13/14).
// Any failure leaves window.quickjsReport unset and sets window.quickjsError.
import { createCompiler } from './compiler.js';
import { QuickJSGPU } from './runtime.js';
import { nativePromiseWorkerOutcome as native, allowedNativePromiseError, allowedNativePromiseValue } from './native-promise-worker-oracle.js';
import { promiseSuite, optionalCaseModules, normalizeCase, RUN_OPTIONS, RESUMPTION_DISPATCH_LIMIT, isStatusRejection, optInProbe } from './promise-gpu-suite.js';

import * as fixtureModule0 from './promise-core-cases.js';
import * as fixtureModule1 from './promise-resolve-cases.js';
import * as fixtureModule2 from './promise-then-cases.js';
import * as fixtureModule3 from './promise-combinators-cases.js';
import * as fixtureModule4 from './async-function-cases.js';
import * as fixtureModule5 from './async-generator-cases.js';
import * as fixtureModule6 from './promise-jobs-cases.js';
import * as fixtureModule7 from './async-iteration-cases.js';
const fixtureModules = Object.freeze({
 './promise-core-cases.js':fixtureModule0,
 './promise-resolve-cases.js':fixtureModule1,
 './promise-then-cases.js':fixtureModule2,
 './promise-combinators-cases.js':fixtureModule3,
 './async-function-cases.js':fixtureModule4,
 './async-generator-cases.js':fixtureModule5,
 './promise-jobs-cases.js':fixtureModule6,
 './async-iteration-cases.js':fixtureModule7
});

const status = document.getElementById('status'), out = document.getElementById('report');
const coreOnly = new URLSearchParams(location.search).get('coreOnly') === '1';
const show = v => (Object.is(v, -0) ? '-0' : typeof v === 'string' ? JSON.stringify(v) : typeof v === 'bigint' ? `${v}n` : String(v));

let runtime;
const jobs = new Set();
try {
  const started = performance.now();
  const compiler = await createCompiler();
  runtime = await QuickJSGPU.create();
  const report = {
    backend: 'gpu', compiler: 'QuickJS/Wasm', coreOnly, qualified: !coreOnly,
    programs: 0, checked: 0, settlements: { fulfilled: 0, rejected: 0, pending: 0, sync: 0 },
    gcProbes: [], resumptions: [], resourceLimits: [], gaps: [], modules: [], nativeDisagreements: [], nativeReferenceDifferences: [], failures: [],
  };
  if (coreOnly) report.notQualified = promiseSuite.coreOnlyNote;
  const fail = (name, message) => report.failures.push({ name, message });

  // Every worker fixture module is statically imported and required.
  const records = [...promiseSuite.records];
  for (const path of optionalCaseModules) {
    const mod=fixtureModules[path];
    if(!mod)throw new Error(`Required fixture module missing: ${path}`);
    let n = 0;
    for (const [name, value] of Object.entries(mod)) {
      if (!Array.isArray(value) || !value.some(r => r && typeof r.source === 'string')) continue;
      for (const item of value) if (item && typeof item.source === 'string') { records.push(normalizeCase(item, `${path.slice(2, -3)}/${name}`, /Boundary/.test(name))); n++; }
    }
    if(n===0)throw new Error(`Required fixture module has no records: ${path}`);
    report.modules.push({ path, loaded: true, records: n });
  }
  const seen = new Set();
  for (const r of records) { if (seen.has(r.name)) throw new Error(`duplicate record ${r.name}`); seen.add(r.name); }
  if(records.length!==583)throw new Error(`Expected 583 complete wave records, got ${records.length}`);
  const selected = records.filter(r => !coreOnly || r.promiseOnly);

  // Opt-in proof: without promiseResults a promise result is an object result error.
  {
    let error; try { await runtime.run(compiler.compile(optInProbe.source), [optInProbe.input], { budget: 4096, maxDispatches: 4096 }); } catch (e) { error = e; }
    if (!error || !optInProbe.error.test(error.message)) fail(optInProbe.name, `expected object-result rejection without promiseResults, got ${error ? error.message : 'a value'}`);
    else report.checked++;
  }

  for (const item of selected) {
    status.textContent = `Promise: ${item.name}`;
    // 1. Native oracle vs fixed expectation (settlement and value).
    const oracle = [];let unexpectedNativeError=false;
    for (let i = 0; i < item.inputs.length; i++) {
      const n = await native(item.source, item.inputs[i]); oracle.push(n);
      if(n.nativeError){
        if(allowedNativePromiseError(item,item.inputs[i],n))report.nativeReferenceDifferences.push({name:item.name,input:item.inputs[i],fixture:`${item.settlement} ${show(item.expected[i])}`,nativeError:n.nativeError,timeout:n.timeout,evidence:item.nativeOracleError.evidence,spec:item.nativeOracleError.spec,reason:item.nativeOracleError.reason});
        else {unexpectedNativeError=true;fail(item.name, `native oracle failed for input ${show(item.inputs[i])}: ${n.nativeError}`);}
        continue;
      }
      if (item.expected !== undefined && (item.hasSettlement && n.settlement !== item.settlement || !Object.is(n.value, item.expected[i]))) {
        const detail={name:item.name,input:item.inputs[i],fixture:`${item.settlement} ${show(item.expected[i])}`,native:`${n.settlement} ${show(n.value)}`};
        if(allowedNativePromiseValue(item,item.inputs[i],n))report.nativeReferenceDifferences.push({...detail,reason:item.nativeReferenceDifference,spec:item.spec,evidence:item.nativeEvidence});
        else report.nativeDisagreements.push(detail);
      }
    }
    if(unexpectedNativeError)continue;
    const expected = item.expected ?? oracle.map(n => n.value);
    const settlement = item.hasSettlement ? item.settlement : oracle[0].settlement;
    if (settlement === 'sync-throw') { fail(item.name, `native oracle threw synchronously: ${oracle[0].value}`); continue; }

    // 2. GPU run.
    let program;
    try { program = compiler.compile(item.source); } catch (e) { fail(item.name, `compile: ${e.message}`); continue; }
    let result, error;
    try { result = await runtime.run(program, item.inputs, RUN_OPTIONS); } catch (e) { error = e; }
    if (item.resource) {
      if (isStatusRejection(error, item.expectedStatus)) { report.resourceLimits.push({ name: item.name, resource: item.resource, message: error.message.split('\n')[0] }); report.checked++; }
      else fail(item.name, `expected status ${item.expectedStatus} (${item.resource} limit), got ${error ? error.message : 'values ' + result.values.map(show).join(',')}`);
      continue;
    }
    if (error) {
      if (item.dependsOn && isStatusRejection(error, 6)) { report.gaps.push(`${item.name}: depends on ${item.dependsOn}; rejected as Unsupported (not counted)`); continue; }
      fail(item.name, error.message); continue;
    }
    if (!(result.backend === 'gpu' && result.done)) { fail(item.name, 'GPU completion required'); continue; }
    if (!Array.isArray(result.settlements) || result.settlements.length !== item.inputs.length) { fail(item.name, 'runtime result has no per-lane settlements (promiseResults:"settle" not implemented?)'); continue; }
    report.programs++;
    let ok = true;
    for (let i = 0; i < item.inputs.length; i++) {
      if (result.settlements[i] !== settlement) { ok = false; fail(item.name, `input ${item.inputs[i]}: GPU settlement ${result.settlements[i]}, expected ${settlement}`); continue; }
      if (!Object.is(result.values[i], expected[i])) { ok = false; fail(item.name, `input ${item.inputs[i]}: GPU ${show(result.values[i])}, expected ${show(expected[i])}`); continue; }
      report.checked++; report.settlements[settlement ?? 'sync']++;
    }
    if (item.gc) {
      const collected = Array.isArray(result.collections) && result.collections.length === item.inputs.length && result.collections.every(n => n > 0);
      if (!collected) fail(item.name, `required collection did not occur (collections ${result.collections})`);
      report.gcProbes.push({ name: item.name, collections: Array.from(result.collections || []), steps: Array.from(result.steps), passed: ok && collected });
    }
  }

  // 3. Single-instruction resumption with an explicit dispatch bound.
  for (const item of selected.filter(r => r.resumption && !r.resource)) {
    status.textContent = `Resumption: ${item.name}`;
    let job, result, dispatches = 0;
    try {
      job = await runtime.start(compiler.compile(item.source), [item.inputs[0]], { promiseResults: 'settle' }); jobs.add(job);
      do {
        result = await job.step(1);
        if (++dispatches > RESUMPTION_DISPATCH_LIMIT) throw new Error(`exceeded ${RESUMPTION_DISPATCH_LIMIT} single-instruction dispatches`);
        if (dispatches % 500 === 0) status.textContent = `Resumption: ${item.name} (${dispatches})`;
      } while (!result.done);
    } catch (e) { fail(`${item.name}#resume`, e.message); continue; }
    finally { if (job) { await job.dispose(); jobs.delete(job); } }
    const expectedValue = item.expected ? item.expected[0] : undefined;
    if (!(result.backend === 'gpu' && result.settlements?.[0] === item.settlement && Object.is(result.values[0], expectedValue)))
      fail(`${item.name}#resume`, `resumed ${result.settlements?.[0]} ${show(result.values[0])}, expected ${item.settlement} ${show(expectedValue)}`);
    else { report.checked++; report.resumptions.push({ name: item.name, dispatches, steps: result.steps[0], collections: result.collections?.[0] }); }
  }

  report.elapsedMs = performance.now() - started;
  report.method = 'Exact Object.is comparison of GPU value and settlement (statuses 12/13/14 via promiseResults:"settle") against fixed ES2025 expectations, cross-checked with a bounded native worker oracle; gc fixtures need per-lane collections > 0; resource fixtures must stop with status 3; resumption fixtures re-run with job.step(1).';
  if (report.nativeDisagreements.length) fail('native-oracle', `${report.nativeDisagreements.length} fixture(s) disagree with this browser's engine`);
  if (report.failures.length) { window.quickjsFailedReport=report; const e = new Error(`${report.failures.length} Promise GPU check(s) failed`); e.report = report; throw e; }
  delete report.failures;
  window.quickjsReport = report;
  status.textContent = coreOnly ? 'Passed (coreOnly: not qualified)' : 'Passed';
  out.textContent = JSON.stringify(report, null, 2);
} catch (e) {
  window.quickjsError = `${e.name}: ${e.message}\n${e.report ? JSON.stringify(e.report, null, 2) : e.stack || ''}`;
  status.textContent = 'Failed'; out.textContent = window.quickjsError;
} finally {
  for (const job of jobs) await job.dispose().catch(() => {});
  if (runtime) await runtime.dispose();
}
