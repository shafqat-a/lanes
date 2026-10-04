import {asyncFunctionOpcodes,asyncFunctionWGSLFunctions,asyncFunctionWGSLCases} from './async-function-source.js';
import {asyncIterationOpcodes,asyncIterationLowering,asyncIterationWGSLCases,asyncIterationContinuations} from './async-iteration-source.js';
import {generatorOpcodes,generatorWGSLFunctions,generatorWGSLCases} from './generator-source.js';
import {asyncGeneratorOpcodes,asyncGeneratorWGSLFunctions,asyncGeneratorBuiltinFields} from './async-generator-source.js';
import {generatorDelegationOpcodes,generatorDelegationLowering,generatorDelegationBuiltinFields,generatorDelegationContinuations,generatorDelegationCasesWGSL} from './generator-delegation-source.js';
import { globalReferenceOpcodes, globalReferenceWGSLCases } from './phase4-global-reference.js';
// Phase 4 integration registry (lead-owned). Worker modules contribute data;
// program.js, bootstrap.js and shader.js consume it through these exports.
// New opcodes are appended after the existing OP table, so earlier opcode
// indices never change. See PHASE-4-STATUS.md for ID/kind reservations.
// Neither this module nor the worker modules may import program.js or
// shader.js (import cycle); WGSL generators receive { OP, F, L } lazily.
import { spreadProgramLowering, spreadWGSLCases, spreadBootstrapSources, spreadBuiltinFields } from './phase4-spread.js';
import { iterationOpcodeNames, iterationLoweredOps, lowerIteration, iterationBootstrapSources, iterationPrivateBuiltins, iterationBuiltinFields, iterationWGSLFunctions, iterationObjectMethodWGSL, iterationWGSLCases, iterationContinuations } from './phase4-iteration.js';
import { forInOpcodeNames, forInLowering, forInBootstrapSources, forInPrivateBuiltins, forInBuiltinFields, forInWGSLCases, forInContinuations, forInObjectMethodWGSL, forInWGSLFunctions } from './phase4-for-in.js';
import { classOpcodeNames, classWGSLCases, classWGSLFunctions } from './phase4-classes.js';
import { templateOpcodeNames, templateBootstrapSources, templateBuiltinFields, templateWGSLFunctions, templateWGSLCases } from './phase4-templates.js';
import { classElementOpcodeNames, classElementWGSLCases, classElementWGSLFunctions } from './phase4-class-elements.js';
import { lowerObjectSpread, objectSpreadWGSLCases, objectSpreadBootstrapSources, objectSpreadBuiltinFields, objectSpreadPrivateBuiltins, objectSpreadObjectMethodWGSL } from './phase4-object-spread.js';
import { globalOpcodeNames, globalWGSLFunctions, globalWGSLCases } from './phase4-global.js';
import { protocolBootstrapSources, protocolPrivateBuiltins, protocolBuiltinFields, protocolWGSLFunctions, protocolObjectMethodWGSL, protocolContinuations, protocolMarkWGSL } from './phase6-protocols/runtime.js';
export { protocolBootstrapSources };

// Spread `append` consumes the worker-4 iteration builtins (1270/1271/1273).
const spreadOps = ['rest', 'apply', 'append'];
const objectSpreadOps = ['copy_data_properties', 'to_object', 'swap2'];

// QuickJS opcode names admitted in addition to the original OP table.
export const phase4Opcodes = Object.freeze(['to_string', ...spreadOps, ...objectSpreadOps, ...iterationOpcodeNames, ...forInOpcodeNames, ...classOpcodeNames,
  // Next wave (appended; earlier indices stay stable).
  ...classElementOpcodeNames, ...templateOpcodeNames, ...globalOpcodeNames, ...globalReferenceOpcodes, ...generatorOpcodes,...generatorDelegationOpcodes,...asyncIterationOpcodes,...asyncGeneratorOpcodes,...asyncFunctionOpcodes]);

if (new Set(phase4Opcodes).size !== phase4Opcodes.length) throw new Error('Duplicate Phase 4 opcode name');

// Guest helper sources: FIELDS name -> strict guest function source.
export const phase4BootstrapSources = Object.freeze({ ...objectSpreadBootstrapSources, ...iterationBootstrapSources, ...spreadBootstrapSources, ...forInBootstrapSources, ...templateBootstrapSources });

// Private builtin names available to bootstrap helpers: name -> id.
export const phase4PrivateBuiltins = Object.freeze({ ...objectSpreadPrivateBuiltins, ...iterationPrivateBuiltins, ...forInPrivateBuiltins, ...protocolPrivateBuiltins });

