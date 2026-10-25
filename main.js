import { DEFAULT_SOLVENTS, loadSolvents, saveSolvents } from "./solvents.js";
import { WATER_DENSITY, validatePositive, phaseOrder, extractionStep, percent, clamp } from "./chemistry.js";
import { initialState, advanceFlowStep, volumeBalance } from "./separator.js";

const $ = id => document.getElementById(id);
const els = {
  status:$("status"),message:$("message"),mode:$("mode"),oilType:$("oilType"),mixVol:$("mixVol"),oilPct:$("oilPct"),solventSelect:$("solventSelect"),solventVol:$("solventVol"),partitionK:$("partitionK"),
  upperLiquid:$("upperLiquid"),lowerLiquid:$("lowerLiquid"),interface:$("interface"),upperLabel:$("upperLabel"),lowerLabel:$("lowerLabel"),waterVolSvg:$("waterVolSvg"),organicVolSvg:$("organicVolSvg"),waterCollected:$("waterCollected"),organicCollected:$("organicCollected"),stream:$("stream"),topStream:$("topStream"),funnelGroup:$("funnelGroup"),clamp:$("clamp"),stopcockHandle:$("stopcockHandle"),droplets:$("droplets"),shakeBadge:$("shakeBadge"),beakerWater:$("beakerWater"),beakerOrganic:$("beakerOrganic"),waterCupLabel:$("waterCupLabel"),organicCupLabel:$("organicCupLabel"),
  waterMetric:$("waterMetric"),oilMetric:$("oilMetric"),densityMetric:$("densityMetric"),topPhaseName:$("topPhaseName"),bottomPhaseName:$("bottomPhaseName"),topPhaseDetail:$("topPhaseDetail"),bottomPhaseDetail:$("bottomPhaseDetail"),densityExplanation:$("densityExplanation"),steps:$("steps"),
  results:$("results"),yieldResult:$("yieldResult"),extractedResult:$("extractedResult"),remainingResult:$("remainingResult"),countResult:$("countResult"),historyBody:$("historyBody"),yieldChart:$("yieldChart")
};
let solvents=loadSolvents(), state=null, settings=null, shakeTimer=null, animationFrameId=null, previousFrameTime=null;
const fmt=(n,d=2)=>Number(n).toLocaleString("vi-VN",{minimumFractionDigits:d,maximumFractionDigits:d});
function chosenSolvent(){return solvents.find(s=>s.id===els.solventSelect.value)||solvents[0];}
function currentSolvent(){return state&&state.stage!=="complete"?(solvents.find(s=>s.id===state.currentSolvent)||chosenSolvent()):chosenSolvent();}
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
  els.waterMetric.textContent=fmt(state.waterVolume,1)+" mL";
  els.oilMetric.textContent=fmt(state.oilInitial,2)+" mL";
}
function phaseOrderForState(){return phaseOrder(WATER_DENSITY,currentSolvent().density);}
function phaseVolume(phase){return phase==="water"?state.waterVolume:state.organicPhaseVolume;}
function setPhaseVolume(phase,value){if(phase==="water")state.waterVolume=Math.max(0,value);else state.organicPhaseVolume=Math.max(0,value);}

