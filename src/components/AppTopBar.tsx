"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Clock3, Satellite } from "lucide-react";

interface AppTopBarProps {
  mode: "story" | "ai";
  onModeChange: (mode: "story" | "ai") => void;
  tamboAvailable: boolean;
}

function formatClock(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export default function AppTopBar({
  mode,
  onModeChange,
  tamboAvailable,
}: AppTopBarProps) {
  const [clockText, setClockText] = useState("--:--:--");

  useEffect(() => {
    const timer = setInterval(() => {
      setClockText(formatClock(new Date()));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const status = useMemo(() => {
    if (!tamboAvailable) {
      return { label: "Fallback UI", tone: "text-amber-300 border-amber-500/40 bg-amber-500/10" };
    }
    if (mode === "ai") {
      return { label: "Tambo AI Online", tone: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10" };
    }
    return { label: "Story Replay", tone: "text-sky-200 border-sky-500/40 bg-sky-500/10" };
  }, [mode, tamboAvailable]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-cyan-800/35 bg-zinc-950/60 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-400/45 bg-cyan-500/15 shadow-[0_0_20px_rgba(34,211,238,0.2)]">
            <Satellite size={16} className="text-cyan-300" />
          </span>
          <div>
            <p className="text-sm font-semibold tracking-[0.04em] text-zinc-100">
              Orbital Command Nexus
            </p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">
              Generative Mission Control
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <span
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${status.tone}`}
          >
            <Activity size={12} />
            {status.label}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-300">
            <Clock3 size={12} />
            {clockText}
          </span>
        </div>

        <div className="flex items-center gap-1.5 rounded-lg border border-zinc-700/80 bg-zinc-900/70 p-1">
          <button
            onClick={() => onModeChange("story")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
              mode === "story"
                ? "bg-zinc-200 text-zinc-950"
                : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            }`}
          >
            Story
          </button>
          <button
            onClick={() => onModeChange("ai")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
              mode === "ai"
                ? "bg-cyan-500 text-slate-950"
                : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            }`}
          >
            AI
          </button>
        </div>
      </div>
    </header>
  );
}
