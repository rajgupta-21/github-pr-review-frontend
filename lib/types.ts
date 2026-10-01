// Shapes returned by the Express backend (backend/src). Keep in sync with the
// controllers — these mirror what they actually send, not what we wish they sent.

export interface User {
  _id: string;
  name?: string;
  email: string | null;
  role: string;
  githubConnected: boolean;
  githubId?: string;
  githubUsername?: string;
  githubAvatarUrl?: string;
  plan: string;
  createdAt?: string;
}

export interface MeResponse {
  authenticated: boolean;
  user: User;
}

/** GET /user/repo — the user's repositories straight from GitHub */
export interface GithubRepo {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  private: boolean;
  defaultBranch: string;
  language: string | null;
  htmlUrl: string;
}

export interface WorkflowGraphNode {
  id: string;
  type?: string;
  position?: { x: number; y: number };
  data?: {
    label?: string;
    nodeType?: string;
    config?: Record<string, string | number | boolean>;
    workflow?: { function?: string; status?: string };
    [key: string]: unknown;
  };
}

export interface WorkflowGraphEdge {
  id?: string;
  source: string;
  target: string;
  [key: string]: unknown;
}

export interface WorkflowDefinition {
  name: string;
  status: "draft" | "active" | "disabled";
  steps: Array<{
    id: string;
    name: string;
    type: string;
    function: string;
    status: string;
  }>;
}

export interface StoredWorkflow {
  nodes: WorkflowGraphNode[];
  edges: WorkflowGraphEdge[];
  definition?: WorkflowDefinition;
  updatedAt?: string;
}

/** A ConnectedRepo document (GET /repo/connected, GET /user/repo/:repoId) */
export interface ConnectedRepo {
  _id: string;
  userId: string;
  repoId: number;
  name: string;
  owner: string;
  fullName: string;
  language: string | null;
  description: string | null;
  repoUrl: string;
  webhookActive: boolean;
  webhookId?: number;
  visibility: "public" | "private";
  defaultBranch: string;
  connected: boolean;
  workflow?: StoredWorkflow;
  createdAt: string;
  updatedAt: string;
}

/** A Pr document as stored by /repo/pr-all and /user/pull-request */
export interface PullRequest {
  _id: string;
  repoId: string;
  githubPrId: number;
  githubPrNumber: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  merged?: boolean;
  draft?: boolean;
  author: { login: string; id: number; avatarUrl: string };
  sourceBranch: string;
  targetBranch: string;
  headSha?: string;
  baseSha?: string;
  githubUrl: string;
  diffUrl?: string;
  patchUrl?: string;
  commits?: number;
  additions?: number;
  deletions?: number;
  changedFiles?: number;
  aiReviewed?: boolean;
  createdAtGithub: string;
  updatedAtGithub: string;
  closedAtGithub?: string | null;
  mergedAtGithub?: string | null;
}

/** GET /pr/files-changed — raw GitHub file entries */
export interface PullRequestFile {
  sha: string;
  filename: string;
  status: "added" | "modified" | "removed" | "renamed" | "copied" | "changed" | "unchanged";
  additions: number;
  deletions: number;
  changes: number;
  blob_url: string;
  raw_url: string;
  contents_url: string;
  patch?: string;
  previous_filename?: string;
}

export type Severity = "Critical" | "High" | "Medium" | "Low";

export interface ReviewFinding {
  severity: Severity | string;
  file: string;
  issue: string;
  reason: string;
  suggestion: string;
}

/** POST /pr/ai-review → review. Scores come back from the model on a 0–10 scale. */
export interface ReviewResult {
  summary: string;
  overallScore: number;
  securityScore: number;
  performanceScore: number;
  qualityScore: number;
  findings: ReviewFinding[];
  strengths: string[];
  recommendation: "Approve" | "Request Changes" | string;
}

export type ExecutionStepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped"
  | "triggered";

export interface ExecutionStep {
  nodeId: string;
  name: string;
  function: string;
  status: ExecutionStepStatus;
  message?: string;
  error?: string;
}

export interface PRRunStatus {
  state: "open" | "closed";
  merged: boolean;
  draft: boolean;
  title: string;
  htmlUrl: string;
}

export interface WorkflowExecutionResult {
  repoId: number;
  prNumber: number;
  trigger: string;
  status: "completed" | "failed" | "skipped";
  steps: ExecutionStep[];
  review?: ReviewResult;
  prStatus?: PRRunStatus;
  message?: string;
}

/* ─── stored reviews (GET /pr/review/:owner/:repo/:prNumber) ─────────────
   The server keeps every review run. Scores here are already 0–100, unlike
   the live POST /pr/ai-review response which comes back on the model's 0–10
   scale. */

export interface StoredFinding {
  severity: Severity;
  file?: string;
  line?: number | null;
  issue?: string;
  reason?: string;
  suggestion?: string;
}

