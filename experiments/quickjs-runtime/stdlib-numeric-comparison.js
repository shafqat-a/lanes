// ES2025 permits implementation-approximated results for these Math operations.
// The project differential gate is deliberately tighter: at most ONE binary64
// ULP on specified finite nonzero numeric fields. It is not an ES-mandated bound.
// Evidence: quickjs-safari-qualified-stdlib.json has52 differing numeric fields,
// all1ULP, including extreme trig inputs. No tolerance for coercion traces,
// decimal formatting, integral/rounding methods, zero signs, infinities, or NaN.
export const mathApproximationSpec='https://tc39.es/ecma262/2025/multipage/numbers-and-dates.html#sec-math-object';
const methods=new Set(['sqrt','cbrt','exp','expm1','log','log1p','log2','log10','sin','cos','tan','atan','atan2','asin','acos','sinh','cosh','tanh','asinh','acosh','atanh','hypot']);
const composites={
 'hypot-special':{fields:[0,1,2,3,4,5,6,7,8,9],count:11},
 'hypot-pairs':{fields:[0,1],count:2},
 'atan2-pairs':{fields:[0,1,2,3,4,5],count:6},
 'atan2-coercion-order':{fields:[1],count:2},
 'unary-string-inputs':{fields:[0,3,4,5,6],count:7},
 'borrowed-numeric-methods':{fields:[0,1],count:4},
 'numeric-GC-roots':{fields:[0,2,3],count:4},
 'trig-large-reduction':{fields:[0,1,2],count:3},
};
export function stdlibComparisonContract(group,name){
 let shape;
 if(group==='protocol-integration'&&['original-math-phase5-sin-boundary','original-validation-sin-boundary'].includes(name))shape={scalar:true};
 if(group==='numeric'){
  if(name.startsWith('Math.')&&methods.has(name.slice(5)))shape={scalar:true};
  if(name==='hypot-many-arguments')shape={scalar:true};
  if(name.startsWith('unary-coercion-')&&methods.has(name.slice(15)))shape={fields:[0],count:2};
  if(composites[name])shape=composites[name];
 }
 return shape?{kind:'math-binary64-ulp',maxUlps:1,...shape,spec:mathApproximationSpec}:undefined;
}
function bits(n){const b=new ArrayBuffer(8),v=new DataView(b);v.setFloat64(0,n);return v.getBigUint64(0);}
export function ulpDistance(a,b){const aa=bits(a),bb=bits(b);return aa>=bb?aa-bb:bb-aa;}
function numeric(a,b){
 if(Object.is(a,b))return 0n;
 if(typeof a!=='number'||typeof b!=='number'||!Number.isFinite(a)||!Number.isFinite(b)||a===0||b===0||Math.sign(a)!==Math.sign(b))return null;
 return ulpDistance(a,b);
}
const tokenNumber=s=>s==='NaN'?NaN:s==='Infinity'?Infinity:s==='-Infinity'?-Infinity:s==='-0'?-0:/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?$/.test(s)?Number(s):undefined;
export function compareStdlibValue(actual,expected,contract){
 if(Object.is(actual,expected))return {matches:true,approximate:false};
 if(!contract||contract.kind!=='math-binary64-ulp'||contract.maxUlps!==1)return {matches:false};
 let pairs;
 if(contract.scalar)pairs=[[actual,expected]];
 else{
  if(typeof actual!=='string'||typeof expected!=='string')return {matches:false};
  const aa=actual.split(/([,:])/),bb=expected.split(/([,:])/);
  if(aa.length!==bb.length||aa.length!==contract.count*2-1)return {matches:false};
  pairs=[];
  for(let i=0;i<aa.length;i++){
   if(i%2||!contract.fields.includes(i/2)){if(aa[i]!==bb[i])return {matches:false};continue;}
   const a=tokenNumber(aa[i]),b=tokenNumber(bb[i]);if(a===undefined||b===undefined)return {matches:false};pairs.push([a,b]);
  }
 }
 const distances=pairs.map(([a,b])=>numeric(a,b));
 if(distances.some(d=>d===null||d>1n))return {matches:false};
 return {matches:true,approximate:true,ulps:distances.map(String)};
}
