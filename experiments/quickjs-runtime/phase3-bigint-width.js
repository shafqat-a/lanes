// ES2025 BigInt.asIntN / asUintN. Guest sources perform ToIndex followed by
// ToBigInt (which intentionally rejects Number, unlike public BigInt()).
const source=signed=>`function bigint${signed?'AsIntN':'AsUintN'}Bootstrap(bits,value){"use strict";
 let count=__lanesNumber(bits);
 if(count!==count||count===0)count=0;else if(count!==Infinity&&count!==-Infinity)count-=count%1;
 if(count<0||count>9007199254740991)throw new RangeError("Invalid BigInt width");
 const p=__lanesPrimitive(value,false);let integer;
 if(typeof p==="bigint")integer=p;
 else if(typeof p==="boolean")integer=__lanesBigIntFromNumber(p?1:0);
 else if(typeof p==="string"){integer=__lanesBigIntParseString(p);if(integer===undefined)throw new SyntaxError("Invalid BigInt string");}
 else throw new TypeError("Cannot convert value to BigInt");
 return __lanesBigIntWidth(integer,count>2048?2049:count,${signed});
}`;
export const phase3BigintWidthSources=Object.freeze({bigintAsIntN:source(true),bigintAsUintN:source(false)});
export const phase3BigintWidthMetadata=Object.freeze([{id:1170,name:'asIntN',length:2,field:'bigintAsIntN'},{id:1171,name:'asUintN',length:2,field:'bigintAsUintN'}]);
export const phase3BigintWidthIntrinsics=Object.freeze({__lanesBigIntWidth:1172});
export const phase3BigintWidthWGSL=String.raw`
// bits==2049 denotes any larger representable ToIndex. Signed results fit the
// existing magnitude; unsigned negative results require >2048 bits and fail.
fn phase3BigintWidth(l:u32,value:V,bits:u32,signedResult:bool)->V {
 let header=bigint_header(l,value);if(header==0u||states[l].status!=0u){return undef();}
 let negative=states[l].heap[header].value.x==0xffffffffu;
 if(bits>2048u){if(signedResult||!negative){return value;}states[l].status=3u;return undef();}
 var out:array<u32,64>;
 if(bits==0u){return phase3BigintStore(l,out,0u,false);}
 let length=(bits+31u)>>5u;let partial=bits&31u;
 var carry=select(0u,1u,negative);
 for(var i=0u;i<length;i++){
  let word=bigint_limb(l,header,i);
  if(negative){out[i]=(~word)+carry;carry=select(0u,1u,carry!=0u&&out[i]==0u);}else{out[i]=word;}
 }
 var mask=0xffffffffu;if(partial!=0u){mask=(1u<<partial)-1u;}out[length-1u]&=mask;
 let resultNegative=signedResult&&((out[(bits-1u)>>5u]>>((bits-1u)&31u))&1u)!=0u;
 if(resultNegative){
  carry=1u;
  for(var i=0u;i<length;i++){out[i]=(~out[i])+carry;carry=select(0u,1u,carry!=0u&&out[i]==0u);}
  out[length-1u]&=mask;
 }
 return phase3BigintStore(l,out,length,resultNegative);
}
`;
export const phase3BigintWidthDispatchWGSL=String.raw`
if(id==1172u){if(b.z!=0u||c.z!=1u){states[l].status=2u;return undef();}return phase3BigintWidth(l,original,toBits(b.xy),truth(c));}
`;
