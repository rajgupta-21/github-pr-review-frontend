"use client";

import { Check, ChevronDown, GitPullRequest, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { getRepoPulls } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import type { ConnectedRepo, PullRequest } from "@/lib/types";
import { cn } from "@/lib/utils";

/*
  Picks a pull request by name.

  This replaces a bare `<input type="number" placeholder="PR #">`, which
  required the user to go to github.com, read a number, and type it back —
  the single clearest example of the app depending on GitHub's interface.

  Nobody thinks of a pull request as a number. They think "Priya's session
  refresh one", so the list leads with the title and carries the number as
  secondary. Typing still works for a PR that isn't listed (very old, or
  opened seconds ago), so the picker never becomes a dead end.
*/

type PrPickerProps = {
  repo: Pick<ConnectedRepo, "owner" | "name" | "userId"> | null;
  value: string;
  onChange: (prNumber: string) => void;
  /** Dark chrome (workflow topbar) vs light surfaces. */
  tone?: "dark" | "light";
  className?: string;
  disabled?: boolean;
};

export function PrPicker({
  repo,
  value,
  onChange,
  tone = "light",
  className,
  disabled,
}: PrPickerProps) {
  const [open, setOpen] = useState(false);
  const [pulls, setPulls] = useState<PullRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  /*
    Loaded when the menu first opens rather than on mount — the picker sits
    in a toolbar that is rendered on every workflow visit, and most visits
    never touch it.
  */
  useEffect(() => {
    if (!open || !repo || pulls !== null) return;

    let cancelled = false;
    getRepoPulls(repo)
      .then((list) => !cancelled && setPulls(list))
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load pull requests");
        setPulls([]);
      });

    return () => {
      cancelled = true;
    };
  }, [open, repo, pulls]);

  // Repository changed — the cached list belongs to the old one
  useEffect(() => {
    setPulls(null);
    setError(null);
  }, [repo?.owner, repo?.name]);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Open PRs first — a workflow run on a merged PR is skipped anyway
  const sorted = useMemo(() => {
    const list = pulls ?? [];
    return [...list].sort((a, b) => {
      const aOpen = a.state === "open" && !a.mergedAtGithub;
      const bOpen = b.state === "open" && !b.mergedAtGithub;
      if (aOpen !== bOpen) return aOpen ? -1 : 1;
      return (
        new Date(b.updatedAtGithub).getTime() - new Date(a.updatedAtGithub).getTime()
      );
    });
  }, [pulls]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return sorted;
    return sorted.filter(
      (pr) =>
        String(pr.githubPrNumber).includes(term) ||
        pr.title?.toLowerCase().includes(term) ||
        pr.author?.login?.toLowerCase().includes(term) ||
        pr.sourceBranch?.toLowerCase().includes(term),
    );
  }, [sorted, query]);

  const selected = useMemo(
    () => (pulls ?? []).find((pr) => String(pr.githubPrNumber) === value) ?? null,
    [pulls, value],
  );

  const dark = tone === "dark";

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled || !repo}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex h-9 w-full items-center gap-2 rounded-[9px] border px-2.5 text-left text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          dark
            ? "border-ink-line-strong bg-transparent text-ink-fg hover:border-violet-400"
            : "border-line-strong bg-surface text-fg hover:border-violet-400",
        )}
      >
        <GitPullRequest
          className={cn("size-3.5 shrink-0", dark ? "text-ink-subtle" : "text-fg-faint")}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 truncate">
          {value ? (
            <>
              <span className="font-mono">#{value}</span>
              {selected ? (
                <span className={dark ? "text-ink-muted" : "text-fg-muted"}>
                  {" "}
                  {selected.title}
                </span>
              ) : null}
            </>
          ) : (
            <span className={dark ? "text-ink-subtle" : "text-fg-faint"}>
              Choose a pull request
            </span>
          )}
        </span>
        <ChevronDown
          className={cn("size-3.5 shrink-0", dark ? "text-ink-subtle" : "text-fg-faint")}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Pull requests"
          className="absolute right-0 z-50 mt-1.5 max-h-[380px] w-[380px] max-w-[calc(100vw-32px)] overflow-hidden rounded-xl border border-line-strong bg-surface shadow-[0_12px_32px_rgba(20,18,42,0.18)]"
        >
          <div className="relative border-b border-line-soft">
            <Search
              className="pointer-events-none absolute top-3 left-3 size-3.5 text-fg-faint"
              aria-hidden="true"
            />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by title, number, author or branch"
              aria-label="Search pull requests"
              className="h-11 w-full bg-transparent pr-3 pl-9 text-[13.5px] text-fg outline-none placeholder:text-fg-faint"
            />
          </div>

          <div className="max-h-[320px] overflow-y-auto py-1">
            {pulls === null ? (
              <p className="px-3 py-6 text-center text-[13px] text-fg-subtle">
                Loading pull requests…
              </p>
            ) : error ? (
              <p className="px-3 py-6 text-center text-[13px] text-critical">{error}</p>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-6 text-center">
                <p className="text-[13px] text-fg-subtle">
                  {query ? "No pull requests match." : "No pull requests on this repository."}
                </p>
                {/* Never a dead end: a number can still be entered by hand */}
                {query && /^\d+$/.test(query.trim()) ? (
                  <button
                    type="button"
                    onClick={() => {
                      onChange(query.trim());
                      setOpen(false);
                      setQuery("");
                    }}
                    className="mt-2 text-[13px] font-medium text-violet-600 hover:underline"
                  >
                    Use #{query.trim()} anyway
                  </button>
                ) : null}
              </div>
            ) : (
              filtered.map((pr) => {
                const isOpen = pr.state === "open" && !pr.mergedAtGithub;
                const isSelected = String(pr.githubPrNumber) === value;

                return (
                  <button
                    key={pr._id ?? pr.githubPrNumber}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(String(pr.githubPrNumber));
                      setOpen(false);
                      setQuery("");
                    }}
                    className={cn(
                      "flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-surface-sunken",
                      isSelected && "bg-violet-50",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-[3px] size-2 shrink-0 rounded-full",
                        pr.mergedAtGithub
                          ? "bg-violet-500"
                          : isOpen
                            ? "bg-pass-solid"
                            : "bg-fg-faint",
                      )}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-1.5">
                        <span className="font-mono text-[12px] text-fg-subtle">
                          #{pr.githubPrNumber}
                        </span>
                        <span className="truncate text-[13.5px] font-medium text-fg">
                          {pr.title}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-[12px] text-fg-subtle">
                        {pr.author?.login}
                        {" · "}
                        {pr.mergedAtGithub ? "merged" : isOpen ? "open" : "closed"}
                        {pr.updatedAtGithub ? ` · ${timeAgo(pr.updatedAtGithub)}` : ""}
                      </span>
                    </span>
                    {isSelected ? (
                      <Check className="mt-0.5 size-3.5 shrink-0 text-violet-600" aria-hidden="true" />
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
