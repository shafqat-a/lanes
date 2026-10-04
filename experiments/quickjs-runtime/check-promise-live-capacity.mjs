// A lower bound on simultaneously reachable nodes BEFORE the first job drain.
// This is representation-capacity accounting, not a proof of leak freedom.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {promiseCreateResolvingFunctionsSource} from './promise-core-source.js';
import {LIMITS} from './program.js';
import {shader} from './shader.js';
const raw=JSON.parse(execFileSync(fileURLToPath(new URL('./generated/compiler',import.meta.url)),[promiseCreateResolvingFunctionsSource],{encoding:'utf8'}));
const [root,resolve,reject]=raw.functions;
assert.equal(root.args,1);assert.equal(root.locals,3);
for(const f of [resolve,reject]){
 assert.equal(f.refs.length,4);
 assert(f.refs.some(r=>r.name==='alreadyResolved'&&r.type===0&&r.index===2));
 assert(f.refs.some(r=>r.name==='promise'&&r.type===1&&r.index===0));
 assert(f.refs.some(r=>r.name==='undefined'&&r.type===3));
}
assert(root.refs.some(r=>r.name==='undefined'));
// Actual storage invariants on which these conservative bounds depend.
assert(shader.includes('mark(l,node.next);'));
assert(shader.includes('captured=alloc(l,1u,V(spec.y,spec.z,spec.w,0u),0u,0u)'));
assert(shader.includes('alloc(l,6u,V(captured,0u,0u,0u),i,states[l].heap[id].next)'));
for(const pattern of ['let backing=alloc(l,2u','let length=alloc(l,3u','let name=alloc(l,3u'])assert(shader.includes(pattern));
assert(shader.includes('let fulfill=alloc(l,PROMISE_REACTION,b,0u,0u);'));
assert(shader.includes('let reject=alloc(l,PROMISE_REACTION,c,1u,0u);'));
const closureNodes=1+resolve.refs.length+3; // closure, ref links, backing/name/length
const sharedCells=root.args+root.locals; // captured last local's next chain retains all four
const undefinedCell=1; // private immutable capture shared by the two arrows
const promiseNodes=2,capabilityNodes=4,reactionRecords=8,reactionLinks=2;
const pendingCapability=promiseNodes+capabilityNodes+2*closureNodes+sharedCells+undefinedCell+reactionRecords+reactionLinks;
const bareHandler=4; // callback closure/backing/name/length; exclude all captures
const chain50=50*(pendingCapability+bareHandler)-3+3;
// First input is fulfilled: one reaction record+three job cells replace two
// records+two links (7 instead of10 => minus3). Count only3intrinsic roots.
const retainedInput=promiseNodes+closureNodes+sharedCells+undefinedCell;
const pendingAll40=40*(retainedInput+pendingCapability)+2+2*40;
assert(chain50>LIMITS.heap);assert(pendingAll40>LIMITS.heap);
console.log(JSON.stringify({heapCapacity:LIMITS.heap,resolverClosureNodes:closureNodes,sharedCapturedCells:sharedCells,pendingCapabilityLowerBound:pendingCapability,thenableChain50LiveLowerBound:chain50,pendingAll40LiveLowerBound:pendingAll40,gpuExecuted:false,scope:'Lower bounds for synchronous construction before jobs run; not a general leak-freedom claim.'}));
