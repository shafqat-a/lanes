import {classifyTest262 as legacyClassify, wrapTest262 as legacyWrap, test262Variants} from './test262-harness.js';
import {upstreamHarnessSources,upstreamHarnessRevision} from './test262-upstream-harness-sources.js';
export {test262Variants,upstreamHarnessRevision};

// Reuse the existing conservative execution-context gate. Only the include
// metadata token is normalized for that gate; executed test/harness bytes are
// never rewritten. Existing exclusions and variant accounting remain intact.
export function classifyPropertyTest262(body){
 const metadata=body.match(/\/\*---([\s\S]*?)---\*\//);
 if(!metadata)return legacyClassify(body);
 const original=metadata[1];
 const include=original.match(/^includes:[ \t]*(.*)(?:\n[ \t]+[^\n]*)*/m);
 if(!include)return legacyClassify(body);
 const names=[];
 const inline=include[1].trim();
 if(inline.startsWith('[')&&inline.endsWith(']')){
  for(const name of inline.slice(1,-1).split(','))if(name.trim())names.push(name.trim().replace(/^['"]|['"]$/g,''));
 }else if(!inline){
  for(const line of include[0].split('\n').slice(1)){
   const item=line.match(/^\s+-\s+(?:([\w.$-]+)|'([\w.$-]+)'|"([\w.$-]+)")\s*$/);
   if(!item)return legacyClassify(body);names.push(item[1]??item[2]??item[3]);
  }
 }else{return legacyClassify(body);}
 if(!names.includes('propertyHelper.js'))return legacyClassify(body);
 const replacement=include[0].replace(/\bpropertyHelper\.js\b/g,'compareArray.js');
 const changed=original.slice(0,include.index)+replacement+original.slice(include.index+include[0].length);
 const normalized=body.slice(0,metadata.index)+'/*---'+changed+'---*/'+body.slice(metadata.index+metadata[0].length);
 const admission=legacyClassify(normalized);
 return admission.eligible?{...admission,includes:names}:admission;
}

export function propertyHarnessPlan(includes=[]){
 const names=['sta.js','assert.js'];
 for(const name of includes){
  if(name!=='compareArray.js'&&name!=='propertyHelper.js')throw new Error(`Unsupported Test262 include: ${name}`);
  if(!names.includes(name))names.push(name);
 }
 return names.map(name=>({name,source:upstreamHarnessSources[name],revision:upstreamHarnessRevision}));
}

export function wrapPropertyTest262(body,strict){
 const admission=classifyPropertyTest262(body);
 if(!admission.eligible)throw new Error(`Excluded Test262 source: ${admission.reason}`);
 if(!admission.modes.includes(strict))throw new Error('Requested Test262 mode not present in metadata');
 if(!admission.includes.includes('propertyHelper.js'))return legacyWrap(body,strict);
 const harness=propertyHarnessPlan(admission.includes).map(item=>item.source).join('\n');
 // Harness scripts remain sloppy even for a strict test. Nest only the test
 // body; prepend its directive without modifying its original source bytes.
 return `function adaptedTest(input) {\n${harness}\nreturn (function () {\n${strict?'"use strict";\n':''}${body}\nreturn true;\n})();\n}`;
}

// An import-compatible proposal for the existing runners. No legacy source is
// mutated by this module, and excluded tests still have test262Variants records.
export {classifyPropertyTest262 as classifyTest262,wrapPropertyTest262 as wrapTest262};
