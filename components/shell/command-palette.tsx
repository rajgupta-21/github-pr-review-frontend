"use client";

import { BookMarked, GitPullRequest, Search, Workflow } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getAllPulls, getRepoOverview } from "@/lib/api";
import { cn } from "@/lib/utils";

/*
  Command palette — ⌘K / Ctrl+K.

  There was no way to search anything. Per-screen filters existed for
  repositories and pull requests, but "that PR about session tokens" could
  only be found by remembering which repository it was in and opening it.
  For a tool used daily by keyboard-driven people this is table stakes.

  Data is loaded on first open and kept for the session — the palette
  should feel instant, and both endpoints are already aggregated server
  side.
*/

type Item = {
  id: string;
  kind: "repo" | "pull" | "page";
  title: string;
  subtitle?: string;
  href: string;
};

const PAGES: Item[] = [
  { id: "page-dashboard", kind: "page", title: "Dashboard", href: "/dashboard" },
  { id: "page-pulls", kind: "page", title: "Pull requests", href: "/pulls" },
  { id: "page-repos", kind: "page", title: "Repositories", href: "/repos" },
  { id: "page-workflow", kind: "page", title: "Workflows", href: "/workflow" },
  { id: "page-settings", kind: "page", title: "Settings", href: "/settings" },
];

const ICON = { repo: BookMarked, pull: GitPullRequest, page: Search };

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Item[] | null>(null);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K anywhere, and Escape to leave
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const load = useCallback(async () => {
    if (items) return;
    try {
      const [repos, pulls] = await Promise.allSettled([getRepoOverview(), getAllPulls()]);

      const next: Item[] = [...PAGES];

      if (repos.status === "fulfilled") {
        for (const repo of repos.value) {
          next.push({
            id: `repo-${repo.repoId}`,
            kind: "repo",
            title: repo.fullName,
            subtitle: repo.language ?? undefined,
            href: `/repos/${repo.repoId}`,
          });
        }
      }

      if (pulls.status === "fulfilled") {
        for (const pr of pulls.value.pullRequests) {
          next.push({
            id: `pull-${pr.id}`,
            kind: "pull",
            title: pr.title,
            subtitle: `${pr.repo?.fullName ?? ""} #${pr.prNumber}${pr.author ? ` · ${pr.author}` : ""}`,
            href: `/repos/${pr.repo?.repoId}/pulls/${pr.prNumber}`,
          });
        }
      }

      setItems(next);
    } catch {
      // Search is an accelerator, never a blocker — fall back to the pages
      setItems(PAGES);
    }
  }, [items]);

  useEffect(() => {
    if (!open) return;
    load();
    setActive(0);
    inputRef.current?.focus();
  }, [open, load]);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    const all = items ?? PAGES;
    if (!term) return all.slice(0, 8);

    return all
      .filter(
        (item) =>
          item.title.toLowerCase().includes(term) ||
          item.subtitle?.toLowerCase().includes(term),
      )
      .slice(0, 12);
  }, [items, query]);

  const choose = (item: Item) => {
    setOpen(false);
    setQuery("");
    router.push(item.href);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center bg-[rgba(12,11,18,0.5)] px-4 pt-[12vh]"
      onMouseDown={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        onMouseDown={(event) => event.stopPropagation()}
        className="w-full max-w-[560px] overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-[0_24px_60px_rgba(12,11,18,0.35)]"
      >
        <div className="relative border-b border-line-soft">
          <Search
            className="pointer-events-none absolute top-[15px] left-4 size-4 text-fg-faint"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((index) => Math.min(index + 1, results.length - 1));
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((index) => Math.max(index - 1, 0));
              }
              if (event.key === "Enter" && results[active]) {
                event.preventDefault();
                choose(results[active]);
              }
            }}
            placeholder="Search repositories, pull requests and screens…"
            aria-label="Search"
            className="h-[50px] w-full bg-transparent pr-4 pl-11 text-[15px] text-fg outline-none placeholder:text-fg-faint"
          />
        </div>

        <div className="max-h-[360px] overflow-y-auto py-1.5">
          {items === null ? (
            <p className="px-4 py-6 text-center text-[13px] text-fg-subtle">Loading…</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-fg-subtle">
              Nothing matches “{query}”.
            </p>
          ) : (
            results.map((item, index) => {
              const Icon = ICON[item.kind];
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(item)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-2.5 text-left",
                    index === active ? "bg-surface-sunken" : "",
                  )}
                >
                  <Icon className="size-4 shrink-0 text-fg-faint" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] text-fg">{item.title}</span>
                    {item.subtitle ? (
                      <span className="block truncate font-mono text-[12px] text-fg-subtle">
                        {item.subtitle}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-line-soft bg-surface-sunken px-4 py-2.5 text-[12px] text-fg-subtle">
          <span>↑↓ to move</span>
          <span>↵ to open</span>
          <span>esc to close</span>
        </div>
      </div>
    </div>
  );
}
