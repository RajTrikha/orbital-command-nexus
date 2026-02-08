"use client";

interface CalmDashboardProps {
  activeAssets?: number;
  message?: string;
  compact?: boolean;
}

export default function CalmDashboard({
  activeAssets,
  message,
  compact,
}: CalmDashboardProps) {
  const safeActiveAssets =
    typeof activeAssets === "number" && Number.isFinite(activeAssets)
      ? activeAssets
      : 0;
  const safeMessage = message?.trim() ? message : "Awaiting orbital telemetry.";
  const wrapperMinHeight = compact ? "min-h-[16rem]" : "min-h-[70vh]";
  const cardMaxWidth = compact ? "max-w-md" : "max-w-lg";
  const cardPadding = compact ? "p-7" : "p-10";
  const titleClass = compact ? "text-xl" : "text-2xl";
  const statsSpacing = compact ? "mt-6" : "mt-8";

  return (
    <div className={`relative flex items-center justify-center ${wrapperMinHeight}`}>
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div
        className={`relative z-10 w-full ${cardMaxWidth} rounded-2xl border border-zinc-800 bg-zinc-900/80 ${cardPadding} text-center shadow-2xl backdrop-blur`}
      >
        <h1 className={`${titleClass} font-bold tracking-tight text-zinc-100`}>
          Orbital Command Nexus
        </h1>

        <div className="mt-6 flex items-center justify-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
          </span>
          <span className="text-sm font-semibold uppercase tracking-widest text-green-400">
            Mission Stable
          </span>
        </div>

        <div className={`${statsSpacing} grid grid-cols-2 gap-4`}>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Active Assets</p>
            <p className="mt-1 text-3xl font-bold text-zinc-100">{safeActiveAssets}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Status</p>
            <p className="mt-1 text-sm font-medium text-zinc-300">{safeMessage}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
