// Ordered, short-circuit field comparisons with a single comparison body.
// Keeping the list as data avoids duplicating string-key walks at each name.
export function fieldListWGSL(indices) {
  if (!indices.every(n => Number.isInteger(n) && n >= 0 && n <= 0xffffffff))
    throw new Error('Invalid field index');
  if (!indices.length) return 'return false;';
  return `let gapFields=array<u32,${indices.length}>(${indices.map(n=>`${n}u`).join(',')});
    for(var i=0u;i<${indices.length}u;i++){
      if(field(l,key,gapFields[i])){return true;}
    }
    return false;`;
}
