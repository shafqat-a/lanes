// Independent next-wave fixtures omitted from the external worker's main suite.
// Required values use fixed ES2025 or explicitly labelled host-policy
// expectations. Known engine deviations remain failures until implemented.
import * as globals from './phase4-global-cases.js';
import * as conformance from './phase4-next-conformance-cases.js';
export const phase4NextResumptionIds = conformance.conformanceResumptionIds;
// Every non-resumption probe is explicitly a collection-pressure obligation.
const gcIds=new Set(conformance.conformanceProbeCases.filter(item=>!item.resumption).map(item=>`n-w8:${item.feature}`));
export function phase4NextGPUSuite() {
  const groups = [
    ['n-global', globals.globalCases, 'value'],
    ['n-global-error', globals.globalErrorCases, 'error'],
    ['n-global-host', globals.globalHostCases, 'value'],
    ['n-global-normative', globals.globalV8DeviationCases, 'value'],
    ['n-global-known', globals.globalKnownDeviationCases, 'value'],
    ['n-global-boundary', globals.globalUnsupportedCases, 'unsupported'],
    ['n-global-rejected', globals.globalRejectedCases, 'rejected'],
    ['n-w8', conformance.conformanceCases, 'value'],
    ['n-w8-error', conformance.conformanceErrorCases, 'error'],
    ['n-w8-early', conformance.conformanceEarlyErrorCases, 'rejected'],
    ['n-w8-boundary', conformance.conformanceBoundaryCases, 'unsupported'],
    ['n-w8', conformance.conformanceProbeCases, 'value'],
  ];
  const records = groups.flatMap(([tag,items,kind]) => items.map(item => ({
    id: `${tag}:${item.feature}`, area: item.area || 'global', feature: item.feature,
    source: item.source, inputs: [item.input ?? 3], expected: [item.expected],
    outcome: item.throws ? `error:${item.expected}` : (item.outcome ?? kind),
    hasNormative: ((item.outcome ?? kind) === 'value' && tag !== 'n-global-host') || !!item.throws,
    oracleKind: tag === 'n-global-host' ? 'host-policy' : 'ecmascript2025',
    requiresGC: gcIds.has(`${tag}:${item.feature}`),
    diagnostics: Object.fromEntries(Object.entries(item).filter(([key])=>!['source','feature','area','input','expected','throws'].includes(key)).map(([key,value])=>[key,value instanceof RegExp?String(value):value])),
    secondExpectedRecorded: false,
  })));
  for(const record of records){
    if(!['value','unsupported','rejected','resource-limit'].includes(record.outcome)&&!/^error:(Error|TypeError|ReferenceError|RangeError|SyntaxError|URIError|EvalError)$/.test(record.outcome))throw new Error(`Malformed next-wave outcome: ${record.id}: ${record.outcome}`);
  }
  if (new Set(records.map(r => r.id)).size !== records.length) throw new Error('Duplicate next-wave fixture');
  return records;
}
