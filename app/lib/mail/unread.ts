import { invoiceFileMime, invoiceStoragePath, MAX_INVOICE_FILE_BYTES, removeInvoiceFile, uploadInvoiceFile } from "@/app/lib/invoices/files";
import type { InboxItem } from "@/app/lib/invoices/model";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { ImapFlow } from "imapflow";
import type { FetchMessageObject, MessageStructureObject } from "imapflow";

const BATCH = 80;

type MailResult =
  | { ok: true; message: string; items: InboxItem[]; updated: BodyUpdate[] }
  | { ok: false; status: number; message: string };

type BodyUpdate = { id: string; bodyText: string };
type MailAccount = { email: string; password: string };

export async function fetchUnreadMail(): Promise<MailResult> {
  const supabase = createAdminClient();
  if (!supabase) return { ok: false, status: 503, message: "Datubāze nav pieslēgta." };

  const accounts = await loadMailAccounts(supabase);
  if (!accounts) return { ok: false, status: 503, message: "Datubāze nav pieejama." };
  if (accounts.length === 0) return { ok: false, status: 400, message: "Vispirms saglabā rēķinu e-pastu uzstādījumos." };

  const items: InboxItem[] = [];
  const updated: BodyUpdate[] = [];
  const errors: string[] = [];
  let remaining = false;
  for (const account of accounts) {
    const hosts = hostsFor(account.email);
    if (hosts.length === 0) {
      errors.push(`${account.email}: e-pasta adrese nav derīga.`);
      continue;
    }
    let authMessage: string | null = null;
    let connectMessage: string | null = null;
    let done = false;
    for (const host of hosts) {
      try {
        const result = await importUnseen(host, account.email, account.password);
        items.push(...result.items);
        updated.push(...result.updated);
        if (result.remaining > 0) remaining = true;
        done = true;
        break;
      } catch (error) {
        const message = friendlyError(error, account.email);
        if (isAuthError(error)) authMessage = message;
        else connectMessage = message;
      }
    }
    if (!done) errors.push(`${account.email}: ${authMessage ?? connectMessage ?? "Neizdevās pieslēgties pastkastei."}`);
  }

  if (items.length === 0 && updated.length === 0 && errors.length > 0) {
    return { ok: false, status: 502, message: errors.join(" ") };
  }

  const extra = remaining ? " Nospied vēlreiz, lai ielasītu pārējos." : "";
  const problem = errors.length > 0 ? ` ${errors.join(" ")}` : "";
  const message =
    items.length === 0
      ? updated.length > 0
        ? `E-pasta teksti papildināti.${problem}`
        : `Neizlasītu e-pastu nav.${problem}`
      : items.length === 1
        ? `Ielasīts 1 neizlasīts e-pasts.${extra}${problem}`
        : `Ielasīti ${items.length} neizlasīti e-pasti.${extra}${problem}`;
  return { ok: true, message, items, updated };
}

async function loadMailAccounts(supabase: NonNullable<ReturnType<typeof createAdminClient>>): Promise<MailAccount[] | null> {
  const mailboxes = await supabase.from("mailboxes").select("email, password, sort_order").order("sort_order");
  if (mailboxes.error) return null;
  const accounts = (mailboxes.data ?? [])
    .map((row) => ({ email: String(row.email).trim(), password: mailboxPassword(String(row.email), String(row.password)) }))
    .filter((account) => account.email && account.password);
  if (accounts.length > 0) return accounts;

  const settings = await supabase.from("company_settings").select("mailbox_email, mailbox_password").eq("id", 1).maybeSingle();
  if (settings.error || !settings.data) return null;
  const email = settings.data.mailbox_email.trim();
  const password = mailboxPassword(email, settings.data.mailbox_password);
  return email && password ? [{ email, password }] : [];
}

