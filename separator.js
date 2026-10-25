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

/**
 * Move liquid using elapsed wall-clock time. The amount being carried by the
 * stream is a separate compartment until each parcel reaches its receiver.
 */
export function advanceFlowStep(state, elapsedSeconds) {
  const elapsed = Number(elapsedSeconds);
  if (!Number.isFinite(elapsed) || elapsed < 0) throw new RangeError("elapsedSeconds must be finite and non-negative");
  const dt = Math.min(0.05, elapsed);
  const events = { lowerDrained:false, upperDrained:false, delivered:0 };

  const remainingParcels = [];
  for (const parcel of state.parcels) {
    parcel.remainingSeconds -= dt;
    if (parcel.remainingSeconds <= 0) {
      if (parcel.phase === "water") {
        state.waterInStream = Math.max(0, state.waterInStream - parcel.amount);
        state.waterCollected += parcel.amount;
      } else {
        state.organicInStream = Math.max(0, state.organicInStream - parcel.amount);
        state.organicCollected += parcel.amount;
      }
      events.delivered += parcel.amount;
    } else remainingParcels.push(parcel);
  }
  state.parcels = remainingParcels;

  if (dt > 0 && (state.valveOpen || state.upperPouring)) {
    const phase = state.activeFlowPhase;
    const source = phase === "water" ? state.waterVolume : state.organicPhaseVolume;
    if (source <= EPS) {
      if (phase === "water") state.waterVolume = 0;
      else state.organicPhaseVolume = 0;
      if (state.valveOpen) {
        state.valveOpen = false;
        state.stage = "lower-pending";
        events.lowerDrained = true;
      } else if (state.upperPouring) {
        state.upperPouring = false;
        state.stage = "upper-pending";
        events.upperDrained = true;
      }
    } else {
      const amount = transferAmount(source, FLOW_RATE_ML_PER_SECOND, dt);
      if (amount > 0) {
        if (phase === "water") {
          state.waterVolume = source - amount < EPS ? 0 : source - amount;
          state.waterInStream += amount;
        } else {
          state.organicPhaseVolume = source - amount < EPS ? 0 : source - amount;
          state.organicInStream += amount;
        }
        state.parcels.push({ phase, amount, remainingSeconds:STREAM_TRANSIT_SECONDS });
      }
      if ((phase === "water" ? state.waterVolume : state.organicPhaseVolume) <= EPS) {
        if (phase === "water") state.waterVolume = 0;
        else state.organicPhaseVolume = 0;
        if (state.valveOpen) {
          state.valveOpen = false;
          state.stage = "lower-pending";
          events.lowerDrained = true;
        } else if (state.upperPouring) {
          state.upperPouring = false;
          state.stage = "upper-pending";
          events.upperDrained = true;
        }
      }
    }
  }
  return events;
}

export function canSettle(state) { return state.stage === "shaken"; }
export function canDrain(state) { return state.stage === "settled" || state.stage === "lower-partial"; }
