import { phaseOrder, remainingAfterExtraction, extractionStep } from "./chemistry.js";
import { DEFAULT_SOLVENTS } from "./solvents.js";
import { initialState, transferAmount, volumeBalance } from "./separator.js";

const tests=[];
function test(name,fn){tests.push({name,fn});}
function equal(actual,expected,msg=""){if(actual!==expected)throw new Error((msg?msg+": ":"")+"expected "+expected+", got "+actual);}
function near(actual,expected,eps=1e-8){if(Math.abs(actual-expected)>eps)throw new Error("expected "+expected+", got "+actual);}

test("Nước–hexane: hexane ở trên",()=>equal(phaseOrder(1,.66).top,"organic"));
test("Đảo khối lượng riêng thì thứ tự lớp đảo",()=>equal(phaseOrder(1,1.2).top,"water"));
test("Chiết làm giảm lượng tinh dầu còn lại",()=>{const r=extractionStep(5,95,25,8);if(!(r.remaining<5&&r.remaining>0))throw new Error("remaining out of range");});
test("Công thức phân bố lý tưởng",()=>near(remainingAfterExtraction(5,95,25,8),5*95/(95+8*25)));
test("Có bộ dung môi mặc định",()=>{if(!DEFAULT_SOLVENTS.some(s=>s.id==="hexane"))throw new Error("hexane missing");});
test("Lưu lượng phụ thuộc thời gian thực",()=>near(transferAmount(100,24,.05),1.2));
test("Bước chuyển không vượt thể tích còn lại",()=>near(transferAmount(.4,24,.05),.4));
test("Không chuyển chất lỏng khi thời gian bằng 0",()=>equal(transferAmount(12,24,0),0));
test("Cân bằng thể tích tính cả lượng đang chảy",()=>near(volumeBalance({remaining:40,collected:50,inStream:5,added:95}),0));
test("Trạng thái ban đầu bảo toàn pha nước",()=>{const s=initialState({mixVol:100,oilPct:5});near(volumeBalance({remaining:s.waterVolume,collected:s.waterCollected,inStream:s.waterInStream,added:s.waterAddedVolume}),0);});
let failed=0;
for(const t of tests){try{t.fn();console.log("PASS",t.name);}catch(e){failed++;console.error("FAIL",t.name,e);}}
console.log((tests.length-failed)+"/"+tests.length+" tests passed");
if(failed)throw new Error(failed+" test(s) failed");
