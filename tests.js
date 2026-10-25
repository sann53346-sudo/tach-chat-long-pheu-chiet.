import { phaseOrder, remainingAfterExtraction, extractionStep } from "./chemistry.js";
import { DEFAULT_SOLVENTS } from "./solvents.js";

const tests=[];
function test(name,fn){tests.push({name,fn});}
function equal(actual,expected,msg=""){if(actual!==expected)throw new Error(`${msg} expected ${expected}, got ${actual}`);}
function near(actual,expected,eps=1e-8){if(Math.abs(actual-expected)>eps)throw new Error(`expected ${expected}, got ${actual}`);}
test("Nước–hexane: hexane ở trên",()=>equal(phaseOrder(1,.66).top,"organic"));
test("Đảo khối lượng riêng thì thứ tự lớp đảo",()=>equal(phaseOrder(1,1.2).top,"water"));
test("Chiết làm giảm lượng tinh dầu còn lại",()=>{const r=extractionStep(5,95,25,8);if(!(r.remaining<5&&r.remaining>0))throw new Error("remaining out of range");});
test("Công thức phân bố lý tưởng",()=>near(remainingAfterExtraction(5,95,25,8),5*95/(95+8*25)));
test("Có bộ dung môi mặc định",()=>{if(!DEFAULT_SOLVENTS.some(s=>s.id==="hexane"))throw new Error("hexane missing");});
let failed=0;for(const t of tests){try{t.fn();console.log("PASS",t.name);}catch(e){failed++;console.error("FAIL",t.name,e);}}
console.log(`${tests.length-failed}/${tests.length} tests passed`);
if(failed)throw new Error(`${failed} test(s) failed`);
