// Deliberately avoid comparing implementation-defined comparison sequences.
// Only mandated read-before-compare/write and abrupt-completion order is fixed.
const cases=[];
for(const method of ['sort','toSorted']){
 cases.push({feature:`sort-review-${method}-getter-abrupt-before-compare`,source:`function f(x){let compared=0,writes=0;const token={};const a={length:3,get 0(){return 2;},set 0(v){writes++;},get 1(){throw token;},get 2(){return 1;}};try{Array.prototype.${method}.call(a,()=>{compared++;return 0;});}catch(e){return (e===token)+":"+compared+":"+writes;}return "wrong";}`,expected:'true:0:0'});
 cases.push({feature:`sort-review-${method}-comparator-conversion-abrupt`,source:`function f(x){let writes=0;const token={};const a={length:2,get 0(){return 2;},set 0(v){writes++;},get 1(){return 1;},set 1(v){writes++;}};try{Array.prototype.${method}.call(a,()=>({valueOf(){throw token;}}));}catch(e){return (e===token)+":"+writes;}return "wrong";}`,expected:'true:0'});
 cases.push({feature:`sort-review-${method}-nan-conversion-stability`,source:`function f(x){const a=[{id:1},{id:2},{id:3},{id:4}];return a.${method}(()=>({valueOf(){return NaN;}})).map(v=>v.id).join("");}`,expected:'1234'});
}
cases.push({feature:'sort-review-partial-delete-order',source:'function f(x){const a=[2,1];a.length=5;let once=false;try{a.sort((left,right)=>{if(!once){once=true;a[2]=x;Object.defineProperty(a,3,{value:99,writable:true,enumerable:true,configurable:false});}return left-right;});}catch(e){return (e instanceof TypeError)+":"+a[0]+":"+a[1]+":"+(2 in a)+":"+(3 in a)+":"+a.length;}return "wrong";}',expected:'true:1:2:false:true:5'});
cases.push({feature:'sort-review-copy-deleted-index-reads-inherited',source:'function f(x){const prototype={1:9};const a=Object.create(prototype);a.length=3;Object.defineProperty(a,0,{get(){delete this[1];return 2;}});a[1]=3;a[2]=1;return Array.prototype.toSorted.call(a,(a,b)=>a-b).join(",");}',expected:'1,2,9'});
export const arraySortReviewCases=Object.freeze(cases.map(c=>Object.freeze({...c,input:17})));
