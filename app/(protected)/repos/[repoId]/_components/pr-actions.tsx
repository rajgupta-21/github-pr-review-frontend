"use client";

import { Check, GitMerge, MessageSquare, ShieldAlert, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, dialogFieldClass } from "@/components/ui/dialog";
import { InfoHint } from "@/components/ui/tooltip";
import { commentOnPull, MergeBlockedError, mergePull, submitPullReview } from "@/lib/api";
import type { PullRequest, Severity } from "@/lib/types";
import { cn } from "@/lib/utils";

/*
  Acting on a pull request without leaving.

  Everything here previously required opening github.com: reply, approve,
  request changes, merge. The product showed you what was wrong and then
  handed you to someone else's interface to do anything about it.

  Each action runs under the signed-in user's own GitHub token, so it is
  attributed to them and respects whatever permissions they already have.
*/

type Mode = null | "comment" | "approve" | "request_changes" | "merge";

export function PrActions({
  repoId,
  pull,
  gate,
  blockingCount,
  onDone,
}: {
  repoId: string;
  pull: PullRequest;
  /** Severity the merge gate blocks on, or "none". */
  gate: "none" | Severity;
  /** Findings at or above the gate in the newest review. */
  blockingCount: number;
  onDone: (message: string) => void;
}) {
  const [mode, setMode] = useState<Mode>(null);
  const [body, setBody] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<MergeBlockedError | null>(null);

  const merged = Boolean(pull.mergedAtGithub);
  const closed = pull.state === "closed";
  const held = gate !== "none" && blockingCount > 0;

  const close = () => {
    setMode(null);
    setBody("");
    setReason("");
    setError(null);
    setBlocked(null);
  };

  async function run(action: () => Promise<string>) {
    setBusy(true);
    setError(null);
    try {
      onDone(await action());
      close();
    } catch (err) {
      if (err instanceof MergeBlockedError) {
        // Not a failure — the gate did its job. Offer the waive path.
        setBlocked(err);
      } else {
        setError(err instanceof Error ? err.message : "That did not work. Try again");
      }
    } finally {
      setBusy(false);
    }
  }

  if (merged || closed) {
    return (
      <p className="text-[13.5px] text-fg-subtle">
        This pull request is {merged ? "merged" : "closed"}. There is nothing left to do here.
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="tertiary" size="sm" onClick={() => setMode("comment")}>
          <MessageSquare aria-hidden="true" />
          Comment
        </Button>

        <Button type="button" variant="tertiary" size="sm" onClick={() => setMode("approve")}>
          <Check aria-hidden="true" />
          Approve
        </Button>

        <Button
          type="button"
          variant="tertiary"
          size="sm"
          onClick={() => setMode("request_changes")}
        >
          <X aria-hidden="true" />
          Request changes
        </Button>

        <Button
          type="button"
          variant={held ? "tertiary" : "primary"}
          size="sm"
          onClick={() => setMode("merge")}
        >
          <GitMerge aria-hidden="true" />
          {held ? "Merge (held)" : "Merge"}
        </Button>

        {held ? (
          <span className="inline-flex items-center gap-1.5 text-[13px] text-critical">
            <ShieldAlert className="size-3.5" aria-hidden="true" />
            {blockingCount} {blockingCount === 1 ? "finding" : "findings"} at {gate} or above
            <InfoHint label="What is the merge gate?">
              The merge gate is a rule on this repository. It holds the merge while any finding
              is at {gate} or above. Change it in repository settings, or waive it with a reason
              that gets posted on the pull request.
            </InfoHint>
          </span>
        ) : null}
      </div>

      {/* ── Comment ───────────────────────────────────────── */}
      <Dialog
        open={mode === "comment"}
        onClose={close}
        title="Comment on this pull request"
        description="Posted to the GitHub thread as you."
        confirmLabel="Post comment"
        loading={busy}
        confirmDisabled={!body.trim()}
        onConfirm={() =>
          run(async () => {
            await commentOnPull(repoId, pull.githubPrNumber, body);
            return "Comment posted";
          })
        }
      >
        <textarea
          rows={5}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Write a comment…"
          className={cn(dialogFieldClass, "resize-y")}
        />
        {error ? <p className="mt-2 text-[13px] text-critical">{error}</p> : null}
      </Dialog>

      {/* ── Approve ───────────────────────────────────────── */}
      <Dialog
        open={mode === "approve"}
        onClose={close}
        title="Approve this pull request"
        description="Submits an approving review on GitHub, as you. GitHub does not allow approving your own pull request."
        confirmLabel="Approve"
        loading={busy}
        onConfirm={() =>
          run(async () => {
            await submitPullReview(repoId, pull.githubPrNumber, "APPROVE", body || undefined);
            return "Pull request approved";
          })
        }
      >
        <textarea
          rows={3}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Optional comment"
          className={cn(dialogFieldClass, "resize-y")}
        />
        {error ? <p className="mt-2 text-[13px] text-critical">{error}</p> : null}
      </Dialog>

      {/* ── Request changes ───────────────────────────────── */}
      <Dialog
        open={mode === "request_changes"}
        onClose={close}
        title="Request changes"
        description="GitHub requires a comment explaining what should change."
        confirmLabel="Request changes"
        loading={busy}
        confirmDisabled={!body.trim()}
        onConfirm={() =>
          run(async () => {
            await submitPullReview(repoId, pull.githubPrNumber, "REQUEST_CHANGES", body);
            return "Changes requested";
          })
        }
      >
        <textarea
          rows={5}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="What needs to change?"
          className={cn(dialogFieldClass, "resize-y")}
        />
        {error ? <p className="mt-2 text-[13px] text-critical">{error}</p> : null}
      </Dialog>

      {/* ── Merge ─────────────────────────────────────────── */}
      <Dialog
        open={mode === "merge"}
        onClose={close}
        title={blocked ? "The merge gate is holding this" : "Merge this pull request"}
        tone={blocked ? "destructive" : "default"}
        description={
          blocked ? (
            <>
              {blocked.blockingCount}{" "}
              {blocked.blockingCount === 1 ? "finding is" : "findings are"} at{" "}
              <strong>{blocked.gate}</strong> or above. You can merge anyway, but the reason you
              give is posted on the pull request so the decision is on the record.
            </>
          ) : (
            "Squash-merges the branch into the base branch on GitHub, as you."
          )
        }
        confirmLabel={blocked ? "Waive and merge" : "Merge"}
        loading={busy}
        confirmDisabled={blocked ? !reason.trim() : false}
        onConfirm={() =>
          run(async () => {
            await mergePull(repoId, pull.githubPrNumber, {
              method: "squash",
              override: Boolean(blocked),
              overrideReason: reason,
            });
            return blocked ? "Merged — the waiver is on the thread" : "Pull request merged";
          })
        }
      >
        {blocked ? (
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-fg">
              Why are you merging past this?
            </span>
            <textarea
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. False positive — the token is scoped to a test fixture"
              className={cn(dialogFieldClass, "resize-y")}
            />
          </label>
        ) : (
          <p className="text-[13.5px] text-fg-muted">
            Merging <span className="font-mono text-[13px]">{pull.sourceBranch}</span> into{" "}
            <span className="font-mono text-[13px]">{pull.targetBranch}</span>.
          </p>
        )}
        {error ? <p className="mt-2 text-[13px] text-critical">{error}</p> : null}
      </Dialog>
    </>
  );
}
