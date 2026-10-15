"use server";

import type { CompanySettings, Mailbox } from "@/app/lib/company-settings";
import { settingsUpdate } from "@/app/lib/invoices/repository";
import { createAdminClient } from "@/app/lib/supabase/admin";

export async function saveCompanySettings(
  settings: CompanySettings,
): Promise<{ ok: true; settings: CompanySettings } | { ok: false; message: string }> {
  const supabase = createAdminClient();
  if (!supabase) return { ok: false, message: "Datubāze nav pieslēgta." };

  const mailboxes = await replaceMailboxes(supabase, settings.mailboxes);
  if (!mailboxes.ok) return mailboxes;
  const first = mailboxes.mailboxes[0];
  const next: CompanySettings = {
    ...settings,
    mailboxes: mailboxes.mailboxes,
    mailboxEmail: first?.email ?? "",
    mailboxPassword: first?.password ?? "",
  };
  const { error } = await supabase.from("company_settings").update(settingsUpdate(next)).eq("id", 1);
  if (error) return { ok: false, message: "Uzstādījumus neizdevās saglabāt." };
  return { ok: true, settings: next };
}

async function replaceMailboxes(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  mailboxes: Mailbox[],
): Promise<{ ok: true; mailboxes: Mailbox[] } | { ok: false; message: string }> {
  const cleaned = mailboxes
    .map((mailbox) => ({ id: mailbox.id, email: mailbox.email.trim(), password: mailbox.password }))
    .filter((mailbox) => mailbox.email);
  const emails = cleaned.map((mailbox) => mailbox.email.toLowerCase());
  if (new Set(emails).size !== emails.length) return { ok: false, message: "E-pasta adreses nedrīkst atkārtoties." };
  if (cleaned.some((mailbox) => !mailbox.email.includes("@"))) return { ok: false, message: "E-pasta adrese nav derīga." };

  const existing = await supabase.from("mailboxes").select("id, password");
  if (existing.error) return { ok: false, message: "Uzstādījumus neizdevās saglabāt." };
  const previous = new Map((existing.data ?? []).map((row) => [row.id as string, row.password as string]));
  const next: Mailbox[] = [];
  for (const mailbox of cleaned) {
    const password = mailbox.password.trim() || previous.get(mailbox.id) || "";
    if (!password) return { ok: false, message: "Katram e-pastam vajag paroli." };
    next.push({ id: mailbox.id || crypto.randomUUID(), email: mailbox.email, password });
  }

  const keep = new Set(next.map((mailbox) => mailbox.id));
  const remove = [...previous.keys()].filter((id) => !keep.has(id));
  if (remove.length > 0) {
    const deleted = await supabase.from("mailboxes").delete().in("id", remove);
    if (deleted.error) return { ok: false, message: "Uzstādījumus neizdevās saglabāt." };
  }
  for (const [index, mailbox] of next.entries()) {
    const saved = await supabase.from("mailboxes").upsert({
      id: mailbox.id,
      email: mailbox.email,
      password: mailbox.password,
      sort_order: index,
    });
    if (saved.error) return { ok: false, message: "Uzstādījumus neizdevās saglabāt." };
  }
  return { ok: true, mailboxes: next };
}
