import { formatUnitPrice, latestEntry, type PricePosition } from "@/app/lib/prices/model";

export type OfferMaterial = {
  id: string;
  catalogId: string;
  name: string;
  unit: string;
  unitPrice: string;
  consumption: string;
  acknowledgedPriceId: string;
};

export type OfferPosition = {
  id: string;
  kind: "position";
  name: string;
  unit: string;
  quantity: string;
  timeNorm: string;
  rate: string;
  materialPrice: string;
  materialPositionId: string;
  materials: OfferMaterial[];
  mechanismPrice: string;
  mechanismPositionId: string;
  mechanismRate: string;
  acknowledgedMechanismPriceId: string;
};

export type OfferExtra = {
  id: string;
  profitPercent: string;
  profitHidden: boolean;
  fixedAt: string;
  groups: OfferGroup[];
};

export type OfferDocument = {
  profitPercent: string;
  profitHidden: boolean;
  fixedAt: string;
  groups: OfferGroup[];
  extras: OfferExtra[];
};

export type OfferGroup = {
  id: string;
  kind: "category" | "subcategory";
  name: string;
  children: OfferNode[];
};

export function offerCategories(document: OfferDocument) {
  return document.groups
    .filter((group) => group.kind === "category")
    .map((group) => ({ id: group.id, name: group.name.trim() || "Bez nosaukuma" }));
}

export type OfferNode = OfferGroup | OfferPosition;

export type OfferPrices = {
  laborUnit: number;
  materialUnit: number;
  mechanismUnit: number;
  unitTotal: number;
  laborVolume: number;
  materialVolume: number;
  mechanismVolume: number;
  volumeTotal: number;
};

export function emptyOfferDocument(): OfferDocument {
  return { profitPercent: "", profitHidden: false, fixedAt: "", groups: [], extras: [] };
}

export function emptyOfferExtra(profit?: { profitPercent: string; profitHidden: boolean }): OfferExtra {
  return {
    id: crypto.randomUUID(),
    profitPercent: profit?.profitPercent ?? "",
    profitHidden: profit?.profitHidden ?? false,
    fixedAt: "",
    groups: [],
  };
}

export function copyOfferDocument(document: OfferDocument): OfferDocument {
  const source = sanitizeOfferDocument(document);
  return {
    profitPercent: source.profitPercent,
    profitHidden: source.profitHidden,
    fixedAt: "",
    groups: source.groups.map(copyGroup),
    extras: [],
  };
}

export function copyOfferExtra(extra: OfferExtra): OfferExtra {
  const source = sanitizeOfferDocument(extra);
  return {
    id: crypto.randomUUID(),
    profitPercent: source.profitPercent,
    profitHidden: source.profitHidden,
    fixedAt: "",
    groups: source.groups.map(copyGroup),
  };
}

function copyGroup(group: OfferGroup): OfferGroup {
  return { ...group, id: crypto.randomUUID(), children: group.children.map(copyNode) };
}

function copyNode(node: OfferNode): OfferNode {
  if (node.kind !== "position") return copyGroup(node);
  return {
    ...node,
    id: crypto.randomUUID(),
    materials: node.materials.map((line) => ({ ...line, id: crypto.randomUUID() })),
  };
}

export function emptyPosition(rate = ""): OfferPosition {
  return {
    id: crypto.randomUUID(),
    kind: "position",
    name: "",
    unit: "",
    quantity: "",
    timeNorm: "",
    rate,
    materialPrice: "",
    materialPositionId: "",
    materials: [],
    mechanismPrice: "",
    mechanismPositionId: "",
    mechanismRate: "",
    acknowledgedMechanismPriceId: "",
  };
}

export function emptyGroup(kind: OfferGroup["kind"]): OfferGroup {
  return { id: crypto.randomUUID(), kind, name: "", children: [] };
}

export function moveOfferNode(groups: OfferGroup[], id: string, parentId: string | null, index: number): OfferGroup[] {
  const from = locateOfferNode(groups, id);
  if (!from) return groups;
  if (parentId !== null && containsOfferNode(from.node, parentId)) return groups;
  let target = index;
  if (from.parentId === parentId && from.index < target) target -= 1;
  target = Math.max(0, target);
  if (from.parentId === parentId && from.index === target) return groups;
  return insertOfferNode(removeOfferNode(groups, id), from.node, parentId, target);
}

function locateOfferNode(nodes: OfferNode[], id: string, parentId: string | null = null): { node: OfferNode; parentId: string | null; index: number } | null {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (node.id === id) return { node, parentId, index };
    if (node.kind !== "position") {
      const nested = locateOfferNode(node.children, id, node.id);
      if (nested) return nested;
    }
  }
  return null;
}

function containsOfferNode(node: OfferNode, id: string): boolean {
  if (node.kind === "position") return false;
  return node.children.some((child) => child.id === id || containsOfferNode(child, id));
}

