"use client";

interface MissionChecklistTask {
  id: string;
  label: string;
  owner?: string;
  etaMinutes?: number;
}

interface MissionChecklistProps {
  title?: string;
  objective?: string;
  tasks?: MissionChecklistTask[];
  completedTaskIds?: string[];
  onToggleTask?: (taskId: string, nextChecked: boolean) => void;
  interactionLocked?: boolean;
  statusNote?: string;
  compact?: boolean;
}

const DEFAULT_TASKS: MissionChecklistTask[] = [
  { id: "arm", label: "Arm SAT-07 burn controller", owner: "Flight", etaMinutes: 2 },
  { id: "uplink", label: "Confirm Ground-Alpha uplink lock", owner: "Comms", etaMinutes: 3 },
  { id: "execute", label: "Execute 0.8 deg burn window", owner: "Guidance", etaMinutes: 6 },
  { id: "verify", label: "Verify post-burn orbit solution", owner: "Nav", etaMinutes: 4 },
];

function sanitizeTasks(tasks: MissionChecklistTask[] | undefined) {
  if (!Array.isArray(tasks) || tasks.length === 0) return DEFAULT_TASKS;
  return tasks
    .slice(0, 5)
    .filter((task) => task && typeof task.id === "string" && typeof task.label === "string")
    .map((task, index) => ({
      id: task.id.trim() || `task-${index + 1}`,
      label: task.label.trim() || "Unnamed task",
      owner: task.owner?.trim(),
      etaMinutes:
        typeof task.etaMinutes === "number" && Number.isFinite(task.etaMinutes)
          ? Math.max(1, Math.round(task.etaMinutes))
          : undefined,
    }));
}

export default function MissionChecklistPlaceholder({
  title,
  objective,
  tasks,
  completedTaskIds,
  onToggleTask,
  interactionLocked,
  statusNote,
  compact,
}: MissionChecklistProps) {
  const safeTitle = title?.trim() || "Mission Checklist";
  const safeObjective = objective?.trim() || "Complete checklist before proceeding to next panel.";
  const safeTasks = sanitizeTasks(tasks);
  const doneIds = new Set((completedTaskIds ?? []).filter((id) => typeof id === "string"));
  const doneCount = Math.min(doneIds.size, safeTasks.length);
  const totalCount = safeTasks.length;
  const remainingCount = Math.max(totalCount - doneCount, 0);
  const completionPct = Math.round((doneCount / Math.max(1, totalCount)) * 100);
  const isComplete = totalCount > 0 && doneCount >= totalCount;

  const rootWidth = compact ? "max-w-xl" : "max-w-2xl";
  const rootPadding = compact ? "p-4" : "p-6";
  const objectiveClass = compact
    ? "mt-3 text-sm leading-relaxed text-zinc-400"
    : "mt-4 text-sm leading-relaxed text-zinc-400";

  return (
    <div
      className={`mx-auto flex h-full min-h-0 w-full ${rootWidth} flex-col rounded-2xl border border-cyan-700/30 bg-zinc-900/80 ${rootPadding} shadow-2xl`}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold tracking-tight text-cyan-200">{safeTitle}</h2>
        <span className="rounded-full border border-cyan-600/40 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-100">
          {doneCount}/{totalCount} done
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-zinc-800 bg-zinc-950 p-4">
        <p className={objectiveClass}>{safeObjective}</p>

        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider">
            <span className={isComplete ? "text-emerald-300" : "text-cyan-200/85"}>
              {isComplete ? "Checklist complete" : `${remainingCount} tasks remaining`}
            </span>
            <span className="text-zinc-500">{completionPct}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div
              className={`h-full rounded-full transition-all ${
                isComplete ? "bg-emerald-400" : "bg-cyan-400"
              }`}
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </div>

        <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {safeTasks.map((task) => {
            const checked = doneIds.has(task.id);
            return (
              <button
                key={task.id}
                type="button"
                onClick={() => onToggleTask?.(task.id, !checked)}
                disabled={interactionLocked}
                className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                  checked
                    ? "border-emerald-500/40 bg-emerald-500/10"
                    : "border-zinc-800 bg-zinc-900/80 hover:border-zinc-600"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded border text-xs font-bold ${
                      checked
                        ? "border-emerald-400 bg-emerald-500/20 text-emerald-200"
                        : "border-zinc-600 text-zinc-500"
                    }`}
                  >
                    {checked ? "x" : ""}
                  </span>
                  <div className="min-w-0">
                    <p className={`text-sm font-medium ${checked ? "text-emerald-100" : "text-zinc-100"}`}>
                      {task.label}
                    </p>
                    {(task.owner || task.etaMinutes) && (
                      <p className="mt-1 text-xs text-zinc-500">
                        {task.owner ? `Owner: ${task.owner}` : "Owner: Ops"}
                        {" | "}
                        ETA {task.etaMinutes ?? 3}m
                      </p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-auto pt-4">
        <p className="text-center text-xs text-cyan-200/85">
          {isComplete
            ? "All tasks complete. Advancing to next operational panel..."
            : "Complete all tasks to unlock the next operational panel."}
        </p>
        {statusNote && (
          <p className="mt-1 text-center text-xs text-amber-300">{statusNote}</p>
        )}
      </div>
    </div>
  );
}
