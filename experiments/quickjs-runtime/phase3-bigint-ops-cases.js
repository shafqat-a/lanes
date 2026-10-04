const rows=[];
function pair(name,a,b,q,r){rows.push({feature:'bigint-divmod-'+name,source:`function f(x){return ${a}n/${b}n===${q}n&&${a}n%${b}n===${r}n;}`,input:17,expected:true});}
pair('positive',17,5,3,2);pair('negative-dividend',-17,5,-3,-2);
pair('negative-divisor',17,-5,-3,2);pair('both-negative',-17,-5,3,-2);
pair('zero',0,-5,0,0);pair('quotient-zero',3,7,0,3);
pair('negative-quotient-zero',-3,7,0,-3);pair('exact',-21,7,-3,0);
pair('u32-carry','4294967296',3,'1431655765',1);
pair('u64-all-ones','18446744073709551615','4294967295','4294967297',0);
pair('u64-borrow','18446744073709551615','4294967296','4294967295','4294967295');
pair('wide-high-bit-divisor','18446744073709551615','9223372036854775809',1,'9223372036854775806');
pair('intermediate-carry','340282366920938463463374607431768211455','9223372036854775809','36893488147419103228',3);
pair('equal-wide','340282366920938463463374607431768211455','340282366920938463463374607431768211455',1,0);
pair('divisor-larger','18446744073709551615','340282366920938463463374607431768211455',0,'18446744073709551615');
const all='0x'+'f'.repeat(512),half='0x8'+'0'.repeat(510)+'1';
const expectedRem='0x7'+'f'.repeat(510)+'e';
pair('max-width-transient-carry',all,half,1,expectedRem);
pair('max-width-negative',`-${all}`,half,-1,`-${expectedRem}`);
pair('max-width-div-one',all,1,all,0);
const power='0x1'+'0'.repeat(256),halfPower='0x1'+'0'.repeat(128);
pair('multiword-zero-limbs',power,halfPower,halfPower,0);
for(const op of ['/','%']){
 rows.push({feature:'bigint-'+(op==='/'?'division':'remainder')+'-zero-rangeerror',source:`function f(x){let n=0;try{1n${op}0n;}catch(e){if(e instanceof RangeError&&Object.getPrototypeOf(e)===RangeError.prototype)n++;}try{0n${op}0n;}catch(e){if(e instanceof RangeError&&Object.getPrototypeOf(e)===RangeError.prototype)n++;}return n;}`,input:17,expected:2});
 rows.push({feature:'bigint-'+(op==='/'?'division':'remainder')+'-mixed-typeerror',source:`function f(x){try{1n${op}0;}catch(e){return e instanceof TypeError;}return false;}`,input:17,expected:true});
}
rows.push({feature:'bigint-divmod-zero-truth',source:'function f(x){return !(3n/7n)&&!(21n%7n)&&!!(21n/7n)&&!!(3n%7n);}',input:17,expected:true});
rows.push({feature:'bigint-divmod-retain-after-gc',source:'function f(x){const a=18446744073709551615n;const q=a/4294967296n,r=a%4294967296n;const keep={q,r};for(let i=0;i<1000;i++){const garbage={v:i};}return keep.q===4294967295n&&keep.r===4294967295n&&keep.q*4294967296n+keep.r===a;}',input:17,expected:true,requiresGC:true});
rows.push({feature:'bigint-divmod-object-ToNumeric',source:'function f(x){return ({valueOf(){return 17n;}})/5n===3n;}',input:17,expected:true});
export const phase3BigintOpsCases=Object.freeze(rows.map(Object.freeze));
export const phase3BigintOpsResumption=Object.freeze({feature:'bigint-divmod-one-instruction-resumption',source:'function f(x){let value=18446744073709551615n;let steps=0;while(value>0n){const remainder=value%10n;value=value/10n;if(remainder>=0n&&remainder<10n)steps++;}return steps;}',input:17,expected:20});
export const phase3BigintOpsUnsupportedCases=Object.freeze([]);
