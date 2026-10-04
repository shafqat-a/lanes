// Reviewable proposal only: returns new source strings; never modifies live files.
export function propertyHarnessIntegrationPatch(original){
 const files={...original};
 for(const file of ['test262-inventory.js','test262-adapted.mjs','export-test262-browser.mjs','inventory-test262-full.mjs']){
  const before="from './test262-harness.js'",after="from './test262-property-harness.js'";
  if(typeof files[file]!=='string'||files[file].split(before).length!==2)throw new Error(`Property harness integration anchor drift: ${file}`);
  files[file]=files[file].replace(before,after);
 }
 const file='test262-inventory.js',line=files[file].match(/^export const inventoryMethod = .*;$/m);
 if(!line)throw new Error('Property harness inventory method anchor drift');
 files[file]=files[file].replace(line[0],"export const inventoryMethod = 'Original test bodies remain function-adapted. propertyHelper.js tests supply byte-preserved upstream sta/assert/propertyHelper harness scripts at pinned Test262 revision 7ab7fafa0003f73fc85c1b95d88094d33f7eb8bd; their harness functions remain sloppy while only the test body receives strict mode. Other includes retain the legacy adapted predicates. Script/global, async, module, negative-test and realm limitations remain explicitly classified; this is not full Test262 execution.';");
 return files;
}
