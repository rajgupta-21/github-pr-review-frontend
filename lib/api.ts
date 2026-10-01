// One typed client for every route the Express backend exposes today.
// Components should call these rather than hand-rolling fetch + URLs.
import type {
  ActivityEntry,
  AttentionPull,
  ConnectedRepo,
  CrossRepoPull,
  DashboardStats,
  GithubRepo,
  MeResponse,
  PullRequest,
  PullRequestCheck,
  PullRequestCommit,
  PullRequestFile,
  PullRequestReviewer,
  RepoHealth,
  RepoOverviewEntry,
  RepoReviewSummary,
  ReviewResult,
  StoredReviewResponse,
  TimelineEntry,
  StoredWorkflow,
  WorkflowDefinition,
  WorkflowExecutionResult,
  WorkflowGraphEdge,
  WorkflowGraphNode,
} from "./types";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:4000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...init,
    headers,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(data?.message || `Request failed (${response.status})`, response.status);
  }
  return data as T;
}

const enc = encodeURIComponent;

/* ─── auth ─────────────────────────────────────────────── */

export const githubLoginUrl = `${API_BASE}/auth/github`;

export function getMe() {
  return request<MeResponse>("/auth/me");
}

export function login(email: string, password: string) {
  return request<{ message: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function register(name: string, email: string, password: string) {
  return request<{ message: string }>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
}

export function logout() {
  // The backend registers this route as "/auth/logut".
  return request<{ message: string }>("/auth/logut");
}

/* ─── repositories ─────────────────────────────────────── */

export function getGithubRepos() {
  return request<GithubRepo[]>("/user/repo");
}

export async function getConnectedRepos() {
  const data = await request<{ connectedRepos: ConnectedRepo[] }>("/repo/connected");
  return data.connectedRepos ?? [];
}

export async function connectRepo(repo: { repoId: number; owner: string; fullName: string }) {
  const data = await request<{ connectedRepo: ConnectedRepo }>("/repo/connect", {
    method: "POST",
    body: JSON.stringify(repo),
  });
  return data.connectedRepo;
}

export async function getRepo(repoId: number | string) {
  const data = await request<{ fetchData: ConnectedRepo }>(`/user/repo/${enc(String(repoId))}`);
  return data.fetchData;
}

/* ─── pull requests ────────────────────────────────────── */

/** Fetches every PR (open and closed) from GitHub and upserts them. */
export async function getRepoPulls(repo: Pick<ConnectedRepo, "owner" | "name" | "userId">) {
  const data = await request<{ prs: PullRequest[] }>(
    `/repo/pr-all/${enc(repo.owner)}/${enc(repo.name)}/${enc(repo.userId)}`,
  );
  return data.prs ?? [];
}

export async function getPull(
  repo: Pick<ConnectedRepo, "owner" | "name" | "userId">,
  prNumber: number | string,
) {
  const data = await request<{ pr: PullRequest }>(
    `/user/pull-request/${enc(repo.owner)}/${enc(repo.name)}/${enc(String(prNumber))}/${enc(repo.userId)}`,
  );
  return data.pr;
}

export async function getPullFiles(
  repo: Pick<ConnectedRepo, "owner" | "name" | "userId">,
  prNumber: number | string,
) {
  try {
    const data = await request<{ filesChanged: PullRequestFile[] }>(
      `/pr/files-changed/${enc(repo.owner)}/${enc(repo.name)}/${enc(String(prNumber))}/${enc(repo.userId)}`,
    );
    return data.filesChanged ?? [];
  } catch (error) {
    // The backend answers 400 "no files changed" for an empty PR.
    if (error instanceof ApiError && error.status === 400) return [];
    throw error;
  }
}

export async function runAiReview(
  repo: Pick<ConnectedRepo, "owner" | "name" | "userId">,
  prNumber: number | string,
  context?: string,
) {
  const data = await request<{ review: ReviewResult }>("/pr/ai-review", {
    method: "POST",
    body: JSON.stringify({
      userId: repo.userId,
      owner: repo.owner,
      repoName: repo.name,
      pr_Number: prNumber,
      context: context || undefined,
    }),
  });
  return data.review;
}

/* ─── workflows ────────────────────────────────────────── */

export function getWorkflow(repoId: number) {
  return request<{ workflow: StoredWorkflow; webhookActive: boolean }>(
    `/user/workflow?repoId=${enc(String(repoId))}`,
  );
}

export function saveWorkflow(payload: {
  repoId: number;
  nodes: WorkflowGraphNode[];
  edges: WorkflowGraphEdge[];
  workflow?: WorkflowDefinition;
}) {
  return request<{ workflow: StoredWorkflow; webhookActive: boolean }>("/user/workflow", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function executeWorkflow(payload: {
  repoId: number;
  prNumber: number;
  trigger?: string;
  nodes?: WorkflowGraphNode[];
  edges?: WorkflowGraphEdge[];
}) {
  const data = await request<{ result: WorkflowExecutionResult }>("/user/workflow/execute", {
    method: "POST",
    body: JSON.stringify({ trigger: "manual_trigger", ...payload }),
  });
  return data.result;
}

export function enableWebhook(repoId: number) {
  return request<{ webhookActive: boolean; webhookId?: number }>("/user/workflow/webhook/enable", {
    method: "POST",
    body: JSON.stringify({ repoId }),
  });
}

/* ─── stored reviews ───────────────────────────────────────── */

/**
 * The review already on file for a PR. Returns null when none has been run,
 * so a caller can offer to run one instead of paying for a model call just
 * to find out.
 */
export async function getStoredReview(
  repo: Pick<ConnectedRepo, "owner" | "name">,
  prNumber: number | string,
) {
  try {
    return await request<StoredReviewResponse>(
      `/pr/review/${enc(repo.owner)}/${enc(repo.name)}/${enc(String(prNumber))}`,
    );
  } catch (error) {
    // 404 means "not reviewed yet", which is a normal state, not a failure
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/* ─── PR detail tabs ───────────────────────────────────────── */

export async function getPullCommits(
  repo: Pick<ConnectedRepo, "owner" | "name">,
  prNumber: number | string,
) {
  const data = await request<{ commits: PullRequestCommit[] }>(
    `/pr/commits/${enc(repo.owner)}/${enc(repo.name)}/${enc(String(prNumber))}`,
  );
  return data.commits ?? [];
}

export async function getPullTimeline(
  repo: Pick<ConnectedRepo, "owner" | "name">,
  prNumber: number | string,
) {
  return request<{ timeline: TimelineEntry[]; reviewers: PullRequestReviewer[] }>(
    `/pr/timeline/${enc(repo.owner)}/${enc(repo.name)}/${enc(String(prNumber))}`,
  );
}

export async function getPullChecks(
  repo: Pick<ConnectedRepo, "owner" | "name">,
  prNumber: number | string,
) {
  const data = await request<{ headSha: string; checks: PullRequestCheck[] }>(
    `/pr/checks/${enc(repo.owner)}/${enc(repo.name)}/${enc(String(prNumber))}`,
  );
  return data.checks ?? [];
}

/* ─── dashboard aggregates ─────────────────────────────────── */

/*
These replace the old pattern of fetching every repo's PRs in the browser
and computing totals there — one request per repo, on every page load.
*/

export function getDashboardStats(days: 7 | 30 | 90 = 7) {
  return request<DashboardStats>(`/user/dashboard/stats?days=${days}`);
}

export async function getAttention(limit = 10) {
  const data = await request<{
    blockedCount: number;
    clearedCount: number;
    pullRequests: AttentionPull[];
  }>(`/user/dashboard/attention?limit=${limit}`);
  return data;
}

export async function getActivity(limit = 15) {
  const data = await request<{ activity: ActivityEntry[] }>(
    `/user/dashboard/activity?limit=${limit}`,
  );
  return data.activity ?? [];
}

/* ─── repository aggregates ────────────────────────────────── */

/** Connected repos with health, findings and workflow state in one query. */
export async function getRepoOverview() {
  const data = await request<{ repositories: RepoOverviewEntry[] }>(
    "/repo/overview",
  );
  return data.repositories ?? [];
}

export function getRepoHealth(repoId: number | string, days = 30) {
  return request<RepoHealth>(
    `/repo/health/${enc(String(repoId))}?days=${days}`,
  );
}

/* ─── repository management ────────────────────────────────── */

export function updateRepoSettings(
  repoId: number,
  settings: {
    autoReview?: boolean;
    mergeGate?: "none" | "Critical" | "High" | "Medium" | "Low";
    paused?: boolean;
  },
) {
  return request<{ repo: ConnectedRepo }>(`/repo/settings/${enc(String(repoId))}`, {
    method: "PATCH",
    body: JSON.stringify(settings),
  });
}

export function disconnectRepo(repoId: number) {
  return request<{ webhookRemoved: boolean; repoId: number }>(
    `/repo/disconnect/${enc(String(repoId))}`,
    { method: "DELETE" },
  );
}

/* ─── workflow runs ────────────────────────────────────────── */

export async function getWorkflowRuns(repoId: number, limit = 20) {
  const data = await request<{
    summary: { total: number; completed: number; failed: number; skipped: number };
    runs: (ActivityEntry & { steps: unknown[] })[];
  }>(`/user/workflow/runs?repoId=${enc(String(repoId))}&limit=${limit}`);
  return data;
}

/**
 * Latest review per PR for one repository, keyed by PR number.
 * Lets a PR list show scores and finding counts without a request per row.
 */
export async function getRepoReviews(repoId: number | string) {
  const data = await request<{
    reviews: Record<string, RepoReviewSummary>;
    mergeGate: string;
  }>(`/repo/reviews/${enc(String(repoId))}`);
  return data;
}

/* ─── acting on a pull request ─────────────────────────────── */

/*
These close the loop that previously required opening github.com. Each one
acts under the signed-in user's own GitHub token, so the comment, approval
or merge is attributed to them.
*/

/** Posts a comment on the PR thread, optionally quoting the finding replied to. */
export function commentOnPull(
  repoId: number | string,
  prNumber: number | string,
  body: string,
  quote?: string,
) {
  return request<{ comment: { id: number; htmlUrl: string; createdAt: string } }>(
    `/pr/${enc(String(repoId))}/${enc(String(prNumber))}/comment`,
    { method: "POST", body: JSON.stringify({ body, quote }) },
  );
}

/** Approves, requests changes, or leaves a review comment. */
export function submitPullReview(
  repoId: number | string,
  prNumber: number | string,
  event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT",
  body?: string,
) {
  return request<{ message: string; review: { id: number; state: string; htmlUrl: string } }>(
    `/pr/${enc(String(repoId))}/${enc(String(prNumber))}/review`,
    { method: "POST", body: JSON.stringify({ event, body }) },
  );
}

export class MergeBlockedError extends ApiError {
  gate: string;
  blockingCount: number;
  constructor(message: string, gate: string, blockingCount: number) {
    super(message, 409);
    this.gate = gate;
    this.blockingCount = blockingCount;
  }
}

/**
 * Merges the PR. The merge gate is enforced by the server, so a held PR
 * throws MergeBlockedError — pass `override` with a reason to proceed,
 * which is recorded as a comment on the pull request.
 */
export async function mergePull(
  repoId: number | string,
  prNumber: number | string,
  options: {
    method?: "merge" | "squash" | "rebase";
    override?: boolean;
    overrideReason?: string;
  } = {},
) {
  const path = `/pr/${enc(String(repoId))}/${enc(String(prNumber))}/merge`;

  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method: "merge", ...options }),
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 409 && data?.action === "merge blocked") {
    throw new MergeBlockedError(data.message, data.gate, data.blockingCount);
  }

  if (!response.ok) {
    throw new ApiError(data?.message || `Request failed (${response.status})`, response.status);
  }

  return data as { merged: boolean; sha: string };
}

/* ─── finding feedback ─────────────────────────────────────── */

/*
Human verdicts on AI findings. Without these the model is presented as
correct by construction, and a confidently wrong finding leaves the user
with nothing to do but stop trusting the tool.
*/

export function submitFindingFeedback(
  reviewId: string,
  findingIndex: number,
  verdict: "helpful" | "not_helpful" | "false_positive",
  reason?: string,
) {
  return request<{ message: string; dismissedAtThisSeverity: number }>(
    `/pr/feedback/${enc(reviewId)}/${findingIndex}`,
    { method: "POST", body: JSON.stringify({ verdict, reason }) },
  );
}

export async function getFindingFeedback(reviewId: string) {
  const data = await request<{
    feedback: Record<string, { verdict: string; reason?: string }>;
  }>(`/pr/feedback/${enc(reviewId)}`);
  return data.feedback ?? {};
}

/**
 * Every pull request across connected repositories, with its newest review.
 * Replaces opening each repository in turn to find what is waiting on you.
 */
export async function getAllPulls() {
  return request<{
    authors: string[];
    repositories: { repoId: number; fullName: string }[];
    pullRequests: CrossRepoPull[];
  }>("/user/pulls");
}
