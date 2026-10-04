// Phase 4 worker 7: this / arguments / call / declaration edge cases within the
// single-entry-function model. `expected` values are fixed ES2025 results
// (V8 `node:vm` is only the oracle that confirms them). Host checks:
// check-phase4-edge.mjs. Nothing here runs on, or claims anything about, the GPU.
//
// classification:
//   'pass'                 admitted; native QuickJS (vendor) agrees; every guest op has
//                          a WGSL case and the static runtime review found no gap.
//                          GPU confirmation is still pending.
//   'compiler-bug'         admitted, but the current vendor compiler emits wrong
//                          bytecode; fixed by `regression` (phase4-patches/<regression>.diff).
//   'explicit-unsupported' compiler rejection or runtime status 6, by design.
// `admission` is the current program.js packProgram result (with bootstrap attached).
const IF_SCOPE = 'w7-annexb-if-clause-scope';
const ARGS_FN = 'w7-annexb-arguments-block-function';

const edgeCaseList = [
  // --- Arrow functions: lexical this / arguments (ES2025 10.2.1.1 OrdinaryCallBindThis, 15.3 ArrowFunction) ---
  { feature: 'arrow-this-in-method', input: 3, expected: 'a1:3', spec: '15.3.4 ArrowFunction; 10.2.1.1',
    source: `function f(x){var o={v:x,m(){var g=()=>'a1:'+this.v;return g();}};return o.m();}` },
  { feature: 'arrow-nested-this', input: 3, expected: 'a2:6', spec: '15.3.4',
    source: `function f(x){var o={v:x,m(){return (()=>()=>this.v*2)()();}};return 'a2:'+o.m();}` },
  { feature: 'arrow-this-ignores-call-apply-bind', input: 3, expected: 'a3:333', spec: '10.2.1.1 step 1 (lexical thisMode)',
    source: `function f(x){var o={v:x,m(){var a=()=>this.v;var b=a.bind({v:100});return 'a3:'+a.call({v:10})+a.apply({v:20})+b();}};return o.m();}` },
  { feature: 'arrow-returned-keeps-defining-this', input: 3, expected: 'a4:3', spec: '15.3.4',
    source: `function f(x){var o={v:x,m(){return ()=>()=>this.v;}};var p={v:-1,k:o.m()};return 'a4:'+p.k()();}` },
  { feature: 'arrow-outer-arguments', input: 3, expected: 'a5:5', spec: '10.2.11 step 15 (arrow has no arguments binding)',
    source: `function f(x){function g(){var h=()=>arguments[0]+arguments.length;return h(100);}return 'a5:'+g(x,1);}` },
  { feature: 'arrow-outer-arguments-after-param-reassign-sloppy', input: 3, expected: 'a6:30', spec: '10.4.4.6 CreateMappedArgumentsObject',
    source: `function f(x){function g(a){a=a*10;var h=()=>arguments[0];return h();}return 'a6:'+g(x);}` },
  { feature: 'arrow-outer-arguments-after-param-reassign-strict', input: 3, expected: 'a7:3:30', spec: '10.4.4.5 CreateUnmappedArgumentsObject',
    source: `function f(x){function g(a){'use strict';a=a*10;var h=()=>arguments[0];return 'a7:'+h()+':'+a;}return g(x);}` },
  { feature: 'arrow-writes-outer-param-mapped', input: 3, expected: 'a8:4:4', spec: '10.4.4.6',
    source: `function f(x){function g(a){var h=()=>{a=a+1;return arguments[0];};return 'a8:'+h(50)+':'+arguments[0];}return g(x);}` },
  { feature: 'arrow-own-args-not-arguments', input: 3, expected: 'a9:1:3', spec: '10.2.11',
    source: `function f(x){function g(a,b){var h=()=>arguments.length;return 'a9:'+h(1,2,3)+':'+a;}return g(x);}` },
  { feature: 'method-default-param-this', input: 3, expected: 'a10:6', spec: '10.2.11 (parameter scope sees this)',
    source: `function f(x){var o={v:x,m(a=this.v*2){return 'a10:'+a;}};return o.m();}` },

  // --- this binding: strict vs sloppy, plain / method / call / apply / bind ---
  { feature: 'strict-entry-this-undefined', input: 3, expected: 'b1:undefined3', spec: '10.2.1.2 OrdinaryCallBindThis (strict)',
    note: 'The entry frame receiver is undefined; strict code does not coerce it.',
    source: `function f(x){'use strict';return 'b1:'+typeof this+x;}` },
  { feature: 'strict-plain-call-this-undefined', input: 3, expected: 'b2:undefined3', spec: '10.2.1.2',
    source: `function f(x){function g(){'use strict';return typeof this;}return 'b2:'+g()+x;}` },
  { feature: 'strict-call-primitive-not-boxed', input: 3, expected: 'b3:trueboolean4', spec: '20.2.3.3 Function.prototype.call; 10.2.1.2',
    source: `function f(x){function g(){'use strict';return this;}return 'b3:'+(g.call(x)===x)+typeof g.call(true)+g.apply(x+1);}` },
  { feature: 'strict-call-null-undefined-this', input: 3, expected: 'b4:true:true3', spec: '10.2.1.2',
    source: `function f(x){function g(){'use strict';return this;}return 'b4:'+(g.call(null)===null)+':'+(g.apply(undefined)===undefined)+x;}` },
  { feature: 'sloppy-call-primitive-boxed', input: 3, expected: 'b5:object4', spec: '10.2.1.2 step 6.b ToObject(thisArgument)',
    source: `function f(x){function g(){return typeof this+(this+1);}return 'b5:'+g.call(x);}` },
  { feature: 'sloppy-bind-primitive-boxed', input: 3, expected: 'b6:4number', spec: '20.2.3.2 Function.prototype.bind; 10.2.1.2',
    source: `function f(x){function g(){return this.valueOf()+1;}var b=g.bind(x);return 'b6:'+b()+typeof b.call(0);}` },
  { feature: 'sloppy-method-this-is-base', input: 3, expected: 'b7:true3', spec: '13.3.6.2 EvaluateCall (property reference this)',
    source: `function f(x){function g(){return this;}var o={g:g};return 'b7:'+(o.g()===o)+x;}` },
  { feature: 'strict-bind-primitive', input: 3, expected: 'b8:6', spec: '20.2.3.2',
    source: `function f(x){function g(){'use strict';return this;}return 'b8:'+g.bind(x)()*2;}` },
  { feature: 'member-call-forms-this', input: 3, expected: 'b9:3:3:undefined', spec: '13.3.6.1 (parenthesized keeps Reference; comma loses it)',
    source: `function f(x){var o={v:x,h(){'use strict';return this&&this.v;}};return 'b9:'+o['h']()+':'+(o.h)()+':'+(0,o.h)();}` },
  { feature: 'sloppy-method-on-number-boxed', input: 3, expected: 'b10:object4', spec: '10.2.1.2',
    source: `function f(x){Number.prototype.me=function(){return this;};var r=x.me();delete Number.prototype.me;return 'b10:'+typeof r+(r+1);}` },
  { feature: 'strict-method-on-number-primitive', input: 3, expected: 'b11:number3', spec: '10.2.1.2',
    source: `function f(x){Number.prototype.me=function(){'use strict';return this;};var r=x.me();delete Number.prototype.me;return 'b11:'+typeof r+r;}` },
  { feature: 'getter-this-number-sloppy', input: 3, expected: 'b12:object3', spec: '7.3.2 GetV; 10.2.1.2',
    source: `function f(x){Object.defineProperty(Number.prototype,'kind',{get(){return typeof this;},configurable:true});var r=x.kind;delete Number.prototype.kind;return 'b12:'+r+x;}` },
  { feature: 'getter-this-number-strict', input: 3, expected: 'b13:number3', spec: '7.3.2 GetV (receiver stays primitive)',
    source: `function f(x){Object.defineProperty(Number.prototype,'kind',{get(){'use strict';return typeof this;},configurable:true});var r=x.kind;delete Number.prototype.kind;return 'b13:'+r+x;}` },
  { feature: 'getter-this-string-strict', input: 3, expected: 'b14:a3a3', spec: '7.3.2 GetV',
    source: `function f(x){Object.defineProperty(String.prototype,'twice',{get(){'use strict';return 'b14:'+this+this;},configurable:true});var r=('a'+x).twice;delete String.prototype.twice;return r;}` },
  { feature: 'sloppy-this-bound-object-wins-over-call', input: 3, expected: 'b15:6', spec: '10.4.1.1 [[Call]] of bound function',
    source: `function f(x){function g(){return this.v;}var o={v:x};var b=g.bind(o);return 'b15:'+(b()+b.call({v:9}));}` },

  // --- Parameters: defaults, duplicates, length, arguments mapping ---
  { feature: 'default-sees-earlier-params-and-closure', input: 3, expected: 'c1:7', spec: '10.2.11 IteratorBindingInitialization of FormalParameters',
    source: `function f(x){function g(a,b=a+1,c=()=>a+b){return 'c1:'+c();}return g(x);}` },
  { feature: 'default-does-not-see-body-var', input: 3, expected: 'c2:number3', spec: '10.2.11 step 28 (separate varEnv)',
    source: `function f(x){var v=100;function g(a,b=typeof v){var v='s';return 'c2:'+b+a;}return g(x);}` },
  { feature: 'default-closure-sees-param-not-body-var', input: 3, expected: 'c3:3:50', spec: '10.2.11 step 28.f (body var initialized from param)',
    source: `function f(x){function g(a,b=()=>a){var a;a=50;return 'c3:'+b()+':'+a;}return g(x);}` },
  { feature: 'default-closure-sees-outer-not-body-var', input: 3, expected: 'c4:outer3', spec: '10.2.11 step 28',
    source: `function f(x){var v='outer'+x;function g(a=()=>v){var v='inner';return 'c4:'+a();}return g();}` },
  { feature: 'non-simple-params-arguments-unmapped', input: 3, expected: 'c5:3:30:0', spec: '10.2.11 step 22 (unmapped when not simple)',
    source: `function f(x){function g(a,b=0){a=a*10;arguments[1]=5;return 'c5:'+arguments[0]+':'+a+':'+b;}return g(x);}` },
  { feature: 'non-simple-params-arguments-write-not-param', input: 3, expected: 'c6:3:99', spec: '10.4.4.5',
    source: `function f(x){function g(a,b=0){arguments[0]=99;return 'c6:'+a+':'+arguments[0];}return g(x);}` },
  { feature: 'default-param-tdz-later-param', input: 3, expected: 'c7:true:3', spec: '10.2.11 (parameters are lexically TDZ until bound)',
    source: `function f(x){function g(a=b,b=x){return a;}try{return g();}catch(e){return 'c7:'+(e instanceof ReferenceError)+':'+x;}}` },
  { feature: 'default-applies-only-for-undefined', input: 3, expected: 'c8:9:3:4', spec: '10.2.11',
    source: `function f(x){function g(a=x,b=a*2){return a+b;}return 'c8:'+g()+':'+g(1)+':'+g(undefined,1);}` },
  { feature: 'duplicate-params-last-wins', input: 3, expected: 'c9:6:3', spec: '10.2.11 step 21 (sloppy duplicates)',
    source: `function f(x){function g(a,a){return 'c9:'+a+':'+arguments[0];}return g(x,x*2);}` },
  { feature: 'duplicate-params-only-last-mapped', input: 3, expected: 'c10:15:7:7', spec: '10.4.4.6 step 17 (mappedNames, last occurrence)',
    source: `function f(x){function g(a,a){a=a+1;arguments[0]=x*5;return 'c10:'+arguments[0]+':'+arguments[1]+':'+a;}return g(x,x*2);}` },
  { feature: 'duplicate-params-missing-last-is-undefined', input: 3, expected: 'c11:undefined3', spec: '10.2.11',
    source: `function f(x){function g(a,a){return a;}return 'c11:'+g(x)+x;}` },
  { feature: 'function-length-with-defaults', input: 3, expected: 'c12:1:2:2:3', spec: '15.1.5 ExpectedArgumentCount',
    source: `function f(x){function g(a,b=1,c){}function k(a,b,c=2,d){}function m(a,b){}return 'c12:'+g.length+':'+k.length+':'+m.length+':'+x;}` },
  { feature: 'arguments-visible-in-default', input: 3, expected: 'c13:3:3', spec: '10.2.11 step 22-23 (arguments bound before parameters)',
    source: `function f(x){function g(a,b=arguments.length){return 'c13:'+b+':'+a;}return g(x,undefined,7);}` },
  { feature: 'body-function-decl-replaces-param', input: 3, expected: 'c14:function3', spec: '10.2.11 step 36 (functionsToInitialize)',
    source: `function f(x){function g(a){function a(){return x;}return 'c14:'+typeof a+a();}return g(5);}` },
  { feature: 'var-redeclare-param-keeps-value', input: 3, expected: 'c15:6', spec: '10.2.11 step 27 (instantiatedVarNames)',
    source: `function f(x){function g(a){var a;return a;}return 'c15:'+g(x)*2;}` },
  { feature: 'strict-arguments-callee-throws', input: 3, expected: 'c16:TE3', spec: '10.4.4.5 step 8 (%ThrowTypeError%)',
    source: `function f(x){function g(){'use strict';try{return arguments.callee;}catch(e){return e instanceof TypeError?'c16:TE'+x:'x';}}return g();}` },
  { feature: 'named-fn-expr-sloppy-assign-ignored', input: 3, expected: 'c17:function3', spec: '15.2.5 (immutable funcEnv binding, sloppy ignore)',
    source: `function f(x){var g=function h(){h=1;return typeof h;};return 'c17:'+g()+x;}` },
  { feature: 'named-fn-expr-strict-assign-throws', input: 3, expected: 'c18:TE3', spec: '9.1.1.1.5 SetMutableBinding (strict immutable)',
    source: `function f(x){var g=function h(){'use strict';try{h=1;}catch(e){return e instanceof TypeError?'c18:TE'+x:'x';}return 'no';};return g();}` },
  { feature: 'sloppy-arguments-callee-self', input: 3, expected: 'c19:self3', spec: '10.4.4.6 step 20',
    source: `function f(x){function g(){return arguments.callee===g?'c19:self'+x:'no';}return g();}` },
  { feature: 'function-length-with-rest', input: 3, expected: 'c20:1:0:3', spec: '15.1.5 ExpectedArgumentCount (rest excluded)',
    note: 'rest lowering is owned by Phase 4 worker 2 (phase4-registry.js); only length is checked here.',
    source: `function f(x){function h(a,...r){}function k(...r){}return 'c20:'+h.length+':'+k.length+':'+x;}` },

  // --- Declarations: hoisting, redeclaration, Annex B.3.1-B.3.4 (ES2025 numbering;
  //     ES2020 numbered these B.3.2-B.3.5), labels ---
  { feature: 'function-decl-hoisted-before-use', input: 3, expected: 'd1:15', spec: '10.2.11 step 36',
    source: `function f(x){return 'd1:'+h();function h(){return x*5;}}` },
  { feature: 'later-function-decl-wins', input: 3, expected: 'd2:3', spec: '10.2.11 step 14 (last declaration)',
    source: `function f(x){function g(){return 1;}function g(){return 'd2:'+x;}return g();}` },
  { feature: 'var-without-init-keeps-function', input: 3, expected: 'd3:function3', spec: '10.2.11 step 27',
    source: `function f(x){function g(){return x;}var g;return 'd3:'+typeof g+g();}` },
  { feature: 'var-initializer-overrides-hoisted-function', input: 3, expected: 'd4:3', spec: '14.3.2.1 VariableDeclaration evaluation',
    source: `function f(x){var g=x;function g(){return 0;}return 'd4:'+g;}` },
  { feature: 'annexb-block-fn-var-undefined-before-block', input: 3, expected: 'd5:undefined:3', spec: 'B.3.2.1 (var binding initialized to undefined)',
    source: `function f(x){var r=typeof g;{function g(){return x;}}return 'd5:'+r+':'+g();}` },
  { feature: 'annexb-block-fn-not-evaluated', input: 3, expected: 'd6:undefined:none3', spec: 'B.3.2.1 step iii (copy only when evaluated)',
    source: `function f(x){var r=typeof g;if(x>5){function g(){return x*2;}}return 'd6:'+r+':'+(typeof g==='function'?g():'none'+x);}` },
  { feature: 'annexb-block-fn-hoisted-within-block', input: 3, expected: 'd7:functionfunction3', spec: '14.2.3 BlockDeclarationInstantiation',
    source: `function f(x){var log='';{log+=typeof g;function g(){return x;}log+=typeof g;}return 'd7:'+log+g();}` },
  { feature: 'annexb-assignment-in-block-is-lexical', input: 3, expected: 'd8:3', spec: 'B.3.2.1 step iii (copy at declaration position)',
    source: `function f(x){{function g(){return 'd8:'+x;}g=function(){return 'inner';};}return g();}` },
  { feature: 'annexb-skip-when-let-conflicts', input: 3, expected: 'd9:number3', spec: 'B.3.2.1 (would-be early error)',
    source: `function f(x){let g=x;{function g(){return 1;}}return 'd9:'+typeof g+g;}` },
  { feature: 'annexb-skip-when-parameter-name', input: 3, expected: 'd10:number3', spec: 'B.3.2.1 (parameterNames contains F)',
    source: `function f(x){function h(g){{function g(){return 1;}}return typeof g+g;}return 'd10:'+h(x);}` },
  { feature: 'annexb-block-fn-inside-catch-param', input: 3, expected: 'd11:number3:function', spec: 'B.3.4 VariableStatements in Catch Blocks; B.3.2.1',
    source: `function f(x){try{throw x;}catch(g){{function g(){return 1;}}var r=typeof g+g;}return 'd11:'+r+':'+typeof g;}` },
  { feature: 'annexb-two-blocks-last-evaluated-wins', input: 3, expected: 'd12:3', spec: 'B.3.2.1',
    source: `function f(x){{function g(){return 1;}}{function g(){return 'd12:'+x;}}return g();}` },
  { feature: 'annexb-for-body-fn', input: 3, expected: 'd13:4', spec: 'B.3.2.1',
    source: `function f(x){for(var i=0;i<1;i++){function g(){return x+i;}}return 'd13:'+g();}` },
  { feature: 'annexb-switch-case-fn', input: 3, expected: 'd14:undefined:def3', spec: 'B.3.2.1 (CaseClause / DefaultClause)',
    source: `function f(x){switch(x){case 1:function g(){return 'one';}break;default:function h(){return 'def'+x;}}return 'd14:'+typeof g+':'+h();}` },
  { feature: 'annexb-if-clause-fn', input: 3, expected: 'd15:4', spec: 'B.3.3 FunctionDeclarations in IfStatement Statement Clauses',
    source: `function f(x){if(x)function g(){return x+1;}return 'd15:'+g();}` },
  { feature: 'annexb-if-else-clause-same-name', input: 3, expected: 'd16:b3', spec: 'B.3.3', regression: IF_SCOPE,
    note: 'Vendor compiler shares one scope between both clauses and drops the else-clause var copy (fclosure; drop), so g is undefined: TypeError.',
    source: `function f(x){if(x>4)function g(){return 'a'+x;}else function g(){return 'b'+x;}return 'd16:'+g();}` },
  { feature: 'annexb-if-else-clause-negated', input: 3, expected: 'd17:9', spec: 'B.3.3', regression: IF_SCOPE,
    source: `function f(x){if(!x)function g(){return 1;}else function g(){return x*3;}return 'd17:'+g();}` },
  { feature: 'annexb-if-else-clause-in-loop', input: 3, expected: 'd18:-2:5', spec: 'B.3.3', regression: IF_SCOPE,
    source: `function f(x){var a=[];for(var i=0;i<2;i++){if(i)function g(){return i+x;}else function g(){return -i;}a.push(g);}return 'd18:'+a[0]()+':'+a[1]();}` },
  { feature: 'annexb-if-else-clause-var-undefined-before', input: 3, expected: 'd19:undefined3', spec: 'B.3.3; B.3.2.1', regression: IF_SCOPE,
    source: `function f(x){var log=typeof g;if(x>4)function g(){return 1;}else function g(){return x;}return 'd19:'+log+g();}` },
  { feature: 'annexb-if-else-clause-let-conflict-control', input: 3, expected: 'd20:number3', spec: 'B.3.3; B.3.2.1 (would-be early error)',
    note: 'Control: no var copy in either compiler; unchanged by the patch.',
    source: `function f(x){let g=x;if(x)function g(){return 1;}else function g(){return 2;}return 'd20:'+typeof g+g;}` },
  { feature: 'labelled-function-decl', input: 3, expected: 'd21:7', spec: 'B.3.1 Labelled Function Declarations',
    source: `function f(x){L:function g(){return x+4;}return 'd21:'+g();}` },
  { feature: 'annexb-var-redeclares-catch-param', input: 3, expected: 'd22:6:undefined', spec: 'B.3.4 VariableStatements in Catch Blocks',
    note: 'The initializer writes the catch parameter; the function-level var stays undefined.',
    source: `function f(x){try{throw x;}catch(e){var e=x*2;var r=e;}return 'd22:'+r+':'+e;}` },
  { feature: 'catch-param-shadows-outer', input: 3, expected: 'd23:o3', spec: '14.15.2 CatchClauseEvaluation',
    source: `function f(x){var e='o';try{throw x;}catch(e){e=e+1;}return 'd23:'+e+x;}` },
  { feature: 'annexb-block-fn-named-arguments', input: 3, expected: 'd24:function3', spec: 'B.3.2.1 step iii (F = "arguments")', regression: ARGS_FN,
    note: 'Vendor compiler skips the Annex B copy for "arguments" whenever the function has an arguments binding.',
    source: `function f(x){function h(){{function arguments(){return x;}}return typeof arguments+arguments();}return 'd24:'+h(x);}` },
  { feature: 'annexb-block-fn-arguments-object-before', input: 3, expected: 'd25:objectfunction3', spec: 'B.3.2.1 step ii-iii', regression: ARGS_FN,
    source: `function f(x){function h(){var r=typeof arguments;{function arguments(){return x;}}return r+typeof arguments+arguments();}return 'd25:'+h(x);}` },
  { feature: 'annexb-block-fn-arguments-value-before', input: 3, expected: 'd26:3function', spec: 'B.3.2.1 step ii-iii', regression: ARGS_FN,
    source: `function f(x){function h(){var r=arguments[0];{function arguments(){return x;}}return r+typeof arguments;}return 'd26:'+h(x);}` },
  { feature: 'annexb-block-fn-arguments-not-evaluated-control', input: 3, expected: 'd27:object3', spec: 'B.3.2.1 step iii',
    note: 'Control: the block is not evaluated, so the arguments object is kept.',
    source: `function f(x){function h(){if(x>5){function arguments(){return x;}}return typeof arguments+x;}return 'd27:'+h(x);}` },
  { feature: 'annexb-block-fn-arguments-non-simple-params', input: 3, expected: 'd28:function3', spec: 'B.3.2.1 step iii', regression: ARGS_FN,
    source: `function f(x){function h(a,b=1){{function arguments(){return x;}}return typeof arguments+a;}return 'd28:'+h(x);}` },

  // --- Call evaluation order and caught TypeError / ReferenceError ---
  { feature: 'call-callee-evaluated-before-args', input: 3, expected: 'e1:old3a', spec: '13.3.6.1 (ref evaluated, GetValue, then ArgumentListEvaluation)',
    source: `function f(x){var log='';var g=function(){return 'old'+x;};var r=g((g=function(){return 'new';},log+='a'));return 'e1:'+r+log;}` },
  { feature: 'call-member-base-evaluated-before-args', input: 3, expected: 'e2:o3p', spec: '13.3.6.1',
    source: `function f(x){var o={m(){return 'o'+x;}};var p={m(){return 'p';}};return 'e2:'+o.m(o=p)+o.m();}` },
  { feature: 'call-noncallable-member-after-args', input: 3, expected: 'e3:oa:true3', spec: '13.3.6.2 EvaluateCall step 4 (IsCallable after args)',
    source: `function f(x){var log='';function o(){log+='o';return {m:null};}function a(){log+='a';return x;}try{o().m(a());}catch(e){return 'e3:'+log+':'+(e instanceof TypeError)+x;}}` },
  { feature: 'call-getter-noncallable-after-args', input: 3, expected: 'e4:ma:true3', spec: '13.3.6.2',
    source: `function f(x){var log='';var o={get m(){log+='m';return 5;}};try{o.m(log+='a',x);}catch(e){return 'e4:'+log+':'+(e instanceof TypeError)+x;}}` },
  { feature: 'call-undefined-base-throws-before-args', input: 3, expected: 'e5::true3', spec: '13.3.2.1 (GetValue on undefined base)',
    source: `function f(x){var log='';try{var u;u.p(log+='a');}catch(e){return 'e5:'+log+':'+(e instanceof TypeError)+x;}}` },
  { feature: 'call-undefined-binding-throws-after-args', input: 3, expected: 'e6:a3:true', spec: '13.3.6.2',
    source: `function f(x){var log='';var g;try{g(log+='a'+x);}catch(e){return 'e6:'+log+':'+(e instanceof TypeError);}}` },
  { feature: 'new-arrow-typeerror-caught', input: 3, expected: 'e7:TEa3', spec: '13.3.5.1.1 EvaluateNew step 7 (IsConstructor)',
    source: `function f(x){var a=()=>x;try{new a();}catch(e){return e instanceof TypeError?'e7:TEa'+x:'x';}return 'made';}` },
  { feature: 'new-method-typeerror-caught', input: 3, expected: 'e8:TEm3', spec: '13.3.5.1.1; 15.4 (methods are not constructors)',
    source: `function f(x){var o={m(){return x;}};try{new o.m();}catch(e){return e instanceof TypeError?'e8:TEm'+x:'x';}return 'made';}` },
  { feature: 'new-getter-typeerror-caught', input: 3, expected: 'e9:TEg3', spec: '13.3.5.1.1',
    source: `function f(x){var o={get p(){return 1;}};var d=Object.getOwnPropertyDescriptor(o,'p');try{new d.get();}catch(e){return e instanceof TypeError?'e9:TEg'+x:'x';}return 'made';}` },
  { feature: 'typeof-tdz-referenceerror', input: 3, expected: 'e10:true3', spec: '13.5.3.1 typeof (GetValue throws for uninitialized binding)',
    source: `function f(x){try{return typeof t;}catch(e){return 'e10:'+(e instanceof ReferenceError)+x;}let t;}` },
  { feature: 'typeof-declared-later-var-undefined', input: 3, expected: 'e11:undefined3', spec: '13.5.3.1',
    source: `function f(x){var r=typeof v;var v=1;return 'e11:'+r+x;}` },
];