export async function markMailSeen(messageId: string): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase || !messageId) return;
  const accounts = await loadMailAccounts(supabase);
  if (!accounts) return;

  for (const account of accounts) {
    for (const host of hostsFor(account.email)) {
      const client = createMailClient(host, account.email, account.password);
      try {
        await client.connect();
        const lock = await client.getMailboxLock("INBOX");
        try {
          if (messageId.startsWith("uid:")) {
            const uid = Number(messageId.slice(4));
            if (Number.isFinite(uid)) await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
          } else {
            const found = await client.search({ header: { "message-id": messageId } });
            if (found && found.length > 0) await client.messageFlagsAdd(found, ["\\Seen"]);
          }
        } finally {
          lock.release();
        }
        await client.logout();
        return;
      } catch {
        try {
          await client.logout();
        } catch {
          client.close();
        }
      }
    }
  }
}

async function importUnseen(host: string, email: string, password: string) {
  const client = createMailClient(host, email, password);
  await client.connect();
  const lock = await client.getMailboxLock("INBOX");
  try {
    const known = await loadKnownMessageIds();
    if (!known) throw new Error("Datubāze nav pieejama.");
    const updated = await fillMissingBodies(client);
    await markKnownSeen(client, known);

    const unseen = await client.search({ seen: false }, { uid: true });
    const all = Array.isArray(unseen) ? unseen : [];
    const uids = all.slice(0, BATCH);
    const messages = uids.length
      ? await client.fetchAll(uids, { envelope: true, bodyStructure: true, uid: true }, { uid: true })
      : [];
    const withFiles: MailMessage[] = [];
    for (const message of messages) {
      withFiles.push({
        message,
        file: await downloadAttachment(client, message),
        text: await downloadText(client, message),
      });
    }
    const stored = await storeMessages(
      client,
      { messages: withFiles, remaining: Math.max(all.length - withFiles.length, 0) },
      known,
    );
    return { items: stored.items, updated: [...updated, ...stored.updated], remaining: stored.remaining };
  } finally {
    lock.release();
    await client.logout();
  }
}

async function loadKnownMessageIds() {
  const supabase = createAdminClient();
  if (!supabase) return null;
  const [imported, existing] = await Promise.all([
    supabase.from("mailbox_imports").select("message_id"),
    supabase.from("inbox_items").select("message_id").not("message_id", "is", null),
  ]);
  if (imported.error || existing.error) return null;
  return new Set<string>([
    ...(imported.data ?? []).map((row) => row.message_id as string),
    ...(existing.data ?? []).map((row) => row.message_id as string),
  ]);
}

async function markKnownSeen(client: ImapFlow, known: Set<string>) {
  const uids = new Set<number>();
  for (const id of known) {
    if (!id) continue;
    try {
      const found = id.startsWith("uid:")
        ? await client.search({ uid: Number(id.slice(4)), seen: false }, { uid: true })
        : await findUnseenByMessageId(client, id);
      if (!Array.isArray(found)) continue;
      for (const uid of found) uids.add(uid);
    } catch {
      continue;
    }
  }
  if (uids.size === 0) return;
  await client.messageFlagsAdd([...uids], ["\\Seen"], { uid: true });
}

async function findUnseenByMessageId(client: ImapFlow, id: string) {
  const plain = await client.search({ seen: false, header: { "message-id": id } }, { uid: true });
  if (Array.isArray(plain) && plain.length > 0) return plain;
  return client.search({ seen: false, header: { "message-id": `<${id}>` } }, { uid: true });
}

async function markUidSeen(client: ImapFlow, uid: number) {
  try {
    await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
  } catch {
    return;
  }
}

