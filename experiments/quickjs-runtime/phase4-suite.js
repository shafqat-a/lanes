// Phase 4 conformance suite aggregator (worker 8). Pure data: no host
// evaluation happens here, so the module is safe to bundle for the browser.
// Every record is normalized to
//   { id, module, area, feature, source, inputs:[a, b], expected:[ea, eb],
//     outcome: 'value' | 'error:<Name>' | 'unsupported' | 'rejected' | 'resource-limit', ... }
// expected[0] is the fixture's own fixed expectation; expected[1] is the fixed
// literal from phase4-suite-expected.js (authored with, and re-verified by,
// check-phase4-suite.mjs against V8). Error outcomes use { error: '<Name>' }.
// For 'unsupported' / 'rejected' / 'resource-limit' records `expected` holds
// the ES2025 normative result when the fixture documents one (oracle-checked
// only); the GPU must report the outcome instead of producing a value.
//   unsupported    compile-time rejection or runtime 'Unsupported runtime operation'
//   rejected       compile-time rejection (compiler.compile throws)
//   resource-limit runtime 'Resource limit' (compile-time rejection = pending)
import { phase4RegressionCases, phase4NegativeCases, phase4ExplicitUnsupportedCases } from './phase4-regression-cases.js';
import { templateCases, templateTypeErrorCases, templateResourceLimitCases, templateRejectedCases } from './template-cases.js';
import { taggedTemplateCases, taggedTemplateTypeErrorCases, taggedTemplateThrowCases, taggedTemplateUnsupportedCases, taggedTemplateLimitCases, taggedTemplateRejectedCases } from './phase4-template-tagged-cases.js';
import { spreadCases, spreadTypeErrorCases, spreadUnsupportedCases, spreadResourceCases } from './phase4-spread-cases.js';
import { objectSpreadCases, objectSpreadTypeErrorCases } from './phase4-object-spread-cases.js';
import { iterationCases, iterationUnsupportedCases, iterationTypeErrorCases } from './phase4-iteration-cases.js';
import { forInCases, lexicalCases, forInTypeErrorCases, lexicalReferenceErrorCases } from './phase4-for-in-cases.js';
import { classCases, classTypeErrorCases, classUnsupportedCases, classRejectedCases, classAdmittedElementCases } from './phase4-class-cases.js';
import { classElementCases, classElementErrorCases, classElementUnsupportedCases, classElementRejectedCases } from './phase4-class-element-cases.js';
import { w3StaticCases, w3StaticErrorCases, w3StaticEarlyErrorCases, w3StaticUnsupportedCases, w3StaticRejectedCases } from './phase4-next-w3-cases.js';
import { w7NextCases, w7NextErrorCases, w7NextUnsupportedCases, w7NextRejectedCases } from './phase4-next-w7-cases.js';
import { edgeCases, edgeTypeErrorCases, edgeUnsupportedCases } from './phase4-edge-cases.js';
import { phase4SecondExpected } from './phase4-suite-expected.js';

