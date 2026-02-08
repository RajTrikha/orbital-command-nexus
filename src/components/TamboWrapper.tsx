"use client";

import { useEffect } from "react";
import { TamboV1Provider, defineTool, useTamboClient, useTamboV1Config } from "@tambo-ai/react/v1";
import type { TamboComponent, TamboTool } from "@tambo-ai/react/v1";
import { z } from "zod";
import CalmDashboard from "@/components/placeholders/CalmDashboard";
import FleetMapPlaceholder from "@/components/placeholders/FleetMapPlaceholder";
import { InteractableApprovalGate, approvalPropsSchema } from "@/components/InteractableApprovalGate";
import {
  InteractableMissionChecklist,
  missionChecklistPropsSchema,
} from "@/components/InteractableMissionChecklist";
import {
  InteractableSystemsConsole,
  systemsConsolePropsSchema,
} from "@/components/InteractableSystemsConsole";
import {
  ASSET_BASELINE,
  MISSION_STORY_STEPS,
  buildMissionOverview,
  buildProjectedRoute,
  getSimulationTick,
  simulateAssetTelemetry,
  simulateWeatherAlerts,
} from "@/lib/missionSimulation";
import { formatKpLevel, getLiveSpaceWeatherSnapshot } from "@/lib/spaceWeather";
import { getMissionControlState } from "@/lib/missionControlState";

function normalizeAssetId(value: string): string {
  return value.trim().toUpperCase();
}

function getEffectiveTick() {
  const { feedMode } = getMissionControlState();
  return feedMode === "replay" ? 12 : getSimulationTick();
}

function withScenarioTelemetry(base: ReturnType<typeof simulateAssetTelemetry>) {
  const { scenario } = getMissionControlState();
  if (scenario === "fuel_leak" && base.assetId === "SAT-07") {
    return {
      ...base,
      fuel: Math.max(5, base.fuel - 18),
      signalStrength: Math.max(20, base.signalStrength - 6),
      status: "fuel-leak-containment",
      trend: "rising-risk" as const,
    };
  }
  if (scenario === "uplink_jitter" && base.assetId === "RELAY-3") {
    return {
      ...base,
      signalStrength: Math.max(10, base.signalStrength - 14),
      status: "degraded-uplink-jitter",
      trend: "rising-risk" as const,
    };
  }
  return base;
}

function pickHighestRiskAsset() {
  const tick = getEffectiveTick();
  const assets = Object.keys(ASSET_BASELINE).map((assetId) =>
    withScenarioTelemetry(simulateAssetTelemetry(assetId, tick))
  );
  return assets
    .map((asset) => ({ asset, riskScore: (100 - asset.signalStrength) + (100 - asset.fuel) }))
    .sort((a, b) => b.riskScore - a.riskScore)[0]?.asset;
}

const getAssetTelemetry = defineTool({
  name: "getAssetTelemetry",
  description:
    "Look up current orbital asset telemetry: mission status, location, fuel, signal strength, trend, and projected route.",
  inputSchema: z.object({
    assetId: z.string().describe("Orbital asset identifier, e.g. 'SAT-07'"),
  }),
  outputSchema: z.object({
    assetId: z.string(),
    status: z.string(),
    location: z.object({ lat: z.number(), lng: z.number() }),
    fuel: z.number(),
    signalStrength: z.number(),
    lastCheckIn: z.string(),
    trend: z.enum(["stable", "rising-risk", "recovering"]),
    route: z.array(z.object({ lat: z.number(), lng: z.number() })),
  }),
  tool: ({ assetId }) => {
    const tick = getEffectiveTick();
    const telemetry = withScenarioTelemetry(simulateAssetTelemetry(normalizeAssetId(assetId), tick));
    return {
      ...telemetry,
      route: buildProjectedRoute(telemetry.location, tick),
    };
  },
});

const getSpaceWeatherAlerts = defineTool({
  name: "getSpaceWeatherAlerts",
  description:
    "Fetch active space-weather hazards near a coordinate. Returns anomaly type, severity, corridor, region, and active window.",
  inputSchema: z.object({
    lat: z.number().describe("Latitude"),
    lng: z.number().describe("Longitude"),
  }),
  outputSchema: z.object({
    alerts: z.array(
      z.object({
        type: z.string(),
        severity: z.enum(["low", "medium", "high"]),
        corridor: z.string(),
        region: z.string(),
        activeWindow: z.string(),
      })
    ),
  }),
  tool: ({ lat, lng }) => {
    const tick = getEffectiveTick();
    const alerts = simulateWeatherAlerts(lat, lng, tick);
    const { scenario } = getMissionControlState();
    if (scenario === "solar_spike") {
      return {
        alerts: [
          {
            type: "Coronal Mass Ejection Front",
            severity: "high" as const,
            corridor: "Atlantic Relay Corridor",
            region: "Orbital Band 4",
            activeWindow: "18 min",
          },
          ...alerts,
        ],
      };
    }
    if (scenario === "uplink_jitter") {
      return {
        alerts: [
          ...alerts,
          {
            type: "Uplink Timing Drift",
            severity: "medium" as const,
            corridor: "Ground-Alpha Uplink",
            region: "Antenna Mesh",
            activeWindow: "12 min",
          },
        ],
      };
    }
    return { alerts };
  },
});

