import {privateHelperIsolationCases} from './private-helper-isolation-cases.js';
import { stringSearchNegativeSources, stringSearchResumptionSource, stringSearchResumptionExpected } from './string-search-cases.js';
import { stringSearchIntegrationNegativeSources, stringSearchIntegrationUnsupportedSources } from './string-search-integration-cases.js';
import { propertyKeyUnsupportedSources } from './property-key-negative-cases.js';
import { arrayBuiltinMetadataUnsupportedSources } from './array-builtin-metadata-cases.js';
import { arrayExtendedResumptions } from './array-extended-cases.js';
import { objectOperationResumptionSource, objectOperationResumptionExpected } from './object-operation-cases.js';
import { arraySearchResumptionSource, arraySearchResumptionExpected, arraySearchNegativeSources } from './array-search-cases.js';
import { privateBuiltins } from './bootstrap.js';
import { objectOperationUnsupportedSources } from './object-operation-cases.js';
import { arrayMethodResumptionSource } from './array-method-cases.js';
const unsupported = [
  // Math is admitted, while random remains an explicit runtime gap (no entropy source).
  'function f(x){return Math.random();}',
  ...stringSearchIntegrationUnsupportedSources,
  ...propertyKeyUnsupportedSources,
  ...arrayBuiltinMetadataUnsupportedSources,
  ...objectOperationUnsupportedSources,
  'function f(x){return Array.prototype.find.call("ab",function(){return false;});}',
  'function f(x){return Array.prototype.lastIndexOf.call(1,1);}',
  'function f(x){return Array.prototype.findLast.call(true,function(){return true;});}',
  'function f(x){return Array.fromAsync([x]);}',
  'function f(x){function C(n){this.length=n;}return Array.of.call(C,x).length;}',
  'function f(x){function g(){} return g.caller;}',
];
export async function verifyDescriptorResumption(compiler, vm) {
  const program = compiler.compile(`function f(x) {
    let order = "";
    const target = {};
    Object.defineProperty(target, {toString() { order += "k"; return "v"; }}, {
      get enumerable() { order += "e"; return true; },
      get value() { order += "v"; return x; }
    });
    return order === "kev" && target.v === x;
  }`);
  const job = await vm.start(program, [17]);
  let dispatches = 0, result;
  try {
    do {
      result = await job.step(1);
      if (++dispatches > 2000) throw new Error('Descriptor resumption exceeded instruction bound');
    } while (!result.done);
    if (result.backend !== 'gpu' || result.values[0] !== true) throw new Error('Descriptor resumption mismatch');
    return dispatches;
  } finally { await job.dispose(); }
}
export async function verifyApplyResumption(compiler, vm) {
  const program = compiler.compile(`function f(x) {
    let order = "";
    function target(a, b) { order += "c"; return a; }
    const value = target.apply(null, {
      get length() { order += "l"; return 2; },
      get 0() { order += "0"; return x; },
      get 1() { order += "1"; return 42; }
    });
    return order === "l01c" && value === x;
  }`);
  const job = await vm.start(program, [17]);
  let dispatches = 0, result;
  try {
    do {
      result = await job.step(1);
      if (++dispatches > 2000) throw new Error('Apply resumption exceeded instruction bound');
    } while (!result.done);
    if (result.backend !== 'gpu' || result.values[0] !== true) throw new Error('Apply resumption mismatch');
    return dispatches;
  } finally { await job.dispose(); }
}
export async function verifyFailures(compiler, vm) {
  // Guest Error objects cross the host boundary as uncaught completions, not host Error instances.
  // Verify their identity in the guest realm before checking uncaught propagation below.
  const typedSearchFailures = [...arraySearchNegativeSources.slice(0, 8), ...stringSearchNegativeSources.slice(0, 5), ...stringSearchIntegrationNegativeSources];
  for (const source of typedSearchFailures) {
    const wrapped = `function check(x) { try { (${source})(x); } catch (error) { return error instanceof TypeError; } return false; }`;
    const result = await vm.run(compiler.compile(wrapped), [0]);
    if (result.backend !== 'gpu' || result.values[0] !== true)
      throw new Error(`Expected guest TypeError for ${source}`);
  }
  const cases = [
    ...privateHelperIsolationCases.map(c=>({source:c.unresolved,inputs:[0],error:'ReferenceError'})),
    // String helpers throw guest TypeError objects; the host boundary reports
    // an uncaught guest completion after identity is checked above.
    ...[...stringSearchNegativeSources, ...stringSearchIntegrationNegativeSources].map(source => ({ source, inputs: [0], error: 'Uncaught guest exception' })),
    ...unsupported.map(source => ({ source, inputs: [0], error: 'Unsupported' })),
    ...arraySearchNegativeSources.slice(0, 8).map((source, index) => ({ source, inputs: [0], error: index < 3 ? 'TypeError' : 'Uncaught guest exception' })),
    { source: 'function f(x){return x();}', inputs: [1], error: 'TypeError' },
    { source: 'function f(x){function g(){}return g.apply(null,{length:17});}', inputs: [0], error: 'Resource' },
    { source: 'function f(x){return x+x;}', inputs: ['a'.repeat(129)], error: 'Resource' },
    { source: 'function f(x){return f(x);}', inputs: [0], error: 'Resource' },
  ];
  for (const { source, inputs, error } of cases) {
    let failure;
    const program = compiler.compile(source);
    try { await vm.run(program, inputs); }
    catch (caught) { failure = caught; }
    if (!failure || !failure.message.includes(error))
      throw new Error(`Expected ${error} for ${source}; got ${failure?.message || 'successful execution'}`);
  }
  const rejectedSources = [
    ...Object.keys(privateBuiltins).filter(name=>name.startsWith('__lanes')).map(name => `function f(x){return ${name}(x);}`),
  ];
  for (const source of rejectedSources) {
    let failure;
    try { compiler.compile(source); }
    catch (caught) { failure = caught; }
    if (!failure?.message.includes('Unsupported')) throw new Error(`Unsupported source was admitted: ${source}`);
  }
  // Nonreserved helper spellings are ordinary user names, not capabilities.
  // Missing globals throw ReferenceError; nested and local bindings stay legal.
  for(const item of privateHelperIsolationCases){
    const result=await vm.run(compiler.compile(item.isolated),[0]);
    if(result.backend!=='gpu'||result.values[0]!==true)throw new Error(`Private helper isolation failed: ${item.name}`);
  }
  return cases.length + rejectedSources.length + typedSearchFailures.length + privateHelperIsolationCases.length;
}

