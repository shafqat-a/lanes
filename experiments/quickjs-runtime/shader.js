import { numberWGSL } from '../../src/vm/number.js';
import { LIMITS as L, OP, FIELDS as F } from './program.js';
export const SNAPSHOT_WORDS = 264;
export const STATE_WORDS = 16 + L.frames * 8 + L.stack * 4 + L.heap * 8 + L.heap;
const cases = (names, body) => `case ${names.split(' ').map(n => `${OP[n]}u`).join(', ')}: { ${body} }`;
const matchesText = text => `(s.y==${text.length}u && ${[...text].map((c,i) => `unit(l,s,${i}u)==${c.charCodeAt(0)}u`).join(' && ')})`;
export const shader = `${numberWGSL}
alias V = vec4<u32>;
struct Node { value: V, next: u32, key: u32, kind: u32, marked: u32 }
struct Frame { pc: u32, env: u32, base: u32, tail: u32, receiver: V }
struct State {
  pc: u32, env: u32, depth: u32, sp: u32,
  status: u32, steps: u32, freeHead: u32, freeCount: u32,
  result: V, collections: u32, ready: u32, queueTop: u32, pad: u32,
  frames: array<Frame, ${L.frames}>, stack: array<V, ${L.stack}>,
  heap: array<Node, ${L.heap}>, queue: array<u32, ${L.heap}>
}
struct Snapshot { status: u32, steps: u32, collections: u32, pad: u32, value: V, chars: array<u32,256> }
struct Params { count: u32, budget: u32, instructions: u32, padding: u32 }
@group(0) @binding(0) var<storage, read> code: array<V>;
@group(0) @binding(1) var<storage, read> image: array<V>;
@group(0) @binding(2) var<storage, read_write> states: array<State>;
@group(0) @binding(3) var<uniform> params: Params;
@group(0) @binding(4) var<storage, read_write> output: array<Snapshot>;
fn undef() -> V { return V(0u, 0x7ff80000u, 3u, 0u); }
fn num(n: Pair) -> V { return V(n, 0u, 0u); }
fn boolean(b: bool) -> V { return V(0u, select(0u,0x3ff00000u,b),1u,0u); }
fn truth(v: V) -> bool { return v.z == 4u || v.z == 5u || v.z==11u || (v.z == 7u && v.y > 0u) || (v.z < 2u && !zero(v.xy) && !nan(v.xy)); }
fn unit(l:u32,v:V,index:u32)->u32 {
  if(v.w!=0u){return image[v.x+index].x;}
  var id=v.x;for(var i=0u;i<index/4u;i++){id=states[l].heap[id].next;}
  return states[l].heap[id].value[index%4u];
}
fn keyText(l:u32,key:u32)->V {
  if((key&0xc0000000u)==0x40000000u){let id=key&0x3fffffffu;return V(id,states[l].heap[id].key,7u,0u);}
  return image[key];
}
fn sameKey(l:u32,a:u32,b:u32)->bool {
  if(a==b){return true;}if(((a|b)&0x80000000u)!=0u){return false;}
  return textEqual(l,keyText(l,a),keyText(l,b));
}
fn textEqual(l: u32, a: V, b: V) -> bool {
  if (a.y != b.y) { return false; }
  var same=true;
  for (var j = 0u; j < a.y && same; j++) { same=unit(l,a,j)==unit(l,b,j); }
  return same;
}
fn equal(l: u32, a: V, b: V) -> bool {
  if (a.z != b.z) { return false; }
  if (a.z < 2u) { return equalNumber(a.xy,b.xy); }
  if (a.z == 7u) { return textEqual(l,a,b); }
  if (a.z == 4u || a.z == 5u || a.z==11u) { return a.x == b.x; }
  return true;
}
fn push(l: u32, v: V) {
  if (states[l].sp >= ${L.stack}u) { states[l].status = 3u; return; }
  states[l].stack[states[l].sp] = v; states[l].sp++;
}
fn pop(l: u32) -> V {
  if (states[l].sp <= states[l].frames[states[l].depth].base) { states[l].status = 2u; return undef(); }
  states[l].sp--; return states[l].stack[states[l].sp];
}
fn peek(l: u32) -> V {
  if (states[l].sp == 0u) { states[l].status = 2u; return undef(); }
  return states[l].stack[states[l].sp-1u];
}
fn alloc(l: u32, kind: u32, value: V, key: u32, next: u32) -> u32 {
  let id = states[l].freeHead;
  if (id == 0u) { states[l].status = 3u; return 0u; }
  states[l].freeHead = states[l].heap[id].next; states[l].freeCount--;
  states[l].heap[id] = Node(value,next,key,kind,select(0u,14u,kind==3u || kind==9u)); return id;
}
fn mark(l: u32, id: u32) {
  if (id == 0u || (states[l].heap[id].marked&1u) != 0u) { return; }
  states[l].heap[id].marked |= 1u;
  states[l].queue[states[l].queueTop] = id; states[l].queueTop++;
}
fn markValue(l: u32, v: V) { if (v.z == 4u || v.z == 5u || (v.z==7u && v.w==0u)) { mark(l,v.x); } }
fn collect(l: u32) {
  states[l].queueTop = 0u;for(var root=1u;root<=18u;root++){mark(l,root);}mark(l,states[l].env); markValue(l,states[l].result);
  for (var i=0u;i<=states[l].depth;i++) { mark(l,states[l].frames[i].env); markValue(l,states[l].frames[i].receiver); }
  for (var i=0u;i<states[l].sp;i++) { markValue(l,states[l].stack[i]); }
  for (var i=0u;i<states[l].queueTop;i++) {
    let node = states[l].heap[states[l].queue[i]];
    mark(l,node.next);
    if (node.kind == 1u || node.kind == 3u || node.kind==13u) { markValue(l,node.value); }
    if (node.kind == 4u || node.kind == 6u || node.kind==15u) { mark(l,node.value.x); }
    if (node.kind == 2u || node.kind == 7u || node.kind==8u || node.kind==14u) { mark(l,node.value.x); }
    if(node.kind==2u&&(node.value.z&0x80000000u)!=0u){mark(l,node.value.z&0x7fffffffu);}
    if (node.kind == 5u || node.kind==12u) { mark(l,node.value.y); }
    if(node.kind==12u){markValue(l,V(node.value.x,0u,node.value.z,0u));}
    if(node.kind==9u){if((node.value.x&0x80000000u)==0u){mark(l,node.value.x);}if((node.value.y&0x80000000u)==0u){mark(l,node.value.y);}}
    if ((node.kind==3u || node.kind==9u || node.kind==15u) && (node.key&0xc0000000u)==0x40000000u) {mark(l,node.key&0x3fffffffu);}
  }
  states[l].freeHead=0u; states[l].freeCount=0u;
  for (var i=${L.heap-1}u;i>0u;i--) {
    if ((states[l].heap[i].marked&1u) == 0u) {
      states[l].heap[i].kind=0u; states[l].heap[i].next=states[l].freeHead;
      states[l].freeHead=i; states[l].freeCount++;
    } else { states[l].heap[i].marked &= ~1u; }
  }
  states[l].collections++;
}
fn find(l: u32, head: u32, key: u32) -> u32 {
  var id = states[l].heap[head].next;
  for (var n=0u;n<${L.heap}u && id!=0u && states[l].heap[id].key!=key;n++) { id=states[l].heap[id].next; }
  return id;
}
fn findProperty(l:u32,head:u32,key:u32)->u32 {
  var id=states[l].heap[head].next;
  for(var i=0u;i<${L.heap}u && id!=0u && !sameKey(l,states[l].heap[id].key,key);i++){id=states[l].heap[id].next;}return id;
}
fn makeText(l:u32,a:V,b:V,start:u32,length:u32)->V {
  if(length>256u){states[l].status=3u;return undef();}
  var first=0u;var previous=0u;
  for(var i=0u;i<length;i+=4u){
    var chars=V(0u);
    for(var j=0u;j<4u && i+j<length;j++){
      let index=start+i+j;if(index<a.y){chars[j]=unit(l,a,index);}else{chars[j]=unit(l,b,index-a.y);}
    }
    let id=alloc(l,10u,chars,length,0u);if(first==0u){first=id;}else{states[l].heap[previous].next=id;}previous=id;
  }
  return V(first,length,7u,0u);
}
fn cell(l: u32, env: u32, slot: u32, isReference: bool) -> u32 {
  var id: u32;
  if (isReference) { id=find(l,states[l].heap[env].value.x,slot); id=states[l].heap[id].value.x; }
  else { id=find(l,env,slot); }
  if (id==0u) { states[l].status=2u; } return id;
}
fn environment(l: u32, closure: u32, argc:u32) -> u32 {
  let env=alloc(l,4u,V(closure,argc,0u,0u),0u,0u);
  let fnInfo=image[states[l].heap[closure].value.x*2u];let args=max(argc,fnInfo.y);
  for (var i=0u;i<args+fnInfo.z;i++) {
    var slot=i; if (i>=args) { slot=16u+i-args; }
    let c=alloc(l,1u,undef(),slot,states[l].heap[env].next); states[l].heap[env].next=c;
  }
  return env;
}
fn closure(l: u32, f: u32) -> V {
  let id=alloc(l,5u,V(f,0u,0u,0u),0u,0u); let fnInfo=image[f*2u]; let refs=image[f*2u+1u].x;
  for (var i=0u;i<(fnInfo.w&0xffffu);i++) {
    let spec=image[refs+i]; var captured=0u;
    if (spec.x==0u) { captured=cell(l,states[l].env,16u+spec.y,false); }
    else if (spec.x==1u) { captured=cell(l,states[l].env,spec.y,false); }
    else if (spec.x==2u) { captured=cell(l,states[l].env,spec.y,true); }
    else if(spec.x==4u){captured=alloc(l,1u,V(spec.y,0u,11u,0u),0u,0u);}
    else if(spec.x==5u){captured=alloc(l,1u,V(spec.y,spec.z,spec.w,0u),0u,0u);}
    else { captured=alloc(l,1u,V(id,0u,5u,0u),0u,0u); }
    let c=alloc(l,6u,V(captured,0u,0u,0u),i,states[l].heap[id].next); states[l].heap[id].next=c;
  }
  let backing=alloc(l,2u,V(3u,0u,id|0x80000000u,1u),0u,0u);
  states[l].heap[id].value.y=backing;
  let length=alloc(l,3u,num(fromUnsigned(image[f*2u+1u].z)),fieldKey(${F.length}u),0u);
  states[l].heap[length].marked=8u;states[l].heap[backing].next=length;
  let name=alloc(l,3u,image[image[f*2u+1u].w],fieldKey(${F.name}u),length);
  states[l].heap[name].marked=8u;states[l].heap[backing].next=name;
  if((fnInfo.w&0x10000u)!=0u){
    let proto=alloc(l,2u,V(1u,0u,0u,1u),0u,0u);
    let constructor=alloc(l,3u,V(id,0u,5u,0u),fieldKey(${F.constructor}u),0u);
    states[l].heap[constructor].marked=10u;states[l].heap[proto].next=constructor;
    let property=alloc(l,3u,V(proto,0u,4u,0u),fieldKey(${F.prototype}u),states[l].heap[backing].next);
    states[l].heap[property].marked=2u;states[l].heap[backing].next=property;
  }
  return V(id,0u,5u,0u);
}
fn keyOf(l: u32, value: V) -> u32 {
  if (value.z==0u) {
    let n=toBits(value.xy);
    if (n<0x80000000u && equalNumber(fromUnsigned(n),value.xy)) { return n|0x80000000u; }
  }
  if (value.z==7u) {
    if (value.y>0u && value.y<=10u && (value.y==1u || unit(l,value,0u)!=48u)) {
      var n=0u; var valid=true;
      for (var i=0u;i<value.y && valid;i++) {
        let c=unit(l,value,i);
        valid=!(c<48u || c>57u || n>429496729u || (n==429496729u && c>53u));
        if(valid){n=n*10u+c-48u;}
      }
      if (valid && n<0x80000000u) { return n|0x80000000u; }
      if (valid && n<0xffffffffu) {states[l].status=6u;return 0u;}
    }
    if(value.w==0u){return value.x|0x40000000u;}return value.w;
  }
  states[l].status=6u; return 0u;
}
fn lengthKey(l: u32, key: u32) -> bool {
  if ((key&0x80000000u)!=0u) { return false; }
  let s=keyText(l,key);
  return ${matchesText('length')};
}
fn inheritedBuiltin(l:u32,key:u32,kind:u32)->bool {
  if((key&0x80000000u)!=0u || kind==0u){return false;}
  for(var i=0u;i<image[params.padding+1u].z;i++) {
    let item=image[params.padding+2u+i];
    if(item.y<=kind && sameKey(l,key,item.x)){return true;}
  }
  return false;
}
fn fieldKey(index:u32)->u32 {return image[image[params.padding+1u].w+index].x;}
fn field(l:u32,key:u32,index:u32)->bool {return sameKey(l,key,fieldKey(index));}
fn sameValue(l:u32,a:V,b:V)->bool {
  if(a.z==0u && b.z==0u){if(nan(a.xy)&&nan(b.xy)){return true;}return all(a.xy==b.xy);}
  return equal(l,a,b);
}
fn objectView(l:u32,v:V)->V {
  if(v.z==5u){return V(states[l].heap[v.x].value.y,0u,4u,0u);}
  if(v.z==11u&&v.x==200u){return V(18u,0u,4u,0u);}
  if(v.z==11u&&v.x==400u){return V(3u,0u,4u,0u);}
  if(v.z==11u&&v.x>=600u&&v.x<=606u){return V(11u+v.x-600u,0u,4u,0u);}return v;
}
fn objectValue(l:u32,id:u32)->V {
  if(id==0u){return V(0u,0u,2u,0u);}
  if(id==18u){return V(200u,0u,11u,0u);}
  if(id==3u){return V(400u,0u,11u,0u);}
  if(id>=11u&&id<=17u){return V(600u+id-11u,0u,11u,0u);}
  let owner=states[l].heap[id].value.z;
  if(states[l].heap[id].kind==2u&&(owner&0x80000000u)!=0u){return V(owner&0x7fffffffu,0u,5u,0u);}
  return V(id,0u,4u,0u);
}
// Legacy caller/arguments accessors need additional strict/sloppy semantics.
fn functionKey(l:u32,v:V,key:u32)->bool {
  if((v.z!=5u&&v.z!=11u)||(key&0x80000000u)!=0u){return true;}
  let unsupported=field(l,key,${F.caller}u)||field(l,key,${F.arguments}u);
  if(unsupported){states[l].status=6u;}return !unsupported;
}
fn functionName(l:u32,value:V,name:V,force:bool) {
  if(value.z!=5u){states[l].status=6u;return;}
  let obj=objectView(l,value);var property=findProperty(l,obj.x,fieldKey(${F.name}u));
  if(property!=0u&&!force){let node=states[l].heap[property];if(node.kind!=3u||node.value.z!=7u||node.value.y!=0u){return;}}
  if(property==0u){property=alloc(l,3u,name,fieldKey(${F.name}u),states[l].heap[obj.x].next);states[l].heap[obj.x].next=property;}
  states[l].heap[property].value=name;states[l].heap[property].kind=3u;states[l].heap[property].marked=8u;
}
fn unsignedText(l:u32,number:u32)->V {
  var n=number;var digits:array<u32,10>;var count=0u;
  loop{digits[count]=48u+n%10u;count++;n/=10u;if(n==0u){break;}}
  var first=0u;var previous=0u;
  for(var i=0u;i<count;i+=4u){var chars=V(0u);
    for(var j=0u;j<4u&&i+j<count;j++){chars[j]=digits[count-1u-i-j];}
    let id=alloc(l,10u,chars,count,0u);if(first==0u){first=id;}else{states[l].heap[previous].next=id;}previous=id;
  }return V(first,count,7u,0u);
}
fn keyName(l:u32,key:u32)->V {
  if((key&0x80000000u)==0u){return keyText(l,key);}return unsignedText(l,key&0x7fffffffu);
}
fn callbackValue(id:u32)->V {return V(id&0x7fffffffu,0u,select(5u,11u,(id&0x80000000u)!=0u),0u);}
fn callbackId(value:V)->u32 {
  if(value.z==3u){return 0u;}return value.x|select(0u,0x80000000u,value.z==11u);
}
fn getProperty(l: u32, original: V, key: u32) -> V {
  if(!functionKey(l,original,key)){return undef();}var obj=objectView(l,original);
  if(obj.z==11u&&(field(l,key,${F.call}u)||field(l,key,${F.apply}u)||field(l,key,${F.bind}u))){obj=V(3u,0u,4u,0u);}
  if (obj.z==2u || obj.z==3u) { states[l].status=4u; return undef(); }
  if (lengthKey(l,key)) {
    if (obj.z==7u) { return num(fromUnsigned(obj.y)); }
    if (obj.z==4u && states[l].heap[obj.x].kind==7u) { return num(fromUnsigned(states[l].heap[obj.x].value.y)); }
  }
  if(obj.z==11u&&obj.x==500u){
    if(field(l,key,${F.prototype}u)){return V(400u,0u,11u,0u);}
    if(field(l,key,${F.name}u)){return image[fieldKey(${F.Function}u)];}
    if(lengthKey(l,key)){return num(fromUnsigned(1u));}
    states[l].status=6u;return undef();
  }
  if(obj.z==11u && obj.x==100u){
    if(field(l,key,${F.prototype}u)){return V(1u,0u,4u,0u);}
    if(field(l,key,${F.length}u)){return num(fromUnsigned(1u));}
    if(field(l,key,${F.name}u)){return image[fieldKey(${F.Object}u)];}
    var id=1u;for(;id<=9u&&!field(l,key,id);id++){}
    if(id<=9u){return V(100u+id,0u,11u,0u);}
    states[l].status=6u;return undef();
  }
  if(obj.z==7u) {
    if((key&0x80000000u)!=0u){let i=key&0x7fffffffu;if(i>=obj.y){return undef();}return makeText(l,obj,undef(),i,1u);}
    let s=keyText(l,key);
    if(${matchesText('charCodeAt')}){return V(1u,0u,11u,0u);}
    if(${matchesText('charAt')}){return V(2u,0u,11u,0u);}
    if(${matchesText('slice')}){return V(3u,0u,11u,0u);}
    states[l].status=6u;return undef();
  }
  if (obj.z!=4u) { states[l].status=6u; return undef(); }
  var current=obj.x;var property=0u;
  for(var i=0u;i<${L.heap}u && current!=0u && property==0u;i++){
    property=findProperty(l,current,key);current=states[l].heap[current].value.x;
  }
  if(property==0u){return undef();}
  let node=states[l].heap[property];
  if(node.kind==11u){return objectValue(l,states[l].heap[obj.x].value.x);}
  if(node.kind==9u){if(node.value.x==0u){return undef();}return V(node.value.x,0u,12u,0u);}
  if(node.kind==15u){return states[l].heap[node.value.x].value;}
  return node.value;
}
fn putProperty(l: u32, original: V, key: u32, value: V, define: bool) -> V {
  if(!functionKey(l,original,key)){return undef();}let obj=objectView(l,original);
  if (obj.z!=4u) { states[l].status=4u; return undef(); }
  if (states[l].heap[obj.x].kind==7u) {
    if (lengthKey(l,key)) {
      if(value.z>=4u) {states[l].status=6u;return undef();}
      let length=toBits(value.xy);
      if(!equalNumber(fromUnsigned(length),value.xy)) {states[l].status=8u;return undef();}
      if(length>=0x80000000u) {states[l].status=6u;return undef();}
      var previous=obj.x; var property=states[l].heap[obj.x].next;
      while(property!=0u) {
        let next=states[l].heap[property].next; let index=states[l].heap[property].key;
        if((index&0x80000000u)!=0u && (index&0x7fffffffu)>=length) {states[l].heap[previous].next=next;states[l].heap[property].next=0u;}
        else {previous=property;} property=next;
      }
      states[l].heap[obj.x].value.y=length; return undef();
    }
  }
  if(!define) {
    var current=obj.x;var inherited=0u;
    for(var i=0u;i<${L.heap}u && current!=0u && inherited==0u;i++) {
      inherited=findProperty(l,current,key);current=states[l].heap[current].value.x;
    }
    if(inherited!=0u) {
        let node=states[l].heap[inherited];
        if(node.kind==11u){if(value.z==4u||value.z==5u||value.z==11u||value.z==2u){let ignored=setPrototype(l,original,value);}return undef();}
        if(node.kind==9u) {
          if(node.value.y!=0u) {return V(node.value.y,0u,12u,0u);}
          if(image[code[states[l].pc-1u].w*2u+1u].y!=0u) {states[l].status=4u;}
          return undef();
        }
        if((node.marked&2u)==0u){if(image[code[states[l].pc-1u].w*2u+1u].y!=0u){states[l].status=4u;}return undef();}
    }
  }
  var property=findProperty(l,obj.x,key);
  if(property==0u && states[l].heap[obj.x].value.w==0u){if(define || image[code[states[l].pc-1u].w*2u+1u].y!=0u){states[l].status=4u;}return undef();}
  if(states[l].heap[obj.x].kind==7u && (key&0x80000000u)!=0u){states[l].heap[obj.x].value.y=max(states[l].heap[obj.x].value.y,(key&0x7fffffffu)+1u);}
  if (property==0u) { property=alloc(l,3u,value,key,states[l].heap[obj.x].next); states[l].heap[obj.x].next=property; }
  else if(states[l].heap[property].kind==15u){states[l].heap[states[l].heap[property].value.x].value=value;}
  else { states[l].heap[property].value=value;states[l].heap[property].kind=3u; }
  return undef();
}
fn defineAccessor(l:u32,obj:V,key:u32,fnValue:V,setter:bool) {
  if(obj.z!=4u||fnValue.z!=5u){states[l].status=4u;return;}
  var property=findProperty(l,obj.x,key);
  if(property==0u){property=alloc(l,9u,V(0u),key,states[l].heap[obj.x].next);states[l].heap[obj.x].next=property;}
  if(states[l].heap[property].kind!=9u){states[l].heap[property].kind=9u;states[l].heap[property].value=V(0u);}
  states[l].heap[property].value[select(0u,1u,setter)]=fnValue.x;
}
fn finish(l:u32,result:V) {
  // Keep completion writes outside the unwind loop. The equivalent loop with
  // early returns failed to publish completion in the tested Dawn/Metal build.
  var complete=true;var omitResult=false;var constructed=undef();var isConstructor=false;
  for(var i=0u;i<${L.frames}u;i++) {
    if(states[l].depth==0u){break;}
    let frame=states[l].frames[states[l].depth];states[l].depth--;states[l].sp=frame.base;
    states[l].env=states[l].frames[states[l].depth].env;states[l].pc=frame.pc;
    if(frame.tail!=1u){complete=false;omitResult=frame.tail==2u;isConstructor=frame.tail==3u;constructed=frame.receiver;break;}
  }
  var returned=result;
  if(isConstructor&&result.z!=4u&&result.z!=5u&&result.z!=11u){returned=constructed;}
  if(complete){states[l].result=returned;states[l].status=1u;}
  else if(!omitResult){push(l,returned);}
}
fn raise(l:u32,error:V) {
  var depth=states[l].depth;var sp=states[l].sp;var found=false;var destination=0u;
  for(var i=0u;i<${L.stack+L.frames}u && !found && (sp>states[l].frames[depth].base || depth>0u);i++) {
    if(sp>states[l].frames[depth].base) {
      sp--;let value=states[l].stack[sp];found=value.z==9u;destination=value.x;
    }else{depth--;}
  }
  states[l].depth=depth;states[l].sp=sp;states[l].env=states[l].frames[depth].env;
  if(found){states[l].pc=destination;states[l].status=0u;push(l,error);}
  else{states[l].result=error;states[l].status=7u;}
}
fn truncatePositive(value:Pair)->Pair {
  let exponent=(value.y>>20u)&2047u;
  if(exponent<1023u){return Pair(0u);}if(exponent>=1075u){return value;}
  let bits=1075u-exponent;
  if(bits>=32u){return Pair(0u,value.y&~((1u<<(bits-32u))-1u));}
  return Pair(value.x&~((1u<<bits)-1u),value.y);
}
fn bindFunction(l:u32,callee:V,thisValue:V,count:u32,argumentsOffset:u32)->V {
  if(callee.z!=5u&&callee.z!=11u){states[l].status=4u;return undef();}
  let obj=objectView(l,callee);var prototype=3u;var length=num(Pair(0u));
  if(obj.z==4u){
    prototype=states[l].heap[obj.x].value.x;
    if(findProperty(l,obj.x,fieldKey(${F.length}u))!=0u){length=getProperty(l,callee,fieldKey(${F.length}u));}
  }else{length=getProperty(l,callee,fieldKey(${F.length}u));}
  if(length.z==12u){states[l].status=6u;}if(states[l].status!=0u){return undef();}
  var boundLength=Pair(0u);
  if(length.z==0u&&!nan(length.xy)&&lessNumber(Pair(0u),length.xy)){
    let integer=truncatePositive(length.xy);let amount=fromUnsigned(count);
    if(lessNumber(amount,integer)){boundLength=plus(integer,Pair(amount.x,amount.y^0x80000000u));}
  }
  var name=getProperty(l,callee,fieldKey(${F.name}u));
  if(name.z==12u){states[l].status=6u;}if(states[l].status!=0u){return undef();}
  if(name.z!=7u){name=image[fieldKey(${F['']}u)];}
  let prefix=image[fieldKey(${F['bound ']}u)];name=makeText(l,prefix,name,0u,prefix.y+name.y);
  if(states[l].status!=0u){return undef();}
  let id=alloc(l,12u,V(callee.x,0u,callee.z,count),0u,0u);
  let backing=alloc(l,2u,V(prototype,0u,id|0x80000000u,1u),0u,0u);states[l].heap[id].value.y=backing;
  let lengthProperty=alloc(l,3u,num(boundLength),fieldKey(${F.length}u),0u);states[l].heap[lengthProperty].marked=8u;
  let nameProperty=alloc(l,3u,name,fieldKey(${F.name}u),lengthProperty);states[l].heap[nameProperty].marked=8u;states[l].heap[backing].next=nameProperty;
  var previous=alloc(l,13u,thisValue,0u,0u);states[l].heap[id].next=previous;
  for(var i=0u;i<count;i++){let node=alloc(l,13u,states[l].stack[argumentsOffset+i],0u,0u);states[l].heap[previous].next=node;previous=node;}
  return V(id,0u,5u,0u);
}
fn argumentsObject(l:u32,mapped:bool)->V {
  let env=states[l].env;let count=states[l].heap[env].value.y;
  let id=alloc(l,14u,V(1u,0u,0u,1u),0u,0u);
  for(var i=0u;i<count;i++){
    let binding=cell(l,env,i,false);
    if(mapped){let property=alloc(l,15u,V(binding,0u,0u,0u),0x80000000u|i,states[l].heap[id].next);states[l].heap[property].marked=14u;states[l].heap[id].next=property;}
    else{dataProperty(l,id,0x80000000u|i,states[l].heap[binding].value,7u);}
  }
  dataProperty(l,id,fieldKey(${F.length}u),num(fromUnsigned(count)),5u);
  if(mapped){dataProperty(l,id,fieldKey(${F.callee}u),V(states[l].heap[env].value.x,0u,5u,0u),5u);return V(id,0u,4u,0u);}
  let poison=0x80000000u|700u;
  let property=alloc(l,9u,V(poison,poison,0u,0u),fieldKey(${F.callee}u),states[l].heap[id].next);
  states[l].heap[property].marked=0u;states[l].heap[id].next=property;
  return V(id,0u,4u,0u);
}
fn makeArray(l:u32,count:u32,offset:u32,elementsOnly:bool)->V {
  var length=count;var elements=count;
  if(count==1u&&!elementsOnly){
    let value=states[l].stack[offset];
    if(value.z==0u){
      length=toBits(value.xy);elements=0u;
      if(!equalNumber(fromUnsigned(length),value.xy)){states[l].status=8u;return undef();}
      if(length>=0x80000000u){states[l].status=6u;return undef();}
    }
  }
  let id=alloc(l,7u,V(2u,length,0u,1u),0u,0u);let obj=V(id,0u,4u,0u);
  for(var i=0u;i<elements;i++){let ignored=putProperty(l,obj,0x80000000u|i,states[l].stack[offset+i],true);}
  return obj;
}
fn callWrapper(l:u32,value:V)->bool {
  return (value.z==11u&&(value.x==401u||value.x==402u||value.x==113u))||(value.z==5u&&states[l].heap[value.x].kind==12u);
}
fn call(l: u32, argumentCount: u32, method: bool, tail: bool) {
  var argc=argumentCount;var isMethod=method;var extra=select(1u,2u,isMethod);
  if(argc>${L.args}u||states[l].sp<argc+extra){states[l].status=3u;return;}
  let base=states[l].sp-argc-extra;var fnValue=states[l].stack[base+extra-1u];var invalidReceiver=false;
  for(var i=0u;i<${L.frames}u&&callWrapper(l,fnValue)&&!invalidReceiver&&states[l].status==0u;i++){
    if(fnValue.z==5u){
      let bound=states[l].heap[fnValue.x];let count=bound.value.w;
      if(argc+count>${L.args}u||base+2u+argc+count>${L.stack}u){states[l].status=3u;}
      else{
        for(var j=argc;j>0u;j--){states[l].stack[base+2u+count+j-1u]=states[l].stack[base+extra+j-1u];}
        var node=bound.next;let thisValue=states[l].heap[node].value;node=states[l].heap[node].next;
        for(var j=0u;j<count;j++){states[l].stack[base+2u+j]=states[l].heap[node].value;node=states[l].heap[node].next;}
        fnValue=V(bound.value.x,0u,bound.value.z,0u);states[l].stack[base]=thisValue;states[l].stack[base+1u]=fnValue;
        argc+=count;extra=2u;isMethod=true;states[l].sp=base+extra+argc;
      }
    }else if(fnValue.x==113u){
      var callee=undef();var thisValue=undef();
      if(argc>0u){callee=states[l].stack[base+extra];}
      if(argc>1u){thisValue=states[l].stack[base+extra+1u];}
      invalidReceiver=callee.z!=5u&&callee.z!=11u;
      let remaining=select(0u,argc-2u,argc>1u);
      for(var j=0u;j<remaining;j++){states[l].stack[base+2u+j]=states[l].stack[base+extra+2u+j];}
      fnValue=callee;states[l].stack[base]=thisValue;states[l].stack[base+1u]=callee;
      argc=remaining;extra=2u;isMethod=true;states[l].sp=base+extra+argc;
    }else{
      var callee=undef();if(isMethod){callee=states[l].stack[base];}
      invalidReceiver=callee.z!=5u&&callee.z!=11u;
      if(!invalidReceiver){
        var thisValue=undef();if(argc>0u){thisValue=states[l].stack[base+2u];}
        var remaining=0u;
        if(fnValue.x==401u){
          remaining=select(0u,argc-1u,argc>0u);
          for(var j=0u;j<remaining;j++){states[l].stack[base+2u+j]=states[l].stack[base+3u+j];}
        }else{
          var list=undef();if(argc>1u){list=states[l].stack[base+3u];}
          if(list.z!=2u&&list.z!=3u){
            let obj=objectView(l,list);
            if(obj.z!=4u){states[l].status=select(4u,6u,obj.z==11u);}
            else{
              let length=getProperty(l,list,fieldKey(${F.length}u));
              if(length.z>=4u){states[l].status=6u;}
              else if(!nan(length.xy)&&lessNumber(Pair(0u),length.xy)){
                if(!lessNumber(length.xy,fromUnsigned(${L.args+1}u))){states[l].status=3u;}else{remaining=toBits(length.xy);}
              }
              if(base+2u+remaining>${L.stack}u){states[l].status=3u;}
              for(var j=0u;j<remaining&&states[l].status==0u;j++){
                let value=getProperty(l,list,j|0x80000000u);
                if(value.z==12u){states[l].status=6u;}else{states[l].stack[base+2u+j]=value;}
              }
            }
          }
        }
        if(states[l].status==0u){
          states[l].stack[base]=thisValue;states[l].stack[base+1u]=callee;
          argc=remaining;states[l].sp=base+2u+argc;fnValue=callee;
        }
      }
    }
  }
  if(invalidReceiver){states[l].status=4u;return;}if(states[l].status!=0u){return;}
  if(callWrapper(l,fnValue)){states[l].status=3u;return;}
  if(fnValue.z==11u&&fnValue.x==101u){
    let helper=image[image[params.padding+1u].w+${F.defineProperty}u].y;
    if(helper!=0u){fnValue=closure(l,helper-1u);states[l].stack[base+extra-1u]=fnValue;}
  }
  if(fnValue.z==11u) {
    var receiver=undef();if(isMethod){receiver=states[l].stack[base];}
    // Array.of's generic constructor path needs guest [[Construct]] resumption.
    if(fnValue.x==202u&&(receiver.z==5u||(receiver.z==11u&&receiver.x!=200u))){states[l].status=6u;return;}
    var a=undef();var b=undef();if(argc>0u){a=states[l].stack[base+extra];}if(argc>1u){b=states[l].stack[base+extra+1u];}
    var c=undef();if(argc>2u){c=states[l].stack[base+extra+2u];}
    var value=undef();if(fnValue.x==200u||fnValue.x==202u){value=makeArray(l,argc,base+extra,fnValue.x==202u);}else if(fnValue.x==403u){value=bindFunction(l,receiver,a,select(0u,argc-1u,argc>0u),base+extra+1u);}else if(fnValue.x<100u){value=stringMethod(l,fnValue.x,receiver,a,b);}else{value=objectMethod(l,fnValue.x,receiver,a,b,c);}states[l].sp=base;
    if(states[l].status==0u){if(tail){finish(l,value);}else{push(l,value);}}return;
  }
  if (fnValue.z!=5u) { states[l].status=4u; return; }
  if (states[l].depth+1u>=${L.frames}u) { states[l].status=3u; return; }
  let fnInfo=image[states[l].heap[fnValue.x].value.x*2u];
  let env=environment(l,fnValue.x,argc);
  for (var i=0u;i<argc;i++) { let c=cell(l,env,i,false); states[l].heap[c].value=states[l].stack[base+extra+i]; }
  var receiver=undef(); if (isMethod) { receiver=states[l].stack[base]; }
  states[l].depth++; states[l].frames[states[l].depth]=Frame(states[l].pc,env,base,select(0u,1u,tail),receiver);
  states[l].sp=base; states[l].env=env; states[l].pc=fnInfo.x;
}
fn construct(l:u32,argumentCount:u32) {
  var argc=argumentCount;
  if(argc>${L.args}u||states[l].sp<argc+2u){states[l].status=3u;return;}
  let base=states[l].sp-argc-2u;var callee=states[l].stack[base];let newTarget=states[l].stack[base+1u];
  if(callee.z!=5u&&callee.z!=11u){states[l].status=4u;return;}
  if(!equal(l,callee,newTarget)){states[l].status=6u;return;}
  for(var i=0u;i<${L.frames}u&&callee.z==5u&&states[l].heap[callee.x].kind==12u&&states[l].status==0u;i++){
    let bound=states[l].heap[callee.x];let count=bound.value.w;
    if(argc+count>${L.args}u||base+2u+argc+count>${L.stack}u){states[l].status=3u;}
    else{
      for(var j=argc;j>0u;j--){states[l].stack[base+2u+count+j-1u]=states[l].stack[base+2u+j-1u];}
      var node=states[l].heap[bound.next].next;
      for(var j=0u;j<count;j++){states[l].stack[base+2u+j]=states[l].heap[node].value;node=states[l].heap[node].next;}
      argc+=count;callee=V(bound.value.x,0u,bound.value.z,0u);states[l].sp=base+2u+argc;
    }
  }
  if(states[l].status!=0u){return;}
  if(callee.z==5u&&states[l].heap[callee.x].kind==12u){states[l].status=3u;return;}
  if(callee.z==11u){
    if(callee.x==100u||callee.x==200u||(callee.x>=600u&&callee.x<=606u)){states[l].stack[base]=undef();states[l].stack[base+1u]=callee;call(l,argc,true,false);}
    else{states[l].status=select(4u,6u,callee.x==500u);}return;
  }
  if(callee.z!=5u){states[l].status=4u;return;}
  let info=image[states[l].heap[callee.x].value.x*2u];
  if((info.w&0x10000u)==0u){states[l].status=4u;return;}
  let value=getProperty(l,callee,fieldKey(${F.prototype}u));let prototype=objectView(l,value);
  if(states[l].status!=0u){return;}
  if(prototype.z==11u||prototype.z==12u){states[l].status=6u;return;}
  var parent=1u;if(prototype.z==4u){parent=prototype.x;}
  let obj=alloc(l,2u,V(parent,0u,0u,1u),0u,0u);
  states[l].stack[base]=V(obj,0u,4u,0u);states[l].stack[base+1u]=callee;
  let depth=states[l].depth;call(l,argc,true,false);
  if(states[l].status==0u&&states[l].depth>depth){states[l].frames[states[l].depth].tail=3u;}
}
fn setPrototype(l:u32,original:V,parentValue:V)->V {
  let obj=objectView(l,original);let proto=objectView(l,parentValue);
  if(proto.z==11u||obj.z==11u){states[l].status=6u;return undef();}
  if(proto.z!=4u&&proto.z!=2u){states[l].status=4u;return undef();}
  if(obj.z==2u||obj.z==3u){states[l].status=4u;return undef();}
  if(obj.z!=4u){return original;}
  var parent=0u;if(proto.z==4u){parent=proto.x;}
  if(parent==states[l].heap[obj.x].value.x){return original;}
  if(states[l].heap[obj.x].value.w==0u||obj.x==1u){states[l].status=4u;return undef();}
  var current=parent;var cycle=false;
  for(var i=0u;i<${L.heap}u&&current!=0u&&!cycle;i++){cycle=current==obj.x;current=states[l].heap[current].value.x;}
  if(cycle){states[l].status=4u;return undef();}
  states[l].heap[obj.x].value.x=parent;return original;
}
fn descriptor(l:u32,original:V,key:u32,description:V)->V {
  if(!functionKey(l,original,key)){return undef();}
  let obj=objectView(l,original);let desc=objectView(l,description);
  if(obj.z==11u||desc.z==11u){states[l].status=6u;return undef();}
  if(obj.z!=4u || desc.z!=4u){states[l].status=4u;return undef();}
  if(states[l].heap[obj.x].kind==7u){states[l].status=6u;return undef();}
  var values:array<V,6>;var has:array<bool,6>;
  for(var i=0u;i<6u;i++){
    let k=fieldKey(${F.value}u+i);var current=desc.x;
    while(current!=0u){if(findProperty(l,current,k)!=0u){has[i]=true;break;}current=states[l].heap[current].value.x;}
    values[i]=getProperty(l,desc,k);if(values[i].z==12u){states[l].status=6u;return undef();}
  }
  let accessor=has[2]||has[3];let data=has[0]||has[1];
  if(accessor&&data){states[l].status=4u;return undef();}
  for(var i=2u;i<4u;i++){if(has[i]&&values[i].z!=3u&&values[i].z!=5u&&values[i].z!=11u){states[l].status=4u;return undef();}}
  var property=findProperty(l,obj.x,key);var flags=0u;var kind=select(3u,9u,accessor);var old=undef();var mapping=0u;
  if(property!=0u){
    let node=states[l].heap[property];flags=(node.marked>>1u)&7u;old=node.value;
    let oldKind=select(node.kind,3u,node.kind==15u);if(node.kind==15u){mapping=node.value.x;old=states[l].heap[mapping].value;}
    if(node.kind==11u){states[l].status=6u;return undef();}
    if(!accessor&&!data){kind=oldKind;}
    if((flags&4u)==0u){
      if((has[5]&&truth(values[5]))||(has[4]&&truth(values[4])!=((flags&2u)!=0u))||kind!=oldKind){states[l].status=4u;return undef();}
      if(kind==3u && (flags&1u)==0u && ((has[1]&&truth(values[1]))||(has[0]&&!sameValue(l,values[0],old)))){states[l].status=4u;return undef();}
      if(kind==9u){for(var i=2u;i<4u;i++){if(has[i]){let id=callbackId(values[i]);if(id!=old[i-2u]){states[l].status=4u;return undef();}}}}
    }
    if(kind!=oldKind){old=undef();flags&=6u;}
  }else{
    if(states[l].heap[obj.x].value.w==0u){states[l].status=4u;return undef();}
    property=alloc(l,kind,undef(),key,states[l].heap[obj.x].next);states[l].heap[obj.x].next=property;
  }
  for(var i=0u;i<3u;i++){
    let index=select(4u+i-1u,1u,i==0u);let mask=1u<<i;
    if(has[index]){flags=(flags&~mask)|select(0u,mask,truth(values[index]));}
  }
  if(kind==3u){if(has[0]){old=values[0];}}
  else{
    if(old.z==3u){old=V(0u);}
    for(var i=2u;i<4u;i++){if(has[i]){old[i-2u]=callbackId(values[i]);}}
  }
  if(mapping!=0u&&kind==3u){
    if(has[0]){states[l].heap[mapping].value=old;}
    if((flags&1u)!=0u){kind=15u;old=V(mapping,0u,0u,0u);}
  }
  states[l].heap[property].kind=kind;states[l].heap[property].value=old;states[l].heap[property].marked=flags<<1u;
  return original;
}
fn descriptorObject(l:u32,value:V,flags:u32,accessor:bool)->V {
  let id=alloc(l,2u,V(1u,0u,0u,1u),0u,0u);let obj=V(id,0u,4u,0u);
  if(accessor){
    for(var i=0u;i<2u;i++){var v=undef();if(value[i]!=0u){v=V(value[i]&0x7fffffffu,0u,select(5u,11u,(value[i]&0x80000000u)!=0u),0u);}let ignored=putProperty(l,obj,fieldKey(${F.get}u+i),v,true);}
  }else{let ignored=putProperty(l,obj,fieldKey(${F.value}u),value,true);let ignored2=putProperty(l,obj,fieldKey(${F.writable}u),boolean((flags&1u)!=0u),true);}
  let ignored3=putProperty(l,obj,fieldKey(${F.enumerable}u),boolean((flags&2u)!=0u),true);
  let ignored4=putProperty(l,obj,fieldKey(${F.configurable}u),boolean((flags&4u)!=0u),true);return obj;
}
fn dataProperty(l:u32,obj:u32,key:u32,value:V,flags:u32) {
  let property=alloc(l,3u,value,key,states[l].heap[obj].next);
  states[l].heap[property].marked=flags<<1u;states[l].heap[obj].next=property;
}
fn primitiveText(l:u32,value:V)->V {
  if(value.z==7u){return value;}
  if(value.z==1u){return image[fieldKey(select(${F['false']}u,${F['true']}u,truth(value)))];}
  if(value.z==2u){return image[fieldKey(${F['null']}u)];}
  if(value.z==3u){return image[fieldKey(${F['undefined']}u)];}
  if(value.z==0u){
    if(nan(value.xy)){return image[fieldKey(${F.NaN}u)];}
    if(value.x==0u&&(value.y&0x7fffffffu)==0x7ff00000u){return image[fieldKey(select(${F.Infinity}u,${F['-Infinity']}u,(value.y&0x80000000u)!=0u))];}
    let magnitude=Pair(value.x,value.y&0x7fffffffu);let n=toBits(magnitude);
    if(equalNumber(fromUnsigned(n),magnitude)){
      let text=unsignedText(l,n);
      if((value.y&0x80000000u)!=0u&&n!=0u){let prefix=image[fieldKey(${F['-']}u)];return makeText(l,prefix,text,0u,1u+text.y);}return text;
    }
  }
  states[l].status=6u;return undef();
}
fn makeError(l:u32,kind:u32,message:V,options:V)->V {
  var text=undef();if(message.z!=3u){text=primitiveText(l,message);}
  if(states[l].status!=0u){return undef();}
  let id=alloc(l,8u,V(4u+kind,0u,0u,1u),0u,0u);
  if(message.z!=3u){dataProperty(l,id,fieldKey(${F.message}u),text,5u);}
  let obj=objectView(l,options);
  if(obj.z==11u){states[l].status=6u;return undef();}
  if(obj.z==4u){
    var current=obj.x;var property=0u;
    for(var i=0u;i<${L.heap}u&&current!=0u&&property==0u;i++){property=findProperty(l,current,fieldKey(${F.cause}u));current=states[l].heap[current].value.x;}
    if(property!=0u){let cause=getProperty(l,options,fieldKey(${F.cause}u));
      if(cause.z==12u){states[l].status=6u;return undef();}dataProperty(l,id,fieldKey(${F.cause}u),cause,5u);}
  }
  return V(id,0u,4u,0u);
}
fn errorString(l:u32,receiver:V)->V {
  if(objectView(l,receiver).z!=4u){states[l].status=select(4u,6u,receiver.z==11u);return undef();}
  let rawName=getProperty(l,receiver,fieldKey(${F.name}u));var name=image[fieldKey(${F.Error}u)];
  if(rawName.z!=3u){name=primitiveText(l,rawName);}
  if(states[l].status!=0u){return undef();}
  let rawMessage=getProperty(l,receiver,fieldKey(${F.message}u));var message=image[fieldKey(${F['']}u)];
  if(rawMessage.z!=3u){message=primitiveText(l,rawMessage);}
  if(states[l].status!=0u){return undef();}
  if(name.y==0u){return message;}if(message.y==0u){return name;}
  let separator=image[fieldKey(${F[': ']}u)];let first=makeText(l,name,separator,0u,name.y+separator.y);
  return makeText(l,first,message,0u,first.y+message.y);
}
fn objectMethod(l:u32,id:u32,receiver:V,original:V,b:V,c:V)->V {
  let a=objectView(l,original);
  if(id==700u){states[l].status=4u;return undef();}
  if(id==201u){return boolean(a.z==4u&&states[l].heap[a.x].kind==7u);}
  if(id==110u){return descriptor(l,original,keyOf(l,b),c);}
  if(id==111u){return primitiveText(l,original);}
  if(id==112u){return V(alloc(l,2u,V(0u,0u,0u,1u),0u,0u),0u,4u,0u);}
  if(id>=600u&&id<=606u){return makeError(l,id-600u,original,b);}
  if(id==650u){return errorString(l,receiver);}
  if(id==400u){return undef();}
  if(id==151u||id==153u){
    let receiverObject=objectView(l,receiver);
    if(receiverObject.z!=4u){states[l].status=select(6u,4u,receiverObject.z==2u||receiverObject.z==3u);return undef();}
    let key=keyOf(l,original);if(!functionKey(l,receiver,key)){return undef();}
    let property=findProperty(l,receiverObject.x,key);let arrayLength=states[l].heap[receiverObject.x].kind==7u&&lengthKey(l,key);
    if(id==151u){return boolean(property!=0u||arrayLength);}
    return boolean(property!=0u&&(states[l].heap[property].marked&4u)!=0u);
  }
  if(id==152u){
    let receiverObject=objectView(l,receiver);
    if(a.z==11u||receiverObject.z==11u){states[l].status=6u;return undef();}
    if(a.z!=4u){return boolean(false);}
    if(receiverObject.z!=4u){states[l].status=select(6u,4u,receiverObject.z==2u||receiverObject.z==3u);return undef();}
    var current=states[l].heap[a.x].value.x;var found=false;
    for(var i=0u;i<${L.heap}u&&current!=0u&&!found;i++){found=current==receiverObject.x;current=states[l].heap[current].value.x;}
    return boolean(found);
  }
  if(id==155u){
    var key=${F['[object Object]']}u;
    switch receiver.z {
      case 0u:{key=${F['[object Number]']}u;}
      case 1u:{key=${F['[object Boolean]']}u;}
      case 2u:{key=${F['[object Null]']}u;}
      case 3u:{key=${F['[object Undefined]']}u;}
      case 5u,11u:{key=${F['[object Function]']}u;}
      case 7u:{key=${F['[object String]']}u;}
      case 4u:{let kind=states[l].heap[receiver.x].kind;
        if(kind==7u){key=${F['[object Array]']}u;}else if(kind==8u){key=${F['[object Error]']}u;}else if(kind==14u){key=${F['[object Arguments]']}u;}}
      default:{states[l].status=6u;return undef();}
    }
    return image[fieldKey(key)];
  }
  if(id==156u){if(objectView(l,receiver).z==4u){return receiver;}states[l].status=select(6u,4u,receiver.z==2u||receiver.z==3u);return undef();}
  if(id>=150u){states[l].status=6u;return undef();}
  if(id==120u){let obj=objectView(l,receiver);if(obj.z!=4u){states[l].status=select(6u,4u,obj.z==2u||obj.z==3u);return undef();}return objectValue(l,states[l].heap[obj.x].value.x);}
  if(id==121u){let obj=objectView(l,receiver);
    if(obj.z==2u||obj.z==3u){states[l].status=4u;return undef();}
    if(obj.z==11u){states[l].status=6u;return undef();}
    if(obj.z==4u&&(a.z==4u||a.z==11u||a.z==2u)){let ignored=setPrototype(l,receiver,original);}return undef();}
  if((id==108u||id==109u)&&a.z==11u){states[l].status=6u;return undef();}
  if(id==106u){return boolean(sameValue(l,original,b));}
  if(id==108u){if(a.z==4u){states[l].heap[a.x].value.w=0u;}return original;}
  if(id==109u){return boolean(a.z==4u && states[l].heap[a.x].value.w!=0u);}
  if(id==105u){return setPrototype(l,original,b);}
  if(id==103u){
    if(a.z==11u){states[l].status=6u;return undef();}
    if(a.z!=4u&&a.z!=2u){states[l].status=4u;return undef();}if(b.z!=3u){states[l].status=6u;return undef();}
    var proto=0u;if(a.z==4u){proto=a.x;}let obj=alloc(l,2u,V(proto,0u,0u,1u),0u,0u);return V(obj,0u,4u,0u);
  }
  if(id==100u){if(a.z==4u){return original;}if(a.z==2u||a.z==3u){let obj=alloc(l,2u,V(1u,0u,0u,1u),0u,0u);return V(obj,0u,4u,0u);}states[l].status=6u;return undef();}
  if(a.z!=4u){states[l].status=select(6u,4u,a.z==2u||a.z==3u||(id==101u&&a.z!=11u));return undef();}
  if(id==104u){return objectValue(l,states[l].heap[a.x].value.x);}
  if(id==101u){return descriptor(l,original,keyOf(l,b),c);}
  if(id==102u||id==107u){
    let key=keyOf(l,b);if(!functionKey(l,original,key)){return undef();}let property=findProperty(l,a.x,key);let arrayLength=states[l].heap[a.x].kind==7u&&lengthKey(l,key);
    if(id==107u){return boolean(property!=0u||arrayLength);}
    if(arrayLength){return descriptorObject(l,num(fromUnsigned(states[l].heap[a.x].value.y)),1u,false);}
    if(property==0u){return undef();}let node=states[l].heap[property];var value=node.value;if(node.kind==15u){value=states[l].heap[value.x].value;}return descriptorObject(l,value,(node.marked>>1u)&7u,node.kind==9u||node.kind==11u);
  }
  states[l].status=6u;return undef();
}
fn instanceOf(l:u32,value:V,original:V)->V {
  var callee=original;
  for(var i=0u;i<${L.frames}u&&callee.z==5u&&states[l].heap[callee.x].kind==12u;i++){
    let bound=states[l].heap[callee.x];callee=V(bound.value.x,0u,bound.value.z,0u);
  }
  if(callee.z==5u&&states[l].heap[callee.x].kind==12u){states[l].status=3u;return undef();}
  if(callee.z!=5u&&callee.z!=11u){states[l].status=4u;return undef();}
  if(value.z!=4u&&value.z!=5u&&value.z!=11u){return boolean(false);}
  var prototype=undef();
  if(callee.z==11u&&callee.x==200u){prototype=V(2u,0u,4u,0u);}
  else if(objectView(l,callee).z==4u||callee.x==100u||callee.x==500u){prototype=objectView(l,getProperty(l,callee,fieldKey(${F.prototype}u)));}
  if(states[l].status!=0u){return undef();}
  if(prototype.z==11u||prototype.z==12u){states[l].status=6u;return undef();}
  if(prototype.z!=4u){states[l].status=4u;return undef();}
  let obj=objectView(l,value);var current=3u;
  if(obj.z==4u){
    current=states[l].heap[obj.x].value.x;
  }
  var found=false;
  for(var i=0u;i<${L.heap}u&&current!=0u&&!found;i++){found=current==prototype.x;current=states[l].heap[current].value.x;}
  return boolean(found);
}
fn stringIndex(l:u32,v:V,length:u32,relative:bool)->u32 {
  if(v.z>=4u){states[l].status=6u;return 0u;}
  let n=v.xy;if(nan(n)||zero(n)){return 0u;}
  let magnitude=Pair(n.x,n.y&0x7fffffffu);
  if(lessNumber(magnitude,Pair(0u,0x3ff00000u))){return 0u;}
  let negative=(n.y&0x80000000u)!=0u;
  if(!lessNumber(magnitude,fromUnsigned(length))){return select(length,0u,negative&&relative);}
  let integer=toBits(magnitude);
  if(negative){return select(length,length-integer,relative);}return integer;
}
fn stringMethod(l:u32,id:u32,receiver:V,a:V,b:V)->V {
  if(receiver.z!=7u){states[l].status=4u;return undef();}
  if(id==3u){let start=stringIndex(l,a,receiver.y,true);var end=receiver.y;
    if(b.z!=3u){end=stringIndex(l,b,receiver.y,true);}return makeText(l,receiver,undef(),start,select(0u,end-start,end>start));}
  let index=stringIndex(l,a,receiver.y,false);
  if(id==1u){if(index>=receiver.y){return num(qnan());}return num(fromUnsigned(unit(l,receiver,index)));}
  return makeText(l,receiver,undef(),index,select(0u,1u,index<receiver.y));
}
fn binary(l: u32, op: u32, a: V, b: V) -> V {
  if (op==${OP.strict_eq}u || op==${OP.strict_neq}u) { return boolean(equal(l,a,b)!=(op==${OP.strict_neq}u)); }
  if (op==${OP.eq}u || op==${OP.neq}u) {
    var same=false;
    if (a.z==b.z) { same=equal(l,a,b); }
    else if ((a.z==2u || a.z==3u) && (b.z==2u || b.z==3u)) { same=true; }
    else if (a.z<2u && b.z<2u) { same=equalNumber(a.xy,b.xy); }
    else if (a.z==2u || a.z==3u || b.z==2u || b.z==3u) { same=false; }
    else { states[l].status=6u; }
    return boolean(same!=(op==${OP.neq}u));
  }
  if(a.z==7u && b.z==7u){
    if(op==${OP.add}u){return makeText(l,a,b,0u,a.y+b.y);}
    if(op==${OP.lt}u||op==${OP.lte}u||op==${OP.gt}u||op==${OP.gte}u){
      var order=0i;
      for(var i=0u;i<min(a.y,b.y)&&order==0i;i++){let x=unit(l,a,i);let y=unit(l,b,i);if(x!=y){order=select(1i,-1i,x<y);}}
      if(order==0i && a.y!=b.y){order=select(1i,-1i,a.y<b.y);}
      if(op==${OP.lt}u){return boolean(order<0i);}if(op==${OP.lte}u){return boolean(order<=0i);}
      if(op==${OP.gt}u){return boolean(order>0i);}return boolean(order>=0i);
    }
  }
  if (a.z>=4u || b.z>=4u) { states[l].status=6u; return undef(); }
  switch op {
    ${cases('add', 'return num(plus(a.xy,b.xy));')}
    ${cases('sub', 'return num(plus(a.xy,Pair(b.x,b.y^0x80000000u)));')}
    ${cases('mul', 'return num(times(a.xy,b.xy));')}
    ${cases('div', 'return num(divide(a.xy,b.xy));')}
    ${cases('mod', 'return num(remainder(a.xy,b.xy));')}
    ${cases('lt', 'return boolean(lessNumber(a.xy,b.xy));')}
    ${cases('lte', 'return boolean(lessNumber(a.xy,b.xy)||equalNumber(a.xy,b.xy));')}
    ${cases('gt', 'return boolean(lessNumber(b.xy,a.xy));')}
    ${cases('gte', 'return boolean(lessNumber(b.xy,a.xy)||equalNumber(a.xy,b.xy));')}
    ${cases('and', 'return num(fromSigned(toBits(a.xy)&toBits(b.xy)));')}
    ${cases('or', 'return num(fromSigned(toBits(a.xy)|toBits(b.xy)));')}
    ${cases('xor', 'return num(fromSigned(toBits(a.xy)^toBits(b.xy)));')}
    ${cases('shl', 'return num(fromSigned(toBits(a.xy)<<(toBits(b.xy)&31u)));')}
    ${cases('sar', 'return num(fromSigned(bitcast<u32>(bitcast<i32>(toBits(a.xy))>>(toBits(b.xy)&31u))));')}
    ${cases('shr', 'return num(fromUnsigned(toBits(a.xy)>>(toBits(b.xy)&31u)));')}
    default: { states[l].status=2u; return undef(); }
  }
}
@compute @workgroup_size(32)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let l=gid.x; if (l>=params.count) { return; }
  if (states[l].ready==0u) {
    states[l].ready=1u; states[l].freeHead=1u; states[l].freeCount=${L.heap-1}u;
    for (var i=1u;i<${L.heap-1}u;i++) { states[l].heap[i].next=i+1u; }
    let objectProto=alloc(l,2u,V(0u,0u,1u,1u),0u,0u);
    let arrayProto=alloc(l,7u,V(objectProto,0u,2u,1u),0u,0u);
    let functionProto=alloc(l,2u,V(objectProto,0u,0u,1u),0u,0u);
    for(var i=0u;i<7u;i++){let id=alloc(l,2u,V(select(4u,1u,i==0u),0u,0u,1u),0u,0u);}
    for(var i=0u;i<7u;i++){let id=alloc(l,2u,V(select(11u,3u,i==0u),0u,0u,1u),0u,0u);}
    let arrayConstructor=alloc(l,2u,V(3u,0u,0u,1u),0u,0u);
    dataProperty(l,arrayConstructor,fieldKey(${F.name}u),image[fieldKey(${F.Array}u)],4u);
    dataProperty(l,arrayConstructor,fieldKey(${F.length}u),num(fromUnsigned(1u)),4u);
    dataProperty(l,arrayConstructor,fieldKey(${F.prototype}u),V(arrayProto,0u,4u,0u),0u);
    let arrayStatics=array<u32,4>(${F.isArray}u,${F.of}u,${F.from}u,${F.fromAsync}u);
    for(var i=0u;i<4u;i++){dataProperty(l,arrayConstructor,fieldKey(arrayStatics[i]),V(201u+i,0u,11u,0u),5u);}
    let errorNames=array<u32,7>(${F.Error}u,${F.TypeError}u,${F.ReferenceError}u,${F.RangeError}u,${F.SyntaxError}u,${F.URIError}u,${F.EvalError}u);
    for(var i=0u;i<7u;i++){
      let name=image[fieldKey(errorNames[i])];let prototype=4u+i;let constructor=11u+i;
      dataProperty(l,prototype,fieldKey(${F.name}u),name,5u);
      dataProperty(l,prototype,fieldKey(${F.message}u),image[fieldKey(${F['']}u)],5u);
      dataProperty(l,prototype,fieldKey(${F.constructor}u),V(600u+i,0u,11u,0u),5u);
      dataProperty(l,constructor,fieldKey(${F.name}u),name,4u);
      dataProperty(l,constructor,fieldKey(${F.length}u),num(fromUnsigned(1u)),4u);
      dataProperty(l,constructor,fieldKey(${F.prototype}u),V(prototype,0u,4u,0u),0u);
    }
    dataProperty(l,4u,fieldKey(${F.toString}u),V(650u,0u,11u,0u),5u);
    let functionKeys=array<u32,7>(${F.name}u,${F.length}u,${F.constructor}u,${F.call}u,${F.apply}u,${F.bind}u,${F.toString}u);
    for(var i=0u;i<7u;i++){
      var value=V(398u+i,0u,11u,0u);var flags=10u;
      if(i==0u){value=image[fieldKey(${F['']}u)];flags=8u;}
      if(i==1u){value=num(fromUnsigned(0u));flags=8u;}
      if(i==2u){value=V(500u,0u,11u,0u);}
      let property=alloc(l,3u,value,fieldKey(functionKeys[i]),states[l].heap[functionProto].next);
      states[l].heap[property].marked=flags;states[l].heap[functionProto].next=property;
    }
    for(var i=0u;i<image[params.padding+1u].z;i++){
      let item=image[params.padding+2u+i];let parent=item.y;
      var kind=3u;var value=V(item.z,0u,11u,0u);
      if(field(l,item.x,${F.__proto__}u)){kind=9u;value=V(0x80000078u,0x80000079u,0u,0u);}
      let property=alloc(l,kind,value,item.x,states[l].heap[parent].next);states[l].heap[parent].next=property;states[l].heap[property].marked=10u;
    }
    let ctor=alloc(l,3u,V(200u,0u,11u,0u),image[params.padding+2u].x,states[l].heap[arrayProto].next);states[l].heap[arrayProto].next=ctor;states[l].heap[ctor].marked=10u;
    let fnValue=closure(l,0u); let env=environment(l,fnValue.x,1u);
    states[l].env=env; states[l].frames[0]=Frame(0u,env,0u,0u,undef());
    { let c=cell(l,env,0u,false); states[l].heap[c].value=states[l].result; }
    states[l].result=undef(); states[l].pc=image[0].x;
  }
  for (var step=0u;step<params.budget && states[l].status==0u;step++) {
    // Collection only at instruction boundaries: temporary values stay rooted.
    if (states[l].freeCount<192u) { collect(l); if (states[l].freeCount<192u) { states[l].status=3u; break; } }
    if (states[l].pc>=params.instructions) { states[l].status=2u; break; }
    let ins=code[states[l].pc]; let op=ins.x; let arg=ins.y; states[l].pc++; states[l].steps++;
    switch op {
      ${cases('push', 'push(l,image[arg]);')}
      ${cases('closure', 'let v=closure(l,arg); push(l,v);')}
      ${cases('special_object', `if(arg<2u){push(l,argumentsObject(l,arg==1u));}else{push(l,V(states[l].heap[states[l].env].value.x,0u,5u,0u));}`)}
      ${cases('object', 'let id=alloc(l,2u,V(1u,0u,0u,1u),0u,0u); push(l,V(id,0u,4u,0u));')}
      ${cases('array_from', `if (arg>128u || states[l].sp<arg) { states[l].status=3u; break; }
        let id=alloc(l,7u,V(2u,arg,0u,1u),0u,0u); let obj=V(id,0u,4u,0u); let base=states[l].sp-arg;
        for (var i=0u;i<arg;i++) { let ignored=putProperty(l,obj,0x80000000u|i,states[l].stack[base+i],true); }
        states[l].sp=base; push(l,obj);`)}
      ${cases('drop', 'let v=pop(l);')}
      ${cases('dup', 'let v=peek(l); push(l,v);')}
      ${cases('dup1 dup2 swap nip nip1 insert2 insert3 perm3 rot3l rot3r', `
        let b=pop(l); let a=pop(l);
        if (op==${OP.dup1}u) { push(l,a);push(l,a);push(l,b); }
        else if (op==${OP.dup2}u) { push(l,a);push(l,b);push(l,a);push(l,b); }
        else if (op==${OP.swap}u) { push(l,b);push(l,a); }
        else if (op==${OP.nip}u) { push(l,b); }
        else if (op==${OP.insert2}u) { push(l,b);push(l,a);push(l,b); }
        else { let c=pop(l);
          if (op==${OP.nip1}u) { push(l,a);push(l,b); }
          else if (op==${OP.insert3}u) { push(l,b);push(l,c);push(l,a);push(l,b); }
          else if (op==${OP.perm3}u) { push(l,a);push(l,c);push(l,b); }
          else if (op==${OP.rot3l}u) { push(l,a);push(l,b);push(l,c); }
          else { push(l,b);push(l,c);push(l,a); }
        }`)}
      ${cases('get_arg get_loc get_loc_check get_var_ref get_var_ref_check', `
        let isRef=op==${OP.get_var_ref}u || op==${OP.get_var_ref_check}u;
        let slot=arg+select(0u,16u,op==${OP.get_loc}u || op==${OP.get_loc_check}u);
        let c=cell(l,states[l].env,slot,isRef); let v=states[l].heap[c].value;
        if (v.z==6u) { states[l].status=5u; } else { push(l,v); }`)}
      ${cases('put_arg set_arg put_loc set_loc put_loc_check set_loc_check put_loc_check_init put_var_ref set_var_ref put_var_ref_check put_var_ref_check_init set_loc_uninitialized', `
        let isRef=op==${OP.put_var_ref}u || op==${OP.set_var_ref}u || op==${OP.put_var_ref_check}u || op==${OP.put_var_ref_check_init}u;
        let local= !isRef && op!=${OP.put_arg}u && op!=${OP.set_arg}u;
        let c=cell(l,states[l].env,arg+select(0u,16u,local),isRef);
        if (op==${OP.set_loc_uninitialized}u) { states[l].heap[c].value=V(0u,0u,6u,0u); }
        else {
          if ((op==${OP.put_loc_check}u || op==${OP.set_loc_check}u || op==${OP.put_var_ref_check}u) && states[l].heap[c].value.z==6u) { states[l].status=5u; break; }
          var value=peek(l);
          if (op!=${OP.set_arg}u && op!=${OP.set_loc}u && op!=${OP.set_loc_check}u && op!=${OP.set_var_ref}u) { value=pop(l); }
          states[l].heap[c].value=value;
        }`)}
      ${cases('get_field get_field2 get_array_el get_array_el2 get_length', `
        var key=0u;
        if (op==${OP.get_array_el}u || op==${OP.get_array_el2}u) { let k=pop(l); key=keyOf(l,k); }
        else if (op!=${OP.get_length}u) { key=keyOf(l,image[arg]); }
        let obj=pop(l); var value=undef();
        if (op==${OP.get_length}u) {
          if (obj.z==7u) { value=num(fromUnsigned(obj.y)); }
          else if (obj.z==5u) { value=num(fromUnsigned(image[states[l].heap[obj.x].value.x*2u].y)); }
          else if (obj.z==4u && states[l].heap[obj.x].kind==7u) { value=num(fromUnsigned(states[l].heap[obj.x].value.y)); }
          else { states[l].status=6u; }
        } else { value=getProperty(l,obj,key); }
        if (op==${OP.get_field2}u || op==${OP.get_array_el2}u) { push(l,obj); }
        if(value.z==12u) {push(l,obj);push(l,callbackValue(value.x));call(l,0u,true,false);}
        else {push(l,value);}`)}
      ${cases('put_field define_field put_array_el', `
        let value=pop(l); var key=0u;
        if (op==${OP.put_array_el}u) { let k=pop(l); key=keyOf(l,k); } else { key=keyOf(l,image[arg]); }
        if(op==${OP.define_field}u&&ins.z!=0u){functionName(l,value,image[ins.z],true);}
        let obj=pop(l); let pending=putProperty(l,obj,key,value,op==${OP.define_field}u);
        if(pending.z==12u) {push(l,obj);push(l,callbackValue(pending.x));push(l,value);let depth=states[l].depth;call(l,1u,true,false);if(states[l].status==0u){if(states[l].depth>depth){states[l].frames[states[l].depth].tail=2u;}else{let ignored=pop(l);}}}
        if (op==${OP.define_field}u) { push(l,obj); }`)}
      ${cases('define_getter define_setter', `let fnValue=pop(l);functionName(l,fnValue,image[ins.z],true);
        defineAccessor(l,peek(l),keyOf(l,image[arg]),fnValue,op==${OP.define_setter}u);`)}
      ${cases('define_method_computed', `let fnValue=pop(l);let key=keyOf(l,pop(l));let obj=peek(l);var name=keyName(l,key);
        if(arg!=0u){let prefix=image[ins.z];name=makeText(l,prefix,name,0u,prefix.y+name.y);}
        functionName(l,fnValue,name,true);
        if(arg==0u){let ignored=putProperty(l,obj,key,fnValue,true);}else{defineAccessor(l,obj,key,fnValue,arg==2u);}`)}
      ${cases('define_array_el', 'let value=pop(l);let key=keyOf(l,peek(l));let obj=states[l].stack[states[l].sp-2u];let ignored=putProperty(l,obj,key,value,true);')}
      ${cases('to_propkey', 'let value=pop(l);push(l,keyName(l,keyOf(l,value)));')}
      ${cases('set_name', 'functionName(l,peek(l),image[arg],false);')}
      ${cases('set_name_computed', 'let name=keyName(l,keyOf(l,states[l].stack[states[l].sp-2u]));functionName(l,peek(l),name,false);')}
      ${cases('call_constructor', 'construct(l,arg);')}
      ${cases('call tail_call call_method tail_call_method', `call(l,arg,op==${OP.call_method}u || op==${OP.tail_call_method}u,op==${OP.tail_call}u || op==${OP.tail_call_method}u);`)}
      ${cases('return', 'let value=pop(l); if(states[l].status==0u) { finish(l,value); }')}
      ${cases('return_undef', 'finish(l,undef());')}
      ${cases('push_this', 'let value=states[l].frames[states[l].depth].receiver; if (value.z!=4u&&value.z!=5u&&value.z!=11u&&image[ins.w*2u+1u].y==0u) { states[l].status=6u; } else { push(l,value); }')}
      ${cases('add sub mul div mod lt lte gt gte strict_eq strict_neq eq neq and or xor shl sar shr', 'let b=pop(l); let a=pop(l); let value=binary(l,op,a,b); push(l,value);')}
      ${cases('neg plus inc dec post_inc post_dec not lnot is_undefined is_null is_undefined_or_null', `
        let value=pop(l);
        if (op==${OP.lnot}u) { push(l,boolean(!truth(value))); }
        else if (op==${OP.is_undefined}u) { push(l,boolean(value.z==3u)); }
        else if (op==${OP.is_null}u) { push(l,boolean(value.z==2u)); }
        else if (op==${OP.is_undefined_or_null}u) { push(l,boolean(value.z==2u || value.z==3u)); }
        else if (value.z>=4u) { states[l].status=6u; }
        else if (op==${OP.neg}u) { push(l,num(Pair(value.x,value.y^0x80000000u))); }
        else if (op==${OP.plus}u) { push(l,num(value.xy)); }
        else if (op==${OP.not}u) { push(l,num(fromSigned(~toBits(value.xy)))); }
        else { if(op==${OP.post_inc}u || op==${OP.post_dec}u) { push(l,num(value.xy)); }
          push(l,num(plus(value.xy,Pair(0u,select(0x3ff00000u,0xbff00000u,op==${OP.dec}u || op==${OP.post_dec}u))))); }
      `)}
      ${cases('inc_loc dec_loc add_loc', `
        let c=cell(l,states[l].env,16u+arg,false); let a=states[l].heap[c].value; var b=num(Pair(0u,0x3ff00000u));
        if(op==${OP.add_loc}u) { b=pop(l); }
        let value=binary(l,select(${OP.add}u,${OP.sub}u,op==${OP.dec_loc}u),a,b); states[l].heap[c].value=value;`)}
      ${cases('goto', 'states[l].pc=arg;')}
      ${cases('if_true if_false', `let value=pop(l); if (truth(value)==(op==${OP.if_true}u)) { states[l].pc=arg; }`)}
      ${cases('set_proto', `let proto=objectView(l,pop(l));let obj=peek(l);if(proto.z==11u){states[l].status=6u;break;}
        if(obj.z!=4u) {states[l].status=4u;} else if(proto.z==4u) {states[l].heap[obj.x].value.x=proto.x;states[l].heap[obj.x].value.z=0u;}
        else if(proto.z==2u) {states[l].heap[obj.x].value.x=0u;states[l].heap[obj.x].value.z=0u;}`)}
      ${cases('typeof_is_function typeof_is_undefined', `let v=pop(l);push(l,boolean(select(v.z==3u,v.z==5u||v.z==11u,op==${OP.typeof_is_function}u)));`)}
      ${cases('typeof', `let v=pop(l);var index=2u;
        if(v.z==0u){index=0u;}else if(v.z==1u){index=1u;}else if(v.z==3u){index=3u;}else if(v.z==5u||v.z==11u){index=4u;}else if(v.z==7u){index=5u;}
        let offset=image[params.padding+index/4u][index%4u];push(l,image[offset]);`)}
      ${cases('instanceof', 'let constructor=pop(l);let value=pop(l);push(l,instanceOf(l,value,constructor));')}
      ${cases('in', `let original=pop(l);let keyValue=pop(l);let key=keyOf(l,keyValue);if(!functionKey(l,original,key)){break;}let obj=objectView(l,original);
        if(obj.z!=4u){states[l].status=select(4u,6u,obj.z==11u);break;}var current=obj.x;var exists=false;var intrinsic=0u;
        while(current!=0u){if(findProperty(l,current,key)!=0u || (lengthKey(l,key)&&states[l].heap[current].kind==7u)){exists=true;break;}
          intrinsic=states[l].heap[current].value.z;current=states[l].heap[current].value.x;}
        push(l,boolean(exists));`)}
      ${cases('delete', `let keyValue=pop(l);let original=pop(l);let key=keyOf(l,keyValue);if(!functionKey(l,original,key)){break;}let obj=objectView(l,original);
        if(obj.z!=4u){states[l].status=6u;break;}var removed=true;
        if(lengthKey(l,key)&&states[l].heap[obj.x].kind==7u){removed=false;}
        else {let property=findProperty(l,obj.x,key);
          if(property!=0u){
            if((states[l].heap[property].marked&8u)==0u){removed=false;}
            else {var previous=obj.x;
              for(var i=0u;i<${L.heap}u && states[l].heap[previous].next!=property;i++){previous=states[l].heap[previous].next;}
              states[l].heap[previous].next=states[l].heap[property].next;states[l].heap[property].next=0u;
            }
          }
        }
        if(!removed&&image[ins.w*2u+1u].y!=0u){states[l].status=4u;}else{push(l,boolean(removed));}`)}
      ${cases('close_loc', `let env=states[l].env;let old=cell(l,env,16u+arg,false);
        let node=states[l].heap[old]; let fresh=alloc(l,1u,node.value,node.key,node.next);
        var previous=env;
        for(var i=0u;i<${L.heap}u;i++) { if(states[l].heap[previous].next==old) {break;} previous=states[l].heap[previous].next; }
        states[l].heap[previous].next=fresh;states[l].heap[old].next=0u;`)}
      ${cases('catch', 'push(l,V(arg,0u,9u,0u));')}
      ${cases('gosub', 'push(l,V(states[l].pc,0u,10u,0u)); states[l].pc=arg;')}
      ${cases('ret', 'let dest=pop(l); if(dest.z!=10u) {states[l].status=2u;} else {states[l].pc=dest.x;}')}
      ${cases('nip_catch', `let value=pop(l);var found=false;
        while(states[l].sp>states[l].frames[states[l].depth].base) {let v=pop(l);if(v.z==9u){found=true;break;}}
        if(!found){states[l].status=2u;}push(l,value);`)}
      ${cases('throw', 'let value=pop(l); raise(l,value);')}
      ${cases('throw_error', 'states[l].status=select(4u,5u,arg==2u || arg==3u || arg==5u);')}
      ${cases('nop', '')}
      default: { states[l].status=2u; }
    }
    if (states[l].status==4u || states[l].status==5u || states[l].status==8u) {
      let status=states[l].status;
      states[l].status=0u;var kind=1u;var message=${F['Invalid operation']}u;
      if(status==5u){kind=2u;message=${F['Invalid reference']}u;}else if(status==8u){kind=3u;message=${F['Invalid array length']}u;}
      let error=makeError(l,kind,image[fieldKey(message)],undef());
      if(states[l].status==0u){raise(l,error);}
      // Preserve useful host diagnostics for an uncaught implicit error.
      if(states[l].status==7u) {states[l].status=status;}
    }
  }
  output[l].status=states[l].status;output[l].steps=states[l].steps;output[l].collections=states[l].collections;output[l].pad=states[l].pc;output[l].value=states[l].result;
  if(states[l].status==1u && states[l].result.z==7u) {
    for(var i=0u;i<states[l].result.y;i++){output[l].chars[i]=unit(l,states[l].result,i);}
  }
}
`;
