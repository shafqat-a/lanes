// Regression fixtures for the local QuickJS compiler patches (see
// compiler-correctness-notes.md). `expected` values are fixed ECMAScript results;
// the V8 host oracle and a native QuickJS interpreter only confirm them.
// `bug` groups a case; `regression: true` marks cases that give a wrong result
// with the unpatched vendor/quickjs.c (checked with --baseline); other cases are
// controls or neighbouring paths. `admission` is compile-time status only.
const kind = 'e instanceof ReferenceError?"ref":e instanceof TypeError?"type":"other"';
const constTdz = [
  { feature: 'const-tdz-plain-assign', regression: true, input: 1, expected: 'plain-ref1',
    source: `function f(x){try{k=x;}catch(e){return "plain-"+(${kind})+x;}const k=1;return "none";}` },
  { feature: 'const-tdz-compound-add', input: 2, expected: 'add-ref2',
    source: `function f(x){try{k+=x;}catch(e){return "add-"+(${kind})+x;}const k=1;return "none";}` },
  { feature: 'const-tdz-postfix-inc', input: 3, expected: 'post-ref3',
    source: `function f(x){try{k++;}catch(e){return "post-"+(${kind})+x;}const k=1;return "none";}` },
  { feature: 'const-tdz-prefix-inc', input: 4, expected: 'pre-ref4',
    source: `function f(x){try{++k;}catch(e){return "pre-"+(${kind})+x;}const k=1;return "none";}` },
  { feature: 'const-tdz-inner-block', regression: true, input: 5, expected: 'block-ref5',
    source: `function f(x){let r="none";{try{k=x;}catch(e){r="block-"+(${kind})+x;}const k=0;}return r;}` },
  { feature: 'const-tdz-arrow-closure-before-init', regression: true, input: 6, expected: 'arrow-ref6',
    source: `function f(x){const g=()=>{k=x;};try{g();}catch(e){return "arrow-"+(${kind})+x;}const k=1;return "none";}` },
  { feature: 'const-tdz-funcexpr-closure-before-init', regression: true, input: 7, expected: 'fexpr-ref7',
    source: `function f(x){const g=function(){k=x;};try{g();}catch(e){return "fexpr-"+(${kind})+x;}const k=1;return "none";}` },
  { feature: 'const-tdz-closure-two-levels', regression: true, input: 8, expected: 'deep-ref8',
    source: `function f(x){function g(){return function(){k=x;};}const h=g();try{h();}catch(e){return "deep-"+(${kind})+x;}const k=1;return "none";}` },
  { feature: 'const-closure-after-init-typeerror', input: 9, expected: 'late-type18',
    source: `function f(x){const g=()=>{k=x;};const k=x*2;try{g();}catch(e){return "late-"+(${kind})+k;}return "none";}` },
  { feature: 'const-closure-before-and-after-init', regression: true, input: 10, expected: 'ref:type10',
    source: `function f(x){let s="";const g=function(){k=x;};try{g();}catch(e){s+=(${kind});}const k=x;try{g();}catch(e){s+=":"+(${kind});}return s+k;}` },
  { feature: 'const-local-after-init-typeerror', input: 11, expected: 'init-type11',
    source: `function f(x){const k=x;try{k-=1;}catch(e){return "init-"+(${kind})+k;}return "none";}` },
  { feature: 'const-tdz-rhs-side-effect-first', regression: true, input: 12, expected: 'rhs-ref13',
    source: `function f(x){let y=0;try{k=(y=x+1);}catch(e){return "rhs-"+(${kind})+y;}const k=1;return "none";}` },
  { feature: 'const-tdz-switch-fallthrough', regression: true, input: 13, expected: 'sw-ref13',
    source: `function f(x){switch(x){case 13:try{k=x;}catch(e){return "sw-"+(${kind})+x;}case 0:const k=1;return "fell";}return "nomatch"+x;}` },
  { feature: 'const-tdz-for-body', regression: true, input: 14, expected: 'loop-ref0ref114',
    source: `function f(x){let s="";for(let i=0;i<2;i++){try{k=i;}catch(e){s+=(${kind})+i;}const k=x;}return "loop-"+s+x;}` },
  { feature: 'const-tdz-error-name', regression: true, input: 15, expected: 'name-ReferenceError15',
    source: `function f(x){try{k=x;}catch(e){return "name-"+e.name+x;}const k=1;return "none";}` },
  { feature: 'const-init-error-name', input: 16, expected: 'iname-TypeError16',
    source: `function f(x){const k=x;try{k++;}catch(e){return "iname-"+e.name+k;}return "none";}` },
  // Strict assignment to a function expression's own name: an immutable binding
  // that is always initialized, so it keeps the unchecked TypeError path.
  { feature: 'strict-funcexpr-name-assign-typeerror', input: 17, expected: 'fn-TypeError17', uncheckedReadOnly: true,
    source: `function f(x){"use strict";const g=function h(){h=x;};try{g();}catch(e){return "fn-"+e.name+x;}return "none";}` },
];
// `sharedWouldGive` is the oracle result with every `for(let`/`for(const` head
// rewritten to `for(var` (one shared binding); the check recomputes it. It must
// differ from `expected` unless the case is a `control`.
const forLetContinue = [
  { feature: 'for-let-continue-per-iteration', input: 1, expected: '1,2,3', sharedWouldGive: '4,4,4',
    source: `function f(x){const a=[];for(let i=0;i<3;i++){a[i]=function(){return i+x;};if(i<3)continue;}return a[0]()+","+a[1]()+","+a[2]();}` },
  { feature: 'for-let-continue-unconditional', input: 2, expected: 'u024', sharedWouldGive: 'u666',
    source: `function f(x){const a=[];for(let i=0;i<3;i++){a[i]=function(){return i*x;};continue;}return "u"+a[0]()+a[1]()+a[2]();}` },
  // Even iterations continue, odd ones fall through to the old close_loc.
  { feature: 'for-let-continue-conditional-mixed', input: 10, expected: '10-11-12-13', sharedWouldGive: '14-14-14-14',
    source: `function f(x){const a=[];for(let i=0;i<4;i++){a[i]=function(){return i+x;};if(i%2===0)continue;}return a[0]()+"-"+a[1]()+"-"+a[2]()+"-"+a[3]();}` },
  // No update expression: continue goes through the close to the test.
  { feature: 'for-let-continue-no-update', input: 3, expected: 'nu3,6,9|4,5,6', sharedWouldGive: 'nu9,9,9|6,6,6',
    source: `function f(x){const a=[],b=[];for(let i=0;i<3;){a[i]=function(){return i*x;};i++;b[i-1]=function(){return i+x;};continue;}return "nu"+a[0]()+","+a[1]()+","+a[2]()+"|"+b[0]()+","+b[1]()+","+b[2]();}` },
  { feature: 'for-let-continue-no-test-break', input: 5, expected: 'ib567', sharedWouldGive: 'ib777',
    source: `function f(x){const a=[];for(let i=0;;i++){a[i]=function(){return i+x;};if(i<2)continue;break;}return "ib"+a[0]()+a[1]()+a[2]();}` },
  { feature: 'for-let-continue-no-test-no-update', input: 6, expected: 'nn6,7,8', sharedWouldGive: 'nn8,8,8',
    source: `function f(x){const a=[];for(let i=0;;){a[i]=function(){return i+x;};i++;if(i<3)continue;break;}return "nn"+(a[0]()-1)+","+(a[1]()-1)+","+(a[2]()-1);}` },
  { feature: 'for-let-labeled-continue-same-loop', input: 4, expected: 'ls432', sharedWouldGive: 'ls111',
    source: `function f(x){const a=[];L:for(let i=0;i<3;i++){a[i]=function(){return x-i;};continue L;}return "ls"+a[0]()+a[1]()+a[2]();}` },
  // Every outer iteration ends with `continue outer` from inside for(let j).
  { feature: 'for-let-labeled-continue-from-inner-for-let', input: 7, expected: 'lo7:00 10 11 20 21 22 ', sharedWouldGive: 'lo7:32 32 32 32 32 32 ',
    source: `function f(x){const a=[];let n=0;outer:for(let i=0;i<3;i++){for(let j=0;j<3;j++){a[n++]=function(){return ""+i+j;};if(j===i)continue outer;}}let s="lo"+x+":";for(let k=0;k<n;k++){s+=a[k]()+" ";}return s;}` },
  { feature: 'for-let-labeled-continue-from-inner-while', input: 6, expected: 'lw1,8,15', sharedWouldGive: 'lw19,20,21',
    source: `function f(x){const a=[];W:for(let i=0;i<3;i++){let k=0;while(true){a[i]=function(){return i*x+k;};k++;if(k>i)continue W;}}return "lw"+a[0]()+","+a[1]()+","+a[2]();}` },
  { feature: 'for-let-continue-in-try-finally', input: 3, expected: 'tf012:345', sharedWouldGive: 'tf012:666',
    source: `function f(x){const a=[];let log="";for(let i=0;i<3;i++){try{a[i]=function(){return i+x;};continue;}finally{log+=i;}}return "tf"+log+":"+a[0]()+a[1]()+a[2]();}` },
  { feature: 'for-let-labeled-continue-through-finally', input: 2, expected: 'lf01:2,3', sharedWouldGive: 'lf01:4,4',
    source: `function f(x){const a=[];let log="";L:for(let i=0;i<2;i++){for(let j=0;j<1;j++){try{a[i]=function(){return i+x;};continue L;}finally{log+=i;}}}return "lf"+log+":"+a[0]()+","+a[1]();}` },
  { feature: 'for-let-continue-in-catch', input: 8, expected: 'c0:0/2:8/4:16', sharedWouldGive: 'c0:24/2:24/4:24',
    source: `function f(x){const a=[];for(let i=0;i<3;i++){try{throw i*2;}catch(e){a[i]=function(){return e+":"+i*x;};continue;}}return "c"+a[0]()+"/"+a[1]()+"/"+a[2]();}` },
  // Block-scoped t was already closed by the continue path; only i was affected.
  { feature: 'for-let-continue-from-nested-block', input: 9, expected: 'bk0.0,9.1,18.2', sharedWouldGive: 'bk0.3,9.3,18.3',
    source: `function f(x){const a=[];for(let i=0;i<3;i++){{let t=i*x;a[i]=function(){return t+"."+i;};continue;}}return "bk"+a[0]()+","+a[1]()+","+a[2]();}` },
  // h[i] is created in the update after the per-iteration copy.
  { feature: 'for-let-continue-closure-in-update', input: 1, expected: 'up1,2,3|11,21,31', sharedWouldGive: 'up4,4,4|31,31,31',
    source: `function f(x){const a=[],h=[];for(let i=0;i<3;h[i]=function(){return i*10+x;},i++){a[i]=function(){return i+x;};continue;}return "up"+a[0]()+","+a[1]()+","+a[2]()+"|"+h[0]()+","+h[1]()+","+h[2]();}` },
  { feature: 'for-let-continue-two-vars', input: 2, expected: 'tv2/10,3/9,4/8', sharedWouldGive: 'tv5/7,5/7,5/7',
    source: `function f(x){const a=[];for(let i=0,j=10;i<3;i++,j--){a[i]=function(){return (i+x)+"/"+j;};continue;}return "tv"+a[0]()+","+a[1]()+","+a[2]();}` },
  // Each closure mutates its own copy: a[0] twice -> 1,2; a[1] -> 2; a[2] -> 3.
  { feature: 'for-let-continue-closure-mutates-copy', input: 5, expected: 'm3226', sharedWouldGive: 'm7659',
    source: `function f(x){const a=[];for(let i=0;i<3;i++){a[i]=function(){return ++i;};continue;}const p=a[0](),q=a[0](),r=a[1](),s=a[2]();return "m"+(p+10*q+100*r+1000*s+x);}` },
  { feature: 'for-let-continue-no-capture-control', control: true, input: 3, expected: 'nc18', sharedWouldGive: 'nc18',
    source: `function f(x){let s=0;for(let i=0;i<6;i++){if(i%2)continue;s+=i*x;}return "nc"+s;}` },
  { feature: 'for-var-continue-shared-control', control: true, input: 4, expected: 'v12,12,12', sharedWouldGive: 'v12,12,12',
    source: `function f(x){const a=[];for(var i=0;i<3;i++){a[i]=function(){return i*x;};continue;}return "v"+a[0]()+","+a[1]()+","+a[2]();}` },
  // QuickJS already closes the for-of/for-in per-iteration scope on continue (their
  // break entry scope_level is outside the loop scope). Admitted since Phase 4
  // (for_of_* and for_in_* opcodes); previously native-only controls.
  { feature: 'for-of-const-continue-per-iteration', control: true, admission: 'admitted', input: 2, expected: 'of2,4,6', sharedWouldGive: 'of6,6,6',
    source: `function f(x){const a=[];for(const v of [1,2,3]){a[a.length]=function(){return v*x;};continue;}return "of"+a[0]()+","+a[1]()+","+a[2]();}` },
  { feature: 'for-in-const-continue-per-iteration', control: true, admission: 'admitted', input: 3, expected: 'inp3,q3,r3', sharedWouldGive: 'inr3,r3,r3',
    source: `function f(x){const a=[];for(const k in {p:1,q:2,r:3}){a[a.length]=function(){return k+x;};continue;}return "in"+a[0]()+","+a[1]()+","+a[2]();}` },
];
export const compilerCorrectnessCases = [
  ...constTdz.map(c => ({ bug: 'const-tdz', admission: 'admitted', ...c })),
  ...forLetContinue.map(c => ({ bug: 'for-let-continue', admission: 'admitted', regression: !c.control, ...c })),
];
