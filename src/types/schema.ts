import { z } from "zod";

const CalmDashboardSchema = z.object({
  panel: z.literal("CalmDashboard"),
  props: z.object({
    activeAssets: z.number(),
    message: z.string(),
  }),
});

const FleetMapSchema = z.object({
  panel: z.literal("FleetMap"),
  props: z.object({
    assetId: z.string(),
    location: z.object({
      lat: z.number(),
      lng: z.number(),
    }),
    anomaly: z.string(),
    route: z
      .array(
        z.object({
          lat: z.number(),
          lng: z.number(),
        })
      )
      .optional(),
  }),
});

const SystemsConsoleSchema = z.object({
  panel: z.literal("SystemsConsole"),
  props: z.object({
    stationId: z.string(),
    metric: z.string(),
    value: z.number(),
    suggestedCommand: z.string(),
  }),
});

const ApprovalGateSchema = z.object({
  panel: z.literal("ApprovalGate"),
  props: z.object({
    assetId: z.string(),
    actionName: z.string(),
    risk: z.enum(["low", "medium", "high"]),
    rationale: z.string(),
  }),
});

export const AgentUIPolicySchema = z.discriminatedUnion("panel", [
  CalmDashboardSchema,
  FleetMapSchema,
  SystemsConsoleSchema,
  ApprovalGateSchema,
]);

export type AgentUIPolicy = z.infer<typeof AgentUIPolicySchema>;
