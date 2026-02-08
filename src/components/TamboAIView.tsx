"use client";

import { Component, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Mic, MicOff, Send, X } from "lucide-react";
import {
  useTamboV1,
  useTamboV1Suggestions,
  useTamboV1ThreadInput,
  useTamboVoice,
} from "@tambo-ai/react/v1";
import CalmDashboard from "@/components/placeholders/CalmDashboard";
import FleetMapPlaceholder from "@/components/placeholders/FleetMapPlaceholder";
import type { Diagnostics } from "@/components/chat/ControlInput";
import {
  getMissionControlState,
  setMissionFeedMode,
  setMissionScenario,
  subscribeMissionControlState,
  type FeedMode,
  type ScenarioId,
} from "@/lib/missionControlState";
import {
  buildProjectedRoute,
  getSimulationTick,
  simulateAssetTelemetry,
  simulateWeatherAlerts,
} from "@/lib/missionSimulation";

interface TamboAIViewProps {
  onDiagnostics?: (d: Diagnostics) => void;
}

const JUDGE_FLOW_STEPS = [
  {
    label: "1. Orbital Hazard Map",
    prompt:
      "SAT-07 storm risk in Atlantic corridor. Render FleetMap.",
  },
  {
    label: "2. Burn Approval",
    prompt:
      "SAT-07 burn 0.8 deg, fuel overhead 8 percent. Render ApprovalGate.",
  },
  {
    label: "3. Mission Checklist",
    prompt:
      "Burn approved. Render MissionChecklist.",
  },
  {
    label: "4. Ground Systems Alert",
    prompt:
      "Ground-Alpha uplink CPU 94 with jitter. Render SystemsConsole.",
  },
] as const;

const AUTO_FLOW_STEPS = JUDGE_FLOW_STEPS.slice(0, 2);

type MessageContent = {
  type: string;
  id?: string;
  name?: string;
  text?: string;
  props?: unknown;
  input?: unknown;
  state?: unknown;
  streamingState?: "started" | "streaming" | "done";
  renderedComponent?: ReactNode | null;
  statusMessage?: string;
  hasCompleted?: boolean;
};

type PersistentMapState = {
  assetId: string;
  location: { lat: number; lng: number };
  anomaly: string;
  route: { lat: number; lng: number }[];
};

type ExplainabilityEntry = {
  id: string;
  tool: string;
  status: string;
  inputSummary: string;
  renderedComponent: string | null;
};

interface ComponentRenderBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

interface ComponentRenderBoundaryState {
  hasError: boolean;
}

class ComponentRenderBoundary extends Component<
  ComponentRenderBoundaryProps,
  ComponentRenderBoundaryState
> {
  state: ComponentRenderBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ComponentRenderBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Generated component render failed", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function findLastAssistant(messages: { role: string; content: MessageContent[]; id: string }[]) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg.role === "assistant") {
      return msg;
    }
  }
  return null;
}

function findLastComponent(messages: { role: string; content: MessageContent[] }[]) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;
    for (let j = msg.content.length - 1; j >= 0; j -= 1) {
      const block = msg.content[j];
      if (
        block.type === "component" &&
        (block.streamingState === undefined || block.streamingState === "done")
      ) {
        return block;
      }
    }
  }
  return null;
}

function findLastNamedComponent(
  messages: { role: string; content: MessageContent[] }[],
  componentName: string
) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;
    for (let j = msg.content.length - 1; j >= 0; j -= 1) {
      const block = msg.content[j];
      if (
        block.type === "component" &&
        block.name === componentName &&
        (block.streamingState === undefined || block.streamingState === "done")
      ) {
        return block;
      }
    }
  }
  return null;
}

function controlTick(feedMode: FeedMode) {
  return feedMode === "replay" ? 12 : getSimulationTick();
}

