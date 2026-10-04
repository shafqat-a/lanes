import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {parse} from 'acorn';
import {phase4Suite} from './phase4-suite.js';
import {phase4NextGPUSuite,phase4NextResumptionIds} from './phase4-next-gpu-suite.js';
const source=readFileSync(new URL('./browser-phase4.js',import.meta.url),'utf8');
const ast=parse(source,{ecmaVersion:2025,sourceType:'module'});
const entrySource=s=>parse(s,{ecmaVersion:2025}).body[0].id.name;
const load=name=>{const node=ast.body.find(n=>n.type==='ExportNamedDeclaration'&&n.declaration?.id?.name===name).declaration;return Function('entrySource','return ('+source.slice(node.start,node.end)+')')(entrySource);};
const wrapper=load('phase4ErrorWrapper'),classify=load('phase4RuntimeBoundary'),select=load('phase4Selection');
assert.equal(select([{id:'a',area:'x'},{id:'b',area:'y'}],'?case=a&resumption=0').suite.length,1);assert.equal(select([{id:'a',area:'x'}],'?resumption=0').selection.resumption,false);assert.throws(()=>select([{id:'a',area:'x'}],'?case=b'),/matched no records/);let checked=0;
for(const c of phase4Suite().filter(c=>c.outcome.startsWith('error:'))){for(const input of c.inputs.slice(0,c.secondExpectedRecorded?2:1)){const s=wrapper(c.source,c.outcome.slice(6));assert.equal(new Script('('+s+')('+JSON.stringify(input)+')').runInNewContext({}),true,c.id);checked++;}}
for(const [body,expected] of [['throw new TypeError()',true],['throw new ReferenceError()',false],['throw 17',false],['return 17',false],['class X extends TypeError{};throw new X()',false]]){assert.equal(new Script('('+wrapper('function f(){'+body+'}','TypeError')+')(0)').runInNewContext({}),expected);checked++;}
for(const [message,expected] of [['Unsupported runtime operation in lane 0, instruction 17; no CPU fallback','unsupported'],['Resource limit in lane 2, instruction 5; no CPU fallback','resource-limited'],['Execution limit; use start()/step() to resume','resource-limited'],['Uncaught guest exception in lane 0, instruction 17; no CPU fallback',null],['driver Unsupported format',null],['Guest Error: Resource limit',null]])assert.equal(classify(message),expected);
// Exercise the complete report aggregation with a simulated backend. These
// are harness control-flow unit checks, not GPU semantics or CPU fallback.
const suite=[
 ['value-reject','value','function f(){/*reject*/return 1;}',1],
 ['value-resource','value','function f(){/*resource*/return 1;}',1],
 ['value-unsupported','value','function f(){/*unsupported*/return 1;}',1],
 ['error-wrong','error:TypeError','function f(){throw new ReferenceError();}',{error:'TypeError'}],
 ['error-right','error:TypeError','function f(){throw new TypeError();}',{error:'TypeError'}],
 ['declared-unsupported','unsupported','function f(){/*unsupported*/return 1;}',1],
 ['declared-rejected','rejected','function f(){/*reject*/return 1;}',1],
 ['declared-resource','resource-limit','function f(){/*resource*/return 1;}',1],
 ['value-right','value','function f(){return 1;}',1],
 ['gc-zero','value','function f(){return 1;}',1],
 ['gc-positive','value','function f(){/*gcpositive*/return 1;}',1],
 ['gc-partial','value','function f(){/*gcpartial*/return 1;}',1],
].map(([id,outcome,source,expected])=>({id,area:'unit',outcome,source,inputs:id==='gc-partial'?[0,1]:[0],expected:id==='gc-partial'?[expected,expected]:[expected],secondExpectedRecorded:id==='gc-partial',requiresGC:id.startsWith('gc-')}));
const elements={status:{},report:{}};const window={};
const context={URLSearchParams,window,document:{getElementById:id=>elements[id]},performance:{now:()=>0},entrySource,phase4Suite:()=>suite,phase4ResumptionIds:[],createCompiler:async()=>({compile(source){if(source.includes('/*reject*/'))throw new SyntaxError('Unsupported test feature');return source;}}),QuickJSGPU:{create:async()=>({async run(source,inputs){if(source.includes('/*resource*/'))throw Error('Resource limit in lane 0, instruction 17; no CPU fallback');if(source.includes('/*unsupported*/'))throw Error('Unsupported runtime operation in lane 0, instruction 17; no CPU fallback');return {backend:'gpu',done:true,values:inputs.map(x=>new Script('('+source+')('+x+')').runInNewContext({})),steps:inputs.map(()=>1),collections:inputs.map((_,i)=>source.includes('/*gcpositive*/')?1:source.includes('/*gcpartial*/')?(i===0?1:0):0)};},async dispose(){}})},SyntaxError,RangeError,Error};
const executable=source.replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
await new Script('(async()=>{'+executable+'})()').runInNewContext(context);
assert.equal(window.quickjsError,undefined);assert.deepEqual(JSON.parse(JSON.stringify(window.quickjsReport.counts)),{passed:3,failed:6,unsupported:1,rejected:1,'resource-limited':1});assert.equal(window.quickjsReport.outcomeViolations,6);assert.equal(elements.status.textContent,'Completed with failures');
assert.equal(window.quickjsReport.gcRequiredPrograms,3);
for(const id of ['gc-zero','gc-partial'])assert.equal(window.quickjsReport.records.find(r=>r.id===id).reason,'Required collection did not occur in every lane');
assert.deepEqual(JSON.parse(JSON.stringify(window.quickjsReport.records.find(r=>r.id==='gc-positive').laneCollections)),[1]);
let malformedChecks=0;
for(const shape of [{values:[]},{collections:[]},{collections:[-1]},{collections:[NaN]}]){
 const malformedWindow={};const malformedContext={...context,window:malformedWindow,phase4Suite:()=>suite.filter(r=>r.id==='value-right'),QuickJSGPU:{create:async()=>({run:async()=>({backend:'gpu',done:true,values:[1],steps:[1],collections:[0],...shape}),dispose:async()=>{}})}};
 await new Script('(async()=>{'+executable+'})()').runInNewContext(malformedContext);
 assert.match(malformedWindow.quickjsError,/malformed GPU result shape/);assert.equal(malformedWindow.quickjsReport,undefined);malformedChecks++;
}
const next=phase4NextGPUSuite();assert.equal(next.length,265);assert.equal(new Set(next.map(r=>r.id)).size,next.length);assert.equal(next.filter(r=>r.requiresGC).length,6);
assert.ok(next.every(r=>['value','unsupported','rejected','resource-limit'].includes(r.outcome)||/^error:(Error|TypeError|ReferenceError|RangeError|SyntaxError|URIError|EvalError)$/.test(r.outcome)));
for(const id of phase4NextResumptionIds)assert.equal(next.find(r=>r.id===id)?.outcome,'value');
assert.equal(next.find(r=>r.id==='n-global-host:global-prototype-is-object-prototype').oracleKind,'host-policy');
assert.ok(next.find(r=>r.id==='n-global-known:strict-unresolvable-created-by-rhs').diagnostics.engines);
const pressure=next.find(r=>r.id==='n-w8:probe discarded class evaluations release private names');
assert.equal(new Script(pressure.source+'\nf(2)').runInNewContext({}),301);assert.equal(pressure.expected[0],301);
console.log(JSON.stringify({guestExceptionWrapperOracleChecks:checked,anchoredClassifierChecks:6,simulatedAggregationRecords:suite.length,malformedResultChecks:malformedChecks,unexpectedBoundariesFail:true,gpuChecks:false}));
