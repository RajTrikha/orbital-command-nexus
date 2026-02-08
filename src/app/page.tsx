"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import MissionControl from "@/components/MissionControl";
import OrbitalBackdrop from "@/components/OrbitalBackdrop";
import SpaceWeatherContextPanel from "@/components/SpaceWeatherContextPanel";
import ControlInput from "@/components/chat/ControlInput";
import type { Diagnostics } from "@/components/chat/ControlInput";
import type { AgentUIPolicy } from "@/types/schema";
import { MISSION_STORY_STEPS } from "@/lib/missionSimulation";

const TamboAIView = dynamic(() => import("@/components/TamboAIView"), {
  ssr: false,
});

const TAMBO_AVAILABLE = !!process.env.NEXT_PUBLIC_TAMBO_API_KEY;

const DEFAULT_AI_UI: AgentUIPolicy = {
  panel: "CalmDashboard",
  props: { activeAssets: 7, message: "Awaiting mission event. Describe an orbital anomaly." },
};

export default function Home() {
  const [mode, setMode] = useState<"story" | "ai">("story");
  const [storyIndex, setStoryIndex] = useState(0);
  const [aiUI, setAiUI] = useState<AgentUIPolicy>(DEFAULT_AI_UI);
  const [diag, setDiag] = useState<Diagnostics>({
    tamboAvailable: TAMBO_AVAILABLE,
    lastMessageId: null,
    componentFound: false,
    validationError: null,
  });

  const storyStep = MISSION_STORY_STEPS[storyIndex];
  const storyUI = storyStep.ui;

  const canPrev = storyIndex > 0;
  const canNext = storyIndex < MISSION_STORY_STEPS.length - 1;

  const handleDiagnostics = useCallback((d: Diagnostics) => {
    setDiag(d);
  }, []);

  const fallbackDiagnostics = useMemo(
    () => (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3 font-mono text-xs text-zinc-500">
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          <span>
            tambo:{" "}
            <span className={diag.tamboAvailable ? "text-green-400" : "text-red-400"}>
              {diag.tamboAvailable ? "connected" : "unavailable"}
            </span>
          </span>
          <span>
            lastMsg:{" "}
            <span className="text-zinc-400">{diag.lastMessageId ?? "none"}</span>
          </span>
          <span>
            component:{" "}
            <span className={diag.componentFound ? "text-green-400" : "text-zinc-600"}>
              {diag.componentFound ? "found" : "none"}
            </span>
          </span>
          {diag.validationError && (
            <span>
              error: <span className="text-yellow-500">{diag.validationError}</span>
            </span>
          )}
        </div>
      </div>
    ),
    [diag]
  );

  return (
    <main className="relative min-h-screen px-4 py-8 text-zinc-100">
      <OrbitalBackdrop />
      <div className="fixed right-4 top-4 z-50 flex gap-2">
        <button
          onClick={() => setMode("story")}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
            mode === "story"
              ? "bg-zinc-100 text-zinc-900"
              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
          }`}
        >
          Story
        </button>
        <button
          onClick={() => setMode("ai")}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
            mode === "ai"
              ? "bg-blue-600 text-white"
              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
          }`}
        >
          AI
        </button>
      </div>

      <div
        className={`relative z-10 mx-auto pt-12 ${
          mode === "ai" ? "max-w-7xl" : "max-w-4xl"
        }`}
      >
        {mode === "story" && (
          <>
            <MissionControl ui={storyUI} />
            <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-widest text-zinc-500">
                    Story Step {storyIndex + 1} / {MISSION_STORY_STEPS.length}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-zinc-200">{storyStep.title}</p>
                  <p className="mt-1 text-xs text-zinc-400">{storyStep.narrative}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStoryIndex(0)}
                    className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-200 transition-colors hover:border-zinc-500"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    disabled={!canPrev}
                    onClick={() => setStoryIndex((idx) => Math.max(0, idx - 1))}
                    className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-200 transition-colors hover:border-zinc-500 disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    disabled={!canNext}
                    onClick={() =>
                      setStoryIndex((idx) => Math.min(MISSION_STORY_STEPS.length - 1, idx + 1))
                    }
                    className="rounded-md border border-cyan-500/50 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-cyan-200 transition-colors hover:border-cyan-400 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {mode === "ai" && TAMBO_AVAILABLE && <TamboAIView onDiagnostics={handleDiagnostics} />}

        {mode === "ai" && !TAMBO_AVAILABLE && (
          <>
            <MissionControl ui={aiUI} />
            <div className="mt-8 space-y-3">
              <ControlInput onResult={setAiUI} onDiagnostics={handleDiagnostics} />
              {fallbackDiagnostics}
            </div>
          </>
        )}

        {mode === "story" && <SpaceWeatherContextPanel />}
      </div>
    </main>
  );
}