function createMapStateFromControl(feedMode: FeedMode, scenario: ScenarioId): PersistentMapState {
  const tick = controlTick(feedMode);
  const telemetry = simulateAssetTelemetry("SAT-07", tick);
  const alerts = simulateWeatherAlerts(telemetry.location.lat, telemetry.location.lng, tick);
  let anomaly = alerts[0]?.type ?? "Nominal orbital conditions";

  if (scenario === "solar_spike") anomaly = "Coronal Mass Ejection Front";
  if (scenario === "uplink_jitter") anomaly = "Uplink Timing Drift";
  if (scenario === "fuel_leak") anomaly = "Fuel Leak Containment";

  return {
    assetId: "SAT-07",
    location: telemetry.location,
    anomaly,
    route: buildProjectedRoute(telemetry.location, tick),
  };
}

function toFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function tryReadFleetMapState(block: MessageContent | null): PersistentMapState | null {
  if (!block || block.type !== "component" || block.name !== "FleetMap") return null;
  if (!block.props || typeof block.props !== "object") return null;

  const props = block.props as Record<string, unknown>;
  const locationRaw =
    props.location && typeof props.location === "object"
      ? (props.location as Record<string, unknown>)
      : null;

  const lat = toFiniteNumber(locationRaw?.lat);
  const lng = toFiniteNumber(locationRaw?.lng);
  if (lat === null || lng === null) return null;

  const route = Array.isArray(props.route)
    ? props.route
        .map((point) => {
          if (!point || typeof point !== "object") return null;
          const mapPoint = point as Record<string, unknown>;
          const pLat = toFiniteNumber(mapPoint.lat);
          const pLng = toFiniteNumber(mapPoint.lng);
          if (pLat === null || pLng === null) return null;
          return { lat: pLat, lng: pLng };
        })
        .filter((point): point is { lat: number; lng: number } => point !== null)
    : [];

  return {
    assetId: typeof props.assetId === "string" && props.assetId.trim().length > 0
      ? props.assetId
      : "SAT-07",
    location: { lat, lng },
    anomaly: typeof props.anomaly === "string" && props.anomaly.trim().length > 0
      ? props.anomaly
      : "unknown anomaly",
    route: route.length > 0 ? route : buildProjectedRoute({ lat, lng }, 12),
  };
}

function summarizeToolInput(input: unknown) {
  if (!input || typeof input !== "object") return "no input";
  const pairs = Object.entries(input as Record<string, unknown>)
    .filter(([key]) => !key.startsWith("_tambo_"))
    .slice(0, 3)
    .map(([key, value]) => `${key}:${typeof value === "string" ? value : JSON.stringify(value)}`);
  return pairs.length > 0 ? pairs.join(" | ") : "no input";
}

function buildExplainability(messages: { role: string; content: MessageContent[]; id: string }[]) {
  const rows: ExplainabilityEntry[] = [];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;
    const renderedComponent =
      msg.content.find((content) => content.type === "component")?.name ?? null;
    for (const content of msg.content) {
      if (content.type !== "tool_use") continue;
      rows.push({
        id: `${msg.id}-${content.id ?? rows.length}`,
        tool: content.name ?? "tool",
        status: content.statusMessage ?? (content.hasCompleted ? "completed" : "running"),
        inputSummary: summarizeToolInput(content.input),
        renderedComponent,
      });
    }
  }
  return rows.slice(0, 6);
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function isInvalidPreviousRunError(message: string) {
  const lowered = message.toLowerCase();
  return (
    lowered.includes("invalid_previous_run") ||
    lowered.includes("previousrunid is required")
  );
}

function isMissingContextIdentifierError(message: string) {
  const lowered = message.toLowerCase();
  return (
    lowered.includes("require exactly one context identifier") ||
    lowered.includes("received neither")
  );
}

function userFacingError(message: string) {
  if (isMissingContextIdentifierError(message)) {
    return "Missing Tambo context key. Set NEXT_PUBLIC_TAMBO_USER_KEY (e.g. orbital-operator) and restart the dev server.";
  }
  return message;
}

