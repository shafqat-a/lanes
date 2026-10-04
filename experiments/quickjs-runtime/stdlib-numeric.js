// Standard-library wave, worker 7: global isNaN/isFinite and the remaining
// Math functions. Guest code only: every helper below is compiled by QuickJS
// into GPU bytecode and executes on the WGSL VM, whose binary64 + - * / and
// comparisons are correctly rounded in software. No helper uses host Math and
// the runtime never calls host Math (host evaluation is confined to
// check-stdlib-numeric.mjs, an oracle).
//
// Transcendental functions are ports of Sun fdlibm 5.3 / FreeBSD msun as used
// by V8's src/base/ieee754.cc, so results match V8 bit for bit on the checked
// corpus. Copyright (C) 1993-2004 by Sun Microsystems, Inc. All rights
// reserved. Developed at SunSoft, a Sun Microsystems, Inc. business.
// Permission to use, copy, modify, and distribute this software is freely
// granted, provided that this notice is preserved.
// cbrt: FreeBSD s_cbrt.c (Bruce D. Evans), same notice.
// sqrt: fdlibm e_sqrt.c bit-by-bit (exact, correctly rounded).
// hypot: V8 builtins-math (math.tq) algorithm: max-scaled Kahan sum then sqrt.
import { NUMERIC_ID_FIRST, NUMERIC_ID_LAST } from './stdlib-ids.js';

// ToNumber(value): ToPrimitive hint number, then BigInt/Symbol -> TypeError.
const conversion = `function number(value){const p=__lanesPrimitive(value,false);if(typeof p==="bigint"||typeof p==="symbol")throw new TypeError("Cannot convert value to Number");return __lanesNumber(p);}`;
// 32-bit words of binary64 values (high word signed like fdlibm's int).
const words = `function hi(v){return __lanesNumberWord(v,true)|0;}function lo(v){return __lanesNumberWord(v,false)>>>0;}function mk(l,h){return __lanesFromBits(l>>>0,h>>>0);}`;

// 2/pi in 24-bit chunks (fdlibm two_over_pi, 66 entries); each chunk is two
// 12-bit code units of one string constant so the table lives in the image,
// not on the heap. check-stdlib-numeric.mjs recomputes 2/pi with BigInt.
export const twoOverPiChunks = Object.freeze([
  0xA2F983, 0x6E4E44, 0x1529FC, 0x2757D1, 0xF534DD, 0xC0DB62, 0x95993C, 0x439041, 0xFE5163, 0xABDEBB, 0xC561B7, 0x246E3A,
  0x424DD2, 0xE00649, 0x2EEA09, 0xD1921C, 0xFE1DEB, 0x1CB129, 0xA73EE8, 0x8235F5, 0x2EBB44, 0x84E99C, 0x7026B4, 0x5F7E41,
  0x3991D6, 0x398353, 0x39F49C, 0x845F8B, 0xBDF928, 0x3B1FF8, 0x97FFDE, 0x05980F, 0xEF2F11, 0x8B5A0A, 0x6D1F6D, 0x367ECF,
  0x27CB09, 0xB74F46, 0x3F669E, 0x5FEA2D, 0x7527BA, 0xC7EBE5, 0xF17B3D, 0x0739F7, 0x8A5292, 0xEA6BFB, 0x5FB11F, 0x8D5D08,
  0x560330, 0x46FC7B, 0x6BABF0, 0xCFBC20, 0x9AF436, 0x1DA9E3, 0x91615E, 0xE61B08, 0x659985, 0x5F14A0, 0x68408D, 0xFFD880,
  0x4D7327, 0x310606, 0x1556CA, 0x73A8C9, 0x60E27B, 0xC08C6B,
]);
const u4 = n => '\\u' + n.toString(16).padStart(4, '0');
const twoOverPiText = twoOverPiChunks.map(c => u4(c >>> 12) + u4(c & 4095)).join('');