function collectedVolume(phase){return phase==="water"?state.waterCollected:state.organicCollected;}
function parcelExistsFor(phase){return state.parcels.some(p=>p.phase===phase);}
function assertVolumeBalance(){
  if(!state)return;
  state.waterBalanceError=volumeBalance({remaining:state.waterVolume,collected:state.waterCollected,inStream:state.waterInStream,added:state.waterAddedVolume});
  state.organicBalanceError=volumeBalance({remaining:state.organicPhaseVolume,collected:state.organicCollected,inStream:state.organicInStream,added:state.organicAddedVolume});
  if(Math.abs(state.waterBalanceError)>1e-5||Math.abs(state.organicBalanceError)>1e-5)console.error("Volume balance drift",state.waterBalanceError,state.organicBalanceError);
}
function cupHeight(volume,totalAdded){return clamp((volume/Math.max(100,totalAdded*1.1))*62,0,62);}
function cupFillPath(left,right,height){
  if(height<=0.001)return "M"+left+" 457";
  const y=457-height;
  return "M"+(left+4)+" "+y+" H"+(right-4)+" V450 Q"+(right-4)+" 457 "+(right-13)+" 457 H"+(left+13)+" Q"+(left+4)+" 457 "+(left+4)+" 450 Z";
}
function renderReceivers(){
  const active=state&&state.stage!=="complete"&&state.selectedPhase?state.selectedPhase:null;
  if(active==="water"){
    els.beakerWater.setAttribute("transform","translate(117 0)");
    els.beakerOrganic.setAttribute("transform","translate(80 0)");
  }else if(active==="organic"){
    els.beakerOrganic.setAttribute("transform","translate(-113 0)");
    els.beakerWater.setAttribute("transform","translate(-88 0)");
  }else{
    els.beakerWater.removeAttribute("transform");
    els.beakerOrganic.removeAttribute("transform");
  }
  const solvent=currentSolvent();
  els.waterCupLabel.textContent="Cốc pha nước";
  els.organicCupLabel.textContent="Cốc pha hữu cơ"+(solvent?" · "+solvent.name:"");
}
function renderFunnel(){
  const solvent=currentSolvent();if(!solvent)return;
  const order=phaseOrder(WATER_DENSITY,solvent.density);
  const topVolume=order.top==="water"?(state?.waterVolume||0):(state?.organicPhaseVolume||0);
  const bottomVolume=order.bottom==="water"?(state?.waterVolume||0):(state?.organicPhaseVolume||0);
  const cycleTotal=Math.max(1e-6,state?.cycleInitialTotal||1);
  const scale=216/cycleTotal;
  const topHeight=clamp(topVolume*scale,0,216);
  const bottomHeight=clamp(bottomVolume*scale,0,216);
  const surfaceY=306-topHeight-bottomHeight;
  const interfaceY=surfaceY+topHeight;
  const topOrganic=order.top==="organic",bottomOrganic=order.bottom==="organic";
  const organicColor=solvent.color||"#e7ad45";
  els.upperLiquid.setAttribute("y",surfaceY);els.upperLiquid.setAttribute("height",topHeight);
  els.upperLiquid.setAttribute("fill",topOrganic?organicColor:"url(#waterGrad)");
  els.upperLiquid.setAttribute("opacity",topVolume>1e-6?"1":"0");
  els.lowerLiquid.setAttribute("y",interfaceY);els.lowerLiquid.setAttribute("height",bottomHeight);
  els.lowerLiquid.setAttribute("fill",bottomOrganic?organicColor:"url(#waterGrad)");
  els.lowerLiquid.setAttribute("opacity",bottomVolume>1e-6?"1":"0");
  els.interface.setAttribute("d","M276 "+interfaceY+" H444");
  els.interface.setAttribute("opacity",topVolume>1e-6&&bottomVolume>1e-6?"1":"0");
  els.upperLabel.textContent=topOrganic?"Pha hữu cơ":"Pha nước";
  els.lowerLabel.textContent=bottomOrganic?"Pha hữu cơ":"Pha nước";
  els.upperLabel.setAttribute("y",surfaceY+Math.max(14,topHeight/2));
  els.lowerLabel.setAttribute("y",interfaceY+Math.max(14,bottomHeight/2));
  els.upperLabel.setAttribute("fill",topOrganic?"#573b12":"#073b58");
  els.lowerLabel.setAttribute("fill",bottomOrganic?"#573b12":"#073b58");
  els.upperLabel.setAttribute("opacity",topHeight>24?"1":"0");
  els.lowerLabel.setAttribute("opacity",bottomHeight>24?"1":"0");
  const hWater=cupHeight(state?.waterCollected||0,state?.waterAddedVolume||100);
  const hOrganic=cupHeight(state?.organicCollected||0,state?.organicAddedVolume||100);
  els.waterCollected.setAttribute("d",cupFillPath(204,283,hWater));
  els.organicCollected.setAttribute("d",cupFillPath(434,513,hOrganic));
  els.waterVolSvg.textContent=fmt(state?.waterCollected||0,1)+" mL";
  els.organicVolSvg.textContent=fmt(state?.organicCollected||0,1)+" mL";
  renderReceivers();
}

