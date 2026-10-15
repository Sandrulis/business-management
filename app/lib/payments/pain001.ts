import { buildFidavista } from "./fidavista";
import { bicFromIban, isValidIban, normalizeIban } from "./iban";

type PayableInvoice = {
  id: string;
  number: string;
  supplier: string;
  supplierIban: string;
  clientName?: string;
  clientIban?: string;
  gross: number;
  bodyText: string;
  subject: string;
};

export type PaymentFile =
  | { ok: true; xml: string; filename: string; skipped: string[] }
  | { ok: false; message: string };

export type PaymentFormat = "pain001" | "fidavista";

type Payment = {
  id: string;
  name: string;
  iban: string;
  bic: string;
  amount: number;
  reference: string;
  number: string;
  supplier: string;
};

export function preparePaymentFile(input: {
  invoices: PayableInvoice[];
  debtorName: string;
  debtorIban: string;
  debtorLegalId?: string;
  executionDate: string;
  createdAt?: Date;
  format?: PaymentFormat;
}): PaymentFile {
  const debtorIban = normalizeIban(input.debtorIban);
  const debtorName = sepaText(input.debtorName, 70);
  if (!debtorName || !isValidIban(debtorIban)) {
    return {
      ok: false,
      message: "Maksājuma failam vajag uzņēmuma nosaukumu un derīgu IBAN. Tos norādi sadaļā Uzņēmuma uzstādījumi, blokā Uzņēmums.",
    };
  }

  const skipped: string[] = [];
  const payments: Payment[] = [];
  for (const invoice of input.invoices) {
    const iban = creditorIban(invoice, debtorIban);
    if (!iban) {
      skipped.push(`${invoice.number}: klientam nav IBAN`);
      continue;
    }
    if (invoice.gross < 0.01) {
      skipped.push(`${invoice.number}: nav summas`);
      continue;
    }
    const payee = payeeName(invoice);
    const reference = sepaText(invoice.number, 140) || "Rekins";
    payments.push({
      id: invoice.id,
      name: sepaText(payee, 70) || "Sanemejs",
      iban,
      bic: bicFromIban(iban),
      amount: roundMoney(invoice.gross),
      reference,
      number: invoice.number,
      supplier: payee,
    });
  }

  if (payments.length === 0) {
    return {
      ok: false,
      message: "Neviens neapmaksātais rēķins nav gatavs eksportam. Norādi IBAN pie klienta.",
    };
  }

  const createdAt = input.createdAt ?? new Date();
  const format = input.format ?? "pain001";
  if (format === "fidavista") {
    return {
      ok: true,
      xml: buildFidavista({
        debtorName: input.debtorName.trim().slice(0, 70),
        debtorIban,
        debtorLegalId: input.debtorLegalId ?? "",
        executionDate: input.executionDate,
        payments,
        createdAt,
      }),
      filename: `maksajumi-fidavista-${input.executionDate}.xml`,
      skipped,
    };
  }
  return {
    ok: true,
    xml: buildPain001({
      debtorName,
      debtorIban,
      debtorBic: bicFromIban(debtorIban),
      executionDate: input.executionDate,
      payments,
      createdAt,
    }),
    filename: `maksajumi-pain.001.001.09-${input.executionDate}.xml`,
    skipped,
  };
}

export function creditorIban(invoice: PayableInvoice, debtorIban: string) {
  const client = normalizeIban(invoice.clientIban ?? "");
  if (isValidIban(client) && client !== debtorIban) return client;
  return "";
}

function payeeName(invoice: PayableInvoice) {
  return invoice.clientName?.trim() || invoice.supplier.trim();
}

