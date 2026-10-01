"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";

import { Button } from "./button";
import { cn } from "@/lib/utils";

/*
  A modal from the design system, replacing window.confirm.

  The browser dialog cannot be styled, cannot explain consequences, and
  gives the user one undifferentiated "OK" for everything from "discard
  unsaved work" to "disconnect this repository". Destructive actions need
  to say what will happen and what will survive.

  Focus moves into the dialog on open and returns to whatever opened it on
  close, Escape dismisses, and the backdrop is inert to clicks when the
  action is destructive so it cannot be confirmed or lost by accident.
*/

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  confirmLabel = "Confirm",
  onConfirm,
  tone = "default",
  loading,
  confirmDisabled,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  confirmLabel?: string;
  onConfirm?: () => void;
  tone?: "default" | "destructive";
  loading?: boolean;
  confirmDisabled?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    restoreFocusRef.current = document.activeElement as HTMLElement | null;

    // Move focus in, so keyboard and screen-reader users are not left behind
    const firstField = panelRef.current?.querySelector<HTMLElement>(
      "input, textarea, select, button",
    );
    firstField?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      restoreFocusRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(12,11,18,0.55)] px-4"
      // A destructive action should not be confirmed or dismissed by a stray
      // click on the backdrop
      onMouseDown={tone === "destructive" ? undefined : onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
        className="w-full max-w-[460px] overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-[0_24px_60px_rgba(12,11,18,0.35)]"
      >
        <div className="flex items-start gap-3 px-5 pt-5">
          <div className="min-w-0 flex-1">
            <h2 id="dialog-title" className="font-display text-[19px] font-bold text-fg">
              {title}
            </h2>
            {description ? (
              <p className="mt-1.5 text-[14px] leading-[1.55] text-fg-muted">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mt-1 -mr-1 rounded-md p-1.5 text-fg-faint transition-colors hover:bg-surface-hover hover:text-fg"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        {children ? <div className="px-5 pt-4">{children}</div> : null}

        <div className="mt-5 flex justify-end gap-2.5 border-t border-line-soft bg-surface-sunken px-5 py-4">
          <Button type="button" variant="tertiary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          {onConfirm ? (
            <Button
              type="button"
              variant={tone === "destructive" ? "destructive" : "primary"}
              onClick={onConfirm}
              loading={loading}
              disabled={loading || confirmDisabled}
            >
              {confirmLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export const dialogFieldClass = cn(
  "w-full rounded-[10px] border border-line-strong bg-surface px-3 py-2.5 text-[14px] text-fg outline-none",
  "placeholder:text-fg-faint focus:border-violet-400",
);
