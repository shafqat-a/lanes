import { createCompiler } from './compiler.js';
import { QuickJSGPU } from './runtime.js';
import { numberPowCases, numberPowApproximateCases, numberPowCoercionCases,
  numberPowResumptionSource, numberPowResumptionExpected } from './number-pow-cases.js';

const status = document.getElementById('status');
const inputs = [0, 1, -1, 3, 17];
const view = new DataView(new ArrayBuffer(8));
function bits(value) { view.setFloat64(0,value,true); return view.getBigUint64(0,true); }
// Host-only oracle comparison: BigInt never enters the GPU guest program.
function ulps(actual, expected) {
  if (Object.is(actual,expected)) return 0;
  if (!Number.isFinite(actual) || !Number.isFinite(expected) || actual === 0 || expected === 0 || Math.sign(actual) !== Math.sign(expected)) return Infinity;
  const a=bits(actual), b=bits(expected); return Number(a>b?a-b:b-a);
}
function nativeResult(source,input) {
  const frame=document.createElement('iframe'); frame.hidden=true; document.body.append(frame);
  try { return frame.contentWindow.Function(`return (${source})`)()(input); }
  finally { frame.remove(); }
}
function expect(condition,message) { if (!condition) throw new Error(message); }
// Keep non-finite values and the sign of zero legible in JSON evidence.
function printable(value) { return typeof value==='number' && (!Number.isFinite(value)||Object.is(value,-0)) ? (Object.is(value,-0)?'-0':String(value)) : value; }
let vm;
try {
  const started=performance.now(), compiler=await createCompiler();
  vm=await QuickJSGPU.create();
  const fixtures=[...numberPowCases,...numberPowCoercionCases,...numberPowApproximateCases];
  const results=[]; let maxUlp=0, exactChecks=0, approximateChecks=0;
  for (const [index,item] of fixtures.entries()) {
    status.textContent=`Number exponentiation ${index+1}/${fixtures.length}: ${item.feature}`;
    const tolerance=item.toleranceUlps??0;
    if (!tolerance) expect(Object.is(nativeResult(item.source,item.input),item.expected),`${item.feature}: fixed native oracle mismatch`);
    const expected=inputs.map(input=>nativeResult(item.source,input));
    let result;
    try { result=await vm.run(compiler.compile(item.source),inputs,{budget:4096,maxDispatches:4096}); }
    catch (error) { throw new Error(`${item.feature}: ${error.message}\n${item.source}`); }
    expect(result.backend==='gpu'&&result.done,`${item.feature}: GPU completion required`);
    const distances=[];
    for (let lane=0;lane<inputs.length;lane++) {
      const distance=tolerance?ulps(result.values[lane],expected[lane]):(Object.is(result.values[lane],expected[lane])?0:Infinity);
      expect(distance<=tolerance,`${item.feature}, input ${inputs[lane]}: GPU ${printable(result.values[lane])}, native ${printable(expected[lane])}, ${distance} ULP (limit ${tolerance})\n${item.source}`);
      distances.push(distance); maxUlp=Math.max(maxUlp,distance);
      if(tolerance)approximateChecks++;else exactChecks++;
    }
    results.push({index,feature:item.feature,checked:inputs.length,toleranceUlps:tolerance,distances,
      nativeValues:expected.map(printable),gpuValues:result.values.map(printable),maxSteps:Math.max(...result.steps),collections:Math.max(...result.collections)});
  }
  expect(Object.is(nativeResult(numberPowResumptionSource,3),numberPowResumptionExpected),'Fixed resumption native oracle mismatch');
  const job=await vm.start(compiler.compile(numberPowResumptionSource),[3]);
  let resumed,dispatches=0;
  try {
    do {
      resumed=await job.step(1);
      if(++dispatches>50000)throw new Error('Number exponentiation resumption instruction limit');
      if(dispatches%100===0)status.textContent=`Exponentiation coercion/kernel resumption: ${dispatches} dispatches`;
    } while(!resumed.done);
  } finally { await job.dispose(); }
  expect(resumed.backend==='gpu'&&Object.is(resumed.values[0],numberPowResumptionExpected),`Resumption mismatch: ${resumed.values[0]}, expected ${numberPowResumptionExpected}`);
  await vm.dispose(); vm=undefined;
  window.quickjsReport={backend:'gpu',compiler:'QuickJS/Wasm',programs:fixtures.length+1,checked:exactChecks+approximateChecks+1,
    exactChecks:exactChecks+1,approximateChecks,inputs,maxUlp,resumptionDispatches:dispatches,resumptionExpected:numberPowResumptionExpected,
    elapsedMs:performance.now()-started,results,nativeReference:'Fresh isolated iframe per input; exact special values/coercion, at most 2 ULP for listed implementation-approximated finite results.',
    gaps:['BigInt exponentiation and custom @@toPrimitive remain unsupported; no claim of exhaustive numerical accuracy.']};
  status.textContent='Passed'; document.getElementById('report').textContent=JSON.stringify(window.quickjsReport,null,2);
} catch(error) {
  window.quickjsError=`${error.name}: ${error.message}\n${error.stack||''}`;
  status.textContent='Failed'; document.getElementById('report').textContent=window.quickjsError;
} finally { if(vm)await vm.dispose(); }
