import {stdlibCorrectionFocus} from './stdlib-correction-focus.js';
import {compareStdlibValue} from './stdlib-numeric-comparison.js';
// Standard-library GPU page (Map, Set, collection iterators, Reflect, numeric).
// Every guest value is computed by WGSL on the GPU; the browser's own engine
// is only the test oracle (`native`). ES2025 `expected` overrides win over the
// native oracle and the disagreement is recorded. Any failure leaves
// window.quickjsReport unset and sets window.quickjsError (never a pass on error).
import { createCompiler } from './compiler.js';
import { QuickJSGPU } from './runtime.js';
import { stdlibSuite } from './stdlib-gpu-suite.js';
import { nativeWorkerOutcome as nativeOutcome } from './native-worker-oracle.js';

const status = document.getElementById('status');
const focused=new URLSearchParams(location.search).get('focus')==='corrections';
const groups=focused?stdlibSuite.groups.map(g=>({...g,...Object.fromEntries(['cases','unsupported','resumption','gcCases'].map(k=>[k,g[k].filter(stdlibCorrectionFocus)]))})):stdlibSuite.groups;
const RUN = { budget: 4096, maxDispatches: 4096 };
const RESUMPTION_LIMIT = 60000;
const show = v => (Object.is(v, -0) ? '-0' : typeof v === 'string' ? JSON.stringify(v) : String(v));

const REJECTIONS = { runtime: /Unsupported/, resource: /Resource limit/ };
const isRejection = (e, kind = 'runtime') => !!e && REJECTIONS[kind].test(e.message) && /no CPU fallback/.test(e.message);

