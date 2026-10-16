"use client";

import { Tooltip } from "@/app/components/tooltip";
import { ChevronDown, ChevronUp, GripVertical, Pin, PinOff } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

type PanelState = {
  pinned: boolean;
  collapsed: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
};

const MIN_W = 280;
const MIN_H = 180;

let panelZ = 60;

export function FloatingPanel({
  storageKey,
  title,
  children,
}: {
  storageKey: string;
  title: string;
  children: ReactNode;
}) {
  const [pinned, setPinned] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [pos, setPos] = useState({ x: 24, y: 80 });
  const [size, setSize] = useState({ w: 520, h: 480 });
  const [ready, setReady] = useState(false);
  const [zIndex, setZIndex] = useState(60);
  const panelRef = useRef<HTMLElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const resize = useRef<{ x: number; y: number; w: number; h: number; left: number; top: number } | null>(null);

  useEffect(() => {
    const stored = readPanel(storageKey);
    if (stored) {
      setPinned(stored.pinned);
      setCollapsed(stored.collapsed);
      const placed = placeInView(stored.x, stored.y, stored.w, stored.h);
      setPos({ x: placed.x, y: placed.y });
      setSize({ w: placed.w, h: placed.h });
    }
    setReady(true);
  }, [storageKey]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ pinned, collapsed, x: pos.x, y: pos.y, w: size.w, h: size.h }));
    } catch {
      /* saglabāšana ir ērtība, nevis obligāta */
    }
  }, [collapsed, pinned, pos, ready, size, storageKey]);

  function lift() {
    panelZ = Math.min(panelZ + 1, 70);
    setZIndex(panelZ);
  }

  function togglePin() {
    if (pinned) {
      const rect = panelRef.current?.getBoundingClientRect();
      if (rect) {
        const placed = placeInView(rect.left, rect.top, rect.width, rect.height);
        setPos({ x: placed.x, y: placed.y });
        setSize({ w: placed.w, h: placed.h });
      }
      setPinned(false);
      lift();
      return;
    }
    setPinned(true);
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (pinned) return;
    if ((event.target as HTMLElement).closest("button")) return;
    drag.current = { dx: event.clientX - pos.x, dy: event.clientY - pos.y };
    event.currentTarget.setPointerCapture(event.pointerId);
    lift();
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    setPos(clamp(event.clientX - drag.current.dx, event.clientY - drag.current.dy));
  }

  function onPointerUp() {
    drag.current = null;
  }

  function onResizeDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    const start = { x: event.clientX, y: event.clientY, w: size.w, h: size.h, left: pos.x, top: pos.y };
    resize.current = start;
    panelRef.current?.classList.add("is-resizing");
    function move(ev: PointerEvent) {
      if (ev.pointerId !== event.pointerId) return;
      const maxW = Math.max(MIN_W, window.innerWidth - 8 - start.left);
      const maxH = Math.max(MIN_H, window.innerHeight - 8 - start.top);
      setSize({
        w: clampSpan(start.w + ev.clientX - start.x, MIN_W, maxW),
        h: clampSpan(start.h + ev.clientY - start.y, MIN_H, maxH),
      });
    }
    function up(ev: PointerEvent) {
      if (ev.pointerId !== event.pointerId) return;
      resize.current = null;
      panelRef.current?.classList.remove("is-resizing");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    lift();
  }

  const panel = (
    <section
      ref={panelRef}
      className={
        pinned
          ? "mt-4 overflow-hidden rounded-3xl border border-[#d3e4da] bg-white"
          : "[&.is-resizing_iframe]:pointer-events-none fixed flex flex-col overflow-hidden rounded-3xl border border-[#d3e4da] bg-white shadow-2xl"
      }
      style={pinned ? undefined : { left: pos.x, top: pos.y, width: size.w, height: collapsed ? undefined : size.h, zIndex }}
    >
      <div
        className={`flex shrink-0 items-center gap-2 px-4 py-3 ${pinned ? "" : "cursor-grab touch-none select-none active:cursor-grabbing"}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {pinned ? null : <GripVertical className="size-4 shrink-0 text-[#5f756a]" aria-hidden="true" />}
        <p className="min-w-0 flex-1 truncate text-xs font-semibold tracking-[0.14em] text-[#5f756a] uppercase">{title}</p>
        <Tooltip text={pinned ? "Atspraust" : "Piespraust"}>
          <button
            type="button"
            onClick={togglePin}
            className="grid size-8 place-items-center rounded-lg text-[#143028] hover:bg-[#eef5f0]"
            aria-label={pinned ? "Atspraust" : "Piespraust"}
          >
            {pinned ? <Pin className="size-4" aria-hidden="true" /> : <PinOff className="size-4" aria-hidden="true" />}
          </button>
        </Tooltip>
        <Tooltip text={collapsed ? "Izvērst" : "Sakļaut"}>
          <button
            type="button"
            onClick={() => setCollapsed((current) => !current)}
            className="grid size-8 place-items-center rounded-lg text-[#143028] hover:bg-[#eef5f0]"
            aria-label={collapsed ? "Izvērst" : "Sakļaut"}
          >
            {collapsed ? <ChevronDown className="size-4" aria-hidden="true" /> : <ChevronUp className="size-4" aria-hidden="true" />}
          </button>
        </Tooltip>
      </div>
      <div className={collapsed ? "max-h-0 overflow-hidden" : pinned ? "px-5 pb-5 sm:px-6" : "min-h-0 flex-1 overflow-auto overscroll-contain px-4 pb-6"}>
        {children}
      </div>
      {pinned || collapsed ? null : (
        <Tooltip text="Mainīt izmēru" className="absolute right-0 bottom-0 z-10">
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label="Mainīt izmēru"
            className="relative size-8 cursor-nwse-resize touch-none"
            onPointerDown={onResizeDown}
          >
            <span className="absolute right-1.5 bottom-1.5 size-2.5 border-r-2 border-b-2 border-[#5f756a]" />
          </div>
        </Tooltip>
      )}
    </section>
  );

  if (!pinned && ready && typeof document !== "undefined") return createPortal(panel, document.body);
  return panel;
}

function readPanel(storageKey: string): PanelState | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PanelState>;
    if (typeof parsed.pinned !== "boolean" || typeof parsed.collapsed !== "boolean") return null;
    if (typeof parsed.x !== "number" || typeof parsed.y !== "number") return null;
    return {
      pinned: parsed.pinned,
      collapsed: parsed.collapsed,
      x: parsed.x,
      y: parsed.y,
      w: typeof parsed.w === "number" ? clampSpan(parsed.w, MIN_W, window.innerWidth - 16) : 520,
      h: typeof parsed.h === "number" ? clampSpan(parsed.h, MIN_H, window.innerHeight - 16) : 480,
    };
  } catch {
    return null;
  }
}

function placeInView(left: number, top: number, width: number, height: number) {
  const margin = 8;
  const w = clampSpan(width, MIN_W, Math.max(MIN_W, window.innerWidth - margin * 2));
  const h = clampSpan(height, MIN_H, Math.max(MIN_H, window.innerHeight - margin * 2));
  return {
    x: Math.min(Math.max(margin, left), Math.max(margin, window.innerWidth - margin - w)),
    y: Math.min(Math.max(margin, top), Math.max(margin, window.innerHeight - margin - h)),
    w,
    h,
  };
}

function clampSpan(value: number, min: number, max: number) {
  return Math.round(Math.min(Math.max(value, min), Math.max(min, max)));
}

function clamp(x: number, y: number) {
  if (typeof window === "undefined") return { x, y };
  const maxX = Math.max(8, window.innerWidth - 96);
  const maxY = Math.max(8, window.innerHeight - 56);
  return {
    x: Math.min(Math.max(8, x), maxX),
    y: Math.min(Math.max(8, y), maxY),
  };
}