// Private builtin id -> FIELDS name of the guest helper implementing it.
// Protocol fields are last. 2463 is intentionally absent (sync objectMethod).
export const phase4BuiltinFields = Object.freeze({ ...objectSpreadBuiltinFields, ...iterationBuiltinFields, ...spreadBuiltinFields, ...forInBuiltinFields, ...templateBuiltinFields, ...protocolBuiltinFields,...generatorDelegationBuiltinFields,...asyncGeneratorBuiltinFields });

// Operand packing for admitted Phase 4 opcodes. Returns {op, a, b} or null.
// Throws SyntaxError for forms that must stay compiler-rejected.
export function phase4Lowering(op, instruction, previous) {
  const delegation=generatorDelegationLowering(op,instruction);if(delegation)return delegation;
  if(generatorOpcodes.includes(op))return {op,a:0,b:0};
  const asyncIterationLowered=asyncIterationLowering(op,instruction,previous);if(asyncIterationLowered)return asyncIterationLowered;
  if(asyncGeneratorOpcodes.includes(op))return {op,a:0,b:0};
  if(asyncFunctionOpcodes.includes(op))return {op,a:0,b:0};
  if (op === 'apply_eval') return spreadProgramLowering(op, instruction, previous);
  if (spreadOps.includes(op)) return spreadProgramLowering(op, instruction, previous);
  if (objectSpreadOps.includes(op)) return { op, ...lowerObjectSpread(op, instruction.operand) };
  if (iterationLoweredOps.includes(op)) return lowerIteration(op, instruction);
  if (forInOpcodeNames.includes(op)) return forInLowering(op);
  return null;
}

// WGSL helper functions appended before main().
export const phase4WGSLFunctions = context => generatorWGSLFunctions(context) + asyncGeneratorWGSLFunctions(context) + asyncFunctionWGSLFunctions(context) + globalWGSLFunctions(context) + templateWGSLFunctions(context) + iterationWGSLFunctions(context) + forInWGSLFunctions(context) + classWGSLFunctions(context) + classElementWGSLFunctions(context) + protocolWGSLFunctions(context);

// objectMethod() dispatch lines for WGSL-implemented private builtins.
// Protocol arms (iterator slots, instanceof walk) are before id>=150.
export const phase4ObjectMethods = context => [objectSpreadObjectMethodWGSL, iterationObjectMethodWGSL, forInObjectMethodWGSL(context), protocolObjectMethodWGSL()];

// WGSL case bodies, keyed by opcode name.
export const phase4WGSLCases = context => {
  const spread = spreadWGSLCases(context), objectSpread = objectSpreadWGSLCases(context);
  return {
    ...templateWGSLCases(context),
    // ToString for template substitutions (ES2025 13.2.8.6): strings pass
    // through; every other value calls the guest toText helper (builtin 134:
    // ToPrimitive hint string, then ToString) as a resumable GPU frame.
    // PHASE 3 HOOK: tags 17/18 reach toText; it must throw TypeError for
    // Symbol and format BigInt (template-cases.js symbol fixture is gated).
    to_string: `let value=peek(l);
        if(value.z==17u){let ignored=pop(l);states[l].status=4u;break;}
        if(value.z!=7u){let ignored=pop(l);push(l,V(134u,0u,11u,0u));push(l,value);call(l,1u,false,false);}`,
    ...Object.fromEntries(spreadOps.map(name => [name, spread[name]])),
    ...Object.fromEntries(objectSpreadOps.map(name => [name, objectSpread[name]])),
    ...iterationWGSLCases(context),
    ...forInWGSLCases(context),
    ...classWGSLCases(context),
    ...classElementWGSLCases(context),
    ...globalWGSLCases(context),
    ...globalReferenceWGSLCases(context),
    ...generatorWGSLCases(context),
    ...generatorDelegationCasesWGSL(context),
    ...asyncIterationWGSLCases(context),
    ...asyncFunctionWGSLCases(context),
  };
};

// finish() continuation handlers: [{ code, body }] where body runs with
// `returned` (helper result) and `constructed` (frame receiver) in scope.
export const phase4Continuations = context => [...iterationContinuations(context), ...forInContinuations(context), ...protocolContinuations(),...generatorDelegationContinuations(context),...asyncIterationContinuations(context)];

// collect() mark arm for heap kinds 51 and 52 (iterator holder + prototype).
export const phase4MarkWGSL = () => protocolMarkWGSL();
