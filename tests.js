import { phaseOrder, remainingAfterExtraction, extractionStep } from "./chemistry.js";
import { DEFAULT_SOLVENTS } from "./solvents.js";
import { initialState, transferAmount, volumeBalance, advanceFlowStep } from "./separator.js";

const tests=[];
function test(name,fn){tests.push({name,fn});}
function equal(actual,expected,msg=""){if(actual!==expected)throw new Error((msg?msg+": ":"")+"expected "+expected+", got "+actual);}
function near(actual,expected,eps=1e-8){if(Math.abs(actual-expected)>eps)throw new Error("expected "+expected+", got "+actual);}
function assertBalanced(s,eps=1e-5){
  near(volumeBalance({remaining:s.waterVolume,collected:s.waterCollected,inStream:s.waterInStream,added:s.waterAddedVolume}),0,eps);
  near(volumeBalance({remaining:s.organicPhaseVolume,collected:s.organicCollected,inStream:s.organicInStream,added:s.organicAddedVolume}),0,eps);
}
function runFrames(s,condition,maxFrames=1000){
  let frames=0;
  while(condition()&&frames<maxFrames){advanceFlowStep(s,.05);assertBalanced(s);frames++;}
  if(condition())throw new Error("flow did not finish in "+maxFrames+" frames");
}

test("Nước–hexane: hexane ở trên",()=>equal(phaseOrder(1,.66).top,"organic"));
test("Đảo khối lượng riêng thì thứ tự lớp đảo",()=>equal(phaseOrder(1,1.2).top,"water"));
test("Chiết làm giảm lượng tinh dầu còn lại",()=>{const r=extractionStep(5,95,25,8);if(!(r.remaining<5&&r.remaining>0))throw new Error("remaining out of range");});
test("Công thức phân bố lý tưởng",()=>near(remainingAfterExtraction(5,95,25,8),5*95/(95+8*25)));
test("Có bộ dung môi mặc định",()=>{if(!DEFAULT_SOLVENTS.some(s=>s.id==="hexane"))throw new Error("hexane missing");});
test("Lưu lượng phụ thuộc thời gian thực",()=>near(transferAmount(100,24,.05),1.2));
test("Bước chuyển không vượt thể tích còn lại",()=>near(transferAmount(.4,24,.05),.4));
test("Không chuyển chất lỏng khi thời gian bằng 0",()=>equal(transferAmount(12,24,0),0));
test("Cân bằng thể tích tính cả lượng đang chảy",()=>near(volumeBalance({remaining:40,collected:50,inStream:5,added:95}),0));
test("Trạng thái ban đầu bảo toàn pha nước",()=>{const s=initialState({mixVol:100,oilPct:5});assertBalanced(s);});
test("Đóng khóa tạm dừng và mở lại tiếp tục từ thể tích còn lại",()=>{
  const s=initialState({mixVol:100,oilPct:5});
  s.organicPhaseVolume=25;s.organicAddedVolume=25;s.cycleInitialTotal=120;
  s.stage="lower-partial";s.valveOpen=true;s.selectedPhase="water";s.activeFlowPhase="water";
  for(let i=0;i<4;i++){advanceFlowStep(s,.05);assertBalanced(s);}
  const afterFirstRun=s.waterVolume;
  if(!(afterFirstRun<s.waterAddedVolume))throw new Error("opening valve did not lower funnel volume");
  s.valveOpen=false;s.stage="lower-partial";
  for(let i=0;i<6;i++){advanceFlowStep(s,.05);assertBalanced(s);}
  near(s.waterVolume,afterFirstRun);
  s.valveOpen=true;s.stage="lower-partial";
  runFrames(s,()=>s.stage==="lower-partial"||s.parcels.length>0);
  near(s.waterVolume,0,1e-7);
  if(!s.valveOpen||s.stage!=="lower-drained")throw new Error("valve should remain open at the phase boundary until explicitly closed");
  s.valveOpen=false;s.stage="lower-pending";
  runFrames(s,()=>s.parcels.length>0);
  near(s.waterCollected,s.waterAddedVolume,1e-5);
  assertBalanced(s);
});
test("Thu pha dưới và rót pha trên vào hai cốc riêng",()=>{
  const s=initialState({mixVol:100,oilPct:5});
  s.organicPhaseVolume=25;s.organicAddedVolume=25;s.cycleInitialTotal=120;
  s.stage="lower-partial";s.valveOpen=true;s.selectedPhase="water";s.activeFlowPhase="water";
  runFrames(s,()=>s.stage==="lower-partial"||s.parcels.length>0);
  near(s.waterVolume,0,1e-7);
  if(!s.valveOpen||s.stage!=="lower-drained")throw new Error("lower phase must stop at the interface with valve awaiting explicit close");
  s.valveOpen=false;s.stage="lower-pending";
  runFrames(s,()=>s.parcels.length>0);
  near(s.waterCollected,95,1e-5);
  s.stage="collecting-upper";s.valveOpen=false;s.upperPouring=true;s.selectedPhase="organic";s.activeFlowPhase="organic";
  runFrames(s,()=>s.upperPouring||s.parcels.length>0);
  near(s.organicPhaseVolume,0,1e-7);near(s.organicCollected,25,1e-5);
  assertBalanced(s);
});
let failed=0;
for(const t of tests){try{t.fn();console.log("PASS",t.name);}catch(e){failed++;console.error("FAIL",t.name,e);}}
console.log((tests.length-failed)+"/"+tests.length+" tests passed");
if(failed)throw new Error(failed+" test(s) failed");
