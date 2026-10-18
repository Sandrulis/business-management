import type { MonthKey } from "@/app/lib/invoices/model";
import { overlapSeconds, type WorkSession } from "@/app/lib/work-sessions/model";

const EMPLOYEE_VSAOI = 0.105;
const EMPLOYER_VSAOI = 0.2359;
const INCOME_TAX = 0.255;
const NON_TAXABLE = 550;

export type PayrollRow = {
  id: string;
  name: string;
  seconds: number;
  hours: number;
  gross: number;
  employeeSocial: number;
  employerSocial: number;
  incomeTax: number;
  net: number;
};

export function monthBounds(month: MonthKey) {
  const pad = (value: number) => String(value).padStart(2, "0");
  const from = `${month.year}-${pad(month.month)}-01`;
  const last = new Date(month.year, month.month, 0).getDate();
  return { from, to: `${month.year}-${pad(month.month)}-${pad(last)}` };
}

export function parseHourlyRate(raw: string) {
  const normalized = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const value = Math.round(Number(normalized) * 100) / 100;
  return value > 0 ? value : null;
}

export function payrollRows(
  people: { id: string; name: string }[],
  sessions: WorkSession[],
  month: MonthKey,
  hourlyRate: number | null,
  now: number,
): PayrollRow[] {
  const { from, to } = monthBounds(month);
  const names = new Map(people.map((person) => [person.id, person.name]));
  for (const session of sessions) {
    if (!names.has(session.employeeId)) names.set(session.employeeId, session.employeeName);
  }
  return [...names.entries()]
    .map(([id, name]) => {
      const seconds = sessions
        .filter((session) => session.employeeId === id)
        .reduce((sum, session) => sum + overlapSeconds(session, from, to, now), 0);
      const hours = Math.round((seconds / 3600) * 100) / 100;
      const gross = hourlyRate == null ? 0 : cents(hours * hourlyRate);
      const employeeSocial = cents(gross * EMPLOYEE_VSAOI);
      const employerSocial = cents(gross * EMPLOYER_VSAOI);
      const incomeTax = cents(Math.max(0, gross - employeeSocial - NON_TAXABLE) * INCOME_TAX);
      return {
        id,
        name,
        seconds,
        hours,
        gross,
        employeeSocial,
        employerSocial,
        incomeTax,
        net: cents(gross - employeeSocial - incomeTax),
      };
    })
    .filter((row) => row.seconds > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "lv"));
}

export function payrollTotals(rows: PayrollRow[]) {
  return rows.reduce(
    (total, row) => ({
      seconds: total.seconds + row.seconds,
      gross: cents(total.gross + row.gross),
      employeeSocial: cents(total.employeeSocial + row.employeeSocial),
      employerSocial: cents(total.employerSocial + row.employerSocial),
      incomeTax: cents(total.incomeTax + row.incomeTax),
      net: cents(total.net + row.net),
    }),
    { seconds: 0, gross: 0, employeeSocial: 0, employerSocial: 0, incomeTax: 0, net: 0 },
  );
}

export function formatHours(seconds: number) {
  if (seconds <= 0) return "";
  const hours = Math.round((seconds / 3600) * 10) / 10;
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1).replace(".", ",");
}

function cents(value: number) {
  return Math.round(value * 100) / 100;
}
