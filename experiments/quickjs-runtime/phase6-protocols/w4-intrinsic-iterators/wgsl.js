// Shader text for the parent to splice. These functions take no host oracle.
// They call alloc, unit, makeText, undef, num, boolean, toBits, fromUnsigned,
// and equalNumber, which already exist in shader.js.
//
// Paste iteratorWgslFunctions() at module scope before objectMethod.
// Paste iteratorObjectMethodWGSL() before `if(id>=150u){states[l].status=6u;return undef();}`.
// Paste iteratorMarkWGSL() in collect's mark walk. Kind 13 already markValue's its value.

import {
  ARRAY_ITERATOR_PROTOTYPE,
  CREATE_ARRAY_ITERATOR_ID,
  CREATE_STRING_ITERATOR_ID,
  ARRAY_ITERATOR_SLOT_ID,
  ARRAY_ITERATOR_CLEAR_ID,
  ARRAY_ITERATOR_SET_INDEX_ID,
  HEAP_KIND_ARRAY_ITERATOR,
  HEAP_KIND_STRING_ITERATOR,
  ITERATOR_IDENTITY_ID,
  STRING_ITERATOR_BRAND_ID,
  STRING_ITERATOR_DONE_ID,
  STRING_ITERATOR_PROTOTYPE,
  STRING_ITERATOR_TAKE_ID,
} from "./ids.js";

export function iteratorWgslFunctions() {
  return `
fn intrinsicCreateArrayIterator(l:u32, object:V, kindValue:V)->V {
  if(object.z!=4u&&object.z!=5u&&object.z!=11u){states[l].status=4u;return undef();}
  if(kindValue.z!=0u){states[l].status=4u;return undef();}
  let kind=toBits(kindValue.xy);
  if(kind>2u||!equalNumber(fromUnsigned(kind),kindValue.xy)){states[l].status=4u;return undef();}
  let holder=alloc(l,13u,object,0u,0u);
  if(states[l].status!=0u){return undef();}
  let id=alloc(l,${HEAP_KIND_ARRAY_ITERATOR}u,V(${ARRAY_ITERATOR_PROTOTYPE}u,holder,0u,kind),0u,0u);
  if(states[l].status!=0u){return undef();}
  return V(id,0u,4u,0u);
}
fn intrinsicCreateStringIterator(l:u32, text:V)->V {
  if(text.z!=7u){states[l].status=6u;return undef();}
  let holder=alloc(l,13u,text,0u,0u);
  if(states[l].status!=0u){return undef();}
  let id=alloc(l,${HEAP_KIND_STRING_ITERATOR}u,V(${STRING_ITERATOR_PROTOTYPE}u,holder,0u,0u),0u,0u);
  if(states[l].status!=0u){return undef();}
  return V(id,0u,4u,0u);
}
fn intrinsicArrayIteratorSlot(l:u32, receiver:V, selector:V)->V {
  if(selector.z!=0u){states[l].status=4u;return undef();}
  let op=toBits(selector.xy);
  if(op>3u||!equalNumber(fromUnsigned(op),selector.xy)){states[l].status=4u;return undef();}
  let isArray=receiver.z==4u&&states[l].heap[receiver.x].kind==${HEAP_KIND_ARRAY_ITERATOR}u;
  if(op==0u){return boolean(isArray);}
  if(!isArray){states[l].status=4u;return undef();}
  let packed=states[l].heap[receiver.x].value;
  if(op==1u){return states[l].heap[packed.y].value;}
  if(op==2u){return num(fromUnsigned(packed.z));}
  if(op==3u){return num(fromUnsigned(packed.w));}
  states[l].status=4u;return undef();
}
fn intrinsicArrayIteratorClear(l:u32, receiver:V)->V {
  if(receiver.z!=4u||states[l].heap[receiver.x].kind!=${HEAP_KIND_ARRAY_ITERATOR}u){states[l].status=4u;return undef();}
  let holder=states[l].heap[receiver.x].value.y;
  states[l].heap[holder].value=undef();
  return undef();
}
fn intrinsicArrayIteratorSetIndex(l:u32, receiver:V, indexValue:V)->V {
  if(receiver.z!=4u||states[l].heap[receiver.x].kind!=${HEAP_KIND_ARRAY_ITERATOR}u){states[l].status=4u;return undef();}
  if(indexValue.z!=0u){states[l].status=4u;return undef();}
  let index=toBits(indexValue.xy);
  if(!equalNumber(fromUnsigned(index),indexValue.xy)){states[l].status=4u;return undef();}
  states[l].heap[receiver.x].value.z=index;
  return undef();
}
fn intrinsicStringIteratorBrand(l:u32, receiver:V)->V {
  return boolean(receiver.z==4u&&states[l].heap[receiver.x].kind==${HEAP_KIND_STRING_ITERATOR}u);
}
fn intrinsicStringIteratorDone(l:u32, receiver:V)->V {
  if(receiver.z!=4u||states[l].heap[receiver.x].kind!=${HEAP_KIND_STRING_ITERATOR}u){states[l].status=4u;return undef();}
  let text=states[l].heap[states[l].heap[receiver.x].value.y].value;
  if(text.z!=7u){return boolean(true);}
  return boolean(states[l].heap[receiver.x].value.z>=text.y);
}
fn intrinsicStringIteratorTake(l:u32, receiver:V)->V {
  if(receiver.z!=4u||states[l].heap[receiver.x].kind!=${HEAP_KIND_STRING_ITERATOR}u){states[l].status=4u;return undef();}
  let id=receiver.x;
  let text=states[l].heap[states[l].heap[id].value.y].value;
  if(text.z!=7u){return undef();}
  let index=states[l].heap[id].value.z;
  if(index>=text.y){return undef();}
  var end=index+1u;
  let first=unit(l,text,index);
  if(first>=55296u&&first<=56319u&&end<text.y){
    let second=unit(l,text,end);
    if(second>=56320u&&second<=57343u){end=end+1u;}
  }
  let piece=makeText(l,text,undef(),index,end-index);
  if(states[l].status!=0u){return undef();}
  states[l].heap[id].value.z=end;
  return piece;
}
`;
}

