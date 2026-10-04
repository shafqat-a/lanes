// Explicit, reviewable integration recipe. This module never writes files.
// Call only once generic iteration has supplied its shared IteratorPrototype.
export function generatorIntegrationPatch(original,{iteratorPrototypeNode,toStringTagNode=42}={}) {
 if(!Number.isInteger(iteratorPrototypeNode))throw new Error('Shared IteratorPrototype node required');
 const files={...original};
 function replace(file,old,next){const s=files[file];if(typeof s!=='string'||s.split(old).length!==2)throw new Error(`Generator patch anchor drift: ${file}: ${old.slice(0,90)}`);files[file]=s.replace(old,next);}
 function prepend(file,text){files[file]=text+files[file];}
 prepend('program.js',"import {generatorDelegationSources} from './generator-delegation-source.js';\n");
 prepend('program.js',"import {generatorFields,GENERATOR_KIND_BIT} from './generator-source.js';\n");
 replace('program.js','export const FIELDS =','for(const name of [...generatorFields,...Object.keys(generatorDelegationSources)])if(!fieldNames.includes(name))fieldNames.push(name);\nexport const FIELDS =');
 replace('program.js','fn.kind !== 0)','(fn.kind !== 0 && fn.kind !== 1))');
 replace('program.js','uses a generator/async kind','uses an async kind');
 replace('program.js','fn.refs.length | (fn.hasPrototype << 16) |','fn.refs.length | (fn.hasPrototype << 16) | (fn.kind === 1 ? GENERATOR_KIND_BIT : 0) |');
 prepend('bootstrap.js',"import {generatorDelegationSources} from './generator-delegation-source.js';\n");
 replace('bootstrap.js','  ...protocolBootstrapSources,','  ...protocolBootstrapSources,\n  ...generatorDelegationSources,');
 prepend('phase4-registry.js',"import {generatorDelegationOpcodes,generatorDelegationLowering,generatorDelegationBuiltinFields,generatorDelegationContinuations,generatorDelegationCasesWGSL} from './generator-delegation-source.js';\n");
 prepend('phase4-registry.js',"import {generatorOpcodes,generatorWGSLFunctions,generatorWGSLCases} from './generator-source.js';\n");
 replace('phase4-registry.js','...globalReferenceOpcodes]);','...globalReferenceOpcodes, ...generatorOpcodes,...generatorDelegationOpcodes]);');
 replace('phase4-registry.js','export const phase4WGSLFunctions = context => ','export const phase4WGSLFunctions = context => generatorWGSLFunctions(context) + ');
 replace('phase4-registry.js','export function phase4Lowering(op, instruction, previous) {','export function phase4Lowering(op, instruction, previous) {\n  const delegation=generatorDelegationLowering(op,instruction);if(delegation)return delegation;\n  if(generatorOpcodes.includes(op))return {op,a:0,b:0};');
 replace('phase4-registry.js','    ...globalReferenceWGSLCases(context),','    ...globalReferenceWGSLCases(context),\n    ...generatorWGSLCases(context),\n    ...generatorDelegationCasesWGSL(context),');
 replace('phase4-registry.js','...protocolBuiltinFields });','...protocolBuiltinFields,...generatorDelegationBuiltinFields });');
 replace('phase4-registry.js','...protocolContinuations()];','...protocolContinuations(),...generatorDelegationContinuations(context)];');
 // Ordinary and private generator methods are synchronous function kind 1.
 replace('phase4-class-elements.js','(node.value.async || node.value.generator)','node.value.async');
 replace('phase4-class-elements.js',"return 'Unsupported async or generator class method';","return 'Unsupported async class method';");
 prepend('shader.js',"import {generatorGCWGSL,generatorClosureWGSL,generatorInitWGSL,generatorMetadata} from './generator-source.js';\n");
 replace('shader.js','    if(node.kind==34u){markValue(l,node.value);mark(l,node.key);}',
  '    if(node.kind==34u){markValue(l,node.value);mark(l,node.key);}\n    ${generatorGCWGSL}');
 replace('shader.js','  return V(id,0u,5u,0u);\n}\nfn keyOf','  ${generatorClosureWGSL({F})}\n  return V(id,0u,5u,0u);\n}\nfn keyOf');
 replace('shader.js','fn finish(l:u32,result:V) {','fn finish(l:u32,completionValue:V) {\n  let result=generatorBeforeFinish(l,completionValue);if(states[l].status!=0u){return;}');
 replace('shader.js','      depth--;\n    }\n  }\n  states[l].depth=depth;', '      generatorUnwind(l,states[l].frames[depth].env);depth--;\n    }\n  }\n  states[l].depth=depth;');
 replace('shader.js','  if(fnValue.z==11u) {\n    var receiver=',
  '  if(fnValue.z==11u&&fnValue.x>=2500u&&fnValue.x<=2502u){\n    var generatorReceiver=undef();if(isMethod){generatorReceiver=states[l].stack[base];}\n    var generatorArgument=undef();if(argc>0u){generatorArgument=states[l].stack[base+extra];}\n    generatorResume(l,generatorReceiver,generatorArgument,fnValue.x-2500u,base,tail);return;\n  }\n  if(fnValue.z==11u) {\n    var receiver=');
 replace('shader.js','  var receiver=undef(); if (isMethod) { receiver=states[l].stack[base]; }',
  '  var receiver=undef(); if (isMethod) { receiver=states[l].stack[base]; }\n  if(generatorFunction(l,fnValue)){generatorEnter(l,fnValue,env,receiver);if(states[l].status!=0u){return;}}');
 replace('shader.js','  if(callee.z!=5u&&callee.z!=11u){states[l].status=4u;return;}',
  '  if(callee.z==11u&&callee.x==2503u){states[l].status=6u;return;}\n  if(callee.z!=5u&&callee.z!=11u){states[l].status=4u;return;}');
 replace('shader.js','    if(globalMode()){globalInit(l);}',
  '    ${generatorInitWGSL({F,iteratorPrototypeNode:'+iteratorPrototypeNode+',toStringTagNode:'+toStringTagNode+'})}\n    if(globalMode()){globalInit(l);}');
 replace('shader.js','  if(obj.z==11u&&obj.x==2000u){',
  "  ${generatorMetadata.map(m=>`if(obj.z==11u&&obj.x==${m.id}u){if(field(l,key,${F.name}u)){return image[fieldKey(${F[m.name]}u)];}if(lengthKey(l,key)){return num(fromUnsigned(${m.length}u));}if(obj.x==2503u&&field(l,key,${F.prototype}u)){return V(75u,0u,4u,0u);}states[l].status=6u;return undef();}`).join('\\n  ')}\n  if(obj.z==11u&&obj.x==2000u){");
 return files;
}