// Snippets: name -> [deps, code]. Each helper inlines the closure of its deps.
const S = {
  words: [[], words],
  trunc: [['words'], `function trunc(v){const h=hi(v)>>>0;const e=((h>>>20)&2047)-1023;if(e>=52)return v;if(e<0)return mk(0,h&0x80000000);if(e<20)return mk(0,h&~(0x000fffff>>>e));return mk(lo(v)&~(0xffffffff>>>(e-20)),h);}`],
  fabs: [['words'], `function fabs(v){return mk(lo(v),hi(v)&0x7fffffff);}`],
  // fdlibm e_sqrt.c: bit-by-bit square root, exact rounding (round to nearest even).
  sqrt: [['words'], `function sqrt(x){
let ix0=hi(x),ix1=lo(x);
if((ix0&0x7ff00000)===0x7ff00000)return x*x+x;
if(ix0<=0){if(((ix0&0x7fffffff)|ix1)===0)return x;if(ix0<0)return NaN;}
let m=ix0>>20;
if(m===0){while(ix0===0){m-=21;ix0|=ix1>>>11;ix1=(ix1<<21)>>>0;}let i=0;for(;(ix0&0x00100000)===0;i++)ix0<<=1;m-=i-1;if(i>0){ix0|=ix1>>>(32-i);ix1=(ix1<<i)>>>0;}}
m-=1023;ix0=(ix0&0x000fffff)|0x00100000;
if(m&1){ix0+=ix0+(ix1>>>31);ix1=(ix1+ix1)>>>0;}
m>>=1;ix0+=ix0+(ix1>>>31);ix1=(ix1+ix1)>>>0;
let q=0,q1=0,s0=0,s1=0,r=0x00200000,t=0,t1=0;
while(r!==0){t=s0+r;if(t<=ix0){s0=t+r;ix0-=t;q+=r;}ix0+=ix0+(ix1>>>31);ix1=(ix1+ix1)>>>0;r>>=1;}
r=0x80000000;
while(r!==0){t1=(s1+r)>>>0;t=s0;if(t<ix0||(t===ix0&&t1<=ix1)){s1=(t1+r)>>>0;if((t1&0x80000000)!==0&&(s1&0x80000000)===0)s0+=1;ix0-=t;if(ix1<t1)ix0-=1;ix1=(ix1-t1)>>>0;q1=(q1+r)>>>0;}ix0+=ix0+(ix1>>>31);ix1=(ix1+ix1)>>>0;r=r>>>1;}
if((ix0|ix1)!==0){if(q1===0xffffffff){q1=0;q+=1;}else q1+=q1&1;}
ix1=q1>>>1;if((q&1)===1)ix1=(ix1|0x80000000)>>>0;
return mk(ix1,(q>>1)+0x3fe00000+(m<<20));}`],
  // Round |x| to p significant bits with exponent range [emin, emax] using one
  // correctly rounded binary64 addition of 1.5*2^(k+52) (ties to even).
  roundBinary: [['words'], `function roundBinary(x,p,emin,emax){
const h=hi(x),e=(h>>>20)&2047;if(e===2047||x===0)return x;
const neg=h<0;if(e===0)return neg?-0:0;
const E=e-1023;if(E>emax)return neg?-Infinity:Infinity;
const k=(E<emin?emin:E)-p+1;const C=mk(0,((k+1075)<<20)|0x80000);
let y=((neg?-x:x)+C)-C;if(y>=mk(0,(emax+1024)<<20))y=Infinity;return neg?-y:y;}`],
  cbrt: [['words'], `function cbrt(x){
let hx=hi(x);const low=lo(x);const sign=hx&0x80000000;hx^=sign;
if(hx>=0x7ff00000)return x+x;
let t=0;
if(hx<0x00100000){if((hx|low)===0)return x;t=x*18014398509481984;t=mk(0,sign|((((hi(t)&0x7fffffff)/3)>>>0)+696219795));}
else t=mk(0,sign|(((hx/3)>>>0)+715094163));
let r=(t*t)*(t/x);
t=t*((1.87595182427177009643+r*(-1.88497979543377169875+r*1.621429720105354466140))+((r*r)*r)*(-0.758397934778766047437+r*0.145996192886612446982));
let l=lo(t)+0x80000000,h=hi(t)>>>0;if(l>=4294967296){l-=4294967296;h=(h+1)>>>0;}t=mk(l&0xc0000000,h);
const s=t*t;r=x/s;const w=t+t;r=(r-t)/(w+r);return t+t*r;}`],
  exp: [['words'], `function exp(x){
let hx=hi(x);const xsb=hx>>>31;hx&=0x7fffffff;let h=0,l=0,k=0,t=0;
if(hx>=0x40862E42){if(hx>=0x7ff00000){if(((hx&0xfffff)|lo(x))!==0)return x+x;return xsb===0?x:0;}
if(x>7.09782712893383973096e+02)return Infinity;if(x< -7.45133219101941108420e+02)return 0;}
if(hx>0x3fd62e42){
if(hx<0x3FF0A2B2){if(x===1)return 2.718281828459045;h=xsb===0?x-6.93147180369123816490e-01:x+6.93147180369123816490e-01;l=xsb===0?1.90821492927058770002e-10:-1.90821492927058770002e-10;k=1-xsb-xsb;}
else{k=(1.44269504088896338700e+00*x+(xsb===0?0.5:-0.5))|0;t=k;h=x-t*6.93147180369123816490e-01;l=t*1.90821492927058770002e-10;}
x=h-l;}
else if(hx<0x3e300000)return 1+x;
t=x*x;
const c=x-t*(1.66666666666666019037e-01+t*(-2.77777777770155933842e-03+t*(6.61375632143793436117e-05+t*(-1.65339022054652515390e-06+t*4.13813679705723846039e-08))));
if(k===0)return 1-((x*c)/(c-2)-x);
const y=1-((l-(x*c)/(2-c))-h);
if(k>=-1021){if(k===1024)return y*2*8.98846567431158e+307;return y*mk(0,(0x3ff+k)<<20);}
return y*mk(0,(0x3ff+k+1000)<<20)*9.33263618503218878990e-302;}`],
  expm1: [['words'], `function expm1(x){
let hx=hi(x);const xsb=hx&0x80000000;hx&=0x7fffffff;let h=0,l=0,k=0,c=0,t=0,y=0;
if(hx>=0x4043687A){if(hx>=0x40862E42){if(hx>=0x7ff00000){if(((hx&0xfffff)|lo(x))!==0)return x+x;return xsb===0?x:-1;}
if(x>7.09782712893383973096e+02)return Infinity;}
if(xsb!==0)return -1;}
if(hx>0x3fd62e42){
if(hx<0x3FF0A2B2){if(xsb===0){h=x-6.93147180369123816490e-01;l=1.90821492927058770002e-10;k=1;}else{h=x+6.93147180369123816490e-01;l=-1.90821492927058770002e-10;k=-1;}}
else{k=(1.44269504088896338700e+00*x+(xsb===0?0.5:-0.5))|0;t=k;h=x-t*6.93147180369123816490e-01;l=t*1.90821492927058770002e-10;}
x=h-l;c=(h-x)-l;}
else if(hx<0x3c900000)return x;
const hfx=0.5*x,hxs=x*hfx;
const r1=1+hxs*(-3.33333333333331316428e-02+hxs*(1.58730158725481460165e-03+hxs*(-7.93650757867487942473e-05+hxs*(4.00821782732936239552e-06+hxs*-2.01099218183624371326e-07))));
t=3-r1*hfx;let e=hxs*((r1-t)/(6-x*t));
if(k===0)return x-(x*e-hxs);
e=(x*(e-c)-c);e-=hxs;
if(k===-1)return 0.5*(x-e)-0.5;
if(k===1){if(x< -0.25)return -2*(e-(x+0.5));return 1+2*(x-e);}
if(k<=-2||k>56){y=1-(e-x);if(k===1024)y=y*2*8.98846567431158e+307;else y=y*mk(0,(0x3ff+k)<<20);return y-1;}
if(k<20){t=mk(0,0x3ff00000-(0x200000>>k));y=t-(e-x);return y*mk(0,(0x3ff+k)<<20);}
t=mk(0,(0x3ff-k)<<20);y=x-(e+t);y+=1;return y*mk(0,(0x3ff+k)<<20);}`],
  log: [['words'], `function log(x){
let hx=hi(x);let k=0;
if(hx<0x00100000){if(((hx&0x7fffffff)|lo(x))===0)return -Infinity;if(hx<0)return NaN;k-=54;x*=1.80143985094819840000e+16;hx=hi(x);}
if(hx>=0x7ff00000)return x+x;
k+=(hx>>20)-1023;hx&=0x000fffff;let i=(hx+0x95f64)&0x100000;
x=mk(lo(x),hx|(i^0x3ff00000));k+=(i>>20);
const f=x-1;
if((0x000fffff&(2+hx))<3){if(f===0){if(k===0)return 0;return k*6.93147180369123816490e-01+k*1.90821492927058770002e-10;}
const R=f*f*(0.5-0.33333333333333333*f);if(k===0)return f-R;return k*6.93147180369123816490e-01-((R-k*1.90821492927058770002e-10)-f);}
const s=f/(2+f),z=s*s;i=hx-0x6147a;const w=z*z;const j=0x6b851-hx;
const t1=w*(3.999999999940941908e-01+w*(2.222219843214978396e-01+w*1.531383769920937332e-01));
const t2=z*(6.666666666666735130e-01+w*(2.857142874366239149e-01+w*(1.818357216161805012e-01+w*1.479819860511658591e-01)));
i|=j;const R=t2+t1;
if(i>0){const hfsq=0.5*f*f;if(k===0)return f-(hfsq-s*(hfsq+R));return k*6.93147180369123816490e-01-((hfsq-(s*(hfsq+R)+k*1.90821492927058770002e-10))-f);}
if(k===0)return f-s*(f-R);return k*6.93147180369123816490e-01-((s*(f-R)-k*1.90821492927058770002e-10)-f);}`],
  log1p: [['words'], `function log1p(x){
const hx=hi(x),ax=hx&0x7fffffff;let k=1,f=0,hu=0,c=0,u=0;
if(hx<0x3FDA827A){if(ax>=0x3ff00000){if(x===-1)return -Infinity;return NaN;}
if(ax<0x3e200000){if(ax<0x3c900000)return x;return x-x*x*0.5;}
if(hx>0||hx<=(0xbfd2bec4|0)){k=0;f=x;hu=1;}}
if(hx>=0x7ff00000)return x+x;
if(k!==0){
if(hx<0x43400000){u=1+x;hu=hi(u);k=(hu>>20)-1023;c=k>0?1-(u-x):x-(u-1);c/=u;}
else{u=x;hu=hi(u);k=(hu>>20)-1023;c=0;}
hu&=0x000fffff;
if(hu<0x6a09e)u=mk(lo(u),hu|0x3ff00000);else{k+=1;u=mk(lo(u),hu|0x3fe00000);hu=(0x00100000-hu)>>2;}
f=u-1;}
const hfsq=0.5*f*f;
if(hu===0){if(f===0){if(k===0)return 0;c+=k*1.90821492927058770002e-10;return k*6.93147180369123816490e-01+c;}
const R=hfsq*(1-0.66666666666666666*f);if(k===0)return f-R;return k*6.93147180369123816490e-01-((R-(k*1.90821492927058770002e-10+c))-f);}
const s=f/(2+f),z=s*s;
const R=z*(6.666666666666735130e-01+z*(3.999999999940941908e-01+z*(2.857142874366239149e-01+z*(2.222219843214978396e-01+z*(1.818357216161805012e-01+z*(1.531383769920937332e-01+z*1.479819860511658591e-01))))));
if(k===0)return f-(hfsq-s*(hfsq+R));
return k*6.93147180369123816490e-01-((hfsq-(s*(hfsq+R)+(k*1.90821492927058770002e-10+c)))-f);}`],
  // FreeBSD k_log.h k_log1p(f) for log2.
  klog1p: [[], `function klog1p(f){const s=f/(2+f),z=s*s,w=z*z;
const t1=w*(3.999999999940941908e-01+w*(2.222219843214978396e-01+w*1.531383769920937332e-01));
const t2=z*(6.666666666666735130e-01+w*(2.857142874366239149e-01+w*(1.818357216161805012e-01+w*1.479819860511658591e-01)));
const hfsq=0.5*f*f;return s*(hfsq+(t2+t1));}`],
  log2: [['words', 'klog1p'], `function log2(x){
let hx=hi(x);const lx=lo(x);let k=0;
if(hx<0x00100000){if(((hx&0x7fffffff)|lx)===0)return -Infinity;if(hx<0)return NaN;k-=54;x*=1.80143985094819840000e+16;hx=hi(x);}
if(hx>=0x7ff00000)return x+x;
if(hx===0x3ff00000&&lx===0)return 0;
k+=(hx>>20)-1023;hx&=0x000fffff;const i=(hx+0x95f64)&0x100000;
x=mk(lo(x),hx|(i^0x3ff00000));k+=(i>>20);
const y=k,f=x-1,hfsq=0.5*f*f,r=klog1p(f);
let h=f-hfsq;h=mk(0,hi(h));const l=(f-h)-hfsq+r;
let vh=h*1.44269504072144627571e+00;let vl=(l+h)*1.67517131648865118353e-10+l*1.44269504072144627571e+00;
const w=y+vh;vl+=(y-w)+vh;vh=w;return vl+vh;}`],
  // fdlibm e_log10.c (V8 ieee754::log10).
  log10: [['words', 'log'], `function log10(x){
let hx=hi(x);let lx=lo(x);let k=0;
if(hx<0x00100000){if(((hx&0x7fffffff)|lx)===0)return -Infinity;if(hx<0)return NaN;k-=54;x*=1.80143985094819840000e+16;hx=hi(x);lx=lo(x);}
if(hx>=0x7ff00000)return x+x;
if(hx===0x3ff00000&&lx===0)return 0;
k+=(hx>>20)-1023;
const i=(k&0x80000000)>>>31;hx=(hx&0x000fffff)|((0x3ff-i)<<20);const y=k+i;
x=mk(lx,hx);
const z=y*3.69423907715893078616e-13+4.34294481903251816668e-01*log(x);
return z+y*3.01029995663611771306e-01;}`],
  atan: [['words', 'fabs'], `function atan(x){
const hx=hi(x),ix=hx&0x7fffffff;let id=-1;
if(ix>=0x44100000){if(ix>0x7ff00000||(ix===0x7ff00000&&lo(x)!==0))return x+x;
if(hx>0)return 1.57079632679489655800e+00+6.12323399573676603587e-17;return -1.57079632679489655800e+00-6.12323399573676603587e-17;}
if(ix<0x3fdc0000){if(ix<0x3e400000)return x;}
else{x=fabs(x);
if(ix<0x3ff30000){if(ix<0x3fe60000){id=0;x=(2*x-1)/(2+x);}else{id=1;x=(x-1)/(x+1);}}
else{if(ix<0x40038000){id=2;x=(x-1.5)/(1+1.5*x);}else{id=3;x=-1/x;}}}
let z=x*x;const w=z*z;
const s1=z*(3.33333333333329318027e-01+w*(1.42857142725034663711e-01+w*(9.09088713343650656196e-02+w*(6.66107313738753120669e-02+w*(4.97687799461593236017e-02+w*1.62858201153657823623e-02)))));
const s2=w*(-1.99999999998764832476e-01+w*(-1.11111104054623557880e-01+w*(-7.69187620504482999495e-02+w*(-5.83357013379057348645e-02+w*-3.65315727442169155270e-02))));
if(id<0)return x-x*(s1+s2);
const ah=id===0?4.63647609000806093515e-01:id===1?7.85398163397448278999e-01:id===2?9.82793723247329054082e-01:1.57079632679489655800e+00;
const al=id===0?2.26987774529616870924e-17:id===1?3.06161699786838301793e-17:id===2?1.39033110312309984516e-17:6.12323399573676603587e-17;
z=ah-((x*(s1+s2)-al)-x);return hx<0?-z:z;}`],
  // asin/acos rational kernel R(t) = p/q pieces.
  asinPQ: [[], `function pS(t){return t*(1.66666666666666657415e-01+t*(-3.25565818622400915405e-01+t*(2.01212532134862925881e-01+t*(-4.00555345006794114027e-02+t*(7.91534994289814532176e-04+t*3.47933107596021167570e-05)))));}
function qS(t){return 1+t*(-2.40339491173441421878e+00+t*(2.02094576023350569471e+00+t*(-6.88283971605453293030e-01+t*7.70381505559019352791e-02)));}`],
  // fdlibm k_sin.c / k_cos.c / k_tan.c kernels on [-pi/4, pi/4].
  ksin: [['words'], `function ksin(x,y,iy){const ix=hi(x)&0x7fffffff;if(ix<0x3e400000)return x;
const z=x*x,v=z*x,r=8.33333333332248946124e-03+z*(-1.98412698298579493134e-04+z*(2.75573137070700676789e-06+z*(-2.50507602534068634195e-08+z*1.58969099521155010221e-10)));
if(iy===0)return x+v*(-1.66666666666666324348e-01+z*r);return x-((z*(0.5*y-v*r)-y)-v*-1.66666666666666324348e-01);}`],
  kcos: [['words'], `function kcos(x,y){const ix=hi(x)&0x7fffffff;if(ix<0x3e400000)return 1;
const z=x*x,r=z*(4.16666666666666019037e-02+z*(-1.38888888888741095749e-03+z*(2.48015872894767294178e-05+z*(-2.75573143513906633035e-07+z*(2.08757232129817482790e-09+z*-1.13596475577881948265e-11)))));
if(ix<0x3FD33333)return 1-(0.5*z-(z*r-x*y));
const qx=ix>0x3fe90000?0.28125:mk(0,ix-0x00200000);const hz=0.5*z-qx,a=1-qx;return a-(hz-(z*r-x*y));}`],
  ktan: [['words'], `function ktan(x,y,iy){
const hx=hi(x),ix=hx&0x7fffffff;let z=0,r=0,v=0,w=0,s=0,a=0,t=0;
if(ix<0x3e300000){if(((ix|lo(x))|(iy+1))===0)return 1/(x<0?-x:x);if(iy===1)return x;
z=w=x+y;z=mk(0,hi(z));v=y-(z-x);t=a=-1/w;t=mk(0,hi(t));s=1+t*z;return t+a*(s+t*v);}
if(ix>=0x3FE59428){if(hx<0){x=-x;y=-y;}z=7.85398163397448278999e-01-x;w=3.06161699786838301793e-17-y;x=z+w;y=0;}
z=x*x;w=z*z;
r=1.33333333333201242699e-01+w*(2.18694882948595424599e-02+w*(3.59207910759131235356e-03+w*(5.88041240820264096874e-04+w*(7.81794442939557092300e-05+w*-1.85586374855275456654e-05))));
v=z*(5.39682539762260521377e-02+w*(8.86323982359930005737e-03+w*(1.45620945432529025516e-03+w*(2.46463134818469906812e-04+w*(7.14072491382608190305e-05+w*2.59073051863633712884e-05)))));
s=z*x;r=y+z*(s*(r+v)+y);r+=3.33333333333334091986e-01*s;w=x+r;
if(ix>=0x3FE59428){v=iy;return (1-((hx>>30)&2))*(v-2*(x-(w*w/(w+v)-r)));}
if(iy===1)return w;
z=mk(0,hi(w));v=r-(z-x);t=a=-1/w;t=mk(0,hi(t));s=1+t*z;return t+a*(s+t*v);}`],
  // fdlibm e_rem_pio2.c + k_rem_pio2.c (prec 2). Results in ry0/ry1.
  remPio2: [['words', 'trunc'], `let ry0=0,ry1=0;
function pow2(e){return mk(0,(e+1023)<<20);}
function ipio2(j){return __lanesCharCodeAt(TWO_OVER_PI,j+j)*4096+__lanesCharCodeAt(TWO_OVER_PI,j+j+1);}
function kernelRemPio2(x0,x1,x2,e0,nx){
const jx=nx-1;let jv=((e0-3)/24)|0;if(jv<0)jv=0;let q0=e0-24*(jv+1);
const f=__lanesDescriptor(),q=__lanesDescriptor(),iq=__lanesDescriptor(),fq=__lanesDescriptor();
let i=0,j=jv-jx,k=0,jz=4,z=0,fw=0,n=0,ih=0,carry=0;
function xs(t){return t===0?x0:t===1?x1:x2;}
for(i=0;i<=jx+4;i++,j++)f[i]=j<0?0:ipio2(j);
for(i=0;i<=4;i++){fw=0;for(j=0;j<=jx;j++)fw+=xs(j)*f[jx+i-j];q[i]=fw;}
for(;;){
z=q[jz];for(i=0,j=jz;j>0;i++,j--){fw=(5.96046447753906250000e-08*z)|0;iq[i]=(z-16777216*fw)|0;z=q[j-1]+fw;}
z=z*pow2(q0);z-=8*trunc(z*0.125);n=z|0;z-=n;ih=0;
if(q0>0){i=iq[jz-1]>>(24-q0);n+=i;iq[jz-1]-=i<<(24-q0);ih=iq[jz-1]>>(23-q0);}
else if(q0===0)ih=iq[jz-1]>>23;else if(z>=0.5)ih=2;
if(ih>0){n+=1;carry=0;
for(i=0;i<jz;i++){j=iq[i];if(carry===0){if(j!==0){carry=1;iq[i]=0x1000000-j;}}else iq[i]=0xffffff-j;}
if(q0===1)iq[jz-1]&=0x7fffff;else if(q0===2)iq[jz-1]&=0x3fffff;
if(ih===2){z=1-z;if(carry!==0)z-=pow2(q0);}}
if(z===0){j=0;for(i=jz-1;i>=4;i--)j|=iq[i];
if(j===0){for(k=1;iq[4-k]===0;k++);
for(i=jz+1;i<=jz+k;i++){f[jx+i]=ipio2(jv+i);fw=0;for(j=0;j<=jx;j++)fw+=xs(j)*f[jx+i-j];q[i]=fw;}
jz+=k;continue;}}
break;}
if(z===0){jz-=1;q0-=24;while(iq[jz]===0){jz--;q0-=24;}}
else{z=z*pow2(-q0);if(z>=16777216){fw=(5.96046447753906250000e-08*z)|0;iq[jz]=(z-16777216*fw)|0;jz+=1;q0+=24;iq[jz]=fw;}else iq[jz]=z|0;}
fw=pow2(q0);for(i=jz;i>=0;i--){q[i]=fw*iq[i];fw*=5.96046447753906250000e-08;}
for(i=jz;i>=0;i--){fw=0;for(k=0;k<=4&&k<=jz-i;k++)fw+=(k===0?1.57079625129699707031e+00:k===1?7.54978941586159635335e-08:k===2?5.39030252995776476554e-15:k===3?3.28200341580791294123e-22:1.27065575308067607349e-29)*q[i+k];fq[jz-i]=fw;}
fw=0;for(i=jz;i>=0;i--)fw+=fq[i];ry0=ih===0?fw:-fw;fw=fq[0]-fw;for(i=1;i<=jz;i++)fw+=fq[i];ry1=ih===0?fw:-fw;
return n&7;}
function remPio2(x){
const hx=hi(x),ix=hx&0x7fffffff;let z=0,w=0,t=0,r=0,fn=0,n=0;
if(ix<0x4002d97c){
if(hx>0){z=x-1.57079632673412561417e+00;if(ix!==0x3ff921fb){ry0=z-6.07710050650619224932e-11;ry1=(z-ry0)-6.07710050650619224932e-11;}else{z-=6.07710050630396597660e-11;ry0=z-2.02226624879595063154e-21;ry1=(z-ry0)-2.02226624879595063154e-21;}return 1;}
z=x+1.57079632673412561417e+00;if(ix!==0x3ff921fb){ry0=z+6.07710050650619224932e-11;ry1=(z-ry0)+6.07710050650619224932e-11;}else{z+=6.07710050630396597660e-11;ry0=z+2.02226624879595063154e-21;ry1=(z-ry0)+2.02226624879595063154e-21;}return -1;}
if(ix<=0x413921fb){
t=hx<0?-x:x;n=(t*6.36619772367581382433e-01+0.5)|0;fn=n;r=t-fn*1.57079632673412561417e+00;w=fn*6.07710050650619224932e-11;
if(n<32&&ix!==(hi(fn*1.5707963267948966)&0x7fffffff))ry0=r-w;
else{const j=ix>>20;ry0=r-w;let i=j-((hi(ry0)>>20)&0x7ff);
if(i>16){t=r;w=fn*6.07710050630396597660e-11;r=t-w;w=fn*2.02226624879595063154e-21-((t-r)-w);ry0=r-w;i=j-((hi(ry0)>>20)&0x7ff);
if(i>49){t=r;w=fn*2.02226624871116645580e-21;r=t-w;w=fn*8.47842766036889956997e-32-((t-r)-w);ry0=r-w;}}}
ry1=(r-ry0)-w;if(hx<0){ry0=-ry0;ry1=-ry1;return -n;}return n;}
const e0=(ix>>20)-1046;z=mk(lo(x),ix-(e0<<20));
const x0=z|0;z=(z-x0)*16777216;const x1=z|0;z=(z-x1)*16777216;
n=kernelRemPio2(x0,x1,z,e0,z!==0?3:x1!==0?2:1);
if(hx<0){ry0=-ry0;ry1=-ry1;return -n;}return n;}`.replaceAll('TWO_OVER_PI', `"${twoOverPiText}"`)],
  // ToIntegerOrInfinity(ToNumber(v)).
  integer: [['trunc'], `function integer(v){const n=number(v);if(n!==n||n===0)return 0;if(n===Infinity||n===-Infinity)return n;return trunc(n);}`],
  // Exact decimal digits of a positive finite binary64 (number-text-source.js
  // limb arithmetic): start(x) scales so 1 <= bn/bd < 10 and returns the
  // decimal exponent; digit() yields successive exact digits. Rounding a digit
  // string half-up by its next digit is exact because the expansion is exact.
  decimal: [['words'], `function limbs(){const a=__lanesDescriptor();a.length=1;a[0]=0;return a;}
function trim(a){while(a.length>1&&a[a.length-1]===0)a.length--;return a;}
function multiply(a,factor){let carry=0;for(let i=0;i<a.length;i++){const product=a[i]*factor+carry;a[i]=product>>>0;carry=(product/4294967296)>>>0;}if(carry){a[a.length]=carry;a.length++;}}
function scale(a,power){while(power>=6){multiply(a,1000000);power-=6;}while(power>0){multiply(a,10);power--;}}
function copy(a){const b=limbs();b.length=a.length;for(let i=0;i<a.length;i++)b[i]=a[i];return b;}
function shift(a,amount){const b=limbs(),whole=amount>>>5,part=amount&31;b.length=a.length+whole+(part?1:0);for(let i=0;i<b.length;i++)b[i]=0;
for(let i=0;i<a.length;i++){b[i+whole]=(b[i+whole]|(a[i]<<part))>>>0;if(part)b[i+whole+1]=a[i]>>>(32-part);}return trim(b);}
function compare(a,b){if(a.length!==b.length)return a.length<b.length?-1:1;for(let i=a.length-1;i>=0;i--)if(a[i]!==b[i])return a[i]<b[i]?-1:1;return 0;}
function subtract(a,b){let borrow=0;for(let i=0;i<a.length;i++){let w=a[i]-(i<b.length?b[i]:0)-borrow;borrow=w<0?1:0;if(borrow)w+=4294967296;a[i]=w;}trim(a);}
let bn=null,bd=null;
function start(x){const low=lo(x),high=hi(x)&0x7fffffff,biased=(high>>>20)&2047;
let n=limbs(),d=limbs();n[0]=low;n[1]=(high&1048575)|(biased?1048576:0);n.length=2;trim(n);d[0]=1;
const e2=biased?biased-1075:-1074;if(e2>=0)n=shift(n,e2);else d=shift(d,-e2);
let be=biased-1023;if(!biased){let leading=high&1048575;be=-1042;if(!leading){leading=low;be=-1074;}while(leading>1){leading=leading>>>1;be++;}}
let power=(be*78913)>>18;if(power<0)scale(n,-power);else scale(d,power);
while(compare(n,d)<0){multiply(n,10);power--;}
let next=copy(d);multiply(next,10);while(compare(n,next)>=0){d=next;power++;next=copy(d);multiply(next,10);}
bn=n;bd=d;return power;}
function digit(){let k=0;while(compare(bn,bd)>=0){subtract(bn,bd);k++;}multiply(bn,10);return k;}
function digits(count){let s="",g="";for(let i=0;i<count;i++){g+="0123456789"[digit()];if(g.length===10){s+=g;g="";}}return s+g;}
function zeros(k){let z="";while(k>=10){z+="0000000000";k-=10;}while(k>0){z+="0";k--;}return z;}
function increment(s){let i=s.length-1;while(i>=0&&__lanesCharCodeAt(s,i)===57)i--;return (i<0?"1":__lanesSlice(s,0,i)+"0123456789"[__lanesCharCodeAt(s,i)-47])+zeros(s.length-1-i);}
function exponentText(v){let r="";do{const q=(v/10)>>>0;r="0123456789"[v-q*10]+r;v=q;}while(v);return r;}
function nonFinite(v){return v!==v?"NaN":v>0?"Infinity":"-Infinity";}`],
};
function closure(names) {
  const order = [], seen = new Set();
  const visit = name => { if (seen.has(name)) return; seen.add(name); for (const d of S[name][0]) visit(d); order.push(S[name][1]); };
  names.forEach(visit);
  return order.join('\n');
}
// One-argument Math function: ToNumber(value) then a guest kernel.
const unary = (field, deps, body) => `function ${field}Bootstrap(value){"use strict";${conversion}\n${closure(deps)}\nlet x=number(value);${body}}`;

