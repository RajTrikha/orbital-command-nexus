"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTamboV1, useTamboV1ComponentState } from "@tambo-ai/react/v1";
import { z } from "zod";
import SystemsConsolePlaceholder from "@/components/placeholders/SystemsConsolePlaceholder";

export const systemsConsolePropsSchema = z.object({
  stationId: z.string().describe("Ground station identifier"),
  metric: z.string().describe("Metric name, e.g. Uplink CPU, Signal Jitter"),
  value: z.number().describe("Metric value 0-100"),
  suggestedCommand: z.string().describe("Concrete mitigation command"),
});

type SystemsConsoleProps = z.infer<typeof systemsConsolePropsSchema>;

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
 * Interactable version used by Tambo-rendered component blocks.
 */
export function InteractableSystemsConsole(props: SystemsConsoleProps) {
  const { isStreaming, isWaiting } = useTamboV1();
  const [queuedAuthorize, setQueuedAuthorize] = useState(false);
  const [overrideStatus, setOverrideStatus, overrideSync] = useTamboV1ComponentState<
    "idle" | "authorized"
  >("overrideStatus", "idle", 120);

  const runActive = isStreaming || isWaiting;
  const {
    isPending: isOverridePending,
    error: overrideError,
    flush: flushOverride,
  } = overrideSync;
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
    if (!isRunActiveError(overrideError)) return;
    flushOverride();
  }, [flushOverride, overrideError, runActive]);

  const queueOverrideSync = useCallback(async () => {
    const requestId = ++queuedRequestIdRef.current;
    setQueuedAuthorize(true);

    while (requestId === queuedRequestIdRef.current) {
      const current = streamStateRef.current;
      if (!current.isStreaming && !current.isWaiting) {
        if (!isMountedRef.current) return;
        setOverrideStatus("authorized");
        flushOverride();
        setQueuedAuthorize(false);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  }, [flushOverride, setOverrideStatus]);

  const effectiveOverrideStatus = overrideStatus;
  const interactionLocked = isOverridePending;
  const statusNote = queuedAuthorize
    ? "Override queued. It will sync when the current AI run finishes."
    : isOverridePending
      ? "Syncing override authorization..."
      : overrideError
        ? isRunActiveError(overrideError)
          ? "Run still active. Override will sync automatically in a moment."
          : "Override sync failed. Try Authorize Ground Override again."
        : undefined;

  return (
    <SystemsConsolePlaceholder
      {...props}
      compact
      overrideStatus={effectiveOverrideStatus}
      interactionLocked={interactionLocked}
      statusNote={statusNote}
      onAuthorize={() => {
        if (interactionLocked || effectiveOverrideStatus === "authorized") return;
        if (runActive) {
          void queueOverrideSync();
          return;
        }
        queuedRequestIdRef.current += 1;
        setQueuedAuthorize(false);
        setOverrideStatus("authorized");
        flushOverride();
      }}
    />
  );
}
