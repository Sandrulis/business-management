"use client";

import { formatDate } from "@/app/lib/invoices/model";
import { Calendar, ChevronLeft, ChevronRight, Eraser } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const MONTHS = [
  "Janvāris",
  "Februāris",
  "Marts",
  "Aprīlis",
  "Maijs",
  "Jūnijs",
  "Jūlijs",
  "Augusts",
  "Septembris",
  "Oktobris",
  "Novembris",
  "Decembris",
];

const WEEKDAYS = ["Pr", "Ot", "Tr", "Ce", "Pk", "Se", "Sv"];

export function DateField({
  value,
  onChange,
  className,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const parsed = parseIso(value);
  const today = new Date();
  const [cursor, setCursor] = useState(() => parsed ?? { year: today.getFullYear(), month: today.getMonth() + 1 });

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    if (disabled) return;
    if (!open && parsed) setCursor(parsed);
    setOpen((current) => !current);
  }

  function pick(year: number, month: number, day: number) {
    onChange(toIso(year, month, day));
    setOpen(false);
  }

  const rect = open ? buttonRef.current?.getBoundingClientRect() : null;
  const days = monthDays(cursor.year, cursor.month);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        disabled={disabled}
        className={`${className ?? fieldClass} flex items-center justify-between text-left disabled:cursor-not-allowed disabled:bg-[#f4faf6] disabled:text-[#8aa396]`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={value ? "" : "text-[#8aa396]"}>{value ? formatDate(value) : "dd.mm.gggg"}</span>
        <Calendar className="size-4 text-[#5f756a]" aria-hidden="true" />
      </button>
      {open && rect
        ? createPortal(
            <div
              ref={popoverRef}
              role="dialog"
              aria-label="Izvēlēties datumu"
              style={{
                left: Math.min(rect.left, window.innerWidth - 292),
                top: rect.bottom + 312 > window.innerHeight ? Math.max(8, rect.top - 320) : rect.bottom + 8,
              }}
              className="fixed z-[110] w-[280px] rounded-2xl border border-[#d3e4da] bg-white p-3 text-[#143028] shadow-2xl"
            >
              <div className="flex items-center justify-between gap-2">
                <button type="button" className="grid size-8 place-items-center rounded-lg hover:bg-[#eef5f0]" aria-label="Iepriekšējais mēnesis" onClick={() => setCursor(shift(cursor, -1))}>
                  <ChevronLeft className="size-4" aria-hidden="true" />
                </button>
                <p className="text-sm font-semibold">{MONTHS[cursor.month - 1]} {cursor.year}</p>
                <button type="button" className="grid size-8 place-items-center rounded-lg hover:bg-[#eef5f0]" aria-label="Nākamais mēnesis" onClick={() => setCursor(shift(cursor, 1))}>
                  <ChevronRight className="size-4" aria-hidden="true" />
                </button>
              </div>
              <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-[#5f756a]">
                {WEEKDAYS.map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1">
                {days.map((day) => {
                  const iso = toIso(day.year, day.month, day.day);
                  const selected = iso === value;
                  const isToday = iso === toIso(today.getFullYear(), today.getMonth() + 1, today.getDate());
                  return (
                    <button
                      key={iso + (day.outside ? "-out" : "")}
                      type="button"
                      onClick={() => pick(day.year, day.month, day.day)}
                      className={`h-8 rounded-lg text-sm ${selected ? "bg-[#1a6b4a] font-semibold text-white" : isToday ? "bg-[#e7f6ec] font-semibold text-[#1a6b4a]" : day.outside ? "text-[#8aa396] hover:bg-[#eef5f0]" : "hover:bg-[#eef5f0]"}`}
                    >
                      {day.day}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex justify-between">
                <button type="button" className="inline-flex h-8 items-center justify-center gap-2 rounded-lg px-2 text-sm font-semibold text-[#1a6b4a]" onClick={() => { onChange(""); setOpen(false); }}>
                  <Eraser className="size-4 shrink-0" aria-hidden="true" />
                  Notīrīt
                </button>
                <button
                  type="button"
                  className="inline-flex h-8 items-center justify-center gap-2 rounded-lg px-2 text-sm font-semibold text-[#1a6b4a]"
                  onClick={() => pick(today.getFullYear(), today.getMonth() + 1, today.getDate())}
                >
                  <Calendar className="size-4 shrink-0" aria-hidden="true" />
                  Šodien
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function shift(cursor: { year: number; month: number }, delta: number) {
  const date = new Date(cursor.year, cursor.month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

function monthDays(year: number, month: number) {
  const first = new Date(year, month - 1, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, month - 1, 1 - offset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      outside: date.getMonth() !== month - 1,
    };
  });
}

function parseIso(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) };
}

function toIso(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const fieldClass =
  "mt-2 h-11 w-full rounded-xl border border-[#c5d9cd] bg-white px-3 font-normal outline-none focus:border-[#1a6b4a] focus:ring-4 focus:ring-[#1a6b4a]/15";
