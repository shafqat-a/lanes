// Infinite two's-complement bitwise operations and arithmetic shifts over the
// existing sign-magnitude 64-limb BigInt representation. No CPU guest work.
const store=String.raw`
  var first=0u;var previous=0u;var produced=0u;
  for(var chunkIndex=0u;chunkIndex<16u&&produced<length;chunkIndex++){
    var packed=V(0u);for(var k=0u;k<4u;k++){if(produced+k<length){packed[k]=out[produced+k];}}
    let chunk=alloc(l,19u,packed,produced,0u);if(chunk==0u){return undef();}
    if(first==0u){first=chunk;}else{states[l].heap[previous].next=chunk;}
    previous=chunk;produced+=4u;
  }
  let result=alloc(l,19u,V(sign,length,0u,0u),0x42490000u,first);
  if(result==0u){return undef();}
  return V(result,select(0u,1u,length!=0u),18u,0u);
`;
export const phase3BigintBitwiseWGSL=String.raw`
// operation0 AND,1 OR,2 XOR,3 NOT. b is ignored for NOT.
fn phase3BigintBitwise(l:u32,a:V,b:V,operation:u32)->V {
  let ah=bigint_header(l,a);if(ah==0u||states[l].status!=0u){return undef();}
  var bh=0u;var bn=0u;var negativeB=false;
  if(operation!=3u){bh=bigint_header(l,b);if(bh==0u||states[l].status!=0u){return undef();}bn=states[l].heap[bh].value.y;negativeB=states[l].heap[bh].value.x==0xffffffffu;}
  let an=states[l].heap[ah].value.y;let negativeA=states[l].heap[ah].value.x==0xffffffffu;
  var negative=false;
  if(operation==0u){negative=negativeA&&negativeB;}
  else if(operation==1u){negative=negativeA||negativeB;}
  else if(operation==2u){negative=negativeA!=negativeB;}
  else if(operation==3u){negative=!negativeA;}
  else{states[l].status=2u;return undef();}
  var length=max(1u,max(an,bn));if(length>64u){states[l].status=3u;return undef();}
  var out:array<u32,64>;var carryA=select(0u,1u,negativeA);var carryB=select(0u,1u,negativeB);
  for(var i=0u;i<length;i++){
    var av=bigint_limb(l,ah,i);var bv=0u;if(operation!=3u){bv=bigint_limb(l,bh,i);}
    if(negativeA){let inverse=~av;av=inverse+carryA;carryA=select(0u,1u,carryA!=0u&&av==0u);}
    if(negativeB){let inverse=~bv;bv=inverse+carryB;carryB=select(0u,1u,carryB!=0u&&bv==0u);}
    if(operation==0u){out[i]=av&bv;}else if(operation==1u){out[i]=av|bv;}else if(operation==2u){out[i]=av^bv;}else{out[i]=~av;}
  }
  if(states[l].status!=0u){return undef();}
  if(negative){
    var carry=1u;
    for(var i=0u;i<length;i++){let inverse=~out[i];out[i]=inverse+carry;carry=select(0u,1u,carry!=0u&&out[i]==0u);}
    // A negative all-zero low word sequence means magnitude2^(32*length),
    // not zero. Grow if representable; never truncate at the resource cap.
    if(carry!=0u){if(length==64u){states[l].status=3u;return undef();}out[length]=1u;length++;}
  }
  loop{if(length==0u){break;}if(out[length-1u]!=0u){break;}length--;}
  var sign=0u;if(length!=0u){sign=select(1u,0xffffffffu,negative);}
`+store+String.raw`
}
// left=true corresponds to <<; false is arithmetic >>. Negative shift counts
// reverse the direction. Arbitrarily large right shifts yield0 or-1 exactly.
fn phase3BigintShift(l:u32,a:V,b:V,left:bool)->V {
  let ah=bigint_header(l,a);let bh=bigint_header(l,b);
  if(ah==0u||bh==0u||states[l].status!=0u){return undef();}
  let an=states[l].heap[ah].value.y;let bn=states[l].heap[bh].value.y;
  if(an==0u||bn==0u){return a;}
  let negative=states[l].heap[ah].value.x==0xffffffffu;
  let actualLeft=left!=(states[l].heap[bh].value.x==0xffffffffu);
  var amount=2048u;if(bn==1u){amount=bigint_limb(l,bh,0u);}
  if(states[l].status!=0u){return undef();}
  var out:array<u32,64>;for(var i=0u;i<64u;i++){out[i]=0u;}
  var length=0u;var sign=0u;
  if(actualLeft){
    var top=bigint_limb(l,ah,an-1u);var topBits=0u;
    loop{if(top==0u){break;}topBits++;top>>=1u;}
    let bits=(an-1u)*32u+topBits;
    if(amount>2048u-bits){states[l].status=3u;return undef();}
    let whole=amount>>5u;let part=amount&31u;
    for(var i=0u;i<an;i++){
      let word=bigint_limb(l,ah,i);let destinationIndex=i+whole;
      out[destinationIndex]|=word<<part;
      if(part!=0u&&destinationIndex+1u<64u){out[destinationIndex+1u]|=word>>(32u-part);}
    }
    length=(bits+amount+31u)>>5u;sign=states[l].heap[ah].value.x;
  }else{
    var discarded=false;
    if(amount>=an*32u){discarded=true;}
    else{
      let whole=amount>>5u;let part=amount&31u;length=an-whole;
      for(var i=0u;i<whole;i++){if(bigint_limb(l,ah,i)!=0u){discarded=true;}}
      if(part!=0u){if((bigint_limb(l,ah,whole)&((1u<<part)-1u))!=0u){discarded=true;}}
      for(var i=0u;i<length;i++){
        let index=i+whole;out[i]=bigint_limb(l,ah,index)>>part;
        if(part!=0u&&index+1u<an){out[i]|=bigint_limb(l,ah,index+1u)<<(32u-part);}
      }
    }
    if(negative&&discarded){
      var carry=1u;
      for(var i=0u;i<length&&carry!=0u;i++){out[i]+=carry;carry=select(0u,1u,out[i]==0u);}
      if(carry!=0u){if(length==64u){states[l].status=3u;return undef();}out[length]=1u;length++;}
    }
    loop{if(length==0u){break;}if(out[length-1u]!=0u){break;}length--;}
    if(length!=0u){sign=select(1u,0xffffffffu,negative);}
  }
  if(states[l].status!=0u){return undef();}
`+store+String.raw`
}
`;
