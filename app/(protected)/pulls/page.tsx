"use client";

import { GitMerge, GitPullRequest, GitPullRequestClosed, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { PageHeading, SidebarShell } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorBanner, LoadingState } from "@/components/ui/feedback";
import { Segmented } from "@/components/ui/segmented";
import { Tooltip } from "@/components/ui/tooltip";
import { getAllPulls } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { scoreBand, scoreDrivers, scoreTextClass, SCORE_SCALE_HELP } from "@/lib/review";
import type { CrossRepoPull } from "@/lib/types";
import { cn } from "@/lib/utils";

import { FilterSelect, SearchField } from "../repos/_components/toolbar";

/*
  Every pull request, across every connected repository.

  Without this screen the only way to see what was waiting on you was to
  open each repository in turn, or go back to GitHub's notifications —
  which is exactly the dependency this product is meant to remove.

  Filters live in the URL so a view is shareable and survives navigating
  into a PR and back.
*/

type StateFilter = "open" | "blocked" | "merged" | "closed" | "all";

const STATE_ICON = {
  open: { icon: GitPullRequest, tile: "bg-pass-fill", fg: "text-pass" },
  merged: { icon: GitMerge, tile: "bg-violet-100", fg: "text-violet-600" },
  closed: { icon: GitPullRequestClosed, tile: "bg-surface-hover", fg: "text-fg-3" },
};

function PullsScreen() {
  const router = useRouter();
  const params = useSearchParams();

  const [data, setData] = useState<Awaited<ReturnType<typeof getAllPulls>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Filter state is read from, and written to, the query string
  const state = (params.get("state") as StateFilter) || "open";
  const repo = params.get("repo") || "all";
  const author = params.get("author") || "all";
  const query = params.get("q") || "";

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (!value || value === "all" || (key === "state" && value === "open")) next.delete(key);
    else next.set(key, value);
    router.replace(`/pulls${next.toString() ? `?${next}` : ""}`, { scroll: false });
  };

  useEffect(() => {
    let cancelled = false;
    getAllPulls()
      .then((result) => !cancelled && setData(result))
      .catch(
        (err: unknown) =>
          !cancelled &&
          setError(err instanceof Error ? err.message : "Could not load pull requests"),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(() => {
    const all = data?.pullRequests ?? [];
    return {
      all: all.length,
      open: all.filter((pr) => pr.state === "open").length,
      blocked: all.filter((pr) => pr.blocked && pr.state === "open").length,
      merged: all.filter((pr) => pr.state === "merged").length,
      closed: all.filter((pr) => pr.state === "closed").length,
    };
  }, [data]);

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();

    return (data?.pullRequests ?? [])
      .filter((pr) => {
        if (state === "blocked") return pr.blocked && pr.state === "open";
        if (state === "all") return true;
        return pr.state === state;
      })
      .filter((pr) => repo === "all" || String(pr.repo?.repoId) === repo)
      .filter((pr) => author === "all" || pr.author === author)
      .filter(
        (pr) =>
          !term ||
          pr.title?.toLowerCase().includes(term) ||
          String(pr.prNumber).includes(term) ||
          pr.repo?.fullName?.toLowerCase().includes(term) ||
          pr.sourceBranch?.toLowerCase().includes(term),
      );
  }, [data, state, repo, author, query]);

  return (
    <SidebarShell>
      <PageHeading
        title="Pull requests"
        description="Every pull request across your connected repositories, with the latest review."
      />

      {loading ? <LoadingState label="Loading pull requests…" /> : null}
      {error ? <ErrorBanner className="mt-6">{error}</ErrorBanner> : null}

      {data ? (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Segmented
              label="State"
              value={state}
              onChange={(value) => setParam("state", value)}
              options={[
                { value: "open", label: `Open ${counts.open}` },
                { value: "blocked", label: `Blocked ${counts.blocked}` },
                { value: "merged", label: `Merged ${counts.merged}` },
                { value: "closed", label: `Closed ${counts.closed}` },
                { value: "all", label: `All ${counts.all}` },
              ]}
            />
            <div className="flex flex-1 flex-wrap items-center justify-end gap-2.5">
              <SearchField
                label="Filter pull requests"
                value={query}
                onChange={(value) => setParam("q", value)}
                placeholder="Title, number, repo or branch"
              />
              <FilterSelect
                label="Repository"
                value={repo}
                onChange={(value) => setParam("repo", value)}
                options={[
                  { value: "all", label: "All repositories" },
                  ...(data.repositories ?? []).map((item) => ({
                    value: String(item.repoId),
                    label: item.fullName,
                  })),
                ]}
              />
              <FilterSelect
                label="Author"
                value={author}
                onChange={(value) => setParam("author", value)}
                options={[
                  { value: "all", label: "All authors" },
                  ...(data.authors ?? []).map((name) => ({ value: name, label: name })),
                ]}
              />
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border border-line bg-surface">
            {rows.length === 0 ? (
              <EmptyState
                icon={<GitPullRequest />}
                title="No pull requests match"
                description={
                  counts.all === 0
                    ? "Connect a repository and Mergegate will review each pull request as it opens."
                    : "Try a different state or clear the filters."
                }
              />
            ) : (
              rows.map((pr, index) => <PullRow key={pr.id} pr={pr} last={index === rows.length - 1} />)
            )}
          </div>
        </>
      ) : null}
    </SidebarShell>
  );
}

