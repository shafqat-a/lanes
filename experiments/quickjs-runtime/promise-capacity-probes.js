// Diagnostic scaling probes: no resource classification until actual GPU evidence.
export const promiseCapacityProbes=[
 {feature:'pending-all-capacity',source:'function f(n){const rs=[],ps=[];for(let i=0;i<n;i++){const r=Promise.withResolvers();rs.push(r.resolve);ps.push(r.promise);}const p=Promise.all(ps);for(let i=n-1;i>=0;i--)rs[i](i);return p.then(v=>{let s=0;for(const k of v)s+=k;return s+":"+v.length;});}',inputs:[4,8,12,16,20,24,32,40],expectedForInput:n=>(n*(n-1)/2)+':'+n,settlement:'fulfilled'},
 {feature:'thenable-chain-capacity',source:'function f(n){let p=Promise.resolve(0);for(let i=0;i<n;i++)p=p.then(v=>({then(r){r(v+1);}}));return p;}',inputs:[4,8,12,16,20,24,32,40,50],expectedForInput:n=>n,settlement:'fulfilled'}
];
