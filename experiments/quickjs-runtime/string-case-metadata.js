export const stringCaseMetadata=Object.freeze([
 {name:'toUpperCase',id:1850,length:0,field:'stringToUpperCase'},
 {name:'toLowerCase',id:1851,length:0,field:'stringToLowerCase'},
]);
export const stringCaseNewIntrinsics=Object.freeze({__lanesUnicodeCasePoint:1852,__lanesUnicodeCaseFlags:1853});
export const stringCaseIntrinsics=Object.freeze({...stringCaseNewIntrinsics,__lanesCodeUnit:1770,__lanesCharCodeAt:931,__lanesPrimitive:129,__lanesText:111,__lanesUnsupported:141});
// Private1852(cp,mode,index) -> mapped scalar at index0..2, or -1 beyond
// expansion. mode0 uppercase,mode1 lowercase. Private1853(cp) -> bitmask
// bit0 Cased,bit1 Case_Ignorable. No allocation or guest callback in either.
// Embed stringCaseWGSL at module scope, then add below objectMethod routing.
export const stringCaseDispatchWGSL=String.raw`
if(id==1852u||id==1853u){
 if(original.z!=0u){states[l].status=6u;return undef();}
 let cp=toBits(original.xy);
 if(cp>1114111u||!equalNumber(fromUnsigned(cp),original.xy)){states[l].status=6u;return undef();}
 if(id==1853u){return num(fromUnsigned(unicodeCaseFlags(cp)));}
 if(b.z!=0u||c.z!=0u){states[l].status=6u;return undef();}
 let mode=toBits(b.xy);let index=toBits(c.xy);
 if(mode>1u||index>2u||!equalNumber(fromUnsigned(mode),b.xy)||!equalNumber(fromUnsigned(index),c.xy)){states[l].status=6u;return undef();}
 return num(fromSigned(bitcast<u32>(unicodeCasePoint(cp,mode==1u,index))));
}`;
export const stringCaseGaps=Object.freeze([
 'Locale-sensitive toLocaleUpperCase/toLocaleLowerCase are not included.',
 'Unicode data pinned to vendor17.0.0; browser oracles with older Unicode data may differ for newly assigned mappings. Fixed expectations identify the chosen data version.',
 'Guest text/heap/frame/instruction limits remain explicit engine resource completions; no host case conversion or ASCII-only fallback.',
 'BigInt receiver text conversion remains explicitly unsupported until that primitive conversion is integrated.',
]);
// ES2025 clause3 references the Unicode Standard without a date and requires
// latest editions of undated references. 22.1.3.28/.30 require Default Case
// Conversion including UnicodeData and locale-insensitive SpecialCasing.
// https://tc39.es/ecma262/2025/multipage/normative-references.html
// https://tc39.es/ecma262/2025/multipage/text-processing.html#sec-string.prototype.tolowercase
