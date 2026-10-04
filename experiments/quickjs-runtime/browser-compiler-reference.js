import { compilerCorrectnessCases } from './compiler-correctness-cases.js';
import { compilerReviewCases } from './compiler-review-cases.js';
const status = document.getElementById('status');
const identitySources = [
  ['captured-tdz-throwing-rhs-identity', 'function f(x){let trace="";function rhs(){trace+="r";throw x;}function write(){k=rhs();}try{write();}catch(e){return trace+":"+typeof e+":"+(e===x)+":"+(e instanceof ReferenceError)+":"+(e instanceof TypeError);}const k=1;return "missed";}'],
  ['local-tdz-throwing-rhs-identity', 'function f(x){let trace="";function rhs(){trace+="r";throw x;}try{k=rhs();}catch(e){return trace+":"+typeof e+":"+(e===x)+":"+(e instanceof ReferenceError)+":"+(e instanceof TypeError);}const k=1;return "missed";}'],
  ['captured-tdz-successful-rhs-identity', 'function f(x){let trace="";function rhs(){trace+="r";return x;}function write(){k=rhs();}try{write();}catch(e){return trace+":"+typeof e+":"+(e===x)+":"+(e instanceof ReferenceError)+":"+(e instanceof TypeError);}const k=1;return "missed";}'],
  ['captured-initialized-const-throwing-rhs-identity', 'function f(x){const k=1;let trace="";function rhs(){trace+="r";throw x;}function write(){k=rhs();}try{write();}catch(e){return trace+":"+typeof e+":"+(e===x)+":"+(e instanceof ReferenceError)+":"+(e instanceof TypeError);}return "missed";}'],
];
function oracle(source, input) {
  const frame = document.createElement('iframe'); frame.hidden = true; document.body.append(frame);
  try { return { value: frame.contentWindow.Function(`return (${source})`)()(input) }; }
  catch (error) { return { threw: error.name, message: error.message }; }
  finally { frame.remove(); }
}
try {
  const records = [...compilerCorrectnessCases, ...compilerReviewCases].map(({feature,source,input,expected}) => {
    const values = [oracle(source,input), oracle(source,input+1)];
    return { feature, inputs:[input,input+1], fixedExpected:expected, native:values, baseMatchesFixed:!values[0].threw && Object.is(values[0].value,expected) };
  });
  const identities = identitySources.map(([feature,source])=>({feature,source,inputs:[7,8],native:[oracle(source,7),oracle(source,8)]}));
  window.quickjsReport = { backend:'native-reference',gpuExecuted:false,diagnostic:true,fixturePrograms:records.length,baseMismatches:records.filter(record=>!record.baseMatchesFixed).length,records,identities };
  status.textContent = 'Reference diagnostics complete';document.getElementById('report').textContent=JSON.stringify(window.quickjsReport,null,2);
} catch(error) { window.quickjsError=`${error.name}: ${error.message}\n${error.stack || ''}`;status.textContent='Failed'; }
