import { findIbans } from "@/app/lib/payments/iban";

export type InvoiceRead = {
  number: string | null;
  issuedOn: string | null;
  dueOn: string | null;
  net: number | null;
  gross: number | null;
  grossFromVat: boolean;
  iban: string | null;
};

const EMPTY: InvoiceRead = {
  number: null,
  issuedOn: null,
  dueOn: null,
  net: null,
  gross: null,
  grossFromVat: false,
  iban: null,
};

const MONTHS: Record<string, number> = {
  janvari: 1,
  janvaris: 1,
  februari: 2,
  februaris: 2,
  marta: 3,
  marts: 3,
  aprili: 4,
  aprilis: 4,
  maija: 5,
  maijs: 5,
  junija: 6,
  junijs: 6,
  julija: 7,
  julijs: 7,
  augusta: 8,
  augusts: 8,
  septembri: 9,
  septembris: 9,
  oktobri: 10,
  oktobris: 10,
  novembri: 11,
  novembris: 11,
  decembri: 12,
  decembris: 12,
};

const MONTH_PATTERN = Object.keys(MONTHS).join("|");
const AMOUNT_PATTERN =
  /(?<!\d)(\d{1,3}(?:[ \u00a0]\d{3})+(?:[.,]\d{2})|\d{1,3}(?:\.\d{3})+(?:,\d{2})|\d+[.,]\d{2})(?!\d)/g;

export function parseInvoiceText(raw: string): InvoiceRead {
  const folded = fold(raw);
  if (!folded.trim()) return EMPTY;

  const lines = folded.split(/\n+/);
  const originalLines = raw.split(/\n+/);
  const looksLikeInvoice = /rekin[as]|invoice/.test(folded);
  const mentionsVat = /\bpvn\b|\bvat\b/.test(folded);

  const dueOn = dateNear(lines, /apmaksas\s+termins|apmaksat\s+lidz|samaksas\s+termins|payment\s+due|due\s+date/);
  let issuedOn = dateNear(lines, /rekina\s+datums|izrakstisanas\s+datums|invoice\s+date|^datums\b/);
  if (!issuedOn && looksLikeInvoice) {
    const head = lines.slice(0, 18);
    issuedOn = firstLongDate(head.join("\n")) ?? firstNumericDate(head.join("\n"), dueOn);
  }

  const number = looksLikeInvoice ? numberNear(lines, originalLines) : null;
  const labeledNet = amountNear(lines, /bez\s+pvn|summa\s+bez|kopa\s+bez|\bneto\b|subtotal|net\s+amount/);
  const labeledGross = amountNear(lines, /ar\s+pvn|kopa\s+apmaksai|pavisam\s+kopa|summa\s+apmaksai|kopsumma|grand\s+total|amount\s+due|total\s+due/);
  const total = amountNear(lines, /summa\s+kopa/) ?? looseTotal(lines);

  let net = labeledNet;
  let gross = labeledGross;
  let grossFromVat = false;

  if (net == null && gross == null && total != null && looksLikeInvoice) {
    if (!mentionsVat) {
      net = total;
      gross = total;
    } else {
      gross = total;
      net = netFromGross(total);
    }
  }

  if (net != null && gross == null && total != null && total > net + 0.009) gross = total;
  if (net != null && gross == null && total != null && !mentionsVat && Math.abs(total - net) < 0.02) gross = total;
  if (net != null && gross == null && mentionsVat) {
    gross = vatGross(net);
    grossFromVat = true;
  }
  if (gross != null && net == null && mentionsVat) net = netFromGross(gross);
  if (gross != null && net == null && !mentionsVat) net = gross;

  const iban = findIbans(raw)[0] ?? null;

  if (net != null && gross != null && gross + 0.009 < net) return { ...EMPTY, number, issuedOn, dueOn, iban };

  return { number, issuedOn, dueOn, net, gross, grossFromVat, iban };
}

function numberNear(lines: string[], originalLines: string[]) {
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/(?:rekin[as]|invoice)\s+(?:nr|no|numurs|number)\.?\s*[:.]?\s*(.*)$/i);
    if (!match || match.index == null) continue;
    const restAt = match.index + match[0].length - (match[1]?.length ?? 0);
    const sameLine = cleanNumber((originalLines[index] ?? "").slice(restAt));
    if (sameLine) return sameLine;
    const nextLine = cleanNumber(originalLines[index + 1] ?? "");
    if (nextLine) return nextLine;
  }
  return null;
}