function PullRow({ pr, last }: { pr: CrossRepoPull; last: boolean }) {
  const look = STATE_ICON[pr.state === "merged" ? "merged" : pr.state === "closed" ? "closed" : "open"];
  const Icon = look.icon;
  const band = scoreBand(pr.review?.overallScore ?? null);

  return (
    <Link
      href={`/repos/${pr.repo?.repoId}/pulls/${pr.prNumber}`}
      className={cn(
        "flex gap-[15px] px-5 py-[17px] text-inherit no-underline transition-colors hover:bg-surface-sunken hover:text-inherit",
        !last && "border-b border-line-soft",
      )}
    >
      <span
        className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-md", look.tile)}
      >
        <Icon className={cn("size-[18px]", look.fg)} strokeWidth={2} aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="text-[15.5px] font-semibold text-fg">{pr.title}</span>
          <span className="font-mono text-[13px] text-fg-faint">#{pr.prNumber}</span>
          {pr.draft ? <Badge tone="muted">Draft</Badge> : null}
          {pr.blocked && pr.state === "open" ? (
            <Badge className="border border-critical-line bg-[#FDF4F5] text-critical">
              <ShieldAlert className="mr-1 inline size-3" aria-hidden="true" />
              Merge gate held
            </Badge>
          ) : null}
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-fg-muted">
          <span className="font-mono text-[12.5px]">{pr.repo?.fullName}</span>
          {pr.author ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{pr.author}</span>
            </>
          ) : null}
          <span aria-hidden="true">·</span>
          <span className="font-mono text-[12.5px]">
            {pr.sourceBranch} → {pr.targetBranch}
          </span>
          <span aria-hidden="true">·</span>
          <span>updated {timeAgo(pr.updatedAt)}</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {pr.review ? (
          <>
            <div className="hidden gap-1.5 sm:flex">
              {pr.review.criticalCount > 0 ? (
                <Badge tone="critical" size="sm">
                  {pr.review.criticalCount} C
                </Badge>
              ) : null}
              {pr.review.highCount > 0 ? (
                <Badge tone="high" size="sm">
                  {pr.review.highCount} H
                </Badge>
              ) : null}
            </div>
            <Tooltip
              content={
                <>
                  {SCORE_SCALE_HELP}
                  <br />
                  {scoreDrivers({
                    critical: pr.review.criticalCount,
                    high: pr.review.highCount,
                    medium: pr.review.mediumCount,
                    low: pr.review.lowCount,
                  })}
                </>
              }
            >
              <span className="w-[58px] text-right">
                <span
                  className={cn(
                    "font-display text-[19px] font-bold",
                    scoreTextClass(pr.review.overallScore),
                  )}
                >
                  {pr.review.overallScore}
                </span>
                <span className="text-[12px] text-fg-faint">/100</span>
                <span className="block text-[11px] text-fg-subtle">{band}</span>
              </span>
            </Tooltip>
          </>
        ) : (
          <span className="text-[13px] text-fg-faint">Not reviewed</span>
        )}
      </div>
    </Link>
  );
}

export default function PullsPage() {
  // useSearchParams needs a Suspense boundary
  return (
    <Suspense fallback={<LoadingState label="Loading pull requests…" className="min-h-screen" />}>
      <PullsScreen />
    </Suspense>
  );
}
