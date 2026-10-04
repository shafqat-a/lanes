// Phase 3 shared-core contract. Guest Symbol and BigInt operations stay in the
// WGSL shader. This module only packs literals, names fields, and supplies the
// shader text. Host BigInt is not used here.
import {symbolIdentitySource} from './phase3-symbol-identity-wgsl.js';
import { appendBigIntPool } from './phase3/bigint-bridge/representation.js';
import { packBigIntLiteral } from './phase3/bigint-bridge/pack-literal.js';

export { appendBigIntPool, packBigIntLiteral };

export const PHASE3_TAG_SYMBOL = 17;
export const PHASE3_TAG_BIGINT = 18;
export const PHASE3_KIND_SYMBOL = 17;
export const PHASE3_KIND_REGISTRY = 18;
export const PHASE3_KIND_BIGINT = 19;
export const PHASE3_KIND_SYMBOL_SIDECAR = 20; // reserved, not allocated
export const PHASE3_KIND_WELL_KNOWN = 21;
export const PHASE3_SYMBOL_KEY = 0x60000000;
export const PHASE3_BIGINT_SENTINEL = 0x42490000;
export const PHASE3_MAX_LIMBS = 64;

// Fixed nodes allocated immediately after JSON (25), before the kind-13 holders.
// Holders are not hardcoded; they move up. Node 46 is the protocols table.
// Node 47 is the Reflect object added by this integration.
export const PHASE3_NODES = Object.freeze({
  symbolCtor: 26,
  symbolProto: 27,
  symbolRegistry: 28,
  bigintCtor: 29,
  bigintProto: 30,
  wellKnownFirst: 31,
  iterator: 34,
  toPrimitive: 41,
  toStringTag: 42,
  wellKnownLast: 45,
  wellKnownTable: 46,
  reflect: 47,
  lastFixed: 47,
});

export const PHASE3_BUILTINS = Object.freeze({
  Symbol: 1000,
  symbolFor: 1001,
  symbolKeyFor: 1002,
  symbolToString: 1003,
  symbolValueOf: 1004,
  symbolDescription: 1005,
  getOwnPropertySymbols: 1050,
  symbolToPrimitive: 1100,
  BigInt: 1150,
  bigintToString: 1151,
  bigintValueOf: 1152,
});

const WELL_KNOWN_NAMES = Object.freeze([
  'asyncIterator', 'hasInstance', 'isConcatSpreadable', 'iterator', 'match', 'matchAll',
  'replace', 'search', 'species', 'split', 'toPrimitive', 'toStringTag', 'unscopables',
  'dispose', 'asyncDispose',
]);

export const phase3FieldNames = Object.freeze([
  'Symbol', 'BigInt', 'symbol', 'bigint', 'for', 'keyFor', 'description', 'get description',
  'getOwnPropertySymbols', 'ownKeys', 'Reflect', '[object ', ']', '[Symbol.toPrimitive]',
  'construct', 'deleteProperty', 'has',
  ...WELL_KNOWN_NAMES,
  ...WELL_KNOWN_NAMES.map(name => `Symbol.${name}`),
]);

export const phase3WellKnownNames = WELL_KNOWN_NAMES;

// i32 operand of QuickJS push_bigint_i32. No host BigInt.
export function packI32BigInt(image, value) {
  if (!Number.isInteger(value) || value < -2147483648 || value > 2147483647) {
    throw new SyntaxError('Invalid bigint literal');
  }
  let sign = 0;
  let limbs = [];
  if (value > 0) {
    sign = 1;
    limbs = [value >>> 0];
  } else if (value < 0) {
    sign = -1;
    limbs = [value === -2147483648 ? 2147483648 : (-value) >>> 0];
  }
  const index = appendBigIntPool(image, sign, limbs);
  if (index && typeof index === 'object' && index.kind) throw new RangeError('GPU bigint limit: 64 limbs');
  return index;
}

export function packBigIntDecimal(image, decimal) {
  if (typeof decimal !== 'string') throw new SyntaxError('Unsupported QuickJS constant type');
  const packed = packBigIntLiteral(decimal);
  if (packed.kind === 'syntax') throw new SyntaxError('Unsupported QuickJS constant type');
  if (packed.kind) throw new RangeError('GPU bigint limit: 64 limbs');
  const index = appendBigIntPool(image, packed.sign, packed.limbs);
  if (index && typeof index === 'object' && index.kind) throw new RangeError('GPU bigint limit: 64 limbs');
  return index;
}

