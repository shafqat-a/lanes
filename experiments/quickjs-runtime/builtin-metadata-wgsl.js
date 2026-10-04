// Keep ordered first-match behavior: some registries deliberately alias native IDs.
export function builtinMetadataRows(methods, fields) {
  const seen = new Set();
  return methods.flatMap(({id, name, length}) => {
    if (!Number.isSafeInteger(id) || id < 0 || id > 0xffffffff ||
        !Number.isSafeInteger(length) || length < 0 || length > 0xffffffff ||
        !Number.isSafeInteger(fields[name]) || fields[name] < 0 || fields[name] >= 0xffffffff)
      throw new Error(`Invalid builtin metadata: ${id}/${name}/${length}`);
    if (seen.has(id)) return [];
    seen.add(id);
    return [{id, nameField: fields[name], length}];
  });
}

export function builtinMetadataWGSL(methods, fields) {
  const rows = builtinMetadataRows(methods, fields);
  return `if(obj.z==11u){
    var metadataName=0xffffffffu;var metadataLength=0u;
    switch obj.x {
      ${rows.map(({id,nameField,length}) => `case ${id}u:{metadataName=${nameField}u;metadataLength=${length}u;}`).join('\n      ')}
      default:{}
    }
    if(metadataName!=0xffffffffu){
      if(field(l,key,${fields.name}u)){return image[fieldKey(metadataName)];}
      if(lengthKey(l,key)){return num(fromUnsigned(metadataLength));}
      states[l].status=6u;return undef();
    }
  }`;
}
