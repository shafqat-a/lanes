// Worker 7 part A fixtures: guest job queue draining and completion publication.
// f(x) is run with x = input and x = input + 1; after the run completes the
// GPU drains the job queue and publishes:
//   settlement 'none'     -> status 1 (non-promise result `expected`)
//   'fulfilled'           -> status 12, value = fulfillment value
//   'rejected'            -> status 13, value = rejection reason
//   'pending'             -> status 14, value undefined
// check-promise-jobs.mjs verifies every expectation against the host engine
// with real job draining (oracle only). `requires` lists the other workers'
// features a GPU run also needs beyond the job queue itself.
export const SETTLEMENT_STATUS = Object.freeze({ none: 1, fulfilled: 12, rejected: 13, pending: 14 });
const STATUS = SETTLEMENT_STATUS;
const c = (feature, body, expected, expectedNext, settlement = 'fulfilled', extra = {}) =>
  Object.freeze({ feature, source: `function f(x){${body}}`, input: 3, expected, expectedNext, settlement, status: STATUS[settlement], requires: ['promise-core', 'promise-resolve', 'promise-then'], ...extra });

export const promiseJobsCases = Object.freeze([
  c('fifo-reactions-in-registration-order',
    `let log='';const p=Promise.resolve(x);p.then(()=>{log+='a';});p.then(()=>{log+='b';});Promise.resolve().then(()=>{log+='c';});return p.then(v=>log+v);`,
    'abc3', 'abc4'),
  c('two-chains-interleave',
    `let log='';Promise.resolve().then(()=>{log+='1';}).then(()=>{log+='3';});Promise.resolve().then(()=>{log+='2';}).then(()=>{log+='4';});return Promise.resolve().then(()=>0).then(()=>0).then(()=>log+x);`,
    '12343', '12344'),
  c('jobs-enqueued-by-jobs-run-after-earlier-jobs',
    `let log='';Promise.resolve().then(()=>{log+='a';Promise.resolve().then(()=>{log+='c';});});Promise.resolve().then(()=>{log+='b';});return Promise.resolve().then(()=>0).then(()=>0).then(()=>log+x);`,
    'abc3', 'abc4'),
  c('resolve-with-promise-takes-two-extra-jobs',
    `let log='';const p=Promise.resolve();new Promise(r=>r(p)).then(()=>{log+='a';});p.then(()=>{log+='b';}).then(()=>{log+='c';}).then(()=>{log+='d';});return p.then(()=>0).then(()=>0).then(()=>0).then(()=>0).then(()=>log+x);`,
    'bcad3', 'bcad4'),
  c('thenable-job-type-2',
    `return Promise.resolve({then(r){r(x*2);}});`, 6, 8),
  c('thenable-job-runs-after-sync-code',
    `let log='s';const p=Promise.resolve({then(r){log+='t';r(log);}});log+='e';return p;`, 'set', 'set'),
  c('sync-result-still-drains-status-1',
    `let n=0;Promise.resolve().then(()=>{n++;});return 'sync'+x;`, 'sync3', 'sync4', 'none'),
  c('sync-number-result-with-pending-reactions-status-1',
    `let r;const p=new Promise(res=>{r=res;});p.then(()=>{});Promise.resolve(1).then(v=>r(v));return x*10;`, 30, 40, 'none'),
  c('side-effects-of-earlier-jobs-captured-in-result',
    `const o={n:0};for(let i=0;i<x;i++){Promise.resolve(i).then(v=>{o.n+=v+1;});}return Promise.resolve().then(()=>o.n);`, 6, 10),
  c('never-settling-top-level-promise-pending', `return new Promise(()=>{});`, undefined, undefined, 'pending'),
  c('pending-after-jobs-ran',
    `let r;const p=new Promise(res=>{r=res;});Promise.resolve().then(()=>{});return p;`, undefined, undefined, 'pending'),
  c('pending-chain-on-unresolved-promise',
    `return new Promise(()=>{}).then(()=>x);`, undefined, undefined, 'pending'),
  c('rejected-top-level', `return Promise.reject('r'+x);`, 'r3', 'r4', 'rejected'),
  c('thrown-string-reason-in-executor', `return new Promise(()=>{throw 'boom'+x;});`, 'boom3', 'boom4', 'rejected'),
  c('thrown-string-reason-in-reaction', `return Promise.resolve(x).then(v=>{throw 'h'+v;});`, 'h3', 'h4', 'rejected'),
  c('rejection-after-jobs', `return Promise.resolve().then(()=>0).then(()=>Promise.reject(x+0.5));`, 3.5, 4.5, 'rejected'),
  c('bigint-fulfillment-value', `return Promise.resolve(x).then(v=>12345678901234567890n*BigInt(v));`, 37037036703703703670n, 49382715604938271560n, 'fulfilled', { requires: ['promise-core', 'promise-resolve', 'promise-then', 'bigint'] }),
  c('bigint-rejection-reason', `return Promise.reject(BigInt(x)-10n);`, -7n, -6n, 'rejected', { requires: ['promise-core', 'promise-then', 'bigint'] }),
  c('fulfilled-with-undefined', `return Promise.resolve(x).then(()=>{});`, undefined, undefined),
  c('fulfilled-already-no-jobs', `return Promise.resolve('v'+x);`, 'v3', 'v4'),
  c('bounded-job-chain-under-gc-pressure', `let p=Promise.resolve(0);for(let i=0;i<8;i++)p=p.then(v=>{let junk;for(let j=0;j<700;j++)junk={a:j,b:[j]};return v+1;});return p.then(v=>v+x);`,11,12,'fulfilled',{requiresGC:true}),
  c('500-job-chain-under-gc-pressure',
    `let p=Promise.resolve(0);for(let i=0;i<500;i++){p=p.then(v=>{const junk=[v,{a:v,b:[v,v]},'s'+v];return junk[1].b[0]+1;});}return p.then(v=>v+x);`,
    503, 504, 'fulfilled', { gcPressure: true, minimumJobs: 501, gpuOutcome:'resource', resourceReason:'500 pending capability records alone need2000 nodes, plus1000 promise nodes before jobs drain' }),
  c('bounded-chain-of-thenables', `let p=Promise.resolve(x);for(let i=0;i<16;i++)p=p.then(v=>({then(r){r(v+1);}}));return p;`,19,20,'fulfilled',{requiresGC:true}),
  c('long-chain-of-thenables',
    `let p=Promise.resolve(x);for(let i=0;i<50;i++){p=p.then(v=>({then(r){r(v+1);}}));}return p;`, 53, 54, 'fulfilled', {gpuOutcome:'resource',resourceReason:'Current representation needs at least2050 simultaneously live nodes before first job drain; lane heap2048'}),
  c('catch-recovers-to-fulfilled', `return Promise.reject(x).catch(e=>'caught'+e);`, 'caught3', 'caught4'),
  c('finally-preserves-value-order',
    `let log='';return Promise.resolve(x).finally(()=>{log+='f';}).then(v=>log+v);`, 'f3', 'f4'),
]);