function removeOfferNode(nodes: OfferNode[], id: string): OfferGroup[] {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) => (node.kind === "position" ? node : { ...node, children: removeOfferNode(node.children, id) })) as OfferGroup[];
}

function insertOfferNode(nodes: OfferNode[], node: OfferNode, parentId: string | null, index: number): OfferGroup[] {
  if (parentId === null) {
    const next = [...nodes];
    next.splice(Math.min(index, next.length), 0, node);
    return next as OfferGroup[];
  }
  return nodes.map((item) => {
    if (item.kind === "position") return item;
    if (item.id === parentId) {
      const children = [...item.children];
      children.splice(Math.min(index, children.length), 0, node);
      return { ...item, children };
    }
    return { ...item, children: insertOfferNode(item.children, node, parentId, index) };
  }) as OfferGroup[];
}

export function parseAmount(raw: string) {
  const normalized = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (normalized === "" || normalized === "." || normalized === "-") return 0;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : 0;
}

export function hasAmount(raw: string) {
  return raw.trim() !== "";
}

function roundMoney(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function profitFactor(percent: string, hidden: boolean) {
  if (hidden) return 1;
  const value = parseAmount(percent);
  if (value <= 0) return 1;
  return 1 + value / 100;
}

export function unitsMatch(left: string, right: string) {
  return normalizeUnit(left) !== "" && normalizeUnit(left) === normalizeUnit(right);
}

export function positionPrices(position: OfferPosition, factor = 1): OfferPrices {
  const quantity = parseAmount(position.quantity);
  const laborUnit = roundMoney(parseAmount(position.timeNorm) * parseAmount(position.rate) * factor);
  const materialUnit = roundMoney(materialBase(position) * factor);
  const mechanismUnit = roundMoney(mechanismBase(position) * factor);
  const unitTotal = roundMoney(laborUnit + materialUnit + mechanismUnit);
  return {
    laborUnit,
    materialUnit,
    mechanismUnit,
    unitTotal,
    laborVolume: roundMoney(laborUnit * quantity),
    materialVolume: roundMoney(materialUnit * quantity),
    mechanismVolume: roundMoney(mechanismUnit * quantity),
    volumeTotal: roundMoney(unitTotal * quantity),
  };
}

export function sumPrices(nodes: OfferNode[], factor = 1): OfferPrices {
  return nodes.reduce(
    (total, node) => {
      const prices = node.kind === "position" ? positionPrices(node, factor) : sumPrices(node.children, factor);
      return {
        laborUnit: roundMoney(total.laborUnit + prices.laborUnit),
        materialUnit: roundMoney(total.materialUnit + prices.materialUnit),
        mechanismUnit: roundMoney(total.mechanismUnit + prices.mechanismUnit),
        unitTotal: roundMoney(total.unitTotal + prices.unitTotal),
        laborVolume: roundMoney(total.laborVolume + prices.laborVolume),
        materialVolume: roundMoney(total.materialVolume + prices.materialVolume),
        mechanismVolume: roundMoney(total.mechanismVolume + prices.mechanismVolume),
        volumeTotal: roundMoney(total.volumeTotal + prices.volumeTotal),
      };
    },
    emptyPrices(),
  );
}

function emptyPrices(): OfferPrices {
  return {
    laborUnit: 0,
    materialUnit: 0,
    mechanismUnit: 0,
    unitTotal: 0,
    laborVolume: 0,
    materialVolume: 0,
    mechanismVolume: 0,
    volumeTotal: 0,
  };
}

export function sanitizeOfferDocument(value: unknown): OfferDocument {
  if (Array.isArray(value)) return { profitPercent: "", profitHidden: false, fixedAt: "", groups: sanitizeOffer(value), extras: [] };
  if (!value || typeof value !== "object") return emptyOfferDocument();
  const row = value as { profitPercent?: unknown; profitHidden?: unknown; fixedAt?: unknown; groups?: unknown; extras?: unknown; id?: unknown };
  return {
    profitPercent: typeof row.profitPercent === "string" ? row.profitPercent : "",
    profitHidden: row.profitHidden === true,
    fixedAt: fixedStamp(row.fixedAt),
    groups: sanitizeOffer(row.groups),
    extras: sanitizeExtras(row.extras),
  };
}

function sanitizeExtras(value: unknown): OfferExtra[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as { id?: unknown; extras?: unknown };
    if (typeof row.id !== "string" || row.id.trim() === "") return [];
    const body = sanitizeOfferDocument({ ...row, extras: [] });
    return [{ id: row.id, profitPercent: body.profitPercent, profitHidden: body.profitHidden, fixedAt: body.fixedAt, groups: body.groups }];
  });
}

function fixedStamp(value: unknown) {
  if (typeof value !== "string" || value.trim() === "") return "";
  const time = Date.parse(value);
  return Number.isNaN(time) ? "" : new Date(time).toISOString();
}