const getMissionOverview = defineTool({
  name: "getMissionOverview",
  description:
    "Get fleet-level mission posture: active assets, alert count, risk trend, and per-asset readiness.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    totalAssets: z.number(),
    activeAssets: z.number(),
    alertCount: z.number(),
    tick: z.number(),
    assets: z.array(
      z.object({
        assetId: z.string(),
        status: z.string(),
        fuel: z.number(),
        signalStrength: z.number(),
        trend: z.enum(["stable", "rising-risk", "recovering"]),
      })
    ),
  }),
  tool: () => {
    const tick = getEffectiveTick();
    const overview = buildMissionOverview(tick);
    const { scenario } = getMissionControlState();
    const adjustedAssets = overview.assets.map((asset) => withScenarioTelemetry(asset));
    const scenarioAlertBonus =
      scenario === "solar_spike" ? 2 : scenario === "uplink_jitter" ? 1 : scenario === "fuel_leak" ? 1 : 0;

    return {
      totalAssets: overview.totalAssets,
      activeAssets: overview.activeAssets,
      alertCount: overview.alertCount + scenarioAlertBonus,
      tick,
      assets: adjustedAssets.map((asset) => ({
        assetId: asset.assetId,
        status: asset.status,
        fuel: asset.fuel,
        signalStrength: asset.signalStrength,
        trend: asset.trend,
      })),
    };
  },
});

const tamboTools: TamboTool[] = [
  getAssetTelemetry,
  getSpaceWeatherAlerts,
  getMissionOverview,
];

function CompactTamboCalmDashboard({
  activeAssets,
  message,
}: {
  activeAssets?: number;
  message?: string;
}) {
  return <CalmDashboard activeAssets={activeAssets} message={message} compact />;
}

const tamboComponents: TamboComponent[] = [
  {
    name: "CalmDashboard",
    description:
      "Render when orbital assets are stable with no immediate anomalies. Show active asset count and mission summary.",
    component: CompactTamboCalmDashboard,
    propsSchema: z.object({
      activeAssets: z.number().describe("Number of currently active orbital assets"),
      message: z.string().describe("Mission status summary"),
    }),
  },
  {
    name: "FleetMap",
    description:
      "Render when a specific orbital asset needs geospatial risk visualization. Use getAssetTelemetry and getSpaceWeatherAlerts before rendering.",
    component: FleetMapPlaceholder,
    propsSchema: z.object({
      assetId: z.string().describe("Identifier of the orbital asset"),
      location: z
        .object({ lat: z.number(), lng: z.number() })
        .describe("Current orbital track location"),
      anomaly: z.string().describe("Detected anomaly or hazard type"),
      route: z
        .array(z.object({ lat: z.number(), lng: z.number() }))
        .optional()
        .describe("Projected correction path"),
    }),
  },
  {
    name: "SystemsConsole",
    description:
      "Render when a ground station or relay system reports critical metrics requiring operator intervention. Keep the assistant response concise, avoid markdown code blocks, provide a one-line remediation command, and tell the operator to click Authorize Ground Override.",
    component: InteractableSystemsConsole,
    propsSchema: systemsConsolePropsSchema,
  },
  {
    name: "ApprovalGate",
    description:
      "Render when an orbital maneuver requires explicit human approval before execution. Use plain text only and no markdown symbols. Keep response concise and end with: Rendering: ApprovalGate.",
    component: InteractableApprovalGate,
    propsSchema: approvalPropsSchema,
  },
  {
    name: "MissionChecklist",
    description:
      "Render after approval or denial when operators need a checkable execution plan. Provide 3-5 concise tasks with stable IDs and owners. Use this panel for human-in-the-loop progress tracking.",
    component: InteractableMissionChecklist,
    propsSchema: missionChecklistPropsSchema,
  },
];

