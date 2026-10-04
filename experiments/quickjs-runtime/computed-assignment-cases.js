// Computed member Reference semantics. Object-key cases require the shared
// property-key conversion integration and reader helper903, not CPU fallback.
const operators = [['+',15],['-',9],['*',36],['/',4],['%',0],['<<',96],['>>',1],['>>>',1],['&',0],['|',15],['^',15]];
export const computedAssignmentCases = [
  {feature:"computed-exponent-assignment",input:3,expected:"8:8",source:`function f(x){const o={p:2};const result=(o["p"]**=x);return result+":"+o.p;}`},
  {feature:'compound-original-key-second-coercion',input:3,expected:'3:1:3:2',source:`function f(x){let count=0;const key={toString(){count++;return count===1?"a":"b";}};const o={a:1,b:10};const result=(o[key]+=2);return result+":"+o.a+":"+o.b+":"+count;}`},
  {feature:'postfix-original-key-second-coercion',input:3,expected:'1:1:2:2',source:`function f(x){let count=0;const key={toString(){count++;return count===1?"a":"b";}};const o={a:1,b:10};const result=o[key]++;return result+":"+o.a+":"+o.b+":"+count;}`},
  {feature:'logical-shortcircuit-key-coercion-once',input:3,expected:'0:1',source:`function f(x){let count=0;const key={toString(){count++;return "a";}};const o={a:0};const result=(o[key]&&=x);return result+":"+count;}`},
  {feature:'logical-assignment-key-coercion-twice',input:3,expected:'3:1:3:2',source:`function f(x){let count=0;const key={toString(){count++;return count===1?"a":"b";}};const o={a:1,b:10};const result=(o[key]&&=x);return result+":"+o.a+":"+o.b+":"+count;}`},
  {feature:'second-key-coercion-throws-after-rhs',input:3,expected:'KGVRK:3',source:`function f(x){let log="";let count=0;const key={toString(){log+="K";if(count++)throw x;return "a";}};const o={get a(){log+="G";return {valueOf(){log+="R";return 1;}};},set a(v){log+="S";}};function rhs(){log+="V";return 2;}try{o[key]+=rhs();}catch(e){return log+":"+e;}return "bad";}`},
  {feature:'logical-or-assignment-key-coercion-twice',input:3,expected:'3:0:3:2',source:`function f(x){let count=0;const key={toString(){count++;return count===1?"a":"b";}};const o={a:0,b:10};const result=(o[key]||=x);return result+":"+o.a+":"+o.b+":"+count;}`},
  {feature:'logical-nullish-assignment-key-coercion-twice',input:3,expected:'3:null:3:2',source:`function f(x){let count=0;const key={toString(){count++;return count===1?"a":"b";}};const o={a:null,b:10};const result=(o[key]??=x);return result+":"+o.a+":"+o.b+":"+count;}`},
  {feature:'logical-or-shortcircuit-key-coercion-once',input:3,expected:'1:1:10:1',source:`function f(x){let count=0;const key={toString(){count++;return count===1?"a":"b";}};const o={a:1,b:10};const result=(o[key]||=x);return result+":"+o.a+":"+o.b+":"+count;}`},
  {feature:'logical-nullish-shortcircuit-key-coercion-once',input:3,expected:'1:1:10:1',source:`function f(x){let count=0;const key={toString(){count++;return count===1?"a":"b";}};const o={a:1,b:10};const result=(o[key]??=x);return result+":"+o.a+":"+o.b+":"+count;}`},
  ...operators.map(([operator,value])=>({feature:`compound-${operator}`,input:3,expected:`${value}:${value}`,
    source:`function f(x){const o={p:12};const key="p";const result=(o[key]${operator}=x);return result+":"+o.p;}`})),
  ...[['o[k]++','4:5'],['++o[k]','5:5'],['o[k]--','4:3'],['--o[k]','3:3']].map(([expression,expected])=>({feature:expression,input:3,expected,
    source:`function f(x){const o=[4];const k=0;const result=${expression};return result+":"+o[0];}`})),
  {feature:'compound-evaluation-order',input:3,expected:'RKGVS:8:8',source:`function f(x){let log="";let stored=5;const o={get p(){log+="G";return stored;},set p(value){log+="S";stored=value;}};function receiver(){log+="R";return o;}function key(){log+="K";return "p";}function rhs(){log+="V";return x;}const result=(receiver()[key()]+=rhs());return log+":"+result+":"+stored;}`},
  {feature:'postfix-object-coercion-and-setter-result',input:3,expected:'RKGNS:5:6',source:`function f(x){let log="";let stored=0;const old={valueOf(){log+="N";return 5;}};const o={get p(){log+="G";return old;},set p(value){log+="S";stored=value;return 99;}};function receiver(){log+="R";return o;}function key(){log+="K";return "p";}const result=receiver()[key()]++;return log+":"+result+":"+stored;}`},
  {feature:'prefix-object-coercion',input:3,expected:'GNS:6:6',source:`function f(x){let log="";let stored=0;const o={get p(){log+="G";return {valueOf(){log+="N";return 5;}};},set p(value){log+="S";stored=value;}};const result=++o["p"];return log+":"+result+":"+stored;}`},
  {feature:'rhs-before-add-coercion',input:3,expected:'GVNS:8:8',source:`function f(x){let log="";let stored=0;const o={get p(){log+="G";return {valueOf(){log+="N";return 5;}};},set p(value){log+="S";stored=value;}};function rhs(){log+="V";return x;}const result=(o["p"]+=rhs());return log+":"+result+":"+stored;}`},
  {feature:'getter-throw-before-rhs',input:3,expected:'G:3',source:`function f(x){let log="";const o={get p(){log+="G";throw x;},set p(v){log+="S";}};function rhs(){log+="V";return 1;}try{o["p"]+=rhs();}catch(e){return log+":"+e;}return "bad";}`},
  {feature:'rhs-throw-before-setter',input:3,expected:'GV:3',source:`function f(x){let log="";const o={get p(){log+="G";return 1;},set p(v){log+="S";}};function rhs(){log+="V";throw x;}try{o["p"]+=rhs();}catch(e){return log+":"+e;}return "bad";}`},
  {feature:'postfix-conversion-throw-before-setter',input:3,expected:'GN:3',source:`function f(x){let log="";const o={get p(){log+="G";return {valueOf(){log+="N";throw x;}};},set p(v){log+="S";}};try{o["p"]++;}catch(e){return log+":"+e;}return "bad";}`},
  {feature:'setter-throw-discards-assignment-result',input:3,expected:'GS:3',source:`function f(x){let log="";const o={get p(){log+="G";return 1;},set p(v){log+="S";throw x;}};try{return o["p"]++;}catch(e){return log+":"+e;}}`},
  {feature:'strict-readonly-update',input:3,expected:true,source:`function f(x){"use strict";const o={};Object.defineProperty(o,"p",{value:1});try{o["p"]++;}catch(e){return e instanceof TypeError&&o.p===1;}return false;}`},
  {feature:'sloppy-readonly-update',input:3,expected:'1:2:1',source:`function f(x){const o={};Object.defineProperty(o,"p",{value:1});const a=o["p"]++;const b=++o["p"];return a+":"+b+":"+o.p;}`},
  {feature:'inherited-getter-setter-receiver',input:3,expected:'true:true:true:true:3:5',source:`function f(x){let log="";const p={get item(){log+=(this===o)+":";return this.value;},set item(v){log+=(this===o)+":";this.value=v;}};const o=Object.create(p);o.value=x;const old=o["item"]++;const value=(o["item"]+=1);return log+old+":"+value;}`},
  ...[['&&=',0,'G:0:0'],['&&=',2,'GVS:3:3'],['||=',2,'G:2:2'],['||=',0,'GVS:3:3'],['??=',0,'G:0:0'],['??=',null,'GVS:3:3']].map(([operator,initial,expected],index)=>({feature:`logical-${index}`,input:3,expected,
    source:`function f(x){let log="";let stored=${JSON.stringify(initial)};const o={get p(){log+="G";return stored;},set p(value){log+="S";stored=value;}};function rhs(){log+="V";return x;}const result=(o["p"]${operator}rhs());return log+":"+result+":"+stored;}`})),
  {feature:'nested-member-postfix',input:3,expected:'3:4',source:`function f(x){const outer=[{p:x}];const old=outer[0]["p"]++;return old+":"+outer[0].p;}`},
  {feature:'result-old-value-converted-once',input:3,expected:'number:1:5:6',source:`function f(x){let count=0;const o={p:{valueOf(){count++;return "5";}}};const old=o["p"]++;return typeof old+":"+count+":"+old+":"+o.p;}`},
  {feature:'missing-value-postfix',input:3,expected:true,source:`function f(x){const o={};const old=o["p"]++;return old!==old&&o.p!==o.p&&Object.hasOwn(o,"p");}`},
  {feature:'nullish-base',input:3,expected:true,source:`function f(x){try{const o=null;o[0]+=x;}catch(e){return e instanceof TypeError;}return false;}`},
];
// ES2025 retains the raw property name in a Reference. Each executed
// GetValue/PutValue converts it separately; short-circuiting performs no write.
// Safari 26.4 uses older single-conversion behavior for these object-key cases.
const normativeKeyConversions = new Map([
  ['compound-original-key-second-coercion', () => '3:1:3:2'],
  ['postfix-original-key-second-coercion', () => '1:1:2:2'],
  ['logical-assignment-key-coercion-twice', input => input+':1:'+input+':2'],
  ['second-key-coercion-throws-after-rhs', input => 'KGVRK:'+input],
  ['logical-or-assignment-key-coercion-twice', input => input+':0:'+input+':2'],
  ['logical-nullish-assignment-key-coercion-twice', input => input+':null:'+input+':2'],
]);
for (const item of computedAssignmentCases) {
  if (!normativeKeyConversions.has(item.feature)) continue;
  item.allowSafariReferenceDifference = true;
  item.expectedForInput = normativeKeyConversions.get(item.feature);
  item.spec = 'https://tc39.es/ecma262/2025/multipage/ecmascript-language-expressions.html#sec-evaluate-property-access-with-expression-key';
  item.note = 'Reference creation retains the raw name; GetValue and an executed PutValue separately apply ToPropertyKey. Logical short-circuiting has no PutValue.';
}
export const computedAssignmentResumptionSource = `function f(x){
  let log="";let stored=4;
  const o={get p(){log+="G";return {valueOf(){log+="N";return stored;}};},set p(value){log+="S";stored=value;}};
  const old=o["p"]++;
  const next=++o["p"];
  const result=(o["p"]+=x);
  return log+":"+old+":"+next+":"+result+":"+stored;
}`;
export const computedAssignmentResumptionExpected = 'GNSGNSGNS:4:6:9:9';
export const computedAssignmentRejectedSources = [];
