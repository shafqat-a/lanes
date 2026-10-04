// Diagnostic boundaries count separately. Every admitted value/error record
// must execute correctly; unexpected rejection/unsupported/resources are failures.
import {createCompiler} from './compiler.js';
import {QuickJSGPU} from './runtime.js';
import {entrySource} from './program.js';
import {phase4Suite,phase4ResumptionIds} from './phase4-suite.js';
import {phase4NextGPUSuite,phase4NextResumptionIds} from './phase4-next-gpu-suite.js';

export function phase4ErrorWrapper(source,name){
  if(!['Error','TypeError','ReferenceError','RangeError','SyntaxError','URIError','EvalError'].includes(name))throw new Error(`Unknown declared exception class: ${name}`);
  const entry=entrySource(source);
  // Preserve a function declaration: converting the source to a named function
  // expression would change its self-name binding semantics.
  return `function phase4ExceptionProbe(input){const expectedConstructor=${name};const expectedPrototype=expectedConstructor.prototype;const getPrototypeOf=Object.getPrototypeOf;${source}\ntry{${entry}(input);return false;}catch(error){return error instanceof expectedConstructor&&getPrototypeOf(error)===expectedPrototype;}}`;
}
export function phase4RuntimeBoundary(message){
  if(/^Unsupported runtime operation in lane \d+, instruction -?\d+; no CPU fallback$/.test(message))return 'unsupported';
  if(/^Resource limit in lane \d+, instruction -?\d+; no CPU fallback$/.test(message)||message==='Execution limit; use start()/step() to resume'||message==='Program/batch exceeds GPU buffer limits'||message==='GPU string limit: 256 UTF-16 code units')return 'resource-limited';
  return null;
}
// Exact ID/area filters aid failure triage without changing default full-suite
// obligations. Every filtered report records its selection and full corpus size.
export function phase4Selection(all,search){
 const query=new URLSearchParams(search),ids=query.getAll('case'),areas=query.getAll('area');
 const selected=all.filter(r=>(ids.length===0||ids.includes(r.id))&&(areas.length===0||areas.includes(r.area)));
 if(selected.length===0)throw new Error('Phase4 selection matched no records');
 return {suite:selected,selection:{ids,areas,resumption:query.get('resumption')!=='0'},totalSuitePrograms:all.length};
}
const status=document.getElementById('status');
const show=v=>typeof v==='string'?JSON.stringify(v):String(v);
let vm;
try{
 const search=globalThis.location?.search||'',next=new URLSearchParams(search).get('suite')==='next';
 const suiteName=next?'phase4-next-independent':'phase4',resumptionIds=next?phase4NextResumptionIds:phase4ResumptionIds;
 const started=performance.now(),{suite,selection,totalSuitePrograms}=phase4Selection(next?phase4NextGPUSuite():phase4Suite(),search),compiler=await createCompiler();vm=await QuickJSGPU.create();
 const counts={passed:0,failed:0,unsupported:0,rejected:0,'resource-limited':0},records=[],outcomeViolations=[],programs=new Map();let checkedValues=0;
 for(const record of suite){
  const {id,area,source,outcome}=record;
  status.textContent=`Phase4 ${records.length+1}/${suite.length}: ${id}`;
  const inputs=record.secondExpectedRecorded?record.inputs:record.inputs.slice(0,1);
  let entry={id,area,outcome,inputs,requiresGC:!!record.requiresGC,...(record.oracleKind?{oracleKind:record.oracleKind}:{}),...(record.diagnostics?{diagnostics:record.diagnostics}:{})},program;
  try{program=compiler.compile(outcome.startsWith('error:')?phase4ErrorWrapper(source,outcome.slice(6)):source);}
  catch(error){
   // A backend/compiler fault is not an expected unsupported language feature.
   const compileResource=error instanceof RangeError&&error.message==='GPU string limit: 256 UTF-16 code units';
   const rejection=!compileResource&&(error instanceof SyntaxError||error instanceof RangeError);
   const declared=compileResource?outcome==='resource-limit':rejection&&(outcome==='rejected'||outcome==='unsupported');
   const observed=compileResource?'resource-limited':'rejected';
   entry={...entry,status:declared?observed:'failed',observedStatus:observed,stage:'compile',error:`${error.name}: ${error.message}`,asDeclared:declared};
   if(!declared)outcomeViolations.push({id,reason:`expected ${outcome}; compilation failed`});
   counts[entry.status]++;records.push(entry);continue;
  }
  if(outcome==='rejected'){
   entry={...entry,status:'failed',stage:'compile',observedStatus:'compiled',asDeclared:false};
   outcomeViolations.push({id,reason:'expected compile rejection; compilation succeeded'});counts.failed++;records.push(entry);continue;
  }
  let result,error;
  try{result=await vm.run(program,inputs,{budget:4096,maxDispatches:4096});}catch(caught){error=caught;}
  if(result){
   if(result.backend!=='gpu'||!result.done)throw new Error(`${id}: completed GPU execution required`);
   if(!Array.isArray(result.values)||result.values.length!==inputs.length||!Array.isArray(result.collections)||result.collections.length!==inputs.length||result.collections.some(n=>!Number.isInteger(n)||n<0))throw new Error(`${id}: malformed GPU result shape`);
   const expected=outcome.startsWith('error:')?inputs.map(()=>true):record.expected;
   const admitted=outcome==='value'||outcome.startsWith('error:');
   const bad=admitted?inputs.findIndex((_,i)=>!Object.is(result.values[i],expected[i])):0;
   const gcMissing=!!record.requiresGC&&result.collections.some(n=>n===0);
   if(admitted&&bad<0&&!gcMissing){
    entry={...entry,status:'passed',values:result.values,maxSteps:Math.max(...result.steps),collections:Math.max(...result.collections),laneCollections:Array.from(result.collections),...(outcome.startsWith('error:')?{errorNameVerified:true,exceptionClass:outcome.slice(6)}:{})};
    checkedValues+=inputs.length;if(outcome==='value')programs.set(id,program);
   }else{
    entry={...entry,status:'failed',input:inputs[bad],actual:show(result.values[bad]),expected:admitted?show(expected[bad]):outcome,...(gcMissing?{reason:'Required collection did not occur in every lane',laneCollections:Array.from(result.collections)}:{})};
    outcomeViolations.push({id,reason:admitted&&bad>=0?'GPU result/exception identity mismatch':gcMissing?'Required collection did not occur in every lane':admitted?'GPU result/exception identity mismatch':`expected ${outcome}; GPU produced value`});
   }
  }else{
   const message=error?.message||'Execution returned neither result nor error';const observed=phase4RuntimeBoundary(message);
   const declared=observed==='unsupported'?outcome==='unsupported':observed==='resource-limited'?outcome==='resource-limit':false;
   entry={...entry,status:declared?observed:'failed',observedStatus:observed||'error',stage:'runtime',error:message,asDeclared:declared};
   if(!declared)outcomeViolations.push({id,reason:`expected ${outcome}; got ${observed||'runtime error'}`});
  }
  counts[entry.status]++;records.push(entry);
 }
 const resumptions=[];
 const requestedResumptions=selection.resumption?resumptionIds.filter(id=>suite.some(r=>r.id===id)):[];
 for(const id of requestedResumptions){
  const record=suite.find(r=>r.id===id),program=programs.get(id);
  if(!record||!program){resumptions.push({id,status:'failed',reason:record?'required value record did not pass':'record missing'});continue;}
  const index=record.secondExpectedRecorded?1:0,input=record.inputs[index],expected=record.expected[index];let result,dispatches=0,failure;
  const job=await vm.start(program,[input]);
  try{do{result=await job.step(1);if(++dispatches>60000)throw new Error('Resumption exceeded instruction bound');if(dispatches%200===0)status.textContent=`${id}: resumption ${dispatches}`;}while(!result.done);}catch(error){failure=error.message;}finally{await job.dispose();}
  const ok=!failure&&result?.backend==='gpu'&&Object.is(result.values[0],expected);
  resumptions.push({id,input,expected:show(expected),actual:result?show(result.values[0]):undefined,dispatches,status:ok?'passed':'failed',...(failure?{error:failure}:{})});
 }
 await vm.dispose();vm=undefined;
 const perArea={};for(const r of records){const a=perArea[r.area]||={};a[r.status]=(a[r.status]||0)+1;}
 const resumptionFailures=resumptions.filter(r=>r.status==='failed').length;
 window.quickjsReport={backend:'gpu',compiler:'QuickJS/Wasm (generated/compiler.mjs)',suite:suiteName,programs:suite.length,totalSuitePrograms,selection,resumptionRequested:requestedResumptions.length,counts,checkedValues,gcRequiredPrograms:suite.filter(r=>r.requiresGC).length,outcomeViolations:outcomeViolations.length,perArea,pendingIntegration:0,resumptionPrograms:resumptions.filter(r=>r.status==='passed').length,resumptionFailures,elapsedMs:performance.now()-started,outcomeViolationDetails:outcomeViolations,resumptions,failures:records.filter(r=>r.status==='failed'),records,method:'Fixed value expectations; guest try/catch verifies exact expected exception prototype; unexpected compiler/runtime boundaries fail. Explicit unsupported/rejected/resource records remain separate from semantic passes. Required callback records resume one instruction per dispatch; collection-pressure probes require a positive collection count in every lane.'};
 status.textContent=counts.failed||outcomeViolations.length||resumptionFailures?'Completed with failures':'Declared outcomes verified';
 document.getElementById('report').textContent=JSON.stringify({...window.quickjsReport,records:undefined},null,2);
}catch(error){window.quickjsError=`${error.name}: ${error.message}\n${error.stack||''}`;status.textContent='Failed';document.getElementById('report').textContent=window.quickjsError;}
finally{if(vm)await vm.dispose();}
