import { defaultCompanySettings, type CompanySettings } from "@/app/lib/company-settings";
import { type InboxItem, type Invoice, type Site } from "@/app/lib/invoices/model";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type DeskData = {
  connected: boolean;
  invoices: Invoice[];
  inbox: InboxItem[];
  sites: Site[];
  settings: CompanySettings;
  notice: string | null;
};

type InvoiceRow = {
  id: string;
  number: string;
  supplier: string;
  supplier_iban?: string | null;
  client: string;
    object_id: string | null;
    object_name: string;
    category_id?: string | null;
    category_name?: string | null;
  cost_type: string;
  net: number | string;
  gross: number | string;
  issued_on: string;
  due_on: string;
  paid: boolean;
  from_email?: string | null;
  subject?: string | null;
  body_text?: string | null;
  file_name?: string | null;
  file_mime?: string | null;
  file_size?: number | string | null;
  storage_path?: string | null;
};

type InboxRow = {
  id: string;
  source: "email" | "upload";
  from_email: string;
  subject: string;
  file_name: string | null;
  file_mime: string | null;
  file_size: number | string | null;
  received_on: string;
  supplier: string;
  number: string;
  net: number | string | null;
  gross: number | string | null;
  due_on: string | null;
  message_id: string | null;
  body_text: string | null;
  storage_path: string | null;
};

type MailboxRow = {
  id: string;
  email: string;
  password: string;
  sort_order: number;
};

type SettingsRow = {
  name: string;
  registration_number: string;
  vat_number: string;
  address: string;
  email: string;
  phone: string;
  vat_rate: string;
  payment_days: string;
  currency: string;
  bank_name: string;
  iban: string;
  overdue_reminders: boolean;
  mailbox_email: string;
  mailbox_password: string;
  offer_hourly_rate?: string | null;
  offer_valid_days?: string | null;
  offer_note?: string | null;
};

export function createDataClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey || url.includes("your-project")) return null;
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