// [tag, defaultArea, kind, cases]. kind: 'value' (fixed primitive
// expectations; per-item outcome/requiresSymbol/expectedStatus still apply),
// 'negative', 'unsupported', 'rejected', 'resource-limit'.
const sources = [
  ['w8', 'regression', 'value', phase4RegressionCases],
  ['w8', 'regression', 'negative', phase4NegativeCases],
  ['w8', 'unsupported', 'unsupported', phase4ExplicitUnsupportedCases],
  ['w1-template', 'template', 'value', templateCases],
  ['w1-template', 'template', 'value', templateTypeErrorCases],
  ['w1-template', 'template', 'resource-limit', templateResourceLimitCases],
  // Formerly rejected tagged templates (next wave: admitted value records).
  ['w1-template', 'template', 'value', templateRejectedCases],
  ['w2-spread', 'spread', 'value', spreadCases],
  ['w2-spread', 'spread', 'value', spreadTypeErrorCases],
  ['w2-spread', 'spread', 'unsupported', spreadUnsupportedCases],
  ['w2-spread', 'spread', 'resource-limit', spreadResourceCases],
  ['w3-object-spread', 'object-spread', 'value', objectSpreadCases],
  ['w3-object-spread', 'object-spread', 'value', objectSpreadTypeErrorCases],
  ['w4-iteration', 'iteration', 'value', iterationCases],
  ['w4-iteration', 'iteration', 'unsupported', iterationUnsupportedCases],
  ['w4-iteration', 'iteration', 'value', iterationTypeErrorCases],
  ['w6-for-in', 'for-in', 'value', forInCases],
  ['w6-for-in', 'lexical', 'value', lexicalCases],
  ['w6-for-in', 'for-in', 'value', forInTypeErrorCases],
  ['w6-for-in', 'lexical', 'value', lexicalReferenceErrorCases],
  ['w5-class', 'class', 'value', classCases],
  ['w5-class', 'class', 'value', classTypeErrorCases],
  ['w5-class', 'class', 'unsupported', classUnsupportedCases],
  ['w5-class', 'class', 'value', classAdmittedElementCases],
  ['w5-class', 'class', 'rejected', classRejectedCases],
  // Next wave worker 1: tagged templates / String.raw. The >15-substitution
  // pack-time RangeError is a declared rejection; the 256-unit template string
  // is the existing resource-limit (GPU string limit) at compile time.
  ['n-template', 'template', 'value', taggedTemplateCases],
  ['n-template', 'template', 'value', taggedTemplateTypeErrorCases],
  ['n-template', 'template', 'value', taggedTemplateThrowCases],
  ['n-template', 'template', 'unsupported', taggedTemplateUnsupportedCases],
  ['n-template', 'template', 'rejected', [...taggedTemplateLimitCases.filter(item => /tagged template limit/.test(item.reason.source)), ...taggedTemplateRejectedCases]],
  ['n-template', 'template', 'resource-limit', taggedTemplateLimitCases.filter(item => /string limit/.test(item.reason.source))],
  // Next wave (lead, assignments 2-5): per-item `area` splits the records.
  ['n-class', 'class-fields', 'value', classElementCases],
  ['n-class', 'class-fields', 'value', classElementErrorCases],
  ['n-class', 'class-fields', 'unsupported', classElementUnsupportedCases],
  ['n-class', 'class-fields', 'rejected', classElementRejectedCases],
  // Next wave worker 3: static fields / static blocks (adversarial). Early
  // errors carry no normative value: rejected-only.
  ['n-static', 'class-static', 'value', w3StaticCases],
  ['n-static', 'class-static', 'value', w3StaticErrorCases],
  ['n-static', 'class-static', 'unsupported', w3StaticUnsupportedCases],
  ['n-static', 'class-static', 'rejected', w3StaticEarlyErrorCases],
  ['n-static', 'class-static', 'rejected', w3StaticRejectedCases],
  // Next wave worker 7: function/class metadata, new.target, super, extends.
  ['n-meta', 'function-metadata', 'value', w7NextCases],
  ['n-meta', 'function-metadata', 'value', w7NextErrorCases],
  ['n-meta', 'function-metadata', 'unsupported', w7NextUnsupportedCases],
  ['n-meta', 'function-metadata', 'rejected', w7NextRejectedCases],
  ['w7-edge', 'edge', 'value', edgeCases],
  ['w7-edge', 'edge', 'negative', edgeTypeErrorCases],
  ['w7-edge', 'edge', 'unsupported', edgeUnsupportedCases],
];

// Records whose fixed expectation intentionally differs from the V8 host
// oracle (V8 deviates from ES2025). id -> reason with a spec reference.
export const phase4NormativeDifferences = Object.freeze({
  'n-static:w3: computed static prototype field throws TypeError and earlier statics already ran':
    'ES2025 15.7.10 ClassFieldDefinitionEvaluation only evaluates the computed key; the TypeError comes from ' +
    'DefineField -> CreateDataPropertyOrThrow(F, "prototype") during ClassDefinitionEvaluation step 31 (static ' +
    'elements, in order), so `static a` runs first ("TypeError:a:<x>"). V8 throws while evaluating the key ' +
    '("TypeError::<x>"); pinned QuickJS follows the spec.',
});

