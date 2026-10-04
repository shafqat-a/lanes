// The three declaration-order fixtures follow GlobalDeclarationInstantiation
// with Lanes ordinary global object. Node26 worker globals enumerate their
// properties differently; nativeNodeExpected records that exact host-global
// observation, not an alternate GPU expectation or an engine-bug claim.
// Each input lane starts a fresh realm; scripts have no synthetic input binding.
const c=(name,source,expected,extra={})=>Object.freeze({name,source,expected,inputs:[0,1],budgets:[1,4096],...extra});
export const scriptEntryCases=Object.freeze([
 c('empty','',undefined),
 c('completion-expression','1+2',3),
 c('completion-declaration-preserves-value','7;var x=9;',7),
 c('completion-loop','var s=0;for(var i=0;i<4;i++)s+=i;',6),
 c('completion-try-finally','try{3;}finally{4;}',3),
 c('strict-top-level-this','"use strict";this===globalThis',true),
 c('sloppy-top-level-this','this===globalThis',true),
 c('no-synthetic-entry','Object.hasOwn(globalThis,"<eval>")',false),
 c('no-input-arguments','typeof arguments', 'undefined'),
 c('var-hoist','var before=typeof x;var x=3;before+":"+x','undefined:3'),
 c('function-hoist','var x=f();function f(){return 11};x',11),
 c('function-last-declaration','function f(){return 1}function f(){return 2}f()',2),
 c('declaration-order-functions-first','var a;function b(){};Object.keys(globalThis).filter(k=>k==="a"||k==="b").join()','b,a',{nativeNodeExpected:'a,b',spec:'https://tc39.es/ecma262/2025/multipage/ecmascript-language-scripts-and-modules.html#sec-globaldeclarationinstantiation'}),
 c('declaration-order-duplicate-functions','function a(){}function b(){}function a(){};Object.keys(globalThis).filter(k=>k==="a"||k==="b").join()','b,a',{nativeNodeExpected:'a,b',spec:'https://tc39.es/ecma262/2025/multipage/ecmascript-language-scripts-and-modules.html#sec-globaldeclarationinstantiation'}),
 c('declaration-order-interleaved','var a;function b(){}var c;function d(){};Object.keys(globalThis).filter(k=>k==="a"||k==="b"||k==="c"||k==="d").join()','b,d,a,c',{nativeNodeExpected:'a,b,c,d',spec:'https://tc39.es/ecma262/2025/multipage/ecmascript-language-scripts-and-modules.html#sec-globaldeclarationinstantiation'}),
 c('global-var-descriptor','var x=3;var d=Object.getOwnPropertyDescriptor(globalThis,"x");d.value+":"+d.writable+":"+d.enumerable+":"+d.configurable+":"+(delete x)','3:true:true:false:false'),
 c('global-function-descriptor','function f(){return 1};var d=Object.getOwnPropertyDescriptor(globalThis,"f");(d.value===f)+":"+d.writable+":"+d.enumerable+":"+d.configurable','true:true:true:false'),
 c('lexical-not-object-property','let x=3;const y=4;class Z{};x+y+":"+Object.hasOwn(globalThis,"x")+":"+Object.hasOwn(globalThis,"y")+":"+Object.hasOwn(globalThis,"Z")','7:false:false:false'),
 c('lexical-shadow-intrinsic','let Array=3;function f(){return Array};f()+":"+(typeof globalThis.Array)','3:function'),
 c('lexical-delete','let x=3;delete x',false),
 c('lexical-tdz-typeof','var caught=false;try{typeof x}catch(e){caught=e instanceof ReferenceError}let x=3;caught',true),
 c('lexical-assignment-before-init','var caught=false;try{x=3}catch(e){caught=e instanceof ReferenceError}let x;caught',true),
 c('const-write','const x=3;var caught=false;try{x=4}catch(e){caught=e instanceof TypeError}caught+":"+x','true:3'),
 c('const-compound-write','const x=3;var caught=false;try{x+=4}catch(e){caught=e instanceof TypeError}caught+":"+x','true:3'),
 c('captured-const-write','const x=3;function f(){try{x=4}catch(e){return e instanceof TypeError}}f()',true),
 c('nested-global-lexical','let x=3;function f(){return function(){x++;return x}}var g=f();g()+":"+g()+":"+x','4:5:5'),
 c('global-mutable-var','var x=3;function f(){globalThis.x=8;return x}f()',8),
 c('implicit-global-configurable','x=3;Object.getOwnPropertyDescriptor(globalThis,"x").configurable',true),
 c('strict-unresolved','"use strict";var caught=false;try{x=3}catch(e){caught=e instanceof ReferenceError}caught',true),
 c('var-existing-readonly','var undefined=3;undefined',undefined),
 c('function-replaces-intrinsic','function Array(){return 7}var d=Object.getOwnPropertyDescriptor(globalThis,"Array");Array()+":"+d.enumerable+":"+d.configurable','7:true:false'),
 c('script-class','class A{v(){return 3}}class B extends A{v(){return super.v()+1}}new B().v()',4),
 c('block-lexical-separate','let x=3;{let x=9;}x',3),
 c('var-and-lexical-same-spelling-property','let x=3;globalThis.x=9;x+":"+globalThis.x','3:9'),
 c('fresh-realm','globalThis.counter=(globalThis.counter||0)+1',1),
 c('retained-global-lexical-gc','let retained={v:7};function f(){return function(){return retained.v}}var read=f();for(var i=0;i<600;i++){var waste={a:[i],b:{v:i}};}read()',7,{requiresGC:true,budgets:[31,4096]}),
]);
export const scriptEntryRejectedCases=Object.freeze([
 {name:'module-export',source:'export const x=1'},
 {name:'module-import',source:'import x from "m"'},
 {name:'top-level-return',source:'return 1'},
 {name:'top-level-await',source:'await 1'},
 {name:'restricted-global-lexical',source:'let undefined=3'},
 {name:'duplicate-lexical',source:'let x;let x'},
 {name:'private-helper-free-reference',source:'__lanesCall()'},
 {name:'unimplemented-eval',source:'eval("1")'},
]);
