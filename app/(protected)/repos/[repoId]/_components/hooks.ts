"use client";

import { useCallback, useEffect, useState } from "react";

import { getPull, getRepo, getStoredReview, runAiReview } from "@/lib/api";
import { liveToView, type ReviewView, storedToView } from "@/lib/review";
import type { ConnectedRepo, PullRequest, StoredReviewResponse } from "@/lib/types";

type Keyed<T> = { key: string; data: T | null; error: string | null };

/** Loads the connected repository document for a GitHub repo id. */
export function useRepo(repoId: string) {
  const [state, setState] = useState<Keyed<ConnectedRepo> | null>(null);

  useEffect(() => {
    let cancelled = false;
    getRepo(repoId)
      .then((data) => !cancelled && setState({ key: repoId, data, error: null }))
      .catch(
        (err: Error) =>
          !cancelled &&
          setState({ key: repoId, data: null, error: err.message || "Could not load repository" }),
      );
    return () => {
      cancelled = true;
    };
  }, [repoId]);

  const current = state?.key === repoId ? state : null;
  const setRepo = useCallback(
    (repo: ConnectedRepo) => setState({ key: repoId, data: repo, error: null }),
    [repoId],
  );
  return { repo: current?.data ?? null, error: current?.error ?? null, setRepo };
}

/** Loads one pull request once the repository is known. */
export function usePull(repo: ConnectedRepo | null, prNumber: string) {
  const [state, setState] = useState<Keyed<PullRequest> | null>(null);
  const key = repo ? `${repo.repoId}:${prNumber}` : "";

  useEffect(() => {
    if (!repo) return;
    let cancelled = false;
    getPull(repo, prNumber)
      .then((data) => !cancelled && setState({ key, data, error: null }))
      .catch(
        (err: Error) =>
          !cancelled &&
          setState({ key, data: null, error: err.message || "Could not load pull request" }),
      );
    return () => {
      cancelled = true;
    };
  }, [repo, prNumber, key]);

  const current = state?.key === key ? state : null;
  return { pull: current?.data ?? null, error: current?.error ?? null };
}

/*
  The AI review for a pull request.

  Previously this read sessionStorage, so closing the tab lost the review and
  reopening the PR re-ran the model and billed again — and a teammate opening
  the same PR saw nothing. The server stores every run, so the review is read
  from the database and the model is only called when one is explicitly asked
  for.
*/
export function useReview(repo: ConnectedRepo | null, repoId: string, prNumber: string) {
  const [entry, setEntry] = useState<ReviewView | null>(null);
  const [runTrace, setRunTrace] = useState<StoredReviewResponse["run"]>(null);
  const [mergeGate, setMergeGate] = useState<StoredReviewResponse["mergeGate"]>("Critical");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const key = repo ? `${repo.owner}/${repo.name}#${prNumber}` : "";

  // Load whatever is already on file. No model call, no charge.
  useEffect(() => {
    if (!repo) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    getStoredReview(repo, prNumber)
      .then((data) => {
        if (cancelled) return;
        if (data) {
          setEntry(storedToView(data.review));
          setRunTrace(data.run);
          setMergeGate(data.mergeGate);
        } else {
          // Not an error — this PR simply has not been reviewed yet
          setEntry(null);
          setRunTrace(null);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load the review");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [repo, prNumber, key]);

  const run = useCallback(
    async (context?: string) => {
      if (!repo) return;
      setRunning(true);
      setError(null);
      const started = performance.now();

      try {
        const review = await runAiReview(repo, prNumber, context);

        // Show the fresh result straight away...
        setEntry(liveToView(review, Math.round(performance.now() - started)));

        /*
          ...then reconcile with what the server stored. The stored copy has
          normalised scores and severities and carries the run trace, so the
          screen ends up showing exactly what everyone else will see.
        */
        const stored = await getStoredReview(repo, prNumber);
        if (stored) {
          setEntry(storedToView(stored.review));
          setRunTrace(stored.run);
          setMergeGate(stored.mergeGate);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "The AI review failed");
      } finally {
        setRunning(false);
      }
    },
    [repo, prNumber],
  );

  return {
    entry,
    review: entry?.review ?? null,
    runTrace,
    mergeGate,
    loading,
    running,
    error,
    run,
  };
}
