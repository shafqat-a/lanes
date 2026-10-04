// Independent review probes for the local compiler fixes. Expected values are
// fixed semantic assertions; native execution is an oracle, not a GPU pass.
// Production guest execution remains on GPU; native oracle execution is test-only.
export const compilerReviewCases = [
  {
    feature: 'review-const-tdz-throwing-rhs-wins', input: 7, expected: 'rhs:7',
    source: `function f(x){function rhs(){throw x;}try{k=rhs();}catch(e){return Object.is(e,x)?"rhs:"+x:"wrong";}const k=1;return "missed";}`,
  },
  {
    feature: 'review-captured-const-tdz-throwing-rhs-wins', input: 7, expected: 'captured:7',
    allowSafariReferenceDifference: true, expectedForInput: input => 'captured:' + input,
    spec: 'https://tc39.es/ecma262/2025/multipage/ecmascript-language-expressions.html#sec-assignment-operators-runtime-semantics-evaluation',
    source: `function f(x){function rhs(){throw x;}function write(){k=rhs();}try{write();}catch(e){return Object.is(e,x)?"captured:"+x:"wrong";}const k=1;return "missed";}`,
  },
  {
    feature: 'review-initialized-const-logical-short-circuit', input: 7, expected: '0,1,7|dT|7',
    source: `function f(x){const a=0,b=1,c=x,d=null;let trace="";function rhs(s){trace+=s;return x;}a&&=rhs("a");b||=rhs("b");c??=rhs("c");try{d??=rhs("d");}catch(e){trace+=e instanceof TypeError?"T":"?";}return a+","+b+","+c+"|"+trace+"|"+x;}`,
  },
  {
    feature: 'review-continue-without-update', input: 7, expected: '8,9,10',
    source: `function f(x){const a=[];for(let i=0;i<3;){a.push(function(){return i+x;});i++;continue;}return a[0]()+","+a[1]()+","+a[2]();}`,
  },
  {
    feature: 'review-continue-without-test', input: 7, expected: '7,8,9',
    source: `function f(x){const a=[];for(let i=0;;i++){if(i===3)break;a.push(function(){return i+x;});continue;}return a[0]()+","+a[1]()+","+a[2]();}`,
  },
  {
    feature: 'review-continue-outer-label-from-nested-loop', input: 7, expected: '7,8,9|0:0;1:0;2:0;',
    source: `function f(x){const a=[];let trace="";outer:for(let i=0;i<3;i++){for(let j=0;j<2;j++){trace+=i+":"+j+";";a.push(function(){return i+j+x;});continue outer;}}return a[0]()+","+a[1]()+","+a[2]()+"|"+trace;}`,
  },
  {
    feature: 'review-continue-finally-mutates-head', input: 7, expected: '8,10,12|012',
    source: `function f(x){const a=[];let trace="";for(let i=0;i<6;i++){try{a.push(function(){return i+x;});continue;}finally{trace+=i/2;i++;}}return a[0]()+","+a[1]()+","+a[2]()+"|"+trace;}`,
  },
  {
    feature: 'review-continue-head-and-block-captures', input: 7, expected: '7:7,8:17,9:27',
    source: `function f(x){const a=[];for(let i=0;i<3;i++){let block=i*10;a.push(function(){return (i+x)+":"+(block+x);});continue;}return a[0]()+","+a[1]()+","+a[2]();}`,
  },
  {
    feature: 'review-continue-test-and-update-captures', input: 7, expected: '7,8,9,10|8,9,10',
    source: `function f(x){const tests=[],updates=[];for(let i=0;(tests.push(function(){return i+x;}),i<3);(updates.push(function(){return i+x;}),i++)){continue;}return tests[0]()+","+tests[1]()+","+tests[2]()+","+tests[3]()+"|"+updates[0]()+","+updates[1]()+","+updates[2]();}`,
  },
];