// Uncaught TypeErrors (odd input throws; the even input+1 returns a value).
const typeErrorList = [
  { feature: 'uncaught-new-arrow', input: 3, expected: 'TypeError', spec: '13.3.5.1.1',
    source: `function f(x){var a=()=>x;if(x%2)return new a();return 'n'+x;}` },
  { feature: 'uncaught-new-method', input: 3, expected: 'TypeError', spec: '13.3.5.1.1',
    source: `function f(x){var o={m(){return x;}};if(x%2)return new o.m();return 'n'+x;}` },
  { feature: 'uncaught-new-bound-arrow', input: 3, expected: 'TypeError', spec: '10.4.1.3 BoundFunctionCreate (no [[Construct]])',
    source: `function f(x){var a=(()=>x).bind(null);if(x%2)return new a();return 'n'+x;}` },
  { feature: 'uncaught-call-noncallable-member', input: 3, expected: 'TypeError', spec: '13.3.6.2',
    source: `function f(x){var o={m:x};if(x%2)return o.m(x);return 'n'+x;}` },
  { feature: 'uncaught-call-undefined-binding', input: 3, expected: 'TypeError', spec: '13.3.6.2',
    source: `function f(x){var g;if(x%2)return g(x);return 'n'+x;}` },
  { feature: 'uncaught-call-null-base', input: 3, expected: 'TypeError', spec: '13.3.2.1',
    source: `function f(x){var o=null;if(x%2)return o.m(x);return 'n'+x;}` },
  { feature: 'uncaught-strict-arguments-callee', input: 3, expected: 'TypeError', spec: '10.4.4.5',
    source: `function f(x){function g(){'use strict';return arguments.callee;}if(x%2)return g();return 'n'+x;}` },
  { feature: 'uncaught-strict-named-fn-expr-assign', input: 3, expected: 'TypeError', spec: '9.1.1.1.5',
    source: `function f(x){var g=function h(){'use strict';h=x;return h;};if(x%2)return g();return 'n'+x;}` },
];