export interface StoredReview {
  _id: string;
  repoId: string;
  owner: string;
  repoName: string;
  prNumber: number;
  prTitle?: string;
  prAuthor?: string;
  summary?: string;
  recommendation?: "Approve" | "Request Changes";
  overallScore: number;
  securityScore: number;
  performanceScore: number;
  qualityScore: number;
  findings: StoredFinding[];
  strengths: string[];
  trigger: string;
  durationMs: number;
  createdAt: string;
  counts: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  fileDistribution: { file: string; count: number }[];
}

export interface StoredRunStep {
  nodeId: string;
  name: string;
  function: string;
  status: ExecutionStepStatus;
  message?: string;
  error?: string;
}

export interface StoredReviewResponse {
  review: StoredReview;
  run: {
    runId: string;
    trigger: string;
    status: "completed" | "failed" | "skipped";
    steps: StoredRunStep[];
    durationMs: number;
    createdAt: string;
  } | null;
  mergeGate: "none" | Severity;
}

/* ─── PR detail tabs ─────────────────────────────────────────────────── */

export interface PullRequestCommit {
  sha: string;
  shortSha: string;
  message: string;
  authorName?: string;
  authorLogin?: string;
  avatarUrl?: string;
  committedAt?: string;
  htmlUrl: string;
}

export interface TimelineEntry {
  id: string;
  type: "comment" | "review_comment" | "review";
  author?: string;
  avatarUrl?: string;
  body?: string | null;
  file?: string | null;
  line?: number | null;
  state?: string | null;
  createdAt?: string | null;
  htmlUrl?: string;
}

export interface PullRequestReviewer {
  login?: string;
  avatarUrl?: string;
  state?: string | null;
  submittedAt?: string | null;
}

export interface PullRequestCheck {
  id: string;
  name: string;
  status: string;
  conclusion: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  durationMs?: number | null;
  htmlUrl?: string | null;
  /** present only on our own synthetic merge-gate row */
  gate?: string;
  blockingCount?: number;
}

/* ─── dashboard & repo aggregates ────────────────────────────────────── */

export interface DashboardStats {
  windowDays: number;
  connectedRepos: number;
  stats: {
    prsReviewed: { value: number; previous: number };
    findingsRaised: {
      value: number;
      previous: number;
      bySeverity: { critical: number; high: number; medium: number; low: number };
    };
    medianReviewMs: { value: number; previous: number };
    cleanPrs: { value: number; previous: number; percentage: number };
  };
}

export interface AttentionPull {
  reviewId: string;
  repoId: string;
  githubRepoId: number;
  owner: string;
  repoName: string;
  fullName: string;
  prNumber: number;
  title?: string;
  author?: string;
  overallScore: number;
  recommendation?: string;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  reviewedAt: string;
}

export interface ActivityEntry {
  runId: string;
  repoId: string;
  githubRepoId: number;
  repoFullName: string;
  prNumber: number;
  workflowName?: string;
  trigger: string;
  status: "completed" | "failed" | "skipped";
  message?: string;
  durationMs: number;
  stepCount: number;
  failedStep: string | null;
  createdAt: string;
}

export interface RepoOverviewEntry {
  repoId: number;
  repoDocId: string;
  name: string;
  fullName: string;
  owner: string;
  description?: string | null;
  language?: string | null;
  visibility: "public" | "private";
  defaultBranch?: string;
  connected: boolean;
  webhookActive: boolean;
  /** Null until GitHub has actually delivered an event — see Settings. */
  lastWebhookDeliveryAt?: string | null;
  lastWebhookEvent?: string | null;
  settings?: { autoReview: boolean; mergeGate: string; paused: boolean };
  reviewedPrCount: number;
  openFindings: { critical: number; high: number; medium: number; low: number };
  health: number | null;
  workflow: { name: string | null; status: "none" | "paused" | "active"; nodeCount: number };
  lastReview: {
    prNumber: number;
    overallScore: number;
    trigger: string;
    reviewedAt: string;
  } | null;
}

export interface RepoHealth {
  windowDays: number;
  currentScore: number | null;
  change: number;
  trend: { date: string; score: number; reviewCount: number }[];
  files: {
    file: string;
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  }[];
}

/** GET /repo/reviews/:repoId — latest review per PR, keyed by PR number. */
export interface RepoReviewSummary {
  reviewId: string;
  prNumber: number;
  overallScore: number;
  securityScore: number;
  performanceScore: number;
  qualityScore: number;
  recommendation?: "Approve" | "Request Changes";
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  findingCount: number;
  trigger: string;
  reviewedAt: string;
}

/** GET /user/pulls — every PR across connected repositories. */
export interface CrossRepoPull {
  id: string;
  prNumber: number;
  title: string;
  state: "open" | "closed" | "merged";
  draft: boolean;
  author: string | null;
  avatarUrl: string | null;
  sourceBranch: string;
  targetBranch: string;
  updatedAt: string;
  createdAt: string;
  repo: { repoId: number; name: string; fullName: string; language: string | null } | null;
  review: {
    reviewId: string;
    overallScore: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    recommendation?: string;
    reviewedAt: string;
  } | null;
  blocked: boolean;
}
