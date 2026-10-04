// Number exponentiation adapted from Sun fdlibm e_pow.c, version 1.5 (2004-04-22).
// Primary source: https://netlib.org/fdlibm/e_pow.c
//
// Copyright (C) 2004 by Sun Microsystems, Inc. All rights reserved.
// Permission to use, copy, modify, and distribute this software is freely
// granted, provided that this notice is preserved.
//
// Guest JavaScript is compiled and executed by the WGSL VM. Host evaluation is
// confined to the checker. Word intrinsics expose binary64 bits, never f32.
// The sqrt fast path is omitted: exponent 0.5 uses the general fdlibm algorithm.
export const numberPowSource = `function numberPowBootstrap(base, exponent) {
  "use strict";
  const left = __lanesPrimitive(base, false);
  if (typeof left === "bigint") return __lanesUnsupported();
  const x = __lanesNumber(left);
  const right = __lanesPrimitive(exponent, false);
  if (typeof right === "bigint") return __lanesUnsupported();
  const y = __lanesNumber(right);
  function high(value) { return __lanesNumberWord(value, true) | 0; }
  function low(value) { return __lanesNumberWord(value, false) >>> 0; }
  function clearLow(value) { return __lanesFromBits(0, high(value) >>> 0); }
  function replaceHigh(value, word) { return __lanesFromBits(low(value), word >>> 0); }
  const hx=high(x), hy=high(y), lx=low(x), ly=low(y);
  let ix=hx&0x7fffffff;
  const iy=hy&0x7fffffff;
  // ES2025 checks exponent NaN before zero, then base NaN. NaN ** 0 is 1.
  if (y !== y) return NaN;
  if (y === 0) return 1;
  if (x !== x) return NaN;
  let yisint=0;
  let j=0, k=0;
  if (hx<0) {
    if (iy>=0x43400000) yisint=2;
    else if (iy>=0x3ff00000) {
      k=(iy>>20)-0x3ff;
      if (k>20) {
        j=ly>>>(52-k);
        if (((j<<(52-k))>>>0)===ly) yisint=2-(j&1);
      } else if (ly===0) {
        j=iy>>>(20-k);
        if ((j<<(20-k))===iy) yisint=2-(j&1);
      }
    }
  }
  if (ly===0) {
    if (iy===0x7ff00000) {
      if (((ix-0x3ff00000)|lx)===0) return NaN;
      if (ix>=0x3ff00000) return hy>=0 ? Infinity : 0;
      return hy<0 ? Infinity : 0;
    }
    if (iy===0x3ff00000) return hy<0 ? 1/x : x;
    if (hy===0x40000000) return x*x;
  }
  let ax = hx<0 ? -x : x;
  let z=0;
  if (lx===0 && (ix===0x7ff00000 || ix===0 || ix===0x3ff00000)) {
    z=ax;
    if (hy<0) z=1/z;
    if (hx<0) {
      if (((ix-0x3ff00000)|yisint)===0) return NaN;
      if (yisint===1) z=-z;
    }
    return z;
  }
  if (hx<0 && yisint===0) return NaN;
  const sign = hx<0 && yisint===1 ? -1 : 1;
  let t1=0,t2=0,t=0,w=0,u=0,v=0,n=0;
  if (iy>0x41e00000) {
    if (iy>0x43f00000) {
      if (ix<=0x3fefffff) return hy<0 ? Infinity : 0;
      if (ix>=0x3ff00000) return hy>0 ? Infinity : 0;
    }
    if (ix<0x3fefffff) return hy<0 ? sign*Infinity : sign*0;
    if (ix>0x3ff00000) return hy>0 ? sign*Infinity : sign*0;
  }
  // Use the full split-log path even for |y| > 2^31. The original Taylor
  // shortcut loses hundreds of ULP near unity for large finite exponents.
  {
    if (ix<0x00100000) { ax*=9007199254740992; n-=53; ix=high(ax); }
    n+=(ix>>20)-0x3ff;
    j=ix&0x000fffff;
    ix=j|0x3ff00000;
    if (j<=0x3988e) k=0;
    else if (j<0xbb67a) k=1;
    else { k=0;n++;ix-=0x00100000; }
    ax=replaceHigh(ax,ix);
    const bp=k===0 ? 1 : 1.5;
    const dpHigh=k===0 ? 0 : 5.84962487220764160156e-01;
    const dpLow=k===0 ? 0 : 1.35003920212974897128e-08;
    u=ax-bp;
    v=1/(ax+bp);
    const ss=u*v;
    const sh=clearLow(ss);
    let th=__lanesFromBits(0,(((ix>>1)|0x20000000)+0x00080000+(k<<18))>>>0);
    let tl=ax-(th-bp);
    const sl=v*((u-sh*th)-sh*tl);
    let s2=ss*ss;
    let r=s2*s2*(5.99999999999994648725e-01+s2*(4.28571428578550184252e-01+s2*(3.33333329818377432918e-01+s2*(2.72728123808534006489e-01+s2*(2.30660745775561754067e-01+s2*2.06975017800338417784e-01)))));
    r+=sl*(sh+ss);
    s2=sh*sh;
    th=clearLow(3+s2+r);
    tl=r-((th-3)-s2);
    u=sh*th;
    v=sl*th+tl*ss;
    const ph=clearLow(u+v);
    const pl=v-(ph-u);
    const zh=9.61796700954437255859e-01*ph;
    const zl=-7.02846165095275826516e-09*ph+pl*9.61796693925975554329e-01+dpLow;
    t=n;
    t1=clearLow(((zh+zl)+dpHigh)+t);
    t2=zl-(((t1-t)-dpHigh)-zh);
  }
  const y1=clearLow(y);
  const pl=(y-y1)*t1+y*t2;
  let ph=y1*t1;
  z=pl+ph;
  j=high(z);
  let i=low(z);
  if (j>=0x40900000) {
    if (((j-0x40900000)|i)!==0 || pl+8.0085662595372944372e-17>z-ph) return sign*Infinity;
  } else if ((j&0x7fffffff)>=0x4090cc00) {
    if (((j-0xc090cc00)|i)!==0 || pl<=z-ph) return sign*0;
  }
  i=j&0x7fffffff;
  k=(i>>20)-0x3ff;
  n=0;
  if (i>0x3fe00000) {
    n=j+(0x00100000>>(k+1));
    k=((n&0x7fffffff)>>20)-0x3ff;
    t=__lanesFromBits(0,(n&~(0x000fffff>>k))>>>0);
    n=((n&0x000fffff)|0x00100000)>>(20-k);
    if (j<0) n=-n;
    ph-=t;
  }
  t=clearLow(pl+ph);
  u=t*6.93147182464599609375e-01;
  v=(pl-(t-ph))*6.93147180559945286227e-01+t*-1.90465429995776804525e-09;
  z=u+v;
  w=v-(z-u);
  t=z*z;
  t1=z-t*(1.66666666666666019037e-01+t*(-2.77777777770155933842e-03+t*(6.61375632143793436117e-05+t*(-1.65339022054652515390e-06+t*4.13813679705723846039e-08))));
  const r=(z*t1)/(t1-2)-(w+z*w);
  z=1-(r-z);
  j=high(z)+(n<<20);
  // fdlibm scalbn's subnormal path: scale in the normal range first, then
  // multiply by 2^-54 for one correctly rounded final underflow operation.
  if ((j>>20)<=0) z=replaceHigh(z,high(z)+((n+54)<<20))*5.55111512312578270212e-17;
  else z=replaceHigh(z,j);
  return sign*z;
}`;
export const numberPowIntrinsics = Object.freeze({ __lanesNumber:122, __lanesNumberWord:135, __lanesFromBits:123, __lanesPrimitive:129, __lanesUnsupported:141 });
