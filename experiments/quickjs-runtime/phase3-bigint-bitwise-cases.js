const cases=[];
function value(feature,expression,expected){cases.push({feature:'bigint-bitwise-'+feature,source:`function f(x){return (${expression})===(${expected});}`,input:17,expected:true});}
for(const [name,expr,expected] of [
 ['and-positive','13n&10n','8n'],['or-positive','13n|10n','15n'],['xor-positive','13n^10n','7n'],
 ['and-negative','-13n&10n','2n'],['or-negative','-13n|10n','-5n'],['xor-negative','-13n^10n','-7n'],
 ['and-both-negative','-13n&-10n','-14n'],['or-both-negative','-13n|-10n','-9n'],['xor-both-negative','-13n^-10n','5n'],
 ['not-zero','~0n','-1n'],['not-minus-one','~-1n','0n'],['not-u32-growth','~4294967295n','-4294967296n'],
 ['not-negative-power','~-4294967296n','4294967295n'],
 ['left-word-boundary','4294967295n<<33n','36893488138829168640n'],
 ['left-negative','-17n<<3n','-136n'],['right-round-negative','-17n>>1n','-9n'],
 ['right-negative-exact','-16n>>4n','-1n'],['right-negative-remainder','-17n>>4n','-2n'],
 ['left-negative-count','17n<<-1n','8n'],['right-negative-count','17n>>-1n','34n'],
 ['negative-left-negative-count','-17n<<-1n','-9n'],
 ['right-words','18446744073709551615n>>33n','2147483647n'],
 ['right-negative-words','-18446744073709551615n>>33n','-2147483648n'],
 ['huge-right-positive','17n>>18446744073709551616n','0n'],
 ['huge-right-negative','-17n>>18446744073709551616n','-1n'],
 ['huge-left-negative-count','-17n<<-18446744073709551616n','-1n'],
 ['zero-huge-left','0n<<18446744073709551616n','0n'],
 ['zero-huge-right-negative-count','0n>>-18446744073709551616n','0n'],
])value(name,expr,expected);
const max='0x'+'f'.repeat(512)+'n',high='0x8'+'0'.repeat(511)+'n';
value('max-width-and',`${max}&-1n`,max);value('max-width-or',`${max}|0n`,max);
value('max-width-xor',`${max}^${max}`,'0n');value('max-width-left','1n<<2047n',high);
value('max-width-negative-right',`-${max}>>2047n`,'-2n');
cases.push({feature:'bigint-bitwise-unsigned-right-typeerror',source:'function f(x){try{1n>>>0n;}catch(e){return e instanceof TypeError&&Object.getPrototypeOf(e)===TypeError.prototype;}return false;}',input:17,expected:true});
cases.push({feature:'bigint-bitwise-mixed-typeerror',source:'function f(x){let count=0;try{1n&1;}catch(e){if(e instanceof TypeError)count++;}try{1n<<1;}catch(e){if(e instanceof TypeError)count++;}return count;}',input:17,expected:2});
cases.push({feature:'bigint-bitwise-retain-gc',source:'function f(x){const keep={a:~4294967295n,b:-18446744073709551615n>>33n,c:4294967295n<<33n};for(let i=0;i<1000;i++){const garbage={v:i};}return keep.a===-4294967296n&&keep.b===-2147483648n&&keep.c===36893488138829168640n;}',input:17,expected:true,requiresGC:true});
export const phase3BigintBitwiseCases=Object.freeze(cases.map(Object.freeze));
export const phase3BigintBitwiseResourceCases=Object.freeze([
 {feature:'left-shift-over-cap',source:'function f(x){return (1n<<2048n)>0n;}',input:17,expected:true},
 {feature:'reversed-right-shift-over-cap',source:'function f(x){return (1n>>-2048n)>0n;}',input:17,expected:true},
 {feature:'not-over-cap',source:`function f(x){return (~${max})<0n;}`,input:17,expected:true},
 {feature:'xor-negative-over-cap',source:`function f(x){return (-1n^${max})<0n;}`,input:17,expected:true},
]);
export const phase3BigintBitwiseResumption=Object.freeze({feature:'bigint-bitwise-resumption',source:'function f(x){let n=255n;let count=0;while(n!==0n){n=n>>1n;count++;}const mask=(1n<<32n)-1n;return count+":"+((mask&255n)===255n)+":"+((~mask)===-4294967296n);}',input:17,expected:'8:true:true'});