function stripFunction(source, name) {
  const start = source.indexOf(`fn ${name}(`);
  if (start < 0) throw new Error(`phase3 identity WGSL is missing ${name}`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(0, start) + source.slice(i + 1);
    }
  }
  throw new Error(`phase3 identity WGSL function ${name} is unclosed`);
}

function loadIdentityWGSL() {
  let text = symbolIdentitySource;
  text = stripFunction(text, 'symbol_same_value');
  const needle = `let next_id = states[l].heap[SYMBOL_NODE_REGISTRY].value.y;
  if (next_id == 0u) { states[l].status = 3u; return 0u; }`;
  if (!text.includes(needle)) throw new Error('symbol_alloc_cell no longer matches the phase 3 integration');
  text = text.replace(needle, `var next_id = states[l].heap[SYMBOL_NODE_REGISTRY].value.y;
  if (next_id >= 31u && next_id <= 45u) { next_id = 46u; }
  if (next_id == 0u) { states[l].status = 3u; return 0u; }`);
  const bump = `states[l].heap[SYMBOL_NODE_REGISTRY].value.y = next_id + 1u;`;
  if (!text.includes(bump)) throw new Error('symbol id bump no longer matches the phase 3 integration');
  text = text.replace(bump, `var advanced = next_id + 1u;
    if (advanced >= 31u && advanced <= 45u) { advanced = 46u; }
    states[l].heap[SYMBOL_NODE_REGISTRY].value.y = advanced;`);
  if (text.includes('fn symbol_same_value(')) throw new Error('symbol_same_value was not removed from the late fragment');
  return text;
}

const identityWGSL = loadIdentityWGSL();
const symbolStructStart = identityWGSL.indexOf('struct SymbolCell {');
const symbolStructEnd = identityWGSL.indexOf('\n}\n', symbolStructStart);
if (symbolStructStart < 0 || symbolStructEnd < 0) throw new Error('SymbolCell struct missing from identity WGSL');
export const phase3SymbolStructWGSL = identityWGSL.slice(symbolStructStart, symbolStructEnd + 3);
export const phase3IdentityWGSL = identityWGSL.slice(0, symbolStructStart) + identityWGSL.slice(symbolStructEnd + 3);

