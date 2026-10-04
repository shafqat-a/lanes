export const stringPhase5Cases=Object.freeze([
 ['indices','function f(x){return "abc".at(-1)+":"+"abc".at(-3)+":"+"abc".at(-4)+":"+"abc".at(Infinity)+":"+"abc".at(-0)+":"+x;}','c:a:undefined:undefined:a:17'],
 ['points','function f(x){let s="a\uD83D\uDE00\uD800\uDC00";return s.codePointAt(0)+":"+s.codePointAt(1)+":"+s.codePointAt(2)+":"+s.codePointAt(3)+":"+s.codePointAt(8)+":"+x;}','97:128512:56832:65536:undefined:17'],
 ['repeat','function f(x){return "ab".repeat(2.9)+":"+"ab".repeat(NaN)+":"+"".repeat(9007199254740991)+":"+"a".repeat(-0)+":"+x;}','abab::::17'],
 ['padding','function f(x){return "x".padStart(6,"ab")+":"+"x".padEnd(6,"ab")+":"+"abc".padEnd(1)+":"+"x".padStart(3)+":"+"x".padEnd(Infinity,"")+":"+x;}','ababax:xababa:abc:  x:x:17'],
 ['trim-boundaries','function f(x){let s="\uFEFF\u0085\u180E\u200Bz\u0085\uFEFF";return s.trim().length+":"+" \t\r\n\u2028\u2029x\u3000".trim()+":"+" x ".trimStart()+":"+" x ".trimEnd()+":"+x;}','5:x:x : x:17'],
 ['wellformed','function f(x){return "\uD800x\uDC00\uD83D\uDE00".isWellFormed()+":"+"\uD83D\uDE00".isWellFormed()+":"+"\uD800x\uDC00\uD83D\uDE00".toWellFormed()+":"+x;}','false:true:\uFFFDx\uFFFD\uD83D\uDE00:17'],
 ['coercion-order','function f(x){let log="";let s={toString(){log+="s";return "a";}};let n={valueOf(){log+="n";return 3;}};let fill={toString(){log+="f";return "b";}};let r=String.prototype.padStart.call(s,n,fill);return log+":"+r+":"+x;}','snf:bba:17'],
 ['fill-shortcircuit','function f(x){let n=0;let p={toString(){n++;throw x;}};return "abc".padStart(2,p)+":"+"abc".padEnd(-Infinity,p)+":"+n+":"+x;}','abc:abc:0:17'],
 ['boxed','function f(x){let s=new String(" ab ");return s.trim()+":"+s.at(-1)+":"+s.repeat(1)+":"+s.padEnd(5,"!")+":"+s.isWellFormed()+":"+x;}','ab: : ab : ab !:true:17'],
 ['prototype-immunity','function f(x){String.prototype.slice=function(){throw x;};String.prototype.charCodeAt=function(){throw x;};return " ab ".trim()+":"+"xy".at(-1)+":"+"a".padEnd(3,"b")+":"+"\uD800".toWellFormed()+":"+x;}','ab:y:abb:\uFFFD:17'],
 ['repeat-range','function f(x){let r="";try{"x".repeat(-1);}catch(e){r+=e instanceof RangeError;}try{"".repeat(Infinity);}catch(e){r+=":"+(e instanceof RangeError);}try{"x".repeat(-Infinity);}catch(e){r+=":"+(e instanceof RangeError);}return r+":"+x;}','true:true:true:17'],
 ['receiver-before-index','function f(x){let log="";try{String.prototype.at.call(null,{valueOf(){log+="bad";return 0;}});}catch(e){log+=e instanceof TypeError;}try{String.prototype.codePointAt.call({toString(){throw x;}},{valueOf(){log+="bad";return 0;}});}catch(e){log+=":"+(e===x);}return log;}','true:true'],
 ['exact256','function f(x){return "a".repeat(256).length+":"+"a".padStart(256,"bc").length+":"+"a".padEnd(256,"bc").length+":"+x;}','256:256:256:17'],
].map(([feature,source,expected])=>Object.freeze({feature:'string-phase5-'+feature,source:source.replace(/[\uD800-\uDFFF]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0')).replaceAll('\r','\\r').replaceAll('\n','\\n'),input:17,expected})));
export const stringPhase5ResourceSources=Object.freeze([
 'function f(x){return "a".repeat(257);}',
 'function f(x){return "a".padStart(Infinity,"b");}',
 'function f(x){return "a".padEnd(257,"b");}',
]);
export const stringPhase5ResumptionSource='function f(x){let log="";let s={toString(){log+="s";return " \\uD800ab ";}};let text=String.prototype.trim.call(s);let n={valueOf(){log+="n";return 6;}};let fill={toString(){log+="f";return ".";}};return log+":"+text.toWellFormed().padStart(n,fill)+":"+log+":"+x;}';
export const stringPhase5ResumptionExpected='s:...\uFFFDab:snf:17';
export const stringPhase5ReceiverErrorSources=Object.freeze(['at','codePointAt','repeat','padStart','padEnd','trim','trimStart','trimEnd','isWellFormed','toWellFormed'].map(name=>`function f(x){try{String.prototype.${name}.call(null);return false;}catch(e){return e instanceof TypeError;}}`));
export const stringPhase5WhitespaceSource='function f(x){const s="\\u0009\\u000B\\u000C\\u0020\\u00A0\\uFEFF\\u000A\\u000D\\u2028\\u2029\\u1680\\u2000\\u2001\\u2002\\u2003\\u2004\\u2005\\u2006\\u2007\\u2008\\u2009\\u200A\\u202F\\u205F\\u3000";return (s+"x"+s).trim()+":"+(s+"x").trimStart()+":"+("x"+s).trimEnd()+":"+s.trim().length+":"+x;}';
export const stringPhase5WhitespaceExpected='x:x:x:0:17';
