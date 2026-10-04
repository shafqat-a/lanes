// Address planning only, deliberately not a linker. A future packer must emit
// already-relocated code/image records against these immutable reservations.
// Existing live pointers are never rewritten/repacked by this API.
const natural=(x,n)=>{if(!Number.isSafeInteger(x)||x<0||x>0xffffffff)throw new TypeError(`Invalid ${n}`);return x;};
export function planDynamicAppend(arena, sizes) {
  for(const name of ['functionCount','functionCapacity','codeRows','codeCapacity','imageRows','imageCapacity'])natural(arena[name],name);
  for(const name of ['functions','codeRows','imageRows'])natural(sizes[name],name);
  if(!sizes.functions||!sizes.codeRows||!sizes.imageRows)throw new TypeError('Empty dynamic segment');
  if(arena.functionCount>arena.functionCapacity||arena.codeRows>arena.codeCapacity||arena.imageRows>arena.imageCapacity||arena.imageRows<arena.functionCapacity*2)
    throw new TypeError('Dynamic arena lacks reserved function-table prefix');
  const next={functionCount:arena.functionCount+sizes.functions,codeRows:arena.codeRows+sizes.codeRows,imageRows:arena.imageRows+sizes.imageRows};
  if(next.functionCount>arena.functionCapacity||next.codeRows>arena.codeCapacity||next.imageRows>arena.imageCapacity)
    throw new RangeError('Dynamic append arena capacity exceeded');
  return Object.freeze({functionBase:arena.functionCount,functionCount:sizes.functions,functionTableStart:arena.functionCount*2,
    codeStart:arena.codeRows,codeRows:sizes.codeRows,imageStart:arena.imageRows,imageRows:sizes.imageRows,
    next:Object.freeze({...arena,...next})});
}

export function validateDynamicAppendPayload(plan, payload) {
  const own=(value,rows,name)=>{if(!(value instanceof Uint32Array)||value.length!==rows*4)throw new TypeError(`Invalid dynamic ${name} size`);return value.slice();};
  const code=own(payload.code,plan.codeRows,'code'),image=own(payload.image,plan.imageRows,'image'),functions=own(payload.functions,plan.functionCount*2,'function table');
  // Headers use the existing two-V-per-function ABI. New code/ref metadata
  // must lie in their own append span; no old function header may be replaced.
  for(let f=0;f<plan.functionCount;f++){
    const pc=functions[f*8],refs=functions[f*8+4];
    if(pc<plan.codeStart||pc>=plan.codeStart+plan.codeRows||refs<=plan.imageStart||refs>=plan.imageStart+plan.imageRows)
      throw new TypeError('Dynamic function metadata escapes append reservation');
  }
  return Object.freeze({code,image,functions,plan});
}
