"use client";

import { ConfirmModal } from "@/app/components/confirm-modal";
import { useInvoices } from "@/app/components/invoice-state";
import type { Work } from "@/app/lib/invoices/model";
import { FormEvent, useState } from "react";

export function WorksView() {
  const { works, saveWorkItem, removeWork, notify } = useInvoices();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<Work | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmWork, setConfirmWork] = useState<Work | null>(null);
  const dirty = editing ? name.trim() !== "" && name.trim() !== editing.name : name.trim() !== "";

  function beginEdit(work: Work) {
    setEditing(work);
    setName(work.name);
  }

  function cancelEdit() {
    setEditing(null);
    setName("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty) return;
    setPendingId(editing?.id ?? "new");
    const result = await saveWorkItem({ id: editing?.id ?? "", name });
    setPendingId(null);
    if (!result.ok) {
      notify(result.message, "error");
      return;
    }
    notify(editing ? "Darbs saglabāts." : "Darbs pievienots.", "ok");
    cancelEdit();
  }

  async function remove(id: string) {
    setPendingId(id);
    const result = await removeWork(id);
    setPendingId(null);
    if (!result.ok) {
      notify(result.message, "error");
      return;
    }
    notify("Darbs dzēsts.", "ok");
    setConfirmWork(null);
    if (editing?.id === id) cancelEdit();
  }

  return (
    <div className="animate-slide-up">
      <h1 className="text-3xl font-semibold tracking-tight">Darbi</h1>
      <p className="mt-2 max-w-2xl text-sm text-[#5f756a]">
        Darba nosaukums, ko piesaista rēķinam. Apstrādē darbs ir obligāts.
      </p>

      <form onSubmit={submit} className="mt-8 rounded-3xl border border-[#d3e4da] bg-white p-5 sm:p-6">
        <h2 className="font-semibold">{editing ? "Labot darbu" : "Jauns darbs"}</h2>
        <label className="mt-5 block max-w-md text-sm font-medium">
          Nosaukums
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={fieldClass}
            placeholder="Piemēram, fasādes remonts"
          />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          {editing ? (
            <button type="button" onClick={cancelEdit} className="h-11 rounded-xl px-4 text-sm font-semibold text-[#1e3a2f]">
              Atcelt
            </button>
          ) : null}
          <button
            type="submit"
            disabled={!dirty || pendingId !== null}
            className="h-11 rounded-xl bg-[#1a6b4a] px-5 text-sm font-semibold text-white hover:bg-[#0f4a34] disabled:bg-[#c5d8cc] disabled:text-[#5f756a]"
          >
            {editing ? "Saglabāt" : "Pievienot"}
          </button>
        </div>
      </form>

      <section className="mt-4 overflow-hidden rounded-3xl border border-[#d3e4da] bg-white">
        {works.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm text-[#5f756a]">Darbu vēl nav.</p>
        ) : (
          <ul className="divide-y divide-[#e4efe8]">
            {works.map((work) => (
              <li key={work.id} className="flex items-center justify-between gap-3 px-5 py-4">
                <p className="font-medium">{work.name}</p>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => beginEdit(work)} className="h-10 rounded-xl px-3 text-sm font-semibold text-[#1a6b4a]">
                    Labot
                  </button>
                  <button type="button" onClick={() => setConfirmWork(work)} className="h-10 rounded-xl px-3 text-sm font-semibold text-[#b42318]">
                    Dzēst
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {confirmWork ? (
        <ConfirmModal
          title="Dzēst darbu?"
          text={`${confirmWork.name} tiks dzēsts.`}
          pending={pendingId === confirmWork.id}
          onCancel={() => {
            if (pendingId !== confirmWork.id) setConfirmWork(null);
          }}
          onConfirm={() => void remove(confirmWork.id)}
        />
      ) : null}
    </div>
  );
}

const fieldClass =
  "mt-2 h-11 w-full rounded-xl border border-[#c5d9cd] bg-white px-3 font-normal outline-none focus:border-[#1a6b4a] focus:ring-4 focus:ring-[#1a6b4a]/15";
