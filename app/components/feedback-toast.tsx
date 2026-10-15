"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const DURATION_MS = 5000;

const tones = {
  ok: "border-[#b7dcc4] bg-[#e7f6ec] text-[#14543c]",
  error: "border-[#f0c2be] bg-[#fdeceb] text-[#8a1c14]",
  info: "border-[#d3e4da] bg-white text-[#143028]",
};

export function FeedbackToast({
  message,
  tone,
  onDismiss,
}: {
  message: string;
  tone: keyof typeof tones;
  onDismiss: () => void;
}) {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const remaining = useRef(DURATION_MS);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (hovered) return;
    const started = Date.now();
    const timer = window.setTimeout(() => onDismissRef.current(), remaining.current);
    return () => {
      remaining.current = Math.max(0, remaining.current - (Date.now() - started));
      window.clearTimeout(timer);
    };
  }, [hovered]);

  return createPortal(
    <div
      role="alert"
      aria-live="assertive"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`fixed top-5 left-1/2 z-[90] flex w-[min(36rem,calc(100%-2rem))] -translate-x-1/2 items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-sm shadow-lg ${tones[tone]}`}
    >
      <p>{message}</p>
      <button type="button" onClick={onDismiss} className="grid size-8 shrink-0 place-items-center rounded-lg" aria-label="Aizvērt">
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>,
    document.body,
  );
}
