"use client";

import { type CompanySettings } from "@/app/lib/company-settings";
import {
  monthOf,
  type InboxItem,
  type Invoice,
  type MonthKey,
  type Site,
  type Work,
} from "@/app/lib/invoices/model";
import {
  createDataClient,
  deleteSite,
  deleteWork,
  insertInvoice,
  removeInboxItem,
  setInvoicePaid,
  updateInvoice,
  saveSite,
  saveWork,
} from "@/app/lib/invoices/repository";
import { bankFromIban, isValidIban, normalizeIban } from "@/app/lib/payments/iban";
import { saveCompanySettings } from "@/app/lib/settings/save-settings";
import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type NoticeTone = "ok" | "error" | "info";

export type Notice = {
  id: string;
  text: string;
  tone: NoticeTone;
};

export type Approval = {
  client: string;
  objectId: string;
  objectName: string;
  workId: string;
  workName: string;
  number: string;
  issuedOn: string;
  net: number;
  gross: number;
  dueOn: string;
};

type InvoiceContextValue = {
  today: string;
  month: MonthKey;
  setMonth: (month: MonthKey) => void;
  invoices: Invoice[];
  inbox: InboxItem[];
  notices: Notice[];
  dismissNotice: (id: string) => void;
  notify: (text: string, tone?: NoticeTone) => void;
  approve: (itemId: string, approval: Approval) => Promise<void>;
  saveInvoice: (invoice: Invoice) => Promise<{ ok: true } | { ok: false; message: string }>;
  markPaid: (id: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  addUpload: (file: File) => Promise<void>;
  discardInbox: (id: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  sites: Site[];
  works: Work[];
  loadUnreadMail: () => Promise<void>;
  saveSite: (site: Site) => Promise<{ ok: true } | { ok: false; message: string }>;
  removeSite: (id: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  saveWorkItem: (work: Work) => Promise<{ ok: true } | { ok: false; message: string }>;
  removeWork: (id: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  settings: CompanySettings;
  saveSettings: (settings: CompanySettings) => Promise<{ ok: true; settings: CompanySettings } | { ok: false; message: string }>;
};

const InvoiceContext = createContext<InvoiceContextValue | null>(null);

export function InvoiceProvider({
  today,
  connected,
  invoices: initialInvoices,
  inbox: initialInbox,
  sites: initialSites,
  works: initialWorks,
  settings: initialSettings,
  initialNotice,
  children,
}: {
  today: string;
  connected: boolean;
  invoices: Invoice[];
  inbox: InboxItem[];
  sites: Site[];
  works: Work[];
  settings: CompanySettings;
  initialNotice: string | null;
  children: ReactNode;
}) {
  const [month, setMonth] = useState(() => monthOf(today));
  const [invoices, setInvoices] = useState(initialInvoices);
  const [inbox, setInbox] = useState(initialInbox);
  const [sites, setSites] = useState(initialSites);
  const [works, setWorks] = useState(initialWorks);
  const [notices, setNotices] = useState<Notice[]>(
    initialNotice ? [{ id: "initial", text: initialNotice, tone: "error" }] : [],
  );
  const [settings, setSettings] = useState<CompanySettings>(initialSettings);

  const pushNotice = useCallback((text: string, tone: NoticeTone = "info") => {
    setNotices((current) => [{ id: crypto.randomUUID(), text, tone }, ...current].slice(0, 4));
  }, []);

  const value = useMemo<InvoiceContextValue>(
    () => ({
      today,
      month,
      setMonth,
      invoices,
      inbox,
      sites,
      works,
      notices,
      dismissNotice: (id) => setNotices((current) => current.filter((entry) => entry.id !== id)),
      notify: pushNotice,
      approve: async (itemId, approval) => {
        const item = inbox.find((entry) => entry.id === itemId);
        if (!item) return;

        const invoice: Invoice = {
          id: `inv-${item.id}`,
          number: approval.number,
          supplier: item.supplier,
          supplierIban: "",
          client: approval.client,
          objectId: approval.objectId,
          objectName: approval.objectName,
          workId: approval.workId,
          workName: approval.workName,
          net: approval.net,
          gross: approval.gross,
          issuedOn: approval.issuedOn,
          dueOn: approval.dueOn,
          paid: false,
          fromEmail: item.fromEmail,
          subject: item.subject,
          bodyText: item.bodyText,
          fileName: item.fileName,
          fileMime: item.fileMime,
          fileSize: item.fileSize,
          storagePath: item.storagePath,
        };

        if (connected) {
          const supabase = createDataClient();
          if (!supabase) {
            pushNotice("Datubāze nav pieslēgta.", "error");
            return;
          }
          const inserted = await insertInvoice(supabase, invoice);
          if (!inserted.id) {
            pushNotice(inserted.error ?? "Rēķinu neizdevās saglabāt.", "error");
            return;
          }
          const removed = await removeInboxItem(supabase, item.id);
          invoice.id = inserted.id;
          if (removed) {
            pushNotice(removed, "error");
            return;
          }
        }

        if (item.messageId) {
          void fetch("/api/mail/seen", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ messageId: item.messageId }),
          });
        }

        setInvoices((current) => [invoice, ...current]);
        setInbox((current) => current.filter((entry) => entry.id !== itemId));
        setMonth(monthOf(approval.issuedOn));
        pushNotice(`Rēķins ${approval.number} pievienots sarakstam.`, "ok");
      },
      saveInvoice: async (invoice) => {
        if (!invoice.number.trim() || !invoice.issuedOn || !invoice.dueOn) {
          return { ok: false, message: "Aizpildiet numuru, datumu un termiņu." };
        }
        if (connected) {
          const supabase = createDataClient();
          if (!supabase) return { ok: false, message: "Datubāze nav pieslēgta." };
          const error = await updateInvoice(supabase, invoice);
          if (error) return { ok: false, message: error };
        }
        setInvoices((current) => current.map((entry) => (entry.id === invoice.id ? invoice : entry)));
        return { ok: true };
      },
      markPaid: async (id) => {
        if (connected) {
          const supabase = createDataClient();
          if (!supabase) {
            pushNotice("Datubāze nav pieslēgta.", "error");
            return { ok: false, message: "Datubāze nav pieslēgta." };
          }
          const error = await setInvoicePaid(supabase, id);
          if (error) {
            pushNotice(error, "error");
            return { ok: false, message: error };
          }
        }
        setInvoices((current) => current.map((entry) => (entry.id === id ? { ...entry, paid: true } : entry)));
        pushNotice("Rēķins atzīmēts kā apmaksāts.", "ok");
        return { ok: true };
      },
      addUpload: async (file) => {
        const body = new FormData();
        body.append("file", file);
        const response = await fetch("/api/inbox/upload", { method: "POST", body });
        const payload = (await response.json().catch(() => null)) as { message?: string; item?: InboxItem } | null;
        if (!response.ok || !payload?.item) {
          pushNotice(payload?.message ?? "Failu neizdevās pievienot.", "error");
          return;
        }
        setInbox((current) => [payload.item as InboxItem, ...current]);
        pushNotice(`${file.name} pievienots apstrādei.`, "ok");
      },
      discardInbox: async (id) => {
        const response = await fetch(`/api/inbox/${id}`, { method: "DELETE" });
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        if (!response.ok) {
          const message = payload?.message ?? "Neizdevās dzēst.";
          pushNotice(message, "error");
          return { ok: false, message };
        }
        setInbox((current) => current.filter((entry) => entry.id !== id));
        pushNotice("Noņemts no apstrādes.", "ok");
        return { ok: true };
      },
      loadUnreadMail: async () => {
        const response = await fetch("/api/mail/unread", { method: "POST" });
        const body = (await response.json().catch(() => null)) as {
          message?: string;
          items?: InboxItem[];
          updated?: { id: string; bodyText: string }[];
        } | null;
        if (!response.ok || !body) {
          pushNotice(body?.message ?? "E-pastus neizdevās ielādēt.", "error");
          return;
        }
        const items = body.items ?? [];
        const updated = new Map((body.updated ?? []).map((entry) => [entry.id, entry.bodyText]));
        setInbox((current) => {
          const ids = new Set(current.map((entry) => entry.messageId).filter(Boolean));
          const fresh = items.filter((entry) => !entry.messageId || !ids.has(entry.messageId));
          const merged = current.map((entry) => (updated.has(entry.id) ? { ...entry, bodyText: updated.get(entry.id) ?? "" } : entry));
          return [...fresh, ...merged];
        });
        pushNotice(body.message ?? "E-pasti ielādēti.", "ok");
      },
      saveSite: async (site) => {
        const iban = normalizeIban(site.iban);
        const next = {
          ...site,
          address: site.address.trim(),
          customer: site.customer.trim(),
          iban,
          bankName: bankFromIban(iban)?.name ?? "",
        };
        if (!next.customer || !next.address || !isValidIban(next.iban)) {
          return { ok: false, message: "Norādi nosaukumu, adresi un derīgu IBAN." };
        }
        if (connected) {
          const supabase = createDataClient();
          if (!supabase) return { ok: false, message: "Datubāze nav pieslēgta." };
          const saved = await saveSite(supabase, next);
          if (!saved.id) return { ok: false, message: saved.error ?? "Klientu neizdevās saglabāt." };
          next.id = saved.id;
        } else if (!next.id) {
          next.id = crypto.randomUUID();
        }
        setSites((current) => {
          const exists = current.some((entry) => entry.id === next.id);
          const list = exists ? current.map((entry) => (entry.id === next.id ? next : entry)) : [next, ...current];
          return list.sort((a, b) => a.customer.localeCompare(b.customer, "lv"));
        });
        return { ok: true };
      },
      removeSite: async (id) => {
        if (connected) {
          const supabase = createDataClient();
          if (!supabase) return { ok: false, message: "Datubāze nav pieslēgta." };
          const error = await deleteSite(supabase, id);
          if (error) return { ok: false, message: error };
        }
        setSites((current) => current.filter((entry) => entry.id !== id));
        return { ok: true };
      },
      saveWorkItem: async (work) => {
        const next = { ...work, name: work.name.trim() };
        if (!next.name) return { ok: false, message: "Norādi darba nosaukumu." };
        if (connected) {
          const supabase = createDataClient();
          if (!supabase) return { ok: false, message: "Datubāze nav pieslēgta." };
          const saved = await saveWork(supabase, next);
          if (!saved.id) return { ok: false, message: saved.error ?? "Darbu neizdevās saglabāt." };
          next.id = saved.id;
        } else if (!next.id) {
          next.id = crypto.randomUUID();
        }
        setWorks((current) => {
          const exists = current.some((entry) => entry.id === next.id);
          const list = exists ? current.map((entry) => (entry.id === next.id ? next : entry)) : [next, ...current];
          return list.sort((a, b) => a.name.localeCompare(b.name, "lv"));
        });
        return { ok: true };
      },
      removeWork: async (id) => {
        if (connected) {
          const supabase = createDataClient();
          if (!supabase) return { ok: false, message: "Datubāze nav pieslēgta." };
          const error = await deleteWork(supabase, id);
          if (error) return { ok: false, message: error };
        }
        setWorks((current) => current.filter((entry) => entry.id !== id));
        return { ok: true };
      },
      settings,
      saveSettings: async (next) => {
        const result = await saveCompanySettings(next);
        if (!result.ok) return result;
        setSettings(result.settings);
        return result;
      },
    }),
    [connected, inbox, invoices, month, notices, pushNotice, settings, sites, today, works],
  );

  return <InvoiceContext.Provider value={value}>{children}</InvoiceContext.Provider>;
}

export function useInvoices() {
  const value = useContext(InvoiceContext);
  if (!value) {
    throw new Error("useInvoices must be used within InvoiceProvider");
  }
  return value;
}
