// Guarded staged stdlib integration. Returns source strings only; never writes.
// Refresh/review the three-way stage if any input hash changed. Do not bypass guards.
import {createHash} from 'node:crypto';
const plans={
 "experiments/quickjs-runtime/bootstrap.js": {
  "sha256": "15c80449dbfeca3e0401fbec1bbac558e53db11af49da255bd49a1de83f512c3",
  "edits": [
   {
    "start": 0,
    "count": 0,
    "lines": [
     "import { arrayFromSources, arrayFromIntrinsics } from './array-from-source.js';"
    ]
   },
   {
    "start": 32,
    "count": 0,
    "lines": [
     "import { collectionIntrinsics } from './stdlib-ids.js';",
     "import { stdlibBootstrapSources, stdlibNewIntrinsics } from './stdlib-registry.js';"
    ]
   },
   {
    "start": 58,
    "count": 0,
    "lines": [
     "  ...arrayFromIntrinsics,"
    ]
   },
   {
    "start": 75,
    "count": 0,
    "lines": [
     "  ...collectionIntrinsics,",
     "  ...stdlibNewIntrinsics,"
    ]
   },
   {
    "start": 121,
    "count": 0,
    "lines": [
     "  ...arrayFromSources,"
    ]
   },
   {
    "start": 165,
    "count": 0,
    "lines": [
     "  ...stdlibBootstrapSources,"
    ]
   }
  ]
 },
 "experiments/quickjs-runtime/boxing-cases.js": {
  "sha256": "bbfdfc7c016b2d0adec36cc0b9bb812cf29a1a5ee5adec6009bec6fe3cfecb90",
  "edits": [
   {
    "start": 13,
    "count": 0,
    "lines": [
     "  'function f(x){try{return (1).toFixed(2);}catch(e){return \"wrong guest exception\";}}',",
     "  'function f(x){try{return typeof new Number(x).toPrecision;}catch(e){return \"wrong guest exception\";}}',",
     "  'function f(x){try{return typeof Object.getOwnPropertyDescriptor(Number.prototype,\"toFixed\");}catch(e){return \"wrong guest exception\";}}',",
     ""
    ]
   },
   {
    "start": 246,
    "count": 1,
    "lines": [
     "  // toFixed/toExponential/toPrecision are implemented by the standard-library wave.",
     "  'function f(x){try{return Number.prototype.toLocaleString.call(1);}' + W + '}',"
    ]
   },
   {
    "start": 248,
    "count": 1,
    "lines": [
     "  'function f(x){try{return typeof new Number(x).toLocaleString;}' + W + '}',"
    ]
   },
   {
    "start": 251,
    "count": 1,
    "lines": [
     "  'function f(x){try{return typeof Object.getOwnPropertyDescriptor(Number.prototype,\"toLocaleString\");}' + W + '}',"
    ]
   }
  ]
 },
 "experiments/quickjs-runtime/check-math-phase5.mjs": {
  "sha256": "548912506764198a764853213be218497e218228f1a5202ade9b808216d48375",
  "edits": [
   {
    "start": 21,
    "count": 1,
    "lines": [
     "for(const [field,source] of Object.entries(mathPhase5Sources)){const native=JSON.parse(execFileSync(nativePath,[source],{encoding:'utf8'}));const raw=JSON.parse(wasm.ccall('lanes_compile','string',['string'],[source]));const entry='function f(x){return x;}';const wasmEntry=JSON.parse(wasm.ccall('lanes_compile','string',['string'],[entry])),nativeEntry=JSON.parse(execFileSync(nativePath,[entry],{encoding:'utf8'}));/* Pack as the runtime does (attachBootstrap marks only the helper root; nested helper functions capture from it). */const a=packProgram(attachBootstrap(wasmEntry,{[field]:raw}),'f'),b=packProgram(attachBootstrap(nativeEntry,{[field]:native}),'f');assert.deepEqual(a.code,b.code);assert.deepEqual(a.image,b.image);helperParity++;}"
    ]
   }
  ]
 },
 "experiments/quickjs-runtime/math-phase5-cases.js": {
  "sha256": "121af2a5d40708d3d3ea4eebd2f2d8fd7bd93a48fbb9e45987da95a056ab6bd9",
  "edits": [
   {
    "start": 31,
    "count": 1,
    "lines": [
     "export const mathPhase5UnsupportedSources=['function f(x){try{return Math.random()+x;}catch(e){return \"wrong guest catch\";}}'];"
    ]
   }
  ]
 },
 "experiments/quickjs-runtime/phase4-global-cases.js": {
  "sha256": "aef113654ecd0132def8a5e51994a8448e913660d899d8d53a60528b2a19db04",
  "edits": [
   {
    "start": 115,
    "count": 0,
    "lines": [
     "  value('global-assign-unimplemented-name', 3, 'false3', `function f(x){ globalThis['Ma' + 'p'] = x; return globalThis.propertyIsEnumerable('Map') + '' + x; }`, { spec: '19 global property attributes; original boundary promoted' }),",
     "  value('global-delete-unimplemented-name', 3, 'true3', `function f(x){ return (delete globalThis['Se' + 't']) + '' + x; }`, { spec: '19 configurable global Set; original boundary promoted' }),",
     "  value('reference-isnan', 3, 'false3', `function f(x){ return isNaN(x) + '' + x; }`, { spec: '19.2.3 isNaN; original boundary promoted' }),",
     "  // Standard-library wave: Reflect.has is implemented (was a prototypeGap(47) boundary).",
     "  value('reference-reflect', 3, 'true3', `function f(x){ return Reflect.has(globalThis, 'f') + '' + x; }`, { spec: '28.1.9 Reflect.has' }),",
     "  value('global-stdlib-bindings', 3, 'true:true:true:true:3', `function f(x){ w6s = x; return (globalThis.Map === Map) + ':' + (globalThis.Set === Set) + ':' + (globalThis.isNaN === isNaN) + ':' + (globalThis.isFinite === isFinite) + ':' + w6s; }`, { spec: '19.2.2, 19.2.3, 19.3.22, 19.3.32' }),"
    ]
   },
   {
    "start": 150,
    "count": 3,
    "lines": []
   },
   {
    "start": 154,
    "count": 2,
    "lines": [
     "  value('global-assign-unimplemented-weakmap', 3, 'unsupported', `function f(x){ globalThis['Weak' + 'Map'] = x; return globalThis.propertyIsEnumerable('WeakMap') + '' + x; }`, { normative: 'false3', mechanism: 'putProperty ownGap(65)' }),",
     "  value('global-delete-unimplemented-weakset', 3, 'unsupported', `function f(x){ return (delete globalThis['Weak' + 'Set']) + '' + x; }`, { normative: 'true3', mechanism: 'delete ownGap(65)' }),"
    ]
   },
   {
    "start": 165,
    "count": 1,
    "lines": [
     "  { feature: 'reference-decodeuri', source: `function f(x){ return decodeURI('' + x) + x; }`, reason: /Unsupported global or module reference: decodeURI/, normative: '33' },"
    ]
   }
  ]
 },
 "experiments/quickjs-runtime/phase4-global.js": {
  "sha256": "81daec55b32b206328f14bd359e1543d25cee665bd8b7ad67b9825d4d575da7f",
  "edits": [
   {
    "start": 89,
    "count": 0,
    "lines": [
     "// Standard-library wave globals (Map, Set, isNaN, isFinite): data only.",
     "import { stdlibGlobals } from './stdlib-registry.js';"
    ]
   },
   {
    "start": 131,
    "count": 0,
    "lines": [
     "  ...stdlibGlobals.map(g => ({ name: g.name, value: { builtin: g.builtin }, flags: WRITABLE | CONFIGURABLE })),"
    ]
   },
   {
    "start": 146,
    "count": 1,
    "lines": [
     "].filter(name => !stdlibGlobals.some(g => g.name === name)));"
    ]
   }
  ]
 },
 "experiments/quickjs-runtime/phase4-regression-cases.js": {
  "sha256": "72ed833c413190bb2e248722957f30e022893604927dd4ece6dcfa9b3a0365fa",
  "edits": [
   {
    "start": 354,
    "count": 2,
    "lines": [
     "  { feature: 'unsupported-map-for-of', area: 'unsupported', outcome: 'value', expected:4, input:4, normative:4,",
     "    reason: 'Original Map boundary promoted with merged generic iterator protocol',"
    ]
   }
  ]
 },
 "experiments/quickjs-runtime/program.js": {
  "sha256": "bec1c884590e81c9735939876a44215146e506f5af4e299eafe924643fdab346",
  "edits": [
   {
    "start": 0,
    "count": 0,
    "lines": [
     "import { arrayFromMetadata } from './array-from-source.js';"
    ]
   },
   {
    "start": 25,
    "count": 0,
    "lines": [
     "import { stdlibFieldNames, stdlibGlobals } from './stdlib-registry.js';",
     "const stdlibGlobalIds = new Map(stdlibGlobals.map(g => [g.name, g.builtin]));",
     "if (stdlibGlobals.length !== 4 || !['Map', 'Set', 'isNaN', 'isFinite'].every(n => stdlibGlobalIds.has(n))) throw new Error('stdlib globals drifted from program.js literal table');"
    ]
   },
   {
    "start": 65,
    "count": 0,
    "lines": [
     "// Standard-library wave names (stdlib-registry.js), appended after every earlier index.",
     "for(const name of stdlibFieldNames)if(!fieldNames.includes(name))fieldNames.push(name);",
     "for(const {name,field} of arrayFromMetadata)for(const key of [name,field])if(!fieldNames.includes(key))fieldNames.push(key);"
    ]
   },
   {
    "start": 143,
    "count": 0,
    "lines": [
     "      // Standard-library globals (ids from stdlib-registry.js; literal names for check-phase4-global.mjs).",
     "      if(root && ref.name==='Map'){add([4,stdlibGlobalIds.get('Map'),0,0]);continue;}",
     "      if(root && ref.name==='Set'){add([4,stdlibGlobalIds.get('Set'),0,0]);continue;}",
     "      if(root && ref.name==='isNaN'){add([4,stdlibGlobalIds.get('isNaN'),0,0]);continue;}",
     "      if(root && ref.name==='isFinite'){add([4,stdlibGlobalIds.get('isFinite'),0,0]);continue;}"
    ]
   }
  ]
 },
 "experiments/quickjs-runtime/shader.js": {
  "sha256": "b7e616e807dc3dcc969ad288c0a407eb6a1438f0fcc081e982ba82dd143fad35",
  "edits": [
   {
    "start": 0,
    "count": 0,
    "lines": [
     "import { arrayFromMetadata } from './array-from-source.js';"
    ]
   },
   {
    "start": 39,
    "count": 1,
    "lines": [
     "import { stdlibFunctionMetadata, stdlibConstructors, stdlibWGSLFunctions, stdlibMarkWGSL, stdlibObjectMethodWGSL, stdlibInitWGSL, stdlibConstructWGSL, stdlibCallWithoutNewWGSL, stdlibObjectView, stdlibImplementedNames } from './stdlib-registry.js';",
     "const phase5Methods=[...arrayFromMetadata,...stringCaseMetadata,...arraySortMetadata,...jsonStringifyMetadata,...arrayCopyMetadata,...numberParseMetadata,...jsonPhase5Metadata,...arrayPhase5Metadata,...stringPhase5Metadata,...numericPhase5Metadata,...stdlibFunctionMetadata];",
     "// Names still unimplemented on Math / Reflect after the standard-library wave.",
     "const mathGapNames=mathPhase5Pending.filter(name=>!stdlibImplementedNames('Math').includes(name));",
     "const reflectGapNames=['apply','construct','defineProperty','deleteProperty','get','getOwnPropertyDescriptor','getPrototypeOf','has','isExtensible','preventExtensions','set','setPrototypeOf'].filter(name=>!stdlibImplementedNames('Reflect').includes(name));"
    ]
   },
   {
    "start": 170,
    "count": 0,
    "lines": [
     "    // Standard-library collections (stdlib-collections-core.js).${stdlibMarkWGSL}"
    ]
   },
   {
    "start": 171,
    "count": 0,
    "lines": [
     "  collectionCompact(l);"
    ]
   },
   {
    "start": 322,
    "count": 1,
    "lines": [
     "  if(v.z==11u&&v.x==1000u){return V(26u,0u,4u,0u);}if(v.z==11u&&v.x==1150u){return V(29u,0u,4u,0u);}",
     "  ${stdlibObjectView.map(([id,node])=>`if(v.z==11u&&v.x==${id}u){return V(${node}u,0u,4u,0u);}`).join('')}return v;"
    ]
   },
   {
    "start": 340,
    "count": 0,
    "lines": [
     "  ${stdlibObjectView.map(([id,node])=>`if(id==${node}u){return V(${id}u,0u,11u,0u);}`).join('')}"
    ]
   },
   {
    "start": 386,
    "count": 1,
    "lines": [
     "  if(id==23u){return ${mathGapNames.map(name=>`field(l,key,${F[name]}u)`).join('||')||'false'};}",
     "  // Map.groupBy and the Map/Set @@species getters are not implemented.",
     "  if((id==${stdlibObjectView[0][1]}u||id==${stdlibObjectView[1][1]}u)&&key==(0x60000000u|${31 + phase3WellKnownNames.indexOf('species')}u)){return true;}",
     "  if(id==${stdlibObjectView[0][1]}u){return field(l,key,${F.groupBy}u);}"
    ]
   },
   {
    "start": 389,
    "count": 1,
    "lines": [
     "  if(id==47u){return ${reflectGapNames.map(name=>`field(l,key,${F[name]}u)`).join('||')||'false'};}"
    ]
   },
   {
    "start": 392,
    "count": 3,
    "lines": [
     "  // Contiguous Number.prototype gap range minus methods implemented by the standard-library wave.",
     "  return ${Array.from({length:numberGap[1]-numberGap[0]+1},(_,i)=>numberGap[0]+i).filter(i=>!stdlibImplementedNames('Number.prototype').includes(Object.keys(F).find(k=>F[k]===i))).map(i=>`field(l,key,${i}u)`).join('||')||'false'};"
    ]
   },
   {
    "start": 898,
    "count": 0,
    "lines": [
     "    ${stdlibConstructors.map(m=>`if(fnValue.x==${m.id}u){field=${F[m.field]}u;}`).join(\"\\n    \")}"
    ]
   },
   {
    "start": 958,
    "count": 0,
    "lines": [
     "    ${stdlibConstructWGSL}"
    ]
   },
   {
    "start": 1274,
    "count": 0,
    "lines": [
     "  ${stdlibObjectMethodWGSL()}",
     "  ${stdlibCallWithoutNewWGSL}"
    ]
   },
   {
    "start": 1526,
    "count": 0,
    "lines": [
     "${stdlibWGSLFunctions(phase4Context)}"
    ]
   },
   {
    "start": 1532,
    "count": 1,
    "lines": [
     "    states[l].ready=1u; states[l].pad=0u; states[l].freeHead=1u; states[l].freeCount=${L.heap-1-FIXED_RESERVED_COUNT}u;"
    ]
   },
   {
    "start": 1683,
    "count": 0,
    "lines": [
     "    // Standard-library wave: fixed nodes 66..71 and Map/Set/iterator/Reflect/Math methods (stdlib-registry.js).",
     "    ${stdlibInitWGSL(phase4Context)}"
    ]
   },
   {
    "start": 1694,
    "count": 1,
    "lines": [
     "    // states.pad: a collection requested by the Map/Set core (tombstone threshold).",
     "    if (states[l].freeCount<192u || states[l].pad!=0u) { states[l].pad=0u; collect(l); if (states[l].freeCount<192u) { states[l].status=3u; break; } }"
    ]
   }
  ]
 },
 "experiments/quickjs-runtime/validation.js": {
  "sha256": "41d7ffc21907b29a1664ae0900d1c45bdb7afa98bb505b7b1b0c7db787dbb936",
  "edits": [
   {
    "start": 11,
    "count": 2,
    "lines": [
     "  // Math is admitted, while random remains an explicit runtime gap (no entropy source).",
     "  'function f(x){return Math.random();}',"
    ]
   },
   {
    "start": 20,
    "count": 1,
    "lines": []
   }
  ]
 },
 "experiments/quickjs-runtime/phase4-classes.js": {
  "sha256": "0fc7ea052dcbb6bcb5348d6ec405c553a9b123739251e7f87ad1b5d0fe3127ef",
  "edits": [
   {
    "start": 136,
    "count": 1,
    "lines": [
     "  if(v.z==11u){return v.x==100u||v.x==200u||(v.x>=600u&&v.x<=606u)||v.x==122u||v.x==136u||v.x==137u||v.x==500u||v.x==2200u||v.x==2220u;}"
    ]
   }
  ]
 }
};
export const stdlibIntegrationFiles=Object.freeze(Object.keys(plans));
export function stdlibIntegrationPatch(original){
 const result={...original};
 for(const [file,plan] of Object.entries(plans)){
  const source=original[file];
  if(typeof source!=='string'||createHash('sha256').update(source).digest('hex')!==plan.sha256)throw new Error('Stdlib integration input drift: '+file);
  const lines=source.split('\n');
  for(const edit of [...plan.edits].reverse())lines.splice(edit.start,edit.count,...edit.lines);
  result[file]=lines.join('\n');
 }
 return result;
}