async function storeMessages(
  client: ImapFlow,
  batch: { messages: MailMessage[]; remaining: number },
  known: Set<string>,
) {
  const supabase = createAdminClient();
  if (!supabase) throw new Error("Datubāze nav pieslēgta.");

  const items: InboxItem[] = [];
  const updated: BodyUpdate[] = [];
  for (const entry of batch.messages) {
    const item = toInboxItem(entry.message);
    if (known.has(item.messageId ?? "")) {
      if (entry.text && item.messageId) {
        const saved = await supabase
          .from("inbox_items")
          .update({ body_text: entry.text })
          .eq("message_id", item.messageId)
          .eq("body_text", "")
          .select("id");
        for (const row of saved.data ?? []) updated.push({ id: row.id as string, bodyText: entry.text });
      }
      await markUidSeen(client, entry.message.uid);
      continue;
    }

    let storagePath: string | null = null;
    if (entry.file) {
      storagePath = invoiceStoragePath(entry.file.name);
      const uploaded = await uploadInvoiceFile(supabase, storagePath, entry.file.bytes, entry.file.mime);
      if (uploaded) storagePath = null;
      else {
        item.fileName = entry.file.name;
        item.fileMime = entry.file.mime;
        item.fileSize = entry.file.bytes.length;
        item.number = invoiceNumber(item.subject, item.fileName);
      }
    }

    const inserted = await supabase
      .from("inbox_items")
      .insert({
        source: "email",
        from_email: item.fromEmail,
        subject: item.subject,
        file_name: item.fileName,
        file_mime: item.fileMime,
        file_size: item.fileSize,
        storage_path: storagePath,
        received_on: item.receivedOn,
        body_text: entry.text,
        supplier: item.supplier,
        number: item.number,
        net: null,
        gross: null,
        due_on: null,
        unread: true,
        message_id: item.messageId,
      })
      .select("id")
      .single();
    if (inserted.error || !inserted.data) {
      if (storagePath) await removeInvoiceFile(supabase, storagePath);
      continue;
    }

    await supabase.from("mailbox_imports").insert({ message_id: item.messageId });
    await markUidSeen(client, entry.message.uid);
    item.id = inserted.data.id as string;
    item.bodyText = entry.text;
    item.storagePath = storagePath;
    known.add(item.messageId ?? "");
    items.push(item);
  }

  return { items, updated, remaining: batch.remaining };
}

function toInboxItem(message: FetchMessageObject): InboxItem {
  const from = message.envelope?.from?.[0];
  const subject = message.envelope?.subject?.trim() || "(bez temata)";
  const fileName = firstAttachment(message.bodyStructure);
  const messageId = (message.envelope?.messageId || (message.emailId ? `email:${message.emailId}` : `uid:${message.uid}`)).replace(
    /^<|>$/g,
    "",
  );

  return {
    id: "",
    source: "email",
    fromEmail: from?.address ?? "",
    subject,
    fileName,
    fileMime: "",
    fileSize: null,
    receivedOn: rigaDate(message.envelope?.date),
    supplier: supplierName(from?.name, from?.address),
    number: invoiceNumber(subject, fileName),
    net: null,
    gross: null,
    dueOn: null,
    messageId,
    bodyText: "",
    storagePath: null,
  };
}

function firstAttachment(node: MessageStructureObject | undefined): string | null {
  if (!node) return null;
  const name = node.dispositionParameters?.filename || node.parameters?.name || null;
  const disposition = node.disposition?.toLowerCase();
  if (name && (disposition === "attachment" || node.type.split("/")[0] === "application")) return name;
  for (const child of node.childNodes ?? []) {
    const found = firstAttachment(child);
    if (found) return found;
  }
  return null;
}

