"use client";

import { ThumbsDown, ThumbsUp, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, dialogFieldClass } from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { submitFindingFeedback } from "@/lib/api";
import { cn } from "@/lib/utils";

/*
  Disputing a finding.

  The AI was presented as correct by construction — no dismiss, no "not
  helpful", no way to say it was wrong. The first time it is confidently
  wrong the user has two options: ignore it, or stop trusting the tool.
  This is the third option, and it is also how we learn.

  A false positive asks for a reason, because the reason is the part that
  improves the next review. Helpful/not helpful do not — friction there
  would just mean nobody rates anything.
*/

type Verdict = "helpful" | "not_helpful" | "false_positive";

export function FindingFeedback({
  reviewId,
  findingIndex,
  current,
  onRecorded,
}: {
  reviewId: string;
  findingIndex: number;
  current?: { verdict: string; reason?: string };
  onRecorded: (verdict: Verdict, reason: string | undefined, note: string) => void;
}) {
  const [dismissOpen, setDismissOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function record(verdict: Verdict, why?: string) {
    setBusy(true);
    setError(null);
    try {
      const result = await submitFindingFeedback(reviewId, findingIndex, verdict, why);
      /*
        Report the effect, not just "thanks". "3 of this repo's High
        findings have been dismissed" tells the user their verdict counts
        for something.
      */
      const note =
        verdict === "false_positive" && result.dismissedAtThisSeverity > 1
          ? `${result.message} — ${result.dismissedAtThisSeverity} dismissed at this severity in this repo`
          : result.message;
      onRecorded(verdict, why, note);
      setDismissOpen(false);
      setReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record that");
    } finally {
      setBusy(false);
    }
  }

  if (current?.verdict === "false_positive") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-hover px-2.5 py-1 text-[12px] text-fg-muted">
        Dismissed as a false positive
      </span>
    );
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <Tooltip content="This finding was useful">
          <button
            type="button"
            aria-label="Mark as helpful"
            aria-pressed={current?.verdict === "helpful"}
            onClick={() => record("helpful")}
            disabled={busy}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-md border transition-colors",
              current?.verdict === "helpful"
                ? "border-pass-solid bg-pass-fill text-pass"
                : "border-line-strong text-fg-subtle hover:border-violet-400 hover:text-fg",
            )}
          >
            <ThumbsUp className="size-3.5" aria-hidden="true" />
          </button>
        </Tooltip>

        <Tooltip content="Right about the code, but not worth raising">
          <button
            type="button"
            aria-label="Mark as not helpful"
            aria-pressed={current?.verdict === "not_helpful"}
            onClick={() => record("not_helpful")}
            disabled={busy}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-md border transition-colors",
              current?.verdict === "not_helpful"
                ? "border-high-solid bg-high-fill text-high"
                : "border-line-strong text-fg-subtle hover:border-violet-400 hover:text-fg",
            )}
          >
            <ThumbsDown className="size-3.5" aria-hidden="true" />
          </button>
        </Tooltip>

        <Tooltip content="Wrong about the code — tell us why">
          <button
            type="button"
            aria-label="Dismiss as a false positive"
            onClick={() => setDismissOpen(true)}
            disabled={busy}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-line-strong px-2 text-[12px] text-fg-subtle transition-colors hover:border-critical-line hover:text-critical"
          >
            <X className="size-3" aria-hidden="true" />
            False positive
          </button>
        </Tooltip>
      </div>

      <Dialog
        open={dismissOpen}
        onClose={() => setDismissOpen(false)}
        title="Dismiss as a false positive"
        description="The reason is the useful part — it is what tunes severity for this repository."
        confirmLabel="Dismiss finding"
        loading={busy}
        confirmDisabled={!reason.trim()}
        onConfirm={() => record("false_positive", reason)}
      >
        <textarea
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="e.g. This path is only reachable from a test fixture"
          className={cn(dialogFieldClass, "resize-y")}
        />
        {error ? <p className="mt-2 text-[13px] text-critical">{error}</p> : null}
      </Dialog>
    </>
  );
}
