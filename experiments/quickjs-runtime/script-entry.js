// True Script bytecode: no wrapping function, host evaluation, or property-based
// substitute for the global declarative environment. One fresh realm per run.
export const SCRIPT_MODE_BIT=0x100000;
export const SCRIPT_LEXICAL_SPEC=8;
export const SCRIPT_GLOBAL_DECL_SPEC=9;
export function scriptRef(ref){return ref && [3,4,5].includes(ref.type);}
export function scriptEntryLowering(plan,f,op,instruction,{text,add}){
 if(!plan.script || f>=plan.userCount)return null;
 const fn=plan.functions[f];
 if(op==='make_var_ref'){
  const index=fn.refs.findIndex(r=>scriptRef(r)&&r.name===instruction.operand&&r.lexical);
  if(index>=0)return {op:'make_capture_ref',a:index,b:fn.refs[index].constant};
 }
 if(op==='delete_var'){
  if(fn.refs.some(r=>scriptRef(r)&&r.name===instruction.operand&&r.lexical))return {op:'push',a:add([0,0,1,0]),b:0};
 }
 let index=instruction.operand,base=op;
 const short=/^(get_var_ref|put_var_ref|set_var_ref)([0-3])$/.exec(op);
 if(short){base=short[1];index=Number(short[2]);}
 if(!['get_var','get_var_undef','put_var','put_var_init','get_var_ref','put_var_ref','set_var_ref'].includes(base))return null;
 const ref=fn.refs[index];if(!scriptRef(ref))return null;
 if(ref.lexical){
  if(base==='put_var_init')return {op:'put_var_ref_check_init',a:index,b:0};
  if(base==='get_var'||base==='get_var_undef'||base==='get_var_ref')return {op:'get_var_ref_check',a:index,b:0};
  // Ordinary lexical assignments emitted by QuickJS use make_var_ref, retaining
  // TDZ and const checks through the existing first-class Reference machinery.
  throw new SyntaxError(`Unsupported direct Script lexical write: ${base}`);
 }
 if(base==='put_var_init'||base==='set_var_ref')throw new SyntaxError(`Unsupported Script global operation: ${base}`);
 return {op:base==='put_var'||base==='put_var_ref'?'put_global':'get_global',a:text(ref.name),b:base==='get_var_undef'?1:0};
}
export const scriptEntryWGSL=`
fn scriptMode()->bool{return (image[0u].w&${SCRIPT_MODE_BIT}u)!=0u;}
// Fresh GlobalDeclarationInstantiation. Binding keys are compiler atoms; no
// guest property lookup/getter runs during creation. Lexicals live in cells.
fn scriptDeclareGlobal(l:u32,key:u32,isFunction:bool){
 let property=findProperty(l,GLOBAL_OBJECT,key);
 if(property==0u){dataProperty(l,GLOBAL_OBJECT,key,undef(),3u);}
 else if(isFunction){
  let flags=states[l].heap[property].marked;
  if((flags&8u)==0u && ((flags&6u)!=6u||states[l].heap[property].kind!=3u)){states[l].status=4u;}
  else{states[l].heap[property].kind=3u;states[l].heap[property].value=undef();states[l].heap[property].marked=6u;}
 }
}
// Function declarations precede var bindings; duplicate function names use
// their last declaration's source order (ES2025 GlobalDeclarationInstantiation).
fn scriptDeclareBindings(l:u32,refs:u32,count:u32){
 for(var i=0u;i<count;i++){
  let spec=image[refs+i];
  if(spec.x==${SCRIPT_GLOBAL_DECL_SPEC}u&&spec.z!=0u){
   var shadowed=false;
   for(var j=i+1u;j<count;j++){
    let later=image[refs+j];
    if(later.x==${SCRIPT_GLOBAL_DECL_SPEC}u&&later.z!=0u&&later.y==spec.y){shadowed=true;}
   }
   if(!shadowed){scriptDeclareGlobal(l,spec.y,true);}
  }
 }
 for(var i=0u;i<count;i++){
  let spec=image[refs+i];
  if(spec.x==${SCRIPT_GLOBAL_DECL_SPEC}u&&spec.z==0u){scriptDeclareGlobal(l,spec.y,false);}
 }
}
`;
export const scriptDeclarationWGSL=`if(f==0u&&scriptMode()){scriptDeclareBindings(l,refs,fnInfo.w&0xffffu);}`;
// Insert in closure() before the existing spec.x==7 skip. No lexical const bit
// is set on cells: initialisation must succeed; Reference writes carry const.
export const scriptClosureWGSL=`
    if(spec.x==${SCRIPT_GLOBAL_DECL_SPEC}u){continue;}
    if(spec.x==${SCRIPT_LEXICAL_SPEC}u){
      captured=alloc(l,1u,V(0u,0u,6u,0u),0u,0u);
      let scriptCapture=alloc(l,6u,V(captured,0u,0u,0u),i,states[l].heap[id].next);states[l].heap[id].next=scriptCapture;continue;
    }
`;
export const scriptShaderIntegration=Object.freeze({
 functions:'Interpolate scriptEntryWGSL alongside globalWGSLFunctions.',
 declarations:'Interpolate scriptDeclarationWGSL before the closure capture loop.',
 closure:'Interpolate scriptClosureWGSL before spec.x==7 skip in closure().',
 entryBinding:'if(globalMode()&&!scriptMode()){globalEntryBinding(l,fnValue);}',
 initialFrame:'Frame(0u,env,0u,0u,select(undef(),V(GLOBAL_OBJECT,0u,4u,0u),scriptMode()))',
});
