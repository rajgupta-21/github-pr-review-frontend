"use client";

import { AlertTriangle, Check, Clock, Trash2, Webhook } from "lucide-react";
import { useEffect, useState } from "react";

import { PageHeading, SidebarShell } from "@/components/shell/app-shell";
import { useUser } from "@/components/shell/user-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Dialog, dialogFieldClass } from "@/components/ui/dialog";
import { EmptyState, ErrorBanner, LoadingState } from "@/components/ui/feedback";
import { InfoHint, Tooltip } from "@/components/ui/tooltip";
import { disconnectRepo, getRepoOverview, updateRepoSettings } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { HEALTH_HELP, SEVERITY_DEFINITIONS } from "@/lib/review";
import type { RepoOverviewEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

/*
  Account and per-repository settings.

  The sidebar promised a Settings screen that did not exist, and the
  controls that belong here — merge gate, auto review, pause, disconnect —
  had nowhere to live. Webhook health is here too, because "why didn't my
  pull request get reviewed?" is answered by the delivery state and
  previously required opening GitHub's own webhook page.
*/

const GATES = ["none", "Low", "Medium", "High", "Critical"] as const;

export default function SettingsPage() {
  const user = useUser();
  const [repos, setRepos] = useState<RepoOverviewEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState<number | null>(null);
  const [toDisconnect, setToDisconnect] = useState<RepoOverviewEntry | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    getRepoOverview()
      .then(setRepos)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Could not load repositories"),
      );
  };

  useEffect(load, []);

  async function patch(repo: RepoOverviewEntry, change: Parameters<typeof updateRepoSettings>[1]) {
    setSaving(repo.repoId);
    setError(null);
    try {
      await updateRepoSettings(repo.repoId, change);
      // Name the repository — a bare "Saved" gave no way to notice a mistake
      setNotice(`${repo.fullName} updated`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that change");
    } finally {
      setSaving(null);
    }
  }

  async function confirmDisconnect() {
    if (!toDisconnect) return;
    setBusy(true);
    try {
      await disconnectRepo(toDisconnect.repoId);
      setNotice(`${toDisconnect.fullName} disconnected. Its review history was kept.`);
      setToDisconnect(null);
      setConfirmText("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disconnect");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SidebarShell>
      <PageHeading
        title="Settings"
        description="How Mergegate behaves on each connected repository."
      />

      {notice ? (
        <div
          role="status"
          className="mt-5 flex items-center gap-2 rounded-xl border border-[#C9E4D6] bg-[#F3FAF6] px-4 py-3 text-[14px] text-pass"
        >
          <Check className="size-4" aria-hidden="true" />
          {notice}
        </div>
      ) : null}
      {error ? <ErrorBanner className="mt-5">{error}</ErrorBanner> : null}

      <Card className="mt-6">
        <CardHeader title="Account" />
        <dl className="divide-y divide-line-soft px-5">
          <Row label="Signed in as">{user?.githubUsername ?? user?.email ?? "—"}</Row>
          <Row label="Plan">{user?.plan ?? "Free"}</Row>
          <Row label="GitHub">
            {user?.githubConnected ? (
              <Badge tone="pass" dot>
                Connected
              </Badge>
            ) : (
              <Badge tone="neutral" dot>
                Not connected
              </Badge>
            )}
          </Row>
        </dl>
      </Card>

      {repos === null ? (
        <LoadingState label="Loading repositories…" />
      ) : repos.length === 0 ? (
        <Card className="mt-5">
          <EmptyState
            icon={<Webhook />}
            title="No repositories connected"
            description="Connect one and its review settings will appear here."
          />
        </Card>
      ) : (
        <div className="mt-5 flex flex-col gap-4">
          {repos.map((repo) => (
            <Card key={repo.repoId}>
              <CardHeader title={repo.fullName}>
                <WebhookState repo={repo} />
              </CardHeader>

              <div className="flex flex-col gap-5 px-5 py-5">
                {/* Merge gate */}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-semibold text-fg">Merge gate</span>
                    <InfoHint label="What is the merge gate?">
                      Holds the merge while any finding is at the chosen severity or above. A
                      maintainer can still waive it, and the reason is posted on the pull request.
                    </InfoHint>
                  </div>
                  <p className="mt-1 text-[13px] text-fg-muted">
                    Block merging when a review finds something at this level or worse.
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {GATES.map((gate) => {
                      const active = (repo.settings?.mergeGate ?? "Critical") === gate;
                      return (
                        <Tooltip
                          key={gate}
                          content={
                            gate === "none"
                              ? "Never hold a merge. Reviews still run and findings are still reported."
                              : SEVERITY_DEFINITIONS[gate]
                          }
                        >
                          <button
                            type="button"
                            disabled={saving === repo.repoId}
                            onClick={() => patch(repo, { mergeGate: gate })}
                            className={cn(
                              "h-8 rounded-lg border px-3 text-[13px] transition-colors",
                              active
                                ? "border-transparent bg-fg text-white"
                                : "border-line-strong bg-surface text-fg-2 hover:bg-surface-sunken",
                            )}
                          >
                            {gate === "none" ? "Never block" : gate}
                          </button>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>

                <Toggle
                  label="Review automatically"
                  description="Run the workflow when GitHub reports a new or updated pull request."
                  checked={repo.settings?.autoReview ?? true}
                  disabled={saving === repo.repoId}
                  onChange={(value) => patch(repo, { autoReview: value })}
                />

                <Toggle
                  label="Pause this repository"
                  description="Keep the workflow but skip every run. Nothing is deleted."
                  checked={repo.settings?.paused ?? false}
                  disabled={saving === repo.repoId}
                  onChange={(value) => patch(repo, { paused: value })}
                />

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-4">
                  <span className="text-[13px] text-fg-muted">
                    Health{" "}
                    <InfoHint label="How is health calculated?">{HEALTH_HELP}</InfoHint>{" "}
                    <strong className="text-fg">
                      {repo.health === null ? "not scored yet" : `${repo.health}/100`}
                    </strong>
                  </span>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => setToDisconnect(repo)}
                  >
                    <Trash2 aria-hidden="true" />
                    Disconnect
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={Boolean(toDisconnect)}
        onClose={() => {
          setToDisconnect(null);
          setConfirmText("");
        }}
        title={`Disconnect ${toDisconnect?.fullName ?? ""}?`}
        tone="destructive"
        confirmLabel="Disconnect repository"
        loading={busy}
        confirmDisabled={confirmText !== toDisconnect?.name}
        onConfirm={confirmDisconnect}
        description={
          <>
            Mergegate will remove its webhook and stop reviewing this repository.{" "}
            <strong>Your review history is kept</strong> — disconnecting is not deleting. Your
            code and the repository itself are untouched.
          </>
        }
      >
        <label className="block">
          <span className="mb-1.5 block text-[13px] text-fg-muted">
            Type <span className="font-mono text-fg">{toDisconnect?.name}</span> to confirm
          </span>
          <input
            type="text"
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            className={dialogFieldClass}
          />
        </label>
      </Dialog>
    </SidebarShell>
  );
}

/*
  "Webhook on" only meant a hook was registered — it was shown as success
  even when the server had no public URL and nothing could ever arrive.
  This reports what actually happened.
*/
function WebhookState({ repo }: { repo: RepoOverviewEntry }) {
  if (!repo.webhookActive) {
    return (
      <Badge tone="neutral" dot>
        Manual only
      </Badge>
    );
  }

  if (!repo.lastWebhookDeliveryAt) {
    return (
      <Tooltip content="A webhook is registered, but GitHub has not delivered an event yet. Until it does, reviews only run when you start them.">
        <Badge tone="high" dot>
          <Clock className="mr-1 inline size-3" aria-hidden="true" />
          Waiting for first delivery
        </Badge>
      </Tooltip>
    );
  }

  return (
    <Tooltip content={`Last event: ${repo.lastWebhookEvent ?? "pull_request"}`}>
      <Badge tone="pass" dot>
        Delivering · {timeAgo(repo.lastWebhookDeliveryAt)}
      </Badge>
    </Tooltip>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3.5">
      <dt className="text-[13.5px] text-fg-muted">{label}</dt>
      <dd className="text-[14px] text-fg">{children}</dd>
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-4 accent-violet-500"
      />
      <span>
        <span className="block text-[14px] font-semibold text-fg">{label}</span>
        <span className="block text-[13px] text-fg-muted">{description}</span>
      </span>
    </label>
  );
}