function cleanNumber(raw: string) {
  const chunk = raw.split(/\s{2,}/)[0] ?? raw;
  const value = chunk
    .replace(/\s*([/.-])\s*/g, "$1")
    .replace(/\s+/g, "")
    .replace(/[.,;:]+$/g, "")
    .trim();
  if (!/^[a-z0-9][a-z0-9/.-]{1,39}$/i.test(value)) return null;
  if (!/\d/.test(value)) return null;
  if (toIso(value)) return null;
  if (/^\d{6}-?\d{5}$/.test(value) || /^\d{11}$/.test(value)) return null;
  return value;
}

function dateNear(lines: string[], label: RegExp) {
  for (let index = 0; index < lines.length; index += 1) {
    if (!label.test(lines[index])) continue;
    return firstDate(lines[index]) ?? firstDate(lines[index + 1] ?? "");
  }
  return null;
}

function firstDate(text: string) {
  return firstLongDate(text) ?? firstNumericDate(text, null);
}

function firstLongDate(text: string) {
  const match = text.match(
    new RegExp(String.raw`(\d{4})\.\s*gada\s+(\d{1,2})\.\s*(${MONTH_PATTERN})\b`, "i"),
  );
  if (!match) return null;
  return isoDate(Number(match[1]), MONTHS[match[3].toLowerCase()] ?? 0, Number(match[2]));
}

function firstNumericDate(text: string, skip: string | null) {
  const matches = text.matchAll(/(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)|(?<!\d)(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?!\d)/g);
  for (const match of matches) {
    const iso = match[1]
      ? isoDate(Number(match[1]), Number(match[2]), Number(match[3]))
      : isoDate(Number(match[6]), Number(match[5]), Number(match[4]));
    if (iso && iso !== skip) return iso;
  }
  return null;
}

function amountNear(lines: string[], label: RegExp) {
  let found: number | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    if (!label.test(lines[index])) continue;
    const amount = lastAmount(lines[index]) ?? lastAmount(lines[index + 1] ?? "");
    if (amount != null) found = amount;
  }
  return found;
}

function looseTotal(lines: string[]) {
  let found: number | null = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!/^(kopa|pavisam|total)\b/.test(trimmed) || /bez\s+pvn/.test(trimmed)) continue;
    const amount = lastAmount(trimmed);
    if (amount != null) found = amount;
  }
  return found;
}

function lastAmount(text: string) {
  let found: number | null = null;
  for (const match of text.matchAll(AMOUNT_PATTERN)) {
    const amount = parseMoney(match[1]);
    if (amount != null && amount > 0) found = amount;
  }
  return found;
}

function parseMoney(token: string) {
  const compact = token.replace(/[\s\u00a0]/g, "");
  let normalized = compact;
  if (compact.includes(",") && compact.includes(".")) {
    normalized =
      compact.lastIndexOf(",") > compact.lastIndexOf(".")
        ? compact.replace(/\./g, "").replace(",", ".")
        : compact.replace(/,/g, "");
  } else if (compact.includes(",")) {
    normalized = compact.replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(compact)) {
    normalized = compact.replace(/\./g, "");
  }
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0 || value > 10_000_000) return null;
  return Math.round(value * 100) / 100;
}

function vatGross(net: number) {
  return Math.round((net + Number.EPSILON) * 121) / 100;
}

function netFromGross(gross: number) {
  const net = Math.round((gross / 1.21) * 100) / 100;
  if (Math.abs(vatGross(net) - gross) > 0.02) return null;
  return net;
}

function isoDate(year: number, month: number, day: number) {
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function toIso(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? value.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!match) return null;
  if (value.includes("-") && value.indexOf("-") === 4) return isoDate(Number(match[1]), Number(match[2]), Number(match[3]));
  return isoDate(Number(match[3]), Number(match[2]), Number(match[1]));
}

function fold(value: string) {
  return value
    .toLowerCase()
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
    .replaceAll("ž", "z");
}