// Second inputs for fixtures where input+1 changes the outcome kind (e.g. a
// value fixture whose input+1 throws). id -> second input.
export const phase4SecondInputOverrides = Object.freeze({
  // input 1 reaches `case 1` with `a` uninitialized (uncaught ReferenceError).
  'w6-for-in:switch-lexical-initialized-fallthrough': -1,
});

// Callback-heavy records the browser page also resumes one instruction per dispatch.
export const phase4ResumptionIds = Object.freeze([
  'w8:callback-getter-destructuring-loop',
  'w8:callback-map-with-spread-and-template',
  'w8:class-template-tostring-with-spread-ctor',
  'w8:template-tostring-interleaved-with-evaluation',
  'w1-template:order-getter-then-tostring-interleaved',
  // Next wave: field initializer frames, private accessors and static blocks.
  'n-class:brand precedes field initializers',
  'n-class:private getter and setter',
  'n-class:static fields and blocks run in source order after methods',
  'n-class:derived fields initialise after super() returns',
  // Worker 3: super accessor with derived receiver, setter via [[Set]] in a
  // static block, abrupt static field + outer TDZ.
  'n-static:w3: super getter in a static field receives the derived constructor as this',
  'n-static:w3: assignment in a static block uses [[Set]] and runs a static setter',
  'n-static:w3: abrupt static field leaves the outer class binding in TDZ',
]);

const primitive = v => v === null || v === undefined || ['number', 'string', 'boolean'].includes(typeof v);

function outcomeOf(item, kind) {
  if (item.requiresSymbol) return 'rejected';
  // Worker 7 uncaught-error fixtures: `expected` is the error constructor name.
  if (item.throws === true && typeof item.expected === 'string') return `error:${item.expected}`;
  if (item.outcome === 'resource' || item.expectedStatus === 3) return 'resource-limit';
  if (typeof item.outcome === 'string') return item.outcome;
  if (kind === 'rejected' || kind === 'resource-limit') return kind;
  if (kind === 'unsupported' || item.expected === 'unsupported') return 'unsupported';
  if (kind === 'negative') {
    if (typeof item.error === 'string') return `error:${item.error}`;
    if (primitive(item.expected)) return 'value';
    if (item.expected && typeof item.expected.error === 'string') return `error:${item.expected.error}`;
    return 'error:TypeError';
  }
  return 'value';
}

// Normative ES2025 result for input 1, or the NONE marker when undocumented.
const NONE = Symbol('no normative expectation');
function firstExpected(item, outcome) {
  if (outcome === 'value') return item.expected;
  if (outcome.startsWith('error:')) return { error: outcome.slice(6) };
  if ('normative' in item) return item.normative;
  if ('oracle' in item) return item.oracle;
  if (item.v8 === 'TypeError') return { error: 'TypeError' };
  if (item.expected !== 'unsupported' && primitive(item.expected) && item.expected !== undefined) return item.expected;
  return NONE;
}

export function phase4Suite() {
  const records = [], ids = new Set();
  for (const [tag, defaultArea, kind, cases] of sources) {
    for (const item of cases) {
      const id = `${tag}:${item.feature}`;
      if (ids.has(id)) throw new Error(`Duplicate Phase 4 suite id ${id}`);
      ids.add(id);
      const outcome = outcomeOf(item, kind), first = firstExpected(item, outcome);
      const hasSecond = Object.hasOwn(phase4SecondExpected, id);
      records.push(Object.freeze({
        id, module: tag, area: item.area || defaultArea, feature: item.feature, source: item.source,
        // Worker 7 uncaught fixtures throw for odd inputs only: keep the parity.
        inputs: [item.input, Object.hasOwn(phase4SecondInputOverrides, id) ? phase4SecondInputOverrides[id]
          : 'input2' in item ? item.input2 : item.input + (item.throws === true ? 2 : 1)],
        expected: [first === NONE ? undefined : first, hasSecond ? phase4SecondExpected[id] : undefined],
        hasNormative: first !== NONE, secondExpectedRecorded: hasSecond, outcome,
        dependsOn: item.dependsOn || [],
        ...(item.quickjsDeviation ? { quickjsDeviation: true } : {}),
        ...(item.reason ? { reason: item.reason } : {}), ...(item.note ? { note: item.note } : {}),
      }));
    }
  }
  return records;
}
