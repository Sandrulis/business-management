import { createDataClient } from "@/app/lib/invoices/repository";
import type {
  ClothingAssignment,
  ClothingDraft,
  ClothingItem,
  ClothingStock,
  Employee,
  EmployeeDraft,
  EmployeeOption,
  HeldClothing,
  HeldInstrument,
  Instrument,
  InstrumentAssignment,
  InstrumentDraft,
} from "@/app/lib/catalog/types";

type EmployeeRow = {
  id: string;
  first_name: string;
  last_name: string;
  personal_code: string;
  email: string;
  phone: string;
  contract_number: string;
  contract_date: string;
  role: string;
  photo: string | null;
};

type ClothingRow = {
  id: string;
  name: string;
  value: number | string;
  months: number;
  clothing_stocks: { size: string; quantity: number }[] | null;
  clothing_assignments: {
    id: string;
    employee_id: string | null;
    employee_name: string | null;
    size: string;
    assigned_on: string;
    created_at: string;
  }[] | null;
};

const employeeColumns = "id, first_name, last_name, personal_code, email, phone, contract_number, contract_date, role, photo";

export async function loadEmployees(): Promise<{ ok: true; employees: Employee[] } | { ok: false; employees: Employee[] }> {
  const supabase = createDataClient();
  if (!supabase) return { ok: false, employees: [] };
  const { data, error } = await supabase.from("employees").select(employeeColumns).order("created_at", { ascending: false });
  if (error || !data) return { ok: false, employees: [] };
  return { ok: true, employees: data.map(toEmployee) };
}

export async function loadEmployeeOptions(): Promise<{ ok: true; employees: EmployeeOption[] } | { ok: false; employees: EmployeeOption[] }> {
  const supabase = createDataClient();
  if (!supabase) return { ok: false, employees: [] };
  const { data, error } = await supabase.from("employees").select("id, first_name, last_name, email").order("last_name").order("first_name");
  if (error || !data) return { ok: false, employees: [] };
  return {
    ok: true,
    employees: data.map((row) => ({
      id: row.id as string,
      name: `${row.first_name as string} ${row.last_name as string}`.trim(),
      email: (row.email as string) ?? "",
    })),
  };
}

export async function saveEmployeeRecord(
  draft: EmployeeDraft,
  id?: string,
): Promise<{ ok: true; employee: Employee } | { ok: false; message: string }> {
  const supabase = createDataClient();
  if (!supabase) return { ok: false, message: "Datubāze nav pieslēgta." };
  const row = {
    first_name: draft.firstName.trim(),
    last_name: draft.lastName.trim(),
    personal_code: draft.personalCode,
    email: draft.email.trim(),
    phone: draft.phone.trim(),
    contract_number: draft.contractNumber.trim(),
    contract_date: draft.contractDate,
    role: draft.role.trim(),
    photo: draft.photo,
  };
  const query = id
    ? supabase.from("employees").update(row).eq("id", id).select(employeeColumns).single()
    : supabase.from("employees").insert(row).select(employeeColumns).single();
  const { data, error } = await query;
  if (error || !data) return { ok: false, message: employeeError(error?.code) };
  return { ok: true, employee: toEmployee(data) };
}

export async function deleteEmployeeRecord(id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = createDataClient();
  if (!supabase) return { ok: false, message: "Datubāze nav pieslēgta." };
  const { error } = await supabase.from("employees").delete().eq("id", id);
  if (error) return { ok: false, message: "Darbinieku neizdevās dzēst." };
  return { ok: true };
}

export async function loadClothing(): Promise<{ ok: true; items: ClothingItem[] } | { ok: false; items: ClothingItem[] }> {
  const supabase = createDataClient();
  if (!supabase) return { ok: false, items: [] };
  const { data, error } = await supabase
    .from("clothing")
    .select("id, name, value, months, clothing_stocks(size, quantity), clothing_assignments(id, employee_id, employee_name, size, assigned_on, created_at)")
    .order("created_at", { ascending: false });
  if (error || !data) return { ok: false, items: [] };
  return { ok: true, items: data.map(toClothing) };
}

