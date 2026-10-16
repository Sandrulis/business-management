"use client";

import { X } from "lucide-react";
import { FormEvent, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const ENTER = { duration: 420, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "both" } as const;
const EXIT = { duration: 160, easing: "cubic-bezier(0.4, 0, 1, 1)", fill: "forwards" } as const;

export function RightDrawer({
  title,
  hint,
  wide = false,
  beside,
  onClose,
  beforeClose,
  dismissRef,
  onSubmit,
  children,
  footer,
}: {
  title: string;
  hint: string;
  wide?: boolean;
  beside?: number;
  onClose: () => void;
  beforeClose?: () => boolean;
  dismissRef?: { current: () => void };
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void | false | Promise<void | false>;
  children: ReactNode;
  footer?: (close: () => void) => ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const [offset, setOffset] = useState(0);
  const backdropRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLFormElement>(null);
  const closingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  const beforeCloseRef = useRef(beforeClose);
  onCloseRef.current = onClose;
  beforeCloseRef.current = beforeClose;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (beside == null) return;
    function fit() {
      setOffset(Math.min(beside ?? 0, window.innerWidth));
    }
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [beside]);

  function dismiss() {
    if (closingRef.current) return;
    const backdrop = backdropRef.current;
    const panel = panelRef.current;
    if (!panel) {
      onCloseRef.current();
      return;
    }
    closingRef.current = true;
    const panelFrom = getComputedStyle(panel).transform;
    const backdropFrom = backdrop ? getComputedStyle(backdrop).opacity : "0";
    for (const animation of [...panel.getAnimations(), ...(backdrop?.getAnimations() ?? [])]) animation.cancel();
    backdrop?.animate([{ opacity: Number(backdropFrom) || 1 }, { opacity: 0 }], EXIT);
    const slide = panel.animate(
      [{ transform: panelFrom === "none" ? "translateX(0)" : panelFrom }, { transform: "translateX(100%)" }],
      EXIT,
    );
    slide.onfinish = () => onCloseRef.current();
  }

  function requestClose() {
    if (beforeCloseRef.current?.() === false) return;
    dismiss();
  }

  if (dismissRef) dismissRef.current = dismiss;

  const ready = mounted && (beside == null || offset > 0);

  useLayoutEffect(() => {
    if (!ready || closingRef.current) return;
    const backdrop = backdropRef.current;
    const panel = panelRef.current;
    if (!panel) return;
    if (beside == null) backdrop?.animate([{ opacity: 0 }, { opacity: 1 }], { ...ENTER, duration: 320 });
    panel.animate([{ transform: "translateX(100%)" }, { transform: "translateX(0)" }], ENTER);
  }, [beside, ready]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") requestClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!onSubmit) return;
    const result = await onSubmit(event);
    if (result === false) return;
    dismiss();
  }

  if (!ready) return null;

  return createPortal(
    <div
      className={beside == null ? "fixed inset-0 z-[90]" : "fixed inset-y-0 left-0 z-[91] overflow-hidden"}
      style={beside == null ? undefined : { right: offset }}
    >
      <button
        ref={backdropRef}
        type="button"
        aria-label="Aizvērt"
        onClick={requestClose}
        className={beside == null ? "absolute inset-0 bg-[#12382c]/35 backdrop-blur-md" : "absolute inset-0"}
      />
      <form
        ref={panelRef}
        onSubmit={handleSubmit}
        className={`absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-2xl ${beside == null ? "" : "border-r border-[#9fb8ac]"} ${wide ? "max-w-[720px]" : "max-w-[440px]"}`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#d3e4da] px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            {hint ? <p className="mt-1 text-sm text-[#5f756a]">{hint}</p> : null}
          </div>
          <button type="button" onClick={requestClose} aria-label="Aizvērt" className="rounded-lg p-2 text-[#5f756a]">
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">{children}</div>
        {footer ? <div className="flex justify-end gap-2 border-t border-[#d3e4da] px-5 py-4">{footer(requestClose)}</div> : null}
      </form>
    </div>,
    document.body,
  );
}
