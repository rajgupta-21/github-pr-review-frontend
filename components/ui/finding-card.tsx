import { SEVERITY_DEFINITIONS, severityTone } from "@/lib/review";
import type { ReviewFinding, Severity } from "@/lib/types";
import { cn } from "@/lib/utils";

import { SeverityBadge } from "./badge";
import { Tooltip } from "./tooltip";

const STRIPE: Record<string, string> = {
  critical: "bg-critical-solid",
  high: "bg-high-solid",
  medium: "bg-medium-solid",
  low: "bg-low-solid",
};

/*
  Finding card anatomy: severity stripe, badge + file, one sentence naming the
  defect, then why it matters and the concrete change. `children` renders under
  the body (e.g. actions).
*/
function FindingCard({
  finding,
  compact = false,
  className,
  children,
  /** Stable anchor so a single finding can be linked to and shared. */
  anchorId,
  /** The lines this finding is about, so it can be judged without leaving. */
  evidence,
}: {
  finding: ReviewFinding;
  compact?: boolean;
  className?: string;
  children?: React.ReactNode;
  anchorId?: string;
  evidence?: React.ReactNode;
}) {
  const tone = severityTone(finding.severity);
  const definition = SEVERITY_DEFINITIONS[finding.severity as Severity];

  return (
    <article
      id={anchorId}
      className={cn(
        "flex overflow-hidden rounded-[13px] border border-line bg-surface",
        // Highlighted when arrived at via its own link
        "target:border-violet-400 target:ring-2 target:ring-violet-200",
        className,
      )}
    >
      <span aria-hidden="true" className={cn("w-1 shrink-0", STRIPE[tone])} />
      <div className={cn("min-w-0 flex-1", compact ? "px-[15px] py-[13px]" : "px-5 py-[18px]")}>
        <div className="flex flex-wrap items-center gap-2">
          {/*
            Severity labels were asserted and never defined, so "High" meant
            whatever each reader assumed — and two engineers would disagree
            about whether it should block a merge.
          */}
          {definition ? (
            <Tooltip content={definition}>
              <SeverityBadge severity={finding.severity} size="sm" />
            </Tooltip>
          ) : (
            <SeverityBadge severity={finding.severity} size="sm" />
          )}
          {finding.file ? (
            <span className="truncate font-mono text-[11.5px] text-violet-600">
              {finding.file}
            </span>
          ) : null}
          {anchorId ? (
            <a
              href={`#${anchorId}`}
              className="ml-auto text-[11.5px] text-fg-faint hover:text-violet-600"
              aria-label="Link to this finding"
            >
              #
            </a>
          ) : null}
        </div>
        <h3
          className={cn(
            "mt-2 font-semibold text-fg",
            compact ? "text-sm" : "text-[15.5px] leading-snug",
          )}
        >
          {finding.issue}
        </h3>
        {finding.reason ? (
          <p
            className={cn(
              "mt-1.5 text-fg-muted",
              compact ? "text-[12.5px] leading-[1.55]" : "text-sm leading-relaxed",
            )}
          >
            {finding.reason}
          </p>
        ) : null}
        {/*
          The code the finding is about. Without it the user had to trust the
          description or open github.com to check.
        */}
        {!compact && evidence ? <div className="mt-3">{evidence}</div> : null}
        {!compact && finding.suggestion ? (
          <div className="mt-3 rounded-[11px] border border-line bg-surface-sunken px-3.5 py-3">
            <div className="eyebrow">Suggested change</div>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-fg-2">
              {finding.suggestion}
            </p>
          </div>
        ) : null}
        {children}
      </div>
    </article>
  );
}

export { FindingCard };