const sources = {
  globalIsNaN: `function globalIsNaNBootstrap(value){"use strict";${conversion}const n=number(value);return n!==n;}`,
  globalIsFinite: `function globalIsFiniteBootstrap(value){"use strict";${conversion}const n=number(value);return n===n&&n!==Infinity&&n!==-Infinity;}`,
  mathSqrt: unary('mathSqrt', ['sqrt'], 'return sqrt(x);'),
  mathFround: unary('mathFround', ['roundBinary'], 'return roundBinary(x,24,-126,127);'),
  mathClz32: unary('mathClz32', [], `let n=x>>>0;if(n===0)return 32;let c=0;
if(n<=0xffff){c+=16;n*=65536;}if(n<=0xffffff){c+=8;n*=256;}if(n<=0xfffffff){c+=4;n*=16;}if(n<=0x3fffffff){c+=2;n*=4;}if(n<=0x7fffffff)c++;return c;`),
  mathImul: `function mathImulBootstrap(x,y){"use strict";${conversion}const a=number(x)>>>0;const b=number(y)>>>0;
const ah=a>>>16,al=a&0xffff,bh=b>>>16,bl=b&0xffff;return (((ah*bl+al*bh)<<16)+al*bl)|0;}`,
  mathHypot: `function mathHypotBootstrap(value1,value2){"use strict";${conversion}\n${closure(['sqrt'])}
const count=arguments.length;const abs=__lanesDescriptor();let nan=false,max=0;
for(let i=0;i<count;i++){const n=number(arguments[i]);if(n!==n){nan=true;abs[i]=0;}else{const v=n<0?-n:n===0?0:n;abs[i]=v;if(v>max)max=v;}}
if(max===Infinity)return Infinity;if(nan)return NaN;if(max===0)return 0;
let sum=0,compensation=0;
for(let i=0;i<count;i++){const n=abs[i]/max;const summand=n*n-compensation;const preliminary=sum+summand;compensation=(preliminary-sum)-summand;sum=preliminary;}
return sqrt(sum)*max;}`,
  mathCbrt: unary('mathCbrt', ['cbrt'], 'return cbrt(x);'),
  mathF16round: unary('mathF16round', ['roundBinary'], 'return roundBinary(x,11,-14,15);'),
  mathExp: unary('mathExp', ['exp'], 'return exp(x);'),
  mathExpm1: unary('mathExpm1', ['expm1'], 'return expm1(x);'),
  mathLog: unary('mathLog', ['log'], 'return log(x);'),
  mathLog1p: unary('mathLog1p', ['log1p'], 'return log1p(x);'),
  mathLog2: unary('mathLog2', ['log2'], 'return log2(x);'),
  mathLog10: unary('mathLog10', ['log10'], 'return log10(x);'),
  mathSin: unary('mathSin', ['ksin', 'kcos', 'remPio2'], `const ix=hi(x)&0x7fffffff;if(ix<=0x3fe921fb)return ksin(x,0,0);if(ix>=0x7ff00000)return x-x;
const n=remPio2(x)&3;if(n===0)return ksin(ry0,ry1,1);if(n===1)return kcos(ry0,ry1);if(n===2)return -ksin(ry0,ry1,1);return -kcos(ry0,ry1);`),
  mathCos: unary('mathCos', ['ksin', 'kcos', 'remPio2'], `const ix=hi(x)&0x7fffffff;if(ix<=0x3fe921fb)return kcos(x,0);if(ix>=0x7ff00000)return x-x;
const n=remPio2(x)&3;if(n===0)return kcos(ry0,ry1);if(n===1)return -ksin(ry0,ry1,1);if(n===2)return -kcos(ry0,ry1);return ksin(ry0,ry1,1);`),
  mathTan: unary('mathTan', ['ktan', 'remPio2'], `const ix=hi(x)&0x7fffffff;if(ix<=0x3fe921fb)return ktan(x,0,1);if(ix>=0x7ff00000)return x-x;
const n=remPio2(x);return ktan(ry0,ry1,1-((n&1)<<1));`),
  mathAtan: unary('mathAtan', ['atan'], 'return atan(x);'),
  mathAtan2: `function mathAtan2Bootstrap(y,x){"use strict";${conversion}\n${closure(['atan','fabs'])}
const b=number(y),a=number(x);
const hx=hi(a),ix=hx&0x7fffffff,lx=lo(a),hy=hi(b),iy=hy&0x7fffffff,ly=lo(b);
if(a!==a||b!==b)return a+b;
if(((hx-0x3ff00000)|lx)===0)return atan(b);
let m=((hy>>31)&1)|((hx>>30)&2);
if((iy|ly)===0){if(m<2)return b;return m===2?3.1415926535897931160E+00:-3.1415926535897931160E+00;}
if((ix|lx)===0)return hy<0?-1.5707963267948965580E+00:1.5707963267948965580E+00;
if(ix===0x7ff00000){
if(iy===0x7ff00000){if(m===0)return 7.8539816339744827900E-01;if(m===1)return -7.8539816339744827900E-01;if(m===2)return 3*7.8539816339744827900E-01;return -3*7.8539816339744827900E-01;}
if(m===0)return 0;if(m===1)return -0;if(m===2)return 3.1415926535897931160E+00;return -3.1415926535897931160E+00;}
if(iy===0x7ff00000)return hy<0?-1.5707963267948965580E+00:1.5707963267948965580E+00;
const k=(iy-ix)>>20;let z=0;
if(k>60){z=1.5707963267948965580E+00+0.5*1.2246467991473531772E-16;m&=1;}
else if(hx<0&&k< -60)z=0;
else z=atan(fabs(b/a));
if(m===0)return z;if(m===1)return -z;
if(m===2)return 3.1415926535897931160E+00-(z-1.2246467991473531772E-16);
return (z-1.2246467991473531772E-16)-3.1415926535897931160E+00;}`,
  mathAsin: unary('mathAsin', ['sqrt', 'asinPQ'], `const hx=hi(x),ix=hx&0x7fffffff;let t=0,w=0,p=0,q=0;
if(ix>=0x3ff00000){if(((ix-0x3ff00000)|lo(x))===0)return x*1.57079632679489655800e+00+x*6.12323399573676603587e-17;return NaN;}
if(ix<0x3fe00000){if(ix<0x3e400000)return x;t=x*x;return x+x*(pS(t)/qS(t));}
w=1-(x<0?-x:x);t=w*0.5;p=pS(t);q=qS(t);const s=sqrt(t);
if(ix>=0x3FEF3333){w=p/q;t=1.57079632679489655800e+00-(2*(s+s*w)-6.12323399573676603587e-17);}
else{w=mk(0,hi(s));const c=(t-w*w)/(s+w);const r=p/q;p=2*s*r-(6.12323399573676603587e-17-2*c);q=7.85398163397448278999e-01-2*w;t=7.85398163397448278999e-01-(p-q);}
return hx>0?t:-t;`),
  mathAcos: unary('mathAcos', ['sqrt', 'asinPQ'], `const hx=hi(x),ix=hx&0x7fffffff;let z=0,s=0,r=0;
if(ix>=0x3ff00000){if(((ix-0x3ff00000)|lo(x))===0){if(hx>0)return 0;return 3.14159265358979311600e+00+2*6.12323399573676603587e-17;}return NaN;}
if(ix<0x3fe00000){if(ix<=0x3c600000)return 1.57079632679489655800e+00+6.12323399573676603587e-17;z=x*x;r=pS(z)/qS(z);return 1.57079632679489655800e+00-(x-(6.12323399573676603587e-17-x*r));}
if(hx<0){z=(1+x)*0.5;s=sqrt(z);r=pS(z)/qS(z);const w=r*s-6.12323399573676603587e-17;return 3.14159265358979311600e+00-2*(s+w);}
z=(1-x)*0.5;s=sqrt(z);const df=mk(0,hi(s));const c=(z-df*df)/(s+df);r=pS(z)/qS(z);return 2*(df+(r*s+c));`),
  mathSinh: unary('mathSinh', ['exp', 'expm1'], `const h=x<0?-0.5:0.5;const ax=x<0?-x:x;
if(ax<22){if(ax<3.725290298461914e-9)return x;const t=expm1(ax);if(ax<1)return h*(2*t-t*t/(t+1));return h*(t+t/(t+1));}
if(ax<709.7822265625)return h*exp(ax);
if(ax<=710.4758600739439){const w=exp(0.5*ax);const t=h*w;return t*w;}
return x*1.0e307;`),
  mathCosh: unary('mathCosh', ['exp', 'expm1', 'fabs'], `const ix=hi(x)&0x7fffffff;
if(ix<0x3fd62e43){const t=expm1(fabs(x));const w=1+t;if(ix<0x3c800000)return w;return 1+(t*t)/(w+w);}
if(ix<0x40360000){const t=exp(fabs(x));return 0.5*t+0.5/t;}
if(ix<0x40862e42)return 0.5*exp(fabs(x));
if(fabs(x)<=710.4758600739439){const w=exp(0.5*fabs(x));const t=0.5*w;return t*w;}
if(ix>=0x7ff00000)return x*x;return Infinity;`),
  mathTanh: unary('mathTanh', ['expm1', 'fabs'], `const jx=hi(x),ix=jx&0x7fffffff;let t=0,z=0;
if(ix>=0x7ff00000){if(jx>=0)return 1/x+1;return 1/x-1;}
if(ix<0x40360000){if(ix<0x3e300000)return x;
if(ix>=0x3ff00000){t=expm1(2*fabs(x));z=1-2/(t+2);}else{t=expm1(-2*fabs(x));z=-t/(t+2);}}
else z=1;
return jx>=0?z:-z;`),
  mathAsinh: unary('mathAsinh', ['log', 'log1p', 'sqrt', 'fabs'], `const hx=hi(x),ix=hx&0x7fffffff;let w=0;
if(ix>=0x7ff00000)return x+x;if(ix<0x3e300000)return x;
if(ix>0x41b00000)w=log(fabs(x))+6.93147180559945286227e-01;
else if(ix>0x40000000){const t=fabs(x);w=log(2*t+1/(sqrt(x*x+1)+t));}
else{const t=x*x;w=log1p(fabs(x)+t/(1+sqrt(1+t)));}
return hx>0?w:-w;`),
  mathAcosh: unary('mathAcosh', ['log', 'log1p', 'sqrt'], `const hx=hi(x);
if(hx<0x3ff00000)return NaN;
if(hx>=0x41b00000){if(hx>=0x7ff00000)return x+x;return log(x)+6.93147180559945286227e-01;}
if(((hx-0x3ff00000)|lo(x))===0)return 0;
if(hx>0x40000000){const t=x*x;return log(2*x-1/(x+sqrt(t-1)));}
const t=x-1;return log1p(t+sqrt(2*t+t*t));`),
  mathAtanh: unary('mathAtanh', ['log1p'], `const hx=hi(x),lx=lo(x),ix=hx&0x7fffffff;let t=0;
if((ix|(lx!==0?1:0))>0x3ff00000)return NaN;
if(ix===0x3ff00000)return x/0;
if(ix<0x3e300000)return x;
x=mk(lx,ix);
if(ix<0x3fe00000){t=x+x;t=0.5*log1p(t+t*x/(1-x));}else t=0.5*log1p((x+x)/(1-x));
return hx>=0?t:-t;`),
  // ES2025 Number.prototype.toFixed: thisNumberValue, ToIntegerOrInfinity, range, then exact digits.
  numberToFixed: `function numberToFixedBootstrap(fractionDigits){"use strict";${conversion}\n${closure(['integer', 'decimal'])}
const x0=__lanesThisNumber(this);const f=integer(fractionDigits);
if(f===Infinity||f===-Infinity||f<0||f>100)throw new RangeError("toFixed() digits argument must be between 0 and 100");
if(x0!==x0||x0===Infinity||x0===-Infinity)return nonFinite(x0);
let x=x0,s="";if(x<0){s="-";x=-x;}
if(x>=1e21)return s+(""+x);
let m="0";
if(x!==0){const k=start(x);const L=k+f+1;if(L===0)m=digit()>=5?"1":"0";else if(L>0){m=digits(L);if(digit()>=5)m=increment(m);}}
if(f!==0){let k=m.length;if(k<=f){m=zeros(f+1-k)+m;k=f+1;}m=__lanesSlice(m,0,k-f)+"."+__lanesSlice(m,k-f);}
return s+m;}`,
  numberToExponential: `function numberToExponentialBootstrap(fractionDigits){"use strict";${conversion}\n${closure(['integer', 'decimal'])}
const x0=__lanesThisNumber(this);let f=integer(fractionDigits);
if(x0!==x0||x0===Infinity||x0===-Infinity)return nonFinite(x0);
if(f<0||f>100)throw new RangeError("toExponential() argument must be between 0 and 100");
let x=x0,s="";if(x<0){s="-";x=-x;}
let m="",e=0;
if(x===0)m=zeros(f+1);
else if(fractionDigits===undefined){
const t=""+x;let all="",point=-1,ex=0,neg=false,i=0;
for(;i<t.length;i++){const c=__lanesCharCodeAt(t,i);if(c===46)point=all.length;else if(c===101)break;else all+="0123456789"[c-48];}
if(i<t.length){i++;if(__lanesCharCodeAt(t,i)===45)neg=true;i++;for(;i<t.length;i++)ex=ex*10+(__lanesCharCodeAt(t,i)-48);}
if(point<0)point=all.length;let lead=0;while(__lanesCharCodeAt(all,lead)===48)lead++;
m=__lanesSlice(all,lead);while(m.length>1&&__lanesCharCodeAt(m,m.length-1)===48)m=__lanesSlice(m,0,m.length-1);
e=point-lead-1+(neg?-ex:ex);f=m.length-1;}
else{e=start(x);m=digits(f+1);if(digit()>=5){m=increment(m);if(m.length>f+1){m=__lanesSlice(m,0,f+1);e++;}}}
if(f!==0)m=__lanesSlice(m,0,1)+"."+__lanesSlice(m,1);
return s+m+"e"+(e<0?"-":"+")+exponentText(e<0?-e:e);}`,
  numberToPrecision: `function numberToPrecisionBootstrap(precision){"use strict";${conversion}\n${closure(['integer', 'decimal'])}
const x0=__lanesThisNumber(this);
if(precision===undefined)return ""+x0;
const p=integer(precision);
if(x0!==x0||x0===Infinity||x0===-Infinity)return nonFinite(x0);
if(p<1||p>100)throw new RangeError("toPrecision() argument must be between 1 and 100");
let x=x0,s="";if(x<0){s="-";x=-x;}
let m="",e=0;
if(x===0)m=zeros(p);
else{e=start(x);m=digits(p);if(digit()>=5){m=increment(m);if(m.length>p){m=__lanesSlice(m,0,p);e++;}}
if(e< -6||e>=p){let r=__lanesSlice(m,0,1);if(p!==1)r+="."+__lanesSlice(m,1);return s+r+"e"+(e>0?"+":"-")+exponentText(e<0?-e:e);}}
if(e===p-1)return s+m;
if(e>=0)return s+__lanesSlice(m,0,e+1)+"."+__lanesSlice(m,e+1);
return s+"0."+zeros(-(e+1))+m;}`,
};

