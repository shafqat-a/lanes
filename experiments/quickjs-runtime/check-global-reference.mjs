import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {globalReferenceCases,globalReferenceSpec} from './global-reference-cases.js';
import {createCompiler} from './compiler.js';
import {bootstrapSources,attachBootstrap} from './bootstrap.js';
import {entrySource,packProgram} from './program.js';
const root=fileURLToPath(new URL('.',import.meta.url)),tmp=mkdtempSync(join(tmpdir(),'lanes-global-reference-'));
try{
 const source=join(tmp,'runner.c'),binary=join(tmp,'runner');
 writeFileSync(source,`#include ${JSON.stringify(join(root,'vendor/quickjs.c'))}\nint main(int argc,char **argv){JSRuntime *rt=JS_NewRuntime();JSContext *ctx=JS_NewContext(rt);JSValue v=JS_Eval(ctx,argv[1],strlen(argv[1]),"fixture",JS_EVAL_TYPE_GLOBAL);if(JS_IsException(v)){JSValue e=JS_GetException(ctx);const char *s=JS_ToCString(ctx,e);fprintf(stderr,"%s\\n",s?s:"exception");return 1;}const char *s=JS_ToCString(ctx,v);puts(s?s:"null");JS_FreeCString(ctx,s);JS_FreeValue(ctx,v);JS_FreeContext(ctx);JS_FreeRuntime(rt);return 0;}\n`);
 execFileSync(process.env.CC||'cc',['-O1','-D_GNU_SOURCE','-DCONFIG_VERSION="lanes-pinned"',source,...['dtoa','libregexp','libunicode','cutils'].map(n=>join(root,'vendor',n+'.c')),'-lm','-lpthread','-o',binary],{stdio:'pipe'});
 const raw=s=>JSON.parse(execFileSync(join(root,'generated/compiler'),[s],{encoding:'utf8',maxBuffer:1<<26}));
 const bootstrap=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,raw(s)])),compiler=await createCompiler();
 const differences=[];let checked=0;
 for(const c of globalReferenceCases){
  for(const [input,expected] of [[c.input,c.expected],[c.input+1,c.expectedNext]]){
   const script=c.source+`;f(${input})`;
   assert.equal(execFileSync(binary,[script],{encoding:'utf8'}).trim(),String(expected),`${c.feature} patched native interpreter/${input}`);
   const observed=vm.runInNewContext(script);if(!Object.is(observed,expected))differences.push({feature:c.feature,input,native:observed,normative:expected});checked++;
  }
  const a=packProgram(attachBootstrap(raw(c.source),bootstrap),entrySource(c.source)),b=compiler.compile(c.source);
  assert.deepEqual(a.code,b.code,`${c.feature} bytecode`);assert.deepEqual(a.image,b.image,`${c.feature} image`);
 }
 console.log(JSON.stringify({programs:globalReferenceCases.length,normativeNativeChecks:checked,nativeWasmAgreement:true,nativeReferenceDifferences:differences,spec:globalReferenceSpec,guestGPUExecution:false}));
}finally{rmSync(tmp,{recursive:true,force:true});}