export function iteratorObjectMethodWGSL() {
  return `
if(id==${CREATE_ARRAY_ITERATOR_ID}u){return intrinsicCreateArrayIterator(l,original,b);}
if(id==${CREATE_STRING_ITERATOR_ID}u){return intrinsicCreateStringIterator(l,original);}
if(id==${ARRAY_ITERATOR_SLOT_ID}u){return intrinsicArrayIteratorSlot(l,original,b);}
if(id==${ARRAY_ITERATOR_CLEAR_ID}u){return intrinsicArrayIteratorClear(l,original);}
if(id==${ARRAY_ITERATOR_SET_INDEX_ID}u){return intrinsicArrayIteratorSetIndex(l,original,b);}
if(id==${STRING_ITERATOR_TAKE_ID}u){return intrinsicStringIteratorTake(l,original);}
if(id==${STRING_ITERATOR_DONE_ID}u){return intrinsicStringIteratorDone(l,original);}
if(id==${STRING_ITERATOR_BRAND_ID}u){return intrinsicStringIteratorBrand(l,original);}
if(id==${ITERATOR_IDENTITY_ID}u){return receiver;}`;
}

export function iteratorMarkWGSL() {
  return `if(node.kind==${HEAP_KIND_ARRAY_ITERATOR}u||node.kind==${HEAP_KIND_STRING_ITERATOR}u){mark(l,node.value.x);mark(l,node.value.y);}`;
}

export const iteratorWgslFunctionText = iteratorWgslFunctions();
export const iteratorObjectMethodText = iteratorObjectMethodWGSL();
export const iteratorMarkText = iteratorMarkWGSL();
