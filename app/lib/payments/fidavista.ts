import { bankFromIban } from "./iban";

const NS = "http://ivis.eps.gov.lv/XMLSchemas/100017/fidavista/v1-2";

type Payment = {
  name: string;
  iban: string;
  amount: number;
  number: string;
  supplier: string;
};

export function buildFidavista(input: {
  debtorName: string;
  debtorIban: string;
  debtorLegalId: string;
  executionDate: string;
  payments: Payment[];
  createdAt: Date;
}) {
  const legalId = swiftText(input.debtorLegalId, 35);
  const usedDocNos = new Set<string>();
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<FIDAVISTA xmlns="${NS}">`,
    "  <Header>",
    `    <Timestamp>${timestampOf(input.createdAt)}</Timestamp>`,
    `    <From>${xml(input.debtorName.slice(0, 70))}</From>`,
    "  </Header>",
  ];

  input.payments.forEach((payment, index) => {
    const info = eksText(`Rēķins ${payment.number}`, 140);
    const bank = bankFromIban(payment.iban);
    const bankName = bank ? eksText(bank.name, 35) : "";
    lines.push("  <Payment>");
    lines.push(`    <ExtId>${index + 1}</ExtId>`);
    lines.push(`    <DocNo>${xml(docNo(payment.number, index, usedDocNos))}</DocNo>`);
    lines.push(`    <RegDate>${xml(input.executionDate)}</RegDate>`);
    lines.push("    <TaxPmtFlg>N</TaxPmtFlg>");
    lines.push("    <Ccy>EUR</Ccy>");
    if (info) lines.push(`    <PmtInfo>${xml(info)}</PmtInfo>`);
    if (legalId) lines.push(`    <PayLegalId>${xml(legalId)}</PayLegalId>`);
    lines.push(`    <PayAccNo>${xml(input.debtorIban)}</PayAccNo>`);
    lines.push("    <DebitCcy>EUR</DebitCcy>");
    lines.push("    <BenSet>");
    lines.push("      <Priority>N</Priority>");
    lines.push("      <Comm>SHA</Comm>");
    lines.push(`      <Amt>${payment.amount.toFixed(2)}</Amt>`);
    lines.push(`      <BenAccNo>${xml(payment.iban)}</BenAccNo>`);
    lines.push("      <BenAccIbanFlg>Y</BenAccIbanFlg>");
    lines.push(`      <BenName>${xml(eksText(payment.supplier, 105) || "Saņēmējs")}</BenName>`);
    lines.push(`      <BenCountry>${xml(payment.iban.slice(0, 2))}</BenCountry>`);
    if (bankName) lines.push(`      <BBName>${xml(bankName)}</BBName>`);
    if (bank?.bic) lines.push(`      <BBSwift>${xml(bank.bic)}</BBSwift>`);
    lines.push("    </BenSet>");
    lines.push("  </Payment>");
  });

  lines.push("</FIDAVISTA>", "");
  return lines.join("\n");
}

function docNo(number: string, index: number, used: Set<string>) {
  const clean = swiftText(number, 40);
  const compact = clean.replace(/[^0-9A-Za-z]/g, "");
  let candidate = clean.length > 0 && clean.length <= 10 ? clean : compact.slice(-10);
  if (!candidate) candidate = String(index + 1);
  let value = candidate.slice(0, 10);
  let extra = 2;
  while (used.has(value)) {
    const suffix = String(extra);
    value = `${candidate.slice(0, Math.max(1, 10 - suffix.length))}${suffix}`.slice(0, 10);
    extra += 1;
  }
  used.add(value);
  return value;
}

function timestampOf(date: Date) {
  const pad = (value: number, length = 2) => String(value).padStart(length, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}${pad(date.getMilliseconds(), 3)}`;
}

function xml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function eksText(value: string, maxLength: number) {
  return value
    .replace(/[^\dA-Za-zĀ-ž\s/?:().,'+-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function swiftText(value: string, maxLength: number) {
  return value
    .replace(/[^0-9A-Za-z\s/?:().,'+-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}