export async function saveClothingRecord(
  draft: ClothingDraft,
  id?: string,
): Promise<{ ok: true; item: ClothingItem } | { ok: false; message: string }> {
  const supabase = createDataClient();
  if (!supabase) return { ok: false, message: "Datubāze nav pieslēgta." };
  const row = { name: draft.name.trim(), value: draft.value, months: draft.months };
  const query = id
    ? supabase.from("clothing").update(row).eq("id", id).select("id, name, value, months").single()
    : supabase.from("clothing").insert(row).select("id, name, value, months").single();
  const { data, error } = await query;
  if (error || !data) return { ok: false, message: "Apģērbu neizdevās saglabāt." };
  return {
    ok: true,
    item: {
      id: data.id as string,
      name: data.name as string,
      value: Number(data.value),
      months: Number(data.months),
      stocks: [],
      assignments: [],
    },
  };
}

export async function recordClothingAssignments(
  clothingId: string,
  rows: { employeeId: string; employeeName: string; size: string }[],
  assignedOn: string,
): Promise<{ ok: true; assignments: ClothingAssignment[] } | { ok: false; message: string }> {
  const supabase = createDataClient();
  if (!supabase) return { ok: false, message: "Datubāze nav pieslēgta." };
  const { data, error } = await supabase
    .from("clothing_assignments")
    .insert(
      rows.map((row) => ({
        clothing_id: clothingId,
        employee_id: row.employeeId,
        employee_name: row.employeeName,
        size: row.size,
        assigned_on: assignedOn,
      })),
    )
    .select("id, employee_id, employee_name, size, assigned_on, created_at");
  if (error || !data) return { ok: false, message: "Apģērbu neizdevās piesaistīt." };
  return {
    ok: true,
    assignments: data
      .map((row) => toClothingAssignment(row))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}

export async function deleteClothingAssignments(ids: string[]) {
  if (ids.length === 0) return;
  const supabase = createDataClient();
  if (!supabase) return;
  await supabase.from("clothing_assignments").delete().in("id", ids);
}

export async function loadEmployeeGear(employeeId: string): Promise<
  { ok: true; instruments: HeldInstrument[]; clothing: HeldClothing[] } | { ok: false; instruments: HeldInstrument[]; clothing: HeldClothing[] }
> {
  const supabase = createDataClient();
  if (!supabase) return { ok: false, instruments: [], clothing: [] };
  const [instruments, clothing] = await Promise.all([
    loadInstruments(),
    supabase
      .from("clothing_assignments")
      .select("id, size, assigned_on, clothing(name)")
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false }),
  ]);
  if (!instruments.ok || clothing.error) return { ok: false, instruments: [], clothing: [] };
  return {
    ok: true,
    instruments: instruments.items
      .filter((item) => {
        const latest = item.assignments[0];
        return latest?.kind === "assigned" && latest.employeeId === employeeId;
      })
      .map((item) => ({
        id: item.id,
        brand: item.brand,
        model: item.model,
        number: item.number,
        serialNumber: item.serialNumber,
        assignedOn: item.assignments[0]?.assignedOn ?? "",
      })),
    clothing: (clothing.data ?? []).map((row) => ({
      id: row.id as string,
      name: clothingName(row.clothing),
      size: row.size as string,
      assignedOn: String(row.assigned_on).slice(0, 10),
    })),
  };
}

function clothingName(value: { name: string } | { name: string }[] | null) {
  if (!value) return "Apģērbs";
  return Array.isArray(value) ? (value[0]?.name ?? "Apģērbs") : value.name;
}

