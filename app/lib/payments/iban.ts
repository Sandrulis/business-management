const LATVIAN_BANKS: Record<string, { name: string; bic: string }> = {
  HABA: { name: "Swedbank AS", bic: "HABALV22" },
  UNLA: { name: "SEB banka", bic: "UNLALV2X" },
  RIKO: { name: "Luminor Bank AS", bic: "RIKOLV2X" },
  NDEA: { name: "Luminor Bank AS", bic: "NDEALV2X" },
  PARX: { name: "Citadele banka", bic: "PARXLV22" },
  REGL: { name: "Reģionālā investīciju banka", bic: "REGLV22" },
  RTMB: { name: "Rietumu banka", bic: "RTMBLV22" },
  MTRB: { name: "Meridian Trade Bank", bic: "MTRBLV22" },
  IDXO: { name: "INDEXO Banka AS", bic: "IDXOLV22" },
  CBBR: { name: "BluOr Bank AS", bic: "CBBRLV22" },
  MULT: { name: "Industra Bank AS", bic: "MULTLV2X" },
  LAPB: { name: "LPB Bank", bic: "LAPBLV2X" },
  LATB: { name: "Latvijas Banka", bic: "LATBLV22" },
};

export function normalizeIban(value: string) {
  return value.replace(/[\s-]+/g, "").toUpperCase();
}

export function isValidIban(value: string) {
  const iban = normalizeIban(value);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban) || iban.length > 34) return false;
  const rearranged = `${iban.slice(4)}${iban.slice(0, 4)}`;
  let rest = 0;
  for (const char of rearranged) {
    const chunk = char >= "A" && char <= "Z" ? String(char.charCodeAt(0) - 55) : char;
    for (const digit of chunk) rest = (rest * 10 + Number(digit)) % 97;
  }
  return rest === 1;
}

export function findIbans(raw: string) {
  const text = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const found: string[] = [];
  for (let index = 0; index < text.length - 14; index += 1) {
    if (!/^[A-Z]{2}\d{2}$/.test(text.slice(index, index + 4))) continue;
    const max = Math.min(34, text.length - index);
    for (let length = max; length >= 15; length -= 1) {
      const candidate = text.slice(index, index + length);
      if (!isValidIban(candidate)) continue;
      if (!found.includes(candidate)) found.push(candidate);
      index += length - 1;
      break;
    }
  }
  return found;
}

export function bankFromIban(iban: string) {
  const normalized = normalizeIban(iban);
  if (!/^LV\d{2}[A-Z]{4}\d{13}$/.test(normalized)) return null;
  return LATVIAN_BANKS[normalized.slice(4, 8)] ?? null;
}

export function bicFromIban(iban: string) {
  return bankFromIban(iban)?.bic ?? "";
}