function renderSteps(){
  const labels=["Chuẩn bị hỗn hợp và chọn dung môi.","Lắc phễu để tăng tiếp xúc giữa các pha.","Để yên cho hai pha phân lớp.","Mở khóa, thu hết pha dưới.","Nghiêng phễu và rót pha trên qua miệng."];
  els.steps.innerHTML="";
  const stage=state?.stage||"idle";
  const active=stage==="idle"?0:["ready","shaking"].includes(stage)?1:stage==="shaken"?2:["settled","lower-partial","lower-drained","lower-pending"].includes(stage)?3:["lower-collected","collecting-upper","upper-pending"].includes(stage)?4:5;
  labels.forEach((label,i)=>{const li=document.createElement("li");li.textContent=label;if(i<active)li.className="done";else if(i===active)li.className="active";els.steps.append(li);});
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
  $("startBtn").disabled=!!state;
  $("shakeBtn").disabled=stage!=="ready";
  $("settleBtn").disabled=stage!=="shaken";
  $("openBtn").disabled=!["settled","lower-partial"].includes(stage)||!!state?.valveOpen;
  $("closeBtn").disabled=!state?.valveOpen;
  $("nextPhaseBtn").disabled=stage!=="lower-collected";
  $("nextExtractionBtn").disabled=stage!=="complete"||(state?.oilRemaining??0)<0.005;
}
function sync(){updateMetrics();renderFunnel();renderSteps();updateButtons();assertVolumeBalance();}

