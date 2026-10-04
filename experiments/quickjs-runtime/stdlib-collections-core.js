// WGSL collection core for Map/Set (parent-owned; see STDLIB-WAVE-CONTRACT.md).
// Storage: brand object (kind 40 Map / 41 Set) -> header (42) -> entry chain
// (43 live, 44 tombstone) with Map value cells (45). Iterators are kind 46.
// Every function here runs inside one instruction, so freshly allocated
// nodes cannot be collected before they are reachable (collect() only runs at
// instruction boundaries). Worst-case allocation per intrinsic: create 2,
// set/add 2, iterator 1, others 0.
import { STDLIB_NODES as N, STDLIB_KINDS as K, collectionIntrinsics as CI } from './stdlib-ids.js';

const id = name => CI[name];

export const collectionWGSLFunctions = ({ L }) => `
// SameValueZero (ES2025 7.2.11): NaN equals NaN, +0 equals -0.
fn collectionSameValueZero(l:u32,a:V,b:V)->bool {
  if(a.z==0u&&b.z==0u){if(nan(a.xy)&&nan(b.xy)){return true;}return equalNumber(a.xy,b.xy);}
  return equal(l,a,b);
}
fn collectionKey(v:V)->V {if(v.z==0u&&v.x==0u&&v.y==0x80000000u){return V(0u,0u,0u,0u);}return v;}
// Header of a brand object; brand 1 Map, 2 Set, 0 either. Status 2 on misuse.
fn collectionHeader(l:u32,v:V,brand:u32)->u32 {
  if(v.z!=4u){states[l].status=2u;return 0u;}
  let kind=states[l].heap[v.x].kind;
  if((kind!=${K.mapObject}u&&kind!=${K.setObject}u)||(brand!=0u&&kind!=${K.mapObject - 1}u+brand)){states[l].status=2u;return 0u;}
  return states[l].heap[v.x].value.z;
}
fn collectionFind(l:u32,header:u32,key:V)->u32 {
  var e=states[l].heap[header].value.x;
  for(var n=0u;n<${L.heap}u&&e!=0u;n++){
    if(states[l].heap[e].kind==${K.entry}u&&collectionSameValueZero(l,states[l].heap[e].value,key)){return e;}
    e=states[l].heap[e].next;
  }
  return 0u;
}
fn collectionAppend(l:u32,header:u32,key:V,value:V,isMap:bool) {
  var cell=0u;
  if(isMap){cell=alloc(l,${K.valueCell}u,value,0u,0u);if(states[l].status!=0u){return;}}
  let e=alloc(l,${K.entry}u,collectionKey(key),cell,0u);if(states[l].status!=0u){return;}
  let last=states[l].heap[header].value.y;
  if(last==0u){states[l].heap[header].value.x=e;}else{states[l].heap[last].next=e;}
  states[l].heap[header].value.y=e;states[l].heap[header].value.z++;
}
// header.value.w counts linked tombstones. Past a threshold the next
// instruction boundary collects (states.pad flag), so delete/re-insert loops
// stay linear instead of walking an ever-growing chain.
fn collectionTombstone(l:u32,header:u32,e:u32) {
  states[l].heap[e].kind=${K.deleted}u;states[l].heap[e].value=undef();states[l].heap[e].key=0u;
  states[l].heap[header].value.w++;
  if(states[l].heap[header].value.w>32u&&states[l].heap[header].value.w>states[l].heap[header].value.z){states[l].pad=1u;}
}
fn collectionIteratorNode(l:u32,v:V)->u32 {
  if(v.z!=4u||states[l].heap[v.x].kind!=${K.iterator}u){states[l].status=2u;return 0u;}
  return v.x;
}
fn collectionIntrinsic(l:u32,id:u32,original:V,b:V,c:V)->V {
  if(id==${id('__lanesCollectionCreate')}u){
    let brand=toBits(original.xy);
    if(original.z!=0u||(brand!=1u&&brand!=2u)){states[l].status=2u;return undef();}
    let header=alloc(l,${K.header}u,V(0u,0u,0u,0u),0u,0u);if(states[l].status!=0u){return undef();}
    let proto=select(${N.setProto}u,${N.mapProto}u,brand==1u);
    let obj=alloc(l,${K.mapObject - 1}u+brand,V(proto,0u,header,1u),0u,0u);if(states[l].status!=0u){return undef();}
    return V(obj,0u,4u,0u);
  }
  if(id==${id('__lanesCollectionBrand')}u){
    var brand=0u;
    if(original.z==4u){let kind=states[l].heap[original.x].kind;if(kind==${K.mapObject}u){brand=1u;}if(kind==${K.setObject}u){brand=2u;}}
    return num(fromUnsigned(brand));
  }
  if(id==${id('__lanesCollectionIterBrand')}u){
    var brand=0u;
    if(original.z==4u&&states[l].heap[original.x].kind==${K.iterator}u){brand=states[l].heap[original.x].key>>4u;}
    return num(fromUnsigned(brand));
  }
  if(id==${id('__lanesCollectionIterator')}u){
    let header=collectionHeader(l,original,0u);if(states[l].status!=0u){return undef();}
    let kind=toBits(b.xy);if(b.z!=0u||kind>2u){states[l].status=2u;return undef();}
    let brand=select(2u,1u,states[l].heap[original.x].kind==${K.mapObject}u);
    let proto=select(${N.setIteratorProto}u,${N.mapIteratorProto}u,brand==1u);
    let it=alloc(l,${K.iterator}u,V(proto,original.x,0u,1u),kind|(brand<<4u),0u);if(states[l].status!=0u){return undef();}
    return V(it,0u,4u,0u);
  }
  if(id==${id('__lanesCollectionStep')}u||id==${id('__lanesCollectionIterKey')}u||id==${id('__lanesCollectionIterValue')}u||id==${id('__lanesCollectionIterKind')}u){
    let it=collectionIteratorNode(l,original);if(states[l].status!=0u){return undef();}
    let node=states[l].heap[it];
    if(id==${id('__lanesCollectionIterKind')}u){return num(fromUnsigned(node.key&15u));}
    if(id==${id('__lanesCollectionStep')}u){
      if(node.value.y==0u){return boolean(false);}
      let header=states[l].heap[node.value.y].value.z;
      var e=states[l].heap[header].value.x;if(node.value.z!=0u){e=states[l].heap[node.value.z].next;}
      for(var n=0u;n<${L.heap}u&&e!=0u&&states[l].heap[e].kind!=${K.entry}u;n++){e=states[l].heap[e].next;}
      if(e==0u||states[l].heap[e].kind!=${K.entry}u){states[l].heap[it].value.y=0u;states[l].heap[it].value.z=0u;return boolean(false);}
      states[l].heap[it].value.z=e;return boolean(true);
    }
    let e=node.value.z;
    if(e==0u||states[l].heap[e].kind!=${K.entry}u){return undef();}
    if(id==${id('__lanesCollectionIterValue')}u&&states[l].heap[e].key!=0u){return states[l].heap[states[l].heap[e].key].value;}
    return states[l].heap[e].value;
  }
  let header=collectionHeader(l,original,0u);if(states[l].status!=0u){return undef();}
  let isMap=states[l].heap[original.x].kind==${K.mapObject}u;
  if(id==${id('__lanesCollectionSize')}u){return num(fromUnsigned(states[l].heap[header].value.z));}
  if(id==${id('__lanesCollectionClear')}u){
    var e=states[l].heap[header].value.x;
    for(var n=0u;n<${L.heap}u&&e!=0u;n++){if(states[l].heap[e].kind==${K.entry}u){collectionTombstone(l,header,e);}e=states[l].heap[e].next;}
    states[l].heap[header].value.z=0u;return undef();
  }
  let found=collectionFind(l,header,b);
  if(id==${id('__lanesCollectionHas')}u){return boolean(found!=0u);}
  if(id==${id('__lanesCollectionDelete')}u){
    if(found==0u){return boolean(false);}
    collectionTombstone(l,header,found);states[l].heap[header].value.z--;return boolean(true);
  }
  if(id==${id('__lanesMapGet')}u){
    if(!isMap){states[l].status=2u;return undef();}
    if(found==0u){return undef();}return states[l].heap[states[l].heap[found].key].value;
  }
  if(id==${id('__lanesMapSet')}u){
    if(!isMap){states[l].status=2u;return undef();}
    if(found!=0u){states[l].heap[states[l].heap[found].key].value=c;}else{collectionAppend(l,header,b,c,true);}
    return original;
  }
  if(id==${id('__lanesSetAdd')}u){
    if(isMap){states[l].status=2u;return undef();}
    if(found==0u){collectionAppend(l,header,b,undef(),false);}
    return original;
  }
  states[l].status=2u;return undef();
}
// After marking: unlink tombstones that no live iterator pins (bit 2 of
// marked, set while marking iterators) and leave them unmarked for the sweep.
fn collectionCompact(l:u32) {
  // Entry chains belong to exactly one collection. A heap-wide header scan
  // plus every reachable entry therefore takes fewer than twice heap-size
  // visits. One bounded loop avoids a compiler-visible heap-size squared nest.
  var scan=1u;var h=0u;var previous=0u;var e=0u;var kept=0u;
  for(var work=0u;work<${2 * L.heap}u;work++){
    if(h==0u){
      if(scan>=${L.heap}u){return;}
      let candidate=scan;scan++;
      if(states[l].heap[candidate].kind!=${K.header}u||(states[l].heap[candidate].marked&1u)==0u){continue;}
      h=candidate;previous=0u;kept=0u;e=states[l].heap[h].value.x;
      if(e==0u){states[l].heap[h].value.y=0u;states[l].heap[h].value.w=0u;h=0u;}
    }else{
      if(e>=${L.heap}u||(states[l].heap[e].kind!=${K.entry}u&&states[l].heap[e].kind!=${K.deleted}u)){states[l].status=2u;return;}
      let next=states[l].heap[e].next;
      if(states[l].heap[e].kind==${K.deleted}u&&(states[l].heap[e].marked&4u)==0u){
        if(previous==0u){states[l].heap[h].value.x=next;}else{states[l].heap[previous].next=next;}
        states[l].heap[e].marked&=~1u;states[l].heap[e].next=0u;
      }else{previous=e;if(states[l].heap[e].kind==${K.deleted}u){kept++;}}
      states[l].heap[e].marked&=~4u;e=next;
      if(e==0u){states[l].heap[h].value.y=previous;states[l].heap[h].value.w=kept;h=0u;}
    }
  }
  // A cycle or multiply-owned chain violates the VM heap invariant.
  states[l].status=2u;
}`;

// Lines inside collect()'s marking loop (node = states[l].heap[queue[i]]).
export const collectionMarkWGSL = `
    if(node.kind==${K.mapObject}u||node.kind==${K.setObject}u){mark(l,node.value.x);mark(l,node.value.z);}
    if(node.kind==${K.header}u){mark(l,node.value.x);}
    if(node.kind==${K.entry}u){markValue(l,node.value);mark(l,node.key);}
    if(node.kind==${K.valueCell}u){markValue(l,node.value);}
    if(node.kind==${K.iterator}u){mark(l,node.value.x);mark(l,node.value.y);if(node.value.z!=0u){mark(l,node.value.z);let pinned=states[l].heap[node.value.z].kind;if(pinned==${K.entry}u||pinned==${K.deleted}u){states[l].heap[node.value.z].marked|=4u;}}}`;

export const collectionObjectMethodWGSL = `if(id>=${CI.__lanesCollectionCreate}u&&id<=${CI.__lanesCollectionIterKind}u){return collectionIntrinsic(l,id,original,b,c);}`;