export default function TamboAIView({ onDiagnostics }: TamboAIViewProps) {
  const [error, setError] = useState<string | null>(null);
  const [flowRunning, setFlowRunning] = useState(false);
  const [isTraceOpen, setIsTraceOpen] = useState(false);
  const [missionControl, setMissionControl] = useState(getMissionControlState());
  const [persistentMap, setPersistentMap] = useState<PersistentMapState>(() => {
    const state = getMissionControlState();
    return createMapStateFromControl(state.feedMode, state.scenario);
  });
  const threadRef = useRef<HTMLDivElement | null>(null);
  const isStreamingRef = useRef(false);
  const isPendingRef = useRef(false);
  const handledDecisionRef = useRef<string | null>(null);
  const handledOverrideRef = useRef<string | null>(null);
  const handledChecklistRef = useRef<string | null>(null);
  const submitInFlightRef = useRef(false);

  const {
    messages,
    isStreaming,
    currentThreadId,
    startNewThread,
    cancelRun,
  } = useTamboV1();
  const { value, setValue, submit, isPending } = useTamboV1ThreadInput();
  const {
    suggestions,
    accept,
    isLoading: suggestionsLoading,
    isGenerating,
    selectedSuggestionId,
  } = useTamboV1Suggestions({ maxSuggestions: 3 });
  const {
    startRecording,
    stopRecording,
    isRecording,
    isTranscribing,
    transcript,
    transcriptionError,
    mediaAccessError,
  } = useTamboVoice();

  const lastAssistant = useMemo(() => findLastAssistant(messages), [messages]);
  const lastComponent = useMemo(() => findLastComponent(messages), [messages]);
  const lastFleetMapComponent = useMemo(
    () => findLastNamedComponent(messages, "FleetMap"),
    [messages]
  );
  const explainability = useMemo(() => buildExplainability(messages), [messages]);
  const latestTrace = explainability[0] ?? null;

  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  useEffect(() => {
    isPendingRef.current = isPending;
  }, [isPending]);

  const componentFound = Boolean(lastComponent);
  const componentMissing = lastAssistant && !lastComponent && !isStreaming;
  const componentNotRegistered = lastComponent?.renderedComponent === null;
  const componentPending =
    lastComponent && lastComponent.renderedComponent === undefined;

  const validationError = componentNotRegistered
    ? `Component not registered: ${lastComponent?.name ?? "unknown"}`
    : componentMissing
      ? "No component returned; try rephrasing."
      : null;

  const diagnostics = useMemo<Diagnostics>(
    () => ({
      tamboAvailable: true,
      lastMessageId: lastAssistant?.id ?? null,
      componentFound,
      validationError,
    }),
    [lastAssistant?.id, componentFound, validationError]
  );

  useEffect(() => {
    onDiagnostics?.(diagnostics);
  }, [diagnostics, onDiagnostics]);

  useEffect(() => {
    return subscribeMissionControlState(() => {
      const state = getMissionControlState();
      setMissionControl(state);
      setPersistentMap(createMapStateFromControl(state.feedMode, state.scenario));
    });
  }, []);

  useEffect(() => {
    const parsed = tryReadFleetMapState(lastFleetMapComponent);
    if (parsed) {
      setPersistentMap(parsed);
    }
  }, [lastFleetMapComponent]);

  useEffect(() => {
    if (!threadRef.current) return;
    threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages, isStreaming]);

  useEffect(() => {
    if (transcript) {
      setValue(transcript);
    }
  }, [transcript, setValue]);

  const submitWithRecovery = useCallback(
    async (promptForRetry?: string) => {
      if (submitInFlightRef.current) return;
      submitInFlightRef.current = true;

      try {
        await submit();
      } catch (firstError) {
        const firstMessage = errorMessage(firstError);

        if (!isInvalidPreviousRunError(firstMessage)) {
          throw firstError;
        }

        startNewThread();
        await new Promise((resolve) => setTimeout(resolve, 120));

        const retryPrompt = promptForRetry?.trim();
        if (retryPrompt) {
          setValue(retryPrompt);
          await new Promise((resolve) => setTimeout(resolve, 80));
        }
        await submit();
      } finally {
        submitInFlightRef.current = false;
      }
    },
    [setValue, startNewThread, submit]
  );

  const handleSend = useCallback(async () => {
    const trimmed = value?.trim();
    if (!trimmed || isPending || isStreaming) return;
    setError(null);

    try {
      await submitWithRecovery(trimmed);
    } catch (e) {
      setError(userFacingError(errorMessage(e)));
    }
  }, [isPending, isStreaming, submitWithRecovery, value]);

  const handleCancelRun = useCallback(async () => {
    try {
      await cancelRun();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to cancel run";
      setError(msg);
    }
  }, [cancelRun]);

  const waitForIdle = useCallback(async (timeoutMs = 60000) => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (!isStreamingRef.current && !isPendingRef.current) return;
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    throw new Error("Timed out waiting for AI response to finish");
  }, []);

  const runPrompt = useCallback(async (prompt: string) => {
    if (isStreamingRef.current || isPendingRef.current) return;
    const trimmed = prompt.trim();
    if (!trimmed) return;
    setError(null);
    setValue(trimmed);
    await new Promise((resolve) => setTimeout(resolve, 80));
    try {
      await submitWithRecovery(trimmed);
    } catch (e) {
      setError(userFacingError(errorMessage(e)));
      throw e;
    }
  }, [setValue, submitWithRecovery]);

  useEffect(() => {
    if (!lastComponent || lastComponent.type !== "component") return;
    if (lastComponent.name !== "ApprovalGate") return;
    const state =
      lastComponent.state && typeof lastComponent.state === "object"
        ? (lastComponent.state as Record<string, unknown>)
        : null;
    const decision = String(state?.decision ?? "");
    if (decision !== "approved" && decision !== "denied") return;

    const marker = `${lastComponent.id ?? "approval"}:${decision}`;
    if (handledDecisionRef.current === marker) return;
    handledDecisionRef.current = marker;

    const decisionPrompt =
      decision === "approved"
        ? "Decision approved. Follow postDecision format and render MissionChecklist."
        : "Decision denied. Follow postDecision format and render MissionChecklist with safer contingency tasks.";
    void runPrompt(decisionPrompt);
  }, [lastComponent, runPrompt]);

  useEffect(() => {
    if (!lastComponent || lastComponent.type !== "component") return;
    if (lastComponent.name !== "SystemsConsole") return;
    const state =
      lastComponent.state && typeof lastComponent.state === "object"
        ? (lastComponent.state as Record<string, unknown>)
        : null;
    const overrideStatus = String(state?.overrideStatus ?? "");
    if (overrideStatus !== "authorized") return;

    const marker = `${lastComponent.id ?? "systems"}:${overrideStatus}`;
    if (handledOverrideRef.current === marker) return;
    handledOverrideRef.current = marker;

    void runPrompt(
      "Ground override authorized. Follow postDecision format and render MissionChecklist for recovery verification."
    );
  }, [lastComponent, runPrompt]);

  useEffect(() => {
    if (!lastComponent || lastComponent.type !== "component") return;
    if (lastComponent.name !== "MissionChecklist") return;

    const componentState =
      lastComponent.state && typeof lastComponent.state === "object"
        ? (lastComponent.state as Record<string, unknown>)
        : null;
    const completedTaskIds = Array.isArray(componentState?.completedTaskIds)
      ? componentState.completedTaskIds.filter(
          (value): value is string => typeof value === "string"
        )
      : [];
    if (completedTaskIds.length === 0) return;

    const marker = `${lastComponent.id ?? "checklist"}:${completedTaskIds.slice().sort().join(",")}`;
    if (handledChecklistRef.current === marker) return;
    handledChecklistRef.current = marker;

    void runPrompt(
      "Mission checklist updated. Follow postDecision format and render the next operational panel."
    );
  }, [lastComponent, runPrompt]);

  const handleAutoFlow = useCallback(async () => {
    setFlowRunning(true);
    setError(null);
    startNewThread();
    setValue("");

    try {
      await new Promise((resolve) => setTimeout(resolve, 120));
      for (const step of AUTO_FLOW_STEPS) {
        await waitForIdle();
        await runPrompt(step.prompt);
      }
      await waitForIdle();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Auto flow failed";
      setError(msg);
    } finally {
      setFlowRunning(false);
    }
  }, [runPrompt, setValue, startNewThread, waitForIdle]);

  const loading = isPending || isStreaming || flowRunning;
  const suggestionBusy = suggestionsLoading || isGenerating;

  const fallbackMessage = componentPending
    ? "Rendering component..."
    : validationError ?? "Awaiting input. Describe an orbital mission event.";

  const fallbackComponent = (
    <CalmDashboard activeAssets={7} message={fallbackMessage} compact />
  );
  const renderedComponent = lastComponent?.renderedComponent ?? fallbackComponent;
  const isMapComponent = lastComponent?.name === "FleetMap";
  const sideFallback = (
    <CalmDashboard
      activeAssets={7}
      message={
        isMapComponent
          ? "Fleet map updated from AI context. Awaiting the next operational panel."
          : fallbackMessage
      }
      compact
    />
  );
  const sideComponent = isMapComponent ? sideFallback : renderedComponent;

  return (
    <div className="space-y-4 lg:h-[calc(100vh-8rem)] lg:min-h-[42rem] lg:overflow-hidden">
      <div className="grid gap-4 lg:h-full lg:grid-cols-[1.35fr_1fr]">
        <section className="space-y-4 lg:flex lg:min-h-0 lg:flex-col">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-200/80">
                  Mission Operations
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  Thread: {currentThreadId.slice(0, 18)} | Source:{" "}
                  {missionControl.feedMode.toUpperCase()} | Scenario:{" "}
                  {missionControl.scenario.replace("_", " ").toUpperCase()}
                </p>
              </div>
              {isStreaming && (
                <button
                  type="button"
                  onClick={handleCancelRun}
                  className="rounded-md border border-red-500/50 bg-red-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-red-200 transition-colors hover:border-red-400"
                >
                  Cancel Run
                </button>
              )}
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="lg:min-h-0 lg:flex-1"
          >
            <FleetMapPlaceholder
              assetId={persistentMap.assetId}
              location={persistentMap.location}
              anomaly={persistentMap.anomaly}
              route={persistentMap.route}
            />
          </motion.div>

          <div className="space-y-3 rounded-lg border border-cyan-700/40 bg-cyan-950/20 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  startNewThread();
                  setValue("");
                  setError(null);
                }}
                className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-200 transition-colors hover:border-zinc-500"
              >
                New Thread
              </button>
              <button
                type="button"
                onClick={handleAutoFlow}
                disabled={loading}
                className="rounded-md border border-cyan-500/50 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-cyan-200 transition-colors hover:border-cyan-400 disabled:opacity-50"
              >
                Run Judge Flow
              </button>
              {JUDGE_FLOW_STEPS.map((step) => (
                <button
                  key={step.label}
                  type="button"
                  onClick={() => {
                    void runPrompt(step.prompt);
                  }}
                  disabled={loading}
                  className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-200 transition-colors hover:border-zinc-500 disabled:opacity-50"
                >
                  {step.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-200/90">
                Feed
              </span>
              {(["replay", "live"] as FeedMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setMissionFeedMode(mode)}
                  disabled={loading}
                  className={`rounded-md border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                    missionControl.feedMode === mode
                      ? "border-sky-400 bg-sky-500/20 text-sky-100"
                      : "border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-zinc-500"
                  }`}
                >
                  {mode}
                </button>
              ))}
              <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-sky-200/90">
                Scenario
              </span>
              {(
                [
                  { id: "none", label: "Clear" },
                  { id: "solar_spike", label: "Solar Spike" },
                  { id: "uplink_jitter", label: "Uplink Jitter" },
                  { id: "fuel_leak", label: "Fuel Leak" },
                ] as { id: ScenarioId; label: string }[]
              ).map((scenario) => (
                <button
                  key={scenario.id}
                  type="button"
                  onClick={() => {
                    setMissionScenario(scenario.id);
                    if (scenario.id !== "none") {
                      void runPrompt(
                        `Scenario ${scenario.label} active. Re-evaluate and render next panel.`
                      );
                    }
                  }}
                  disabled={loading}
                  className={`rounded-md border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                    missionControl.scenario === scenario.id
                      ? "border-sky-400 bg-sky-500/20 text-sky-100"
                      : "border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-zinc-500"
                  }`}
                >
                  {scenario.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-4 lg:grid lg:h-full lg:min-h-0 lg:grid-rows-[30rem_minmax(0,1fr)_auto] lg:gap-4 lg:space-y-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={lastComponent?.id ?? "empty-side"}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="space-y-2 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:space-y-0 lg:gap-2"
            >
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-300/90">
                  AI Action Panel
                </p>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/60 p-2">
                <div className="flex h-full w-full items-start justify-center">
                  <ComponentRenderBoundary fallback={sideFallback}>
                    {sideComponent}
                  </ComponentRenderBoundary>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
              <span>AI Thread</span>
              <button
                type="button"
                onClick={() => setIsTraceOpen(true)}
                className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200 transition-colors hover:border-emerald-400/60"
              >
                Tool Trace ({explainability.length})
              </button>
            </div>
            {latestTrace && (
              <p className="text-[11px] text-zinc-500">
                Last:{" "}
                <span className="text-emerald-300">{latestTrace.tool}</span>
                {" -> "}
                <span className="text-zinc-300">{latestTrace.renderedComponent ?? "pending"}</span>
              </p>
            )}
            <div
              ref={threadRef}
              className="max-h-64 space-y-2 overflow-y-auto pr-2 lg:max-h-none lg:min-h-0 lg:flex-1"
            >
              {messages.length === 0 && (
                <p className="text-xs text-zinc-500">No messages yet.</p>
              )}
              {messages.map((message) => {
                const isUser = message.role === "user";
                return (
                  <div
                    key={message.id}
                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] space-y-1 rounded-lg border px-3 py-2 text-xs ${
                        isUser
                          ? "border-blue-500/40 bg-blue-500/10 text-blue-100"
                          : "border-zinc-800 bg-zinc-950 text-zinc-200"
                      }`}
                    >
                      {message.content.map((content, idx) => {
                        switch (content.type) {
                          case "text":
                            return (
                              <p
                                key={`${message.id}-text-${idx}`}
                                className="whitespace-pre-wrap"
                              >
                                {content.text}
                              </p>
                            );
                          case "component":
                            return (
                              <span
                                key={`${message.id}-component-${idx}`}
                                className="inline-flex items-center gap-2 rounded-full border border-blue-500/40 bg-blue-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-blue-300"
                              >
                                Rendered: {content.name}
                              </span>
                            );
                          case "tool_use": {
                            const toolContent = content as MessageContent & {
                              name?: string;
                              statusMessage?: string;
                              hasCompleted?: boolean;
                            };
                            const status = toolContent.statusMessage
                              ? toolContent.statusMessage
                              : toolContent.hasCompleted
                                ? "completed"
                                : "running";
                            return (
                              <span
                                key={`${message.id}-tool-${idx}`}
                                className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-300"
                              >
                                Called {toolContent.name ?? "tool"} - {status}
                              </span>
                            );
                          }
                          case "tool_result":
                            return (
                              <span
                                key={`${message.id}-tool-result-${idx}`}
                                className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400"
                              >
                                Tool result ready
                              </span>
                            );
                          default:
                            return null;
                        }
                      })}
                    </div>
                  </div>
                );
              })}
              {isStreaming && (
                <p className="text-xs text-zinc-500">AI is responding...</p>
              )}
            </div>

            <div className="space-y-2">
              {suggestionBusy && (
                <p className="text-xs text-zinc-500">Generating suggestions...</p>
              )}
              {suggestions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      type="button"
                      onClick={() =>
                        accept({ suggestion, shouldSubmit: true })
                      }
                      className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider transition-colors ${
                        suggestion.id === selectedSuggestionId
                          ? "border-blue-400 bg-blue-500/20 text-blue-200"
                          : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
                      }`}
                    >
                      {suggestion.title}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="w-full">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={value ?? ""}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      void handleSend();
                    }
                  }}
                  placeholder="Describe an orbital mission event..."
                  disabled={loading}
                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-colors focus:border-zinc-500 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => (isRecording ? stopRecording() : startRecording())}
                  disabled={loading}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                    isRecording
                      ? "border-red-500/60 bg-red-500/10 text-red-200"
                      : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-500"
                  }`}
                >
                  {isRecording ? <MicOff size={14} /> : <Mic size={14} />}
                </button>
                <button
                  onClick={() => {
                    void handleSend();
                  }}
                  disabled={loading || !value?.trim()}
                  className="flex items-center gap-2 rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-900 transition-colors hover:bg-white disabled:opacity-50"
                >
                  <Send size={14} />
                  {loading ? "Sending..." : "Send"}
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-500">
                {isRecording && (
                  <span className="flex items-center gap-2 text-red-300">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                    </span>
                    Recording...
                  </span>
                )}
                {isTranscribing && <span>Transcribing audio...</span>}
              </div>
              {error && <p className="mt-2 text-xs text-yellow-500">{error}</p>}
              {transcriptionError && (
                <p className="mt-2 text-xs text-yellow-500">
                  Voice error: {transcriptionError}
                </p>
              )}
              {mediaAccessError && (
                <p className="mt-2 text-xs text-yellow-500">
                  Microphone error: {mediaAccessError}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-2 font-mono text-[11px] text-zinc-500">
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              <span>
                tambo: <span className="text-green-400">connected</span>
              </span>
              <span>
                lastMsg: <span className="text-zinc-400">{diagnostics.lastMessageId ?? "none"}</span>
              </span>
              <span>
                component:{" "}
                <span className={diagnostics.componentFound ? "text-green-400" : "text-zinc-600"}>
                  {diagnostics.componentFound ? "found" : "none"}
                </span>
              </span>
              {diagnostics.validationError && (
                <span>
                  error: <span className="text-yellow-500">{diagnostics.validationError}</span>
                </span>
              )}
            </div>
          </div>
        </section>
      </div>

      <AnimatePresence>
        {isTraceOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Close tool trace"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setIsTraceOpen(false)}
              className="fixed inset-0 z-40 bg-black/60"
            />

            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-lg flex-col border-l border-emerald-700/40 bg-zinc-950"
              role="dialog"
              aria-label="Tool to UI Explainability"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300/90">
                    Tool to UI Explainability
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Calls: {explainability.length}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTraceOpen(false)}
                  className="rounded-md border border-zinc-700 bg-zinc-900 p-2 text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
                {explainability.length === 0 && (
                  <p className="text-xs text-zinc-500">No tool calls yet.</p>
                )}
                {explainability.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-md border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-[11px] text-zinc-300"
                  >
                    <p>
                      <span className="text-emerald-300">tool:</span> {entry.tool} |{" "}
                      <span className="text-emerald-300">status:</span> {entry.status}
                    </p>
                    <p className="mt-1 text-zinc-400">
                      <span className="text-zinc-500">input:</span> {entry.inputSummary}
                    </p>
                    <p className="mt-1 text-zinc-400">
                      <span className="text-zinc-500">rendered:</span>{" "}
                      {entry.renderedComponent ?? "pending"}
                    </p>
                  </div>
                ))}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
