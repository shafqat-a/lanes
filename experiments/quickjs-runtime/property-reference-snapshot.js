// Diagnostic Node v26.9.0 reference values; not GPU expectations.
export const propertyReferenceSnapshot = [
  {
    "feature": "property-0",
    "source": "function f(x){\"use strict\";const o=Object.freeze({});const k={toString(){throw 7;}};try{o[k]=1;}catch(e){return e===7?1:2;}}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      1,
      1,
      1,
      1,
      1
    ]
  },
  {
    "feature": "property-1",
    "source": "function f(x){const o={a:1};const k={toString(){return \"a\";}};try{return o[k];}catch(e){return 2;}}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      1,
      1,
      1,
      1,
      1
    ]
  },
  {
    "feature": "property-2",
    "source": "function f(x){const o={a:1};const k={toString(){return \"a\";}};try{return k in o;}catch(e){return 2;}}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "property-3",
    "source": "function f(x){const o={a:1};const k={toString(){return \"a\";}};try{return delete o[k];}catch(e){return 2;}}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "property-4",
    "source": "function f(x){const k={toString(){return \"a\";}};try{const o={[k]:1};return o.a;}catch(e){return 2;}}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      1,
      1,
      1,
      1,
      1
    ]
  },
  {
    "feature": "property-5",
    "source": "function f(x){const k={toString(){return \"a\";}};try{const o={[k](){return 1;}};return o.a();}catch(e){return 2;}}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      1,
      1,
      1,
      1,
      1
    ]
  },
  {
    "feature": "property-6",
    "source": "function f(x){const k={toString(){return \"a\";}};try{return Object.getOwnPropertyDescriptor({a:1},k).value;}catch(e){return 2;}}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      1,
      1,
      1,
      1,
      1
    ]
  },
  {
    "feature": "property-7",
    "source": "function f(x){const k={toString(){return \"a\";}};try{return Object.hasOwn({a:1},k);}catch(e){return 2;}}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "property-8",
    "source": "function f(x){const k={toString(){return \"a\";}};try{return ({a:1}).hasOwnProperty(k);}catch(e){return 2;}}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "property-9",
    "source": "function f(x){const k={toString(){return \"a\";}};try{return ({a:1}).propertyIsEnumerable(k);}catch(e){return 2;}}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "property-10",
    "source": "function f(x){\"use strict\";const o=Object.freeze({});try{o[-1]=1;}catch(e){return 2;}}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      2,
      2,
      2,
      2,
      2
    ]
  },
  {
    "feature": "property-11",
    "source": "function f(x){const o={};o[-2]=x;return o[\"-2\"]===x&&o[-2]===x&&(-2 in o)&&delete o[-2]&&!(\"-2\" in o);}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "property-12",
    "source": "function f(x){const o={[-2]:x};return o[\"-2\"]===x&&Object.hasOwn(o,-2)&&o.hasOwnProperty(-2)&&o.propertyIsEnumerable(-2)&&Object.getOwnPropertyDescriptor(o,-2).value===x;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "property-13",
    "source": "function f(x){const o={};o[1.5]=x;return o[\"1.5\"]===x&&o[1.5]===x&&(1.5 in o)&&delete o[1.5]&&!(\"1.5\" in o);}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "property-14",
    "source": "function f(x){const o={[1.5]:x};return o[\"1.5\"]===x&&Object.hasOwn(o,1.5)&&o.hasOwnProperty(1.5)&&o.propertyIsEnumerable(1.5)&&Object.getOwnPropertyDescriptor(o,1.5).value===x;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "property-15",
    "source": "function f(x){const o={};o[-0]=x;return o[\"0\"]===x&&o[-0]===x&&(-0 in o)&&delete o[-0]&&!(\"0\" in o);}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "property-16",
    "source": "function f(x){const o={[-0]:x};return o[\"0\"]===x&&Object.hasOwn(o,-0)&&o.hasOwnProperty(-0)&&o.propertyIsEnumerable(-0)&&Object.getOwnPropertyDescriptor(o,-0).value===x;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "property-17",
    "source": "function f(x){const o={};o[NaN]=x;return o[\"NaN\"]===x&&o[NaN]===x&&(NaN in o)&&delete o[NaN]&&!(\"NaN\" in o);}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "property-18",
    "source": "function f(x){const o={[NaN]:x};return o[\"NaN\"]===x&&Object.hasOwn(o,NaN)&&o.hasOwnProperty(NaN)&&o.propertyIsEnumerable(NaN)&&Object.getOwnPropertyDescriptor(o,NaN).value===x;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "property-19",
    "source": "function f(x){const o={};o[Infinity]=x;return o[\"Infinity\"]===x&&o[Infinity]===x&&(Infinity in o)&&delete o[Infinity]&&!(\"Infinity\" in o);}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "property-20",
    "source": "function f(x){const o={[Infinity]:x};return o[\"Infinity\"]===x&&Object.hasOwn(o,Infinity)&&o.hasOwnProperty(Infinity)&&o.propertyIsEnumerable(Infinity)&&Object.getOwnPropertyDescriptor(o,Infinity).value===x;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "property-21",
    "source": "function f(x){const o={};o[-Infinity]=x;return o[\"-Infinity\"]===x&&o[-Infinity]===x&&(-Infinity in o)&&delete o[-Infinity]&&!(\"-Infinity\" in o);}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "property-22",
    "source": "function f(x){const o={[-Infinity]:x};return o[\"-Infinity\"]===x&&Object.hasOwn(o,-Infinity)&&o.hasOwnProperty(-Infinity)&&o.propertyIsEnumerable(-Infinity)&&Object.getOwnPropertyDescriptor(o,-Infinity).value===x;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "property-23",
    "source": "function f(x){const o={};o[true]=x;return o[\"true\"]===x&&o[true]===x&&(true in o)&&delete o[true]&&!(\"true\" in o);}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "property-24",
    "source": "function f(x){const o={[true]:x};return o[\"true\"]===x&&Object.hasOwn(o,true)&&o.hasOwnProperty(true)&&o.propertyIsEnumerable(true)&&Object.getOwnPropertyDescriptor(o,true).value===x;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "property-25",
    "source": "function f(x){const o={};o[false]=x;return o[\"false\"]===x&&o[false]===x&&(false in o)&&delete o[false]&&!(\"false\" in o);}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "property-26",
    "source": "function f(x){const o={[false]:x};return o[\"false\"]===x&&Object.hasOwn(o,false)&&o.hasOwnProperty(false)&&o.propertyIsEnumerable(false)&&Object.getOwnPropertyDescriptor(o,false).value===x;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "property-27",
    "source": "function f(x){const o={};o[null]=x;return o[\"null\"]===x&&o[null]===x&&(null in o)&&delete o[null]&&!(\"null\" in o);}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "property-28",
    "source": "function f(x){const o={[null]:x};return o[\"null\"]===x&&Object.hasOwn(o,null)&&o.hasOwnProperty(null)&&o.propertyIsEnumerable(null)&&Object.getOwnPropertyDescriptor(o,null).value===x;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "property-29",
    "source": "function f(x){const o={};o[undefined]=x;return o[\"undefined\"]===x&&o[undefined]===x&&(undefined in o)&&delete o[undefined]&&!(\"undefined\" in o);}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "property-30",
    "source": "function f(x){const o={[undefined]:x};return o[\"undefined\"]===x&&Object.hasOwn(o,undefined)&&o.hasOwnProperty(undefined)&&o.propertyIsEnumerable(undefined)&&Object.getOwnPropertyDescriptor(o,undefined).value===x;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "property-31",
    "source": "function f(x){const o={};o[1e21]=x;return o[\"1e+21\"]===x&&o[1e21]===x&&(1e21 in o)&&delete o[1e21]&&!(\"1e+21\" in o);}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "property-32",
    "source": "function f(x){const o={[1e21]:x};return o[\"1e+21\"]===x&&Object.hasOwn(o,1e21)&&o.hasOwnProperty(1e21)&&o.propertyIsEnumerable(1e21)&&Object.getOwnPropertyDescriptor(o,1e21).value===x;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "property-33",
    "source": "function f(x){const o={};o[1e-7]=x;return o[\"1e-7\"]===x&&o[1e-7]===x&&(1e-7 in o)&&delete o[1e-7]&&!(\"1e-7\" in o);}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "property-34",
    "source": "function f(x){const o={[1e-7]:x};return o[\"1e-7\"]===x&&Object.hasOwn(o,1e-7)&&o.hasOwnProperty(1e-7)&&o.propertyIsEnumerable(1e-7)&&Object.getOwnPropertyDescriptor(o,1e-7).value===x;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "property-35",
    "source": "function f(x){let log=\"\";const key={get toString(){log+=\"g\";return function(){log+=\"s\";return \"p\";};},get valueOf(){log+=\"BAD\";return function(){return 1;};}};const o={p:x};const v=o[key];return log+\":\"+v;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "gs:0",
      "gs:1",
      "gs:-1",
      "gs:3",
      "gs:17"
    ]
  },
  {
    "feature": "property-36",
    "source": "function f(x){let log=\"\";const key={toString(){log+=\"s\";return {};},valueOf(){log+=\"v\";return -1.5;}};const o={};o[key]=x;return log+\":\"+o[\"-1.5\"];}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "sv:0",
      "sv:1",
      "sv:-1",
      "sv:3",
      "sv:17"
    ]
  },
  {
    "feature": "property-37",
    "source": "function f(x){let log=\"\";const key={toString:1,valueOf(){log+=\"v\";return true;}};return ({[key]:x}).true===x&&log===\"v\";}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "property-38",
    "source": "function f(x){let log=\"\";const key={toString(){log+=\"k\";return \"p\";}};function rhs(){log+=\"r\";return x;}const o={};o[key]=rhs();return log+\":\"+o.p;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "rk:0",
      "rk:1",
      "rk:-1",
      "rk:3",
      "rk:17"
    ]
  },
  {
    "feature": "property-39",
    "source": "function f(x){let log=\"\";const key={toString(){log+=\"k\";return \"p\";}};function rhs(){log+=\"r\";return x;}const o={[key]:rhs()};return log+\":\"+o.p;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "kr:0",
      "kr:1",
      "kr:-1",
      "kr:3",
      "kr:17"
    ]
  },
  {
    "feature": "property-40",
    "source": "function f(x){let log=\"\";const key={toString(){log+=\"k\";return \"p\";}};const o={get p(){log+=\"g\";return x;},set p(v){log+=\"s\"+v;}};const v=o[key];o[key]=v+1;return log;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "kgks1",
      "kgks2",
      "kgks0",
      "kgks4",
      "kgks18"
    ]
  },
  {
    "feature": "property-41",
    "source": "function f(x){let n=0;const key={toString(){n++;return \"p\";}};const o={[key](){return x;}};return n+\":\"+o.p.name+\":\"+o.p();}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "1:p:0",
      "1:p:1",
      "1:p:-1",
      "1:p:3",
      "1:p:17"
    ]
  },
  {
    "feature": "property-42",
    "source": "function f(x){let n=0;const key={toString(){n++;return \"p\";}};const o={get [key](){return x;}};return n+\":\"+Object.getOwnPropertyDescriptor(o,\"p\").get.name+\":\"+o.p;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "1:get p:0",
      "1:get p:1",
      "1:get p:-1",
      "1:get p:3",
      "1:get p:17"
    ]
  },
  {
    "feature": "property-43",
    "source": "function f(x){let n=0;const key={toString(){n++;return \"p\";}};const o={[key]:function(){return x;}};return n+\":\"+o.p.name+\":\"+o.p();}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "1:p:0",
      "1:p:1",
      "1:p:-1",
      "1:p:3",
      "1:p:17"
    ]
  },
  {
    "feature": "property-44",
    "source": "function f(x){let log=\"\";const key={toString(){log+=\"k\";throw x;}};const o={};try{o[key]=1;}catch(e){return log+\":\"+(e===x)+\":\"+Object.keys(o).length;}return \"bad\";}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "k:true:0",
      "k:true:0",
      "k:true:0",
      "k:true:0",
      "k:true:0"
    ]
  },
  {
    "feature": "property-45",
    "source": "function f(x){const key={toString(){return {};},valueOf(){return {};}};try{return ({})[key];}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "property-46",
    "source": "function f(x){let n=0;const key={toString(){n++;return \"a\";}};let errors=0;try{null[key];}catch(e){if(e instanceof TypeError)errors++;}try{undefined[key]=x;}catch(e){if(e instanceof TypeError)errors++;}try{delete null[key];}catch(e){if(e instanceof TypeError)errors++;}try{key in 1;}catch(e){if(e instanceof TypeError)errors++;}return errors+\":\"+n;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "4:0",
      "4:0",
      "4:0",
      "4:0",
      "4:0"
    ]
  },
  {
    "feature": "property-47",
    "source": "function f(x){let log=\"\";const key={toString(){log+=\"k\";return \"a\";}};try{Object.getOwnPropertyDescriptor(null,key);}catch(e){log+=e instanceof TypeError?\"t\":\"?\";}return log;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "t",
      "t",
      "t",
      "t",
      "t"
    ]
  },
  {
    "feature": "property-48",
    "source": "function f(x){let log=\"\";const key={toString(){log+=\"k\";return \"a\";}};const o={};Object.defineProperty(o,key,{get value(){log+=\"v\";return x;}});return log+\":\"+o.a;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "kv:0",
      "kv:1",
      "kv:-1",
      "kv:3",
      "kv:17"
    ]
  },
  {
    "feature": "property-49",
    "source": "function f(x){let n=0;const key={toString(){n++;return \"p\";}};const o=Object.create({p:x});return (key in o)+\":\"+Object.hasOwn(o,key)+\":\"+n;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "true:false:2",
      "true:false:2",
      "true:false:2",
      "true:false:2",
      "true:false:2"
    ]
  },
  {
    "feature": "property-50",
    "source": "function f(x){let n=0;const key={toString(){n++;const junk=[];for(let i=0;i<100;i++){junk[0]={value:i};}return \"p\";}};const o={p:x};let sum=0;for(let i=0;i<20;i++)sum+=o[key];return n+\":\"+sum;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "20:0",
      "20:20",
      "20:-20",
      "20:60",
      "20:340"
    ]
  },
  {
    "feature": "property-resumption",
    "source": "function f(x){\n  let log=\"\";const key={get toString(){log+=\"g\";return function(){log+=\"k\";return \"p\";};}};\n  const o={get p(){log+=\"r\";return x;},set p(value){log+=\"w\"+value;}};\n  const v=o[key];o[key]=v+1;const has=key in o;const own=Object.hasOwn(o,key);\n  return log+\":\"+has+\":\"+own;\n}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "gkrgkw1gkgk:true:true",
      "gkrgkw2gkgk:true:true",
      "gkrgkw0gkgk:true:true",
      "gkrgkw4gkgk:true:true",
      "gkrgkw18gkgk:true:true"
    ]
  },
  {
    "feature": "compound-original-key-second-coercion",
    "input": 3,
    "expected": "3:1:3:2",
    "source": "function f(x){let count=0;const key={toString(){count++;return count===1?\"a\":\"b\";}};const o={a:1,b:10};const result=(o[key]+=2);return result+\":\"+o.a+\":\"+o.b+\":\"+count;}",
    "allowSafariReferenceDifference": true,
    "spec": "https://tc39.es/ecma262/2025/multipage/ecmascript-language-expressions.html#sec-evaluate-property-access-with-expression-key",
    "note": "Reference creation retains the raw name; GetValue and an executed PutValue separately apply ToPropertyKey. Logical short-circuiting has no PutValue.",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "3:1:3:2",
      "3:1:3:2",
      "3:1:3:2",
      "3:1:3:2",
      "3:1:3:2"
    ]
  },
  {
    "feature": "postfix-original-key-second-coercion",
    "input": 3,
    "expected": "1:1:2:2",
    "source": "function f(x){let count=0;const key={toString(){count++;return count===1?\"a\":\"b\";}};const o={a:1,b:10};const result=o[key]++;return result+\":\"+o.a+\":\"+o.b+\":\"+count;}",
    "allowSafariReferenceDifference": true,
    "spec": "https://tc39.es/ecma262/2025/multipage/ecmascript-language-expressions.html#sec-evaluate-property-access-with-expression-key",
    "note": "Reference creation retains the raw name; GetValue and an executed PutValue separately apply ToPropertyKey. Logical short-circuiting has no PutValue.",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "1:1:2:2",
      "1:1:2:2",
      "1:1:2:2",
      "1:1:2:2",
      "1:1:2:2"
    ]
  },
  {
    "feature": "logical-shortcircuit-key-coercion-once",
    "input": 3,
    "expected": "0:1",
    "source": "function f(x){let count=0;const key={toString(){count++;return \"a\";}};const o={a:0};const result=(o[key]&&=x);return result+\":\"+count;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "0:1",
      "0:1",
      "0:1",
      "0:1",
      "0:1"
    ]
  },
  {
    "feature": "logical-assignment-key-coercion-twice",
    "input": 3,
    "expected": "3:1:3:2",
    "source": "function f(x){let count=0;const key={toString(){count++;return count===1?\"a\":\"b\";}};const o={a:1,b:10};const result=(o[key]&&=x);return result+\":\"+o.a+\":\"+o.b+\":\"+count;}",
    "allowSafariReferenceDifference": true,
    "spec": "https://tc39.es/ecma262/2025/multipage/ecmascript-language-expressions.html#sec-evaluate-property-access-with-expression-key",
    "note": "Reference creation retains the raw name; GetValue and an executed PutValue separately apply ToPropertyKey. Logical short-circuiting has no PutValue.",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "0:1:0:2",
      "1:1:1:2",
      "-1:1:-1:2",
      "3:1:3:2",
      "17:1:17:2"
    ]
  },
  {
    "feature": "second-key-coercion-throws-after-rhs",
    "input": 3,
    "expected": "KGVRK:3",
    "source": "function f(x){let log=\"\";let count=0;const key={toString(){log+=\"K\";if(count++)throw x;return \"a\";}};const o={get a(){log+=\"G\";return {valueOf(){log+=\"R\";return 1;}};},set a(v){log+=\"S\";}};function rhs(){log+=\"V\";return 2;}try{o[key]+=rhs();}catch(e){return log+\":\"+e;}return \"bad\";}",
    "allowSafariReferenceDifference": true,
    "spec": "https://tc39.es/ecma262/2025/multipage/ecmascript-language-expressions.html#sec-evaluate-property-access-with-expression-key",
    "note": "Reference creation retains the raw name; GetValue and an executed PutValue separately apply ToPropertyKey. Logical short-circuiting has no PutValue.",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "KGVRK:0",
      "KGVRK:1",
      "KGVRK:-1",
      "KGVRK:3",
      "KGVRK:17"
    ]
  },
  {
    "feature": "logical-or-assignment-key-coercion-twice",
    "input": 3,
    "expected": "3:0:3:2",
    "source": "function f(x){let count=0;const key={toString(){count++;return count===1?\"a\":\"b\";}};const o={a:0,b:10};const result=(o[key]||=x);return result+\":\"+o.a+\":\"+o.b+\":\"+count;}",
    "allowSafariReferenceDifference": true,
    "spec": "https://tc39.es/ecma262/2025/multipage/ecmascript-language-expressions.html#sec-evaluate-property-access-with-expression-key",
    "note": "Reference creation retains the raw name; GetValue and an executed PutValue separately apply ToPropertyKey. Logical short-circuiting has no PutValue.",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "0:0:0:2",
      "1:0:1:2",
      "-1:0:-1:2",
      "3:0:3:2",
      "17:0:17:2"
    ]
  },
  {
    "feature": "logical-nullish-assignment-key-coercion-twice",
    "input": 3,
    "expected": "3:null:3:2",
    "source": "function f(x){let count=0;const key={toString(){count++;return count===1?\"a\":\"b\";}};const o={a:null,b:10};const result=(o[key]??=x);return result+\":\"+o.a+\":\"+o.b+\":\"+count;}",
    "allowSafariReferenceDifference": true,
    "spec": "https://tc39.es/ecma262/2025/multipage/ecmascript-language-expressions.html#sec-evaluate-property-access-with-expression-key",
    "note": "Reference creation retains the raw name; GetValue and an executed PutValue separately apply ToPropertyKey. Logical short-circuiting has no PutValue.",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "0:null:0:2",
      "1:null:1:2",
      "-1:null:-1:2",
      "3:null:3:2",
      "17:null:17:2"
    ]
  },
  {
    "feature": "logical-or-shortcircuit-key-coercion-once",
    "input": 3,
    "expected": "1:1:10:1",
    "source": "function f(x){let count=0;const key={toString(){count++;return count===1?\"a\":\"b\";}};const o={a:1,b:10};const result=(o[key]||=x);return result+\":\"+o.a+\":\"+o.b+\":\"+count;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "1:1:10:1",
      "1:1:10:1",
      "1:1:10:1",
      "1:1:10:1",
      "1:1:10:1"
    ]
  },
  {
    "feature": "logical-nullish-shortcircuit-key-coercion-once",
    "input": 3,
    "expected": "1:1:10:1",
    "source": "function f(x){let count=0;const key={toString(){count++;return count===1?\"a\":\"b\";}};const o={a:1,b:10};const result=(o[key]??=x);return result+\":\"+o.a+\":\"+o.b+\":\"+count;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "1:1:10:1",
      "1:1:10:1",
      "1:1:10:1",
      "1:1:10:1",
      "1:1:10:1"
    ]
  },
  {
    "feature": "compound-+",
    "input": 3,
    "expected": "15:15",
    "source": "function f(x){const o={p:12};const key=\"p\";const result=(o[key]+=x);return result+\":\"+o.p;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "12:12",
      "13:13",
      "11:11",
      "15:15",
      "29:29"
    ]
  },
  {
    "feature": "compound--",
    "input": 3,
    "expected": "9:9",
    "source": "function f(x){const o={p:12};const key=\"p\";const result=(o[key]-=x);return result+\":\"+o.p;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "12:12",
      "11:11",
      "13:13",
      "9:9",
      "-5:-5"
    ]
  },
  {
    "feature": "compound-*",
    "input": 3,
    "expected": "36:36",
    "source": "function f(x){const o={p:12};const key=\"p\";const result=(o[key]*=x);return result+\":\"+o.p;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "0:0",
      "12:12",
      "-12:-12",
      "36:36",
      "204:204"
    ]
  },
  {
    "feature": "compound-/",
    "input": 3,
    "expected": "4:4",
    "source": "function f(x){const o={p:12};const key=\"p\";const result=(o[key]/=x);return result+\":\"+o.p;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "Infinity:Infinity",
      "12:12",
      "-12:-12",
      "4:4",
      "0.7058823529411765:0.7058823529411765"
    ]
  },
  {
    "feature": "compound-%",
    "input": 3,
    "expected": "0:0",
    "source": "function f(x){const o={p:12};const key=\"p\";const result=(o[key]%=x);return result+\":\"+o.p;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "NaN:NaN",
      "0:0",
      "0:0",
      "0:0",
      "12:12"
    ]
  },
  {
    "feature": "compound-<<",
    "input": 3,
    "expected": "96:96",
    "source": "function f(x){const o={p:12};const key=\"p\";const result=(o[key]<<=x);return result+\":\"+o.p;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "12:12",
      "24:24",
      "0:0",
      "96:96",
      "1572864:1572864"
    ]
  },
  {
    "feature": "compound->>",
    "input": 3,
    "expected": "1:1",
    "source": "function f(x){const o={p:12};const key=\"p\";const result=(o[key]>>=x);return result+\":\"+o.p;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "12:12",
      "6:6",
      "0:0",
      "1:1",
      "0:0"
    ]
  },
  {
    "feature": "compound->>>",
    "input": 3,
    "expected": "1:1",
    "source": "function f(x){const o={p:12};const key=\"p\";const result=(o[key]>>>=x);return result+\":\"+o.p;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "12:12",
      "6:6",
      "0:0",
      "1:1",
      "0:0"
    ]
  },
  {
    "feature": "compound-&",
    "input": 3,
    "expected": "0:0",
    "source": "function f(x){const o={p:12};const key=\"p\";const result=(o[key]&=x);return result+\":\"+o.p;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "0:0",
      "0:0",
      "12:12",
      "0:0",
      "0:0"
    ]
  },
  {
    "feature": "compound-|",
    "input": 3,
    "expected": "15:15",
    "source": "function f(x){const o={p:12};const key=\"p\";const result=(o[key]|=x);return result+\":\"+o.p;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "12:12",
      "13:13",
      "-1:-1",
      "15:15",
      "29:29"
    ]
  },
  {
    "feature": "compound-^",
    "input": 3,
    "expected": "15:15",
    "source": "function f(x){const o={p:12};const key=\"p\";const result=(o[key]^=x);return result+\":\"+o.p;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "12:12",
      "13:13",
      "-13:-13",
      "15:15",
      "29:29"
    ]
  },
  {
    "feature": "o[k]++",
    "input": 3,
    "expected": "4:5",
    "source": "function f(x){const o=[4];const k=0;const result=o[k]++;return result+\":\"+o[0];}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "4:5",
      "4:5",
      "4:5",
      "4:5",
      "4:5"
    ]
  },
  {
    "feature": "++o[k]",
    "input": 3,
    "expected": "5:5",
    "source": "function f(x){const o=[4];const k=0;const result=++o[k];return result+\":\"+o[0];}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "5:5",
      "5:5",
      "5:5",
      "5:5",
      "5:5"
    ]
  },
  {
    "feature": "o[k]--",
    "input": 3,
    "expected": "4:3",
    "source": "function f(x){const o=[4];const k=0;const result=o[k]--;return result+\":\"+o[0];}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "4:3",
      "4:3",
      "4:3",
      "4:3",
      "4:3"
    ]
  },
  {
    "feature": "--o[k]",
    "input": 3,
    "expected": "3:3",
    "source": "function f(x){const o=[4];const k=0;const result=--o[k];return result+\":\"+o[0];}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "3:3",
      "3:3",
      "3:3",
      "3:3",
      "3:3"
    ]
  },
  {
    "feature": "compound-evaluation-order",
    "input": 3,
    "expected": "RKGVS:8:8",
    "source": "function f(x){let log=\"\";let stored=5;const o={get p(){log+=\"G\";return stored;},set p(value){log+=\"S\";stored=value;}};function receiver(){log+=\"R\";return o;}function key(){log+=\"K\";return \"p\";}function rhs(){log+=\"V\";return x;}const result=(receiver()[key()]+=rhs());return log+\":\"+result+\":\"+stored;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "RKGVS:5:5",
      "RKGVS:6:6",
      "RKGVS:4:4",
      "RKGVS:8:8",
      "RKGVS:22:22"
    ]
  },
  {
    "feature": "postfix-object-coercion-and-setter-result",
    "input": 3,
    "expected": "RKGNS:5:6",
    "source": "function f(x){let log=\"\";let stored=0;const old={valueOf(){log+=\"N\";return 5;}};const o={get p(){log+=\"G\";return old;},set p(value){log+=\"S\";stored=value;return 99;}};function receiver(){log+=\"R\";return o;}function key(){log+=\"K\";return \"p\";}const result=receiver()[key()]++;return log+\":\"+result+\":\"+stored;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "RKGNS:5:6",
      "RKGNS:5:6",
      "RKGNS:5:6",
      "RKGNS:5:6",
      "RKGNS:5:6"
    ]
  },
  {
    "feature": "prefix-object-coercion",
    "input": 3,
    "expected": "GNS:6:6",
    "source": "function f(x){let log=\"\";let stored=0;const o={get p(){log+=\"G\";return {valueOf(){log+=\"N\";return 5;}};},set p(value){log+=\"S\";stored=value;}};const result=++o[\"p\"];return log+\":\"+result+\":\"+stored;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "GNS:6:6",
      "GNS:6:6",
      "GNS:6:6",
      "GNS:6:6",
      "GNS:6:6"
    ]
  },
  {
    "feature": "rhs-before-add-coercion",
    "input": 3,
    "expected": "GVNS:8:8",
    "source": "function f(x){let log=\"\";let stored=0;const o={get p(){log+=\"G\";return {valueOf(){log+=\"N\";return 5;}};},set p(value){log+=\"S\";stored=value;}};function rhs(){log+=\"V\";return x;}const result=(o[\"p\"]+=rhs());return log+\":\"+result+\":\"+stored;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "GVNS:5:5",
      "GVNS:6:6",
      "GVNS:4:4",
      "GVNS:8:8",
      "GVNS:22:22"
    ]
  },
  {
    "feature": "getter-throw-before-rhs",
    "input": 3,
    "expected": "G:3",
    "source": "function f(x){let log=\"\";const o={get p(){log+=\"G\";throw x;},set p(v){log+=\"S\";}};function rhs(){log+=\"V\";return 1;}try{o[\"p\"]+=rhs();}catch(e){return log+\":\"+e;}return \"bad\";}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "G:0",
      "G:1",
      "G:-1",
      "G:3",
      "G:17"
    ]
  },
  {
    "feature": "rhs-throw-before-setter",
    "input": 3,
    "expected": "GV:3",
    "source": "function f(x){let log=\"\";const o={get p(){log+=\"G\";return 1;},set p(v){log+=\"S\";}};function rhs(){log+=\"V\";throw x;}try{o[\"p\"]+=rhs();}catch(e){return log+\":\"+e;}return \"bad\";}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "GV:0",
      "GV:1",
      "GV:-1",
      "GV:3",
      "GV:17"
    ]
  },
  {
    "feature": "postfix-conversion-throw-before-setter",
    "input": 3,
    "expected": "GN:3",
    "source": "function f(x){let log=\"\";const o={get p(){log+=\"G\";return {valueOf(){log+=\"N\";throw x;}};},set p(v){log+=\"S\";}};try{o[\"p\"]++;}catch(e){return log+\":\"+e;}return \"bad\";}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "GN:0",
      "GN:1",
      "GN:-1",
      "GN:3",
      "GN:17"
    ]
  },
  {
    "feature": "setter-throw-discards-assignment-result",
    "input": 3,
    "expected": "GS:3",
    "source": "function f(x){let log=\"\";const o={get p(){log+=\"G\";return 1;},set p(v){log+=\"S\";throw x;}};try{return o[\"p\"]++;}catch(e){return log+\":\"+e;}}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "GS:0",
      "GS:1",
      "GS:-1",
      "GS:3",
      "GS:17"
    ]
  },
  {
    "feature": "strict-readonly-update",
    "input": 3,
    "expected": true,
    "source": "function f(x){\"use strict\";const o={};Object.defineProperty(o,\"p\",{value:1});try{o[\"p\"]++;}catch(e){return e instanceof TypeError&&o.p===1;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "sloppy-readonly-update",
    "input": 3,
    "expected": "1:2:1",
    "source": "function f(x){const o={};Object.defineProperty(o,\"p\",{value:1});const a=o[\"p\"]++;const b=++o[\"p\"];return a+\":\"+b+\":\"+o.p;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "1:2:1",
      "1:2:1",
      "1:2:1",
      "1:2:1",
      "1:2:1"
    ]
  },
  {
    "feature": "inherited-getter-setter-receiver",
    "input": 3,
    "expected": "true:true:true:true:3:5",
    "source": "function f(x){let log=\"\";const p={get item(){log+=(this===o)+\":\";return this.value;},set item(v){log+=(this===o)+\":\";this.value=v;}};const o=Object.create(p);o.value=x;const old=o[\"item\"]++;const value=(o[\"item\"]+=1);return log+old+\":\"+value;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "true:true:true:true:0:2",
      "true:true:true:true:1:3",
      "true:true:true:true:-1:1",
      "true:true:true:true:3:5",
      "true:true:true:true:17:19"
    ]
  },
  {
    "feature": "logical-0",
    "input": 3,
    "expected": "G:0:0",
    "source": "function f(x){let log=\"\";let stored=0;const o={get p(){log+=\"G\";return stored;},set p(value){log+=\"S\";stored=value;}};function rhs(){log+=\"V\";return x;}const result=(o[\"p\"]&&=rhs());return log+\":\"+result+\":\"+stored;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "G:0:0",
      "G:0:0",
      "G:0:0",
      "G:0:0",
      "G:0:0"
    ]
  },
  {
    "feature": "logical-1",
    "input": 3,
    "expected": "GVS:3:3",
    "source": "function f(x){let log=\"\";let stored=2;const o={get p(){log+=\"G\";return stored;},set p(value){log+=\"S\";stored=value;}};function rhs(){log+=\"V\";return x;}const result=(o[\"p\"]&&=rhs());return log+\":\"+result+\":\"+stored;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "GVS:0:0",
      "GVS:1:1",
      "GVS:-1:-1",
      "GVS:3:3",
      "GVS:17:17"
    ]
  },
  {
    "feature": "logical-2",
    "input": 3,
    "expected": "G:2:2",
    "source": "function f(x){let log=\"\";let stored=2;const o={get p(){log+=\"G\";return stored;},set p(value){log+=\"S\";stored=value;}};function rhs(){log+=\"V\";return x;}const result=(o[\"p\"]||=rhs());return log+\":\"+result+\":\"+stored;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "G:2:2",
      "G:2:2",
      "G:2:2",
      "G:2:2",
      "G:2:2"
    ]
  },
  {
    "feature": "logical-3",
    "input": 3,
    "expected": "GVS:3:3",
    "source": "function f(x){let log=\"\";let stored=0;const o={get p(){log+=\"G\";return stored;},set p(value){log+=\"S\";stored=value;}};function rhs(){log+=\"V\";return x;}const result=(o[\"p\"]||=rhs());return log+\":\"+result+\":\"+stored;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "GVS:0:0",
      "GVS:1:1",
      "GVS:-1:-1",
      "GVS:3:3",
      "GVS:17:17"
    ]
  },
  {
    "feature": "logical-4",
    "input": 3,
    "expected": "G:0:0",
    "source": "function f(x){let log=\"\";let stored=0;const o={get p(){log+=\"G\";return stored;},set p(value){log+=\"S\";stored=value;}};function rhs(){log+=\"V\";return x;}const result=(o[\"p\"]??=rhs());return log+\":\"+result+\":\"+stored;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "G:0:0",
      "G:0:0",
      "G:0:0",
      "G:0:0",
      "G:0:0"
    ]
  },
  {
    "feature": "logical-5",
    "input": 3,
    "expected": "GVS:3:3",
    "source": "function f(x){let log=\"\";let stored=null;const o={get p(){log+=\"G\";return stored;},set p(value){log+=\"S\";stored=value;}};function rhs(){log+=\"V\";return x;}const result=(o[\"p\"]??=rhs());return log+\":\"+result+\":\"+stored;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "GVS:0:0",
      "GVS:1:1",
      "GVS:-1:-1",
      "GVS:3:3",
      "GVS:17:17"
    ]
  },
  {
    "feature": "nested-member-postfix",
    "input": 3,
    "expected": "3:4",
    "source": "function f(x){const outer=[{p:x}];const old=outer[0][\"p\"]++;return old+\":\"+outer[0].p;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "0:1",
      "1:2",
      "-1:0",
      "3:4",
      "17:18"
    ]
  },
  {
    "feature": "result-old-value-converted-once",
    "input": 3,
    "expected": "number:1:5:6",
    "source": "function f(x){let count=0;const o={p:{valueOf(){count++;return \"5\";}}};const old=o[\"p\"]++;return typeof old+\":\"+count+\":\"+old+\":\"+o.p;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "number:1:5:6",
      "number:1:5:6",
      "number:1:5:6",
      "number:1:5:6",
      "number:1:5:6"
    ]
  },
  {
    "feature": "missing-value-postfix",
    "input": 3,
    "expected": true,
    "source": "function f(x){const o={};const old=o[\"p\"]++;return old!==old&&o.p!==o.p&&Object.hasOwn(o,\"p\");}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "nullish-base",
    "input": 3,
    "expected": true,
    "source": "function f(x){try{const o=null;o[0]+=x;}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "null-read",
    "source": "function f(x){let n=0;const key={toString(){n++;return 'a';}};try{null[key];return 'missed:'+n;}catch(e){return (e instanceof TypeError)+':'+n;}}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "true:0",
      "true:0",
      "true:0",
      "true:0",
      "true:0"
    ]
  },
  {
    "feature": "undefined-write",
    "source": "function f(x){let n=0;const key={toString(){n++;return 'a';}};try{undefined[key]=x;return 'missed:'+n;}catch(e){return (e instanceof TypeError)+':'+n;}}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "true:0",
      "true:0",
      "true:0",
      "true:0",
      "true:0"
    ]
  },
  {
    "feature": "null-delete",
    "source": "function f(x){let n=0;const key={toString(){n++;return 'a';}};try{delete null[key];return 'missed:'+n;}catch(e){return (e instanceof TypeError)+':'+n;}}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "true:0",
      "true:0",
      "true:0",
      "true:0",
      "true:0"
    ]
  },
  {
    "feature": "primitive-in",
    "source": "function f(x){let n=0;const key={toString(){n++;return 'a';}};try{key in 1;return 'missed:'+n;}catch(e){return (e instanceof TypeError)+':'+n;}}",
    "inputs": [
      0,
      1,
      -1,
      3,
      17
    ],
    "nodeExpected": [
      "true:0",
      "true:0",
      "true:0",
      "true:0",
      "true:0"
    ]
  }
];
