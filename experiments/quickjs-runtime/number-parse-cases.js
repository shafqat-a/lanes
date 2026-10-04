const q=JSON.stringify;
const integers=[['',undefined],['  -0xyz',10],['+0x10!',undefined],['-0XfFtail',16],['0b10',0],['0o10',0],['0x',16],['0x10',10],['077',0],['12',1],['12',37],['12',4294967298],['zZ!',36],['9007199254740993',10],['9007199254740995',10],['fffffffffffff8',16],['1'+'0'.repeat(200),2],['3'.repeat(100),4],['7'.repeat(100),8],['v'.repeat(100),32],['9'.repeat(240),10],['\uFEFF\u2028-123.45rest',10],['\u008512',10],['\u180E12',10],['-0000000000000000',2]];
const floats=['','  -0tail','-.0','+.5x','1.e2tail','1e','1e+','1e-2rest','0x12','0b12','Infinity!','-Infinityx','+Infinity','infinity','1_000','\uFEFF\u2028-1.25e2x','\u008512','\u180E12','5e-324x','2.4703282292062327e-324x','2.4703282292062328e-324x','1.7976931348623157e308x','1.7976931348623159e308x','-1e-999x','1e999x','9007199254740993x'];
export const numberParseCases=[
 {feature:'global-parser-aliases',source:'function f(x){return (parseInt===Number.parseInt)+":"+(parseFloat===Number.parseFloat)+":"+parseInt("10",16)+":"+parseFloat("1.5x");}',inputs:[3]},
 {feature:'Number-parser-property-descriptors',source:'function f(x){const a=Object.getOwnPropertyDescriptor(Number,"parseInt"),b=Object.getOwnPropertyDescriptor(Number,"parseFloat");return a.writable+":"+a.enumerable+":"+a.configurable+":"+b.writable+":"+b.enumerable+":"+b.configurable;}',inputs:[3]},
 {feature:'global-alias-retains-original-after-property-write',source:'function f(x){const original=parseInt;Number.parseInt=function(){return x;};return (parseInt===original)+":"+Number.parseInt("10")+":"+parseInt("10");}',inputs:[3]},
 ...integers.map(([text,radix],i)=>({feature:'parseInt-'+i,source:`function f(x){return Number.parseInt(${q(text)},${radix===undefined?'undefined':radix});}`,inputs:[3]})),
 ...floats.map((text,i)=>({feature:'parseFloat-'+i,source:`function f(x){return Number.parseFloat(${q(text)});}`,inputs:[3]})),
 {feature:'parseInt-coercion-order',source:'function f(x){let s="";const a={toString(){s+="s";return "-10tail";}},b={valueOf(){s+="r";return 16;}};return Number.parseInt(a,b)+":"+s;}',inputs:[3]},
 {feature:'parseInt-radix-even-empty',source:'function f(x){let s="";const r=Number.parseInt({toString(){s+="s";return "";}},{valueOf(){s+="r";return 10;}});return Number.isNaN(r)+":"+s;}',inputs:[3]},
 {feature:'parseInt-string-throw-skips-radix',source:'function f(x){let s="";try{Number.parseInt({toString(){s+="s";throw x;}},{valueOf(){s+="r";return 10;}});}catch(e){return s+":"+(e===x);}return "bad";}',inputs:[3]},
 {feature:'parseInt-radix-throw',source:'function f(x){let s="";try{Number.parseInt({toString(){s+="s";return "10";}},{valueOf(){s+="r";throw x;}});}catch(e){return s+":"+(e===x);}return "bad";}',inputs:[3]},
 {feature:'parseFloat-object-string-hint',source:'function f(x){let s="";const r=Number.parseFloat({toString(){s+="s";return {};},valueOf(){s+="v";return "-.125rest";}});return s+":"+r;}',inputs:[3]},
 ...['parseInt','parseFloat'].map(name=>({feature:name+'-metadata',source:`function f(x){return Number.${name}.name+":"+Number.${name}.length;}`,inputs:[3]})),
 ...['parseInt','parseFloat'].map(name=>({feature:name+'-missing',source:`function f(x){return Number.${name}();}`,inputs:[3]})),
 {feature:'parse-numbers-to-text',source:'function f(x){return Number.parseInt(x)+":"+Number.parseFloat(x);}',inputs:[-0,0,1.25,1e21,1e-7,NaN,Infinity]},
 {feature:'parser-borrowing',source:'function f(x){return Number.parseInt.call(null,"20x",16)+":"+Number.parseFloat.apply(null,["-.5x"])+":"+Number.parseInt.bind(null,"11",2)();}',inputs:[3]},
];
export const numberParseResumptionSource='function f(x){let s="";const a={get toString(){s+="g";return function(){s+="s";return "255tail";};}},r={valueOf(){s+="r";return 10;}};const n=Number.parseInt(a,r);const f=Number.parseFloat({toString(){s+="f";return "-0e-99tail";}});return s+":"+n+":"+Object.is(f,-0);}';
export const numberParseResumptionExpected='gsrf:255:true';
