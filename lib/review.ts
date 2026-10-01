import type { ReviewFinding, ReviewResult, Severity, StoredReview } from "./types";

export const SEVERITIES: Severity[] = ["Critical", "High", "Medium", "Low"];

export type SeverityTone = "critical" | "high" | "medium" | "low";

export function severityTone(severity: string | undefined): SeverityTone {
  switch ((severity || "").toLowerCase()) {
    case "critical":
      return "critical";
    case "high":
      return "high";
    case "medium":
      return "medium";
    default:
      return "low";
  }
}

export function severityRank(severity: string | undefined) {
  return SEVERITIES.findIndex((s) => s.toLowerCase() === (severity || "").toLowerCase());
}

export function sortFindings(findings: ReviewFinding[] = []) {
  return [...findings].sort((a, b) => {
    const ra = severityRank(a.severity);
    const rb = severityRank(b.severity);
    return (ra === -1 ? 99 : ra) - (rb === -1 ? 99 : rb);
  });
}

export function countBySeverity(findings: ReviewFinding[] = []) {
  const counts: Record<SeverityTone, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const finding of findings) counts[severityTone(finding.severity)] += 1;
  return counts;
}

/**
 * The model returns scores on a 0–10 scale; the design shows 0–100.
 * Anything already above 10 is treated as a percentage.
 */
export function toPercent(score: number | undefined | null): number | null {
  if (score === undefined || score === null || Number.isNaN(Number(score))) return null;
  const value = Number(score);
  return Math.round(value <= 10 ? value * 10 : value);
}

/** Text colour class for a 0–100 score: ≥85 pass, ≥60 high/amber, else critical. */
export function scoreTextClass(percent: number | null) {
  if (percent === null) return "text-fg-subtle";
  if (percent >= 85) return "text-pass";
  if (percent >= 60) return "text-high";
  return "text-critical";
}

export function scoreBarClass(percent: number | null) {
  if (percent === null) return "bg-line";
  if (percent >= 85) return "bg-pass-solid";
  if (percent >= 60) return "bg-high-solid";
  return "bg-critical-solid";
}

/** The merge gate holds when the review has any Critical or High finding. */
export function gateHeld(review: ReviewResult | null | undefined) {
  if (!review) return false;
  const counts = countBySeverity(review.findings);
  return counts.critical > 0 || counts.high > 0;
}

export function isApprove(review: ReviewResult | null | undefined) {
  return (review?.recommendation || "").toLowerCase().includes("approve");
}

/*
  A review as the screens consume it.

  The server stores every review (scores already 0–100, severities already
  normalised), so this is built from GET /pr/review/... rather than from
  sessionStorage. Scores here are ALWAYS 0–100 — do not pass them through
  toPercent() again, which would multiply a genuinely low score by ten.
*/
export interface ReviewView {
  review: ReviewResult;
  ranAt: string;
  durationMs?: number;
  /** "stored" came from the database; "live" is a run that just finished. */
  source: "stored" | "live";
  trigger?: string;
  counts?: { total: number; critical: number; high: number; medium: number; low: number };
  fileDistribution?: { file: string; count: number }[];
}

/**
 * Turns the stored shape into the one the screens already render.
 * Scores are left as they are because the server normalised them on write.
 */
export function storedToView(stored: StoredReview): ReviewView {
  return {
    review: {
      summary: stored.summary ?? "",
      overallScore: stored.overallScore,
      securityScore: stored.securityScore,
      performanceScore: stored.performanceScore,
      qualityScore: stored.qualityScore,
      findings: (stored.findings ?? []).map((finding) => ({
        severity: finding.severity,
        file: finding.file ?? "",
        issue: finding.issue ?? "",
        reason: finding.reason ?? "",
        suggestion: finding.suggestion ?? "",
      })),
      strengths: stored.strengths ?? [],
      recommendation: stored.recommendation ?? "Request Changes",
    },
    ranAt: stored.createdAt,
    durationMs: stored.durationMs,
    source: "stored",
    trigger: stored.trigger,
    counts: stored.counts,
    fileDistribution: stored.fileDistribution,
  };
}

/**
 * A review that has just come back from POST /pr/ai-review, which still
 * uses the model's 0–10 scale. Converted here so every consumer sees 0–100.
 */
export function liveToView(review: ReviewResult, durationMs: number): ReviewView {
  return {
    review: {
      ...review,
      overallScore: toPercent(review.overallScore) ?? 0,
      securityScore: toPercent(review.securityScore) ?? 0,
      performanceScore: toPercent(review.performanceScore) ?? 0,
      qualityScore: toPercent(review.qualityScore) ?? 0,
    },
    ranAt: new Date().toISOString(),
    durationMs,
    source: "live",
    trigger: "manual",
  };
}

/*
  Vocabulary for scores and severities.

  Both were previously presented as bare assertions — a number with no
  denominator and a coloured word with no definition. Two engineers reading
  the same "High" badge would disagree about whether it should block a
  merge, which makes the merge gate arbitrary.
*/

export type ScoreBand = "Strong" | "Fair" | "Weak" | "Poor";

/** A 0–100 score as a word, so the number is interpretable at a glance. */
export function scoreBand(percent: number | null | undefined): ScoreBand | null {
  if (percent === null || percent === undefined) return null;
  if (percent >= 85) return "Strong";
  if (percent >= 70) return "Fair";
  if (percent >= 50) return "Weak";
  return "Poor";
}

export const SCORE_SCALE_HELP =
  "Scored 0–100 by the review model. 85+ strong, 70–84 fair, 50–69 weak, below 50 poor.";

/**
 * What each severity actually means. Shown from any badge so the labels
 * carry a fixed definition rather than each reader's assumption.
 */
export const SEVERITY_DEFINITIONS: Record<Severity, string> = {
  Critical:
    "Exploitable now, or loses data. Fix before merging — this is what the merge gate blocks on by default.",
  High: "Exploitable under conditions you should assume will happen, or a serious correctness bug.",
  Medium: "A real defect with limited blast radius, or a problem that will bite under load.",
  Low: "Worth knowing about. Style, duplication, or a risk that needs an unlikely combination to matter.",
};

export const HEALTH_HELP =
  "The average of the newest review score for each pull request in this repository over the selected period. Fixing findings raises it.";

/** Which findings moved a score, phrased for a tooltip. */
export function scoreDrivers(counts?: {
  critical: number;
  high: number;
  medium: number;
  low: number;
}) {
  if (!counts) return null;

  const parts: string[] = [];
  if (counts.critical) parts.push(`${counts.critical} Critical`);
  if (counts.high) parts.push(`${counts.high} High`);
  if (counts.medium) parts.push(`${counts.medium} Medium`);
  if (counts.low) parts.push(`${counts.low} Low`);

  if (parts.length === 0) return "No findings were raised.";
  return `Driven by ${parts.join(", ")}.`;
}
