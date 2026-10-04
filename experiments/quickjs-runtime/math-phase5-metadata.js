// ES2025 Number static predicates and initial Math subset. IDs1600..1699 reserved.
export const numberPhase5Metadata=Object.freeze(['isFinite','isNaN','isInteger','isSafeInteger'].map((name,i)=>Object.freeze({owner:'Number',name,id:1600+i,length:1,field:'number'+name[0].toUpperCase()+name.slice(1)})));
export const mathPhase5Metadata=Object.freeze(['abs','sign','floor','ceil','trunc','round','min','max','pow'].map((name,i)=>Object.freeze({owner:'Math',name,id:1610+i,length:['min','max','pow'].includes(name)?2:1,field:'math'+name[0].toUpperCase()+name.slice(1)})));
export const numericPhase5Metadata=Object.freeze([...numberPhase5Metadata,...mathPhase5Metadata]);
// Literal constants, not host Math results. All descriptors W:false E:false C:false.
export const numberPhase5Constants=Object.freeze({EPSILON:2.220446049250313e-16,MAX_SAFE_INTEGER:9007199254740991,MIN_SAFE_INTEGER:-9007199254740991,MAX_VALUE:1.7976931348623157e308,MIN_VALUE:5e-324,NaN:NaN,NEGATIVE_INFINITY:-Infinity,POSITIVE_INFINITY:Infinity});
export const mathPhase5Constants=Object.freeze({E:2.718281828459045,LN10:2.302585092994046,LN2:0.6931471805599453,LOG10E:0.4342944819032518,LOG2E:1.4426950408889634,PI:3.141592653589793,SQRT1_2:0.7071067811865476,SQRT2:1.4142135623730951});
export const mathPhase5Pending=Object.freeze(['acos','acosh','asin','asinh','atan','atanh','atan2','cbrt','clz32','cos','cosh','exp','expm1','f16round','fround','hypot','imul','log','log1p','log2','log10','random','sin','sinh','sqrt','tan','tanh']);
export const numberPhase5Pending=Object.freeze([]);
