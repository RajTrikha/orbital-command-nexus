"use client";

import { useState } from "react";

interface SystemsConsoleProps {
  stationId?: string;
  metric?: string;
  value?: number;
  suggestedCommand?: string;
  overrideStatus?: "idle" | "authorized";
  onAuthorize?: () => void;
  interactionLocked?: boolean;
  statusNote?: string;
  onRetrySync?: () => void;
  canRetrySync?: boolean;
  compact?: boolean;
}

export default function SystemsConsolePlaceholder({
  stationId,
  metric,
  value,
  suggestedCommand,
  overrideStatus,
  onAuthorize,
  interactionLocked,
  statusNote,
  onRetrySync,
  canRetrySync,
  compact,
}: SystemsConsoleProps) {
  const [localOverrideStatus, setLocalOverrideStatus] = useState<"idle" | "authorized">("idle");
  const effectiveOverrideStatus = overrideStatus ?? localOverrideStatus;
  const safeValue =
    typeof value === "number" && Number.isFinite(value) ? value : 0;
  const safeStationId = stationId?.trim() ? stationId : "Unknown Station";
  const safeMetric = metric?.trim() ? metric : "Station Metric";
  const safeCommand =
    suggestedCommand?.trim() ?? "echo 'Awaiting suggested command'";
  const color = safeValue >= 90 ? "text-red-400" : safeValue >= 70 ? "text-orange-400" : "text-green-400";
  const bgRing =
    safeValue >= 90
      ? "border-red-500/30 shadow-red-500/10"
      : safeValue >= 70
        ? "border-orange-500/30 shadow-orange-500/10"
        : "border-green-500/30 shadow-green-500/10";
  const rootWidth = compact ? "max-w-xl" : "max-w-2xl";
  const rootPadding = compact ? "p-4" : "p-6";
  const metricBlockPadding = compact ? "p-4" : "p-6";
  const valueClass = compact ? "text-4xl" : "text-5xl";
  const terminalPadding = compact ? "p-3" : "p-4";
  const metricSectionPadding = compact ? "py-3" : "py-6";

  return (
    <div
      className={`mx-auto flex h-full w-full ${rootWidth} flex-col rounded-2xl border border-zinc-800 bg-zinc-900/80 ${rootPadding} shadow-2xl`}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold tracking-tight text-zinc-100">Systems Console</h2>
        <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-300">
          {safeStationId}
        </span>
      </div>

      <div className={`flex flex-col items-center gap-2 ${metricSectionPadding}`}>
        <p className="text-xs uppercase tracking-wider text-zinc-500">{safeMetric}</p>
        <div className={`rounded-full border-2 ${bgRing} ${metricBlockPadding} shadow-lg`}>
          <p className={`${valueClass} font-bold tabular-nums ${color}`}>{safeValue}%</p>
        </div>
      </div>

      {/* Faux terminal */}
      <div className={`mt-4 rounded-lg border border-zinc-800 bg-black ${terminalPadding} font-mono text-sm`}>
        <div className="mb-2 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
          <span className="ml-2 text-xs text-zinc-600">orbital-ground-console</span>
        </div>
        <p className="text-green-400">
          <span className="text-zinc-600">$</span> SUGGESTED ACTION:{" "}
          <span className="block truncate font-semibold" title={safeCommand}>
            {safeCommand}
          </span>
        </p>
        {effectiveOverrideStatus === "authorized" && (
          <p className="mt-2 text-cyan-300">
            <span className="text-zinc-600">$</span> EXECUTING:{" "}
            <span className="block truncate font-semibold" title={safeCommand}>
              {safeCommand}
            </span>
          </p>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">
        <p className="uppercase tracking-wider text-zinc-500">Override Status</p>
        <p
          className={`mt-1 font-semibold uppercase tracking-wider ${
            effectiveOverrideStatus === "authorized" ? "text-cyan-300" : "text-zinc-300"
          }`}
        >
          {effectiveOverrideStatus === "authorized" ? "Authorized" : "Awaiting Authorization"}
        </p>
      </div>

      <button
        className={`mt-auto w-full rounded-lg py-2.5 text-sm font-semibold uppercase tracking-wider transition-colors ${
          effectiveOverrideStatus === "authorized"
            ? "bg-cyan-700/40 text-cyan-100"
            : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-800/50 disabled:text-zinc-500"
        }`}
        disabled={interactionLocked || effectiveOverrideStatus === "authorized"}
        onClick={() => {
          if (effectiveOverrideStatus === "authorized") return;
          if (interactionLocked) return;
          setLocalOverrideStatus("authorized");
          onAuthorize?.();
        }}
      >
        {effectiveOverrideStatus === "authorized"
          ? "Ground Override Authorized"
          : "Authorize Ground Override"}
      </button>

      {statusNote && (
        <div className="mt-3 space-y-2">
          <p className="text-center text-xs text-amber-300">{statusNote}</p>
          {canRetrySync && onRetrySync && (
            <button
              type="button"
              onClick={onRetrySync}
              className="mx-auto block rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-200 transition-colors hover:border-amber-400"
            >
              Retry Sync
            </button>
          )}
        </div>
      )}
    </div>
  );
}
