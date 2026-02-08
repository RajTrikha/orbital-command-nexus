export type FeedMode = "replay" | "live";

export type ScenarioId = "none" | "solar_spike" | "uplink_jitter" | "fuel_leak";

export type MissionControlState = {
  feedMode: FeedMode;
  scenario: ScenarioId;
  updatedAt: string;
};

let missionControlState: MissionControlState = {
  feedMode: "replay",
  scenario: "none",
  updatedAt: new Date().toISOString(),
};

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

export function getMissionControlState(): MissionControlState {
  return missionControlState;
}

export function setMissionFeedMode(feedMode: FeedMode) {
  if (missionControlState.feedMode === feedMode) return;
  missionControlState = {
    ...missionControlState,
    feedMode,
    updatedAt: new Date().toISOString(),
  };
  emit();
}

export function setMissionScenario(scenario: ScenarioId) {
  if (missionControlState.scenario === scenario) return;
  missionControlState = {
    ...missionControlState,
    scenario,
    updatedAt: new Date().toISOString(),
  };
  emit();
}

export function subscribeMissionControlState(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
