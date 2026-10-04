// Guest-observable protocol fixtures. Each source is one synchronous function
// declaration. Results are strings or numbers. `throws` means the function
// catches the guest exception and returns a sentinel. `unsupported` is only
// the known gap list (Symbol.match and Symbol.species).

const cases = Object.freeze([
  Object.freeze({
    id: 'prim-hint-default',
    outcome: 'value',
    expected: 'default',
    source: `function f(){let seen='';const o={[Symbol.toPrimitive](hint){seen=hint;return 1;}};const n=o+0;return seen;}`,
  }),
  Object.freeze({
    id: 'prim-hint-number-string',
    outcome: 'value',
    expected: 'number,string:7:s',
    source: `function f(){const hints=[];const o={[Symbol.toPrimitive](hint){hints.push(hint);return hint==='number'?7:'s';}};const n=Number(o);const s=String(o);return hints.join(',')+':'+n+':'+s;}`,
  }),
  Object.freeze({
    id: 'prim-getter-throw',
    outcome: 'throws',
    expected: 'getter',
    source: `function f(){const o={};Object.defineProperty(o,Symbol.toPrimitive,{get(){throw new Error('boom');}});try{return ''+o;}catch(e){return e.message==='boom'?'getter':'other';}}`,
  }),
  Object.freeze({
    id: 'prim-returns-object',
    outcome: 'throws',
    expected: 'nonprimitive',
    source: `function f(){const o={[Symbol.toPrimitive](){return {a:1};}};try{return Number(o);}catch(e){return e instanceof TypeError?'nonprimitive':'other';}}`,
  }),
  Object.freeze({
    id: 'prim-noncallable',
    outcome: 'throws',
    expected: 0,
    source: `function f(){const o={n:0,valueOf(){this.n++;return 1;},toString(){this.n++;return 'x';}};Object.defineProperty(o,Symbol.toPrimitive,{value:'nope'});try{return o+1;}catch(e){return o.n;}}`,
  }),
  Object.freeze({
    id: 'prim-ordinary-order',
    outcome: 'value',
    expected: 'valueOf,toString:z1',
    source: `function f(){let log='';const o={valueOf(){log+='valueOf';return {};},toString(){log+=',toString';return 'z';}};const r=o+1;return log+':'+r;}`,
  }),
  Object.freeze({
    id: 'iter-custom-for-of',
    outcome: 'value',
    expected: 'ab',
    source: `function f(){const o={[Symbol.iterator](){let i=0;const data=['a','b'];return {next(){if(i<data.length)return {value:data[i++],done:false};return {done:true};}};}};let s='';for(const c of o)s+=c;return s;}`,
  }),
  Object.freeze({
    id: 'iter-open-order',
    outcome: 'value',
    expected: 'get-iter,call-iter,get-next,get-done,get-value',
    source: `function f(){const log=[];const iterable={get [Symbol.iterator](){log.push('get-iter');return function(){log.push('call-iter');return {get next(){log.push('get-next');return function(){return {get done(){log.push('get-done');return false;},get value(){log.push('get-value');return 1;}};};}};};}};for(const v of iterable)return log.join(',');return 'empty';}`,
  }),
  Object.freeze({
    id: 'iter-next-noncallable',
    outcome: 'throws',
    expected: 'next',
    source: `function f(){const o={[Symbol.iterator](){return {next:0};}};try{for(const x of o)return 'loop';return 'done';}catch(e){return e instanceof TypeError?'next':'other';}}`,
  }),
  Object.freeze({
    id: 'close-break-return',
    outcome: 'value',
    expected: 'return',
    source: `function f(){let log='';const o={[Symbol.iterator](){return {next(){return {value:1,done:false};},return(){log+='return';return {done:true};}};}};for(const v of o)break;return log;}`,
  }),
  Object.freeze({
    id: 'close-throw-original',
    outcome: 'throws',
    expected: 'return:original',
    source: `function f(){let log='';const o={[Symbol.iterator](){return {next(){return {value:1,done:false};},return(){log+='return';throw new Error('from-return');}};}};try{for(const v of o)throw new Error('original');}catch(e){return log+':'+e.message;}return 'no-throw';}`,
  }),
  Object.freeze({
    id: 'iter-destructure-rest',
    outcome: 'value',
    expected: '10,30,40:50',
    source: `function f(){const vals=[10,20,30,40,50];let i=0;const o={[Symbol.iterator](){return {next(){if(i<vals.length)return {value:vals[i++],done:false};return {done:true};}};}};const [a,,c,...rest]=o;return ''+a+','+c+','+rest.join(':');}`,
  }),
  Object.freeze({
    id: 'spread-arr-values',
    outcome: 'value',
    expected: '1,2',
    source: `function f(){return [...[1,2]].join(',');}`,
  }),
  Object.freeze({
    id: 'str-surrogate',
    outcome: 'value',
    expected: 3,
    source: `function f(){return [...'a\\uD83D\\uDE00b'].length;}`,
  }),
  Object.freeze({
    id: 'arr-iterator-override',
    outcome: 'value',
    expected: '1:X1X2',
    source: `function f(){const saved=Array.prototype[Symbol.iterator];let used=0;Array.prototype[Symbol.iterator]=function(){used=1;let i=0;const a=this;return {next(){if(i<a.length)return {value:'X'+a[i++],done:false};return {done:true};}};};try{let s='';for(const v of [1,2])s+=v;return used+':'+s;}finally{Array.prototype[Symbol.iterator]=saved;}}`,
  }),
  Object.freeze({
    id: 'prim-computed-method-key',
    outcome: 'value',
    expected: 'yes',
    source: `function f(){const key={[Symbol.toPrimitive](hint){return 'k'+hint;}};const box={[key]:'yes'};return box.kstring;}`,
  }),
  Object.freeze({
    id: 'name-symbol-method',
    outcome: 'value',
    expected: 'callable',
    source: `function f(){const o={[Symbol.iterator](){return 'ok';}};const fn=o[Symbol.iterator];if(typeof fn!=='function'||fn()!=='ok')return 'bad';try{const name=fn.name;if(typeof name==='string'&&name!==''&&name!=='[Symbol.iterator]')return 'bad-name';}catch(e){return 'callable';}return 'callable';}`,
  }),
  Object.freeze({
    id: 'inst-custom-both',
    outcome: 'value',
    expected: 'true,false',
    source: `function f(){function P(){}Object.defineProperty(P,Symbol.hasInstance,{configurable:true,value:function(v){return v===1;}});return (1 instanceof P)+','+(2 instanceof P);}`,
  }),
  Object.freeze({
    id: 'inst-inherited',
    outcome: 'value',
    expected: 'true,false',
    source: `function f(){function C(){}const mid=Object.create(Object.getPrototypeOf(C));Object.defineProperty(mid,Symbol.hasInstance,{configurable:true,value:function(v){return v===3;}});Object.setPrototypeOf(C,mid);return (3 instanceof C)+','+(4 instanceof C);}`,
  }),
  Object.freeze({
    id: 'inst-ordinary',
    outcome: 'value',
    expected: 'true,false',
    source: `function f(){function C(){}const o=Object.create(C.prototype);return (o instanceof C)+','+({} instanceof C);}`,
  }),
  Object.freeze({
    id: 'inst-bound',
    outcome: 'value',
    expected: 'true,true,false',
    source: `function f(){function C(){}const B=C.bind(null);const o=Object.create(C.prototype);return (o instanceof B)+','+(B.prototype===undefined)+','+({} instanceof B);}`,
  }),
  Object.freeze({
    id: 'iter-gc-chain',
    outcome: 'value',
    expected: 4320,
    source: `function f(){let sum=0;for(let n=0;n<30;n++){let node={i:0,v:n};const head=node;for(let k=1;k<8;k++){node.next={i:k,v:n+k,prev:node};node=node.next;}const iterable={[Symbol.iterator](){let cur=head;return {next(){if(!cur)return {done:true};const tmp={cur:cur,box:{v:cur.v,junk:[cur.i,cur.v]}};const value=tmp.box.v;cur=cur.next;return {value:value,done:false};}};}};for(const v of iterable){const scratch={v:v,bag:[v,n]};sum+=scratch.v;}}return sum;}`,
  }),
  Object.freeze({
    id: 'iter-resumption-next',
    outcome: 'value',
    expected: 42,
    source: `function f(){function user(x){return x+1;}let produced=false;const iterable={[Symbol.iterator](){const iterator={};Object.defineProperty(iterator,'next',{get(){const v=user(41);return function(){if(produced)return {done:true};produced=true;return {value:v,done:false};};}});return iterator;}};let s=0;for(const v of iterable)s+=v;return s;}`,
  }),
  Object.freeze({
    id:'close-throw-finally-order',outcome:'value',expected:'crf:7',resume:true,
    source:`function f(){let log='';const o={[Symbol.iterator](){return {next(){return {value:1,done:false};},get return(){log+='c';return function(){log+='r';throw 9;};}};}};try{try{for(const value of o){throw 7;}}finally{log+='f';}}catch(e){return log+':'+e;}return 'wrong';}`,
  }),
  Object.freeze({
    id:'close-throw-original-gc-root',outcome:'value',expected:'saved7:1',requireGC:true,
    source:`function f(){let calls=0;const o={[Symbol.iterator](){return {next(){return {value:1,done:false};},get return(){calls++;for(let i=0;i<700;i++){const waste={a:[i],s:'w'+i};}throw 9;}};}};try{for(const value of o){throw {message:'saved'+7};}}catch(e){return e.message+':'+calls;}return 'wrong';}`,
  }),
  Object.freeze({
    id:'close-nested-original-throw',outcome:'value',expected:'inner,outer:3',
    source:`function f(){let log='';function iterable(label){return {[Symbol.iterator](){return {next(){return {value:1,done:false};},return(){log+=label+',';throw 8;}};}};}try{for(const a of iterable('outer')){for(const b of iterable('inner')){throw 3;}}}catch(e){return log.slice(0,-1)+':'+e;}return 'wrong';}`,
  }),
  Object.freeze({
    id:'close-next-done-throw-skips-return',outcome:'value',expected:'f:4',
    source:`function f(){let log='';const o={[Symbol.iterator](){return {next(){return {get done(){throw 4;}};},return(){log+='r';return {};}};}};try{try{for(const v of o){log+='b';}}finally{log+='f';}}catch(e){return log+':'+e;}return 'wrong';}`,
  }),
  Object.freeze({
    id:'prim-pow-number-hint-order',outcome:'value',expected:'lnumber,rnumber:8',
    source:`function f(){const log=[];const a={[Symbol.toPrimitive](h){log.push('l'+h);return h==='number'?2:3;}};const b={[Symbol.toPrimitive](h){log.push('r'+h);return 3;}};const result=a**b;return log.join(',')+':'+result;}`,
  }),
  Object.freeze({id:'inst-intrinsic-noncallable',outcome:'value',expected:'false:false',source:`function f(){return Function.prototype[Symbol.hasInstance].call({}, {})+':'+({} instanceof {[Symbol.hasInstance]:Function.prototype[Symbol.hasInstance]});}`}),
  Object.freeze({id:'inst-intrinsic-descriptor',outcome:'value',expected:'false:false:false',source:`function f(){const d=Object.getOwnPropertyDescriptor(Function.prototype,Symbol.hasInstance);return d.writable+':'+d.enumerable+':'+d.configurable;}`}),
  Object.freeze({id:'iter-identity-nullish',outcome:'value',expected:'true:true',source:`function f(){const p=Object.getPrototypeOf(Object.getPrototypeOf([].values()));return (p[Symbol.iterator].call(null)===null)+':'+(p[Symbol.iterator].call(undefined)===undefined);}`}),
  Object.freeze({id:'prim-symbol-descriptive-string',outcome:'value',expected:'Symbol(s):2',source:`function f(){let n=0;try{String(Object(Symbol('s')));}catch(e){if(e instanceof TypeError)n++;}try{''+{[Symbol.toPrimitive](){return Symbol('s');}};}catch(e){if(e instanceof TypeError)n++;}return String(Symbol('s'))+':'+n;}`}),
  Object.freeze({id:'prim-symbol-error-message',outcome:'value',expected:'TypeError',source:`function f(){try{Error(Symbol('s'));}catch(e){return e instanceof TypeError?'TypeError':'other';}return 'wrong';}`}),
  Object.freeze({id:'prim-bigint-template-text',outcome:'value',expected:'123',source:'function f(){return `${123n}`;}'}),
  Object.freeze({id:'inst-prototype-accessor-resumes',outcome:'value',expected:'true:1',resume:true,source:`function f(){const ctor=()=>{};let n=0;const p={};Object.defineProperty(ctor,'prototype',{get(){n++;return p;}});return (Object.create(p) instanceof ctor)+':'+n;}`}),
  Object.freeze({
    id: 'gap-symbol-match',
    outcome: 'unsupported',
    expected: 'custom',
    source: `function f(){const pattern={};pattern[Symbol.match]=function(){return ['custom'];};const r='abc'.match(pattern);return r&&r[0];}`,
  }),
  Object.freeze({
    id: 'gap-symbol-species',
    outcome: 'unsupported',
    expected: '1:2,3',
    source: `function f(){let called=0;function C(){}C[Symbol.species]=function(){called++;return [];};const a=[1,2];a.constructor=C;const m=a.map(function(x){return x+1;});return called+':'+m.join(',');}`,
  }),
  Object.freeze({
    id: 'json-stringify-symbol',
    outcome: 'value',
    expected: 'undefined',
    source: `function f(){return typeof JSON.stringify(Symbol('z'));}`,
  }),
  Object.freeze({
    id: 'bigint-tostring-decimal',
    outcome: 'value',
    expected: '255',
    source: `function f(){return (255n).toString(10);}`,
  }),
]);

export function protocolCases() {
  return cases;
}
