// GPU-only canonical BigInt conversion kernels. Every loop has a resource
// bound: 64 magnitude words, 256 input/output units, or 2048 magnitude bits.
export const phase3BigintConversionWGSL=String.raw`
fn phase3BigintStore(l:u32,out:array<u32,64>,size:u32,negative:bool)->V {
 var length=size;
 loop{if(length==0u){break;}if(out[length-1u]!=0u){break;}length--;}
 var first=0u;var previous=0u;
 for(var i=0u;i<length;i+=4u){
  var packed=V(0u);for(var k=0u;k<4u;k++){if(i+k<length){packed[k]=out[i+k];}}
  let chunk=alloc(l,19u,packed,i,0u);if(chunk==0u){return undef();}
  if(first==0u){first=chunk;}else{states[l].heap[previous].next=chunk;}previous=chunk;
 }
 var sign=0u;if(length!=0u){sign=select(1u,0xffffffffu,negative);}
 let result=alloc(l,19u,V(sign,length,0u,0u),0x42490000u,first);
 if(result==0u){return undef();}return V(result,select(0u,1u,length!=0u),18u,0u);
}
// Prefix/postfix updates use the same bounded arithmetic as +1n/-1n.
fn phase3BigintStep(l:u32,value:V,decrement:bool)->V {
 let one=phase3BigintFromNumber(l,num(fromUnsigned(1u)));
 if(states[l].status!=0u){return undef();}
 if(decrement){return phase3BigintSub(l,value,one);}return phase3BigintAdd(l,value,one);
}
fn phase3BigintFromDigits(l:u32,text:V,radix:u32,negative:bool)->V {
 if(text.z!=7u||radix<2u||radix>36u||text.y==0u){states[l].status=2u;return undef();}
 if(text.y>256u){states[l].status=3u;return undef();}
 var out:array<u32,64>;var length=0u;
 for(var position=0u;position<text.y;position++){
  let code=unit(l,text,position);var digit=36u;
  if(code>=48u&&code<=57u){digit=code-48u;}else if(code>=65u&&code<=90u){digit=code-55u;}else if(code>=97u&&code<=122u){digit=code-87u;}
  if(digit>=radix){states[l].status=2u;return undef();}
  var carry=digit;
  for(var i=0u;i<length;i++){
   let low=(out[i]&65535u)*radix+carry;
   let high=(out[i]>>16u)*radix+(low>>16u);
   out[i]=(high<<16u)|(low&65535u);carry=high>>16u;
  }
  if(carry!=0u){if(length==64u){states[l].status=3u;return undef();}out[length]=carry;length++;}
 }
 return phase3BigintStore(l,out,length,negative);
}
// Undefined is a semantic non-integral/non-finite result; guest bytecode throws
// RangeError. This is distinct from status3 (resource) and status2 (bad private call).
fn phase3BigintFromNumber(l:u32,value:V)->V {
 if(value.z!=0u){states[l].status=2u;return undef();}
 let exponent=(value.y>>20u)&2047u;let fractionHigh=value.y&1048575u;
 if(exponent==2047u){return undef();}
 var out:array<u32,64>;
 if(exponent==0u){if(value.x!=0u||fractionHigh!=0u){return undef();}return phase3BigintStore(l,out,0u,false);}
 let power=i32(exponent)-1023;var length=0u;
 let mantissaHigh=fractionHigh|1048576u;
 for(var bit=0u;bit<53u;bit++){
  var present=false;if(bit<32u){present=((value.x>>bit)&1u)!=0u;}else{present=((mantissaHigh>>(bit-32u))&1u)!=0u;}
  if(present){let destinationBit=power-52+i32(bit);if(destinationBit<0){return undef();}
   let index=u32(destinationBit)>>5u;out[index]|=1u<<(u32(destinationBit)&31u);length=max(length,index+1u);}
 }
 return phase3BigintStore(l,out,length,(value.y&0x80000000u)!=0u);
}
fn phase3BigintToNumber(l:u32,value:V)->V {
 let header=bigint_header(l,value);if(header==0u||states[l].status!=0u){return undef();}
 let length=states[l].heap[header].value.y;
 if(length==0u){return num(Pair(0u,0u));}
 let sign=select(0u,0x80000000u,states[l].heap[header].value.x==0xffffffffu);
 var top=bigint_limb(l,header,length-1u);var topBits=0u;
 loop{if(top==0u){break;}topBits++;top>>=1u;}
 var bits=(length-1u)*32u+topBits;
 if(bits>1024u){return num(Pair(0u,sign|0x7ff00000u));}
 var low=0u;var high=0u;
 for(var i=0u;i<min(53u,bits);i++){
  let sourceBit=bits-1u-i;let bit=(bigint_limb(l,header,sourceBit>>5u)>>(sourceBit&31u))&1u;
  let destinationBit=52u-i;if(destinationBit<32u){low|=bit<<destinationBit;}else{high|=bit<<(destinationBit-32u);}
 }
 if(bits>53u){
  let discarded=bits-53u;let guardIndex=discarded-1u;
  let guard=((bigint_limb(l,header,guardIndex>>5u)>>(guardIndex&31u))&1u)!=0u;
  var sticky=false;
  for(var i=0u;i<guardIndex;i++){if(((bigint_limb(l,header,i>>5u)>>(i&31u))&1u)!=0u){sticky=true;break;}}
  if(guard&&(sticky||(low&1u)!=0u)){low++;if(low==0u){high++;}
   if(high==2097152u){high=1048576u;low=0u;bits++;}}
 }
 if(bits>1024u){return num(Pair(0u,sign|0x7ff00000u));}
 return num(Pair(low,sign|((bits+1022u)<<20u)|(high&1048575u)));
}
fn phase3BigintToText(l:u32,value:V,radix:u32)->V {
 let header=bigint_header(l,value);if(header==0u||states[l].status!=0u){return undef();}
 if(radix<2u||radix>36u){states[l].status=2u;return undef();}
 var length=states[l].heap[header].value.y;
 let negative=states[l].heap[header].value.x==0xffffffffu;
 var words:array<u32,64>;for(var i=0u;i<length;i++){words[i]=bigint_limb(l,header,i);}
 var digits:array<u32,256>;var count=0u;
 loop{
  if(count>=256u){states[l].status=3u;return undef();}
  var carry=0u;
  for(var j=length;j>0u;j--){
   let i=j-1u;let upper=carry*65536u+(words[i]>>16u);let upperQuotient=upper/radix;carry=upper%radix;
   let lower=carry*65536u+(words[i]&65535u);let lowerQuotient=lower/radix;carry=lower%radix;
   words[i]=(upperQuotient<<16u)|lowerQuotient;
  }
  digits[count]=select(carry+48u,carry+87u,carry>=10u);count++;
  loop{if(length==0u){break;}if(words[length-1u]!=0u){break;}length--;}
  if(length==0u){break;}
 }
 let size=count+select(0u,1u,negative);if(size>256u){states[l].status=3u;return undef();}
 var first=0u;var previous=0u;
 for(var i=0u;i<size;i+=4u){var chars=V(0u);
  for(var j=0u;j<4u;j++){if(i+j<size){let position=i+j;if(negative&&position==0u){chars[j]=45u;}else{chars[j]=digits[count-1u-(position-select(0u,1u,negative))];}}}
  let chunk=alloc(l,10u,chars,size,0u);if(chunk==0u){return undef();}
  if(first==0u){first=chunk;}else{states[l].heap[previous].next=chunk;}previous=chunk;
 }
 return V(first,size,7u,0u);
}
`;
export const phase3BigintConversionDispatchWGSL=String.raw`
if(id==1160u){if(b.z!=0u||c.z!=1u){states[l].status=2u;return undef();}return phase3BigintFromDigits(l,original,toBits(b.xy),truth(c));}
if(id==1161u){return phase3BigintFromNumber(l,original);}
if(id==1162u){if(b.z!=0u){states[l].status=2u;return undef();}return phase3BigintToText(l,original,toBits(b.xy));}
if(id==1163u){return phase3BigintToNumber(l,original);}
`;