export async function deleteClothingRecord(id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = createDataClient();
  if (!supabase) return { ok: false, message: "Datubāze nav pieslēgta." };
  const { error } = await supabase.from("clothing").delete().eq("id", id);
  if (error) return { ok: false, message: "Apģērbu neizdevās dzēst." };
  return { ok: true };
}

export async function replaceClothingStocks(
  clothingId: string,
  stocks: ClothingStock[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = createDataClient();
  if (!supabase) return { ok: false, message: "Datubāze nav pieslēgta." };
  const removed = await supabase.from("clothing_stocks").delete().eq("clothing_id", clothingId);
  if (removed.error) return { ok: false, message: "Atlikumu neizdevās saglabāt." };
  if (stocks.length === 0) return { ok: true };
  const inserted = await supabase.from("clothing_stocks").insert(
    stocks.map((line) => ({ clothing_id: clothingId, size: line.size, quantity: line.quantity })),
  );
  if (inserted.error) return { ok: false, message: "Atlikumu neizdevās saglabāt." };
  return { ok: true };
}

const instrumentColumns = "id, number, brand, model, serial_number, purchased_on, price, note";

type InstrumentAssignmentRow = {
  id: string;
  employee_id: string | null;
  employee_name: string;
  assigned_on: string;
  created_at: string;
  kind?: string | null;
};

type InstrumentRow = {
  id: string;
  number: string | null;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  purchased_on: string | null;
  price: number | string | null;
  note: string | null;
  instrument_assignments: InstrumentAssignmentRow[] | null;
};

export async function loadInstruments(): Promise<{ ok: true; items: Instrument[] } | { ok: false; items: Instrument[] }> {
  const supabase = createDataClient();
  if (!supabase) return { ok: false, items: [] };
  const { data, error } = await supabase
    .from("instruments")
    .select(`${instrumentColumns}, instrument_assignments(id, employee_id, employee_name, assigned_on, created_at, kind)`)
    .order("created_at", { ascending: false });
  if (error || !data) return { ok: false, items: [] };
  return { ok: true, items: data.map(toInstrument) };
}

export async function saveInstrumentRecord(
  draft: InstrumentDraft,
  id?: string,
): Promise<{ ok: true; item: Instrument } | { ok: false; message: string }> {
  const supabase = createDataClient();
  if (!supabase) return { ok: false, message: "Datubāze nav pieslēgta." };
  const row = {
    number: blank(draft.number),
    brand: blank(draft.brand),
    model: blank(draft.model),
    serial_number: blank(draft.serialNumber),
    purchased_on: draft.purchasedOn || null,
    price: draft.price,
    note: blank(draft.note),
  };
  const query = id
    ? supabase.from("instruments").update(row).eq("id", id).select(instrumentColumns).single()
    : supabase.from("instruments").insert(row).select(instrumentColumns).single();
  const { data, error } = await query;
  if (error || !data) return { ok: false, message: instrumentError(error?.code) };
  return { ok: true, item: { ...toInstrument({ ...data, instrument_assignments: [] }), assignments: [] } };
}

export async function deleteInstrumentRecord(id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = createDataClient();
  if (!supabase) return { ok: false, message: "Datubāze nav pieslēgta." };
  const { error } = await supabase.from("instruments").delete().eq("id", id);
  if (error) return { ok: false, message: "Instrumentu neizdevās dzēst." };
  return { ok: true };
}

export async function assignInstrument(
  instrumentId: string,
  employee: EmployeeOption,
  assignedOn: string,
): Promise<{ ok: true; assignment: InstrumentAssignment } | { ok: false; message: string }> {
  const supabase = createDataClient();
  if (!supabase) return { ok: false, message: "Datubāze nav pieslēgta." };
  const { data, error } = await supabase
    .from("instrument_assignments")
    .insert({
      instrument_id: instrumentId,
      employee_id: employee.id,
      employee_name: employee.name,
      assigned_on: assignedOn,
      kind: "assigned",
    })
    .select("id, employee_id, employee_name, assigned_on, created_at, kind")
    .single();
  if (error || !data) return { ok: false, message: "Instrumentu neizdevās piesaistīt." };
  return {
    ok: true,
    assignment: {
      id: data.id as string,
      employeeId: (data.employee_id as string | null) ?? null,
      employeeName: data.employee_name as string,
      assignedOn: String(data.assigned_on).slice(0, 10),
      createdAt: String(data.created_at),
      kind: data.kind === "returned" ? "returned" : "assigned",
    },
  };
}

export async function returnInstrument(
  instrumentId: string,
  holder: InstrumentAssignment,
  returnedOn: string,
): Promise<{ ok: true; assignment: InstrumentAssignment } | { ok: false; message: string }> {
  const supabase = createDataClient();
  if (!supabase) return { ok: false, message: "Datubāze nav pieslēgta." };
  const { data, error } = await supabase
    .from("instrument_assignments")
    .insert({
      instrument_id: instrumentId,
      employee_id: holder.employeeId,
      employee_name: holder.employeeName,
      assigned_on: returnedOn,
      kind: "returned",
    })
    .select("id, employee_id, employee_name, assigned_on, created_at, kind")
    .single();
  if (error || !data) return { ok: false, message: "Instrumentu neizdevās nodot." };
  return {
    ok: true,
    assignment: {
      id: data.id as string,
      employeeId: (data.employee_id as string | null) ?? null,
      employeeName: data.employee_name as string,
      assignedOn: String(data.assigned_on).slice(0, 10),
      createdAt: String(data.created_at),
      kind: "returned",
    },
  };
}

function toInstrument(row: InstrumentRow): Instrument {
  const assignments = (row.instrument_assignments ?? [])
    .map((line) => ({
      id: line.id,
      employeeId: line.employee_id,
      employeeName: line.employee_name,
      assignedOn: String(line.assigned_on).slice(0, 10),
      createdAt: line.created_at,
      kind: line.kind === "returned" ? ("returned" as const) : ("assigned" as const),
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return {
    id: row.id,
    number: row.number ?? "",
    brand: row.brand ?? "",
    model: row.model ?? "",
    serialNumber: row.serial_number ?? "",
    purchasedOn: row.purchased_on ? String(row.purchased_on).slice(0, 10) : "",
    price: row.price == null ? null : Number(row.price),
    note: row.note ?? "",
    assignments,
  };
}

function blank(value: string) {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function instrumentError(code: string | undefined) {
  if (code === "23505") return "Instruments ar šo numuru jau ir.";
  return "Instrumentu neizdevās saglabāt.";
}

function toEmployee(row: EmployeeRow): Employee {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    personalCode: row.personal_code,
    email: row.email,
    phone: row.phone,
    contractNumber: row.contract_number,
    contractDate: row.contract_date.slice(0, 10),
    role: row.role,
    photo: row.photo ?? "",
  };
}

function toClothing(row: ClothingRow): ClothingItem {
  return {
    id: row.id,
    name: row.name,
    value: Number(row.value),
    months: Number(row.months),
    stocks: (row.clothing_stocks ?? [])
      .map((line) => ({ size: line.size, quantity: Number(line.quantity) }))
      .sort((a, b) => a.size.localeCompare(b.size, "lv")),
    assignments: (row.clothing_assignments ?? [])
      .map((line) => toClothingAssignment(line))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}

function toClothingAssignment(row: {
  id: string;
  employee_id: string | null;
  employee_name: string | null;
  size: string;
  assigned_on: string;
  created_at: string;
}): ClothingAssignment {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name ?? "",
    size: row.size,
    assignedOn: String(row.assigned_on).slice(0, 10),
    createdAt: row.created_at,
  };
}

function employeeError(code: string | undefined) {
  if (code === "23505") return "Darbinieks ar šo personas kodu jau ir.";
  return "Darbinieku neizdevās saglabāt.";
}
