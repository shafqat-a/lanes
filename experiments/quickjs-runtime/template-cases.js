// Template literal fixtures (ES2025 13.2.8.6). `expected` values are fixed
// ECMAScript results; the host oracle only confirms them. Untagged templates
// must evaluate each substitution, then ToString it (ToPrimitive hint string:
// toString before valueOf), before evaluating the next substitution, and must
// not depend on String.prototype.concat. `regression: true` marks cases that
// the pinned (unpatched) QuickJS concat lowering gets wrong.
export const templateCases = [
  { feature: 'order-getter-then-tostring-interleaved', regression: true, input: 1, expected: 'AaBb:p-q1',
    source: 'function f(x){let log="";const o={get a(){log+="A";return {toString(){log+="a";return "p";}};},get b(){log+="B";return {toString(){log+="b";return "q"+x;}};}};const s=`${o.a}-${o.b}`;return log+":"+s;}' },
  { feature: 'tostring-before-later-substitution-read', regression: true, input: 2, expected: 'o20',
    source: 'function f(x){let n=x;const o={toString(){n=n*10;return "o";}};return `${o}${n}`;}' },
  { feature: 'throwing-tostring-aborts-later-substitution', regression: true, input: 4, expected: 'a4',
    source: 'function f(x){let log="";const a={toString(){log+="a";throw x;}};function b(){log+="b";return 1;}try{return "ok"+`${a}${b()}`;}catch(e){return log+e;}}' },
  { feature: 'user-string-prototype-concat-not-used', regression: true, usesConcat: true, input: 5, expected: 'c5d',
    source: 'function f(x){const old=String.prototype.concat;String.prototype.concat=function(){return "hijack";};const r=`c${x}d`;String.prototype.concat=old;return r;}' },
  { feature: 'tostring-preferred-over-valueof', input: 3, expected: '[s3]t',
    source: 'function f(x){let log="";const o={toString(){log+="t";return "s"+x;},valueOf(){log+="v";return 0;}};return `[${o}]`+log;}' },
  { feature: 'valueof-fallback-tostring-not-callable', input: 6, expected: '<12>',
    source: 'function f(x){const o={toString:42,valueOf(){return x*2;}};return `<${o}>`;}' },
  { feature: 'valueof-fallback-tostring-returns-object', input: 7, expected: 'w7!tv',
    source: 'function f(x){let log="";const o={toString(){log+="t";return {};},valueOf(){log+="v";return "w"+x;}};return `${o}!`+log;}' },
  { feature: 'nested-templates', input: 8, expected: '(<8>|16nm7)',
    source: 'function f(x){return `(${`<${x}>`}|${`${x*2}`}${`n${`m${x-1}`}`})`;}' },
  { feature: 'templates-in-arrow-and-closure', input: 9, expected: 'h10:9|0:9',
    source: 'function f(x){const g=y=>`${y}:${x}`;const h=function(){return `h${g(x+1)}`;};return h()+"|"+g(0);}' },
  { feature: 'template-closures-per-iteration', input: 3, expected: '031323',
    source: 'function f(x){const a=[];for(let i=0;i<3;i++)a[i]=()=>`${i}${x}`;return a[0]()+a[1]()+a[2]();}' },
  { feature: 'empty-cooked-strings', input: 7, expected: '77/1',
    source: 'function f(x){const e="";return `${x}${x}${e}${""}`+"/"+`${x}`.length;}' },
  { feature: 'substitution-only-is-string', input: 4, expected: 'string4true',
    source: 'function f(x){const s=`${x}`;return typeof s+s+(s===String(x));}' },
  { feature: 'unicode-and-escape-cooked-strings', input: 9, expected: '6:A9\u{1F600}B\n',
    source: 'function f(x){const s=`\\u0041${x}\\u{1F600}\\x42\\n`;return s.length+":"+s;}' },
  { feature: 'primitive-formatting', input: 3, expected: '3|1.5|true|null|undefined|false',
    source: 'function f(x){return `${x}|${x/2}|${x>2}|${null}|${undefined}|${x<0}`;}' },
  { feature: 'negative-zero-formats-as-0', input: 2, expected: '[0]2',
    source: 'function f(x){return `[${-0*x}]${x}`;}' },
  { feature: 'negative-infinity-nan-formatting', input: 5, expected: '-5|Infinity|NaN',
    source: 'function f(x){return `${-x}|${x/0}|${0/0}`;}' },
  { feature: 'object-and-array-intrinsic-tostring', input: 6, expected: '[object Object]|1,6',
    source: 'function f(x){return `${{}}|${[1,x]}`;}' },
  { feature: 'string-wrapper-substitution', input: 5, expected: 'S:b5',
    source: 'function f(x){return `S:${new String("b"+x)}`;}' },
  { feature: 'length-below-gpu-string-limit', input: 12, expected: '253:2',
    source: 'function f(x){let t="";for(let i=0;i<250;i++)t+="a";const s=`${t}${x}|`;return s.length+":"+s[251];}' },
  { feature: 'length-at-gpu-string-limit', input: 123, expected: '256:3',
    source: 'function f(x){let t="";for(let i=0;i<252;i++)t+="a";const s=`${t}${x}|`;return s.length+":"+s[254];}' },
];

