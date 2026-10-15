"use client";

import { X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

export function ConfirmModal({
  title,
  text,
  confirmLabel = "Dzēst",
  tone = "danger",
  pending = false,
  onCancel,
  onConfirm,
}: {
  title: string;
  text: string;
  confirmLabel?: string;
  tone?: "danger" | "primary";
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, pending]);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-[#12382c]/35 p-4 backdrop-blur-md"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className="w-full max-w-md rounded-3xl bg-white p-6 text-[#143028] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="confirm-modal-title" className="text-lg font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-[#5f756a] disabled:text-[#c5d8cc]"
            aria-label="Aizvērt"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-2 text-sm text-[#5f756a]">{text}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="h-11 rounded-xl px-4 text-sm font-semibold text-[#1e3a2f] disabled:text-[#5f756a]"
          >
            Atcelt
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={
              tone === "primary"
                ? "h-11 rounded-xl bg-[#1a6b4a] px-4 text-sm font-semibold text-white hover:bg-[#0f4a34] disabled:bg-[#c5d8cc] disabled:text-[#5f756a]"
                : "h-11 rounded-xl bg-[#b42318] px-4 text-sm font-semibold text-white hover:bg-[#8a1c14] disabled:bg-[#e7c4c1]"
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
