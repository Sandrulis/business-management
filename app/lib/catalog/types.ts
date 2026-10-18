export type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  personalCode: string;
  email: string;
  phone: string;
  contractNumber: string;
  contractDate: string;
  role: string;
  photo: string;
};

export type EmployeeOption = {
  id: string;
  name: string;
  email: string;
};

export type ClothingStock = {
  size: string;
  quantity: number;
};

export type ClothingAssignment = {
  id: string;
  employeeId: string | null;
  employeeName: string;
  size: string;
  assignedOn: string;
  createdAt: string;
};

export type ClothingItem = {
  id: string;
  name: string;
  value: number;
  months: number;
  stocks: ClothingStock[];
  assignments: ClothingAssignment[];
};

export type EmployeeDraft = Omit<Employee, "id">;

export type ClothingDraft = {
  name: string;
  value: number;
  months: number;
};

export type InstrumentAssignment = {
  id: string;
  employeeId: string | null;
  employeeName: string;
  assignedOn: string;
  createdAt: string;
  kind: "assigned" | "returned";
};

export type Instrument = {
  id: string;
  number: string;
  brand: string;
  model: string;
  serialNumber: string;
  purchasedOn: string;
  price: number | null;
  note: string;
  assignments: InstrumentAssignment[];
};

export type InstrumentDraft = Omit<Instrument, "id" | "assignments">;

export type HeldInstrument = {
  id: string;
  brand: string;
  model: string;
  number: string;
  serialNumber: string;
  assignedOn: string;
};

export type MaterialReceipt = {
  id: string;
  quantity: number;
  shop: string;
  amount: number;
  createdAt: string;
  invoiceId: string | null;
};

export type Material = {
  id: string;
  name: string;
  unit: string;
  receipts: MaterialReceipt[];
};

export type MaterialDraft = {
  name: string;
  unit: string;
};

export type HeldClothing = {
  id: string;
  name: string;
  size: string;
  assignedOn: string;
};