function buildPain001(input: {
  debtorName: string;
  debtorIban: string;
  debtorBic: string;
  executionDate: string;
  payments: Payment[];
  createdAt: Date;
}) {
  const stamp = stampOf(input.createdAt);
  const messageId = `PAY${stamp}`.slice(0, 35);
  const paymentId = `PMT${stamp}`.slice(0, 35);
  const count = input.payments.length;
  const control = money(input.payments.reduce((sum, payment) => sum + payment.amount, 0));
  const created = input.createdAt.toISOString().replace(/\.\d{3}Z$/, "");
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.09">',
    "  <CstmrCdtTrfInitn>",
    "    <GrpHdr>",
    `      <MsgId>${xml(messageId)}</MsgId>`,
    `      <CreDtTm>${xml(created)}</CreDtTm>`,
    `      <NbOfTxs>${count}</NbOfTxs>`,
    `      <CtrlSum>${control}</CtrlSum>`,
    `      <InitgPty><Nm>${xml(input.debtorName)}</Nm></InitgPty>`,
    "    </GrpHdr>",
    "    <PmtInf>",
    `      <PmtInfId>${xml(paymentId)}</PmtInfId>`,
    "      <PmtMtd>TRF</PmtMtd>",
    "      <BtchBookg>false</BtchBookg>",
    `      <NbOfTxs>${count}</NbOfTxs>`,
    `      <CtrlSum>${control}</CtrlSum>`,
    "      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl></PmtTpInf>",
    "      <ReqdExctnDt>",
    `        <Dt>${xml(input.executionDate)}</Dt>`,
    "      </ReqdExctnDt>",
    `      <Dbtr><Nm>${xml(input.debtorName)}</Nm></Dbtr>`,
    `      <DbtrAcct><Id><IBAN>${xml(input.debtorIban)}</IBAN></Id></DbtrAcct>`,
    `      ${agent("DbtrAgt", input.debtorBic)}`,
    "      <ChrgBr>SLEV</ChrgBr>",
  ];

  for (const payment of input.payments) {
    const endToEnd = `E2E${payment.id.replace(/-/g, "")}`.slice(0, 35);
    lines.push("      <CdtTrfTxInf>");
    lines.push(`        <PmtId><EndToEndId>${xml(endToEnd)}</EndToEndId></PmtId>`);
    lines.push(`        <Amt><InstdAmt Ccy="EUR">${money(payment.amount)}</InstdAmt></Amt>`);
    if (payment.bic) lines.push(`        ${agent("CdtrAgt", payment.bic)}`);
    lines.push(`        <Cdtr><Nm>${xml(payment.name)}</Nm></Cdtr>`);
    lines.push(`        <CdtrAcct><Id><IBAN>${xml(payment.iban)}</IBAN></Id></CdtrAcct>`);
    lines.push(`        <RmtInf><Ustrd>${xml(payment.reference)}</Ustrd></RmtInf>`);
    lines.push("      </CdtTrfTxInf>");
  }

  lines.push("    </PmtInf>", "  </CstmrCdtTrfInitn>", "</Document>", "");
  return lines.join("\n");
}

function agent(tag: "DbtrAgt" | "CdtrAgt", bic: string) {
  if (bic.length === 8 || bic.length === 11) {
    return `<${tag}><FinInstnId><BICFI>${xml(bic)}</BICFI></FinInstnId></${tag}>`;
  }
  return `<${tag}><FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId></${tag}>`;
}

function stampOf(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function money(value: number) {
  return roundMoney(value).toFixed(2);
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function xml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function sepaText(value: string, maxLength: number) {
  const replaced = value
    .replaceAll("ā", "a")
    .replaceAll("č", "c")
    .replaceAll("ē", "e")
    .replaceAll("ģ", "g")
    .replaceAll("ī", "i")
    .replaceAll("ķ", "k")
    .replaceAll("ļ", "l")
    .replaceAll("ņ", "n")
    .replaceAll("š", "s")
    .replaceAll("ū", "u")
    .replaceAll("ž", "z")
    .replaceAll("Ā", "A")
    .replaceAll("Č", "C")
    .replaceAll("Ē", "E")
    .replaceAll("Ģ", "G")
    .replaceAll("Ī", "I")
    .replaceAll("Ķ", "K")
    .replaceAll("Ļ", "L")
    .replaceAll("Ņ", "N")
    .replaceAll("Š", "S")
    .replaceAll("Ū", "U")
    .replaceAll("Ž", "Z")
    .replaceAll("ä", "a")
    .replaceAll("ö", "o")
    .replaceAll("ü", "u")
    .replaceAll("Ä", "A")
    .replaceAll("Ö", "O")
    .replaceAll("Ü", "U")
    .replaceAll("ß", "ss");
  return replaced.replace(/[^a-zA-Z0-9/ ?:().,'+-]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}