// Public table. Ids are fixed (append-only) inside 2320..2379; pending
// entries keep their reserved id so later waves do not renumber.
const table = [
  ['global', 'isNaN', 2320, 1, 'globalIsNaN'], ['global', 'isFinite', 2321, 1, 'globalIsFinite'],
  ['Math', 'sqrt', 2322, 1, 'mathSqrt'], ['Math', 'fround', 2323, 1, 'mathFround'], ['Math', 'clz32', 2324, 1, 'mathClz32'],
  ['Math', 'imul', 2325, 2, 'mathImul'], ['Math', 'hypot', 2326, 2, 'mathHypot'], ['Math', 'cbrt', 2327, 1, 'mathCbrt'],
  ['Math', 'f16round', 2328, 1, 'mathF16round'], ['Math', 'exp', 2329, 1, 'mathExp'], ['Math', 'expm1', 2330, 1, 'mathExpm1'],
  ['Math', 'log', 2331, 1, 'mathLog'], ['Math', 'log1p', 2332, 1, 'mathLog1p'], ['Math', 'log2', 2333, 1, 'mathLog2'],
  ['Math', 'log10', 2334, 1, 'mathLog10'], ['Math', 'sin', 2335, 1, 'mathSin'], ['Math', 'cos', 2336, 1, 'mathCos'],
  ['Math', 'tan', 2337, 1, 'mathTan'], ['Math', 'atan', 2338, 1, 'mathAtan'], ['Math', 'atan2', 2339, 2, 'mathAtan2'],
  ['Math', 'asin', 2340, 1, 'mathAsin'], ['Math', 'acos', 2341, 1, 'mathAcos'], ['Math', 'sinh', 2342, 1, 'mathSinh'],
  ['Math', 'cosh', 2343, 1, 'mathCosh'], ['Math', 'tanh', 2344, 1, 'mathTanh'], ['Math', 'asinh', 2345, 1, 'mathAsinh'],
  ['Math', 'acosh', 2346, 1, 'mathAcosh'], ['Math', 'atanh', 2347, 1, 'mathAtanh'],
  ['Number.prototype', 'toFixed', 2349, 1, 'numberToFixed'], ['Number.prototype', 'toExponential', 2350, 1, 'numberToExponential'],
  ['Number.prototype', 'toPrecision', 2351, 1, 'numberToPrecision'],
];
export const numericMethods = Object.freeze(table.map(([owner, name, id, length, field]) => Object.freeze({ owner, name, id, length, field, kind: 'method', source: sources[field] })));
// Reserved ids for explicit gaps (not installed; lookups stay Unsupported).
export const numericReserved = Object.freeze({ 'Math.random': 2348 });
export const numericIntrinsics = Object.freeze({ __lanesPrimitive: 129, __lanesNumber: 1164, __lanesNumberWord: 135, __lanesFromBits: 123, __lanesDescriptor: 112, __lanesCharCodeAt: 931, __lanesSlice: 933, __lanesThisNumber: 927 });
export const numericPending = Object.freeze([
  'Math.random',                      // no guest entropy source; stays Unsupported (status 6)
  'Number.prototype.toLocaleString',  // Intl-dependent; stays in boxing numberPrototypeUnsupported
]);
for (const m of numericMethods) if (m.id < NUMERIC_ID_FIRST || m.id > NUMERIC_ID_LAST || !m.source) throw new Error('numeric table: ' + m.name);
