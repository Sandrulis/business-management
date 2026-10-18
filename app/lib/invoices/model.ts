export type Site = {
  id: string;
  address: string;
  customer: string;
  iban: string;
  bankName: string;
  email: string;
  phone: string;
  note: string;
};

export type Invoice = {
  id: string;
  number: string;
  supplier: string;
  supplierIban: string;
  client: string;
  objectId: string | null;
  objectName: string;
  categoryId: string;
  categoryName: string;
  net: number;
  gross: number;
  issuedOn: string;
  dueOn: string;
  paid: boolean;
  fromEmail: string;
  subject: string;
  bodyText: string;
  fileName: string | null;
  fileMime: string;
  fileSize: number | null;
  storagePath: string | null;
};

export type InboxItem = {
  id: string;
  source: "email" | "upload";
  fromEmail: string;
  subject: string;
  fileName: string | null;
  fileMime: string;
  fileSize: number | null;
  receivedOn: string;
  supplier: string;
  number: string;
  net: number | null;
  gross: number | null;
  dueOn: string | null;
  messageId: string | null;
  bodyText: string;
  storagePath: string | null;
};

export type MonthKey = {
  year: number;
  month: number;
};

const MONTHS = [
  "Janvāris",
  "Februāris",
  "Marts",
  "Aprīlis",
  "Maijs",
  "Jūnijs",
  "Jūlijs",
  "Augusts",
  "Septembris",
  "Oktobris",
  "Novembris",
  "Decembris",
];

const MONTHS_GENITIVE = [
  "janvāra",
  "februāra",
  "marta",
  "aprīļa",
  "maija",
  "jūnija",
  "jūlija",
  "augusta",
  "septembra",
  "oktobra",
  "novembra",
  "decembra",
];

export function monthOf(isoDate: string): MonthKey {
  const [year, month] = isoDate.split("-").map(Number);
  return { year, month };
}

export function sameMonth(a: MonthKey, b: MonthKey) {
  return a.year === b.year && a.month === b.month;
}

