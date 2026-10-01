"use client";

import { AlertTriangle, BookMarked, Check, Clock, GitPullRequest, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { PageHeading, SidebarShell } from "@/components/shell/app-shell";
import { displayName, useUser } from "@/components/shell/user-context";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorBanner, LoadingState } from "@/components/ui/feedback";
import { Segmented } from "@/components/ui/segmented";
import { formatDuration } from "@/lib/format";

import { AttentionList } from "./_components/attention-list";
import { RunActivity } from "./_components/run-activity";
import { SetupChecklist } from "./_components/setup-checklist";
import { SplitBar, StatCard } from "./_components/stat-card";
import { type RangeDays, useWorkspace } from "./_components/use-workspace";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/*
  Every stat shows how it moved against the previous window of the same
  length. A number with no baseline cannot be acted on — "248 reviews" says
  nothing until you know last week was 210.
*/
function Delta({ value, previous, lowerIsBetter }: {
  value: number;
  previous: number;
  lowerIsBetter?: boolean;
}) {
  if (!previous) return null;

  const change = value - previous;
  if (change === 0) return <span className="text-[13px] text-fg-subtle">no change</span>;

  const better = lowerIsBetter ? change < 0 : change > 0;
  const percent = Math.round((change / previous) * 100);

  return (
    <span className={better ? "text-[13px] font-semibold text-pass" : "text-[13px] font-semibold text-high"}>
      {change > 0 ? "+" : ""}
      {percent}%
    </span>
  );
}

export default function DashboardPage() {
  const user = useUser();
  const [range, setRange] = useState<RangeDays>(7);
  const { data, error, loading, reload } = useWorkspace(range);

  const stats = data?.stats.stats;
  const severity = stats?.findingsRaised.bySeverity;

  const description = data
    ? data.attention.blockedCount === 0
      ? "Nothing is blocked. Every reviewed pull request cleared."
      : `${data.attention.blockedCount} pull ${data.attention.blockedCount === 1 ? "request is" : "requests are"} waiting on a human.`
    : "Here's what's happening with your repositories.";

  return (
    <SidebarShell
      header={
        <>
          <div className="flex-1" />
          <Button asChild variant="tertiary" size="sm" className="h-10 px-3.5 text-sm">
            <Link href="/workflow">
              <Plus aria-hidden="true" />
              New workflow
            </Link>
          </Button>
          <Button asChild variant="primary" size="sm" className="h-10 px-4 text-sm">
            <Link href="/repos">Connect repository</Link>
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeading title={`${greeting()}, ${displayName(user)}`} description={description} />
        <Segmented
          label="Reporting period"
          value={String(range)}
          onChange={(value) => setRange(Number(value) as RangeDays)}
          options={[
            { value: "7", label: "7 days" },
            { value: "30", label: "30 days" },
            { value: "90", label: "90 days" },
          ]}
        />
      </div>

      {loading && !data ? <LoadingState label="Loading your workspace…" /> : null}

      {error ? (
        <ErrorBanner className="mt-6">
          {error}.{" "}
          <button type="button" onClick={reload} className="font-semibold underline">
            Try again
          </button>
        </ErrorBanner>
      ) : null}

      {data && stats ? (
        data.stats.connectedRepos === 0 ? (
          <div className="mt-6 rounded-xl border border-line bg-surface">
            <EmptyState
              icon={<BookMarked />}
              title="Connect your first repository"
              description="Pick a repository from your GitHub account. Its pull requests will show up here, ready for review."
              action={
                <Button asChild variant="primary">
                  <Link href="/repos">Connect repository</Link>
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <SetupChecklist
              repos={data.repos}
              hasReview={stats.prsReviewed.value > 0}
              firstReviewableHref={data.firstReviewableHref}
            />

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Pull requests reviewed"
                icon={GitPullRequest}
                value={stats.prsReviewed.value}
                note={
                  <Delta
                    value={stats.prsReviewed.value}
                    previous={stats.prsReviewed.previous}
                  />
                }
              >
                <div className="text-[12.5px] text-fg-subtle">
                  Across {data.stats.connectedRepos}{" "}
                  {data.stats.connectedRepos === 1 ? "repository" : "repositories"} in the last{" "}
                  {range} days
                </div>
              </StatCard>

              <StatCard
                label="Findings raised"
                icon={AlertTriangle}
                value={stats.findingsRaised.value}
                note={
                  <Delta
                    value={stats.findingsRaised.value}
                    previous={stats.findingsRaised.previous}
                    lowerIsBetter
                  />
                }
              >
                <SplitBar
                  parts={[
                    { value: severity?.critical ?? 0, className: "bg-critical-solid" },
                    { value: severity?.high ?? 0, className: "bg-high-solid" },
                    { value: severity?.medium ?? 0, className: "bg-medium-solid" },
                    { value: severity?.low ?? 0, className: "bg-low-solid" },
                  ]}
                />
                <div className="mt-[9px] text-[12.5px] text-fg-subtle">
                  {severity?.critical ?? 0} critical · {severity?.high ?? 0} high ·{" "}
                  {severity?.medium ?? 0} medium · {severity?.low ?? 0} low
                </div>
              </StatCard>

              <StatCard
                label="Median review time"
                icon={Clock}
                value={
                  stats.medianReviewMs.value
                    ? (formatDuration(stats.medianReviewMs.value) ?? "—")
                    : "—"
                }
                note={
                  <Delta
                    value={stats.medianReviewMs.value}
                    previous={stats.medianReviewMs.previous}
                    lowerIsBetter
                  />
                }
              >
                <div className="text-[12.5px] text-fg-subtle">
                  Half of reviews finish faster than this
                </div>
              </StatCard>

              <StatCard
                label="Cleared automatically"
                icon={Check}
                value={stats.cleanPrs.value}
                note={
                  <span className="text-[13px] text-fg-subtle">
                    {stats.cleanPrs.percentage}% of reviewed
                  </span>
                }
              >
                <div className="text-[12.5px] text-fg-subtle">
                  Reviewed with no Critical or High finding — the rule the merge gate uses
                </div>
              </StatCard>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
              <AttentionList
                pulls={data.attention.pullRequests}
                blockedCount={data.attention.blockedCount}
                clearedCount={data.attention.clearedCount}
              />
              <RunActivity activity={data.activity} />
            </div>
          </>
        )
      ) : null}
    </SidebarShell>
  );
}
