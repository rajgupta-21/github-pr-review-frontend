"use client";

import { Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/*
  What the review is doing, while it does it.

  A review takes around thirty seconds and the UI showed a spinner — no
  stage, no estimate, nothing to distinguish "working" from "stuck". These
  are the real passes the executor runs, advanced on a timer because the
  endpoint is synchronous and returns only when everything is finished.

  The timings are deliberately conservative, and the last stage stays
  active until the response actually lands, so the list never claims to be
  finished before it is.
*/

const STAGES = [
  { label: "Reading the changed files", at: 0 },
  { label: "Security pass", at: 6000 },
  { label: "Code review", at: 14000 },
  { label: "Writing the report", at: 24000 },
];

export function ReviewProgress({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setElapsed(Date.now() - startedAt), 500);
    return () => clearInterval(timer);
  }, [startedAt]);

  // The furthest stage we have plausibly reached
  const current = STAGES.reduce(
    (index, stage, i) => (elapsed >= stage.at ? i : index),
    0,
  );

  const seconds = Math.floor(elapsed / 1000);

  return (
    <div className="rounded-[12px] border border-line bg-surface-sunken px-4 py-3.5">
      <div className="flex items-center justify-between">
        <span className="text-[13.5px] font-semibold text-fg">Reviewing…</span>
        <span className="font-mono text-[12.5px] text-fg-subtle">
          {seconds}s
        </span>
      </div>

      <ol className="mt-3 flex flex-col gap-2">
        {STAGES.map((stage, index) => {
          const done = index < current;
          const active = index === current;

          return (
            <li key={stage.label} className="flex items-center gap-2.5">
              {done ? (
                <Check className="size-3.5 shrink-0 text-pass-solid" aria-hidden="true" />
              ) : active ? (
                <Loader2
                  className="size-3.5 shrink-0 animate-spin text-violet-500 motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : (
                <span
                  className="size-3.5 shrink-0 rounded-full border border-line-strong"
                  aria-hidden="true"
                />
              )}
              <span
                className={cn(
                  "text-[13px]",
                  done ? "text-fg-subtle" : active ? "text-fg" : "text-fg-faint",
                )}
              >
                {stage.label}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="mt-3 text-[12px] text-fg-subtle">
        Usually finishes in about 30 seconds. You can leave this page — the review is saved
        when it completes.
      </p>
    </div>
  );
}
