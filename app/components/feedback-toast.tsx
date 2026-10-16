"use client";

import type { Notice, NoticeTone } from "@/app/components/invoice-state";
import { Check, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type Ref, type RefObject } from "react";
import { createPortal } from "react-dom";

const DURATION_MS = 5000;
const ENTER = { duration: 360, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "both" } as const;
const EXIT = { duration: 240, easing: "cubic-bezier(0.4, 0, 1, 1)", fill: "forwards" } as const;

const icons: Record<NoticeTone, { ring: string; mark: "check" | "x" | "info" }> = {
  ok: { ring: "bg-[#2f9e57] shadow-[0_0_0_4px_rgba(47,158,87,0.28)]", mark: "check" },
  error: { ring: "bg-[#d64545] shadow-[0_0_0_4px_rgba(214,69,69,0.28)]", mark: "x" },
  info: { ring: "bg-[#3b7ddd] shadow-[0_0_0_4px_rgba(59,125,221,0.28)]", mark: "info" },
};

export function FeedbackToasts({
  notices,
  onDismiss,
}: {
  notices: Notice[];
  onDismiss: (id: string) => void;
}) {
  const [leaving, setLeaving] = useState<string[]>([]);
  const positions = useRef(new Map<string, number>());
  const slots = useRef(new Map<string, HTMLDivElement>());
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    const next = new Map<string, number>();
    for (const [id, element] of slots.current) {
      if (!element.isConnected) continue;
      const top = element.getBoundingClientRect().top;
      const previous = positions.current.get(id);
      if (previous != null && !leaving.includes(id)) {
        const delta = previous - top;
        if (Math.abs(delta) > 1) {
          element.animate([{ transform: `translateY(${delta}px)` }, { transform: "translateY(0)" }], {
            duration: 280,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          });
        }
      }
      next.set(id, top);
    }
    positions.current = next;
  }, [leaving, notices]);

  function dismiss(id: string) {
    setLeaving((current) => (current.includes(id) ? current : [...current, id]));
  }

  if (!mounted || notices.length === 0) return null;

  return createPortal(
    <div className="pointer-events-none fixed top-20 right-4 z-[110] flex w-[min(22rem,calc(100%-2rem))] flex-col lg:top-5 lg:right-6">
      {notices.map((notice) => (
        <ToastSlot
          key={notice.id}
          notice={notice}
          leaving={leaving.includes(notice.id)}
          slots={slots}
          onDismiss={() => dismiss(notice.id)}
          onGone={() => {
            setLeaving((current) => current.filter((id) => id !== notice.id));
            onDismiss(notice.id);
          }}
        />
      ))}
    </div>,
    document.body,
  );
}

function ToastSlot({
  notice,
  leaving,
  slots,
  onDismiss,
  onGone,
}: {
  notice: Notice;
  leaving: boolean;
  slots: RefObject<Map<string, HTMLDivElement>>;
  onDismiss: () => void;
  onGone: () => void;
}) {
  const card = useRef<HTMLDivElement>(null);
  const onGoneRef = useRef(onGone);
  onGoneRef.current = onGone;

  useLayoutEffect(() => {
    const element = card.current;
    if (!element) return;
    element.animate(
      [
        { transform: "translateX(110%)", opacity: 0 },
        { transform: "translateX(0)", opacity: 1 },
      ],
      ENTER,
    );
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const element = card.current;
    const frame = slots.current.get(notice.id);
    if (!element || !frame) return;
    const height = frame.getBoundingClientRect().height;
    frame.style.height = `${height}px`;
    element.style.position = "absolute";
    element.style.inset = "0 auto auto 0";
    element.style.width = "100%";
    const slide = element.animate(
      [
        { transform: "translateX(0)", opacity: 1 },
        { transform: "translateX(110%)", opacity: 0 },
      ],
      EXIT,
    );
    frame.animate(
      [
        { height: `${height}px`, marginBottom: "8px" },
        { height: "0px", marginBottom: "0px" },
      ],
      EXIT,
    );
    slide.onfinish = () => onGoneRef.current();
  }, [leaving, notice.id, slots]);

  return (
    <div
      ref={(element) => {
        if (element) slots.current.set(notice.id, element);
        else slots.current.delete(notice.id);
      }}
      className="relative mb-2"
    >
      <FeedbackToast cardRef={card} notice={notice} onDismiss={onDismiss} />
    </div>
  );
}

function FeedbackToast({
  notice,
  onDismiss,
  cardRef,
}: {
  notice: Notice;
  onDismiss: () => void;
  cardRef: Ref<HTMLDivElement>;
}) {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const remaining = useRef(DURATION_MS);
  const [hovered, setHovered] = useState(false);
  const icon = icons[notice.tone];

  useEffect(() => {
    if (hovered) return;
    const started = Date.now();
    const timer = window.setTimeout(() => onDismissRef.current(), remaining.current);
    return () => {
      remaining.current = Math.max(0, remaining.current - (Date.now() - started));
      window.clearTimeout(timer);
    };
  }, [hovered]);

  return (
    <div
      ref={cardRef}
      role="alert"
      aria-live="assertive"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-[#2a2a2c] px-3.5 py-3 text-white shadow-2xl"
    >
      <span className={`grid size-[1.575rem] shrink-0 place-items-center rounded-full text-white ${icon.ring}`} aria-hidden="true">
        {icon.mark === "check" ? <Check className="size-[0.7rem]" strokeWidth={3} /> : null}
        {icon.mark === "x" ? <X className="size-[0.7rem]" strokeWidth={3} /> : null}
        {icon.mark === "info" ? <span className="text-[0.8rem] leading-none font-bold">!</span> : null}
      </span>
      <p className="min-w-0 flex-1 text-sm leading-5 font-medium">{notice.text}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="grid size-8 shrink-0 place-items-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
        aria-label="Aizvērt"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
