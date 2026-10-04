// Exact sign-magnitude BigInt division/remainder. Guest execution is WGSL only.
// Public value tag18, heap kind19 and 64 little-endian u32 limbs match phase3.
// Binary restoring division visits at most 2048 dividend bits. Remainder uses
// 64 words plus a transient carry bit: an intermediate 2049th bit is not a
// guest result and must not falsely trigger the 2048-bit resource limit.
export const phase3BigintOpsContract=Object.freeze({maxLimbs:64,maxDividendBits:2048,maxResultNodes:17,zeroDivisorStatus:8,resourceStatus:3,privateBuiltins:[]});
export const phase3BigintOpsWGSL=String.raw`
fn phase3BigintDivMod(l:u32,a:V,b:V,wantRemainder:bool)->V {
  let ah=bigint_header(l,a);let bh=bigint_header(l,b);
  if(ah==0u||bh==0u||states[l].status!=0u){return undef();}
  let an=states[l].heap[ah].value.y;let bn=states[l].heap[bh].value.y;
  let asg=states[l].heap[ah].value.x;let bsg=states[l].heap[bh].value.x;
  if(bn==0u){states[l].status=8u;return undef();}
  if(an==0u){return a;}
  if(an>64u||bn>64u){states[l].status=3u;return undef();}
  var dividend:array<u32,64>;var divisor:array<u32,64>;
  var remainder:array<u32,64>;var quotient:array<u32,64>;
  for(var i=0u;i<64u;i++){
    dividend[i]=0u;divisor[i]=0u;remainder[i]=0u;quotient[i]=0u;
    if(i<an){dividend[i]=bigint_limb(l,ah,i);}
    if(i<bn){divisor[i]=bigint_limb(l,bh,i);}
  }
  if(states[l].status!=0u){return undef();}
  var remaining=an*32u;
  loop{
    if(remaining==0u){break;}remaining--;
    let bit=(dividend[remaining>>5u]>>(remaining&31u))&1u;
    var carry=bit;
    for(var i=0u;i<bn;i++){
      let old=remainder[i];remainder[i]=(old<<1u)|carry;carry=old>>31u;
    }
    var atLeast=carry!=0u;
    if(!atLeast){
      var position=bn;var order=0i;
      loop{
        if(position==0u||order!=0i){break;}position--;
        if(remainder[position]>divisor[position]){order=1i;}
        else if(remainder[position]<divisor[position]){order=-1i;}
      }
      atLeast=order>=0i;
    }
    if(atLeast){
      var borrow=0u;
      for(var i=0u;i<bn;i++){
        let old=remainder[i];let needed=divisor[i]+borrow;
        let overflow=select(0u,1u,needed<divisor[i]);
        remainder[i]=old-needed;
        borrow=select(0u,1u,overflow!=0u||old<needed);
      }
      // Since old remainder<divisor, shift+bit<2*divisor; exactly one
      // subtraction must eliminate the transient high bit completely.
      if(carry!=borrow){states[l].status=2u;return undef();}
      quotient[remaining>>5u]|=1u<<(remaining&31u);
    }
  }
  var length=select(an,bn,wantRemainder);
  loop{
    if(length==0u){break;}
    let top=select(quotient[length-1u],remainder[length-1u],wantRemainder);
    if(top!=0u){break;}length--;
  }
  var sign=0u;
  if(length!=0u){
    if(wantRemainder){sign=asg;}
    else{sign=select(0xffffffffu,1u,asg==bsg);}
  }
  var first=0u;var previous=0u;var produced=0u;
  for(var chunkIndex=0u;chunkIndex<16u&&produced<length;chunkIndex++){
    var packed=V(0u);
    for(var k=0u;k<4u;k++){
      if(produced+k<length){packed[k]=select(quotient[produced+k],remainder[produced+k],wantRemainder);}
    }
    let chunk=alloc(l,19u,packed,produced,0u);if(chunk==0u){return undef();}
    if(first==0u){first=chunk;}else{states[l].heap[previous].next=chunk;}
    previous=chunk;produced+=4u;
  }
  let result=alloc(l,19u,V(sign,length,0u,0u),0x42490000u,first);
  if(result==0u){return undef();}
  return V(result,select(0u,1u,length!=0u),18u,0u);
}
`;
// Integration inside the existing both-operands-tag18 arithmetic branch:
// index0=sub,1=mul,2=div,3=mod; all remaining operations retain their boundary.
export const phase3BigintDivModDispatch=`else if(\${index}u==2u||\${index}u==3u){let result=phase3BigintDivMod(l,a,b,\${index}u==3u);if(states[l].status!=0u){break;}push(l,result);}`;
