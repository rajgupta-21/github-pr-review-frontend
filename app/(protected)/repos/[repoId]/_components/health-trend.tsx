"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";

import { Card, CardHeader } from "@/components/ui/card";
import { InfoHint, Tooltip } from "@/components/ui/tooltip";
import { getRepoHealth } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { HEALTH_HELP, scoreBand, scoreTextClass } from "@/lib/review";
import type { RepoHealth } from "@/lib/types";
import { cn } from "@/lib/utils";

/*
  Is this repository getting better?

  Every review stood alone, so the question was unanswerable in the UI even
  though the server has kept a 30-day trend and a per-file finding
  distribution the whole time. "Security up 12 this month" is the line that
  justifies the invoice.
*/

export function HealthTrend({ repoId }: { repoId: string }) {
  const [health, setHealth] = useState<RepoHealth | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getRepoHealth(repoId, 30)
      .then((data) => !cancelled && setHealth(data))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [repoId]);

  // A repo with no reviews yet has nothing to trend — stay out of the way
  if (failed || !health || health.trend.length === 0) return null;

  const improving = health.change >= 0;
  const Arrow = improving ? TrendingUp : TrendingDown;

  return (
    <Card>
      <CardHeader title="Repository health">
        <InfoHint label="How is health calculated?">{HEALTH_HELP}</InfoHint>
      </CardHeader>

      <div className="px-5 py-4">
        <div className="flex items-baseline gap-2.5">
          <span
            className={cn(
              "font-display text-[34px] font-bold tracking-[-0.03em]",
              scoreTextClass(health.currentScore),
            )}
          >
            {health.currentScore ?? "—"}
          </span>
          <span className="text-[14px] text-fg-faint">/100</span>
          <span className="text-[13px] text-fg-muted">{scoreBand(health.currentScore)}</span>

          {health.change !== 0 ? (
            <span
              className={cn(
                "ml-auto inline-flex items-center gap-1 text-[13px] font-semibold",
                improving ? "text-pass" : "text-critical",
              )}
            >
              <Arrow className="size-3.5" aria-hidden="true" />
              {improving ? "+" : ""}
              {health.change} in 30 days
            </span>
          ) : null}
        </div>

        <Sparkline trend={health.trend} />

        {health.files.length > 0 ? (
          <div className="mt-5">
            <h3 className="text-[13px] font-semibold text-fg">Where the findings are</h3>
            <ul className="mt-2.5 flex flex-col gap-2.5">
              {health.files.slice(0, 5).map((file) => (
                <li key={file.file}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate font-mono text-[12.5px] text-fg-2">{file.file}</span>
                    <span className="shrink-0 text-[12.5px] text-fg-subtle">{file.total}</span>
                  </div>
                  {/* Proportional severity bar — where the risk concentrates */}
                  <div className="mt-1.5 flex h-[7px] gap-[3px] overflow-hidden rounded-full">
                    {(
                      [
                        ["critical", file.critical, "bg-critical-solid"],
                        ["high", file.high, "bg-high-solid"],
                        ["medium", file.medium, "bg-medium-solid"],
                        ["low", file.low, "bg-low-solid"],
                      ] as const
                    )
                      .filter(([, count]) => count > 0)
                      .map(([key, count, className]) => (
                        <Tooltip key={key} content={`${count} ${key}`}>
                          <span
                            className={cn("block h-full rounded-full", className)}
                            style={{ width: `${(count / file.total) * 100}%`, minWidth: 6 }}
                          />
                        </Tooltip>
                      ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

/* A plain inline SVG — no chart library for one sparkline. */
function Sparkline({ trend }: { trend: RepoHealth["trend"] }) {
  if (trend.length < 2) {
    return (
      <p className="mt-3 text-[12.5px] text-fg-subtle">
        One review so far. The trend appears once there are a few more.
      </p>
    );
  }

  const width = 280;
  const height = 56;
  const scores = trend.map((point) => point.score);
  const min = Math.min(...scores, 0);
  const max = Math.max(...scores, 100);
  const range = max - min || 1;

  const points = trend
    .map((point, index) => {
      const x = (index / (trend.length - 1)) * width;
      const y = height - ((point.score - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const last = trend[trend.length - 1]!;
  const first = trend[0]!;

  return (
    <>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`Health moved from ${first.score} to ${last.score} over ${trend.length} days with reviews`}
      >
        <polyline
          points={points}
          fill="none"
          stroke={last.score >= first.score ? "var(--color-pass-solid)" : "var(--color-critical-solid)"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="flex justify-between text-[11.5px] text-fg-faint">
        <span>{formatDate(first.date)}</span>
        <span>{formatDate(last.date)}</span>
      </div>
    </>
  );
}