export function sanitizeOffer(value: unknown): OfferGroup[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((node) => {
    const group = sanitizeGroup(node, "category");
    return group ? [group] : [];
  });
}

function sanitizeGroup(value: unknown, kind: OfferGroup["kind"]): OfferGroup | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<OfferGroup>;
  if (row.kind !== kind || typeof row.id !== "string") return null;
  const children = Array.isArray(row.children) ? row.children.flatMap(sanitizeChild) : [];
  return { id: row.id, kind, name: text(row.name), children };
}

function sanitizeChild(value: unknown): OfferNode[] {
  if (!value || typeof value !== "object") return [];
  const row = value as { kind?: string };
  if (row.kind === "subcategory") {
    const group = sanitizeGroup(value, "subcategory");
    return group ? [group] : [];
  }
  if (row.kind !== "position") return [];
  const position = value as Partial<OfferPosition>;
  if (typeof position.id !== "string") return [];
  return [
    {
      id: position.id,
      kind: "position",
      name: text(position.name),
      unit: text(position.unit),
      quantity: text(position.quantity),
      timeNorm: text(position.timeNorm),
      rate: text(position.rate),
      materialPrice: text(position.materialPrice),
      materialPositionId: text(position.materialPositionId),
      materials: sanitizeMaterials(position.materials),
      mechanismPrice: text(position.mechanismPrice),
      mechanismPositionId: text(position.mechanismPositionId),
      mechanismRate: text(position.mechanismRate),
      acknowledgedMechanismPriceId: text(position.acknowledgedMechanismPriceId),
    },
  ];
}

function sanitizeMaterials(value: unknown): OfferMaterial[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Partial<OfferMaterial>;
    if (typeof row.id !== "string") return [];
    return [
      {
        id: row.id,
        catalogId: text(row.catalogId),
        name: text(row.name),
        unit: text(row.unit),
        unitPrice: text(row.unitPrice),
        consumption: text(row.consumption),
        acknowledgedPriceId: text(row.acknowledgedPriceId),
      },
    ];
  });
}

function materialBase(position: OfferPosition) {
  if (position.materials.length === 0) return parseAmount(position.materialPrice);
  return position.materials.reduce((sum, line) => {
    if (!hasAmount(line.consumption)) return sum;
    return sum + parseAmount(line.consumption) * parseAmount(line.unitPrice);
  }, 0);
}

function mechanismBase(position: OfferPosition) {
  if (hasAmount(position.mechanismRate)) return parseAmount(position.timeNorm) * parseAmount(position.mechanismRate);
  return parseAmount(position.mechanismPrice);
}

export type OfferPriceUpdate = {
  positionId: string;
  role: "material" | "mechanism";
  lineId: string;
  name: string;
  from: string;
  to: string;
  entryId: string;
};

export function offerPriceUpdates(nodes: OfferNode[], cards: PricePosition[]): OfferPriceUpdate[] {
  const byId = new Map(cards.map((card) => [card.id, card]));
  const found: OfferPriceUpdate[] = [];
  walk(nodes);
  return found;

  function walk(list: OfferNode[]) {
    for (const node of list) {
      if (node.kind !== "position") {
        walk(node.children);
        continue;
      }
      for (const line of node.materials) {
        const change = catalogPriceChange(line.unitPrice, line.acknowledgedPriceId, byId.get(line.catalogId));
        if (!change) continue;
        found.push({ positionId: node.id, role: "material", lineId: line.id, name: line.name, ...change });
      }
      if (!node.mechanismPositionId || !hasAmount(node.mechanismRate)) continue;
      const card = byId.get(node.mechanismPositionId);
      const change = catalogPriceChange(node.mechanismRate, node.acknowledgedMechanismPriceId, card);
      if (!change) continue;
      found.push({ positionId: node.id, role: "mechanism", lineId: "", name: card?.name ?? "", ...change });
    }
  }
}

export function offerNeedsPriceReview(document: OfferDocument, cards: PricePosition[]) {
  if (!document.fixedAt && offerPriceUpdates(document.groups, cards).length > 0) return true;
  return document.extras.some((extra) => !extra.fixedAt && offerPriceUpdates(extra.groups, cards).length > 0);
}

function catalogPriceChange(snapshot: string, acknowledgedId: string, card: PricePosition | undefined) {
  const latest = card ? latestEntry(card) : null;
  if (!latest || latest.id === acknowledgedId) return null;
  if (roundMoney(parseAmount(snapshot)) === roundMoney(latest.unitPrice)) return null;
  return {
    from: hasAmount(snapshot) ? formatUnitPrice(parseAmount(snapshot)) : "—",
    to: formatUnitPrice(latest.unitPrice),
    entryId: latest.id,
  };
}

function normalizeUnit(value: string) {
  return value.trim().toLocaleLowerCase("lv").replace(/\.+$/, "");
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}