function startExperiment(){
  if(state){setMessage("Hãy nhấn “Đặt lại” trước khi bắt đầu một thí nghiệm mới.","error");return;}
  try{
    settings=readSettings();
    const solvent=chosenSolvent();
    if(solvent.miscibility==="miscible")throw new Error("Dung môi trộn lẫn hoàn toàn với nước không phù hợp với mô hình chiết hai pha.");
    state=initialState(settings);state.stage="ready";state.currentSolvent=solvent.id;
    state.organicPhaseVolume=settings.solventVol;state.organicAddedVolume=settings.solventVol;
    state.cycleInitialTotal=state.waterVolume+state.organicPhaseVolume;
    state.selectedPhase=null;els.results.classList.add("hidden");
    setStatus("Sẵn sàng",true);
    setMessage("Đã nạp "+fmt(state.waterVolume,1)+" mL pha nước và "+fmt(state.organicPhaseVolume,1)+" mL dung môi. Nhấn “Lắc phễu”, sau đó để yên cho phân lớp.","success");
    sync();
  }catch(e){state=null;setMessage(e.message,"error");updateButtons();}
}
function shake(){
  if(!state||state.stage!=="ready")return;
  clearTimeout(shakeTimer);state.stage="shaking";state.droplets=true;els.droplets.innerHTML="";
  for(let i=0;i<18;i++){
    const c=document.createElementNS("http://www.w3.org/2000/svg","circle");
    c.setAttribute("cx",290+Math.random()*140);c.setAttribute("cy",115+Math.random()*115);c.setAttribute("r",2+Math.random()*3);
    c.setAttribute("fill",i%2?"#b9efff":"#ffd68b");c.setAttribute("opacity",".9");els.droplets.append(c);
  }
  els.shakeBadge.setAttribute("opacity","1");els.funnelGroup.style.transformOrigin="360px 200px";els.funnelGroup.style.animation="shake .45s ease-in-out 4";
  setStatus("Đang lắc",true);
  setMessage("Các giọt pha đang phân tán. Đây là mô phỏng thao tác lắc; thí nghiệm thật phải tuân thủ quy trình an toàn dung môi.");
  sync();
  shakeTimer=setTimeout(()=>{
    if(!state||state.stage!=="shaking")return;
    els.funnelGroup.style.animation="";els.shakeBadge.setAttribute("opacity","0");state.droplets=false;state.stage="shaken";
    setStatus("Đã lắc · chờ phân lớp",true);setMessage("Nhấn “Để yên & phân lớp” để quan sát hai lớp ổn định.");updateButtons();renderSteps();
  },1900);
}
function settle(){
  if(!state||state.stage!=="shaken")return;
  const order=phaseOrderForState();state.stage="settled";state.droplets=false;els.droplets.innerHTML="";
  state.selectedPhase=order.bottom;
  state.pendingExtraction=extractionStep(state.oilRemaining,Math.max(1e-6,state.waterVolume),Math.max(1e-6,state.organicPhaseVolume),settings.K);
  setStatus("Đã phân lớp",true);
  setMessage(order.explanation+" Cốc pha dưới đã được đặt thẳng dưới miệng khóa. Mở khóa để xả pha dưới; có thể đóng khóa giữa chừng và tiếp tục sau.");
  sync();
}
function setLowerOutletVisible(visible){
  els.stream.setAttribute("opacity",visible?".95":"0");
  els.stopcockHandle.setAttribute("d",visible?"M348 328 H372":"M360 316 V340");
  els.stream.style.stroke=state?.selectedPhase==="organic"?(currentSolvent().color||"#e7ad45"):"#42b9e9";
}
function openValve(){
  if(!state||!["settled","lower-partial"].includes(state.stage)){
    setMessage("Chỉ mở khóa sau khi hai pha đã phân lớp và trước khi rót pha trên.","error");return;
  }
  if(state.valveOpen)return;
  const lower=phaseOrderForState().bottom;
  if(phaseVolume(lower)<=1e-6){setMessage("Pha dưới đã thu hết. Hãy rót pha trên qua miệng phễu.");return;}
  state.selectedPhase=lower;state.activeFlowPhase=lower;state.valveOpen=true;state.stage="lower-partial";
  setLowerOutletVisible(true);setStatus("Đang xả pha dưới",true);
  setMessage("Đang thu "+(lower==="water"?"pha nước":"pha hữu cơ")+" qua khóa dưới. Nhấn “Đóng khóa” để tạm dừng; thể tích còn lại sẽ được giữ nguyên.");
  updateButtons();renderReceivers();ensureFlowLoop();
}
function closeValve(){
  if(!state||!state.valveOpen)return;
  state.valveOpen=false;setLowerOutletVisible(false);
  if(state.stage==="lower-drained"||phaseVolume(state.activeFlowPhase)<=1e-6)state.stage="lower-pending";else state.stage="lower-partial";
  setStatus("Đã đóng khóa",true);
  setMessage(state.stage==="lower-pending"?"Đã đóng khóa. Những giọt cuối đang đi vào cốc; pha trên vẫn nằm trong phễu.":"Dòng chảy đã dừng. Thể tích còn lại được bảo toàn; mở khóa để tiếp tục.");
  updateButtons();ensureFlowLoop();sync();
}
function startUpperPour(){
  if(!state||state.stage!=="lower-collected")return;
  const phase=phaseOrderForState().top;
  if(phaseVolume(phase)<=1e-6){completeUpperCollection();return;}
  state.stage="collecting-upper";state.selectedPhase=phase;state.activeFlowPhase=phase;state.upperPouring=true;
  els.funnelGroup.style.transformOrigin="360px 200px";els.funnelGroup.style.animation="";els.funnelGroup.style.transform="rotate(-32deg)";
  els.clamp.setAttribute("opacity","0");
  els.topStream.style.stroke=phase==="organic"?(currentSolvent().color||"#e7ad45"):"#42b9e9";els.topStream.setAttribute("opacity",".95");
  setStatus("Đang rót pha trên",true);
  setMessage("Đã mô phỏng lấy phễu khỏi kẹp và nghiêng để rót "+(phase==="water"?"pha nước":"pha hữu cơ")+" qua miệng phễu vào cốc riêng. Thể tích giảm dần theo thời gian.");
  updateButtons();renderReceivers();ensureFlowLoop();
}

