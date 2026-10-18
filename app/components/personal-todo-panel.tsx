"use client";

import { formatDate } from "@/app/lib/invoices/model";
import { Archive, Check, ListChecks, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";

type PersonalTodo = {
  id: string;
  title: string;
  done: boolean;
  completedAt: string;
};

const STORAGE_KEY = "bm_personal_todos";

export function PersonalTodoButton({ count, open, onClick }: { count: number; open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onClick}
      className={`mx-3 mb-2 flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium ${
        open ? "bg-[#d7f35f] text-[#12382c]" : "text-[#d7ebe2] hover:bg-white/10"
      }`}
    >
      <ListChecks size={18} className="shrink-0" aria-hidden="true" />
      <span className="leading-tight">To Do list</span>
      {count > 0 ? (
        <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${open ? "bg-[#12382c]/12 text-[#12382c]" : "bg-white/12 text-white"}`}>
          {count}
        </span>
      ) : null}
    </button>
  );
}

export function PersonalTodoPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [items, setItems] = useState<PersonalTodo[]>([]);
  const [ready, setReady] = useState(false);
  const [history, setHistory] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editing, setEditing] = useState("");

  useEffect(() => {
    setItems(readTodos());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event("bm-todos"));
  }, [items, ready]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const ordered = history
    ? items.filter((item) => item.done).sort((a, b) => b.completedAt.localeCompare(a.completedAt))
    : items.filter((item) => !item.done);

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = draft.trim();
    if (!title) return;
    setItems((current) => [{ id: crypto.randomUUID(), title, done: false, completedAt: "" }, ...current]);
    setDraft("");
  }

  function toggle(item: PersonalTodo) {
    setItems((current) =>
      current.map((entry) => (entry.id === item.id ? { ...entry, done: !entry.done, completedAt: entry.done ? "" : new Date().toISOString() } : entry)),
    );
  }

  function saveTitle(item: PersonalTodo) {
    const title = editing.trim();
    setEditingId(null);
    if (!title || title === item.title) return;
    setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, title } : entry)));
  }

  function remove(id: string) {
    setItems((current) => current.filter((entry) => entry.id !== id));
  }

  return createPortal(
    <>
      <button type="button" aria-label="Aizvērt" onClick={onClose} className="fixed inset-0 z-30 bg-[#0b241c]/25 backdrop-blur-md lg:left-[240px]" />
      <aside className="fixed inset-y-0 left-0 z-50 flex w-full max-w-[440px] flex-col bg-white text-[#143028] shadow-2xl lg:left-[240px]">
        <div className="flex items-center gap-2 border-b border-[#d3e4da] px-4 py-4">
          <h2 className="min-w-0 flex-1 truncate text-lg font-semibold">To Do list</h2>
          <button
            type="button"
            aria-pressed={history}
            onClick={() => setHistory((current) => !current)}
            className={`inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-semibold ${history ? "bg-[#1a6b4a] text-white" : "text-[#1e3a2f] hover:bg-[#e7f3ec]"}`}
          >
            <Archive className="size-4 shrink-0" aria-hidden="true" />
            Vēsture
          </button>
          <button type="button" aria-label="Aizvērt" onClick={onClose} className="rounded-lg p-2 text-[#5f756a]">
            <X size={18} />
          </button>
        </div>
        {history ? null : (
          <form onSubmit={add} className="border-b border-[#e4efe8] px-4 py-3">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Jauns uzdevums"
              aria-label="Jauns uzdevums"
              className="h-11 w-full rounded-xl border border-[#c5d9cd] px-3 text-sm outline-none focus:border-[#1a6b4a] focus:ring-4 focus:ring-[#1a6b4a]/15"
            />
          </form>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {ordered.length === 0 ? (
            <p className="px-2 py-10 text-center text-sm text-[#5f756a]">{history ? "Vēsturē vēl nav pabeigtu uzdevumu." : "Vēl nav uzdevumu."}</p>
          ) : (
            <ul className="space-y-1">
              {ordered.map((item) => (
                <li key={item.id} className="flex items-start gap-2 rounded-xl px-2 py-2 hover:bg-[#f4faf6]">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={item.done}
                    aria-label={item.done ? "Atzīmēt kā nepabeigtu" : "Atzīmēt kā izpildītu"}
                    onClick={() => toggle(item)}
                    className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded border ${item.done ? "border-[#1a6b4a] bg-[#1a6b4a] text-white" : "border-[#c5d9cd] bg-white text-transparent"}`}
                  >
                    <Check className="size-3" aria-hidden="true" />
                  </button>
                  <div className="min-w-0 flex-1">
                    {editingId === item.id ? (
                      <input
                        value={editing}
                        aria-label="Labot uzdevumu"
                        onChange={(event) => setEditing(event.target.value)}
                        onBlur={() => saveTitle(item)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            saveTitle(item);
                          }
                          if (event.key === "Escape") {
                            event.preventDefault();
                            event.stopPropagation();
                            setEditingId(null);
                          }
                        }}
                        className="h-7 w-full bg-transparent text-sm outline-none"
                        autoFocus
                      />
                    ) : (
                      <button type="button" onClick={() => { setEditingId(item.id); setEditing(item.title); }} className={`block w-full text-left text-sm ${item.done ? "text-[#8aa396] line-through" : ""}`}>
                        {item.title}
                      </button>
                    )}
                    {item.done && item.completedAt ? <p className="mt-0.5 text-[11px] text-[#8aa396]">Pabeigts {formatDate(item.completedAt.slice(0, 10))}</p> : null}
                  </div>
                  <button type="button" aria-label="Dzēst" onClick={() => remove(item.id)} className="grid size-7 shrink-0 place-items-center rounded-lg text-[#b42318] hover:bg-[#fdeceb]">
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>,
    document.body,
  );
}

export function useOpenTodoCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    function read() {
      setCount(readTodos().filter((item) => !item.done).length);
    }
    read();
    window.addEventListener("storage", read);
    window.addEventListener("bm-todos", read);
    return () => {
      window.removeEventListener("storage", read);
      window.removeEventListener("bm-todos", read);
    };
  }, []);
  return count;
}

function readTodos(): PersonalTodo[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as PersonalTodo[]) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.title === "string") : [];
  } catch {
    return [];
  }
}
