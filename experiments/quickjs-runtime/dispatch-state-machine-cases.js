const c=(feature,body,expected,extra={})=>({feature:'dispatch-'+feature,source:`function f(x){${body}}`,input:3,expected,...extra});
export const dispatchStateMachineCases=Object.freeze([
 // Four entry opcodes + two g opcodes; request plumbing is not guest work.
 c('tail-call-guest-step-count','function g(v){return v;}return g(x);',3,{resumption:true,expectedSteps:6}),
 c('getter-setter-continuations','let log="";const o={get a(){log+="g";return 2;},set a(v){log+="s"+v;}};const result=(o.a+=x);return result+":"+log;', '5:gs5',{resumption:true}),
 c('native-accessor-inline','const s=Symbol("hello");const getter=Object.getOwnPropertyDescriptor(Symbol.prototype,"description").get;return getter.call(s)+":"+s.description;', 'hello:hello'),
 c('computed-key-kept-reference','let log="",n=0;const key={toString(){log+="k";return n++===0?"a":"b";}};const o={get a(){log+="g";return 2;},set b(v){log+="s"+v;}};const v=o[key]++;return v+":"+log;', '2:kgks3',{referenceDifference:{expected:'2:kg',spec:'https://tc39.es/ecma262/2025/multipage/ecmascript-language-expressions.html#sec-evaluate-property-access-with-expression-key'}}),
 c('bound-call-apply-tail','function add(a,b){return this.k+a+b;}const f=add.bind({k:4},2);function tail(){return f.apply(null,[3]);}return tail()+":"+f.call({k:99},5);', '9:11',{resumption:true}),
 c('construct-frame-and-inline','function A(v){this.v=v;}function B(v){this.v=0;return {v:v+1};}const X=A.bind(null,x);const a=new X(),b=new B(x),n=new Number(x);return a.v+":"+b.v+":"+n.valueOf()+":"+(a instanceof A);','3:4:3:true'),
 c('constructor-return-primitive','class A{constructor(v){this.v=v;return 5;}}class B extends A{constructor(v){super(v+1);this.w=2;}}const b=new B(x);return b.v+":"+b.w+":"+(b instanceof A);','4:2:true'),
 c('generator-inline-completed-and-frame','function* g(){try{yield x;return x+1;}finally{}}const a=g(),b=a.next(),d=a.next(),e=a.next();return b.value+":"+d.value+":"+d.done+":"+e.done+":"+e.value;','3:4:true:true:undefined',{resumption:true}),
 c('generator-throw-finally','let log="";function* g(){try{yield x;}finally{log+="f";yield x+1;}}const a=g();a.next();const b=a.throw(7);try{a.next();}catch(e){return log+":"+b.value+":"+e;}return "wrong";','f:4:7'),
 c('close-original-throw','const token={};let log="";const it={[Symbol.iterator](){return this;},next(){return{value:x,done:false};},get return(){log+="g";return function(){log+="r";throw 9;};}};try{for(const v of it)throw token;}catch(e){return(e===token)+":"+log;}return "wrong";','true:gr'),
 c('async-reject-catch-finally','let log="";async function g(){try{log+="a";await Promise.reject(x);}catch(e){log+="c"+e;}finally{log+="f";}return log;}return g();','ac3f',{settlement:'fulfilled',resumption:true}),
 c('promise-thenable-job','let log="";return Promise.resolve({then(resolve){log+="t";resolve(x);throw 9;}}).then(v=>{log+="h";return v+1;}).then(v=>log+":"+v);','th:4',{settlement:'fulfilled'}),
 c('async-generator-request-queue','async function* g(){try{yield x;yield x+1;}finally{}}const a=g(),p=a.next(),q=a.next(),r=a.return(9);return Promise.all([p,q,r]).then(v=>v[0].value+":"+v[1].value+":"+v[2].value+":"+v[2].done);','3:4:9:true',{settlement:'fulfilled'}),
 c('for-await-close-awaits','let log="";const it={[Symbol.asyncIterator](){return this;},next(){return Promise.resolve({value:x,done:false});},return(){return Promise.resolve().then(()=>{log+="r";return {done:true};});}};async function g(){for await(const v of it){log+="b";break;}return log;}return g();','br',{settlement:'fulfilled'}),
 c('job-argument-and-result-roots','return Promise.resolve({v:x}).then(o=>{for(let i=0;i<700;i++){const garbage={i:i};}return {v:o.v+1};}).then(o=>o.v);',4,{settlement:'fulfilled',requiresGC:true}),
]);
