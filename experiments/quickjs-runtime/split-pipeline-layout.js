// Both entry points share a layout even when one does not use every binding.
export function createSplitPipelineLayout(device) {
  const types=['read-only-storage','read-only-storage','storage','uniform','storage','read-only-storage','storage'];
  const group=device.createBindGroupLayout({entries:types.map((type,binding)=>({binding,visibility:4,buffer:{type}}))});
  return {group,pipeline:device.createPipelineLayout({bindGroupLayouts:[group]})};
}
