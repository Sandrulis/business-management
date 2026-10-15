export type Mailbox = {
  id: string;
  email: string;
  password: string;
};

export type CompanySettings = {
  name: string;
  registrationNumber: string;
  vatNumber: string;
  address: string;
  email: string;
  phone: string;
  vatRate: string;
  paymentDays: string;
  currency: string;
  bankName: string;
  iban: string;
  overdueReminders: boolean;
  mailboxEmail: string;
  mailboxPassword: string;
  mailboxes: Mailbox[];
};

export const defaultCompanySettings: CompanySettings = {
  name: "",
  registrationNumber: "",
  vatNumber: "",
  address: "",
  email: "",
  phone: "",
  vatRate: "21",
  paymentDays: "14",
  currency: "EUR",
  bankName: "",
  iban: "",
  overdueReminders: true,
  mailboxEmail: "",
  mailboxPassword: "",
  mailboxes: [],
};
