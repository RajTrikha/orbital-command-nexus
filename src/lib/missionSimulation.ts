import type { AgentUIPolicy } from "@/types/schema";

export type AssetId = "SAT-07" | "SAT-12" | "RELAY-3";

export type AlertSeverity = "low" | "medium" | "high";

export type SimulatedTelemetry = {
  assetId: string;
  status: string;
  location: { lat: number; lng: number };
  fuel: number;
  signalStrength: number;
  lastCheckIn: string;
  trend: "stable" | "rising-risk" | "recovering";
};

export type SimulatedAlert = {
  type: string;
  severity: AlertSeverity;
  corridor: string;
  region: string;
  activeWindow: string;
};

type AssetBase = {
  assetId: AssetId;
  baseLat: number;
  baseLng: number;
  baseFuel: number;
  baseSignal: number;
  statusCycle: string[];
};

type AnomalyBase = {
  type: string;
  severity: AlertSeverity;
  corridor: string;
  region: string;
  center: { lat: number; lng: number };
  radius: number;
  baseMinutes: number;
};

export const ASSET_BASELINE: Record<AssetId, AssetBase> = {
  "SAT-07": {
    assetId: "SAT-07",
    baseLat: 18.742,
    baseLng: -43.128,
    baseFuel: 61,
    baseSignal: 78,
    statusCycle: ["tracking-storm-edge", "tracking-storm-edge", "nominal", "nominal"],
  },
  "SAT-12": {
    assetId: "SAT-12",
    baseLat: 12.103,
    baseLng: -31.209,
    baseFuel: 84,
    baseSignal: 93,
    statusCycle: ["nominal", "nominal", "nominal", "monitoring-flux"],
  },
  "RELAY-3": {
    assetId: "RELAY-3",
    baseLat: 24.882,
    baseLng: -17.55,
    baseFuel: 49,
    baseSignal: 52,
    statusCycle: ["degraded-uplink", "degraded-uplink", "stabilizing", "stabilizing"],
  },
};

const ANOMALY_LIBRARY: AnomalyBase[] = [
  {
    type: "Solar Particle Burst",
    severity: "high",
    corridor: "Atlantic Relay Corridor",
    region: "Orbital Band 4",
    center: { lat: 18.9, lng: -42.9 },
    radius: 1.15,
    baseMinutes: 22,
  },
  {
    type: "Radiation Spike",
    severity: "medium",
    corridor: "Orbital Band 4",
    region: "South Atlantic Sector",
    center: { lat: 19.1, lng: -42.5 },
    radius: 0.95,
    baseMinutes: 31,
  },
  {
    type: "Geomagnetic Shear",
    severity: "medium",
    corridor: "Relay Arc East",
    region: "Ground-Relay Layer",
    center: { lat: 24.9, lng: -17.4 },
    radius: 1.25,
    baseMinutes: 14,
  },
  {
    type: "Ionospheric Drift",
    severity: "low",
    corridor: "Northern Sync Window",
    region: "Band 2",
    center: { lat: 12.2, lng: -31.0 },
    radius: 1.1,
    baseMinutes: 19,
  },
  {
    type: "Uplink Jitter Band",
    severity: "medium",
    corridor: "Ground-Alpha Uplink",
    region: "Antenna Mesh",
    center: { lat: 24.2, lng: -18.1 },
    radius: 0.8,
    baseMinutes: 11,
  },
];

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededUnit(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function getSimulationTick(nowMs = Date.now(), windowMs = 45000): number {
  return Math.floor(nowMs / windowMs);
}

function locationDrift(base: AssetBase, tick: number): { lat: number; lng: number } {
  const seed = stableHash(base.assetId);
  const latOffset = (seededUnit(seed + tick * 0.71) - 0.5) * 0.6;
  const lngOffset = (seededUnit(seed + tick * 1.13) - 0.5) * 0.9;
  return {
    lat: round3(base.baseLat + latOffset),
    lng: round3(base.baseLng + lngOffset),
  };
}

export function simulateAssetTelemetry(
  assetId: string,
  tick = getSimulationTick(),
): SimulatedTelemetry {
  const base = (ASSET_BASELINE as Record<string, AssetBase>)[assetId];
  if (!base) {
    return {
      assetId,
      status: "unknown",
      location: { lat: 0, lng: 0 },
      fuel: 0,
      signalStrength: 0,
      lastCheckIn: "never",
      trend: "stable",
    };
  }

  const seed = stableHash(assetId);
  const cycleIndex = (tick + (seed % 11)) % base.statusCycle.length;
  const location = locationDrift(base, tick);
  const fuel = clamp(
    Math.round(
      base.baseFuel - ((tick + seed) % 18) * 0.7 + (seededUnit(seed + tick * 0.17) - 0.5) * 3
    ),
    5,
    100
  );
  const signalStrength = clamp(
    Math.round(base.baseSignal + (seededUnit(seed + tick * 0.43) - 0.5) * 16),
    10,
    100
  );

  let trend: SimulatedTelemetry["trend"] = "stable";
  if (signalStrength < 60 || fuel < 35) {
    trend = "rising-risk";
  } else if (signalStrength > base.baseSignal && fuel > base.baseFuel - 8) {
    trend = "recovering";
  }

  return {
    assetId,
    status: base.statusCycle[cycleIndex],
    location,
    fuel,
    signalStrength,
    lastCheckIn: `${2 + ((seed + tick * 7) % 38)} sec ago`,
    trend,
  };
}

function distanceSq(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = a.lat - b.lat;
  const dLng = a.lng - b.lng;
  return dLat * dLat + dLng * dLng;
}

function formatWindow(minutes: number): string {
  return `${Math.max(6, Math.round(minutes))} min`;
}

export function simulateWeatherAlerts(
  lat: number,
  lng: number,
  tick = getSimulationTick(),
): SimulatedAlert[] {
  const location = { lat, lng };
  const scored = ANOMALY_LIBRARY.map((anomaly, index) => {
    const dist = Math.sqrt(distanceSq(location, anomaly.center));
    const edge = anomaly.radius - dist;
    const weight = edge + (seededUnit(tick * 0.31 + index * 5.7) - 0.5) * 0.4;
    return { anomaly, weight, index };
  })
    .filter((item) => item.weight > -0.25)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 2)
    .map(({ anomaly, index }) => {
      const drift = (seededUnit(tick * 0.9 + index * 13) - 0.5) * 6;
      return {
        type: anomaly.type,
        severity: anomaly.severity,
        corridor: anomaly.corridor,
        region: anomaly.region,
        activeWindow: formatWindow(anomaly.baseMinutes + drift),
      } satisfies SimulatedAlert;
    });

  return scored;
}

