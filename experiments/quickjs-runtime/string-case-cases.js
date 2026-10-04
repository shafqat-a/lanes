const samples=[
 ['', '', ''],['abc XYZ 123','ABC XYZ 123','abc xyz 123'],
 ['Straße','STRASSE','straße'],['ﬀﬁﬂﬃﬄﬅﬆ','FFFIFLFFIFFLSTST','ﬀﬁﬂﬃﬄﬅﬆ'],
 ['İıI','İII','i\u0307ıi'],['Σ','Σ','σ'],['ΟΣ','ΟΣ','ος'],['ΟΣΑ','ΟΣΑ','οσα'],
 ['AΣ\u0301','AΣ\u0301','aς\u0301'],['AΣ\u0301A','AΣ\u0301A','aσ\u0301a'],
 ["A'Σ","A'Σ","a'ς"],['A Σ','A Σ','a σ'],['ΣΣ','ΣΣ','σς'],
 ['\u0345Σ','ΙΣ','\u0345σ'],['A\u0345Σ','AΙΣ','a\u0345ς'],
 ['AΣ\u0345','AΣΙ','aς\u0345'],['AΣ\u0345A','AΣΙA','aσ\u0345a'],
 ['\ud800a\udc00','\ud800A\udc00','\ud800a\udc00'],
 ['𐐨𐐀','𐐀𐐀','𐐨𐐨'],['ᾀΐ','ἈΙΙ\u0308\u0301','ᾀΐ'],
 ['µſKΩ','ΜSKΩ','µſkω'],['\u0000a\u2028Z','\u0000A\u2028Z','\u0000a\u2028z'],
];
export const stringCaseCases=Object.freeze([
 ...samples.flatMap(([text,upper,lower],i)=>[['toUpperCase',upper],['toLowerCase',lower]].map(([method,expected])=>({feature:`unicode-case-${i}-${method}`,source:`function f(){return ${JSON.stringify(text)}.${method}();}`,input:3,expected}))),
 {feature:'case-generic-coercion-order',source:'function f(){let s="";const o={toString:function(){s+="t";return {};},valueOf:function(){s+="v";return "ß";}};return String.prototype.toUpperCase.call(o)+s;}',input:3,expected:'SStv'},
 {feature:'case-null',source:'function f(){try{String.prototype.toUpperCase.call(null);}catch(e){return e instanceof TypeError;}return false;}',input:3,expected:true},
 {feature:'case-undefined',source:'function f(){try{String.prototype.toLowerCase.call(undefined);}catch(e){return e instanceof TypeError;}return false;}',input:3,expected:true},
 {feature:'case-number',source:'function f(x){return String.prototype.toUpperCase.call(x);}',input:3,expected:'3'},
 {feature:'case-boxed',source:'function f(){return new String("ßΣ").toLowerCase()+":"+new String("ßΣ").toUpperCase();}',input:3,expected:'ßς:SSΣ'},
 {feature:'case-throw-identity',source:'function f(){const token={};try{String.prototype.toUpperCase.call({toString:function(){throw token;}});}catch(e){return e===token;}return false;}',input:3,expected:true},
 {feature:'case-properties',source:'function f(){return String.prototype.toUpperCase.length===0&&String.prototype.toUpperCase.name==="toUpperCase"&&String.prototype.toLowerCase.length===0&&String.prototype.toLowerCase.name==="toLowerCase";}',input:3,expected:true},
]);
// Explicit pinned-data cases can diverge on native engines with older Unicode.
export const stringCaseVersionCases=Object.freeze([
 {feature:'unicode16-cyrillic-tje-upper',source:'function f(){return "\u1c8a".toUpperCase();}',input:3,expected:'\u1c89'},
 {feature:'unicode16-cyrillic-tje-lower',source:'function f(){return "\u1c89".toLowerCase();}',input:3,expected:'\u1c8a'},
 {feature:'unicode17-beria-erfe-upper',source:'function f(){return "\ud81b\udebb".toUpperCase();}',input:3,expected:'\ud81b\udea0'},
]);
export const stringCaseResumptionSource='function f(x){let n=0;const o={toString:function(){n++;return "Straße ΟΣ İ 𐐨";}};return String.prototype.toUpperCase.call(o)+":"+String.prototype.toLowerCase.call(o)+":"+n;}';
export const stringCaseResumptionExpected='STRASSE ΟΣ İ 𐐀:straße ος i\u0307 𐐨:2';
