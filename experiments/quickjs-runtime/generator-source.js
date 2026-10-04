// Synchronous generator VM extension. These strings are production WGSL hooks,
// not a host generator implementation. Integration is explicit in generator-integration.md.
export const GENERATOR_KIND_BIT=1<<18;
export const generatorOpcodes=Object.freeze(['initial_yield','yield','yield_star','return_async']);
export const generatorMetadata=Object.freeze([
 {id:2500,name:'next',length:1},{id:2501,name:'return',length:1},{id:2502,name:'throw',length:1},
 {id:2503,name:'GeneratorFunction',length:1},
]);
export const generatorFields=Object.freeze(['Generator','GeneratorFunction','next','return','throw','value','done']);
export const generatorGCWGSL=`
    if(node.kind==2u&&node.value.z!=0u&&(node.value.z&0x80000000u)==0u&&states[l].heap[node.value.z].kind==56u){mark(l,node.value.z);}
    if(node.kind==56u){mark(l,node.value.y);mark(l,node.value.z);mark(l,node.key);}
    if(node.kind==57u||node.kind==58u){markValue(l,node.value);}
`;
export const generatorWGSLFunctions=({F,L})=>`
const GENERATOR_PROTOTYPE:u32=74u;
const GENERATOR_FUNCTION_PROTOTYPE:u32=75u;
const GENERATOR_ENV:u32=6u;
const GENERATOR_START:u32=0u;
const GENERATOR_YIELDED:u32=1u;
const GENERATOR_EXECUTING:u32=2u;
const GENERATOR_COMPLETED:u32=3u;
const GENERATOR_DELEGATED:u32=4u;
fn generatorFunction(l:u32,fnValue:V)->bool {
  return fnValue.z==5u&&(image[states[l].heap[fnValue.x].value.x*2u].w&0x40000u)!=0u;
}
fn generatorState(l:u32,value:V)->u32 {
  if(value.z!=4u||states[l].heap[value.x].kind!=2u){return 0u;}
  let id=states[l].heap[value.x].value.z;
  if(id==0u||(id&0x80000000u)!=0u){return 0u;}
  if(states[l].heap[id].kind!=56u||states[l].heap[id].key!=value.x){return 0u;}
  return id;
}
fn generatorActive(l:u32,env:u32)->u32 {
  if(env==0u||states[l].heap[env].kind!=4u||states[l].heap[env].value.w!=GENERATOR_ENV){return 0u;}
  return generatorState(l,V(states[l].heap[env].value.z,0u,4u,0u));
}
fn generatorResult(l:u32,value:V,done:bool)->V {
  let object=alloc(l,2u,V(1u,0u,0u,1u),0u,0u);
  if(states[l].status!=0u){return undef();}
  dataProperty(l,object,fieldKey(${F.value}u),value,7u);
  dataProperty(l,object,fieldKey(${F.done}u),boolean(done),7u);
  return V(object,0u,4u,0u);
}
fn generatorClose(l:u32,id:u32) {
  states[l].heap[id].value=V(0u,0u,0u,GENERATOR_COMPLETED);
  states[l].heap[id].next=0u;
}
fn generatorUnwind(l:u32,env:u32) {
  let id=generatorActive(l,env);if(id!=0u){generatorClose(l,id);}
}
fn generatorBeforeFinish(l:u32,value:V)->V {
  let id=generatorActive(l,states[l].env);
  if(id==0u||states[l].heap[id].value.w!=GENERATOR_EXECUTING){return value;}
  generatorClose(l,id);
  return generatorResult(l,value,true);
}
// Called once after creating the activation environment and filling arguments,
// before entering its first instruction. Parameter defaults run before initial_yield.
fn generatorEnter(l:u32,fnValue:V,env:u32,receiver:V) {
  var prototype=GENERATOR_PROTOTYPE;
  let requested=getProperty(l,fnValue,fieldKey(${F.prototype}u));
  if(states[l].status!=0u){return;}
  if(requested.z==12u){states[l].status=6u;return;}
  let view=objectView(l,requested);if(view.z==4u){prototype=view.x;}
  let object=alloc(l,2u,V(prototype,0u,0u,1u),0u,0u);
  let thisSlot=alloc(l,58u,receiver,0u,0u);
  let id=alloc(l,56u,V(0u,env,0u,GENERATOR_EXECUTING),object,thisSlot);
  if(states[l].status!=0u){return;}
  states[l].heap[object].value.z=id;
  states[l].heap[env].value.z=object;states[l].heap[env].value.w=GENERATOR_ENV;
}
fn generatorSuspend(l:u32,mode:u32) {
  let id=generatorActive(l,states[l].env);
  if(id==0u||states[l].heap[id].value.w!=GENERATOR_EXECUTING){states[l].status=2u;return;}
  let needed=states[l].sp-states[l].frames[states[l].depth].base+4u;
  if(states[l].freeCount<needed){collect(l);}
  var yielded=undef();if(mode!=GENERATOR_START){yielded=pop(l);}
  if(states[l].status!=0u){return;}
  let base=states[l].frames[states[l].depth].base;
  var first=0u;var previous=0u;
  for(var index=base;index<states[l].sp;index++){
    let slot=alloc(l,57u,states[l].stack[index],index-base,0u);
    if(states[l].status!=0u){return;}
    if(previous==0u){first=slot;}else{states[l].heap[previous].next=slot;}previous=slot;
  }
  states[l].heap[states[l].heap[id].next].value=states[l].frames[states[l].depth].receiver;
  states[l].heap[id].value=V(states[l].pc,states[l].env,first,mode);
  var result=yielded;
  if(mode==GENERATOR_START){result=V(states[l].heap[id].key,0u,4u,0u);}
  else if(mode!=GENERATOR_DELEGATED){result=generatorResult(l,yielded,false);}
  if(states[l].status==0u){finish(l,result);}
}
// The call() hook supplies its resolved this/argument, call-site stack base and
// tail flag. This helper either returns a completed result or installs a frame.
fn generatorResume(l:u32,receiver:V,argument:V,mode:u32,base:u32,tail:bool) {
  let id=generatorState(l,receiver);
  if(id==0u){states[l].status=4u;return;}
  let saved=states[l].heap[id].value;
  if(saved.w==GENERATOR_EXECUTING){states[l].status=4u;return;}
  if(saved.w==GENERATOR_COMPLETED||(saved.w==GENERATOR_START&&mode!=0u)){
    generatorClose(l,id);states[l].sp=base;
    if(mode==2u){raise(l,argument);return;}
    var value=undef();if(mode==1u){value=argument;}
    let result=generatorResult(l,value,true);
    if(states[l].status==0u){if(tail){finish(l,result);}else{push(l,result);}}return;
  }
  if(states[l].depth+1u>=${L.frames}u){states[l].status=3u;return;}
  var count=0u;var cursor=saved.z;
  for(var i=0u;i<${L.stack}u&&cursor!=0u;i++){
    if(states[l].heap[cursor].kind!=57u){states[l].status=2u;return;}
    count++;cursor=states[l].heap[cursor].next;
  }
  if(cursor!=0u||base+count+2u>${L.stack}u){states[l].status=3u;return;}
  let thisSlot=states[l].heap[id].next;
  if(thisSlot==0u||states[l].heap[thisSlot].kind!=58u){states[l].status=2u;return;}
  states[l].depth++;
  states[l].frames[states[l].depth]=Frame(states[l].pc,saved.y,base,select(0u,1u,tail),states[l].heap[thisSlot].value);
  states[l].sp=base;states[l].env=saved.y;states[l].pc=saved.x;
  cursor=saved.z;
  for(var i=0u;i<count;i++){
    push(l,states[l].heap[cursor].value);cursor=states[l].heap[cursor].next;
  }
  states[l].heap[id].value.z=0u;states[l].heap[id].value.w=GENERATOR_EXECUTING;
  if(saved.w!=GENERATOR_START){
    if(mode==2u&&saved.w==GENERATOR_YIELDED){raise(l,argument);}
    else{push(l,argument);push(l,num(fromUnsigned(mode)));}
  }
}
`;
export const generatorWGSLCases=()=>({
 initial_yield:'generatorSuspend(l,GENERATOR_START);',
 yield:'generatorSuspend(l,GENERATOR_YIELDED);',
 yield_star:'generatorSuspend(l,GENERATOR_DELEGATED);',
 return_async:'let value=pop(l);finish(l,value);',
});
export const generatorClosureWGSL=({F})=>`
  if((fnInfo.w&0x40000u)!=0u){
    states[l].heap[backing].value.x=GENERATOR_FUNCTION_PROTOTYPE;
    let proto=alloc(l,2u,V(GENERATOR_PROTOTYPE,0u,0u,1u),0u,0u);
    dataProperty(l,backing,fieldKey(${F.prototype}u),V(proto,0u,4u,0u),1u);
  }
`;
export const generatorInitWGSL=({F,iteratorPrototypeNode,toStringTagNode})=>{
 if(!Number.isInteger(iteratorPrototypeNode)||iteratorPrototypeNode<1)throw new Error('Generator integration requires the shared IteratorPrototype node');
 if(!Number.isInteger(toStringTagNode))throw new Error('Generator integration requires Symbol.toStringTag identity');
 return `
  states[l].heap[74u]=Node(V(${iteratorPrototypeNode}u,0u,0u,1u),0u,0u,2u,0u);
  states[l].heap[75u]=Node(V(3u,0u,0u,1u),0u,0u,2u,0u);
  dataProperty(l,74u,fieldKey(${F.constructor}u),V(75u,0u,4u,0u),4u);
  dataProperty(l,75u,fieldKey(${F.prototype}u),V(74u,0u,4u,0u),4u);
  dataProperty(l,75u,fieldKey(${F.constructor}u),V(2503u,0u,11u,0u),4u);
  dataProperty(l,74u,0x60000000u|${toStringTagNode}u,image[fieldKey(${F.Generator}u)],4u);
  dataProperty(l,75u,0x60000000u|${toStringTagNode}u,image[fieldKey(${F.GeneratorFunction}u)],4u);
  ${generatorMetadata.slice(0,3).map(m=>`dataProperty(l,74u,fieldKey(${F[m.name]}u),V(${m.id}u,0u,11u,0u),5u);`).join('\n  ')}
 `;
};