const tamboContextHelpers = {
  missionPlaybook: () => ({
    mission: "Orbital Command Nexus",
    defaultAssetId: "SAT-07",
    preferredNarrativeOrder: [
      "CalmDashboard",
      "FleetMap",
      "ApprovalGate",
      "MissionChecklist",
      "SystemsConsole",
    ],
    knownAssets: Object.keys(ASSET_BASELINE),
    incidentTimeline: MISSION_STORY_STEPS.map((step, index) => ({
      step: index + 1,
      title: step.title,
      narrative: step.narrative,
      panel: step.ui.panel,
    })),
    responseStyle: {
      approvalGate: {
        format: [
          "Decision: <approval required with key maneuver numbers>",
          "Action: <what operator should confirm>",
          "Expected impact: <short risk/fuel tradeoff>",
          "Rendering: ApprovalGate",
        ],
        rules: [
          "Use exactly 4 short lines in this order",
          "Use plain text only; no markdown symbols like **, _, or backticks",
        ],
      },
      missionChecklist: {
        format: [
          "Decision: <status context>",
          "Action: <operator objective>",
          "Expected impact: <why checklist matters>",
          "Rendering: MissionChecklist",
        ],
        rules: [
          "Use exactly 4 short lines in this order",
          "Keep tasks practical and executable",
          "Use plain text only",
        ],
      },
      systemsConsole: {
        format: [
          "Risk: <short risk statement>",
          "Action: <single-line command>",
          "Expected impact: <short outcome>",
        ],
        rules: [
          "Keep total assistant text concise and plain text",
          "Do not use markdown code blocks",
          "Always end with: Click Authorize Ground Override to execute.",
        ],
      },
      postDecision: {
        format: [
          "Decision: <approved or denied with key numbers>",
          "Action: <single-line command>",
          "Expected impact: <risk delta plus verification>",
          "Rendering: <next component name>",
        ],
        rules: [
          "Use exactly 4 short lines in this order",
          "Do not use markdown code blocks",
          "Keep commands to one line",
        ],
      },
    },
    guardrails: [
      "Keep one consistent asset across a single incident unless explicitly asked to switch",
      "Use tools before rendering FleetMap whenever location or anomaly details are needed",
      "When operator decision is provided in ApprovalGate, acknowledge it explicitly in follow-up",
      "When rendering ApprovalGate, respond in exactly 4 short plain-text lines: Decision, Action, Expected impact, Rendering: ApprovalGate",
      "After ApprovalGate decisions, prefer rendering MissionChecklist before escalating to SystemsConsole",
      "When rendering MissionChecklist, include 3-5 tasks with stable IDs and realistic owners",
      "After ApprovalGate decision or SystemsConsole authorization, respond in exactly 4 short lines: Decision, Action, Expected impact, Rendering",
      "Only use SystemsConsole when a station metric is provided or inferred",
      "For SystemsConsole text, keep it concise, plain text, and action-first",
      "For SystemsConsole commands, prefer one-line operational commands over multi-line instructions",
    ],
  }),
  missionSnapshot: () => {
    const tick = getEffectiveTick();
    const overview = buildMissionOverview(tick);
    const highRisk = pickHighestRiskAsset();
    const missionState = getMissionControlState();
    return {
      tick,
      feedMode: missionState.feedMode,
      scenario: missionState.scenario,
      totalAssets: overview.totalAssets,
      activeAssets: overview.activeAssets,
      alertCount: overview.alertCount,
      highestRiskAsset: highRisk?.assetId ?? null,
      highestRiskStatus: highRisk?.status ?? null,
    };
  },
  liveSpaceWeather: async () => {
    const snapshot = await getLiveSpaceWeatherSnapshot();
    return {
      ...snapshot,
      kpLevel: formatKpLevel(snapshot.kp),
    };
  },
};

function TamboStateUserKeyBridge() {
  const client = useTamboClient();
  const { userKey } = useTamboV1Config();
  const effectiveUserKey =
    typeof userKey === "string" && userKey.trim().length > 0 ? userKey.trim() : "orbital-operator";

  useEffect(() => {
    const stateApi = client.threads.state;
    const originalUpdateState = stateApi.updateState.bind(stateApi);

    type UpdateStateFn = typeof stateApi.updateState;
    const patchedUpdateState: UpdateStateFn = (componentID, params, options) => {
      const rawOptions =
        options && typeof options === "object"
          ? (options as { query?: Record<string, unknown> })
          : undefined;
      const query = rawOptions?.query ?? {};
      const paramsObject = params as unknown as { [key: string]: unknown };
      const paramsWithUserKey = {
        ...paramsObject,
        userKey: paramsObject.userKey ?? effectiveUserKey,
      } as unknown as typeof params;
      return originalUpdateState(componentID, paramsWithUserKey as typeof params, {
        ...(rawOptions ?? {}),
        query: {
          ...query,
          userKey: query.userKey ?? effectiveUserKey,
        },
      } as { query?: Record<string, unknown> });
    };

    // eslint-disable-next-line react-hooks/immutability
    stateApi.updateState = patchedUpdateState;
    return () => {
      stateApi.updateState = originalUpdateState;
    };
  }, [client, effectiveUserKey]);

  return null;
}

export default function TamboWrapper({ children }: { children: React.ReactNode }) {
  const apiKey = process.env.NEXT_PUBLIC_TAMBO_API_KEY ?? "";
  const envUserKey = process.env.NEXT_PUBLIC_TAMBO_USER_KEY?.trim();
  const userKey = envUserKey && envUserKey.length > 0 ? envUserKey : "orbital-operator";

  if (!apiKey) {
    return <>{children}</>;
  }

  return (
    <TamboV1Provider
      apiKey={apiKey}
      components={tamboComponents}
      tools={tamboTools}
      contextHelpers={tamboContextHelpers}
      userKey={userKey}
      autoGenerateThreadName={false}
    >
      <TamboStateUserKeyBridge />
      {children}
    </TamboV1Provider>
  );
}
