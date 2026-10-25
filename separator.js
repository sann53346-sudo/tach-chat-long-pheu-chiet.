export const initialState = (settings)=>({
  stage:"idle", valveOpen:false, mixedVolume:settings.mixVol,
  waterVolume:settings.mixVol*(1-settings.oilPct/100), oilInitial:settings.mixVol*settings.oilPct/100,
  oilRemaining:settings.mixVol*settings.oilPct/100, waterCollected:0, organicCollected:0,
  organicPhaseVolume:0, droplets:false, extractions:[], currentSolvent:null, selectedPhase:null
});
export function canSettle(state){return state.stage==="shaken"||state.stage==="mixing";}
export function canDrain(state){return state.stage==="settled"||state.stage==="draining";}