export async function verifyNumericResumption(compiler, vm) {
  const program = compiler.compile(`function f(x) {
    let order = "";
    const a = { valueOf() { order += "a"; return x; } };
    const b = { valueOf() { order += "b"; return 2; } };
    const result = -(a * b);
    let postfix = { valueOf() { order += "p"; return x; } };
    const old = postfix++;
    let local = { valueOf() { order += "l"; return x; } };
    local--;
    const relation = {valueOf() {order += "r"; return x;}} > 2;
    const equality = {valueOf() {order += "e"; return x;}} == x;
    return order === "abplre" && result === -34 && old === 17 && postfix === 18 && local === 16 && relation && equality;
  }`);
  const job = await vm.start(program, [17]);
  let dispatches = 0, result;
  try {
    do {
      result = await job.step(1);
      if (++dispatches > 2000) throw new Error('Numeric resumption exceeded instruction bound');
    } while (!result.done);
    if (result.backend !== 'gpu' || result.values[0] !== true) throw new Error('Numeric resumption mismatch');
    return dispatches;
  } finally { await job.dispose(); }
}

export async function verifyErrorResumption(compiler, vm) {
  const program = compiler.compile(`function f(x) {
    let order = "";
    const error = new TypeError({toString() {order += "m"; return "message";}}, {
      get cause() {order += "c"; return x;}
    });
    const text = Error.prototype.toString.call({
      get name() {order += "n"; return "Name";},
      get message() {order += "t"; return error.message;}
    });
    return order === "mcnt" && text === "Name: message" && error.cause === x;
  }`);
  const job = await vm.start(program, [17]);
  let dispatches = 0, result;
  try {
    do {
      result = await job.step(1);
      if (++dispatches > 2500) throw new Error('Error resumption exceeded instruction bound');
    } while (!result.done);
    if (result.backend !== 'gpu' || result.values[0] !== true) throw new Error('Error resumption mismatch');
    return dispatches;
  } finally { await job.dispose(); }
}

export async function verifyArrayMethodResumption(compiler, vm) {
  const job = await vm.start(compiler.compile(arrayMethodResumptionSource), [17]);
  let dispatches = 0, result;
  try {
    do {
      result = await job.step(1);
      if (++dispatches > 5000) throw new Error('Array method resumption exceeded instruction bound');
    } while (!result.done);
    if (result.backend !== 'gpu' || result.values[0] !== 'lvg0529') throw new Error('Array method resumption mismatch');
    return dispatches;
  } finally { await job.dispose(); }
}

export async function verifyArraySearchResumption(compiler, vm) {
  const job = await vm.start(compiler.compile(arraySearchResumptionSource), [17]);
  let dispatches = 0, result;
  try {
    do {
      result = await job.step(1);
      if (++dispatches > 20000) throw new Error('Array search resumption exceeded instruction bound');
    } while (!result.done);
    if (result.backend !== 'gpu' || result.values[0] !== arraySearchResumptionExpected)
      throw new Error('Array search resumption mismatch');
    return dispatches;
  } finally { await job.dispose(); }
}

export async function verifyExtendedBuiltinResumption(compiler, vm) {
  const cases = [...arrayExtendedResumptions, { name: 'stringSearch', source: stringSearchResumptionSource, expected: stringSearchResumptionExpected }, { name: 'objectOperations', source: objectOperationResumptionSource, expected: objectOperationResumptionExpected }];
  const dispatches = {};
  for (const {name, source, expected} of cases) {
    const job = await vm.start(compiler.compile(source), [17]);
    let count = 0, result;
    try {
      do { result = await job.step(1); if (++count > 20000) throw new Error(`${name} resumption exceeded bound`); } while (!result.done);
      if (result.backend !== 'gpu' || !Object.is(result.values[0], expected)) throw new Error(`${name} resumption mismatch`);
      dispatches[name] = count;
    } finally { await job.dispose(); }
  }
  return dispatches;
}
