"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTamboV1, useTamboV1ComponentState } from "@tambo-ai/react/v1";
import { z } from "zod";
import ApprovalGatePlaceholder from "@/components/placeholders/ApprovalGatePlaceholder";

export const approvalPropsSchema = z.object({
  assetId: z.string().describe("Identifier of the orbital asset"),
  actionName: z.string().describe("Name of the maneuver requiring approval"),
  risk: z.enum(["low", "medium", "high"]).describe("Risk level of the maneuver"),
  rationale: z
    .string()
    .describe("Explanation of why this maneuver is being proposed"),
});

const decisionStateSchema = z.object({
  decision: z.enum(["pending", "approved", "denied"]),
});

type ApprovalGateProps = z.infer<typeof approvalPropsSchema>;

function isRunActiveError(error: Error | null) {
  if (!error) return false;
  const lowered = error.message.toLowerCase();
  return (
    lowered.includes("run_active") ||
    lowered.includes("run active") ||
    lowered.includes("cannot update component state while a run is active")
  );
}

/**
 * This component is only rendered through Tambo's V1 component renderer.
 * Keeping state sync here avoids hook-order issues from HOC bootstrap renders.
 */
export function InteractableApprovalGate(props: ApprovalGateProps) {
  const { isStreaming, isWaiting } = useTamboV1();
  const [queuedDecision, setQueuedDecision] = useState<"approved" | "denied" | null>(null);
  const [decision, setDecision, decisionSync] = useTamboV1ComponentState<
    "pending" | "approved" | "denied"
  >("decision", "pending", 120);

  const runActive = isStreaming || isWaiting;
  const {
    isPending: isDecisionPending,
    error: decisionError,
    flush: flushDecision,
  } = decisionSync;
  const queuedRequestIdRef = useRef(0);
  const streamStateRef = useRef({ isStreaming, isWaiting });
  const isMountedRef = useRef(true);

  useEffect(() => {
    streamStateRef.current = { isStreaming, isWaiting };
  }, [isStreaming, isWaiting]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      queuedRequestIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (runActive) return;
    if (!isRunActiveError(decisionError)) return;
    flushDecision();
  }, [decisionError, flushDecision, runActive]);

  const queueDecisionSync = useCallback(
    async (next: "approved" | "denied") => {
      const requestId = ++queuedRequestIdRef.current;
      setQueuedDecision(next);

      while (requestId === queuedRequestIdRef.current) {
        const current = streamStateRef.current;
        if (!current.isStreaming && !current.isWaiting) {
          if (!isMountedRef.current) return;
          setDecision(next);
          flushDecision();
          setQueuedDecision(null);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
    },
    [flushDecision, setDecision]
  );

  const interactionLocked = isDecisionPending;
  const statusNote = queuedDecision
    ? "Decision queued. It will sync when the current AI run finishes."
    : isDecisionPending
      ? "Syncing decision to Tambo..."
      : decisionError
        ? isRunActiveError(decisionError)
          ? "Run still active. Decision will sync automatically in a moment."
          : "Decision sync failed. Try clicking again."
        : undefined;

  return (
    <ApprovalGatePlaceholder
      {...props}
      compact
      decision={decision}
      interactionLocked={interactionLocked}
      statusNote={statusNote}
      onDecision={(next) => {
        if (interactionLocked) return;
        if (runActive) {
          void queueDecisionSync(next);
          return;
        }
        queuedRequestIdRef.current += 1;
        setQueuedDecision(null);
        setDecision(next);
        flushDecision();
      }}
    />
  );
}
export const approvalStateSchema = decisionStateSchema;
