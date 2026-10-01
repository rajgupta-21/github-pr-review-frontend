"use client";

import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { RepoOverviewEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

/*
  First-run checklist.

  A new user signed up, landed on an empty dashboard and got no sense of
  what "set up" looked like. Worse: after connecting a repository they had
  to *wait for someone to open a pull request* — possibly days — before the
  product did anything at all. Nothing demonstrated value in the first
  session.

  Step three fixes that by pointing at a pull request that already exists,
  so the first review can happen immediately.

  The whole card disappears once all three are done; a permanent checklist
  becomes furniture.
*/

export function SetupChecklist({
  repos,
  hasReview,
  firstReviewableHref,
}: {
  repos: RepoOverviewEntry[];
  /** Has any review ever been stored for this account? */
  hasReview: boolean;
  /** A PR that exists right now and could be reviewed immediately. */
  firstReviewableHref: string | null;
}) {
  const connected = repos.length > 0;
  const withWorkflow = repos.some((repo) => repo.workflow.nodeCount > 0);

  // Everything done — stop taking up space
  if (connected && withWorkflow && hasReview) return null;

  const steps = [
    {
      done: connected,
      title: "Connect a repository",
      body: "Pick one from your GitHub account. Nothing runs until you say so.",
      action: { label: "Connect a repository", href: "/repos" },
    },
    {
      done: withWorkflow,
      title: "Give it a workflow",
      body: "A workflow decides what happens on each pull request — which reviews run, and what to do with the result.",
      action: { label: "Build a workflow", href: "/workflow" },
    },
    {
      done: hasReview,
      title: "See your first review",
      body: firstReviewableHref
        ? "You already have a pull request we can review. No need to wait for a new one."
        : "Open a pull request on a connected repository and the review starts automatically.",
      action: firstReviewableHref
        ? { label: "Review a pull request now", href: firstReviewableHref }
        : null,
    },
  ];

  const doneCount = steps.filter((step) => step.done).length;
  // The first step that is not done is the one to act on
  const current = steps.findIndex((step) => !step.done);

  return (
    <Card className="mt-6 border-violet-200 bg-violet-50/40">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5">
        <h2 className="font-display text-[19px] font-bold text-fg">Finish setting up</h2>
        <span className="text-[13px] text-fg-muted">{doneCount} of 3 done</span>
      </div>

      <ol className="flex flex-col gap-3 px-5 py-4">
        {steps.map((step, index) => (
          <li key={step.title} className="flex items-start gap-3">
            <span
              className={cn(
                "mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border text-[12px] font-semibold",
                step.done
                  ? "border-transparent bg-pass-solid text-white"
                  : index === current
                    ? "border-transparent bg-violet-500 text-white"
                    : "border-line-strong bg-surface text-fg-subtle",
              )}
            >
              {step.done ? <Check className="size-3.5" aria-hidden="true" /> : index + 1}
            </span>

            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-[14.5px] font-semibold",
                  step.done ? "text-fg-muted line-through" : "text-fg",
                )}
              >
                {step.title}
              </p>
              {!step.done ? (
                <p className="mt-0.5 text-[13.5px] leading-[1.5] text-fg-muted">{step.body}</p>
              ) : null}
            </div>

            {/* Only the current step gets a button — three CTAs is no CTA */}
            {!step.done && index === current && step.action ? (
              <Button asChild variant="primary" size="sm" className="shrink-0">
                <Link href={step.action.href}>
                  {step.action.label}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            ) : null}
          </li>
        ))}
      </ol>
    </Card>
  );
}