// Defined before equal(). No allocation. Symbol keys are 0x60000000|cellNode
// (bit 29 inside the dynamic-string subspace). 0xC0000000 aliases integer
// indices >= 2^30. Lane 1 of a tag-18 word is 0 for zero and 1 otherwise so
// truth() can see 0n without a heap read. bigint_header accepts that bit.
export const phase3EarlyWGSL = `
fn phase3SymbolKey(key:u32)->bool { return (key&0xe0000000u)==0x60000000u && (key&0x1fffffffu)!=0u; }
fn symbol_same_value(l:u32,a:V,b:V)->bool {
  if (a.z!=17u||b.z!=17u||a.x==0u||b.x==0u) { return false; }
  if (states[l].heap[a.x].kind!=17u||states[l].heap[b.x].kind!=17u) { return false; }
  return a.x==b.x && states[l].heap[a.x].value.x==states[l].heap[b.x].value.x && states[l].heap[a.x].value.x!=0u;
}
fn bigint_header(l:u32,value:V)->u32 {
  if (value.z!=18u||value.w!=0u||value.y>1u) { states[l].status=2u; return 0u; }
  let id=value.x;
  if (id==0u||id>=2048u) { states[l].status=2u; return 0u; }
  let node=states[l].heap[id];
  if (node.kind!=19u||node.key!=0x42490000u) { states[l].status=2u; return 0u; }
  if (node.value.y>64u) { states[l].status=3u; return 0u; }
  return id;
}
fn bigint_limb(l:u32,id:u32,index:u32)->u32 {
  let node=states[l].heap[id];
  if (index>=node.value.y) { return 0u; }
  if (node.value.z==1u) { return image[node.value.w+(index>>2u)][index&3u]; }
  var chunk=node.next;
  let base=index&~3u;
  let slot=index&3u;
  for (var n=0u;n<16u&&chunk!=0u;n++) {
    let part=states[l].heap[chunk];
    if (part.kind!=19u) { states[l].status=2u; return 0u; }
    if (part.key==base) { return part.value[slot]; }
    chunk=part.next;
  }
  states[l].status=2u; return 0u;
}
fn bigint_same(l:u32,a:V,b:V)->bool {
  let left=bigint_header(l,a);
  let right=bigint_header(l,b);
  if (left==0u||right==0u||states[l].status!=0u) { return false; }
  let ls=states[l].heap[left].value;
  let rs=states[l].heap[right].value;
  if (ls.x!=rs.x||ls.y!=rs.y) { return false; }
  for (var i=0u;i<ls.y;i++) { if (bigint_limb(l,left,i)!=bigint_limb(l,right,i)) { return false; } }
  return states[l].status==0u;
}
fn phase3MagLess(l:u32,ah:u32,an:u32,bh:u32,bn:u32)->bool {
  if (an!=bn) { return an<bn; }
  var i=an;
  loop {
    if (i==0u) { break; }
    i--;
    let av=bigint_limb(l,ah,i);
    let bv=bigint_limb(l,bh,i);
    if (av<bv) { return true; }
    if (av>bv) { return false; }
  }
  return false;
}
fn phase3BigintCmp(l:u32,a:V,b:V)->i32 {
  let ah=bigint_header(l,a);
  let bh=bigint_header(l,b);
  if (ah==0u||bh==0u||states[l].status!=0u) { return 0; }
  let asg=states[l].heap[ah].value.x;
  let bsg=states[l].heap[bh].value.x;
  let an=states[l].heap[ah].value.y;
  let bn=states[l].heap[bh].value.y;
  if (asg==bsg) {
    var less=phase3MagLess(l,ah,an,bh,bn);
    var greater=phase3MagLess(l,bh,bn,ah,an);
    if (asg==0xffffffffu) { let swap=less; less=greater; greater=swap; }
    if (less) { return -1; }
    if (greater) { return 1; }
    return 0;
  }
  if (asg==0xffffffffu||bsg==1u) { return -1; }
  return 1;
}
`;

const storeLimbs = `
  var produced=0u;var first=0u;var previous=0u;
  for (var c=0u;c<16u&&produced<len&&states[l].status==0u;c++) {
    var packed=V(0u);
    for (var k=0u;k<4u;k++) { if (produced+k<len) { packed[k]=out[produced+k]; } }
    let chunk=alloc(l,19u,packed,produced,0u);
    if (chunk==0u) { return undef(); }
    if (first==0u) { first=chunk; } else { states[l].heap[previous].next=chunk; }
    previous=chunk;produced=produced+4u;
  }
  let header=alloc(l,19u,V(sign_bits,len,0u,0u),0x42490000u,first);
  if (header==0u) { return undef(); }
  return V(header,select(0u,1u,len!=0u),18u,0u);
`;

