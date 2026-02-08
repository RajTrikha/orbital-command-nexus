"use client";

import { useState } from "react";

interface ApprovalGateProps {
  assetId?: string;
  actionName?: string;
  risk?: "low" | "medium" | "high";
  rationale?: string;
  /** Injected by Tambo interactable wrapper — signals decision back to AI */
  onDecision?: (decision: "approved" | "denied") => void;
  /** Pre-set decision (from Tambo component state restore) */
  decision?: "pending" | "approved" | "denied";
  /** Disable interactions while AI run is still active */
  interactionLocked?: boolean;
  /** Optional runtime status from interactable sync */
  statusNote?: string;
  /** Optional retry action if sync fails after a decision click */
  onRetrySync?: () => void;
  /** Whether retry action should be shown */
  canRetrySync?: boolean;
  /** Compact layout for constrained action-stage rendering */
  compact?: boolean;
}

const riskStyles = {
  low: { badge: "bg-green-900/50 text-green-400 border-green-700", accent: "border-green-500/30" },
  medium: { badge: "bg-yellow-900/50 text-yellow-400 border-yellow-700", accent: "border-yellow-500/30" },
  high: { badge: "bg-red-900/50 text-red-400 border-red-700", accent: "border-red-500/30" },
};

const decisionStyles = {
  approved: "border-green-500 bg-green-950/50 text-green-400",
  denied: "border-red-500 bg-red-950/50 text-red-400",
};

export default function ApprovalGatePlaceholder({
  assetId,
  actionName,
  risk,
  rationale,
  onDecision,
  decision: externalDecision,
  interactionLocked,
  statusNote,
  onRetrySync,
  canRetrySync,
  compact,
}: ApprovalGateProps) {
  const [localDecision, setLocalDecision] = useState<"pending" | "approved" | "denied">("pending");
  const decision = externalDecision ?? localDecision;
  const safeRisk = risk && risk in riskStyles ? risk : "medium";
  const styles = riskStyles[safeRisk];
  const safeAssetId = assetId?.trim() ? assetId : "Unknown Asset";
  const safeActionName = actionName?.trim() ? actionName : "Pending Action";
  const safeRationale =
    rationale?.trim() ?? "Evaluating action details and awaiting final context.";

  function handleDecision(d: "approved" | "denied") {
    setLocalDecision(d);
    onDecision?.(d);
  }

  const rootWidth = compact ? "max-w-xl" : "max-w-2xl";
  const rootPadding = compact ? "p-4" : "p-6";
  const actionTitleSize = compact ? "text-lg" : "text-xl";
  const cardPadding = compact ? "p-4" : "p-5";
  const rationaleClass = compact
    ? "mt-3 max-h-20 overflow-hidden text-sm leading-relaxed text-zinc-400"
    : "mt-4 text-sm leading-relaxed text-zinc-400";

  return (
    <div
      className={`mx-auto flex h-full w-full ${rootWidth} flex-col rounded-2xl border ${styles.accent} bg-zinc-900/80 ${rootPadding} shadow-2xl`}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold tracking-tight text-red-400">Approval Gate</h2>
        <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-300">
          {safeAssetId}
        </span>
      </div>

      <div className={`rounded-lg border border-zinc-800 bg-zinc-950 ${cardPadding}`}>
        <div className="flex items-center justify-between">
          <p className={`${actionTitleSize} font-bold text-zinc-100`}>{safeActionName}</p>
          <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${styles.badge}`}>
            {safeRisk} risk
          </span>
        </div>

        <p className={rationaleClass}>{safeRationale}</p>
      </div>

      {decision === "pending" ? (
        <div className="mt-auto pt-4">
          <div className="flex gap-3">
            <button
              className="flex-1 rounded-lg bg-green-600 py-2.5 text-sm font-semibold uppercase tracking-wider text-white transition-colors hover:bg-green-500 disabled:cursor-not-allowed disabled:bg-green-900/40 disabled:text-zinc-400"
              disabled={interactionLocked}
              onClick={() => handleDecision("approved")}
            >
              Approve
            </button>
            <button
              className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-semibold uppercase tracking-wider text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-red-900/40 disabled:text-zinc-400"
              disabled={interactionLocked}
              onClick={() => handleDecision("denied")}
            >
              Deny
            </button>
          </div>
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
      ) : (
        <div className="mt-auto pt-4">
          <div className={`w-full rounded-lg border p-3 text-center text-sm font-bold uppercase tracking-wider ${decisionStyles[decision]}`}>
            {decision === "approved" ? "Approved" : "Denied"}
          </div>
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
      )}
    </div>
  );
}