// Formerly explicitly unsupported (runtime status 6 for a sloppy undefined/null
// this, compiler rejection for free global names). Since the next-wave global
// object integration (phase4-global.js, worker 6) these programs pack in
// global-object mode (image[0].w bit 17) and must produce the ES2025 value:
// sloppy this with an undefined/null receiver is fixed node 65, and free names
// lower to get_global / put_global. `globalMode: true` means the program
// requires global-object mode (check-phase4-edge.mjs asserts the image bit).
const globalList = [
  { feature: 'sloppy-plain-call-this-global', input: 3, expected: 'u1:object3',
    spec: '10.2.1.2 step 6.a (globalThis)', source: `function f(x){function g(){return typeof this;}return 'u1:'+g()+x;}` },
  { feature: 'sloppy-entry-arrow-this-global', input: 3, expected: 'u2:object3',
    spec: '10.2.1.2', note: 'The entry function itself is sloppy and binds this (captured by the arrow).',
    source: `function f(x){var a=()=>typeof this;return 'u2:'+a()+x;}` },
  { feature: 'sloppy-call-null-this-global', input: 3, expected: 'u3:object3',
    spec: '10.2.1.2', source: `function f(x){function g(){return typeof this;}return 'u3:'+g.call(null)+x;}` },
  { feature: 'sloppy-apply-undefined-this-global', input: 3, expected: 'u4:true3',
    spec: '10.2.1.2', source: `function f(x){function g(){return this!==undefined;}return 'u4:'+g.apply(undefined)+x;}` },
  { feature: 'sloppy-this-unreached-still-bound', input: 3, expected: 'u5:3',
    spec: '10.2.1.2', note: 'QuickJS emits push_this in the prologue of any sloppy function that references this; with an undefined receiver it now binds the global object (node 65) instead of reporting status 6.',
    source: `function f(x){function g(t){if(t)return this;return 'u5:'+x;}return g(0);}` },
  { feature: 'sloppy-bind-null-this-global', input: 3, expected: 'u6:object3',
    spec: '10.2.1.2', source: `function f(x){function g(){return typeof this;}return 'u6:'+g.bind(null)()+x;}` },
  { feature: 'sloppy-detached-method-this-global', input: 3, expected: 'u7:true3',
    spec: '10.2.1.2', source: `function f(x){var o={m(){return this!==o;}};var m=o.m;return 'u7:'+m()+x;}` },
  { feature: 'typeof-undeclared-global', input: 3, expected: 'u8:undefined3',
    spec: '13.5.3.1 (unresolvable reference)', source: `function f(x){return 'u8:'+typeof notDeclaredAnywhere+x;}` },
  { feature: 'strict-block-fn-not-visible-outside', input: 3, expected: 'u9:undefined3',
    spec: '14.2.3 (strict: block scoped only)', note: 'After the block g is a free (global) reference: get_global with typeof semantics.',
    source: `function f(x){'use strict';{function g(){return x;}}return 'u9:'+typeof g+x;}` },
  { feature: 'global-this-identity', input: 3, expected: 'u10:true3',
    spec: '19.1 globalThis', source: `function f(x){return 'u10:'+(globalThis===this)+x;}` },
  { feature: 'sloppy-implicit-global-assignment', input: 3, expected: 'u11:3',
    spec: '6.2.5.6 PutValue step 5.b (sloppy global)', source: `function f(x){implicitGlobalW7=x;return 'u11:'+implicitGlobalW7;}` },
];
edgeCaseList.push(...globalList.map(c => ({ ...c, globalMode: true })));
// No edge fixture is explicitly unsupported any more (kept for importers).
const unsupportedList = [];
// Lead integration: admitted since the Phase 4 class/new.target integration
// (special_object 3); moved from the unsupported list with its fixed value.
edgeCaseList.push({ feature: 'arrow-new-target', input: 3, expected: 'u12:true3',
  spec: '13.3.12 new.target (special_object 3, worker 5)', source: `function f(x){function C(){var a=()=>new.target===C;this.t=a();}return 'u12:'+new C().t+x;}` });

const complete = (list, defaults) => Object.freeze(list.map(c => Object.freeze({ note: '', ...defaults(c), ...c })));
export const edgeCases = complete(edgeCaseList, c => ({ admission: 'admitted', classification: c.regression ? 'compiler-bug' : 'pass' }));
export const edgeTypeErrorCases = complete(typeErrorList, () => ({ admission: 'admitted', classification: 'pass', throws: true }));
export const edgeUnsupportedCases = complete(unsupportedList, c => ({
  admission: c.mechanism === 'compiler-rejection' ? 'rejected' : 'admitted', classification: 'explicit-unsupported' }));
export const edgePatches = Object.freeze({
  [IF_SCOPE]: 'phase4-patches/w7-annexb-if-clause-scope.diff',
  [ARGS_FN]: 'phase4-patches/w7-annexb-arguments-block-function.diff',
});
// Marker comments each patch adds to vendor/quickjs.c (used to detect integration).
export const edgePatchMarkers = Object.freeze({
  [IF_SCOPE]: 'LANES: ES2025 Annex B.3.3 (B.3.4 before ES2022): a',
  [ARGS_FN]: 'LANES: reuse the arguments-object binding (Annex B.3.2.1).',
});