function invoiceNumber(subject: string, fileName: string | null) {
  const source = `${subject} ${fileName ?? ""}`;
  const labeled = source.match(/(?:rēķins|rekins|invoice|pavadzīme|nr\.?|no\.?)\s*[:#]?\s*([A-Z0-9][A-Z0-9./-]{1,40})/i);
  if (labeled?.[1]) return labeled[1].slice(0, 40);
  const token = source.match(/\b[A-Z]{1,8}[-/]\d{2,}\b|\b\d{4,}\b/i);
  if (token) return token[0].slice(0, 40);
  const stem = (fileName ?? subject).replace(/\.[a-z0-9]+$/i, "").trim();
  return (stem || "Bez numura").slice(0, 40);
}

function supplierName(name: string | undefined, address: string | undefined) {
  const clean = (name ?? "").replace(/["<>]/g, "").trim();
  if (clean) return clean.slice(0, 120);
  const domain = address?.split("@")[1]?.split(".")[0];
  return domain ? domain.slice(0, 120) : "Nezināms sūtītājs";
}

function rigaDate(value: Date | string | undefined) {
  const date = value ? new Date(value) : new Date();
  const safe = Number.isNaN(date.getTime()) ? new Date() : date;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Riga",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(safe);
}

async function fillMissingBodies(client: ImapFlow): Promise<BodyUpdate[]> {
  const supabase = createAdminClient();
  if (!supabase) return [];
  const rows = await supabase
    .from("inbox_items")
    .select("id, message_id")
    .eq("source", "email")
    .eq("body_text", "")
    .not("message_id", "is", null)
    .limit(40);
  if (rows.error || !rows.data) return [];

  const updated: BodyUpdate[] = [];
  for (const row of rows.data) {
    const messageId = String(row.message_id ?? "");
    if (!messageId) continue;
    try {
      const uid = await findMessageUid(client, messageId);
      if (uid == null) continue;
      const [message] = await client.fetchAll([uid], { bodyStructure: true, uid: true }, { uid: true });
      if (!message) continue;
      const text = await downloadText(client, message);
      if (!text) continue;
      const saved = await supabase.from("inbox_items").update({ body_text: text }).eq("id", row.id);
      if (!saved.error) updated.push({ id: row.id as string, bodyText: text });
    } catch {
      continue;
    }
  }
  return updated;
}

async function findMessageUid(client: ImapFlow, id: string) {
  if (id.startsWith("uid:")) {
    const uid = Number(id.slice(4));
    if (!Number.isFinite(uid)) return null;
    const found = await client.search({ uid }, { uid: true });
    return Array.isArray(found) && found.length > 0 ? found[0] : null;
  }
  const plain = await client.search({ header: { "message-id": id } }, { uid: true });
  if (Array.isArray(plain) && plain.length > 0) return plain[0];
  const wrapped = await client.search({ header: { "message-id": `<${id}>` } }, { uid: true });
  return Array.isArray(wrapped) && wrapped.length > 0 ? wrapped[0] : null;
}

async function downloadText(client: ImapFlow, message: FetchMessageObject) {
  const part = pickTextPart(message.bodyStructure);
  if (!part) return "";
  try {
    const downloaded = await client.download(String(message.uid), part.part, { uid: true, maxBytes: 1_000_000 });
    if (!downloaded?.content) return "";
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of downloaded.content) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += bytes.length;
      if (total > 1_000_000) return "";
      chunks.push(bytes);
    }
    const raw = decodeBytes(Buffer.concat(chunks), part.charset).replace(/^\uFEFF/, "").trim();
    return raw.slice(0, 200_000);
  } catch {
    return "";
  }
}

function pickTextPart(node: MessageStructureObject | undefined) {
  const parts: { part: string; mime: string; charset: string }[] = [];
  collectText(node, parts);
  return parts.find((part) => part.mime === "text/html") ?? parts.find((part) => part.mime === "text/plain") ?? null;
}

function collectText(node: MessageStructureObject | undefined, parts: { part: string; mime: string; charset: string }[]) {
  if (!node) return;
  const mime = (node.type || "").toLowerCase();
  const disposition = node.disposition?.toLowerCase();
  if (node.part && disposition !== "attachment" && (mime === "text/plain" || mime === "text/html")) {
    parts.push({ part: node.part, mime, charset: node.parameters?.charset || "utf-8" });
  }
  for (const child of node.childNodes ?? []) collectText(child, parts);
}

function decodeBytes(bytes: Buffer, charset: string) {
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return bytes.toString("utf8");
  }
}

function hostsFor(email: string) {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (!domain || !domain.includes(".")) return [];
  if (domain === "gmail.com" || domain === "googlemail.com") return ["imap.gmail.com"];
  if (["outlook.com", "hotmail.com", "live.com", "msn.com"].includes(domain)) return ["outlook.office365.com"];
  if (domain === "yahoo.com" || domain.endsWith(".yahoo.com")) return ["imap.mail.yahoo.com"];
  if (domain === "icloud.com" || domain === "me.com" || domain === "mac.com") return ["imap.mail.me.com"];
  if (domain === "inbox.lv") return ["mail.inbox.lv"];
  return [`imap.${domain}`, `mail.${domain}`];
}

function createMailClient(host: string, email: string, password: string) {
  return new ImapFlow({
    host,
    port: 993,
    secure: true,
    auth: { user: email, pass: password },
    logger: false,
    connectionTimeout: 12000,
    greetingTimeout: 12000,
    socketTimeout: 20000,
  });
}

function isAuthError(error: unknown) {
  if (error && typeof error === "object") {
    if ("authenticationFailed" in error && error.authenticationFailed) return true;
    if ("serverResponseCode" in error && error.serverResponseCode === "AUTHENTICATIONFAILED") return true;
  }
  const text = error instanceof Error ? error.message : String(error);
  return /auth|credentials|login|authentication/i.test(text) && !/ENOTFOUND|ETIMEDOUT|timeout/i.test(text);
}

function mailboxPassword(email: string, password: string) {
  const trimmed = password.trim();
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (domain === "gmail.com" || domain === "googlemail.com") return trimmed.replace(/\s+/g, "");
  return trimmed;
}

type MailFile = { name: string; mime: string; bytes: Buffer };
type MailMessage = { message: FetchMessageObject; file: MailFile | null; text: string };
type AttachmentPart = { part: string; name: string; mime: string; size: number };

async function downloadAttachment(client: ImapFlow, message: FetchMessageObject): Promise<MailFile | null> {
  const part = pickAttachment(message.bodyStructure);
  if (!part || part.size > MAX_INVOICE_FILE_BYTES) return null;
  try {
    const downloaded = await client.download(String(message.uid), part.part, { uid: true, maxBytes: MAX_INVOICE_FILE_BYTES });
    if (!downloaded.content) return null;
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of downloaded.content) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += bytes.length;
      if (total > MAX_INVOICE_FILE_BYTES) return null;
      chunks.push(bytes);
    }
    if (total === 0) return null;
    return { name: part.name, mime: invoiceFileMime(part.name, part.mime), bytes: Buffer.concat(chunks) };
  } catch {
    return null;
  }
}