export async function loadDeskData(): Promise<DeskData> {
  const empty: DeskData = {
    connected: false,
    invoices: [],
    inbox: [],
    sites: [],
    settings: defaultCompanySettings,
    notice: "Datubāze nav pieslēgta.",
  };
  const supabase = createDataClient();
  if (!supabase) return empty;

  const [invoices, inbox, settings, sites, mailboxes] = await Promise.all([
    supabase.from("invoices").select("*").order("issued_on", { ascending: false }),
    supabase.from("inbox_items").select("*").eq("unread", true).order("received_on", { ascending: false }),
    supabase.from("company_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("sites").select("id, address, customer, iban, bank_name").order("customer"),
    supabase.from("mailboxes").select("id, email, password, sort_order").order("sort_order"),
  ]);

  if (invoices.error || inbox.error || settings.error || sites.error || mailboxes.error) {
    return {
      ...empty,
      notice: "Datubāze nav pieejama.",
    };
  }

  return {
    connected: true,
    invoices: (invoices.data as InvoiceRow[]).map(toInvoice),
    inbox: (inbox.data as InboxRow[]).map(toInbox),
    sites: ((sites.data ?? []) as SiteRow[]).map(toSite),
    settings: settings.data
      ? toSettings(settings.data as SettingsRow, (mailboxes.data ?? []) as MailboxRow[])
      : defaultCompanySettings,
    notice: null,
  };
}

export function invoiceInsert(invoice: Invoice) {
  return {
    number: invoice.number,
    supplier: invoice.supplier,
    supplier_iban: invoice.supplierIban,
    client: invoice.client,
    object_id: invoice.objectId,
    object_name: invoice.objectName,
    category_id: invoice.categoryId,
    category_name: invoice.categoryName,
    cost_type: "",
    net: invoice.net,
    gross: invoice.gross,
    issued_on: invoice.issuedOn,
    due_on: invoice.dueOn,
    paid: invoice.paid,
    from_email: invoice.fromEmail,
    subject: invoice.subject,
    body_text: invoice.bodyText,
    file_name: invoice.fileName,
    file_mime: invoice.fileMime,
    file_size: invoice.fileSize,
    storage_path: invoice.storagePath,
  };
}

export function inboxInsert(item: InboxItem) {
  return {
    source: item.source,
    from_email: item.fromEmail,
    subject: item.subject,
    file_name: item.fileName,
    file_mime: item.fileMime,
    file_size: item.fileSize,
    received_on: item.receivedOn,
    supplier: item.supplier,
    number: item.number,
    net: item.net,
    gross: item.gross,
    due_on: item.dueOn,
    unread: true,
    message_id: item.messageId,
    body_text: item.bodyText,
    storage_path: item.storagePath,
  };
}

export function settingsUpdate(settings: CompanySettings) {
  return {
    name: settings.name,
    registration_number: settings.registrationNumber,
    vat_number: settings.vatNumber,
    address: settings.address,
    email: settings.email,
    phone: settings.phone,
    vat_rate: settings.vatRate,
    payment_days: settings.paymentDays,
    currency: settings.currency,
    bank_name: settings.bankName,
    iban: settings.iban,
    overdue_reminders: settings.overdueReminders,
    mailbox_email: settings.mailboxEmail,
    mailbox_password: settings.mailboxPassword,
    offer_hourly_rate: settings.offerHourlyRate ?? "",
    offer_valid_days: settings.offerValidDays ?? "",
    offer_note: settings.offerNote ?? "",
    updated_at: new Date().toISOString(),
  };
}

export async function setInvoicePaid(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("invoices").update({ paid: true }).eq("id", id);
  return error?.message ?? null;
}

export async function updateInvoice(supabase: SupabaseClient, invoice: Invoice) {
  const { error } = await supabase
    .from("invoices")
    .update({
      number: invoice.number,
      supplier_iban: invoice.supplierIban,
      client: invoice.client,
      object_id: invoice.objectId,
      object_name: invoice.objectName,
      category_id: invoice.categoryId,
      category_name: invoice.categoryName,
      net: invoice.net,
      gross: invoice.gross,
      issued_on: invoice.issuedOn,
      due_on: invoice.dueOn,
    })
    .eq("id", invoice.id);
  return error?.message ?? null;
}

export async function insertInvoice(supabase: SupabaseClient, invoice: Invoice) {
  const { data, error } = await supabase.from("invoices").insert(invoiceInsert(invoice)).select("id").single();
  return { id: data?.id as string | undefined, error: error?.message ?? null };
}

export async function removeInboxItem(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("inbox_items").delete().eq("id", id);
  return error?.message ?? null;
}

export async function insertInboxItem(supabase: SupabaseClient, item: InboxItem) {
  const { data, error } = await supabase.from("inbox_items").insert(inboxInsert(item)).select("id").single();
  return { id: data?.id as string | undefined, error: error?.message ?? null };
}

type SiteRow = {
  id: string;
  address: string;
  customer: string;
  iban?: string | null;
  bank_name?: string | null;
};

function toSite(row: SiteRow): Site {
  return {
    id: row.id,
    address: row.address,
    customer: row.customer,
    iban: row.iban ?? "",
    bankName: row.bank_name ?? "",
  };
}

export async function saveSite(supabase: SupabaseClient, site: Site) {
  const row = { address: site.address, customer: site.customer, iban: site.iban, bank_name: site.bankName };
  const query = site.id
    ? supabase.from("sites").update(row).eq("id", site.id).select("id").single()
    : supabase.from("sites").insert(row).select("id").single();
  const { data, error } = await query;
  return { id: data?.id as string | undefined, error: error?.message ?? null };
}

export async function deleteSite(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("sites").delete().eq("id", id);
  return error?.message ?? null;
}

export async function updateSettings(supabase: SupabaseClient, settings: CompanySettings) {
  const { error } = await supabase.from("company_settings").update(settingsUpdate(settings)).eq("id", 1);
  return error?.message ?? null;
}

function toInvoice(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    number: row.number,
    supplier: row.supplier,
    supplierIban: row.supplier_iban ?? "",
    client: row.client,
    objectId: row.object_id,
    objectName: row.object_name,
    categoryId: row.category_id ?? "",
    categoryName: row.category_name ?? "",
    net: Number(row.net),
    gross: Number(row.gross),
    issuedOn: row.issued_on,
    dueOn: row.due_on,
    paid: row.paid,
    fromEmail: row.from_email ?? "",
    subject: row.subject ?? "",
    bodyText: row.body_text ?? "",
    fileName: row.file_name ?? null,
    fileMime: row.file_mime ?? "",
    fileSize: row.file_size == null ? null : Number(row.file_size),
    storagePath: row.storage_path ?? null,
  };
}

function toInbox(row: InboxRow): InboxItem {
  return {
    id: row.id,
    source: row.source,
    fromEmail: row.from_email,
    subject: row.subject,
    fileName: row.file_name,
    fileMime: row.file_mime ?? "",
    fileSize: row.file_size == null ? null : Number(row.file_size),
    receivedOn: row.received_on,
    supplier: row.supplier,
    number: row.number,
    net: row.net == null ? null : Number(row.net),
    gross: row.gross == null ? null : Number(row.gross),
    dueOn: row.due_on,
    messageId: row.message_id,
    bodyText: row.body_text ?? "",
    storagePath: row.storage_path,
  };
}

function toSettings(row: SettingsRow, mailboxes: MailboxRow[]): CompanySettings {
  const list = mailboxes.length
    ? mailboxes.map((mailbox) => ({ id: mailbox.id, email: mailbox.email, password: mailbox.password }))
    : row.mailbox_email
      ? [{ id: "legacy-mailbox", email: row.mailbox_email, password: row.mailbox_password }]
      : [];
  const first = list[0];
  return {
    name: row.name,
    registrationNumber: row.registration_number,
    vatNumber: row.vat_number,
    address: row.address,
    email: row.email,
    phone: row.phone,
    vatRate: row.vat_rate,
    paymentDays: row.payment_days,
    currency: row.currency,
    bankName: row.bank_name,
    iban: row.iban,
    overdueReminders: row.overdue_reminders,
    mailboxEmail: first?.email ?? "",
    mailboxPassword: first?.password ?? "",
    mailboxes: list,
    offerHourlyRate: row.offer_hourly_rate ?? "",
    offerValidDays: row.offer_valid_days ?? "",
    offerNote: row.offer_note ?? "",
  };
}
