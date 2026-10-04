import {parse} from 'acorn';
import {bigintRelationalSource,bigintEqualitySource,bigintComparisonPrimitiveSource} from './phase3-bigint-comparison.js';
import {phase3BigintParseStringSource} from './phase3-bigint-conversion-source.js';
// Test-only adapter: transforms each tested guest comparison to the actual
// guest helper. Native operators remain the independent oracle in a fresh realm.
export function comparisonHelperProgram(source){
 const ast=parse(source,{ecmaVersion:'latest'});
 function emit(node){
  if(node.type==='BinaryExpression'&&['==','!=','<','<=','>','>='].includes(node.operator)){
   const args=emit(node.left)+','+emit(node.right);
   return ['==','!='].includes(node.operator)?`__equality(${args},${node.operator==='!='})`:`__relational(${args},${['<','<=','>','>='].indexOf(node.operator)})`;
  }
  const children=Object.values(node).flatMap(v=>Array.isArray(v)?v:v&&typeof v==='object'?[v]:[]).filter(v=>v&&typeof v.type==='string').sort((a,b)=>a.start-b.start||b.end-a.end);
  let out='',cursor=node.start;for(const child of children){if(child.start<cursor)continue;out+=source.slice(cursor,child.start)+emit(child);cursor=child.end;}return out+source.slice(cursor,node.end);
 }
 return emit(ast);
}
export const comparisonHostSetup=`
function __lanesUnsupported(){throw new Error("Unsupported");}
const __lanesCall=Function.prototype.call.bind(Function.prototype.call);
const __lanesComparisonPrimitive=(${bigintComparisonPrimitiveSource});
function __lanesNumber(v){if(typeof v==="bigint"||typeof v==="symbol")throw new TypeError();return Number(v);}
const __lanesCharCodeAt=Function.prototype.call.bind(String.prototype.charCodeAt),__lanesSlice=Function.prototype.call.bind(String.prototype.slice);
function __lanesBigIntFromNumber(n){return Number.isInteger(n)?BigInt(n):undefined;}
function __lanesBigIntFromDigits(s,r,negative){let n=0n;for(const c of s)n=n*BigInt(r)+BigInt(parseInt(c,36));return negative?-n:n;}
const __lanesBigIntParseString=(${phase3BigintParseStringSource});
function __lanesBigIntNumberCompare(a,b){return a<b?-1:a>b?1:a==b?0:2;}
const __relational=(${bigintRelationalSource}),__equality=(${bigintEqualitySource});
`;
// Test-only u32-limb translation of the WGSL comparison kernel. Differential
// checks compare this word algorithm with the host's native abstract comparison;
// they do not constitute GPU execution or WGSL compilation evidence.
export function compareWordModel(a,b){
 if(Number.isNaN(b))return 2;if(b===Infinity)return -1;if(b===-Infinity)return 1;
 const neg=a<0n;let magnitude=neg?-a:a;
 if(b===0)return a===0n?0:neg?-1:1;
 const nneg=b<0;if(magnitude===0n)return nneg?1:-1;if(neg!==nneg)return neg?-1:1;
 const polarity=neg?-1:1,buffer=new ArrayBuffer(8),view=new DataView(buffer);view.setFloat64(0,b,true);const lo=view.getUint32(0,true),hi=view.getUint32(4,true),biased=(hi>>>20)&2047;
 if(biased<1023)return polarity;
 const limbs=[];while(magnitude){limbs.push(Number(magnitude&0xffffffffn));magnitude>>=32n;}
 const e=biased-1023,bits=(limbs.length-1)*32+32-Math.clz32(limbs.at(-1));
 if(bits<e+1)return -polarity;if(bits>e+1)return polarity;
 const s=[lo,(hi&0xfffff)|0x100000];
 const left=(a,n)=>n===0?a:n<32?[(a[0]<<n)>>>0,((a[1]<<n)|(a[0]>>>(32-n)))>>>0]:n<64?[0,(a[0]<<(n-32))>>>0]:[0,0];
 const right=(a,n)=>n===0?a:n<32?[((a[0]>>>n)|(a[1]<<(32-n)))>>>0,a[1]>>>n]:n<64?[a[1]>>>(n-32),0]:[0,0];
 for(let i=limbs.length-1;i>=0;i--){const shift=e-52-i*32,word=(shift>=0?left(s,shift):right(s,-shift))[0];if(limbs[i]<word)return -polarity;if(limbs[i]>word)return polarity;}
 if(e<52){const restored=left(right(s,52-e),52-e);if(restored[0]!==s[0]||restored[1]!==s[1])return -polarity;}
 return 0;
}
