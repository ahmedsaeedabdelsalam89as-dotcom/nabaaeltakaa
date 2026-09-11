(function(g){"use strict";
const CURRENT="1.3.0";
function parse(v){return String(v||"0.0.0").split(".").map(x=>parseInt(x,10)||0)}
function compatible(v){let a=parse(v),b=parse(CURRENT);return a[0]===b[0]&&a[1]<=b[1]}
function assertCompatible(v){if(!compatible(v))throw new Error("NABA_SCHEMA_INCOMPATIBLE:"+v+"->"+CURRENT);return true}
g.NABA_SCHEMA={current:CURRENT,compatible,assertCompatible};
})(window);