let vm;
try {
  const started = performance.now();
  const compiler = await createCompiler();
  vm = await QuickJSGPU.create();
  const features = new Set(stdlibSuite.features);
  const report = {
    backend: 'gpu', compiler: 'QuickJS/Wasm', qualificationScope:focused?'focused-corrections':'full', genericIteration: stdlibSuite.genericIteration,
    programs: 0, checked: 0, negativeChecks: { runtimeUnsupported: 0, resourceLimit: 0, compileRejected: 0 },
    resumption: [], gcProbes: [], groups: {}, nativeDisagreements: [], approximations: [], orderSensitive: [], gaps: [], failures: [],
  };
  const fail = (group, name, message) => { report.failures.push({ group, name, message }); report.groups[group].failed++; };

  // Runs one value program on the GPU, compares exactly, returns per-lane collections.
  async function valueCase(group, item, kind) {
    const counts = report.groups[group];
    if (item.requires.some(r => !features.has(r))) {
      report.gaps.push(`${item.name}: requires ${item.requires.filter(r => !features.has(r)).join(', ')} (not run, not counted)`);
      counts.skipped++; return;
    }
    if (item.requiresGenericIteration && !stdlibSuite.genericIteration) return negativeRuntime(group, item.name, item.source, item.inputs[0]);
    let expected;
    if (item.expected) {
      expected = item.expected;
      for (const [i, input] of item.inputs.entries()) {
        const n = await nativeOutcome(item.source, input);
        if ('error' in n || !Object.is(n.value, expected[i])) report.nativeDisagreements.push({ name: item.name, input: show(input), es2025: show(expected[i]), native: 'error' in n ? n.error : show(n.value), specNote: item.specNote });
      }
    } else {
      expected = [];
      for (const input of item.inputs) {
        const n = await nativeOutcome(item.source, input);
        if ('error' in n) return fail(group, item.name, `native oracle threw for input ${show(input)}: ${n.error}`);
        expected.push(n.value);
      }
    }
    let result;
    try { result = await vm.run(compiler.compile(item.source), item.inputs, RUN); }
    catch (e) { return fail(group, item.name, e.message); }
    if (!(result.backend === 'gpu' && result.done)) return fail(group, item.name, 'GPU completion required');
    report.programs++;
    let ok = true;
    item.inputs.forEach((input, i) => {
      const comparison=compareStdlibValue(result.values[i],expected[i],item.comparison);
      if(comparison.matches){
        if(comparison.approximate)report.approximations.push({name:item.name,input:show(input),gpu:show(result.values[i]),native:show(expected[i]),ulps:comparison.ulps,maxUlps:item.comparison.maxUlps,spec:item.comparison.spec});
        report.checked++;counts.values++;return;
      }
      ok = false;
      if (item.orderSensitive) {
        report.orderSensitive.push({ name: item.name, gpu: show(result.values[i]), es2025ReferenceOrder: show(expected[i]), note: item.specNote });
        report.gaps.push(`${item.name}: intrinsic property order differs from the ES2025 clause order (implementation-defined; not counted as passed)`);
      } else fail(group, item.name, `input ${show(input)}: GPU ${show(result.values[i])}, expected ${show(expected[i])}`);
    });
    if (item.requiredGC || kind === 'gc') {
      if (!Array.isArray(result.collections) || result.collections.length !== item.inputs.length) { ok = false; fail(group, item.name, 'runtime result exposes no per-lane collections counter'); }
      else if (!result.collections.every(n => n > 0)) { ok = false; fail(group, item.name, `required collection did not occur (collections ${result.collections.join(',')})`); }
      report.gcProbes.push({ name: item.name, collections: Array.from(result.collections || []), maxSteps: Math.max(...result.steps), passed: ok });
      if (ok) counts.gc++;
    }
    if (ok) counts.cases++;
  }

  async function negativeRuntime(group, name, source, input, kind = 'runtime') {
    let error, result;
    try { result = await vm.run(compiler.compile(source), [input], RUN); } catch (e) { error = e; }
    if (!isRejection(error, kind)) return fail(group, name, `expected ${kind === 'resource' ? 'Resource limit' : 'Unsupported'}/no CPU fallback rejection, got ${error ? error.message : 'value ' + show(result?.values?.[0])}`);
    report.negativeChecks[kind === 'resource' ? 'resourceLimit' : 'runtimeUnsupported']++; report.groups[group].unsupported++;
  }

  for (const group of groups) {
    report.groups[group.name] = { cases: 0, values: 0, gc: 0, unsupported: 0, resumption: 0, skipped: 0, failed: 0 };
    for (const item of group.cases) { status.textContent = `${group.name}: ${item.name}`; await valueCase(group.name, item, 'case'); }
    for (const item of group.gcCases) { status.textContent = `${group.name} GC: ${item.name}`; await valueCase(group.name, item, 'gc'); }
    for (const item of group.unsupported) {
      status.textContent = `${group.name} boundary: ${item.name}`;
      if (item.specExpected !== undefined) {
        const n = await nativeOutcome(item.source, item.input);
        if ('error' in n || !Object.is(n.value, item.specExpected)) report.nativeDisagreements.push({ name: item.name, input: show(item.input), es2025: show(item.specExpected), native: 'error' in n ? n.error : show(n.value), note: 'boundary specExpected' });
      }
      if (item.requiresGenericIteration && stdlibSuite.genericIteration) {
        // Dependency merged: the boundary becomes an ordinary value obligation.
        await valueCase(group.name, { name: item.name, source: item.source, inputs: [item.input], expected: item.specExpected === undefined ? undefined : [item.specExpected], specNote: 'ES2025 value recorded with the boundary', requires: [], requiresGenericIteration: false, orderSensitive: false, requiredGC: false }, 'case');
      } else if (item.rejection === 'compile') {
        let error; try { compiler.compile(item.source); } catch (e) { error = e; }
        if (!error || (item.expectedCompileError ? error.name!==item.expectedCompileError.name||error.message!==item.expectedCompileError.message : error.name!=='SyntaxError')) fail(group.name, item.name, `expected compile-time rejection, got ${error ? error.message : 'a compiled program'}`);
        else { report.negativeChecks.compileRejected++; report.groups[group.name].unsupported++; }
      } else await negativeRuntime(group.name, item.name, item.source, item.input, item.rejection);
    }
    for (const item of group.resumption) {
      status.textContent = `${group.name} resumption: ${item.name}`;
      const n = await nativeOutcome(item.source, item.input);
      if ('error' in n || !Object.is(n.value, item.expected)) { fail(group.name, item.name, `native resumption oracle ${'error' in n ? n.error : show(n.value)} != fixture ${show(item.expected)}`); continue; }
      let job, result, dispatches = 0;
      try {
        job = await vm.start(compiler.compile(item.source), [item.input]);
        do {
          result = await job.step(1);
          if (++dispatches > RESUMPTION_LIMIT) throw new Error(`resumption exceeded ${RESUMPTION_LIMIT} dispatches`);
          if (dispatches % 250 === 0) status.textContent = `${group.name} resumption: ${item.name} (${dispatches})`;
        } while (!result.done);
      } catch (e) { fail(group.name, item.name, e.message); continue; }
      finally { if (job) await job.dispose(); }
      if (!(result.backend === 'gpu' && Object.is(result.values[0], item.expected))) { fail(group.name, item.name, `resumption value ${show(result.values[0])}, expected ${show(item.expected)}`); continue; }
      report.programs++; report.checked++; report.groups[group.name].resumption++;
      report.resumption.push({ name: item.name, dispatches, steps: result.steps[0], collections: result.collections?.[0] });
    }
  }

  if (!stdlibSuite.genericIteration) report.gaps.push('Generic iterator protocol not merged: for-of/spread/Array.from/destructuring over Map, Set and their iterators are checked only as Unsupported (status 6) boundaries.');
  report.gaps.push('Subclassing (class extends Map/Set, Reflect.construct with another NewTarget) remains a status 6 boundary.');
  report.elapsedMs = performance.now() - started;
  report.method = 'Explicit Math fields allow at most1ULP for finite nonzero implementation-approximated results (reported separately); every other value uses exact Object.is comparison (signed zero, NaN) against fresh bounded Worker native results (5s timeout per input) or ES2025 overrides with recorded spec notes; required-GC probes need per-lane collections > 0; resumption probes run with job.step(1).';

  await vm.dispose(); vm = undefined;
  if (report.failures.length) {
    const error = new Error(`${report.failures.length} stdlib GPU check(s) failed`);
    error.report = report; throw error;
  }
  delete report.failures;
  window.quickjsReport = report;
  status.textContent = 'Passed';
  document.getElementById('report').textContent = JSON.stringify(report, null, 2);
} catch (e) {
  window.quickjsError = `${e.name}: ${e.message}\n${e.report ? JSON.stringify({ failures: e.report.failures, groups: e.report.groups, gaps: e.report.gaps }, null, 2) : e.stack || ''}`;
  status.textContent = 'Failed';
  document.getElementById('report').textContent = window.quickjsError;
} finally {
  if (vm) await vm.dispose();
}
