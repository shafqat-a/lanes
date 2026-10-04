// ES2025 String algorithms executed as strict guest bytecode. All code-unit
// access and copying uses private intrinsics, immune to public prototype edits.
const conversion=`
 function objectLike(v){return v!==null&&(typeof v==="object"||typeof v==="function");}
 function text(v){let p=v;if(objectLike(v))p=__lanesPrimitive(v,true);
  if(typeof p==="symbol")throw new TypeError("Cannot convert a Symbol value to a string");
  
  return __lanesText(p);}
 function integer(v){let p=v;if(objectLike(v))p=__lanesPrimitive(v,false);
  if(typeof p==="symbol"||typeof p==="bigint")throw new TypeError("Cannot convert value to number");
  let n=__lanesNumber(p);if(n!==n||n===0)return 0;
  if(n===Infinity||n===-Infinity)return n;return n-n%1;}
`;
const whitespace=`
 function space(c){return c===9||c===11||c===12||c===32||c===160||c===65279||c===10||c===13||c===8232||c===8233||c===5760||(c>=8192&&c<=8202)||c===8239||c===8287||c===12288;}
`;
const make=(name,args,body,extra='')=>`function ${name}Phase5(${args}){"use strict";${conversion}${extra}
 if(this===null||this===undefined)throw new TypeError("String receiver is null or undefined");
 const s=text(this);${body}\n}`;
const padding=leading=>`let size=integer(target);if(size<=s.length||size!==size)return s;
 if(size>9007199254740991)size=9007199254740991;
 const fill=arguments.length<2||arguments[1]===undefined?" ":text(arguments[1]);
 if(fill.length===0)return s;
 const needed=size-s.length;let out="",block=fill;
 while(out.length<needed){let take=needed-out.length;if(take>block.length)take=block.length;
 out+=__lanesSlice(block,0,take);
 if(out.length<needed){let remaining=needed-out.length;if(block.length<remaining){let add=remaining-block.length;if(add>block.length)add=block.length;block+=__lanesSlice(block,0,add);}}}
 return ${leading?'out+s':'s+out'};`;
export const stringPhase5Sources=Object.freeze({
 at:make('at','index',`const n=integer(index);const k=n<0?s.length+n:n;if(k<0||k>=s.length)return undefined;return __lanesSlice(s,k,k+1);`),
 codePointAt:make('codePointAt','index',`const n=integer(index);if(n<0||n>=s.length)return undefined;
 const a=__lanesCharCodeAt(s,n);if(a<55296||a>56319||n+1>=s.length)return a;
 const b=__lanesCharCodeAt(s,n+1);if(b<56320||b>57343)return a;return (a-55296)*1024+b-56320+65536;`),
 repeat:make('repeat','count',`let n=integer(count);if(n<0||n===Infinity)throw new RangeError("Invalid count value");
 if(n===0||s.length===0)return "";let out="",block=s;
 while(n>0){if(n%2===1)out+=block;n=(n-n%2)/2;if(n>0)block+=block;}return out;`),
 padStart:make('padStart','target',padding(true)),
 padEnd:make('padEnd','target',padding(false)),
 trim:make('trim','',`let a=0,b=s.length;while(a<b&&space(__lanesCharCodeAt(s,a)))a++;while(b>a&&space(__lanesCharCodeAt(s,b-1)))b--;return __lanesSlice(s,a,b);`,whitespace),
 trimStart:make('trimStart','',`let a=0;while(a<s.length&&space(__lanesCharCodeAt(s,a)))a++;return __lanesSlice(s,a,s.length);`,whitespace),
 trimEnd:make('trimEnd','',`let b=s.length;while(b>0&&space(__lanesCharCodeAt(s,b-1)))b--;return __lanesSlice(s,0,b);`,whitespace),
 isWellFormed:make('isWellFormed','',`for(let i=0;i<s.length;i++){const a=__lanesCharCodeAt(s,i);if(a>=56320&&a<=57343)return false;
 if(a>=55296&&a<=56319){if(i+1>=s.length)return false;const b=__lanesCharCodeAt(s,i+1);if(b<56320||b>57343)return false;i++;}}return true;`),
 toWellFormed:make('toWellFormed','',`let out="";for(let i=0;i<s.length;i++){const a=__lanesCharCodeAt(s,i);
 if(a>=55296&&a<=56319){if(i+1<s.length){const b=__lanesCharCodeAt(s,i+1);if(b>=56320&&b<=57343){out+=__lanesSlice(s,i,i+2);i++;continue;}}out+="\uFFFD";}
 else if(a>=56320&&a<=57343)out+="\uFFFD";else out+=__lanesSlice(s,i,i+1);}return out;`),
});
