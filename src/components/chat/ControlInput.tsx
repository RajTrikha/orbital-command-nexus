"use client";

import { useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { type AgentUIPolicy } from "@/types/schema";

/** Diagnostic state exposed to parent for debugging AI responses. */
export interface Diagnostics {
  tamboAvailable: boolean;
  lastMessageId: string | null;
  componentFound: boolean;
  validationError: string | null;
}

interface ControlInputProps {
  onResult: (ui: AgentUIPolicy) => void;
  onDiagnostics?: (d: Diagnostics) => void;
}

// ---------- Fallback input (no Tambo key configured) ----------

function FallbackControlInput({
  onResult,
  onDiagnostics,
}: {
  onResult: (ui: AgentUIPolicy) => void;
  onDiagnostics?: (d: Diagnostics) => void;
}) {
  const reported = useRef(false);

  useEffect(() => {
    if (reported.current) return;
    reported.current = true;
    onResult({
      panel: "CalmDashboard",
      props: { activeAssets: 7, message: "No API key configured. Using fallback UI." },
    });
    onDiagnostics?.({
      tamboAvailable: false,
      lastMessageId: null,
      componentFound: false,
      validationError: "NEXT_PUBLIC_TAMBO_API_KEY not set",
    });
  }, [onResult, onDiagnostics]);

  return (
    <div className="w-full">
      <div className="rounded-lg border border-yellow-700/50 bg-yellow-950/30 px-4 py-3 mb-3">
        <p className="text-sm text-yellow-400">
          AI mode requires a Tambo API key. Add{" "}
          <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-yellow-300">
            NEXT_PUBLIC_TAMBO_API_KEY
          </code>{" "}
          to <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-yellow-300">.env.local</code>{" "}
          and restart the dev server. Demo mode works without it.
        </p>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="AI orbital mode unavailable..."
          disabled
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none opacity-50"
        />
        <button
          disabled
          className="flex items-center gap-2 rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-900 opacity-50"
        >
          <Send size={14} />
          Send
        </button>
      </div>
    </div>
  );
}

// ---------- Exported component ----------

export default function ControlInput({
  onResult,
  onDiagnostics,
}: ControlInputProps) {
  return (
    <FallbackControlInput onResult={onResult} onDiagnostics={onDiagnostics} />
  );
}