export const phase3ArithWGSL = `
fn materialize_bigint(l:u32,pool:u32)->V {
  let header=image[pool];
  if ((header.z&0xffff0000u)!=0x42490000u) { states[l].status=2u; return undef(); }
  let sign_code=header.z&3u;
  var sign_bits=0u;
  if (sign_code==1u) { sign_bits=1u; }
  else if (sign_code==2u) { sign_bits=0xffffffffu; }
  else if (sign_code!=0u) { states[l].status=2u; return undef(); }
  let length=header.y;
  if (length>64u) { states[l].status=3u; return undef(); }
  if ((sign_code==0u)!=(length==0u)) { states[l].status=2u; return undef(); }
  if (length!=0u) {
    let top=image[header.x+((length-1u)>>2u)][(length-1u)&3u];
    if (top==0u) { states[l].status=2u; return undef(); }
  }
  let id=alloc(l,19u,V(sign_bits,length,1u,header.x),0x42490000u,0u);
  if (id==0u) { return undef(); }
  return V(id,select(0u,1u,length!=0u),18u,0u);
}
fn phase3BigintNeg(l:u32,value:V)->V {
  let id=bigint_header(l,value);
  if (id==0u||states[l].status!=0u) { return undef(); }
  let node=states[l].heap[id];
  if (node.value.x==0u||node.value.y==0u) { return value; }
  var sign_bits=1u;
  if (node.value.x==1u) { sign_bits=0xffffffffu; }
  let copy=alloc(l,19u,V(sign_bits,node.value.y,node.value.z,node.value.w),0x42490000u,node.next);
  if (copy==0u) { return undef(); }
  return V(copy,1u,18u,0u);
}
fn phase3BigintSum(l:u32,a:V,b:V,flip:bool)->V {
  let ah=bigint_header(l,a);
  let bh=bigint_header(l,b);
  if (ah==0u||bh==0u||states[l].status!=0u) { return undef(); }
  let asg=states[l].heap[ah].value.x;
  let bsg=states[l].heap[bh].value.x;
  let an=states[l].heap[ah].value.y;
  let bn=states[l].heap[bh].value.y;
  if (bn==0u||bsg==0u) { return a; }
  if (an==0u||asg==0u) { if (flip) { return phase3BigintNeg(l,b); } return b; }
  var bsign=bsg;
  if (flip&&bsign==1u) { bsign=0xffffffffu; }
  else if (flip&&bsign==0xffffffffu) { bsign=1u; }
  var out:array<u32,64>;
  for (var z=0u;z<64u;z++) { out[z]=0u; }
  var sign_bits=asg;
  var len=0u;
  if (asg==bsign) {
    var carry=0u;
    let n=max(an,bn);
    if (n>64u) { states[l].status=3u; return undef(); }
    for (var i=0u;i<n;i++) {
      let av=bigint_limb(l,ah,i);
      let bv=bigint_limb(l,bh,i);
      let sum1=av+bv;
      let c1=select(0u,1u,sum1<av);
      let sum2=sum1+carry;
      let c2=select(0u,1u,sum2<sum1);
      out[i]=sum2;carry=c1+c2;
    }
    len=n;
    if (carry!=0u) {
      if (n>=64u) { states[l].status=3u; return undef(); }
      out[n]=carry;len=n+1u;
    }
  } else {
    var left=ah;var left_n=an;var right=bh;var right_n=bn;
    if (phase3MagLess(l,ah,an,bh,bn)) { left=bh;left_n=bn;right=ah;right_n=an;sign_bits=bsign; }
    var borrow=0u;
    for (var i=0u;i<left_n;i++) {
      let av=bigint_limb(l,left,i);
      let bv=bigint_limb(l,right,i);
      let need=bv+borrow;
      let need_ov=select(0u,1u,need<bv);
      out[i]=av-need;
      borrow=select(need_ov,1u,need_ov!=0u||av<need);
    }
    if (borrow!=0u) { states[l].status=2u; return undef(); }
    len=left_n;
    for (var t=0u;t<64u&&len>0u&&out[len-1u]==0u;t++) { len--; }
    if (len==0u) { sign_bits=0u; }
  }
  if (states[l].status!=0u) { return undef(); }
  ${storeLimbs}
}
fn phase3BigintAdd(l:u32,a:V,b:V)->V { return phase3BigintSum(l,a,b,false); }
fn phase3BigintSub(l:u32,a:V,b:V)->V { return phase3BigintSum(l,a,b,true); }
fn phase3BigintMul(l:u32,a:V,b:V)->V {
  let ah=bigint_header(l,a);
  let bh=bigint_header(l,b);
  if (ah==0u||bh==0u||states[l].status!=0u) { return undef(); }
  let asg=states[l].heap[ah].value.x;
  let bsg=states[l].heap[bh].value.x;
  let an=states[l].heap[ah].value.y;
  let bn=states[l].heap[bh].value.y;
  if (an==0u||bn==0u||asg==0u||bsg==0u) { return phase3BigintSum(l,a,a,true); }
  if (an+bn>65u) { states[l].status=3u; return undef(); }
  var out:array<u32,64>;
  for (var z=0u;z<64u;z++) { out[z]=0u; }
  for (var i=0u;i<an;i++) {
    let av=bigint_limb(l,ah,i);
    let a0=av&0xffffu;let a1=av>>16u;
    var carry=0u;
    for (var j=0u;j<bn;j++) {
      let idx=i+j;
      if (idx>=64u) { states[l].status=3u; return undef(); }
      let bv=bigint_limb(l,bh,j);
      let b0=bv&0xffffu;let b1=bv>>16u;
      let p00=a0*b0;let p01=a0*b1;let p10=a1*b0;let p11=a1*b1;
      let cross=p01+p10;
      let cross_ov=select(0u,1u,cross<p01);
      let add_lo=(cross&0xffffu)<<16u;
      let add_hi=(cross>>16u)+(cross_ov<<16u)+p11;
      let productLow=p00+add_lo;
      let productCarry=select(0u,1u,productLow<p00);
      var low=out[idx]+productLow;
      var c=productCarry+select(0u,1u,low<out[idx]);
      let low2=low+carry;
      c=c+select(0u,1u,low2<low);
      out[idx]=low2;
      carry=add_hi+c;
    }
    let tail=i+bn;
    if (carry!=0u) {
      if (tail>=64u) { states[l].status=3u; return undef(); }
      out[tail]=carry;
    }
  }
  var len=an+bn;
  if (len>64u) { len=64u; }
  for (var t=0u;t<64u&&len>0u&&out[len-1u]==0u;t++) { len--; }
  if (len==0u) { states[l].status=2u; return undef(); }
  var sign_bits=1u;
  if (asg!=bsg) { sign_bits=0xffffffffu; }
  if (states[l].status!=0u) { return undef(); }
  ${storeLimbs}
}
`;

