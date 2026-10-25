import { DEFAULT_SOLVENTS, loadSolvents, saveSolvents } from "./solvents.js";
import { WATER_DENSITY, validatePositive, phaseOrder, extractionStep, percent, clamp } from "./chemistry.js";
import { initialState } from "./separator.js";

const $ = id => document.getElementById(id);
const els = {
  status:$("status"),message:$("message"),mode:$("mode"),oilType:$("oilType"),mixVol:$("mixVol"),oilPct:$("oilPct"),solventSelect:$("solventSelect"),solventVol:$("solventVol"),partitionK:$("partitionK"),
  upperLiquid:$("upperLiquid"),lowerLiquid:$("lowerLiquid"),interface:$("interface"),upperLabel:$("upperLabel"),lowerLabel:$("lowerLabel"),waterVolSvg:$("waterVolSvg"),organicVolSvg:$("organicVolSvg"),waterCollected:$("waterCollected"),organicCollected:$("organicCollected"),stream:$("stream"),funnelGroup:$("funnelGroup"),stopcockHandle:$("stopcockHandle"),droplets:$("droplets"),shakeBadge:$("shakeBadge"),
  waterMetric:$("waterMetric"),oilMetric:$("oilMetric"),densityMetric:$("densityMetric"),topPhaseName:$("topPhaseName"),bottomPhaseName:$("bottomPhaseName"),topPhaseDetail:$("topPhaseDetail"),bottomPhaseDetail:$("bottomPhaseDetail"),densityExplanation:$("densityExplanation"),steps:$("steps"),
  results:$("results"),yieldResult:$("yieldResult"),extractedResult:$("extractedResult"),remainingResult:$("remainingResult"),countResult:$("countResult"),historyBody:$("historyBody"),yieldChart:$("yieldChart")
};
let solvents=loadSolvents(), state=null, settings=null, settleTimer=null, shakeTimer=null, streamTimer=null;
const fmt=(n,d=2)=>Number(n).toLocaleString("vi-VN",{minimumFractionDigits:d,maximumFractionDigits:d});
function chosenSolvent(){return solvents.find(s=>s.id===els.solventSelect.value)||solvents[0];}
function setMessage(text,type=""){els.message.textContent=text;els.message.className="message"+(type?" "+type:"");}
function setStatus(text,active=false){els.status.textContent=text;els.status.className="status"+(active?" active":"");}
function readSettings(){
  const mixVol=validatePositive(els.mixVol.value,"Thể tích hỗn hợp",{min:10,max:500});
  const oilPct=validatePositive(els.oilPct.value,"Tỷ lệ tinh dầu",{min:.1,max:30});
  const solventVol=validatePositive(els.solventVol.value,"Thể tích dung môi",{min:1,max:200});
  const K=validatePositive(els.partitionK.value,"Hệ số phân bố K",{min:.01,max:1000});
  return {mixVol,oilPct,solventVol,K,oilType:els.oilType.value};
}
function populateSolvents(selected){
  const current=selected||els.solventSelect.value;
  els.solventSelect.innerHTML="";
  solvents.forEach(s=>{const o=document.createElement("option");o.value=s.id;o.textContent=s.name;els.solventSelect.append(o);});
  els.solventSelect.value=solvents.some(s=>s.id===current)?current:solvents[0].id;
  updateSolventFields();
}
function updateSolventFields(){
  const s=chosenSolvent(); if(!s)return;
  els.densityMetric.textContent=`${fmt(s.density,2)} g/mL`;
  els.solventVol.value=s.volume||25;
  if(Number.isFinite(s.k))els.partitionK.value=s.k;
  updatePhaseInfo();
}
function updatePhaseInfo(){
  const s=chosenSolvent();if(!s)return;
  const order=phaseOrder(WATER_DENSITY,s.density);
  const names={water:"Pha nước",organic:`Pha hữu cơ (${s.name})`};
  els.topPhaseName.textContent=names[order.top];els.bottomPhaseName.textContent=names[order.bottom];
  const densities={water:WATER_DENSITY,organic:s.density};
  els.topPhaseDetail.textContent=`ρ = ${fmt(densities[order.top],2)} g/mL · lớp trên`;
  els.bottomPhaseDetail.textContent=`ρ = ${fmt(densities[order.bottom],2)} g/mL · lớp dưới`;
  els.densityExplanation.textContent=order.explanation+(s.miscibility==="miscible"?" Dung môi được khai báo trộn lẫn hoàn toàn với nước: không nên diễn giải hai lớp này như hệ hai pha thực.":"");
  renderFunnel();
}
function updateMetrics(){
  if(!state)return;
  els.waterMetric.textContent=`${fmt(state.waterVolume,1)} mL`;
  els.oilMetric.textContent=`${fmt(state.oilInitial,2)} mL`;
}
function renderFunnel(){
  const s=chosenSolvent();if(!s)return;
  const order=phaseOrder(WATER_DENSITY,s.density);
  const oilColor=s.color||"#e7ad45";
  const organicY=order.top==="organic"?92:190;
  const waterY=order.top==="water"?92:190;
  els.upperLiquid.setAttribute("y",organicY);els.lowerLiquid.setAttribute("y",waterY);
  els.upperLiquid.setAttribute("fill",order.top==="organic"?oilColor:"#279fd6");
  els.lowerLiquid.setAttribute("fill",order.bottom==="organic"?oilColor:"#279fd6");
  els.interface.setAttribute("d",`M270 ${190} H450`);
  els.upperLabel.setAttribute("y",order.top==="organic"?133:133);
  els.lowerLabel.setAttribute("y",225);
  els.upperLabel.textContent=order.top==="organic"?"Pha hữu cơ": "Pha nước";
  els.lowerLabel.textContent=order.bottom==="organic"?"Pha hữu cơ":"Pha nước";
  els.upperLabel.setAttribute("fill",order.top==="organic"?"#573b12":"#073b58");
  els.lowerLabel.setAttribute("fill",order.bottom==="organic"?"#573b12":"#073b58");
  if(state){
    const total=Math.max(1,state.waterVolume+state.oilRemaining+(state.organicPhaseVolume||0));
    const topHeight=clamp(200*(order.top==="organic"?(state.organicPhaseVolume||settings.solventVol):state.waterVolume)/total,28,110);
    // Graphic remains schematic; adjust the visible interface with phase volumes.
    const y=clamp(92+topHeight,125,218);
    els.interface.setAttribute("d",`M276 ${y} H444`);
    els.upperLiquid.setAttribute("height",y-90);els.lowerLiquid.setAttribute("y",y);els.lowerLiquid.setAttribute("height",290-y);
  }
  els.waterVolSvg.textContent=`${fmt(state?.waterCollected||0,1)} mL`;
  els.organicVolSvg.textContent=`${fmt(state?.organicCollected||0,1)} mL`;
  const hW=clamp((state?.waterCollected||0)/Math.max(1,settings?.mixVol||100)*28,0,28);
  const hO=clamp((state?.organicCollected||0)/Math.max(1,settings?.mixVol||100)*28,0,28);
  els.waterCollected.setAttribute("d",`M204 ${457-hW} H283 V450 Q283 457 274 457 H213 Q204 457 204 450 Z`);
  els.organicCollected.setAttribute("d",`M434 ${457-hO} H513 V450 Q513 457 504 457 H443 Q434 457 434 450 Z`);
}
function renderSteps(){
  const steps=[["Chuẩn bị hỗn hợp và chọn dung môi.",["idle"]],["Lắc phễu để tăng tiếp xúc giữa các pha.",["ready","shaken"]],["Để yên cho hai pha phân lớp.",["settled"]],["Mở khóa, thu pha dưới rồi đóng khóa đúng lúc.",["draining","separated"]],["Phân tích hiệu suất và so sánh các lần chiết.",["complete"]]];
  els.steps.innerHTML="";
  let activeIndex=state?.stage==="idle"?0:state?.stage==="ready"?1:state?.stage==="shaken"?2:state?.stage==="settled"?3:state?.stage==="draining"?3:state?.stage==="separated"?4:4;
  steps.forEach((x,i)=>{const li=document.createElement("li");li.textContent=x[0];if(i<activeIndex)li.className="done";else if(i===activeIndex)li.className="active";els.steps.append(li);});
}
function renderResults(){
  const extracted=Math.max(0,state.oilInitial-state.oilRemaining);
  els.yieldResult.textContent=`${fmt(percent(extracted,state.oilInitial),1)}%`;
  els.extractedResult.textContent=`${fmt(extracted)} mL`;els.remainingResult.textContent=`${fmt(state.oilRemaining)} mL`;els.countResult.textContent=state.extractions.length;
  if(!state.extractions.length){els.historyBody.innerHTML='<tr><td colspan="5">Chưa có lần chiết hoàn tất.</td></tr>';els.yieldChart.innerHTML="";return;}
  els.historyBody.innerHTML=state.extractions.map(e=>`<tr><td>${e.n}</td><td>${escapeHtml(e.solvent)}</td><td>${fmt(e.volume,1)} mL</td><td>${fmt(e.remaining)} mL</td><td>${fmt(e.yield,1)}%</td></tr>`).join("");
  els.yieldChart.innerHTML=state.extractions.map(e=>`<div class="chart-bar"><div class="bar" style="--h:${clamp(e.yield,2,100)}px"></div>Lần ${e.n}<b>${fmt(e.yield,1)}%</b></div>`).join("");
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function updateButtons(){
  const stage=state?.stage;
  $("shakeBtn").disabled=!["ready","shaken"].includes(stage);
  $("settleBtn").disabled=!["shaken","ready"].includes(stage);
  $("openBtn").disabled=!["settled","draining"].includes(stage)||state.valveOpen;
  $("closeBtn").disabled=!state?.valveOpen;
  $("nextPhaseBtn").disabled=!["separated","settled"].includes(stage);
  $("nextExtractionBtn").disabled=!["separated","complete"].includes(stage)||state.oilRemaining<0.005;
}
function sync(){updateMetrics();renderFunnel();renderSteps();updateButtons();}
function startExperiment(){
  try{
    settings=readSettings();const s=chosenSolvent();
    if(s.miscibility==="miscible"){setMessage("Dung môi này được khai báo trộn lẫn hoàn toàn với nước. Mô hình không thể coi đây là phép chiết lỏng–lỏng hai pha; hãy chọn dung môi khác hoặc đổi dữ liệu cấu hình.","error");return;}
    state=initialState(settings);state.stage="ready";state.currentSolvent=s.id;state.organicPhaseVolume=settings.solventVol;
    setStatus("Sẵn sàng",true);setMessage(`Đã chuẩn bị ${fmt(state.waterVolume,1)} mL pha nước và ${fmt(state.oilInitial,2)} mL tinh dầu mô phỏng. Chọn “Lắc phễu” để tiếp tục.`,"success");
    els.results.classList.add("hidden");sync();
  }catch(e){setMessage(e.message,"error");}
}
function shake(){
  if(!state||!["ready","shaken"].includes(state.stage))return;
  clearTimeout(shakeTimer);state.stage="shaken";state.droplets=true;els.droplets.innerHTML="";
  for(let i=0;i<18;i++){const c=document.createElementNS("http://www.w3.org/2000/svg","circle");c.setAttribute("cx",290+Math.random()*140);c.setAttribute("cy",115+Math.random()*115);c.setAttribute("r",2+Math.random()*3);c.setAttribute("fill",i%2?"#b9efff":"#ffd68b");c.setAttribute("opacity",".9");els.droplets.append(c);}
  els.shakeBadge.setAttribute("opacity","1");els.funnelGroup.style.transformOrigin="360px 200px";els.funnelGroup.style.animation="shake .45s ease-in-out 4";
  setStatus("Đang lắc",true);setMessage("Các giọt pha phân tán, tăng diện tích tiếp xúc. Trong thí nghiệm thật, phải xả áp theo quy trình an toàn và không lắc dung môi dễ bay hơi tùy tiện.");
  shakeTimer=setTimeout(()=>{els.funnelGroup.style.animation="";els.shakeBadge.setAttribute("opacity","0");state.droplets=false;state.stage="shaken";setStatus("Đã lắc · chờ phân lớp",true);setMessage("Đã kết thúc mô phỏng thao tác lắc. Nhấn “Để yên & phân lớp” để quan sát hai pha tách ra.");updateButtons();},1900);
  updateButtons();
}
function settle(){
  if(!state||!["shaken","ready"].includes(state.stage))return;
  state.stage="settled";state.droplets=false;els.droplets.innerHTML="";setStatus("Đã phân lớp",true);
  const s=chosenSolvent();const order=phaseOrder(WATER_DENSITY,s.density);
  setMessage(order.explanation+(order.close?" Hai pha gần khối lượng riêng nên hãy quan sát mặt phân cách cẩn thận.":"")+" Có thể mở khóa để bắt đầu thu pha nằm dưới.");
  sync();
}
function openValve(){
  if(!state||!["settled","draining"].includes(state.stage)||state.valveOpen)return;
  state.valveOpen=true;state.stage="draining";els.stopcockHandle.setAttribute("d","M348 328 H372");els.stream.setAttribute("opacity",".9");setStatus("Đang xả",true);
  const order=phaseOrder(WATER_DENSITY,chosenSolvent().density);
  state.selectedPhase=order.bottom;
  const isWater=order.bottom==="water";
  setMessage(`Đang thu ${isWater?"pha nước":"pha hữu cơ"} (lớp dưới). Đóng khóa trước khi mặt phân cách đi qua để tránh lẫn pha.`);
  clearInterval(streamTimer);
  streamTimer=setInterval(()=>{
    if(!state?.valveOpen){clearInterval(streamTimer);return;}
    const delta=Math.min(1.2,isWater?state.waterVolume:state.organicPhaseVolume||0);
    if(delta<=0){closeValve();setMessage("Pha dưới đã được thu hết. Đóng khóa và chọn “Thu pha tiếp theo” nếu muốn thu lớp còn lại.");return;}
    if(isWater){state.waterVolume=Math.max(0,state.waterVolume-delta);state.waterCollected+=delta;}
    else{state.organicPhaseVolume=Math.max(0,state.organicPhaseVolume-delta);state.organicCollected+=delta;}
    renderFunnel();updateMetrics();
    if((isWater?state.waterVolume:state.organicPhaseVolume)<=0.05){closeValve();setMessage("Đã gần thu hết pha dưới. Khóa đã đóng để hạn chế pha kế tiếp đi qua.");}
  },90);
  updateButtons();
}
function closeValve(){
  if(!state)return;state.valveOpen=false;clearInterval(streamTimer);els.stopcockHandle.setAttribute("d","M360 316 V340");els.stream.setAttribute("opacity","0");
  if(state.stage==="draining")state.stage="separated";setStatus(state.stage==="separated"?"Đã thu pha dưới":"Đã đóng khóa",true);sync();
}
function collectNext(){
  if(!state||!["separated","settled"].includes(state.stage))return;
  if(state.valveOpen){setMessage("Hãy đóng khóa trước khi chuyển thao tác.","error");return;}
  const order=phaseOrder(WATER_DENSITY,chosenSolvent().density);
  if(order.bottom==="water"&&state.waterVolume>0.05){
    setMessage("Pha nước ở dưới chưa được thu hết. Mở khóa, thu pha dưới trước rồi đóng khóa.","error");return;
  }
  if(order.bottom==="organic"&&(state.organicPhaseVolume||0)>0.05){
    setMessage("Pha hữu cơ ở dưới chưa được thu hết. Mở khóa, thu pha dưới trước rồi đóng khóa.","error");return;
  }
  // Remaining upper layer is collected into its corresponding receiver.
  if(state.waterVolume>0){state.waterCollected+=state.waterVolume;state.waterVolume=0;}
  if((state.organicPhaseVolume||0)>0){state.organicCollected+=state.organicPhaseVolume;state.organicPhaseVolume=0;}
  state.stage="complete";setStatus("Đã tách xong",true);setMessage("Đã mô phỏng thu hai pha. Xem kết quả để kiểm tra lượng tinh dầu chuyển pha và hiệu suất chiết.","success");sync();renderResults();
}
function nextExtraction(){
  if(!state||!["separated","complete"].includes(state.stage)||state.oilRemaining<.005)return;
  try{
    const s=chosenSolvent(),settingsNow=readSettings();
    if(s.miscibility==="miscible")throw new Error("Dung môi trộn lẫn hoàn toàn với nước không phù hợp với mô hình chiết hai pha này.");
    const before=state.oilRemaining;
    const result=extractionStep(before,Math.max(0.1,state.waterVolume||settings.mixVol*(1-settings.oilPct/100)),settingsNow.solventVol,settingsNow.K);
    state.oilRemaining=result.remaining;
    state.organicPhaseVolume=settingsNow.solventVol;
    state.waterVolume=Math.max(0.1,state.waterVolume||settings.mixVol*(1-settings.oilPct/100));
    state.stage="ready";state.valveOpen=false;state.currentSolvent=s.id;
    state.extractions.push({n:state.extractions.length+1,solvent:s.name,volume:settingsNow.solventVol,remaining:state.oilRemaining,yield:percent(state.oilInitial-state.oilRemaining,state.oilInitial)});
    setStatus(`Lần chiết ${state.extractions.length} · sẵn sàng`,true);
    setMessage(`Mô hình phân bố dự đoán ${fmt(result.extracted)} mL tinh dầu chuyển sang pha hữu cơ ở lần này; còn ${fmt(state.oilRemaining)} mL trong pha nước. Nhấn “Lắc phễu”, phân lớp rồi thu pha.`);
    els.results.classList.remove("hidden");sync();renderResults();
  }catch(e){setMessage(e.message,"error");}
}
function reset(){
  clearTimeout(shakeTimer);clearInterval(streamTimer);if(state?.valveOpen)closeValve();
  state=null;settings=null;els.results.classList.add("hidden");els.droplets.innerHTML="";els.funnelGroup.style.animation="";els.shakeBadge.setAttribute("opacity","0");setStatus("Chưa bắt đầu");setMessage("Chọn hỗn hợp và nhấn “Bắt đầu thí nghiệm”.");
  els.waterCollected.setAttribute("d","M204 430 H283 V450 Q283 457 274 457 H213 Q204 457 204 450 Z");els.organicCollected.setAttribute("d","M434 430 H513 V450 Q513 457 504 457 H443 Q434 457 434 450 Z");
  renderFunnel();renderSteps();updateButtons();els.waterMetric.textContent="—";els.oilMetric.textContent="—";
}
function addSolvent(){
  const name=$("newName").value.trim(),density=Number($("newDensity").value),miscibility=$("newMiscibility").value,volume=Number($("newVol").value),kRaw=$("newK").value.trim();
  if(!name){setMessage("Hãy nhập tên dung môi.","error");return;}
  if(!Number.isFinite(density)||density<=0||density>5){setMessage("Khối lượng riêng phải lớn hơn 0 và không vượt quá 5 g/mL.","error");return;}
  if(!Number.isFinite(volume)||volume<1||volume>200){setMessage("Thể tích mặc định phải từ 1 đến 200 mL.","error");return;}
  const k=kRaw===""?null:Number(kRaw);if(kRaw!==""&&(!Number.isFinite(k)||k<=0||k>1000)){setMessage("K phải lớn hơn 0 và không vượt quá 1000, hoặc để trống nếu chưa có dữ liệu.","error");return;}
  const item={id:`custom-${Date.now()}`,name,density,k,miscibility,color:$("newColor").value,volume,note:$("newNote").value.trim()||"Do người dùng nhập; chưa xác minh.",sourceType:"người dùng"};
  solvents.push(item);saveSolvents(solvents);populateSolvents(item.id);if(k!==null)els.partitionK.value=k;$("addSolventForm").classList.add("hidden");setMessage(`Đã thêm “${name}”. ${k===null?"Chưa có K nên cần nhập hệ số phân bố trước khi tính hiệu suất.":"Thông số K được lưu dưới dạng dữ liệu do người dùng cung cấp."}`,"success");
}
function bind(){
  $("startBtn").addEventListener("click",startExperiment);$("shakeBtn").addEventListener("click",shake);$("settleBtn").addEventListener("click",settle);$("openBtn").addEventListener("click",openValve);$("closeBtn").addEventListener("click",closeValve);$("nextPhaseBtn").addEventListener("click",collectNext);$("nextExtractionBtn").addEventListener("click",nextExtraction);$("resetBtn").addEventListener("click",reset);
  $("resultBtn").addEventListener("click",()=>{if(!state){setMessage("Hãy bắt đầu thí nghiệm trước.","error");return;}els.results.classList.remove("hidden");renderResults();els.results.scrollIntoView({behavior:"smooth",block:"start"});});
  $("hideResultBtn").addEventListener("click",()=>els.results.classList.add("hidden"));
  $("addSolventBtn").addEventListener("click",()=>$("addSolventForm").classList.toggle("hidden"));$("cancelSolventBtn").addEventListener("click",()=>$("addSolventForm").classList.add("hidden"));$("saveSolventBtn").addEventListener("click",addSolvent);
  els.solventSelect.addEventListener("change",()=>{updateSolventFields();if(state&&state.stage!=="idle")setMessage("Đã đổi dung môi. Nếu thí nghiệm đang diễn ra, hãy kiểm tra lại giả định và bắt đầu lần chiết mới để dùng bộ thông số mới.");});
  [els.mixVol,els.oilPct].forEach(el=>el.addEventListener("change",()=>{if(state){setMessage("Thông số hỗn hợp đã thay đổi. Đặt lại và bắt đầu lại để áp dụng nhất quán.","error");return;}try{const s=readSettings();els.waterMetric.textContent=`${fmt(s.mixVol*(1-s.oilPct/100),1)} mL`;els.oilMetric.textContent=`${fmt(s.mixVol*s.oilPct/100)} mL`;}catch(e){setMessage(e.message,"error");}}));
  $("partitionK").addEventListener("change",()=>{if(state)setMessage("K đã thay đổi. Giá trị mới sẽ được dùng cho lần chiết tiếp theo.");});
  $("solventVol").addEventListener("change",()=>{if(state)setMessage("Thể tích dung môi đã thay đổi; giá trị mới áp dụng cho lần chiết tiếp theo.");});
  $("stopcock").addEventListener("click",()=>state?.valveOpen?closeValve():openValve());
  $("stopcock").addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();state?.valveOpen?closeValve():openValve();}});
  els.mode.addEventListener("change",()=>{setMessage(els.mode.value==="guided"?"Chế độ có hướng dẫn: thực hiện theo thứ tự chuẩn bị → lắc → phân lớp → thu pha.":"Chế độ tự do: bạn có thể thử đổi thông số và dung môi; các thao tác không hợp lệ vẫn được chặn để giữ trạng thái nhất quán.");});
}
function init(){
  populateSolvents("hexane");bind();els.waterMetric.textContent="95 mL";els.oilMetric.textContent="5,00 mL";updatePhaseInfo();renderFunnel();renderSteps();updateButtons();
  if(!solvents.some(s=>s.id==="hexane")){} // Keep configuration extensible.
}
init();