export function buildProjectedRoute(
  location: { lat: number; lng: number },
  tick = getSimulationTick(),
): { lat: number; lng: number }[] {
  const driftA = seededUnit(tick * 0.23) - 0.5;
  const driftB = seededUnit(tick * 0.67) - 0.5;
  return [
    { lat: round3(location.lat), lng: round3(location.lng) },
    { lat: round3(location.lat + 0.24 + driftA * 0.12), lng: round3(location.lng + 0.31 - driftB * 0.14) },
    { lat: round3(location.lat + 0.49 + driftA * 0.18), lng: round3(location.lng + 0.79 - driftB * 0.2) },
  ];
}

export function buildMissionOverview(tick = getSimulationTick()) {
  const assets = Object.keys(ASSET_BASELINE).map((assetId) => simulateAssetTelemetry(assetId, tick));
  const alertCount = assets.reduce((count, asset) => {
    const alerts = simulateWeatherAlerts(asset.location.lat, asset.location.lng, tick);
    const highOrMedium = alerts.filter((alert) => alert.severity !== "low").length;
    return count + highOrMedium;
  }, 0);

  return {
    totalAssets: assets.length,
    activeAssets: assets.filter((asset) => !asset.status.includes("offline")).length,
    alertCount,
    assets,
    tick,
  };
}

const storyTick = 12;
const storySat = simulateAssetTelemetry("SAT-07", storyTick);
const storyAlerts = simulateWeatherAlerts(storySat.location.lat, storySat.location.lng, storyTick);
const primaryStoryAlert = storyAlerts[0]?.type ?? "Solar Particle Burst";

export const MISSION_STORY_STEPS: Array<{
  title: string;
  narrative: string;
  ui: AgentUIPolicy;
}> = [
  {
    title: "Mission Nominal",
    narrative: "All assets are in a controlled state while orbital weather is being monitored.",
    ui: {
      panel: "CalmDashboard",
      props: {
        activeAssets: buildMissionOverview(storyTick).activeAssets,
        message: "Mission nominal. Monitoring solar flux and relay health.",
      },
    },
  },
  {
    title: "Space-Weather Hazard",
    narrative: "SAT-07 enters a high-variance corridor and receives anomaly flags.",
    ui: {
      panel: "FleetMap",
      props: {
        assetId: "SAT-07",
        location: storySat.location,
        anomaly: primaryStoryAlert,
        route: buildProjectedRoute(storySat.location, storyTick),
      },
    },
  },
  {
    title: "Human Approval",
    narrative: "Operator approval is required before a fuel-costly corrective maneuver.",
    ui: {
      panel: "ApprovalGate",
      props: {
        assetId: "SAT-07",
        actionName: "Execute 0.8° Orbital Burn",
        risk: "high",
        rationale:
          "Avoids active solar corridor and preserves uplink continuity. Increases fuel consumption by 8%.",
      },
    },
  },
  {
    title: "Ground Recovery",
    narrative: "Ground-Alpha receives uplink pressure and applies recovery automation.",
    ui: {
      panel: "SystemsConsole",
      props: {
        stationId: "Ground-Alpha",
        metric: "Uplink CPU",
        value: 94,
        suggestedCommand: "systemctl restart relay-uplink && rebalance antenna-array",
      },
    },
  },
];