export const phase3EnumWGSL = `
fn phase3SymbolThis(l:u32,receiver:V)->V {
  if (receiver.z==17u && receiver.x!=0u && states[l].heap[receiver.x].kind==17u) { return receiver; }
  if (receiver.z==4u && states[l].heap[receiver.x].kind==16u) {
    let held=states[l].heap[states[l].heap[receiver.x].value.y].value;
    if (held.z==17u) { return held; }
  }
  states[l].status=4u;
  return undef();
}
fn phase3ChainHasIterator(l:u32,start:u32)->bool {
  let key=0x60000000u|${PHASE3_NODES.iterator}u;
  var current=start;
  for (var i=0u;i<2048u&&current!=0u;i++) {
    if (findProperty(l,current,key)!=0u) { return true; }
    let kind=states[l].heap[current].kind;
    if (kind!=2u&&kind!=7u&&kind!=8u&&kind!=14u&&kind!=16u) { return false; }
    current=states[l].heap[current].value.x;
  }
  return false;
}
fn phase3SymbolArgument(l:u32,value:V)->V {
  if (value.z==7u) { return value; }
  if (value.z==17u) { states[l].status=4u; return undef(); }
  if (value.z==18u) { return primitiveText(l,value); }
  if (value.z<4u) { return primitiveText(l,value); }
  states[l].status=6u; return undef();
}
fn phase3BigintThis(l:u32,receiver:V)->V {
  if (receiver.z==18u) { return receiver; }
  if (receiver.z==4u&&states[l].heap[receiver.x].kind==16u) {
    let held=states[l].heap[states[l].heap[receiver.x].value.y].value;
    if (held.z==18u) { return held; }
  }
  states[l].status=4u; return undef();
}
fn phase3OwnSymbols(l:u32,original:V)->V {
  if (original.z==2u||original.z==3u) { states[l].status=4u; return undef(); }
  let object=objectView(l,original);
  if (original.z==5u&&states[l].heap[original.x].kind!=12u) {
    let functionIndex=states[l].heap[original.x].value.x;
    if (image[functionIndex*2u+1u].y==0u) { states[l].status=6u; return undef(); }
  }
  if (object.z==11u) { states[l].status=6u; return undef(); }
  if (object.z!=4u) {
    let empty=alloc(l,7u,V(2u,0u,0u,1u),0u,0u);
    return V(empty,0u,4u,0u);
  }
  var count=0u;var current=states[l].heap[object.x].next;
  for (var n=0u;n<2048u&&current!=0u;n++) {
    if (phase3SymbolKey(states[l].heap[current].key)) { count++; }
    current=states[l].heap[current].next;
  }
  let result=alloc(l,7u,V(2u,count,0u,1u),0u,0u);
  var slot=count;current=states[l].heap[object.x].next;
  for (var n=0u;n<2048u&&current!=0u&&states[l].status==0u;n++) {
    let node=states[l].heap[current];
    if (phase3SymbolKey(node.key)) {
      slot--;dataProperty(l,result,0x80000000u|slot,V(node.key&0x1fffffffu,0u,17u,0u),7u);
    }
    current=node.next;
  }
  return V(result,0u,4u,0u);
}
`;