function finishLowerIfReady(){
  const lower=phaseOrderForState().bottom;
  if(state.stage!=="lower-pending"||phaseVolume(lower)>1e-6||parcelExistsFor(lower))return;
  state.stage="lower-collected";state.selectedPhase=phaseOrderForState().top;state.activeFlowPhase=null;
  setStatus("Đã thu hết pha dưới",true);
  setMessage("Đã thu hết pha dưới ("+fmt(collectedVolume(lower),1)+" mL). Cốc này được giữ nguyên. Tiếp theo, nghiêng phễu và rót pha trên qua miệng vào cốc riêng.","success");
  sync();
}
function finishUpperIfReady(){
  const upper=phaseOrderForState().top;
  if(state.stage!=="upper-pending"||phaseVolume(upper)>1e-6||parcelExistsFor(upper))return;
  completeUpperCollection();
}
function completeUpperCollection(){
  if(!state)return;
  if(state.waterVolume>1e-6||state.organicPhaseVolume>1e-6||state.waterInStream>1e-6||state.organicInStream>1e-6||state.parcels.length){
    setMessage("Chưa thể hoàn tất: vẫn còn chất lỏng trong phễu hoặc đang chảy vào cốc.","error");return;
  }
  state.waterVolume=0;state.organicPhaseVolume=0;state.stage="complete";state.upperPouring=false;state.valveOpen=false;
  state.selectedPhase=null;state.activeFlowPhase=null;els.topStream.setAttribute("opacity","0");
  els.funnelGroup.style.transform="";els.clamp.setAttribute("opacity","1");
  if(state.pendingExtraction)state.oilRemaining=state.pendingExtraction.remaining;
  state.extractions.push({n:state.extractions.length+1,solvent:currentSolvent().name,volume:settings.solventVol,remaining:state.oilRemaining,yield:percent(state.oilInitial-state.oilRemaining,state.oilInitial)});
  setStatus("Đã thu cả hai pha",true);
  setMessage("Đã thu xong hai pha: pha dưới qua khóa, pha trên qua miệng phễu. Phễu không còn chất lỏng; hai cốc giữ riêng thể tích đã thu.","success");
  els.results.classList.remove("hidden");sync();renderResults();
}
function flowFrame(now){
  animationFrameId=null;
  if(!state)return;
  const dt=previousFrameTime==null?0:clamp((now-previousFrameTime)/1000,0,.05);
  previousFrameTime=now;
  const events=advanceFlowStep(state,dt);
  if(events.lowerDrained){
    // Stop the visible stream but keep the valve handle open until the user closes it.
    els.stream.setAttribute("opacity","0");
    setStatus("Pha dưới đã hết · hãy đóng khóa",true);
    setMessage("Pha dưới đã hết trong phễu. Khóa vẫn đang mở để bạn đóng; giọt cuối vẫn đang đi vào cốc.");
  }
  if(events.upperDrained)els.topStream.setAttribute("opacity","0");
  finishLowerIfReady();
  finishUpperIfReady();
  assertVolumeBalance();
  renderFunnel();updateMetrics();renderSteps();updateButtons();
  if(state&&((state.valveOpen&&state.stage==="lower-partial")||state.upperPouring||state.parcels.length))animationFrameId=requestAnimationFrame(flowFrame);
  else previousFrameTime=null;
}

