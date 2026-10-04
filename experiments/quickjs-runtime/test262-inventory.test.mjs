import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { collectTest262Inventory, test262Scopes } from './test262-inventory.js';
import { test262Variants } from './test262-harness.js';
const fixture = (body, metadata = '') => `/*---\ndescription: Inventory regression\n${metadata}\n---*/\n${body}`;

test('variant accounting preserves excluded strict/sloppy and execution contexts', () => {
  assert.deepEqual(test262Variants(fixture('', 'includes: [propertyHelper.js]')), [{variant:'sloppy',strict:false},{variant:'strict',strict:true}]);
  assert.deepEqual(test262Variants(fixture('', 'flags: [onlyStrict]')), [{variant:'strict',strict:true}]);
  assert.deepEqual(test262Variants(fixture('', 'flags: [module]')), [{variant:'module',strict:true}]);
  assert.deepEqual(test262Variants(fixture('', 'flags: [raw]')), [{variant:'raw',strict:null}]);
  assert.deepEqual(test262Variants(''), [{variant:'unclassified',strict:null}]);
});

test('inventory accounts for every variant without silently dropping harness or compiler failures', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lanes-test262-inventory-'));
  try {
    for (const dir of test262Scopes.descriptors) await mkdir(join(root,dir),{recursive:true});
    const directory = join(root,test262Scopes.descriptors[0]);
    const bodies = {
      'pass.js': fixture('assert(true);'),
      'exclude.js': fixture('assert(true);','includes: [unimplementedFixture.js]'),
      'reference.js': fixture('assert(false);','flags: [onlyStrict]'),
      'compile.js': fixture('var COMPILE_UNSUPPORTED = 1;','flags: [noStrict]'),
      'missing.js': 'assert(true);',
      'mutate.js': fixture('Object.prototype.polluted = true;'),
      'z-clean.js': fixture('assert.sameValue(({}).polluted, undefined);'),
    };
    for (const [name,body] of Object.entries(bodies)) await writeFile(join(directory,name),body);
    const report = await collectTest262Inventory(root,'descriptors',{ compiler: {compile(source) {if(source.includes('COMPILE_UNSUPPORTED')) throw new Error('Unsupported QuickJS instruction: fixture');}} });
    assert.equal(report.counts.files,7);
    assert.equal(report.counts.variants,11);
    assert.equal(report.records.length,11);
    assert.equal(report.counts.excludedHarness,2);
    assert.equal(report.counts.excludedHarnessVariants,3);
    assert.equal(report.counts.referenceRejected,1);
    assert.equal(report.counts.unsupported,1);
    assert.equal(report.counts.compiled,6);
    assert.equal(report.counts.eligible,7);
    assert.equal(new Set(report.records.map(r=>r.file+':'+r.variant)).size,11);
    for(const r of report.records.filter(r=>r.status!=='compiled')) assert.ok(r.reason);
    await assert.rejects(()=>collectTest262Inventory(root,'arrays'), /ENOENT/); // Missing directories fail, never silently skip.
    await assert.rejects(()=>collectTest262Inventory(root,'unknown'), /Unknown scope/);
  } finally { await rm(root,{recursive:true,force:true}); }
});

test('browser exporter keeps compile-unsupported cases, records exclusions and rejects stale test contents', async () => {
  const { execFileSync } = await import('node:child_process');
  const { readFile } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  const root = await mkdtemp(join(tmpdir(), 'lanes-test262-export-'));
  try {
    for (const dir of test262Scopes.descriptors) await mkdir(join(root,dir),{recursive:true});
    const selected = join(root,test262Scopes.descriptors[0],'selected.js');
    await writeFile(selected,fixture('assert(true);'));
    await writeFile(join(root,test262Scopes.descriptors[0],'excluded.js'),fixture('assert(true);','includes: [unimplementedFixture.js]'));
    await writeFile(join(root,'LICENSE'),'Fixture license');
    const git = args => execFileSync('git',['-C',root,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
    git(['init']); git(['add','.']);
    git(['-c','user.name=Test','-c','user.email=test@example.invalid','-c','core.hooksPath=/dev/null','commit','-m','fixture']);
    const report = await collectTest262Inventory(root,'descriptors',{compiler:{compile(){throw new Error('Unsupported QuickJS instruction: fixture');}}});
    report.commit = git(['rev-parse','HEAD']).trim();
    const reportPath = join(root,'report.json'), output = join(root,'out','test262-fixture-suite.json');
    await writeFile(reportPath,JSON.stringify(report));
    const exporter = fileURLToPath(new URL('./export-test262-browser.mjs',import.meta.url));
    const run = () => execFileSync(process.execPath,[exporter,reportPath,root,output],{stdio:['ignore','pipe','pipe']});
    run();
    const suite = JSON.parse(await readFile(output,'utf8'));
    assert.equal(suite.cases.length,2);
    assert.equal(suite.previousCompileUnsupportedVariants,2);
    assert.equal(suite.omittedCompileUnsupportedVariants,0);
    assert.equal(suite.exclusionRecords.length,2);
    assert.equal(suite.selectedVariants,4);
    assert.equal(await readFile(join(root,'out','test262-LICENSE.txt'),'utf8'),'Fixture license');
    await writeFile(selected,fixture('assert(false);'));
    assert.throws(run,error=>error.stderr.toString().includes('Test source changed since inventory'));
  } finally { await rm(root,{recursive:true,force:true}); }
});

test('foundational boxing scope inventories explicit constructor files and keeps every excluded variant', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lanes-test262-boxing-selection-'));
  try {
    const selections = test262Scopes['primitive-boxing'];
    const files = selections.filter(path => path.endsWith('.js'));
    for (const path of selections) {
      if (path.endsWith('.js')) {
        await mkdir(join(root,path.slice(0,path.lastIndexOf('/'))),{recursive:true});
        await writeFile(join(root,path),fixture('assert(true);','includes: [unimplementedFixture.js]'));
      } else await mkdir(join(root,path),{recursive:true});
    }
    const report = await collectTest262Inventory(root,'primitive-boxing');
    assert.equal(report.counts.files,files.length);
    assert.equal(report.counts.variants,2*files.length);
    assert.equal(report.counts.excludedHarnessVariants,2*files.length);
    assert.equal(report.counts.eligible,0);
    assert.deepEqual(report.selectionPaths,selections);
    assert.ok(report.records.every(r=>r.reason==='unsupported-include:unimplementedFixture.js'));
    await rm(join(root,files[0]));
    await assert.rejects(()=>collectTest262Inventory(root,'primitive-boxing'), /ENOENT/);
    assert.deepEqual(test262Scopes.expanded,[...test262Scopes.descriptors,...test262Scopes.arrays,...test262Scopes.conversions]);
  } finally { await rm(root,{recursive:true,force:true}); }
});