// Results exceed the GPU string limit (256 UTF-16 code units): the expected GPU
// outcome is runtime status 3 (Resource limit); `expected` is the ECMAScript value.
export const templateResourceLimitCases = [
  { feature: 'length-over-gpu-string-limit', input: 1234, expected: '257:4', expectedStatus: 3,
    source: 'function f(x){let t="";for(let i=0;i<252;i++)t+="a";const s=`${t}${x}|`;return s.length+":"+s[255];}' },
];

// ToString throws TypeError during substitution; caught in-guest.
export const templateTypeErrorCases = [
  { feature: 'tostring-and-valueof-return-objects', input: 2, expected: 'truetv2',
    source: 'function f(x){let log="";const o={toString(){log+="t";return {};},valueOf(){log+="v";return [];}};try{return `${o}`;}catch(e){return (e instanceof TypeError)+log+x;}}' },
  { feature: 'null-prototype-object', input: 3, expected: 'TE3',
    source: 'function f(x){const o=Object.create(null);try{return `a${o}`;}catch(e){return (e instanceof TypeError?"TE":"other")+x;}}' },
  { feature: 'typeerror-aborts-later-substitution', regression: true, input: 4, expected: 'TE:4',
    source: 'function f(x){let log="";const o={toString(){return {};},valueOf(){return {};}};try{return `${o}${(log+="later",x)}`;}catch(e){return e instanceof TypeError?"TE:"+log+x:"no";}}' },
  // Symbol interpolation applies ToString and throws guest TypeError.
  { feature: 'symbol-substitution-typeerror', input: 5, expected: 'sym5',
    source: 'function f(x){try{return `${Symbol("s")}`;}catch(e){return (e instanceof TypeError?"sym":"no")+x;}}' },
];

// Formerly compiler-rejected tagged templates. Admitted since the Phase 4 next
// wave (bridge feature tagged-template-v1, phase4-templates.js); the name is
// kept for check-template-lowering.mjs, the suites treat them as value cases.
export const templateRejectedCases = [
  { feature: 'tagged-template-with-substitution', input: 1, expected: 'a1b2',
    source: 'function f(x){function tag(s,v){return s[0]+v+s[1]+s.raw.length;}return tag`a${x}b`;}' },
  { feature: 'tagged-template-no-substitution', input: 2, expected: 'r\\n2',
    source: 'function f(x){function tag(s){return s.raw[0]+x;}return tag`r\\n`;}' },
  { feature: 'string-raw', input: 3, expected: 'p\\t3',
    source: 'function f(x){return String.raw`p\\t${x}`;}' },
  { feature: 'member-tag', input: 4, expected: 'm4',
    source: 'function f(x){const o={t(s,v){return this===o?s[0]+v:"bad";}};return o.t`m${x}`;}' },
];
