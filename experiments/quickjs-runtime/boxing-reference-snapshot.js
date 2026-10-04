// Diagnostic Node v26.9.0 values, not automatic GPU oracle overrides.
export const propertyReferenceSnapshot=[
  {
    "feature": "boxing-0",
    "source": "function f(x){const s=Object(\"ab\"),n=Object(x),b=Object(true);return typeof s+typeof n+typeof b+\":\"+s.length+\":\"+(n==x)+(n+1)+\":\"+(b.valueOf()===true)+(s instanceof String)+(n instanceof Number)+(b instanceof Boolean);}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "objectobjectobject:2:true1:truetruetruetrue",
      "objectobjectobject:2:true2:truetruetruetrue",
      "objectobjectobject:2:true0:truetruetruetrue",
      "objectobjectobject:2:true18:truetruetruetrue"
    ]
  },
  {
    "feature": "boxing-1",
    "source": "function f(x){const o={a:x},fn=function(){};return (Object(o)===o)+\":\"+(new Object(o)===o)+\":\"+(Object(fn)===fn)+\":\"+(new Object(fn)===fn)+\":\"+(Object(\"a\")!==Object(\"a\"))+\":\"+(new Object(\"a\") instanceof String)+\":\"+(new Object(x)).valueOf();}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "true:true:true:true:true:true:0",
      "true:true:true:true:true:true:1",
      "true:true:true:true:true:true:-1",
      "true:true:true:true:true:true:17"
    ]
  },
  {
    "feature": "boxing-2",
    "source": "function f(x){const a=Object(null),b=Object(undefined),c=Object(),d=new Object(),e=new Object(null);return typeof a+\":\"+(a!==b)+\":\"+(Object.getPrototypeOf(a)===Object.prototype)+(Object.getPrototypeOf(b)===Object.prototype)+(Object.getPrototypeOf(c)===Object.prototype)+(Object.getPrototypeOf(e)===Object.prototype)+\":\"+Object.keys(a).length+Object.getOwnPropertyNames(d).length+\":\"+(c!==d)+Object.isExtensible(b);}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "object:true:truetruetruetrue:00:truetrue",
      "object:true:truetruetruetrue:00:truetrue",
      "object:true:truetruetruetrue:00:truetrue",
      "object:true:truetruetruetrue:00:truetrue"
    ]
  },
  {
    "feature": "boxing-3",
    "source": "function f(x){const w=Object(String(x));return Object.prototype.toString.call(w)+\":\"+w.length+\":\"+w[0]+\":\"+(Object.getPrototypeOf(w)===String.prototype)+\":\"+Object.prototype.toString.call(Object(x))+Object.prototype.toString.call(Object(x>0));}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "[object String]:1:0:true:[object Number][object Boolean]",
      "[object String]:1:1:true:[object Number][object Boolean]",
      "[object String]:2:-:true:[object Number][object Boolean]",
      "[object String]:2:1:true:[object Number][object Boolean]"
    ]
  },
  {
    "feature": "boxing-4",
    "source": "function f(x){const s=new String(x),n=new Number(x),b=new Boolean(x);return typeof s+typeof n+typeof b+\":\"+s.valueOf()+\":\"+n.valueOf()+\":\"+b.valueOf()+\":\"+s.length+\":\"+(s==String(x))+(n==x)+(b==Boolean(x));}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "objectobjectobject:0:0:false:1:truetruetrue",
      "objectobjectobject:1:1:true:1:truetruetrue",
      "objectobjectobject:-1:-1:true:2:truetruetrue",
      "objectobjectobject:17:17:true:2:truetruetrue"
    ]
  },
  {
    "feature": "boxing-5",
    "source": "function f(x){const s=new String(),n=new Number(),b=new Boolean();return \"[\"+s.valueOf()+\"]\"+s.length+\":\"+Object.is(n.valueOf(),0)+\":\"+b.valueOf()+\":\"+typeof s+typeof n+typeof b+\":\"+Object.getOwnPropertyNames(s).length;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "[]0:true:false:objectobjectobject:1",
      "[]0:true:false:objectobjectobject:1",
      "[]0:true:false:objectobjectobject:1",
      "[]0:true:false:objectobjectobject:1"
    ]
  },
  {
    "feature": "boxing-6",
    "source": "function f(x){return new String(undefined).valueOf()+\":\"+new String(null).valueOf()+\":\"+new Number(undefined).valueOf()+\":\"+new Number(null).valueOf()+\":\"+new Boolean(undefined).valueOf()+\":\"+new Boolean(null).valueOf()+\":\"+new String(true).valueOf()+\":\"+new Number(true).valueOf()+\":\"+new Number(false).valueOf();}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "undefined:null:NaN:0:false:false:true:1:0",
      "undefined:null:NaN:0:false:false:true:1:0",
      "undefined:null:NaN:0:false:false:true:1:0",
      "undefined:null:NaN:0:false:false:true:1:0"
    ]
  },
  {
    "feature": "boxing-7",
    "source": "function f(x){return new Number(\"12\").valueOf()+\":\"+new Number(\" 0x1f \").valueOf()+\":\"+new Number(\"\").valueOf()+\":\"+new Number(\"1e3\").valueOf()+\":\"+new Number(\"abc\").valueOf()+\":\"+Object.is(new Number(\"-0\").valueOf(),-0)+\":\"+new Number(String(x)+\"5\").valueOf();}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "12:31:0:1000:NaN:true:5",
      "12:31:0:1000:NaN:true:15",
      "12:31:0:1000:NaN:true:-15",
      "12:31:0:1000:NaN:true:175"
    ]
  },
  {
    "feature": "boxing-8",
    "source": "function f(x){return new Boolean(\"\").valueOf()+\",\"+new Boolean(\"0\").valueOf()+\",\"+new Boolean(0).valueOf()+\",\"+new Boolean(NaN).valueOf()+\",\"+new Boolean(-0).valueOf()+\",\"+new Boolean({}).valueOf()+\",\"+new Boolean(new Boolean(false)).valueOf()+\",\"+new Boolean(x).valueOf()+\",\"+new Boolean(String(x)).valueOf();}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "false,true,false,false,false,true,true,false,true",
      "false,true,false,false,false,true,true,true,true",
      "false,true,false,false,false,true,true,true,true",
      "false,true,false,false,false,true,true,true,true"
    ]
  },
  {
    "feature": "boxing-9",
    "source": "function f(x){const s=new String(new String(\"q\")),n=new Number(new Number(x)),b=new Boolean(new Number(0));return s.valueOf()+s.length+\":\"+n.valueOf()+\":\"+b.valueOf()+\":\"+new String(new Number(x)).valueOf()+\":\"+new Number(new String(\" 7 \")).valueOf()+\":\"+new String(new Boolean(false)).valueOf();}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "q1:0:true:0:7:false",
      "q1:1:true:1:7:false",
      "q1:-1:true:-1:7:false",
      "q1:17:true:17:7:false"
    ]
  },
  {
    "feature": "boxing-10",
    "source": "function f(x){let o=\"\";const s=new String({toString(){o+=\"t\";return \"s\"+x;},valueOf(){o+=\"v\";return 1;}});const n=new Number({toString(){o+=\"T\";return \"2\";},valueOf(){o+=\"V\";return x;}});return o+\":\"+s.valueOf()+\":\"+n.valueOf();}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "tV:s0:0",
      "tV:s1:1",
      "tV:s-1:-1",
      "tV:s17:17"
    ]
  },
  {
    "feature": "boxing-11",
    "source": "function f(x){let o=\"\";const s=new String({toString(){o+=\"t\";return {};},valueOf(){o+=\"v\";return x;}});const n=new Number({valueOf(){o+=\"V\";return {};},toString(){o+=\"T\";return \"4\";}});const b=new Boolean({valueOf(){o+=\"B\";return false;}});return o+\":\"+s.valueOf()+\":\"+n.valueOf()+\":\"+b.valueOf();}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "tvVT:0:4:true",
      "tvVT:1:4:true",
      "tvVT:-1:4:true",
      "tvVT:17:4:true"
    ]
  },
  {
    "feature": "boxing-12",
    "source": "function f(x){let o=\"\";const s=new String({toString(){o+=\"t\";return x;}});const n=new Number({valueOf(){o+=\"v\";return \"3\"+x;}});const m=new Number({valueOf(){o+=\"w\";return true;}});return o+\":\"+typeof s.valueOf()+s.valueOf()+\":\"+n.valueOf()+\":\"+m.valueOf();}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "tvw:string0:30:1",
      "tvw:string1:31:1",
      "tvw:string-1:NaN:1",
      "tvw:string17:317:1"
    ]
  },
  {
    "feature": "boxing-13",
    "source": "function f(x){let o=\"\";const proto={toString(){o+=\"p\";return \"in\"+x;}};const s=new String(Object.create(proto));return o+\":\"+s.valueOf()+\":\"+s.length;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "p:in0:3",
      "p:in1:3",
      "p:in-1:4",
      "p:in17:4"
    ]
  },
  {
    "feature": "boxing-14",
    "source": "function f(x){const w=new String(\"q\"),n=new Number(3),b=new Boolean(false);return typeof String(w)+String(w)+\":\"+typeof Number(n)+Number(n)+\":\"+typeof Boolean(b)+Boolean(b)+\":\"+String(new Number(-0))+\":\"+Number(new String(\" 12 \"))+\":\"+String(new Boolean(true))+\":\"+typeof String(x)+typeof Number(String(x))+typeof Boolean(x);}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "stringq:number3:booleantrue:0:12:true:stringnumberboolean",
      "stringq:number3:booleantrue:0:12:true:stringnumberboolean",
      "stringq:number3:booleantrue:0:12:true:stringnumberboolean",
      "stringq:number3:booleantrue:0:12:true:stringnumberboolean"
    ]
  },
  {
    "feature": "boxing-15",
    "source": "function f(x){return \"[\"+String()+\"]\"+Number()+Boolean()+\":\"+typeof String()+\":\"+String(undefined)+\":\"+Number(undefined)+\":\"+String(null)+\":\"+String(x)+Number(String(x));}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "[]0false:string:undefined:NaN:null:00",
      "[]0false:string:undefined:NaN:null:11",
      "[]0false:string:undefined:NaN:null:-1-1",
      "[]0false:string:undefined:NaN:null:1717"
    ]
  },
  {
    "feature": "boxing-16",
    "source": "function f(x){const w=new String(\"ab\"+x);return w[0]+w[1]+\":\"+w.length+\":\"+w[w.length]+\":\"+w[w.length-1]+\":\"+w[\"1\"]+\":\"+w[\"01\"]+\":\"+w[\"-0\"]+\":\"+w[\"1.0\"]+\":\"+w[\"-1\"];}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "ab:3:undefined:0:b:undefined:undefined:undefined:undefined",
      "ab:3:undefined:1:b:undefined:undefined:undefined:undefined",
      "ab:4:undefined:1:b:undefined:undefined:undefined:undefined",
      "ab:4:undefined:7:b:undefined:undefined:undefined:undefined"
    ]
  },
  {
    "feature": "boxing-17",
    "source": "function f(x){const w=new String(\"ab\");const d=Object.getOwnPropertyDescriptor(w,\"0\"),l=Object.getOwnPropertyDescriptor(w,\"length\"),u=Object.getOwnPropertyDescriptor(w,\"2\");return d.value+d.writable+d.enumerable+d.configurable+\":\"+l.value+l.writable+l.enumerable+l.configurable+\":\"+typeof u+\":\"+(\"get\" in d)+(\"value\" in l)+\":\"+Object.getOwnPropertyDescriptor(w,1).value;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "afalsetruefalse:2falsefalsefalse:undefined:falsetrue:b",
      "afalsetruefalse:2falsefalsefalse:undefined:falsetrue:b",
      "afalsetruefalse:2falsefalsefalse:undefined:falsetrue:b",
      "afalsetruefalse:2falsefalsefalse:undefined:falsetrue:b"
    ]
  },
  {
    "feature": "boxing-18",
    "source": "function f(x){function j(a){let s=\"\";for(let i=0;i<a.length;i++)s+=(i?\",\":\"\")+a[i];return s;}const w=new String(\"ab\");w.x=1;w[5]=2;w.y=3;w[3]=4;w[x+10]=5;return j(Object.getOwnPropertyNames(w))+\"|\"+j(Object.keys(w));}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "0,1,3,5,10,length,x,y|0,1,3,5,10,x,y",
      "0,1,3,5,11,length,x,y|0,1,3,5,11,x,y",
      "0,1,3,5,9,length,x,y|0,1,3,5,9,x,y",
      "0,1,3,5,27,length,x,y|0,1,3,5,27,x,y"
    ]
  },
  {
    "feature": "boxing-19",
    "source": "function f(x){function j(a){let s=\"\";for(let i=0;i<a.length;i++)s+=(i?\",\":\"\")+a[i];return s;}const w=new String(\"\");w.k=x;w[0]=\"z\";return j(Object.getOwnPropertyNames(w))+\"|\"+j(Object.keys(w))+\"|\"+w[0]+w.length;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "0,length,k|0,k|z0",
      "0,length,k|0,k|z0",
      "0,length,k|0,k|z0",
      "0,length,k|0,k|z0"
    ]
  },
  {
    "feature": "boxing-20",
    "source": "function f(x){function j(a){let s=\"\";for(let i=0;i<a.length;i++)s+=(i?\",\":\"\")+a[i];return s;}const w=new String(\"abc\");w[9]=1;w[4]=2;w.q=0;w[x+20]=3;delete w[9];w[6]=4;return j(Object.getOwnPropertyNames(w))+\"|\"+j(Object.keys(w));}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "0,1,2,4,6,20,length,q|0,1,2,4,6,20,q",
      "0,1,2,4,6,21,length,q|0,1,2,4,6,21,q",
      "0,1,2,4,6,19,length,q|0,1,2,4,6,19,q",
      "0,1,2,4,6,37,length,q|0,1,2,4,6,37,q"
    ]
  },
  {
    "feature": "boxing-21",
    "source": "function f(x){function j(a){let s=\"\";for(let i=0;i<a.length;i++)s+=(i?\",\":\"\")+a[i];return s;}const n=new Number(x),b=new Boolean(true);n.b=1;n[1]=2;b.z=0;return j(Object.getOwnPropertyNames(n))+\"|\"+j(Object.keys(b))+\"|\"+Object.getOwnPropertyNames(new Number(5)).length+n.b+n[1];}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "1,b|z|012",
      "1,b|z|012",
      "1,b|z|012",
      "1,b|z|012"
    ]
  },
  {
    "feature": "boxing-22",
    "source": "function f(x){const w=new String(\"ab\");return (\"0\" in w)+\",\"+(\"length\" in w)+\",\"+(2 in w)+\",\"+(\"charAt\" in w)+\",\"+(1 in w)+\",\"+w.hasOwnProperty(\"0\")+\",\"+w.hasOwnProperty(1)+\",\"+w.hasOwnProperty(\"length\")+\",\"+w.hasOwnProperty(\"2\")+\",\"+w.hasOwnProperty(\"charAt\")+\",\"+w.propertyIsEnumerable(\"0\")+\",\"+w.propertyIsEnumerable(\"length\")+\",\"+w.propertyIsEnumerable(2);}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "true,true,false,true,true,true,true,true,false,false,true,false,false",
      "true,true,false,true,true,true,true,true,false,false,true,false,false",
      "true,true,false,true,true,true,true,true,false,false,true,false,false",
      "true,true,false,true,true,true,true,true,false,false,true,false,false"
    ]
  },
  {
    "feature": "boxing-23",
    "source": "function f(x){const w=new String(String(x));return Object.hasOwn(w,\"0\")+\",\"+Object.hasOwn(w,\"length\")+\",\"+Object.hasOwn(w,String(w.length))+\",\"+Object.hasOwn(new Number(1),\"length\")+\",\"+Object.prototype.hasOwnProperty.call(w,w.length-1);}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "true,true,false,false,true",
      "true,true,false,false,true",
      "true,true,false,false,true",
      "true,true,false,false,true"
    ]
  },
  {
    "feature": "boxing-24",
    "source": "function f(x){const w=new String(\"ab\");w[0]=\"z\";w.length=9;w.length+=3;w[2]=\"c\";w.extra=x;return w[0]+w[1]+w[2]+\":\"+w.length+\":\"+w.extra+\":\"+w.valueOf()+\":\"+Object.keys(w).length;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "abc:2:0:ab:4",
      "abc:2:1:ab:4",
      "abc:2:-1:ab:4",
      "abc:2:17:ab:4"
    ]
  },
  {
    "feature": "boxing-25",
    "source": "function f(x){\"use strict\";const w=new String(\"ab\");let o=\"\";try{w[0]=\"z\";o+=\"n\";}catch(e){o+=e instanceof TypeError?\"T\":\"?\";}try{w.length=0;o+=\"n\";}catch(e){o+=e instanceof TypeError?\"T\":\"?\";}try{w.length++;o+=\"n\";}catch(e){o+=e instanceof TypeError?\"T\":\"?\";}w[2]=\"c\";w.k=x;return o+\":\"+w[0]+w[1]+w[2]+w.length+\":\"+w.k;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "TTT:abc2:0",
      "TTT:abc2:1",
      "TTT:abc2:-1",
      "TTT:abc2:17"
    ]
  },
  {
    "feature": "boxing-26",
    "source": "function f(x){const w=new String(\"ab\");w[3]=1;w.k=2;const a=delete w[0],b=delete w.length,c=delete w[3],d=delete w.k,e=delete w[7],g=delete w[\"1\"];return a+\",\"+b+\",\"+c+\",\"+d+\",\"+e+\",\"+g+\":\"+w[0]+w.length+(3 in w)+(\"k\" in w);}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "false,false,true,true,true,false:a2falsefalse",
      "false,false,true,true,true,false:a2falsefalse",
      "false,false,true,true,true,false:a2falsefalse",
      "false,false,true,true,true,false:a2falsefalse"
    ]
  },
  {
    "feature": "boxing-27",
    "source": "function f(x){\"use strict\";const w=new String(\"ab\");let o=\"\";try{delete w[0];o+=\"n\";}catch(e){o+=e instanceof TypeError?\"T\":\"?\";}try{delete w.length;o+=\"n\";}catch(e){o+=e instanceof TypeError?\"T\":\"?\";}w.z=1;o+=delete w.z;o+=delete w[9];return o+w[0]+w.length;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "TTtruetruea2",
      "TTtruetruea2",
      "TTtruetruea2",
      "TTtruetruea2"
    ]
  },
  {
    "feature": "boxing-28",
    "source": "function f(x){const w=new String(\"ab\");const r1=Object.defineProperty(w,\"0\",{value:\"a\"})===w;Object.defineProperty(w,\"1\",{value:\"b\",writable:false,enumerable:true,configurable:false});Object.defineProperty(w,\"length\",{value:2,writable:false});Object.defineProperty(w,\"0\",{});Object.defineProperty(w,\"2\",{value:x,enumerable:false,configurable:true,writable:true});Object.defineProperty(w,\"k\",{get:function(){return \"g\"+this.length;}});return r1+\":\"+w[0]+w[1]+w.length+\":\"+w[2]+\":\"+w.k+\":\"+Object.keys(w).length+\":\"+Object.getOwnPropertyNames(w).length;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "true:ab2:0:g2:2:5",
      "true:ab2:1:g2:2:5",
      "true:ab2:-1:g2:2:5",
      "true:ab2:17:g2:2:5"
    ]
  },
  {
    "feature": "boxing-29",
    "source": "function f(x){const w=new String(\"ab\");let o=\"\";function d(k,v){try{Object.defineProperty(w,k,v);o+=\"n\";}catch(e){o+=e instanceof TypeError?\"T\":\"?\";}}d(\"0\",{value:\"z\"});d(\"0\",{writable:true});d(\"0\",{enumerable:false});d(\"0\",{configurable:true});d(\"0\",{get:function(){}});d(\"length\",{value:3});d(\"length\",{enumerable:true});d(\"1\",{value:\"b\"});d(\"2\",{value:\"c\"});d(String(x+5),{value:x});return o+\":\"+w[0]+w[2]+w.length+\":\"+w[x+5];}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "TTTTTTTnnn:ac2:0",
      "TTTTTTTnnn:ac2:1",
      "TTTTTTTnnn:ac2:-1",
      "TTTTTTTnnn:ac2:17"
    ]
  },
  {
    "feature": "boxing-30",
    "source": "function f(x){const a=new String(\"ab\"),b=new String(\"\"),c=new Number(x),d=new Boolean(true);const r=[Object.isFrozen(a),Object.isSealed(a),Object.isExtensible(a)];Object.preventExtensions(b);Object.preventExtensions(c);const s=[Object.isFrozen(b),Object.isSealed(b),Object.isFrozen(c),Object.isExtensible(c)];Object.freeze(a);Object.seal(d);a.k=1;d.k=2;return r[0]+\",\"+r[1]+\",\"+r[2]+\"|\"+s[0]+\",\"+s[1]+\",\"+s[2]+\",\"+s[3]+\"|\"+Object.isFrozen(a)+Object.isSealed(a)+Object.isExtensible(a)+a.k+\":\"+Object.isSealed(d)+Object.isFrozen(d)+d.k+\":\"+a.valueOf()+a.length;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "false,false,true|true,true,true,false|truetruefalseundefined:truetrueundefined:ab2",
      "false,false,true|true,true,true,false|truetruefalseundefined:truetrueundefined:ab2",
      "false,false,true|true,true,true,false|truetruefalseundefined:truetrueundefined:ab2",
      "false,false,true|true,true,true,false|truetruefalseundefined:truetrueundefined:ab2"
    ]
  },
  {
    "feature": "boxing-31",
    "source": "function f(x){\"use strict\";const w=new String(\"ab\");w.k=x;Object.freeze(w);let o=\"\";try{w.k=1;o+=\"n\";}catch(e){o+=e instanceof TypeError?\"T\":\"?\";}try{w.z=1;o+=\"n\";}catch(e){o+=e instanceof TypeError?\"T\":\"?\";}const d=Object.getOwnPropertyDescriptor(w,\"k\");return o+\":\"+w.k+\":\"+d.writable+d.configurable+\":\"+Object.isFrozen(w);}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "TT:0:falsefalse:true",
      "TT:1:falsefalse:true",
      "TT:-1:falsefalse:true",
      "TT:17:falsefalse:true"
    ]
  },
  {
    "feature": "boxing-32",
    "source": "function f(x){const p=new String(\"ab\"+x),o=Object.create(p);o[0]=\"z\";o.length=1;o[9]=\"q\";return o[0]+o[1]+\":\"+o.length+\":\"+(\"0\" in o)+o.hasOwnProperty(\"0\")+o.hasOwnProperty(9)+\":\"+Object.keys(o).length+\":\"+(Object.getPrototypeOf(o)===p)+\":\"+typeof o.charAt+\":\"+Object.prototype.toString.call(o);}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "ab:3:truefalsetrue:1:true:function:[object Object]",
      "ab:3:truefalsetrue:1:true:function:[object Object]",
      "ab:4:truefalsetrue:1:true:function:[object Object]",
      "ab:4:truefalsetrue:1:true:function:[object Object]"
    ]
  },
  {
    "feature": "boxing-33",
    "source": "function f(x){\"use strict\";const o=Object.create(new String(\"ab\"));let s=\"\";try{o[0]=\"z\";s+=\"n\";}catch(e){s+=e instanceof TypeError?\"T\":\"?\";}try{o.length=5;s+=\"n\";}catch(e){s+=e instanceof TypeError?\"T\":\"?\";}o[2]=\"c\";o.x=x;return s+\":\"+o[0]+o[2]+o.length+o.x+\":\"+Object.keys(o).length;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "TT:ac20:2",
      "TT:ac21:2",
      "TT:ac2-1:2",
      "TT:ac217:2"
    ]
  },
  {
    "feature": "boxing-34",
    "source": "function f(x){const o=Object.create(new String(\"xyz\"));let r,s;try{r=o.charAt(1);}catch(e){r=e instanceof TypeError?\"T\":\"?\";}try{s=o+\"\";}catch(e){s=e instanceof TypeError?\"T\":\"?\";}return r+s+o[x>0?1:0];}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "TTx",
      "TTy",
      "TTx",
      "TTy"
    ]
  },
  {
    "feature": "boxing-35",
    "source": "function f(x){const w=Object.setPrototypeOf(new String(\"ab\"),null);let r;try{r=w+\"\";}catch(e){r=e instanceof TypeError?\"T\":\"?\";}return w[0]+w.length+\":\"+typeof w.charAt+\":\"+r+\":\"+Object.prototype.toString.call(w)+\":\"+String.prototype.toString.call(w)+\":\"+Object.keys(w).length;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "a2:undefined:T:[object String]:ab:2",
      "a2:undefined:T:[object String]:ab:2",
      "a2:undefined:T:[object String]:ab:2",
      "a2:undefined:T:[object String]:ab:2"
    ]
  },
  {
    "feature": "boxing-36",
    "source": "function f(x){const s=\"ab\"+x;return String.prototype.toString.call(s)+\":\"+String.prototype.valueOf.call(new String(s))+\":\"+s.toString()+\":\"+new String(s).toString()+\":\"+typeof new String(s).valueOf()+\":\"+(new String(s).valueOf()===s);}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "ab0:ab0:ab0:ab0:string:true",
      "ab1:ab1:ab1:ab1:string:true",
      "ab-1:ab-1:ab-1:ab-1:string:true",
      "ab17:ab17:ab17:ab17:string:true"
    ]
  },
  {
    "feature": "boxing-37",
    "source": "function f(x){return (x).toString()+\",\"+x.toString(10)+\",\"+(-0).toString()+\",\"+NaN.toString()+\",\"+(1.5).toString()+\",\"+(1e21).toString()+\",\"+Infinity.toString()+\",\"+(-Infinity).toString(10)+\",\"+new Number(x).toString()+\",\"+(0.1).toString()+\",\"+(-2.5e-7).toString();}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "0,0,0,NaN,1.5,1e+21,Infinity,-Infinity,0,0.1,-2.5e-7",
      "1,1,0,NaN,1.5,1e+21,Infinity,-Infinity,1,0.1,-2.5e-7",
      "-1,-1,0,NaN,1.5,1e+21,Infinity,-Infinity,-1,0.1,-2.5e-7",
      "17,17,0,NaN,1.5,1e+21,Infinity,-Infinity,17,0.1,-2.5e-7"
    ]
  },
  {
    "feature": "boxing-38",
    "source": "function f(x){let o=\"\";const r=(x).toString({valueOf(){o+=\"r\";return 10;}});return r+\":\"+o+\":\"+(17).toString(undefined)+\":\"+(5).toString(10.9)+\":\"+(255).toString(\"10\")+\":\"+Number.prototype.toString.call(new Number(x),10)+\":\"+Number.prototype.toString.call(Number.prototype);}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "0:r:17:5:255:0:0",
      "1:r:17:5:255:1:0",
      "-1:r:17:5:255:-1:0",
      "17:r:17:5:255:17:0"
    ]
  },
  {
    "feature": "boxing-39",
    "source": "function f(x){const n=new Number(x);return Number.prototype.valueOf.call(x)+\":\"+Number.prototype.valueOf.call(n)+\":\"+typeof n.valueOf()+\":\"+Object.is(new Number(-0).valueOf(),-0)+\":\"+(x).valueOf()+\":\"+NaN.valueOf();}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "0:0:number:true:0:NaN",
      "1:1:number:true:1:NaN",
      "-1:-1:number:true:-1:NaN",
      "17:17:number:true:17:NaN"
    ]
  },
  {
    "feature": "boxing-40",
    "source": "function f(x){const b=x>0;return b.toString()+\",\"+b.valueOf()+\",\"+new Boolean(b).toString()+\",\"+Boolean.prototype.toString.call(!b)+\",\"+Boolean.prototype.valueOf.call(new Boolean(!b))+\",\"+typeof true.valueOf()+\",\"+false.toString();}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "false,false,false,true,true,boolean,false",
      "true,true,true,false,false,boolean,false",
      "false,false,false,true,true,boolean,false",
      "true,true,true,false,false,boolean,false"
    ]
  },
  {
    "feature": "boxing-41",
    "source": "function f(x){let o=\"\";function t(g){try{g();o+=\"n\";}catch(e){o+=e instanceof TypeError?\"T\":\"?\";}}t(function(){String.prototype.valueOf.call(1);});t(function(){String.prototype.toString.call({});});t(function(){Number.prototype.valueOf.call(\"1\");});t(function(){Number.prototype.toString.call(true);});t(function(){Boolean.prototype.toString.call({});});t(function(){Boolean.prototype.valueOf.call(0);});t(function(){String.prototype.toString.call(new Number(1));});t(function(){Number.prototype.valueOf.call(new Boolean(true));});t(function(){Boolean.prototype.toString.call(new String(\"true\"));});t(function(){String.prototype.valueOf.call(x);});t(function(){String.prototype.valueOf.call(Object.create(String.prototype));});return o;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "TTTTTTTTTTT",
      "TTTTTTTTTTT",
      "TTTTTTTTTTT",
      "TTTTTTTTTTT"
    ]
  },
  {
    "feature": "boxing-42",
    "source": "function f(x){let o=\"\";function t(r){try{(x).toString(r);o+=\"n\";}catch(e){o+=e instanceof RangeError?\"R\":e instanceof TypeError?\"T\":\"?\";}}t(1);t(37);t(0);t(-10);t(Infinity);t(NaN);t(10);t(undefined);try{Number.prototype.toString.call(\"1\",{valueOf(){o+=\"v\";return 10;}});}catch(e){o+=e instanceof TypeError?\"T\":\"?\";}return o;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "RRRRRRnnT",
      "RRRRRRnnT",
      "RRRRRRnnT",
      "RRRRRRnnT"
    ]
  },
  {
    "feature": "boxing-43",
    "source": "function f(x){return (Object.getPrototypeOf(\"a\")===String.prototype)+\",\"+(Object.getPrototypeOf(x)===Number.prototype)+\",\"+(Object.getPrototypeOf(true)===Boolean.prototype)+\",\"+(String.prototype.constructor===String)+\",\"+(Number.prototype.constructor===Number)+\",\"+(Boolean.prototype.constructor===Boolean)+\",\"+(\"a\".constructor===String)+\",\"+((1).constructor===Number)+\",\"+(false.constructor===Boolean)+\",\"+(Object.getPrototypeOf(String.prototype)===Object.prototype)+\",\"+(Object.getPrototypeOf(Number.prototype)===Object.prototype)+\",\"+(Object.getPrototypeOf(Boolean.prototype)===Object.prototype);}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "true,true,true,true,true,true,true,true,true,true,true,true",
      "true,true,true,true,true,true,true,true,true,true,true,true",
      "true,true,true,true,true,true,true,true,true,true,true,true",
      "true,true,true,true,true,true,true,true,true,true,true,true"
    ]
  },
  {
    "feature": "boxing-44",
    "source": "function f(x){const t=Object.prototype.toString;return t.call(String.prototype)+t.call(Number.prototype)+t.call(Boolean.prototype)+\":\"+String.prototype.length+\":\"+typeof String.prototype[0]+\":\"+Number.prototype.valueOf()+\":\"+Boolean.prototype.valueOf()+\":[\"+String.prototype.toString()+String.prototype.valueOf()+\"]:\"+Number.prototype.toString()+\":\"+Boolean.prototype.toString()+\":\"+(String.prototype==\"\")+(Number.prototype==0);}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "[object String][object Number][object Boolean]:0:undefined:0:false:[]:0:false:truetrue",
      "[object String][object Number][object Boolean]:0:undefined:0:false:[]:0:false:truetrue",
      "[object String][object Number][object Boolean]:0:undefined:0:false:[]:0:false:truetrue",
      "[object String][object Number][object Boolean]:0:undefined:0:false:[]:0:false:truetrue"
    ]
  },
  {
    "feature": "boxing-45",
    "source": "function f(x){return (\"a\".charAt===String.prototype.charAt)+\",\"+(new String(\"a\").slice===String.prototype.slice)+\",\"+((x).toString===Number.prototype.toString)+\",\"+(true.valueOf===Boolean.prototype.valueOf)+\",\"+(\"a\".toString!==Object.prototype.toString)+\",\"+(\"a\".hasOwnProperty===Object.prototype.hasOwnProperty)+\",\"+((1).valueOf!==String.prototype.valueOf)+\",\"+typeof \"a\".charCodeAt+\",\"+(new String(\"a\").constructor===String);}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "true,true,true,true,true,true,true,function,true",
      "true,true,true,true,true,true,true,function,true",
      "true,true,true,true,true,true,true,function,true",
      "true,true,true,true,true,true,true,function,true"
    ]
  },
  {
    "feature": "boxing-46",
    "source": "function f(x){return (new String(\"a\") instanceof String)+\",\"+(\"a\" instanceof String)+\",\"+(new Number(x) instanceof Number)+\",\"+(x instanceof Number)+\",\"+(new Boolean(false) instanceof Boolean)+\",\"+(true instanceof Boolean)+\",\"+(new String(\"\") instanceof Object)+\",\"+(\"\" instanceof Object)+\",\"+(Object(x) instanceof Number)+\",\"+(new Number(1) instanceof String)+\",\"+(Object.create(String.prototype) instanceof String);}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "true,false,true,false,true,false,true,false,true,false,true",
      "true,false,true,false,true,false,true,false,true,false,true",
      "true,false,true,false,true,false,true,false,true,false,true",
      "true,false,true,false,true,false,true,false,true,false,true"
    ]
  },
  {
    "feature": "boxing-47",
    "source": "function f(x){return Object.prototype.isPrototypeOf.call(String.prototype,\"a\")+\",\"+String.prototype.isPrototypeOf(new String(\"a\"))+\",\"+Number.prototype.isPrototypeOf(x)+\",\"+Number.prototype.isPrototypeOf(Object(x))+\",\"+Object.prototype.isPrototypeOf(new Boolean(true))+\",\"+Object.prototype.isPrototypeOf.call(Object.prototype,true)+\",\"+String.prototype.isPrototypeOf(Object.create(new String(\"q\")));}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "false,true,false,true,true,false,true",
      "false,true,false,true,true,false,true",
      "false,true,false,true,true,false,true",
      "false,true,false,true,true,false,true"
    ]
  },
  {
    "feature": "boxing-48",
    "source": "function f(x){const d=Object.getOwnPropertyDescriptor(String.prototype,\"charAt\"),l=Object.getOwnPropertyDescriptor(String.prototype,\"length\");return typeof d.value+d.writable+d.enumerable+d.configurable+\":\"+l.value+l.writable+l.enumerable+l.configurable+\":\"+String.prototype.hasOwnProperty(\"slice\")+String.prototype.propertyIsEnumerable(\"charAt\")+Number.prototype.hasOwnProperty(\"toString\")+Boolean.prototype.hasOwnProperty(\"valueOf\")+String.prototype.hasOwnProperty(\"0\")+Number.prototype.hasOwnProperty(\"charAt\");}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "functiontruefalsetrue:0falsefalsefalse:truefalsetruetruefalsefalse",
      "functiontruefalsetrue:0falsefalsefalse:truefalsetruetruefalsefalse",
      "functiontruefalsetrue:0falsefalsefalse:truefalsetruetruefalsefalse",
      "functiontruefalsetrue:0falsefalsefalse:truefalsetruetruefalsefalse"
    ]
  },
  {
    "feature": "boxing-49",
    "source": "function f(x){return typeof String+typeof Number+typeof Boolean+\":\"+String.name+Number.name+Boolean.name+\":\"+String.length+Number.length+Boolean.length+\":\"+(String.prototype===String.prototype)+\":\"+(Object.getPrototypeOf(new String(\"\"))===String.prototype);}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "functionfunctionfunction:StringNumberBoolean:111:true:true",
      "functionfunctionfunction:StringNumberBoolean:111:true:true",
      "functionfunctionfunction:StringNumberBoolean:111:true:true",
      "functionfunctionfunction:StringNumberBoolean:111:true:true"
    ]
  },
  {
    "feature": "boxing-50",
    "source": "function f(x){return (\"trim\" in new String(\"a\"))+\",\"+(\"toFixed\" in Object(x))+\",\"+(\"nope\" in new String(\"a\"));}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "true,true,false",
      "true,true,false",
      "true,true,false",
      "true,true,false"
    ]
  },
  {
    "feature": "boxing-51",
    "source": "function f(x){String.prototype[0]=\"z\";return typeof String.prototype[0]+\":\"+String.prototype.length+\":\"+\"\"[0]+\":\"+\"ab\"[0]+\":\"+Object.getOwnPropertyNames(new String(\"\")).length+\":\"+String.prototype.toString();}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "string:0:z:a:1:",
      "string:0:z:a:1:",
      "string:0:z:a:1:",
      "string:0:z:a:1:"
    ]
  },
  {
    "feature": "boxing-52",
    "source": "function f(x){String.prototype.info=function(){return typeof this+\":\"+(this instanceof String)+\":\"+this.length+\":\"+(this==String(x))+\":\"+(this===this);};return String(x).info();}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "object:true:1:true:true",
      "object:true:1:true:true",
      "object:true:2:true:true",
      "object:true:2:true:true"
    ]
  },
  {
    "feature": "boxing-53",
    "source": "function f(x){String.prototype.info=function(){\"use strict\";return typeof this+\":\"+(this instanceof String)+\":\"+this.length+\":\"+(this===String(x));};return String(x).info()+\":\"+new String(\"ab\").info();}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "string:false:1:true:object:true:2:false",
      "string:false:1:true:object:true:2:false",
      "string:false:2:true:object:true:2:false",
      "string:false:2:true:object:true:2:false"
    ]
  },
  {
    "feature": "boxing-54",
    "source": "function f(x){String.prototype.self=function(){return this;};const s=String(x),a=s.self(),b=s.self();return (a!==b)+\",\"+(a==s)+\",\"+(a==b)+\",\"+typeof a+\",\"+(a.valueOf()===b.valueOf())+\",\"+(Object.getPrototypeOf(a)===String.prototype)+\",\"+a.length;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "true,true,false,object,true,true,1",
      "true,true,false,object,true,true,1",
      "true,true,false,object,true,true,2",
      "true,true,false,object,true,true,2"
    ]
  },
  {
    "feature": "boxing-55",
    "source": "function f(x){Number.prototype.twice=function(){return this*2;};Number.prototype.kind=function(){\"use strict\";return typeof this;};Number.prototype.boxed=function(){return typeof this;};return x.twice()+\":\"+(x).kind()+\":\"+(x).boxed()+\":\"+(3.5).twice()+\":\"+new Number(x).kind();}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "0:number:object:7:object",
      "2:number:object:7:object",
      "-2:number:object:7:object",
      "34:number:object:7:object"
    ]
  },
  {
    "feature": "boxing-56",
    "source": "function f(x){Boolean.prototype.not=function(){return !this;};Boolean.prototype.notStrict=function(){\"use strict\";return !this;};const b=x>0;return b.not()+\",\"+b.notStrict()+\",\"+false.not()+\",\"+false.notStrict()+\",\"+new Boolean(false).notStrict();}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "false,true,false,true,false",
      "false,false,false,true,false",
      "false,true,false,true,false",
      "false,false,false,true,false"
    ]
  },
  {
    "feature": "boxing-57",
    "source": "function f(x){Object.prototype.who=function(){return typeof this;};Object.prototype.whoStrict=function(){\"use strict\";return typeof this;};return \"a\".who()+\",\"+(x).who()+\",\"+true.who()+\",\"+\"a\".whoStrict()+\",\"+(x).whoStrict()+\",\"+true.whoStrict()+\",\"+({}).whoStrict();}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "object,object,object,string,number,boolean,object",
      "object,object,object,string,number,boolean,object",
      "object,object,object,string,number,boolean,object",
      "object,object,object,string,number,boolean,object"
    ]
  },
  {
    "feature": "boxing-58",
    "source": "function f(x){Object.defineProperty(String.prototype,\"first\",{get:function(){\"use strict\";return typeof this+\":\"+this.charAt(0)+\":\"+this.length;},configurable:true});Object.defineProperty(String.prototype,\"boxedFirst\",{get:function(){return typeof this+\":\"+this[0];}});const s=String(x);return s.first+\"|\"+s.boxedFirst+\"|\"+new String(\"zz\").first;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "string:0:1|object:0|object:z:2",
      "string:1:1|object:1|object:z:2",
      "string:-:2|object:-|object:z:2",
      "string:1:2|object:1|object:z:2"
    ]
  },
  {
    "feature": "boxing-59",
    "source": "function f(x){Object.defineProperty(Number.prototype,\"sq\",{get:function(){\"use strict\";return this*this;}});Object.defineProperty(Number.prototype,\"tp\",{get:function(){return typeof this;}});return x.sq+\":\"+(x).tp+\":\"+new Number(3).sq;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "0:object:9",
      "1:object:9",
      "1:object:9",
      "289:object:9"
    ]
  },
  {
    "feature": "boxing-60",
    "source": "function f(x){Object.defineProperty(Object.prototype,\"t\",{get:function(){\"use strict\";return typeof this;},configurable:true});return \"a\".t+(x).t+true.t+({}).t+new String(\"a\").t;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "stringnumberbooleanobjectobject",
      "stringnumberbooleanobjectobject",
      "stringnumberbooleanobjectobject",
      "stringnumberbooleanobjectobject"
    ]
  },
  {
    "feature": "boxing-61",
    "source": "function f(x){Object.defineProperty(Boolean.prototype,\"bit\",{get:function(){\"use strict\";return this?1:0;}});return (x>0).bit+\":\"+true.bit+false.bit+\":\"+new Boolean(false).bit;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "0:10:1",
      "1:10:1",
      "0:10:1",
      "1:10:1"
    ]
  },
  {
    "feature": "boxing-62",
    "source": "function f(x){String.prototype.k=\"proto\";const w=new String(\"ab\");w.k=\"own\";return \"ab\".k+\":\"+w.k+\":\"+Object.create(w).k+\":\"+delete w.k+\":\"+w.k;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "proto:own:own:true:proto",
      "proto:own:own:true:proto",
      "proto:own:own:true:proto",
      "proto:own:own:true:proto"
    ]
  },
  {
    "feature": "boxing-63",
    "source": "function f(x){Number.prototype.base=10;Boolean.prototype.flag=\"f\";Object.prototype.common=\"c\";return (x).base+x+\":\"+true.flag+\":\"+\"s\".common+(1).common+false.common+\":\"+typeof \"s\".flag;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "10:f:ccc:undefined",
      "11:f:ccc:undefined",
      "9:f:ccc:undefined",
      "27:f:ccc:undefined"
    ]
  },
  {
    "feature": "boxing-64",
    "source": "function f(x){Object.defineProperty(String.prototype,\"5\",{get:function(){\"use strict\";return \"p\"+this.length;}});Object.prototype[1]=\"op\";return \"ab\"[5]+\":\"+\"abcdefg\"[5]+\":\"+\"ab\"[1]+\":\"+\"a\"[1]+\":\"+new String(\"ab\")[5]+\":\"+(x)[1];}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "p2:f:b:op:p2:op",
      "p2:f:b:op:p2:op",
      "p2:f:b:op:p2:op",
      "p2:f:b:op:p2:op"
    ]
  },
  {
    "feature": "boxing-65",
    "source": "function f(x){String.prototype.charCodeAt=function(){return 99;};String.prototype.charAt=function(){return \"Z\";};const s=\"abc\"+x;return \"a\".charCodeAt(0)+\":\"+s.charAt(1)+\":\"+s.indexOf(\"b\")+\":\"+s.includes(\"c\")+\":\"+s.lastIndexOf(\"c\")+\":\"+s.startsWith(\"ab\")+\":\"+s.endsWith(String(x))+\":\"+s[1]+\":\"+s.slice(1,2);}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "99:Z:1:true:2:true:true:b:b",
      "99:Z:1:true:2:true:true:b:b",
      "99:Z:1:true:2:true:true:b:b",
      "99:Z:1:true:2:true:true:b:b"
    ]
  },
  {
    "feature": "boxing-66",
    "source": "function f(x){const orig=String.prototype.slice;String.prototype.slice=function(a,b){return \"S\"+orig.call(this,a,b);};return \"abc\".slice(1)+\":\"+\"abc\".indexOf(\"c\")+\":\"+orig.call(\"xyz\",x>0?1:0)+\":\"+\"abc\".charAt(2);}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "Sbc:2:xyz:c",
      "Sbc:2:yz:c",
      "Sbc:2:xyz:c",
      "Sbc:2:yz:c"
    ]
  },
  {
    "feature": "boxing-67",
    "source": "function f(x){const saved=String.prototype.charAt;const r=delete String.prototype.charAt;return r+\":\"+typeof \"a\".charAt+\":\"+(\"charAt\" in new String(\"a\"))+\":\"+saved.call(\"ab\",1)+\":\"+\"abc\".indexOf(\"c\");}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "true:undefined:false:b:2",
      "true:undefined:false:b:2",
      "true:undefined:false:b:2",
      "true:undefined:false:b:2"
    ]
  },
  {
    "feature": "boxing-68",
    "source": "function f(x){return typeof \"a\".foo+typeof (x).bar+typeof true.baz+typeof new String(\"a\").qux+\":\"+\"a\".hasOwnProperty(\"length\")+(x).hasOwnProperty(\"x\")+\"ab\".propertyIsEnumerable(0)+\"ab\".propertyIsEnumerable(\"length\");}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "undefinedundefinedundefinedundefined:truefalsetruefalse",
      "undefinedundefinedundefinedundefined:truefalsetruefalse",
      "undefinedundefinedundefinedundefined:truefalsetruefalse",
      "undefinedundefinedundefinedundefined:truefalsetruefalse"
    ]
  },
  {
    "feature": "boxing-69",
    "source": "function f(x){String.prototype.toString=function(){return \"T\";};String.prototype.valueOf=function(){return \"V\";};const w=new String(\"ab\");return w+\"\"+\":\"+String(w)+\":\"+(w==\"V\")+\":\"+(\"ab\"+x)+\":\"+\"ab\".slice(1)+\":\"+w.length;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "V:T:true:ab0:b:2",
      "V:T:true:ab1:b:2",
      "V:T:true:ab-1:b:2",
      "V:T:true:ab17:b:2"
    ]
  },
  {
    "feature": "boxing-70",
    "source": "function f(x){Number.prototype.valueOf=function(){return 100;};const n=new Number(x);return (n+1)+\":\"+(x+1)+\":\"+(n>50)+\":\"+String(n)+\":\"+Number(n);}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "101:1:true:0:100",
      "101:2:true:1:100",
      "101:0:true:-1:100",
      "101:18:true:17:100"
    ]
  },
  {
    "feature": "boxing-71",
    "source": "function f(x){Boolean.prototype.valueOf=function(){return 7;};const b=new Boolean(x>0);return (b+1)+\":\"+(b?\"t\":\"f\")+\":\"+String(b)+\":\"+(true+1);}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "8:t:false:2",
      "8:t:true:2",
      "8:t:false:2",
      "8:t:true:2"
    ]
  },
  {
    "feature": "boxing-72",
    "source": "function f(x){const s=\"ab\";s.x=1;s[0]=\"z\";s.length=5;let n=x;n.y=2;n.toString=3;true.z=4;return typeof s.x+s[0]+s.length+\":\"+typeof n.y+\":\"+n.toString()+\":\"+typeof true.z;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "undefineda2:undefined:0:undefined",
      "undefineda2:undefined:1:undefined",
      "undefineda2:undefined:-1:undefined",
      "undefineda2:undefined:17:undefined"
    ]
  },
  {
    "feature": "boxing-73",
    "source": "function f(x){\"use strict\";let o=\"\";function t(g){try{g();o+=\"n\";}catch(e){o+=e instanceof TypeError?\"T\":\"?\";}}t(function(){\"ab\".x=1;});t(function(){\"ab\"[0]=\"z\";});t(function(){\"ab\".length=1;});t(function(){(x).y=2;});t(function(){true.z=3;});t(function(){\"ab\".charAt=1;});t(function(){(x).toString=1;});t(function(){\"ab\"[5]=1;});return o;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "TTTTTTTT",
      "TTTTTTTT",
      "TTTTTTTT",
      "TTTTTTTT"
    ]
  },
  {
    "feature": "boxing-74",
    "source": "function f(x){let log=\"\";Object.defineProperty(String.prototype,\"sv\",{set:function(v){\"use strict\";log+=\"S\"+typeof this+v+\";\";},configurable:true});Object.defineProperty(Number.prototype,\"nv\",{set:function(v){log+=\"N\"+typeof this+(this instanceof Number)+v+\";\";}});Object.defineProperty(Object.prototype,\"ov\",{set:function(v){\"use strict\";log+=\"O\"+typeof this+v+\";\";},configurable:true});\"ab\".sv=1;(x).nv=2;true.ov=3;\"q\".ov=4;return log;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "Sstring1;Nobjecttrue2;Oboolean3;Ostring4;",
      "Sstring1;Nobjecttrue2;Oboolean3;Ostring4;",
      "Sstring1;Nobjecttrue2;Oboolean3;Ostring4;",
      "Sstring1;Nobjecttrue2;Oboolean3;Ostring4;"
    ]
  },
  {
    "feature": "boxing-75",
    "source": "function f(x){\"use strict\";let log=\"\";Object.defineProperty(Number.prototype,\"nv\",{set:function(v){log+=typeof this+(this===x)+v;}});let r;try{(x).nv=x;r=\"ok\";}catch(e){r=\"E\";}return log+\":\"+r+\":\"+typeof (x).nv;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "numbertrue0:ok:undefined",
      "numbertrue1:ok:undefined",
      "numbertrue-1:ok:undefined",
      "numbertrue17:ok:undefined"
    ]
  },
  {
    "feature": "boxing-76",
    "source": "function f(x){\"use strict\";Object.defineProperty(String.prototype,\"ro\",{get:function(){return 1;}});Object.defineProperty(Number.prototype,\"k\",{value:5});let o=\"\";try{\"a\".ro=2;o+=\"n\";}catch(e){o+=e instanceof TypeError?\"T\":\"?\";}try{(x).k=2;o+=\"n\";}catch(e){o+=e instanceof TypeError?\"T\":\"?\";}return o+\":\"+\"a\".ro+(x).k;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "TT:15",
      "TT:15",
      "TT:15",
      "TT:15"
    ]
  },
  {
    "feature": "boxing-77",
    "source": "function f(x){Object.defineProperty(String.prototype,\"ro\",{get:function(){return 1;}});Object.defineProperty(Number.prototype,\"k\",{value:5});\"a\".ro=2;(x).k=2;return \"a\".ro+\":\"+(x).k;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "1:5",
      "1:5",
      "1:5",
      "1:5"
    ]
  },
  {
    "feature": "boxing-78",
    "source": "function f(x){\"use strict\";const s=\"ab\";s.__proto__={};(x).__proto__=null;const r=(s.__proto__===String.prototype)+\",\"+((x).__proto__===Number.prototype)+\",\"+(true.__proto__===Boolean.prototype);const w=new String(\"q\");w.__proto__=Number.prototype;return r+\",\"+(Object.getPrototypeOf(w)===Number.prototype)+\",\"+(\"q\".__proto__===String.prototype);}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "true,true,true,true,true",
      "true,true,true,true,true",
      "true,true,true,true,true",
      "true,true,true,true,true"
    ]
  },
  {
    "feature": "boxing-79",
    "source": "function f(x){\"ab\".__proto__=1;(x).__proto__={};return typeof \"ab\".__proto__.charAt+\":\"+(Object.getPrototypeOf(x)===Number.prototype);}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "function:true",
      "function:true",
      "function:true",
      "function:true"
    ]
  },
  {
    "feature": "boxing-80",
    "source": "function f(x){const a=delete \"ab\"[0],b=delete \"ab\".length,c=delete \"ab\".x,d=delete (x).x,e=delete true.y,g=delete \"ab\"[2],h=delete \"ab\".charAt,k=delete \"ab\"[String(x)];return a+\",\"+b+\",\"+c+\",\"+d+\",\"+e+\",\"+g+\",\"+h+\",\"+k+\",\"+typeof \"ab\".charAt;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "false,false,true,true,true,true,true,false,function",
      "false,false,true,true,true,true,true,false,function",
      "false,false,true,true,true,true,true,true,function",
      "false,false,true,true,true,true,true,true,function"
    ]
  },
  {
    "feature": "boxing-81",
    "source": "function f(x){\"use strict\";let o=\"\";try{delete \"ab\"[0];o+=\"n\";}catch(e){o+=e instanceof TypeError?\"T\":\"?\";}try{delete \"ab\".length;o+=\"n\";}catch(e){o+=e instanceof TypeError?\"T\":\"?\";}o+=delete \"ab\".x;o+=delete (x).y;o+=delete \"ab\"[2];return o;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "TTtruetruetrue",
      "TTtruetruetrue",
      "TTtruetruetrue",
      "TTtruetruetrue"
    ]
  },
  {
    "feature": "boxing-82",
    "source": "function f(x){return (Object.getPrototypeOf(1)===Number.prototype)+\",\"+(Object.getPrototypeOf(true)===Boolean.prototype)+\",\"+(Object.getPrototypeOf(\"a\")===String.prototype)+\",\"+(Object.getPrototypeOf(new Number(x))===Number.prototype)+\",\"+(Object.getPrototypeOf(String(x))===String.prototype);}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "true,true,true,true,true",
      "true,true,true,true,true",
      "true,true,true,true,true",
      "true,true,true,true,true"
    ]
  },
  {
    "feature": "boxing-83",
    "source": "function f(x){const d=Object.getOwnPropertyDescriptor(\"ab\",0),l=Object.getOwnPropertyDescriptor(\"ab\",\"length\"),n=Object.getOwnPropertyDescriptor(x,\"x\"),m=Object.getOwnPropertyDescriptor(\"ab\",\"charAt\");return d.value+d.writable+d.enumerable+d.configurable+\":\"+l.value+l.writable+l.enumerable+\":\"+typeof n+typeof m+\":\"+typeof Object.getOwnPropertyDescriptor(true,\"valueOf\");}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "afalsetruefalse:2falsefalse:undefinedundefined:undefined",
      "afalsetruefalse:2falsefalse:undefinedundefined:undefined",
      "afalsetruefalse:2falsefalse:undefinedundefined:undefined",
      "afalsetruefalse:2falsefalse:undefinedundefined:undefined"
    ]
  },
  {
    "feature": "boxing-84",
    "source": "function f(x){function j(a){let s=\"\";for(let i=0;i<a.length;i++)s+=(i?\",\":\"\")+a[i];return s;}const s=String(x);return Object.hasOwn(\"ab\",\"1\")+\",\"+Object.hasOwn(\"ab\",\"2\")+\",\"+Object.hasOwn(\"ab\",\"length\")+\",\"+Object.hasOwn(x,\"x\")+\"|\"+j(Object.keys(s))+\"|\"+j(Object.getOwnPropertyNames(\"ab\"))+\"|\"+Object.keys(x).length+Object.keys(true).length+Object.getOwnPropertyNames(x).length+\"|\"+Object.prototype.hasOwnProperty.call(\"ab\",\"0\")+Object.prototype.hasOwnProperty.call(x,\"0\")+Object.prototype.propertyIsEnumerable.call(\"ab\",1);}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "true,false,true,false|0|0,1,length|000|truefalsetrue",
      "true,false,true,false|0|0,1,length|000|truefalsetrue",
      "true,false,true,false|0,1|0,1,length|000|truefalsetrue",
      "true,false,true,false|0,1|0,1,length|000|truefalsetrue"
    ]
  },
  {
    "feature": "boxing-85",
    "source": "function f(x){const t=Object.prototype.toString;return t.call(\"a\")+t.call(x)+t.call(true)+t.call(new String(\"\"))+\":\"+typeof Object.prototype.valueOf.call(\"a\")+\":\"+(Object.prototype.valueOf.call(x) instanceof Number)+\":\"+Object.prototype.valueOf.call(true).valueOf();}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "[object String][object Number][object Boolean][object String]:object:true:true",
      "[object String][object Number][object Boolean][object String]:object:true:true",
      "[object String][object Number][object Boolean][object String]:object:true:true",
      "[object String][object Number][object Boolean][object String]:object:true:true"
    ]
  },
  {
    "feature": "boxing-86",
    "source": "function f(x){return Object.isFrozen(\"ab\")+\",\"+Object.isSealed(x)+\",\"+Object.isExtensible(true)+\",\"+Object.freeze(\"ab\")+\",\"+Object.seal(x)+\",\"+Object.preventExtensions(true)+\",\"+(Object.setPrototypeOf(\"a\",null)===\"a\");}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "true,true,false,ab,0,true,true",
      "true,true,false,ab,1,true,true",
      "true,true,false,ab,-1,true,true",
      "true,true,false,ab,17,true,true"
    ]
  },
  {
    "feature": "boxing-87",
    "source": "function f(x){const w=new String(\"abc\"+x);return w.charAt(1)+w.charCodeAt(2)+\":\"+w.slice(1,3)+\":\"+w.slice(-2)+\":\"+w.charAt(w.length-1)+\":\"+String.prototype.charAt.call(w,0);}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "b99:bc:c0:0:a",
      "b99:bc:c1:1:a",
      "b99:bc:-1:1:a",
      "b99:bc:17:7:a"
    ]
  },
  {
    "feature": "boxing-88",
    "source": "function f(x){return \"\".charAt.call(x,0)+\":\"+\"\".charCodeAt.call(123,1)+\":\"+\"\".slice.call(12345,1,3)+\":\"+\"\".charAt.call(true,0)+\"\".slice.call(false,1)+\":\"+\"\".slice.call(x,1)+\":\"+\"\".charCodeAt.call(-0,0)+\":\"+\"\".slice.call(1e21,1,3)+\":\"+\"\".charAt.call(new Number(x),0)+\"\".slice.call(new Boolean(true),2);}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "0:50:23:talse::48:e+:0ue",
      "1:50:23:talse::48:e+:1ue",
      "-:50:23:talse:1:48:e+:-ue",
      "1:50:23:talse:7:48:e+:1ue"
    ]
  },
  {
    "feature": "boxing-89",
    "source": "function f(x){const s=\"abcde\";return s.charAt({valueOf(){return 1;}})+s.charAt(\"2\")+s.charAt(NaN)+\"[\"+s.charAt(Infinity)+s.charAt(-1)+\"]\"+s.charCodeAt(\"1\")+\":\"+s.charCodeAt(-1)+\":\"+s.charCodeAt(Infinity)+\":\"+s.charCodeAt(NaN)+\":\"+s.charAt(x)+\":\"+s.charAt(1.9)+s.charAt(true)+s.charAt(null)+s.charAt(undefined)+s.charAt(\" 3 \")+s.charAt(new Number(4));}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "bca[]98:NaN:NaN:97:a:bbaade",
      "bca[]98:NaN:NaN:97:b:bbaade",
      "bca[]98:NaN:NaN:97::bbaade",
      "bca[]98:NaN:NaN:97::bbaade"
    ]
  },
  {
    "feature": "boxing-90",
    "source": "function f(x){const s=\"abcde\";return s.slice(1,Infinity)+\":\"+s.slice(NaN,2)+\":\"+s.slice(\"1\",\"-1\")+\":\"+s.slice(-Infinity,1)+\":\"+s.slice(3,1)+\"|\"+s.slice({valueOf(){return 2;}},undefined)+\":\"+s.slice(x)+\":\"+s.slice(0,x)+\":\"+s.slice(-3,-1)+\":\"+s.slice(1.7,3.2)+\":\"+s.slice(null,true)+\":\"+s.slice(new String(\"3\"));}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "bcde:ab:bcd:a:|cde:abcde::cd:bc:a:de",
      "bcde:ab:bcd:a:|cde:bcde:a:cd:bc:a:de",
      "bcde:ab:bcd:a:|cde:e:abcd:cd:bc:a:de",
      "bcde:ab:bcd:a:|cde::abcde:cd:bc:a:de"
    ]
  },
  {
    "feature": "boxing-91",
    "source": "function f(x){let o=\"\";const r=\"\".slice.call({toString(){o+=\"r\";return \"abc\";},valueOf(){o+=\"R\";return 1;}},{valueOf(){o+=\"s\";return 1;},toString(){o+=\"S\";return \"0\";}},{valueOf(){o+=\"e\";return 2;}});const c=\"\".charAt.call({toString(){o+=\"c\";return \"xy\"+x;}},{valueOf(){o+=\"p\";return 2;}});const k=new String(\"pq\").charCodeAt({valueOf(){o+=\"k\";return 1;}});return o+\":\"+r+\":\"+c+\":\"+k;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "rsecpk:b:0:113",
      "rsecpk:b:1:113",
      "rsecpk:b:-:113",
      "rsecpk:b:1:113"
    ]
  },
  {
    "feature": "boxing-92",
    "source": "function f(x){let o=\"\";try{\"\".slice.call({toString(){o+=\"r\";throw x;}},{valueOf(){o+=\"s\";return 0;}});}catch(e){o+=e===x?\"E\":\"?\";}try{\"abc\".charAt({valueOf(){o+=\"p\";throw x;}});}catch(e){o+=e===x?\"E\":\"?\";}try{\"\".charCodeAt.call(null,{valueOf(){o+=\"n\";return 0;}});}catch(e){o+=e instanceof TypeError?\"T\":\"?\";}try{new String(\"ab\").slice(0,{valueOf(){o+=\"q\";throw x;}});}catch(e){o+=e===x?\"E\":\"?\";}return o;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "rEpETqE",
      "rEpETqE",
      "rEpETqE",
      "rEpETqE"
    ]
  },
  {
    "feature": "boxing-93",
    "source": "function f(x){return \"\".charAt.name+\"\".charAt.length+\":\"+\"\".charCodeAt.name+\"\".charCodeAt.length+\":\"+\"\".slice.name+\"\".slice.length+\":\"+String.prototype.toString.name+String.prototype.toString.length+\":\"+String.prototype.valueOf.name+String.prototype.valueOf.length+\":\"+Number.prototype.toString.name+Number.prototype.toString.length+\":\"+Number.prototype.valueOf.name+Number.prototype.valueOf.length+\":\"+Boolean.prototype.toString.name+Boolean.prototype.toString.length+Boolean.prototype.valueOf.name+Boolean.prototype.valueOf.length;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "charAt1:charCodeAt1:slice2:toString0:valueOf0:toString1:valueOf0:toString0valueOf0",
      "charAt1:charCodeAt1:slice2:toString0:valueOf0:toString1:valueOf0:toString0valueOf0",
      "charAt1:charCodeAt1:slice2:toString0:valueOf0:toString1:valueOf0:toString0valueOf0",
      "charAt1:charCodeAt1:slice2:toString0:valueOf0:toString1:valueOf0:toString0valueOf0"
    ]
  },
  {
    "feature": "boxing-94",
    "source": "function f(x){const b=\"\".charAt.bind(\"xyz\");const t=Number.prototype.toString.bind(x);return b(1)+\":\"+b.name+\":\"+b.length+\":\"+\"\".slice.apply(\"abcdef\",[2,4])+\":\"+t()+\":\"+t.length+\":\"+String.prototype.valueOf.call(\"v\")+Boolean.prototype.toString.apply(false)+\":\"+\"\".charCodeAt.call(new String(\"A\"));}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "y:bound charAt:1:cd:0:1:vfalse:65",
      "y:bound charAt:1:cd:1:1:vfalse:65",
      "y:bound charAt:1:cd:-1:1:vfalse:65",
      "y:bound charAt:1:cd:17:1:vfalse:65"
    ]
  },
  {
    "feature": "boxing-95",
    "source": "function f(x){const w=new String(\"a\\uD83D\\uDE00\");return w.length+\":\"+w.charCodeAt(1)+\":\"+w[2].charCodeAt(0)+\":\"+Object.keys(w).length+\":\"+w.slice(1).length+\":\"+(w[1]+w[2]===\"\\uD83D\\uDE00\");}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "3:55357:56832:3:2:true",
      "3:55357:56832:3:2:true",
      "3:55357:56832:3:2:true",
      "3:55357:56832:3:2:true"
    ]
  },
  {
    "feature": "boxing-96",
    "source": "function f(x){const s=new String(\"a\"),n=new Number(2),b=new Boolean(false);return (s==\"a\")+\",\"+(s===\"a\")+\",\"+(n+1)+\",\"+(s+\"b\")+\",\"+(n+\"x\")+\",\"+(b?1:2)+\",\"+(new Number(5)>4)+\",\"+(new Number(1)==new Number(1))+\",\"+(s==s)+\",\"+(-new Number(3))+\",\"+(new String(\"5\")*2)+\",\"+(new Boolean(true)+1)+\",\"+(new String(\"a\")<new String(\"b\"))+\",\"+(new String(\"a\")+new Number(1));}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "true,false,3,ab,2x,1,true,false,true,-3,10,2,true,a1",
      "true,false,3,ab,2x,1,true,false,true,-3,10,2,true,a1",
      "true,false,3,ab,2x,1,true,false,true,-3,10,2,true,a1",
      "true,false,3,ab,2x,1,true,false,true,-3,10,2,true,a1"
    ]
  },
  {
    "feature": "boxing-97",
    "source": "function f(x){const n=new Number(x),s=new String(x);return (n==x)+\",\"+(n===x)+\",\"+(n+n)+\",\"+(s+s)+\",\"+(n==s)+\",\"+(n*1===x)+\",\"+typeof (n+0)+\",\"+!n+\",\"+(n>=x)+\",\"+(s==x)+\",\"+(new Boolean(x>0)==(x>0));}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "true,false,0,00,false,true,number,false,true,true,true",
      "true,false,2,11,false,true,number,false,true,true,true",
      "true,false,-2,-1-1,false,true,number,false,true,true,true",
      "true,false,34,1717,false,true,number,false,true,true,true"
    ]
  },
  {
    "feature": "boxing-98",
    "source": "function f(x){const w=Object(x);let r=\"\";switch(w){case x:r=\"prim\";break;default:r=\"obj\";}return r+\":\"+typeof w+\":\"+(w!=x)+\":\"+(w!==x)+\":\"+(Object(x)===Object(x))+\":\"+(w===w);}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "obj:object:false:true:false:true",
      "obj:object:false:true:false:true",
      "obj:object:false:true:false:true",
      "obj:object:false:true:false:true"
    ]
  },
  {
    "feature": "boxing-99",
    "source": "function f(x){let n=0;if(new Boolean(false))n+=1;if(new Number(0))n+=10;if(new String(\"\"))n+=100;if(Object(false))n+=1000;return n+\":\"+(new Boolean(false)&&\"y\")+\":\"+!!new Number(NaN)+\":\"+(new String(\"\")||\"z\");}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "1111:y:true:",
      "1111:y:true:",
      "1111:y:true:",
      "1111:y:true:"
    ]
  },
  {
    "feature": "boxing-100",
    "source": "function f(x){let n=new Number(x);n++;let s=new String(\"4\");s-=1;let b=new Boolean(true);b+=1;return typeof n+n+\":\"+typeof s+s+\":\"+typeof b+b;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "number1:number3:number2",
      "number2:number3:number2",
      "number0:number3:number2",
      "number18:number3:number2"
    ]
  },
  {
    "feature": "boxing-101",
    "source": "function f(x){function s(){return typeof this;}function t(){\"use strict\";return typeof this;}return s.call(x)+\",\"+s.apply(\"a\")+\",\"+s.bind(true)()+\",\"+t.call(x)+\",\"+t.apply(\"a\")+\",\"+t.bind(true)()+\",\"+t.call(new Number(x));}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "object,object,object,number,string,boolean,object",
      "object,object,object,number,string,boolean,object",
      "object,object,object,number,string,boolean,object",
      "object,object,object,number,string,boolean,object"
    ]
  },
  {
    "feature": "boxing-102",
    "source": "function f(x){function self(){return this;}const a=self.call(x),b=self.call(x),o={};return (a instanceof Number)+\",\"+(a!==b)+\",\"+(a==x)+\",\"+self.call(\"ab\").length+\",\"+(self.bind(5)()+1)+\",\"+self.apply(true).valueOf()+\",\"+(self.call(o)===o)+\",\"+(self.call(a)===a);}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "true,true,true,2,6,true,true,true",
      "true,true,true,2,6,true,true,true",
      "true,true,true,2,6,true,true,true",
      "true,true,true,2,6,true,true,true"
    ]
  },
  {
    "feature": "boxing-103",
    "source": "function f(x){\"use strict\";function self(){return this;}return (self.call(x)===x)+\",\"+(self.apply(\"ab\")===\"ab\")+\",\"+(self.bind(false)()===false)+\",\"+Object.is(self.call(-0),-0);}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "true,true,true,true",
      "true,true,true,true",
      "true,true,true,true",
      "true,true,true,true"
    ]
  },
  {
    "feature": "boxing-104",
    "source": "function f(x){const o={m:function(){return typeof this+(this==x);}};return o.m.call(x)+\":\"+o.m.call(o).slice(0,6)+\":\"+o.m.apply(String(x));}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "objecttrue:object:objecttrue",
      "objecttrue:object:objecttrue",
      "objecttrue:object:objecttrue",
      "objecttrue:object:objecttrue"
    ]
  },
  {
    "feature": "boxing-105",
    "source": "function f(x){let r=\"\";[1].forEach(function(){r+=typeof this;},x);[1].forEach(function(){\"use strict\";r+=typeof this;},x);[1].forEach(function(){r+=this.length;},\"abc\");return r;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "objectnumber3",
      "objectnumber3",
      "objectnumber3",
      "objectnumber3"
    ]
  },
  {
    "feature": "boxing-106",
    "source": "function f(x){function g(){return this+1;}function h(){\"use strict\";return this+1;}const b=g.bind(x),c=h.bind(x);return b()+\":\"+c()+\":\"+g.call(\"a\")+\":\"+h.call(\"a\")+\":\"+typeof g.call(true);}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "1:1:a1:a1:number",
      "2:2:a1:a1:number",
      "0:0:a1:a1:number",
      "18:18:a1:a1:number"
    ]
  },
  {
    "feature": "boxing-107",
    "source": "function f(x){try{return typeof \"a\".concat;}catch(e){return \"wrong guest exception\";}}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "function",
      "function",
      "function",
      "function"
    ]
  },
  {
    "feature": "boxing-108",
    "source": "function f(x){try{return typeof Object.create(String.prototype).substring;}catch(e){return \"wrong guest exception\";}}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "function",
      "function",
      "function",
      "function"
    ]
  },
  {
    "feature": "boxing-109",
    "source": "function f(x){try{return String.prototype.hasOwnProperty(\"concat\");}catch(e){return \"wrong guest exception\";}}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-110",
    "source": "function f(x){const run=(function f(x){return String.prototype.valueOf.call(1);});try{run(x);}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-111",
    "source": "function f(x){const run=(function f(x){return String.prototype.toString.call({});});try{run(x);}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-112",
    "source": "function f(x){const run=(function f(x){return String.prototype.toString.call(Object.create(String.prototype));});try{run(x);}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-113",
    "source": "function f(x){const run=(function f(x){return String.prototype.valueOf.call(null);});try{run(x);}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-114",
    "source": "function f(x){const run=(function f(x){return String.prototype.toString.call(undefined);});try{run(x);}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-115",
    "source": "function f(x){const run=(function f(x){return Number.prototype.valueOf.call(\"1\");});try{run(x);}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-116",
    "source": "function f(x){const run=(function f(x){return Number.prototype.toString.call(new String(\"1\"));});try{run(x);}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-117",
    "source": "function f(x){const run=(function f(x){return Number.prototype.valueOf.call(Object.create(Number.prototype));});try{run(x);}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-118",
    "source": "function f(x){const run=(function f(x){return Number.prototype.toString.call(\"1\",1);});try{run(x);}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-119",
    "source": "function f(x){const run=(function f(x){return Boolean.prototype.toString.call({});});try{run(x);}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-120",
    "source": "function f(x){const run=(function f(x){return Boolean.prototype.valueOf.call(0);});try{run(x);}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-121",
    "source": "function f(x){const run=(function f(x){return Boolean.prototype.valueOf.call(new Number(0));});try{run(x);}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-122",
    "source": "function f(x){const run=(function f(x){return \"\".charAt.call(null,0);});try{run(x);}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-123",
    "source": "function f(x){const run=(function f(x){return \"\".charCodeAt.call(undefined,0);});try{run(x);}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-124",
    "source": "function f(x){const run=(function f(x){return \"\".slice.call(null,0);});try{run(x);}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-125",
    "source": "function f(x){const run=(function f(x){\"use strict\";\"ab\"[0]=\"z\";return 1;});try{run(x);}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-126",
    "source": "function f(x){const run=(function f(x){\"use strict\";\"ab\".x=1;return 1;});try{run(x);}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-127",
    "source": "function f(x){const run=(function f(x){\"use strict\";(x).y=1;return 1;});try{run(x);}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-128",
    "source": "function f(x){const run=(function f(x){\"use strict\";true.z=1;return 1;});try{run(x);}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-129",
    "source": "function f(x){const run=(function f(x){\"use strict\";\"ab\".length=1;return 1;});try{run(x);}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-130",
    "source": "function f(x){const run=(function f(x){\"use strict\";\"ab\".charAt=1;return 1;});try{run(x);}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-131",
    "source": "function f(x){const run=(function f(x){\"use strict\";new String(\"ab\")[1]=\"q\";return 1;});try{run(x);}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-132",
    "source": "function f(x){const run=(function f(x){\"use strict\";new String(\"ab\").length=3;return 1;});try{run(x);}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-133",
    "source": "function f(x){const run=(function f(x){\"use strict\";Object.create(new String(\"ab\"))[0]=\"z\";return 1;});try{run(x);}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-134",
    "source": "function f(x){const run=(function f(x){\"use strict\";const w=Object.freeze(new String(\"a\"));w.k=1;return 1;});try{run(x);}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-135",
    "source": "function f(x){const run=(function f(x){\"use strict\";Object.defineProperty(String.prototype,\"ro\",{get:function(){return 1;}});\"a\".ro=2;return 1;});try{run(x);}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-136",
    "source": "function f(x){const run=(function f(x){\"use strict\";Object.defineProperty(Number.prototype,\"k\",{value:5});(x).k=2;return 1;});try{run(x);}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-137",
    "source": "function f(x){const run=(function f(x){\"use strict\";return delete \"ab\"[0];});try{run(x);}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-138",
    "source": "function f(x){const run=(function f(x){\"use strict\";return delete new String(\"ab\").length;});try{run(x);}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-139",
    "source": "function f(x){const run=(function f(x){return Object.defineProperty(new String(\"ab\"),\"0\",{value:\"z\"});});try{run(x);}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-140",
    "source": "function f(x){const run=(function f(x){return Object.defineProperty(new String(\"ab\"),\"0\",{writable:true});});try{run(x);}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-141",
    "source": "function f(x){const run=(function f(x){return Object.defineProperty(new String(\"ab\"),\"1\",{enumerable:false});});try{run(x);}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-142",
    "source": "function f(x){const run=(function f(x){return Object.defineProperty(new String(\"ab\"),\"0\",{get:function(){return \"a\";}});});try{run(x);}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-143",
    "source": "function f(x){const run=(function f(x){return Object.defineProperty(new String(\"ab\"),\"length\",{value:3});});try{run(x);}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-144",
    "source": "function f(x){const run=(function f(x){return Object.defineProperty(\"ab\",\"x\",{value:1});});try{run(x);}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-145",
    "source": "function f(x){const run=(function f(x){return Object.defineProperty(x,\"x\",{value:1});});try{run(x);}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-146",
    "source": "function f(x){const run=(function f(x){return \"0\" in \"ab\";});try{run(x);}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-147",
    "source": "function f(x){const run=(function f(x){return \"x\" in x;});try{run(x);}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-148",
    "source": "function f(x){const run=(function f(x){return \"valueOf\" in true;});try{run(x);}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-149",
    "source": "function f(x){const run=(function f(x){return new Number({valueOf(){return {};},toString(){return {};}});});try{run(x);}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-150",
    "source": "function f(x){const run=(function f(x){return new String({toString(){return {};},valueOf(){return {};}});});try{run(x);}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-151",
    "source": "function f(x){const run=(function f(x){return new Number(Object.create(null));});try{run(x);}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-152",
    "source": "function f(x){const run=(function f(x){return Object.create(new String(\"xyz\")).charAt(0);});try{run(x);}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-153",
    "source": "function f(x){const run=(function f(x){return Object.setPrototypeOf(new String(\"ab\"),null)+\"\";});try{run(x);}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-154",
    "source": "function f(x){const run=(function f(x){return Object.prototype.valueOf.call(null);});try{run(x);}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-155",
    "source": "function f(x){const run=(function f(x){return Object.prototype.hasOwnProperty.call(undefined,\"x\");});try{run(x);}catch(e){return e instanceof TypeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-156",
    "source": "function f(x){const run=(function f(x){return (1).toString(1);});try{run(x);}catch(e){return e instanceof RangeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-157",
    "source": "function f(x){const run=(function f(x){return (x).toString(37);});try{run(x);}catch(e){return e instanceof RangeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-158",
    "source": "function f(x){const run=(function f(x){return new Number(x).toString(0);});try{run(x);}catch(e){return e instanceof RangeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-159",
    "source": "function f(x){const run=(function f(x){return Number.prototype.toString.call(5,Infinity);});try{run(x);}catch(e){return e instanceof RangeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-160",
    "source": "function f(x){const run=(function f(x){return (x).toString(-Infinity);});try{run(x);}catch(e){return e instanceof RangeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-161",
    "source": "function f(x){const run=(function f(x){return (x).toString({valueOf(){return 100;}});});try{run(x);}catch(e){return e instanceof RangeError;}return false;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      true,
      true,
      true,
      true
    ]
  },
  {
    "feature": "boxing-162",
    "source": "function f(x){function make(){return new String(\"payload:\"+x);}const kept=make();for(let i=0;i<450;i++){new String(\"discard:\"+i);}return kept.valueOf()+\":\"+kept.length+\":\"+kept[0]+\":\"+kept[kept.length-1];}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "payload:0:9:p:0",
      "payload:1:9:p:1",
      "payload:-1:10:p:1",
      "payload:17:10:p:7"
    ]
  },
  {
    "feature": "boxing-163",
    "source": "function f(x){function make(){const w=new String(\"held:\"+x);return function(){return w.valueOf()+\":\"+w.length+\":\"+Object.getOwnPropertyDescriptor(w,\"0\").value;};}const read=make();for(let i=0;i<450;i++){Object(\"trash:\"+i);}return read();}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "held:0:6:h",
      "held:1:6:h",
      "held:-1:7:h",
      "held:17:7:h"
    ]
  },
  {
    "feature": "boxing-164",
    "source": "function f(x){function keys(a){let s=\"\";for(let i=0;i<a.length;i++)s+=(i?\",\":\"\")+a[i];return s;}const w=new String(\"ab\");w.z=1;w[4294967295]=2;w[4294967294]=3;w.a=4;w[2147483648]=5;return keys(Object.getOwnPropertyNames(w))+\"|\"+keys(Object.keys(w));}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "0,1,2147483648,4294967294,length,z,4294967295,a|0,1,2147483648,4294967294,z,4294967295,a",
      "0,1,2147483648,4294967294,length,z,4294967295,a|0,1,2147483648,4294967294,z,4294967295,a",
      "0,1,2147483648,4294967294,length,z,4294967295,a|0,1,2147483648,4294967294,z,4294967295,a",
      "0,1,2147483648,4294967294,length,z,4294967295,a|0,1,2147483648,4294967294,z,4294967295,a"
    ]
  },
  {
    "feature": "boxing-165",
    "source": "function f(x){function keys(a){let s=\"\";for(let i=0;i<a.length;i++)s+=(i?\",\":\"\")+a[i];return s;}const w=new String(\"q\");w[4294967295]=1;w.z=2;Object.defineProperty(w,\"4294967294\",{value:x,writable:true,enumerable:false,configurable:true});w[2147483648]=4;delete w[4294967295];w[4294967295]=5;const d=Object.getOwnPropertyDescriptor(w,4294967294);return keys(Object.getOwnPropertyNames(w))+\"|\"+d.value+\":\"+d.writable+\":\"+d.enumerable+\":\"+d.configurable+\"|\"+w[2147483648];}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "0,2147483648,4294967294,length,z,4294967295|0:true:false:true|4",
      "0,2147483648,4294967294,length,z,4294967295|1:true:false:true|4",
      "0,2147483648,4294967294,length,z,4294967295|-1:true:false:true|4",
      "0,2147483648,4294967294,length,z,4294967295|17:true:false:true|4"
    ]
  },
  {
    "feature": "boxing-166",
    "source": "function f(x){return (new Number(2)**new Number(x))+\":\"+(new String(\"2\")**new String(\"3\"))+\":\"+(new Boolean(true)**new Number(7))+\":\"+Object.is(new Number(-0)**new Number(3),-0)+\":\"+Object.is(new Number(NaN)**new Number(0),1);}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "1:8:1:true:true",
      "2:8:1:true:true",
      "0.5:8:1:true:true",
      "131072:8:1:true:true"
    ]
  },
  {
    "feature": "boxing-167",
    "source": "function f(x){let log=\"\";const left=new Number(9),right=new String(\"9\");left.valueOf=function(){log+=\"l\";return 2;};right.valueOf=function(){log+=\"r\";return x;};const value=left**right;return log+\":\"+value;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "lr:1",
      "lr:2",
      "lr:0.5",
      "lr:131072"
    ]
  },
  {
    "feature": "boxing-168",
    "source": "function f(x){const key=new String(\"field\"),o={};o[key]=x;o[key]++;const d=Object.getOwnPropertyDescriptor(o,key);const w=new String(\"ab\");w[new Number(2147483648)]=x;return o.field+\":\"+d.value+\":\"+(key in o)+\":\"+w[2147483648];}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "1:1:true:0",
      "2:2:true:1",
      "0:0:true:-1",
      "18:18:true:17"
    ]
  },
  {
    "feature": "boxing-169",
    "source": "function f(x){let log=\"\",n=0;const key=new String(\"unused\"),o={a:new Number(2),b:0};key.toString=function(){log+=\"k\";return n++===0?\"a\":\"b\";};const result=o[key]**=new Number(x);return log+\":\"+result+\":\"+o.a.valueOf()+\":\"+o.b;}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "kk:1:2:1",
      "kk:2:2:2",
      "kk:0.5:2:0.5",
      "kk:131072:2:131072"
    ]
  },
  {
    "feature": "boxing-170",
    "source": "function f(x){const w=new String(\"2\");const result=w[new Number(0)]**=new Number(x);return result+\":\"+w[0]+\":\"+w.valueOf();}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "1:2:2",
      "2:2:2",
      "0.5:2:2",
      "131072:2:2"
    ]
  },
  {
    "feature": "boxing-171",
    "source": "function f(x){\"use strict\";let log=\"\",caught=false;const w=new String(\"2\"),exponent=new Number(x);exponent.valueOf=function(){log+=\"e\";return x;};try{w[new Number(0)]**=exponent;}catch(e){caught=e instanceof TypeError;}return log+\":\"+caught+\":\"+w[0];}",
    "inputs": [
      0,
      1,
      -1,
      17
    ],
    "nodeExpected": [
      "e:true:2",
      "e:true:2",
      "e:true:2",
      "e:true:2"
    ]
  }
];
