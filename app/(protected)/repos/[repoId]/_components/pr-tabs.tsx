"use client";

import { Check, Clock, GitCommit, MessageSquare, ShieldAlert, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorBanner, LoadingState } from "@/components/ui/feedback";
import { Tooltip } from "@/components/ui/tooltip";
import { getPullChecks, getPullCommits, getPullTimeline } from "@/lib/api";
import { formatDuration, timeAgo } from "@/lib/format";
import type {
  ConnectedRepo,
  PullRequestCheck,
  PullRequestCommit,
  PullRequestReviewer,
  TimelineEntry,
} from "@/lib/types";
import { cn } from "@/lib/utils";

/*
  Conversation, Commits and Checks.

  A GitHub user arriving here expects these three. Without them the PR
  screen reads as "the AI's opinion" rather than "the pull request", and
  reading the discussion or checking CI meant opening github.com.

  Each panel loads only when its tab is opened — three extra GitHub calls
  on every PR view would be wasteful when most visits only read findings.
*/

export type PrTab = "findings" | "conversation" | "commits" | "checks";

/* ── Conversation ──────────────────────────────────────────── */

export function ConversationPanel({
  repo,
  prNumber,
}: {
  repo: ConnectedRepo;
  prNumber: string;
}) {
  const [data, setData] = useState<{
    timeline: TimelineEntry[];
    reviewers: PullRequestReviewer[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPullTimeline(repo, prNumber)
      .then((result) => !cancelled && setData(result))
      .catch(
        (err: unknown) =>
          !cancelled &&
          setError(err instanceof Error ? err.message : "Could not load the conversation"),
      );
    return () => {
      cancelled = true;
    };
  }, [repo, prNumber]);

  if (error) return <ErrorBanner>{error}</ErrorBanner>;
  if (!data) return <LoadingState label="Loading conversation…" />;

  return (
    <div className="flex flex-col gap-4">
      {data.reviewers.length ? (
        <div className="rounded-[14px] border border-line bg-surface px-5 py-4">
          <h3 className="text-[13.5px] font-semibold text-fg">Reviewers</h3>
          <ul className="mt-3 flex flex-col gap-2.5">
            {data.reviewers.map((reviewer) => (
              <li key={reviewer.login} className="flex items-center gap-2.5">
                <Avatar name={reviewer.login} src={reviewer.avatarUrl} size={24} />
                <span className="flex-1 text-[13.5px] text-fg">{reviewer.login}</span>
                <ReviewStateBadge state={reviewer.state} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {data.timeline.length === 0 ? (
        <div className="rounded-[14px] border border-line bg-surface">
          <EmptyState
            icon={<MessageSquare />}
            title="No discussion yet"
            description="Comments and reviews posted on GitHub appear here, and anything you post from Mergegate goes to the same thread."
          />
        </div>
      ) : (
        <ol className="flex flex-col gap-3">
          {data.timeline.map((entry) => (
            <li
              key={entry.id}
              className="rounded-[14px] border border-line bg-surface px-5 py-4"
            >
              <div className="flex flex-wrap items-center gap-2.5">
                <Avatar name={entry.author} src={entry.avatarUrl} size={22} />
                <span className="text-[13.5px] font-semibold text-fg">{entry.author}</span>
                {entry.type === "review" ? <ReviewStateBadge state={entry.state} /> : null}
                {entry.file ? (
                  <span className="font-mono text-[12px] text-fg-subtle">
                    {entry.file}
                    {entry.line ? `:${entry.line}` : ""}
                  </span>
                ) : null}
                <span className="ml-auto text-[12.5px] text-fg-subtle">
                  {timeAgo(entry.createdAt)}
                </span>
              </div>
              {entry.body ? (
                <p className="mt-2.5 text-[14px] leading-[1.6] whitespace-pre-wrap text-fg-2">
                  {entry.body}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ReviewStateBadge({ state }: { state?: string | null }) {
  if (!state) return null;

  const look: Record<string, { tone: "pass" | "critical" | "neutral"; label: string }> = {
    APPROVED: { tone: "pass", label: "Approved" },
    CHANGES_REQUESTED: { tone: "critical", label: "Changes requested" },
    COMMENTED: { tone: "neutral", label: "Commented" },
    DISMISSED: { tone: "neutral", label: "Dismissed" },
  };

  const entry = look[state] ?? { tone: "neutral" as const, label: state };

  return (
    <Badge tone={entry.tone} size="sm">
      {entry.label}
    </Badge>
  );
}

/* ── Commits ───────────────────────────────────────────────── */

export function CommitsPanel({ repo, prNumber }: { repo: ConnectedRepo; prNumber: string }) {
  const [commits, setCommits] = useState<PullRequestCommit[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPullCommits(repo, prNumber)
      .then((result) => !cancelled && setCommits(result))
      .catch(
        (err: unknown) =>
          !cancelled && setError(err instanceof Error ? err.message : "Could not load commits"),
      );
    return () => {
      cancelled = true;
    };
  }, [repo, prNumber]);

  if (error) return <ErrorBanner>{error}</ErrorBanner>;
  if (!commits) return <LoadingState label="Loading commits…" />;

  return (
    <div className="overflow-hidden rounded-[14px] border border-line bg-surface">
      {commits.length === 0 ? (
        <EmptyState icon={<GitCommit />} title="No commits" description="This pull request has no commits." />
      ) : (
        commits.map((commit, index) => (
          <div
            key={commit.sha}
            className={cn(
              "flex items-start gap-3 px-5 py-3.5",
              index < commits.length - 1 && "border-b border-line-soft",
            )}
          >
            <Avatar name={commit.authorLogin ?? commit.authorName} src={commit.avatarUrl} size={26} />
            <div className="min-w-0 flex-1">
              {/* Only the first line — commit bodies can be long */}
              <p className="truncate text-[14px] font-medium text-fg">
                {commit.message.split("\n")[0]}
              </p>
              <p className="mt-1 text-[12.5px] text-fg-subtle">
                {commit.authorLogin ?? commit.authorName}
                {commit.committedAt ? ` · ${timeAgo(commit.committedAt)}` : ""}
              </p>
            </div>
            <span className="font-mono text-[12.5px] text-fg-subtle">{commit.shortSha}</span>
          </div>
        ))
      )}
    </div>
  );
}

/* ── Checks ────────────────────────────────────────────────── */

export function ChecksPanel({ repo, prNumber }: { repo: ConnectedRepo; prNumber: string }) {
  const [checks, setChecks] = useState<PullRequestCheck[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPullChecks(repo, prNumber)
      .then((result) => !cancelled && setChecks(result))
      .catch(
        (err: unknown) =>
          !cancelled && setError(err instanceof Error ? err.message : "Could not load checks"),
      );
    return () => {
      cancelled = true;
    };
  }, [repo, prNumber]);

  if (error) return <ErrorBanner>{error}</ErrorBanner>;
  if (!checks) return <LoadingState label="Loading checks…" />;

  return (
    <div className="overflow-hidden rounded-[14px] border border-line bg-surface">
      {checks.length === 0 ? (
        <EmptyState
          icon={<Check />}
          title="No checks reported"
          description="Nothing on this commit has reported a status to GitHub."
        />
      ) : (
        checks.map((check, index) => {
          const look =
            check.status !== "completed"
              ? { Icon: Clock, className: "text-fg-subtle", label: check.status }
              : check.conclusion === "success"
                ? { Icon: Check, className: "text-pass", label: "passed" }
                : check.conclusion === "failure"
                  ? { Icon: X, className: "text-critical", label: "failed" }
                  : { Icon: Clock, className: "text-fg-subtle", label: check.conclusion ?? "—" };

          return (
            <div
              key={check.id}
              className={cn(
                "flex items-center gap-3 px-5 py-3.5",
                index < checks.length - 1 && "border-b border-line-soft",
              )}
            >
              <look.Icon className={cn("size-4 shrink-0", look.className)} aria-hidden="true" />
              <span className="flex-1 text-[14px] text-fg">
                {check.name}
                {/* Our own gate is not a GitHub check — say so */}
                {check.id === "mergegate" ? (
                  <Tooltip
                    content={`Mergegate's own rule, not a GitHub check. It holds the merge while any finding is at ${check.gate} or above.`}
                  >
                    <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] text-violet-600">
                      <ShieldAlert className="size-3" aria-hidden="true" />
                      Mergegate
                    </span>
                  </Tooltip>
                ) : null}
              </span>
              <span className="text-[12.5px] text-fg-subtle">
                {check.id === "mergegate" && check.blockingCount
                  ? `${check.blockingCount} blocking`
                  : look.label}
                {check.durationMs ? ` · ${formatDuration(check.durationMs)}` : ""}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}
