"use client";

import { AlertTriangle, Check, GitPullRequest, Zap } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { timeAgo } from "@/lib/format";
import { scoreTextClass } from "@/lib/review";
import type { AttentionPull } from "@/lib/types";
import { cn } from "@/lib/utils";

/*
  "Needs your attention" — pull requests whose newest review raised
  something Critical or High, across every connected repository.

  The server decides what qualifies and in what order (Critical first, then
  High, then the lower score), so this list matches the merge gate rather
  than re-deriving a second opinion in the browser.
*/

const TILE = {
  critical: { className: "bg-critical-fill text-[#B3253C]", Icon: AlertTriangle },
  high: { className: "bg-high-fill text-[#9A5A0B]", Icon: Zap },
  none: { className: "bg-surface-hover text-fg-muted", Icon: GitPullRequest },
};

function worstTone(pr: AttentionPull): keyof typeof TILE {
  if (pr.criticalCount > 0) return "critical";
  if (pr.highCount > 0) return "high";
  return "none";
}

export function AttentionList({
  pulls,
  clearedCount,
  blockedCount,
}: {
  pulls: AttentionPull[];
  clearedCount: number;
  blockedCount: number;
}) {
  const hidden = blockedCount - pulls.length;

  return (
    <Card>
      <CardHeader
        title="Needs your attention"
        action={<Link href="/repos">All repositories →</Link>}
      >
        <Badge tone={blockedCount ? "violet" : "neutral"} size="lg" className="py-0.5 text-xs">
          {blockedCount}
        </Badge>
      </CardHeader>

      {pulls.length === 0 ? (
        <EmptyState
          icon={<Check />}
          title="Nothing is waiting on you"
          description={
            clearedCount > 0
              ? `${clearedCount} reviewed pull ${clearedCount === 1 ? "request" : "requests"} cleared with nothing serious.`
              : "No reviewed pull request has a Critical or High finding."
          }
        />
      ) : (
        <div className="px-2 pt-2 pb-3">
          {pulls.map((pr, index) => {
            const tile = TILE[worstTone(pr)];

            return (
              <div key={pr.reviewId}>
                {index > 0 ? <div className="mx-3 h-px bg-line-soft" /> : null}
                <Link
                  href={`/repos/${pr.githubRepoId}/pulls/${pr.prNumber}`}
                  className="flex flex-wrap items-center gap-3.5 rounded-[12px] px-3 py-3.5 text-inherit no-underline transition-colors hover:bg-surface-sunken hover:text-inherit sm:flex-nowrap"
                >
                  <span
                    className={cn(
                      "inline-flex size-[38px] shrink-0 items-center justify-center rounded-[11px]",
                      tile.className,
                    )}
                  >
                    <tile.Icon className="size-[19px]" strokeWidth={2} aria-hidden="true" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-[9px]">
                      <span className="shrink-0 font-mono text-[12.5px] text-fg-subtle">
                        #{pr.prNumber}
                      </span>
                      <span className="truncate text-[15px] font-semibold text-fg">
                        {pr.title ?? `Pull request #${pr.prNumber}`}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-fg-muted">
                      <span className="font-mono text-[12.5px]">{pr.fullName}</span>
                      {pr.author ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{pr.author}</span>
                        </>
                      ) : null}
                      <span aria-hidden="true">·</span>
                      <span>reviewed {timeAgo(pr.reviewedAt)}</span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {pr.criticalCount > 0 ? (
                      <Badge className="border border-critical-line bg-[#FDF4F5] text-critical">
                        {pr.criticalCount} critical
                      </Badge>
                    ) : null}
                    {pr.highCount > 0 ? (
                      <Badge className="border border-[#F0DFC2] bg-[#FDF9F2] text-high">
                        {pr.highCount} high
                      </Badge>
                    ) : null}
                    <span className="w-[52px] text-right">
                      <span
                        className={cn(
                          "font-display text-[19px] font-bold",
                          scoreTextClass(pr.overallScore),
                        )}
                      >
                        {pr.overallScore}
                      </span>
                      {/* The denominator is shown because a bare number is not interpretable */}
                      <span className="text-[12px] text-fg-faint">/100</span>
                    </span>
                  </div>
                </Link>
              </div>
            );
          })}

          {hidden > 0 ? (
            <p className="px-3 pt-2 text-[13px] text-fg-subtle">
              {hidden} more blocked pull {hidden === 1 ? "request" : "requests"}.
            </p>
          ) : null}

          {clearedCount > 0 ? (
            <div className="mx-1 mt-2 flex items-center gap-3 rounded-[12px] bg-surface-sunken px-3 py-3">
              <Check className="size-4 shrink-0 text-pass-solid" aria-hidden="true" />
              <span className="text-[13.5px] text-fg-muted">
                {clearedCount} more reviewed clean and needed nothing from you.
              </span>
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}
