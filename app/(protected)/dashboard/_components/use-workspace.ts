"use client";

import { useCallback, useEffect, useState } from "react";

import { getActivity, getAllPulls, getAttention, getDashboardStats, getRepoOverview } from "@/lib/api";
import type {
  ActivityEntry,
  AttentionPull,
  DashboardStats,
  RepoOverviewEntry,
} from "@/lib/types";

/*
  Dashboard data.

  This used to fetch the connected repositories and then one PR list per
  repository, in the browser, on every load — and each of those calls made
  the server hit GitHub with per_page=100 and upsert every PR it got back.
  Thirty repos meant thirty GitHub calls and several hundred writes to
  render one screen, which GitHub's secondary rate limit would throttle.

  It is now four fixed requests to endpoints that aggregate server-side,
  regardless of how many repositories are connected.
*/

export type RangeDays = 7 | 30 | 90;

export type Workspace = {
  stats: DashboardStats;
  attention: { blockedCount: number; clearedCount: number; pullRequests: AttentionPull[] };
  activity: ActivityEntry[];
  repos: RepoOverviewEntry[];
  /*
    An open PR that could be reviewed right now. Without this a new user
    connects a repository and then waits for someone to open a pull
    request — possibly for days — before the product does anything.
  */
  firstReviewableHref: string | null;
};

export function hasWorkflow(repo: RepoOverviewEntry) {
  return repo.workflow.nodeCount > 0;
}

export function useWorkspace(range: RangeDays = 7) {
  const [data, setData] = useState<Workspace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    /*
      allSettled rather than all: a failure in one panel should not blank
      the whole dashboard. Each section falls back to an empty state.
    */
    Promise.allSettled([
      getDashboardStats(range),
      getAttention(6),
      getActivity(8),
      getRepoOverview(),
      getAllPulls(),
    ])
      .then(([stats, attention, activity, repos, pulls]) => {
        if (cancelled) return;

        // Stats is the one panel the page cannot render without
        if (stats.status === "rejected") {
          setError(
            stats.reason instanceof Error
              ? stats.reason.message
              : "Could not load your workspace",
          );
          setData(null);
          return;
        }

        setError(null);
        setData({
          stats: stats.value,
          attention:
            attention.status === "fulfilled"
              ? attention.value
              : { blockedCount: 0, clearedCount: 0, pullRequests: [] },
          activity: activity.status === "fulfilled" ? activity.value : [],
          repos: repos.status === "fulfilled" ? repos.value : [],
          firstReviewableHref:
            pulls.status === "fulfilled"
              ? (() => {
                  const candidate = pulls.value.pullRequests.find(
                    (pr) => pr.state === "open" && !pr.review && pr.repo,
                  );
                  return candidate
                    ? `/repos/${candidate.repo!.repoId}/pulls/${candidate.prNumber}`
                    : null;
                })()
              : null,
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [range, nonce]);

  return { data, error, loading, reload };
}
