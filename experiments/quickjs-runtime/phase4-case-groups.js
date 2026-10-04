// Phase 4 case modules integrated by the lead: admitted programs must pack and
// have WGSL for every opcode; rejected programs must stay compiler-rejected.
// `pendingOps`: cases rejected only because of these not-yet-integrated
// opcodes are reported as pending-integration (never as passes).
// `runtime`: expected GPU outcome for admitted programs ('value' by default).
import { templateCases, templateTypeErrorCases, templateResourceLimitCases, templateRejectedCases } from './template-cases.js';
import { spreadCases, spreadTypeErrorCases, spreadUnsupportedCases, spreadResourceCases } from './phase4-spread-cases.js';
import { objectSpreadCases, objectSpreadTypeErrorCases } from './phase4-object-spread-cases.js';
import { forInCases, forInTypeErrorCases, lexicalCases, lexicalReferenceErrorCases } from './phase4-for-in-cases.js';
import { edgeCases, edgeTypeErrorCases, edgeUnsupportedCases } from './phase4-edge-cases.js';
import { classCases, classTypeErrorCases, classUnsupportedCases, classRejectedCases, classAdmittedElementCases } from './phase4-class-cases.js';
import { classElementCases, classElementErrorCases, classElementUnsupportedCases, classElementRejectedCases } from './phase4-class-element-cases.js';
import { w3StaticCases, w3StaticErrorCases, w3StaticEarlyErrorCases, w3StaticUnsupportedCases, w3StaticRejectedCases } from './phase4-next-w3-cases.js';
import { w7NextCases, w7NextErrorCases, w7NextUnsupportedCases, w7NextRejectedCases } from './phase4-next-w7-cases.js';
import { compilerCorrectnessCases } from './compiler-correctness-cases.js';
import { languageScopeCases, languageScopeRejectedCases } from './language-scope-cases.js';
import { iterationCases, iterationTypeErrorCases, iterationUnsupportedCases } from './phase4-iteration-cases.js';

// Symbol-dependent fixtures stay compiler-rejected (global Symbol) until Phase 3.
const split = items => [items.filter(item => !item.requiresSymbol), items.filter(item => item.requiresSymbol)];
const [templateTypeErrors, templateSymbolCases] = split(templateTypeErrorCases);
const outcome = (items, runtime) => items.map(item => ({ ...item, runtime }));

const languageScope = [...languageScopeCases, ...languageScopeRejectedCases];

export const phase4CaseGroups = [
  { area: 'compiler-correctness', admitted: compilerCorrectnessCases.filter(item => item.admission === 'admitted'),
    rejected: compilerCorrectnessCases.filter(item => item.admission === 'rejected') },
  // Recorded admission statuses of the directed language audit (native compiler).
  { area: 'language-scope', admitted: languageScope.filter(item => item.admission === 'admitted'),
    rejected: languageScope.filter(item => item.admission === 'rejected') },
  { area: 'template', admitted: [...templateCases, ...templateTypeErrors, ...templateRejectedCases, ...outcome(templateResourceLimitCases, 'resource-limit')],
    rejected: templateSymbolCases },
  { area: 'spread', admitted: [...spreadCases, ...spreadTypeErrorCases, ...outcome(spreadUnsupportedCases, 'unsupported'), ...outcome(spreadResourceCases, 'resource-limit')],
    rejected: [] },
  { area: 'edge', admitted: [...edgeCases, ...edgeTypeErrorCases, ...outcome(edgeUnsupportedCases.filter(item => item.admission === 'admitted'), 'unsupported')],
    rejected: edgeUnsupportedCases.filter(item => item.admission === 'rejected') },
  { area: 'class', admitted: [...classCases, ...classTypeErrorCases, ...classAdmittedElementCases, ...outcome(classUnsupportedCases, 'unsupported')], rejected: classRejectedCases },
  { area: 'class-elements', admitted: [...classElementCases, ...classElementErrorCases, ...outcome(classElementUnsupportedCases, 'unsupported')], rejected: classElementRejectedCases },
  { area: 'class-static', admitted: [...w3StaticCases, ...w3StaticErrorCases, ...outcome(w3StaticUnsupportedCases, 'unsupported')],
    rejected: [...w3StaticEarlyErrorCases, ...w3StaticRejectedCases] },
  { area: 'function-metadata', admitted: [...w7NextCases, ...w7NextErrorCases, ...outcome(w7NextUnsupportedCases, 'unsupported')], rejected: w7NextRejectedCases },
  { area: 'for-in-lexical', admitted: [...forInCases, ...forInTypeErrorCases, ...lexicalCases, ...lexicalReferenceErrorCases], rejected: [] },
  { area: 'iteration', admitted: [...iterationCases, ...iterationTypeErrorCases, ...outcome(iterationUnsupportedCases, 'unsupported')], rejected: [] },
  { area: 'object-spread', admitted: [...objectSpreadCases, ...objectSpreadTypeErrorCases], rejected: [] },
];
