"use client";

import { AlertTriangle, Check, SkipForward } from "lucide-react";
import Link from "next/link";

import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { formatDuration, timeAgo } from "@/lib/format";
import type { ActivityEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

/*
  Workflow runs, newest first.

  This previously inferred "activity" from repository connection dates and
  PR timestamps, because runs were not recorded anywhere. The server now
  stores every execution — including the ones that were skipped and why —
  so this shows what actually happened rather than a reconstruction.
*/

const STATUS = {
  completed: { dot: "bg-pass-solid", Icon: Check, label: "completed" },
  failed: { dot: "bg-critical-solid", Icon: AlertTriangle, label: "failed" },
  skipped: { dot: "bg-medium-solid", Icon: SkipForward, label: "skipped" },
};

export function RunActivity({ activity }: { activity: ActivityEntry[] }) {
  return (
    <Card>
      <CardHeader title="Run activity" action={<Link href="/workflow">Workflows →</Link>} />

      {activity.length === 0 ? (
        <EmptyState
          icon={<Check />}
          title="No workflow runs yet"
          description="A run is recorded each time a workflow fires — on a new pull request, or when you trigger one by hand."
        />
      ) : (
        <div className="px-5 py-4">
          {activity.map((run, index) => {
            const look = STATUS[run.status] ?? STATUS.skipped;
            const last = index === activity.length - 1;

            return (
              <div key={run.runId} className="flex gap-3.5">
                {/* Timeline rail */}
                <div className="flex w-2.5 shrink-0 flex-col items-center">
                  <span
                    className={cn("mt-[5px] size-[9px] shrink-0 rounded-full", look.dot)}
                    aria-hidden="true"
                  />
                  {!last ? <span className="w-px flex-1 bg-line-soft" /> : null}
                </div>

                <div className={cn("min-w-0 flex-1", !last && "pb-4")}>
                  <p className="text-[14px] text-fg">
                    <span className="font-semibold">{run.workflowName ?? "Workflow"}</span>{" "}
                    {look.label} on{" "}
                    <Link
                      href={`/repos/${run.githubRepoId}/pulls/${run.prNumber}`}
                      className="font-mono text-[13px]"
                    >
                      {run.repoFullName}#{run.prNumber}
                    </Link>
                  </p>

                  {/* A skipped or failed run always says why */}
                  {run.message ? (
                    <p className="mt-1 text-[13px] text-fg-muted">{run.message}</p>
                  ) : null}

                  <p className="mt-1 text-[12.5px] text-fg-subtle">
                    {run.stepCount} {run.stepCount === 1 ? "step" : "steps"}
                    {run.durationMs ? ` · ${formatDuration(run.durationMs)}` : ""}
                    {" · "}
                    {run.trigger === "manual_trigger" ? "run by hand" : run.trigger}
                    {" · "}
                    {timeAgo(run.createdAt)}
                    {run.failedStep ? ` · failed at ${run.failedStep}` : ""}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
