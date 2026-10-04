import { propertyKeyPromotedSources } from './property-key-negative-cases.js';
const primitives = [
  ['-2','-2'], ['1.5','1.5'], ['-0','0'], ['NaN','NaN'],
  ['Infinity','Infinity'], ['-Infinity','-Infinity'], ['true','true'],
  ['false','false'], ['null','null'], ['undefined','undefined'],
  ['1e21','1e+21'], ['1e-7','1e-7'],
];
export const propertyKeyConversionSources = [
  ...propertyKeyPromotedSources,
  ...primitives.flatMap(([value,key]) => {
    const name=JSON.stringify(key);
    return [
      `function f(x){const o={};o[${value}]=x;return o[${name}]===x&&o[${value}]===x&&(${value} in o)&&delete o[${value}]&&!(${name} in o);}`,
      `function f(x){const o={[${value}]:x};return o[${name}]===x&&Object.hasOwn(o,${value})&&o.hasOwnProperty(${value})&&o.propertyIsEnumerable(${value})&&Object.getOwnPropertyDescriptor(o,${value}).value===x;}`,
    ];
  }),
  'function f(x){let log="";const key={get toString(){log+="g";return function(){log+="s";return "p";};},get valueOf(){log+="BAD";return function(){return 1;};}};const o={p:x};const v=o[key];return log+":"+v;}',
  'function f(x){let log="";const key={toString(){log+="s";return {};},valueOf(){log+="v";return -1.5;}};const o={};o[key]=x;return log+":"+o["-1.5"];}',
  'function f(x){let log="";const key={toString:1,valueOf(){log+="v";return true;}};return ({[key]:x}).true===x&&log==="v";}',
  'function f(x){let log="";const key={toString(){log+="k";return "p";}};function rhs(){log+="r";return x;}const o={};o[key]=rhs();return log+":"+o.p;}',
  'function f(x){let log="";const key={toString(){log+="k";return "p";}};function rhs(){log+="r";return x;}const o={[key]:rhs()};return log+":"+o.p;}',
  'function f(x){let log="";const key={toString(){log+="k";return "p";}};const o={get p(){log+="g";return x;},set p(v){log+="s"+v;}};const v=o[key];o[key]=v+1;return log;}',
  'function f(x){let n=0;const key={toString(){n++;return "p";}};const o={[key](){return x;}};return n+":"+o.p.name+":"+o.p();}',
  'function f(x){let n=0;const key={toString(){n++;return "p";}};const o={get [key](){return x;}};return n+":"+Object.getOwnPropertyDescriptor(o,"p").get.name+":"+o.p;}',
  'function f(x){let n=0;const key={toString(){n++;return "p";}};const o={[key]:function(){return x;}};return n+":"+o.p.name+":"+o.p();}',
  'function f(x){let log="";const key={toString(){log+="k";throw x;}};const o={};try{o[key]=1;}catch(e){return log+":"+(e===x)+":"+Object.keys(o).length;}return "bad";}',
  'function f(x){const key={toString(){return {};},valueOf(){return {};}};try{return ({})[key];}catch(e){return e instanceof TypeError;}return false;}',
  'function f(x){let n=0;const key={toString(){n++;return "a";}};let errors=0;try{null[key];}catch(e){if(e instanceof TypeError)errors++;}try{undefined[key]=x;}catch(e){if(e instanceof TypeError)errors++;}try{delete null[key];}catch(e){if(e instanceof TypeError)errors++;}try{key in 1;}catch(e){if(e instanceof TypeError)errors++;}return errors+":"+n;}',
  'function f(x){let log="";const key={toString(){log+="k";return "a";}};try{Object.getOwnPropertyDescriptor(null,key);}catch(e){log+=e instanceof TypeError?"t":"?";}return log;}',
  'function f(x){let log="";const key={toString(){log+="k";return "a";}};const o={};Object.defineProperty(o,key,{get value(){log+="v";return x;}});return log+":"+o.a;}',
  'function f(x){let n=0;const key={toString(){n++;return "p";}};const o=Object.create({p:x});return (key in o)+":"+Object.hasOwn(o,key)+":"+n;}',
  'function f(x){let n=0;const key={toString(){n++;const junk=[];for(let i=0;i<100;i++){junk[0]={value:i};}return "p";}};const o={p:x};let sum=0;for(let i=0;i<20;i++)sum+=o[key];return n+":"+sum;}',
];
export const propertyKeyConversionResumptionSource = `function f(x){
  let log="";const key={get toString(){log+="g";return function(){log+="k";return "p";};}};
  const o={get p(){log+="r";return x;},set p(value){log+="w"+value;}};
  const v=o[key];o[key]=v+1;const has=key in o;const own=Object.hasOwn(o,key);
  return log+":"+has+":"+own;
}`;
export const propertyKeyConversionUnsupportedSources = [];

// ES2025 evaluates and converts a computed PropertyName before evaluating its
// value expression. Safari 26.4 was observed to evaluate rhs before conversion.
export const propertyKeyNormativeExpectations = new Map([
  ['function f(x){let log="";const key={toString(){log+="k";return "p";}};function rhs(){log+="r";return x;}const o={[key]:rhs()};return log+":"+o.p;}', {
    expectedForInput: input => 'kr:' + input,
    spec: 'https://tc39.es/ecma262/2025/multipage/ecmascript-language-expressions.html#sec-object-initializer-runtime-semantics-propertydefinitionevaluation',
    note: 'ComputedPropertyName evaluation invokes ToPropertyKey before the value expression is evaluated.',
  }],
]);

propertyKeyNormativeExpectations.set("function f(x){let n=0;const key={toString(){n++;return \"a\";}};let errors=0;try{null[key];}catch(e){if(e instanceof TypeError)errors++;}try{undefined[key]=x;}catch(e){if(e instanceof TypeError)errors++;}try{delete null[key];}catch(e){if(e instanceof TypeError)errors++;}try{key in 1;}catch(e){if(e instanceof TypeError)errors++;}return errors+\":\"+n;}", {expectedForInput: () => "4:0", spec: "https://tc39.es/ecma262/2025/multipage/ecmascript-data-types-and-values.html#sec-getvalue", note: "GetValue, PutValue and delete apply ToObject before ToPropertyKey; in checks its object operand before converting its key. None invokes key conversion with these invalid bases."});
