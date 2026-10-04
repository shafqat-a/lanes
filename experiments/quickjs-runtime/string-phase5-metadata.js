// Reserved wave IDs. These are guest helpers, never host fallback routes.
export const stringPhase5Metadata=Object.freeze([
 ['at',1],['codePointAt',1],['repeat',1],['padStart',1],['padEnd',1],
 ['trim',0],['trimStart',0],['trimEnd',0],['isWellFormed',0],['toWellFormed',0],
].map(([name,length],i)=>Object.freeze({name,length,id:1500+i,field:'stringPhase5'+name[0].toUpperCase()+name.slice(1)})));
export const stringPhase5Intrinsics=Object.freeze({__lanesPrimitive:129,__lanesText:111,__lanesNumber:122,__lanesUnsupported:141,__lanesCharCodeAt:931,__lanesSlice:933});
export const stringPhase5Dependencies=Object.freeze([
 'OrdinaryToPrimitive uses existing __lanesPrimitive; custom Symbol.toPrimitive requires the separate Symbol integration.',
 'Symbol ToString and ToNumber must throw TypeError; explicit type checks are retained for Symbol admission.',
 'BigInt ToString currently ends unsupported; BigInt ToNumber throws TypeError. No silent number coercion.',
 'Results exceeding the existing UTF-16 string limit fail through makeText resource completion, not a fabricated semantic RangeError.',
 'Unicode casing, locale operations and normalization are pending; whitespace here is the exact ES2025 static table.',
]);
// Annex B aliases share the canonical function object and its canonical name.
export const stringPhase5Aliases=Object.freeze([
 Object.freeze({name:'trimLeft',target:'trimStart',id:1506}),
 Object.freeze({name:'trimRight',target:'trimEnd',id:1507}),
]);
