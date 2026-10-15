"use client";

import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function Tooltip({
  text,
  children,
  className = "",
}: {
  text: string;
  children: ReactNode;
  className?: string;
}) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number; below: boolean } | null>(null);

  function show() {
    const rect = anchor.current?.getBoundingClientRect();
    if (!rect) return;
    setPlace({
      left: rect.left + rect.width / 2,
      top: rect.top < 48 ? rect.bottom : rect.top,
      below: rect.top < 48,
    });
  }

  return (
    <span
      ref={anchor}
      className={`inline-flex ${className}`}
      onMouseEnter={show}
      onMouseLeave={() => setPlace(null)}
      onFocusCapture={show}
      onBlurCapture={() => setPlace(null)}
    >
      {children}
      {place
        ? createPortal(
            <span
              role="tooltip"
              style={{ left: place.left, top: place.top }}
              className={`pointer-events-none fixed z-[110] -translate-x-1/2 rounded-lg bg-[#1c1c1e] px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-white shadow-lg ${place.below ? "mt-2" : "-translate-y-full -mt-2"}`}
            >
              {text}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