function pickAttachment(node: MessageStructureObject | undefined) {
  const parts: AttachmentPart[] = [];
  collectParts(node, parts);
  return (
    parts.find((part) => part.mime === "application/pdf" || part.name.toLowerCase().endsWith(".pdf")) ??
    parts.find((part) => part.mime.startsWith("image/")) ??
    parts[0] ??
    null
  );
}

function collectParts(node: MessageStructureObject | undefined, parts: AttachmentPart[]) {
  if (!node) return;
  const name = node.dispositionParameters?.filename || node.parameters?.name || "";
  const mime = (node.type || "").toLowerCase();
  const major = mime.split("/")[0];
  if (node.part && major !== "multipart" && major !== "text" && (name || major === "application" || major === "image")) {
    parts.push({
      part: node.part,
      name: name || `pielikums-${node.part}`,
      mime: mime || "application/octet-stream",
      size: node.size ?? 0,
    });
  }
  for (const child of node.childNodes ?? []) collectParts(child, parts);
}

function friendlyError(error: unknown, email: string) {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (isAuthError(error)) {
    if (domain === "gmail.com" || domain === "googlemail.com") {
      return "Gmail nepieņem parasto konta paroli. Izveido lietotnes paroli Google konta drošībā un saglabā to uzstādījumos. Pārbaudi arī, vai Gmail ir ieslēgts IMAP.";
    }
    return "Pastkaste noraidīja e-pastu vai paroli.";
  }
  return "Neizdevās pieslēgties pastkastei. Pārbaudi, vai šim e-pastam ir ieslēgts IMAP.";
}
