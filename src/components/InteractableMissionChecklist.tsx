"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTamboV1, useTamboV1ComponentState } from "@tambo-ai/react/v1";
import { z } from "zod";
import MissionChecklistPlaceholder from "@/components/placeholders/MissionChecklistPlaceholder";

const checklistTaskSchema = z.object({
  id: z.string().describe("Stable task identifier"),
  label: z.string().describe("Operator task label"),
  owner: z.string().optional().describe("Task owner or team"),
  etaMinutes: z.number().optional().describe("Estimated completion minutes"),
});

export const missionChecklistPropsSchema = z.object({
  title: z.string().describe("Checklist title"),
  objective: z.string().describe("Checklist objective and completion criteria"),
  tasks: z.array(checklistTaskSchema).min(2).max(5).describe("Ordered checklist tasks"),
});

type MissionChecklistProps = z.infer<typeof missionChecklistPropsSchema>;

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
 * Interactable checklist that syncs completion state back to Tambo.
 */
export function InteractableMissionChecklist(props: MissionChecklistProps) {
  const { isStreaming, isWaiting } = useTamboV1();
  const [queuedCompletedIds, setQueuedCompletedIds] = useState<string[] | null>(null);
  const [completedTaskIds, setCompletedTaskIds, checklistSync] = useTamboV1ComponentState<string[]>(
    "completedTaskIds",
    [],
    120
  );

  const runActive = isStreaming || isWaiting;
  const {
    isPending: isChecklistPending,
    error: checklistError,
    flush: flushChecklist,
  } = checklistSync;
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
    if (!isRunActiveError(checklistError)) return;
    flushChecklist();
  }, [checklistError, flushChecklist, runActive]);

  const queueChecklistSync = useCallback(
    async (nextIds: string[]) => {
      const requestId = ++queuedRequestIdRef.current;
      setQueuedCompletedIds(nextIds);

      while (requestId === queuedRequestIdRef.current) {
        const current = streamStateRef.current;
        if (!current.isStreaming && !current.isWaiting) {
          if (!isMountedRef.current) return;
          setCompletedTaskIds(nextIds);
          flushChecklist();
          setQueuedCompletedIds(null);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
    },
    [flushChecklist, setCompletedTaskIds]
  );

  const interactionLocked = isChecklistPending;
  const visibleCompletedIds = queuedCompletedIds ?? completedTaskIds;
  const statusNote = queuedCompletedIds
    ? "Checklist updates queued. They will sync when the current AI run finishes."
    : isChecklistPending
      ? "Syncing checklist progress..."
      : checklistError
        ? isRunActiveError(checklistError)
          ? "Run still active. Checklist changes will sync automatically in a moment."
          : "Checklist sync failed. Try toggling the task again."
        : undefined;

  return (
    <MissionChecklistPlaceholder
      {...props}
      compact
      completedTaskIds={visibleCompletedIds}
      interactionLocked={interactionLocked}
      statusNote={statusNote}
      onToggleTask={(taskId, nextChecked) => {
        if (interactionLocked) return;

        const current = new Set(visibleCompletedIds);
        if (nextChecked) current.add(taskId);
        else current.delete(taskId);
        const nextIds = Array.from(current);

        if (runActive) {
          void queueChecklistSync(nextIds);
          return;
        }

        queuedRequestIdRef.current += 1;
        setQueuedCompletedIds(null);
        setCompletedTaskIds(nextIds);
        flushChecklist();
      }}
    />
  );
}

