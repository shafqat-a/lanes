import {arrayFlattenMetadata} from './array-flatten-source.js';
import {arraySpliceMetadata} from './array-splice-source.js';
// Explicit public identities; do not renumber the older arrayBuiltins 300 block.
export const arrayPhase5Metadata=Object.freeze([
 ['join',1400,1],['toString',1401,0],['map',1402,1],['filter',1403,1],['slice',1404,2],['concat',1405,1],
].map(([name,id,length])=>Object.freeze({name,id,length,field:'array'+name[0].toUpperCase()+name.slice(1)})).concat(arrayFlattenMetadata,arraySpliceMetadata));
export const arrayPhase5Intrinsics=Object.freeze({
 __lanesToObject:926,__lanesNumber:122,__lanesPrimitive:129,__lanesText:111,
 __lanesCall:113,__lanesDefineProperty:101,__lanesIsArray:201,
 __lanesObjectToString:155,__lanesUnsupported:141,
});
export const arrayPhase5Gaps=Object.freeze([
 'Symbols/BigInt conversion and custom @@toPrimitive follow explicit existing runtime limits.',
 'Cyclic join recursion is subject to explicit runtime frame/resource limits; no cycle-elision extension is claimed.',
 'Guest string, heap, frame, instruction and array resource bounds still apply. No CPU replay.',
]);