function ensureFlowLoop(){if(animationFrameId==null){previousFrameTime=null;animationFrameId=requestAnimationFrame(flowFrame);}}
function nextExtraction(){
  if(!state||state.stage!=="complete"||state.oilRemaining<.005)return;
  try{
    const solvent=chosenSolvent(),nextSettings=readSettings();
    if(solvent.miscibility==="miscible")throw new Error("Dung môi trộn lẫn hoàn toàn với nước không phù hợp với mô hình chiết hai pha.");
    const returnedWater=state.waterCollected;
    if(returnedWater<=1e-6)throw new Error("Không tìm thấy pha nước đã thu để đưa trở lại phễu cho lần chiết tiếp theo.");
    state.waterCollected=0;state.waterVolume+=returnedWater;
    state.organicPhaseVolume=nextSettings.solventVol;state.organicAddedVolume+=nextSettings.solventVol;
    state.cycleInitialTotal=state.waterVolume+state.organicPhaseVolume;state.currentSolvent=solvent.id;
    state.stage="ready";state.selectedPhase=null;state.activeFlowPhase=null;state.pendingExtraction=null;state.upperPouring=false;state.valveOpen=false;
    settings=nextSettings;els.funnelGroup.style.transform="";els.clamp.setAttribute("opacity","1");els.topStream.setAttribute("opacity","0");setLowerOutletVisible(false);
    setStatus("Lần chiết "+(state.extractions.length+1)+" · sẵn sàng",true);
    setMessage("Đã chuyển "+fmt(returnedWater,1)+" mL pha nước từ cốc trở lại phễu và thêm "+fmt(nextSettings.solventVol,1)+" mL dung môi mới. Thể tích được bảo toàn và lịch sử vẫn được giữ.");
    sync();renderResults();
  }catch(e){setMessage(e.message,"error");}
}
function reset(){
  clearTimeout(shakeTimer);if(animationFrameId!=null)cancelAnimationFrame(animationFrameId);
  animationFrameId=null;previousFrameTime=null;state=null;settings=null;
  els.results.classList.add("hidden");els.droplets.innerHTML="";els.funnelGroup.style.animation="";els.funnelGroup.style.transform="";
  els.shakeBadge.setAttribute("opacity","0");els.clamp.setAttribute("opacity","1");els.stream.setAttribute("opacity","0");els.topStream.setAttribute("opacity","0");
  els.stopcockHandle.setAttribute("d","M360 316 V340");els.beakerWater.removeAttribute("transform");els.beakerOrganic.removeAttribute("transform");
  els.waterCollected.setAttribute("d",cupFillPath(204,283,0));els.organicCollected.setAttribute("d",cupFillPath(434,513,0));
  els.waterVolSvg.textContent="0 mL";els.organicVolSvg.textContent="0 mL";
  setStatus("Chưa bắt đầu");setMessage("Chọn thông số rồi nhấn “Bắt đầu thí nghiệm”.");
  els.waterMetric.textContent="—";els.oilMetric.textContent="—";renderFunnel();renderSteps();updateButtons();
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
  $("startBtn").addEventListener("click",startExperiment);
  $("shakeBtn").addEventListener("click",shake);
  $("settleBtn").addEventListener("click",settle);
  $("openBtn").addEventListener("click",openValve);
  $("closeBtn").addEventListener("click",closeValve);
  $("nextPhaseBtn").addEventListener("click",startUpperPour);
  $("nextExtractionBtn").addEventListener("click",nextExtraction);
  $("resetBtn").addEventListener("click",reset);
  $("resultBtn").addEventListener("click",()=>{
    if(!state){setMessage("Hãy bắt đầu thí nghiệm trước.","error");return;}
    els.results.classList.remove("hidden");renderResults();els.results.scrollIntoView({behavior:"smooth",block:"start"});
  });
  $("hideResultBtn").addEventListener("click",()=>els.results.classList.add("hidden"));
  $("addSolventBtn").addEventListener("click",()=>$("addSolventForm").classList.toggle("hidden"));
  $("cancelSolventBtn").addEventListener("click",()=>$("addSolventForm").classList.add("hidden"));
  $("saveSolventBtn").addEventListener("click",addSolvent);
  els.solventSelect.addEventListener("change",()=>{
    if(state&&state.stage!=="complete"){
      els.solventSelect.value=state.currentSolvent;
      setMessage("Không thể đổi dung môi giữa chu trình. Hãy hoàn tất hoặc đặt lại thí nghiệm trước.","error");return;
    }
    updateSolventFields();
  });
  [els.mixVol,els.oilPct].forEach(el=>el.addEventListener("change",()=>{
    if(state){setMessage("Thông số hỗn hợp đã thay đổi. Đặt lại trước khi áp dụng vào thí nghiệm hiện tại.","error");return;}
    try{const v=readSettings();els.waterMetric.textContent=fmt(v.mixVol*(1-v.oilPct/100),1)+" mL";els.oilMetric.textContent=fmt(v.mixVol*v.oilPct/100)+" mL";}
    catch(e){setMessage(e.message,"error");}
  }));
  $("partitionK").addEventListener("change",()=>{if(state&&state.stage!=="complete")setMessage("K không thể đổi giữa chu trình; giá trị mới dùng cho lần chiết kế tiếp.");});
  $("solventVol").addEventListener("change",()=>{if(state&&state.stage!=="complete")setMessage("Thể tích dung môi không thể đổi giữa chu trình; giá trị mới dùng cho lần chiết kế tiếp.");});
  $("stopcock").addEventListener("click",()=>{if(state?.valveOpen)closeValve();else openValve();});
  $("stopcock").addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();if(state?.valveOpen)closeValve();else openValve();}});
  els.mode.addEventListener("change",()=>setMessage(els.mode.value==="guided"?"Thực hiện theo thứ tự: chuẩn bị → lắc → phân lớp → thu pha dưới qua khóa → rót pha trên qua miệng.":"Chế độ tự do cho phép thay đổi thông số giữa các chu trình; thao tác không hợp lệ sẽ bị chặn."));
}
function init(){
  populateSolvents("hexane");bind();
  els.waterMetric.textContent="—";els.oilMetric.textContent="—";
  els.stream.setAttribute("opacity","0");els.topStream.setAttribute("opacity","0");
  renderFunnel();renderSteps();updateButtons();
}
init();

