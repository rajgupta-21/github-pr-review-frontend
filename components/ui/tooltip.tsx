"use client";

import { useId, useState } from "react";

import { cn } from "@/lib/utils";

/*
  An explanation attached to something on screen.

  The application had none. Scores, severities and the merge gate were all
  presented as bare assertions, so a number like "54" looked authoritative
  and taught nothing.

  Hover is not enough on its own — it excludes touch and keyboard — so this
  opens on focus and on tap as well, and the content is linked with
  aria-describedby rather than a title attribute, which screen readers
  announce inconsistently.
*/

export function Tooltip({
  content,
  children,
  side = "top",
  className,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span aria-describedby={open ? id : undefined} className="inline-flex">
        {children}
      </span>

      {open ? (
        <span
          role="tooltip"
          id={id}
          className={cn(
            "pointer-events-none absolute left-1/2 z-50 w-max max-w-[280px] -translate-x-1/2 rounded-lg bg-ink-900 px-2.5 py-2 text-[12.5px] leading-[1.45] text-ink-fg shadow-[0_8px_24px_rgba(20,18,42,0.22)]",
            side === "top" ? "bottom-full mb-2" : "top-full mt-2",
          )}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}

/**
 * A small "?" that carries an explanation. Use beside a label whose meaning
 * is not self-evident — a score, a composite metric, a piece of jargon.
 */
export function InfoHint({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip content={children}>
      <button
        type="button"
        aria-label={label}
        className="inline-flex size-[15px] items-center justify-center rounded-full border border-line-strong text-[10px] leading-none font-semibold text-fg-subtle transition-colors hover:border-violet-400 hover:text-violet-600"
      >
        ?
      </button>
    </Tooltip>
  );
}
