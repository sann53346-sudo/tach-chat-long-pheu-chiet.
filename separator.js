export const FLOW_RATE_ML_PER_SECOND = 24;
export const STREAM_TRANSIT_SECONDS = 0.18;
const EPS = 1e-6;

export const initialState = settings => {
  const waterVolume = settings.mixVol * (1 - settings.oilPct / 100);
  const oilInitial = settings.mixVol * settings.oilPct / 100;
  return {
    stage: "idle",
    valveOpen: false,
    upperPouring: false,
    mixedVolume: settings.mixVol,
    waterVolume,
    oilInitial,
    oilRemaining: oilInitial,
    waterCollected: 0,
    organicCollected: 0,
    waterInStream: 0,
    organicInStream: 0,
    waterAddedVolume: waterVolume,
    organicAddedVolume: 0,
    organicPhaseVolume: 0,
    cycleInitialTotal: waterVolume,
    droplets: false,
    extractions: [],
    currentSolvent: null,
    selectedPhase: null,
    activeFlowPhase: null,
    parcels: [],
    pendingExtraction: null,
    waterBalanceError: 0,
    organicBalanceError: 0
  };
};

export function transferAmount(remainingVolume, rate = FLOW_RATE_ML_PER_SECOND, elapsedSeconds = 0) {
  const remaining = Number(remainingVolume);
  const speed = Number(rate);
  const elapsed = Number(elapsedSeconds);
  if (!Number.isFinite(remaining) || remaining < 0) throw new RangeError("remainingVolume must be a finite non-negative number");
  if (!Number.isFinite(speed) || speed < 0) throw new RangeError("rate must be a finite non-negative number");
  if (!Number.isFinite(elapsed) || elapsed < 0) throw new RangeError("elapsedSeconds must be a finite non-negative number");
  const amount = Math.min(remaining, speed * elapsed);
  return amount < EPS ? 0 : amount;
}

export function volumeBalance({ remaining, collected, inStream, added }) {
  for (const [key, value] of Object.entries({ remaining, collected, inStream, added })) {
    if (!Number.isFinite(value) || value < -EPS) throw new RangeError(key + " must be a finite non-negative volume");
  }
  return remaining + collected + inStream - added;
}

export function canSettle(state) { return state.stage === "shaken"; }
export function canDrain(state) { return state.stage === "settled" || state.stage === "lower-partial"; }
