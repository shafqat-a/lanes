const samples=[
 ['sigma-ignorable-only-prefix','\u0345\u02b0Σ','\u0345\u02b0σ'],
 ['sigma-cased-before-ignorable','A\u0345\u02b0Σ','a\u0345\u02b0ς'],
 ['sigma-cased-after-ignorable','AΣ\u0345\u200dB','aσ\u0345\u200db'],
 ['sigma-astral-neighbor','𐐀Σ𐐀','𐐨σ𐐨'],
 ['sigma-astral-prefix','𐐀Σ','𐐨ς'],
 ['sigma-lone-surrogate-break','A\ud800ΣAΣ\udc00A','a\ud800σaς\udc00a'],
 ['sigma-punctuation-reset',"AΣ'AΣ.AΣ AΣ", "aσ'aσ.aς aς"],
];
export const stringCaseReviewCases=Object.freeze([
 ...samples.map(([name,text,expected])=>({feature:'case-review-'+name,source:`function f(x){return ${JSON.stringify(text)}.toLowerCase();}`,expected})),
 {feature:'case-review-multiple-expansions',source:'function f(x){return "ßﬃΐᾀ".toUpperCase();}',expected:'SSFFIΙ\u0308\u0301ἈΙ'},
 {feature:'case-review-private-helper-immunity',source:'function f(x){String.prototype.charCodeAt=function(){throw 9;};String.prototype.slice=function(){throw 8;};String.prototype.codePointAt=function(){throw 7;};return "ß𐐨AΣ".toUpperCase()+":"+"ΟΣ".toLowerCase();}',expected:'SS𐐀AΣ:ος'},
 {feature:'case-review-max-expanded-units',source:'function f(x){const result="ß".repeat(128).toUpperCase();return result.length+":"+result.at(255);}',expected:'256:S'},
].map(c=>Object.freeze({...c,input:17})));
export const stringCaseReviewResourceCases=Object.freeze([
 {feature:'case-review-expansion-over-utf16-limit',source:'function f(x){return "ß".repeat(129).toUpperCase();}',nativeLength:258},
 {feature:'case-review-astral-over-utf16-limit',source:'function f(x){return ("𐐨".repeat(127)+"ßß").toUpperCase();}',nativeLength:258},
]);