export function shiftMonth(key: MonthKey, delta: number): MonthKey {
  const date = new Date(key.year, key.month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export function monthTitle(key: MonthKey) {
  return `${MONTHS[key.month - 1]} ${key.year}`;
}

export function monthGenitive(key: MonthKey) {
  return `${MONTHS_GENITIVE[key.month - 1]} rēķini`;
}

export function inMonth(isoDate: string, key: MonthKey) {
  return sameMonth(monthOf(isoDate), key);
}

export function formatMoney(value: number) {
  const sign = value < 0 ? "-" : "";
  const [whole, fraction] = Math.abs(value).toFixed(2).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${grouped},${fraction} €`;
}

export function formatDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-");
  return `${day}.${month}.${year}`;
}

export function vatGross(net: number) {
  return Math.round((net + Number.EPSILON) * 121) / 100;
}

export function addDays(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day + days);
  return toIso(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function isOverdue(dueOn: string, today: string, paid: boolean) {
  return !paid && dueOn < today;
}

export function duePhrase(dueOn: string, today: string) {
  const days = Math.round((utcDay(dueOn) - utcDay(today)) / 86_400_000);
  if (days === 0) return { text: "Šodien", overdue: false };
  const count = Math.abs(days);
  const one = count % 10 === 1 && count % 100 !== 11;
  if (days > 0) return { text: `pēc ${count} ${one ? "dienas" : "dienām"}`, overdue: false };
  return { text: `kavē ${count} ${one ? "dienu" : "dienas"}`, overdue: true };
}

function utcDay(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export function todayIso(date: Date) {
  return toIso(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function toIso(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function issuedOn(today: string, key: MonthKey, day: number) {
  const last = new Date(key.year, key.month, 0).getDate();
  const current = monthOf(today);
  const cap =
    sameMonth(key, current) ? Math.min(last, Number(today.slice(8))) : last;
  return toIso(key.year, key.month, Math.min(Math.max(day, 1), cap));
}

export function buildInvoices(today: string): Invoice[] {
  const current = monthOf(today);
  const previous = shiftMonth(current, -1);
  const next = shiftMonth(current, 1);

  const rows = [
    {
      id: "inv-depo-44102",
      number: "DEP-44102",
      supplier: "Depo DIY",
      client: "SIA Nordhaus",
      objectName: "Birojs, Brīvības iela 45",
      objectId: null,
      categoryId: "",
      categoryName: "Materiāli",
      net: 1284.3,
      gross: vatGross(1284.3),
      issuedOn: issuedOn(today, current, 3),
      dueOn: addDays(today, 12),
      paid: false,
    },
    {
      id: "inv-celt-9088",
      number: "CS-9088",
      supplier: "SIA Celtniecības serviss",
      client: "Baltic Wood, AS",
      objectName: "Ražotne, Jelgava",
      objectId: null,
      categoryId: "",
      categoryName: "Apakšuzņēmējs",
      net: 6400,
      gross: vatGross(6400),
      issuedOn: issuedOn(today, current, 6),
      dueOn: addDays(today, 18),
      paid: false,
    },
    {
      id: "inv-circlek-22014",
      number: "CK-22014",
      supplier: "Circle K",
      client: "SIA Nordhaus",
      objectName: "Noliktava, Mārupe",
      objectId: null,
      categoryId: "",
      categoryName: "Transports",
      net: 214.88,
      gross: vatGross(214.88),
      issuedOn: issuedOn(today, current, 2),
      dueOn: addDays(today, -6),
      paid: false,
    },
    {
      id: "inv-ram-331",
      number: "RAM-331",
      supplier: "Ramirent",
      client: "Rīgas Namu Serviss",
      objectName: "Fasāde, Miera iela 12",
      objectId: null,
      categoryId: "",
      categoryName: "Noma",
      net: 860,
      gross: vatGross(860),
      issuedOn: issuedOn(today, current, 9),
      dueOn: addDays(today, 20),
      paid: true,
    },
    {
      id: "inv-el-55291",
      number: "EL-55291",
      supplier: "Latvenergo",
      client: "SIA Nordhaus",
      objectName: "Birojs, Brīvības iela 45",
      objectId: null,
      categoryId: "",
      categoryName: "Komunālie",
      net: 406.2,
      gross: vatGross(406.2),
      issuedOn: issuedOn(today, current, 11),
      dueOn: addDays(today, 8),
      paid: false,
    },
    {
      id: "inv-hlt-1002",
      number: "HLT-1002",
      supplier: "Hilti",
      client: "Baltic Wood, AS",
      objectName: "Ražotne, Jelgava",
      objectId: null,
      categoryId: "",
      categoryName: "Instrumenti",
      net: 1540,
      gross: vatGross(1540),
      issuedOn: issuedOn(today, current, 1),
      dueOn: addDays(today, 25),
      paid: true,
    },
    {
      id: "inv-depo-43990",
      number: "DEP-43990",
      supplier: "Depo DIY",
      client: "Rīgas Namu Serviss",
      objectName: "Kāpņu telpa, Tallinas iela 8",
      objectId: null,
      categoryId: "",
      categoryName: "Materiāli",
      net: 980.4,
      gross: vatGross(980.4),
      issuedOn: issuedOn(today, previous, 18),
      dueOn: issuedOn(today, previous, 28),
      paid: false,
    },
    {
      id: "inv-tr-118",
      number: "TR-118",
      supplier: "SIA Transports",
      client: "SIA Nordhaus",
      objectName: "Birojs, Brīvības iela 45",
      objectId: null,
      categoryId: "",
      categoryName: "Transports",
      net: 320,
      gross: vatGross(320),
      issuedOn: issuedOn(today, next, 4),
      dueOn: addDays(issuedOn(today, next, 4), 14),
      paid: false,
    },
  ];
  return rows.map((row) => ({
    ...row,
    supplierIban: "",
    fromEmail: "",
    subject: "",
    bodyText: "",
    fileName: null,
    fileMime: "",
    fileSize: null,
    storagePath: null,
  }));
}

export function buildInbox(today: string): InboxItem[] {
  return [
    {
      id: "mail-depo-44821",
      source: "email",
      fileName: null,
      fileMime: "",
      fileSize: null,
      fromEmail: "rekini@depo.lv",
      subject: "Rēķins DEP-44821",
      receivedOn: addDays(today, -1),
      supplier: "Depo DIY",
      number: "DEP-44821",
      net: 1560.5,
      gross: vatGross(1560.5),
      dueOn: addDays(today, 16),
      messageId: null,
      bodyText: "",
      storagePath: null,
    },
    {
      id: "mail-hilti-883920",
      source: "email",
      fileName: null,
      fileMime: "",
      fileSize: null,
      fromEmail: "billing@hilti.com",
      subject: "Invoice 883920",
      receivedOn: today,
      supplier: "Hilti",
      number: "883920",
      net: 742,
      gross: vatGross(742),
      dueOn: addDays(today, 30),
      messageId: null,
      bodyText: "",
      storagePath: null,
    },
    {
      id: "mail-abc-77",
      source: "email",
      fileName: null,
      fileMime: "",
      fileSize: null,
      fromEmail: "gramatvediba@abcmetals.lv",
      subject: "Pavadzīme ABC-77",
      receivedOn: addDays(today, -2),
      supplier: "ABC Metāls",
      number: "ABC-77",
      net: null,
      gross: null,
      dueOn: null,
      messageId: null,
      bodyText: "",
      storagePath: null,
    },
  ];
}
