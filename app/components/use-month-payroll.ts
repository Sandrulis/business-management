"use client";

import { useInvoices } from "@/app/components/invoice-state";
import { monthBounds, parseHourlyRate, payrollRows, payrollTotals } from "@/app/lib/accounting/payroll";
import { loadEmployeeOptions } from "@/app/lib/catalog/repository";
import type { WorkSession } from "@/app/lib/work-sessions/model";
import { loadSessionsBetween } from "@/app/lib/work-sessions/repository";
import { useEffect, useMemo, useState } from "react";

export function useMonthPayroll() {
  const { month, settings, notify } = useInvoices();
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const rate = parseHourlyRate(settings.offerHourlyRate);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    loadEmployeeOptions().then((result) => {
      if (active && result.ok) setPeople(result.employees.map((employee) => ({ id: employee.id, name: employee.name })));
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const { from, to } = monthBounds(month);
    let active = true;
    loadSessionsBetween(from, to).then((result) => {
      if (!active) return;
      if (!result.ok) {
        notify(result.message, "error");
        return;
      }
      setSessions(result.sessions);
    });
    return () => {
      active = false;
    };
  }, [month, notify]);

  const rows = useMemo(() => payrollRows(people, sessions, month, rate, now), [people, sessions, month, rate, now]);
  const totals = useMemo(() => payrollTotals(rows), [rows]);
  return { month, rate, rows, totals };
}
