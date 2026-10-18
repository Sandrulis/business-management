"use client";

import { loadOutgoingInvoices } from "@/app/lib/outgoing/repository";
import { useEffect, useState } from "react";

let count = 0;
let revision = 0;
const listeners = new Set<() => void>();

export function setOutgoingUnpaid(next: number) {
  count = next;
  revision += 1;
  for (const listener of listeners) listener();
}

export function useOutgoingUnpaid() {
  const [value, setValue] = useState(count);

  useEffect(() => {
    const seen = revision;
    loadOutgoingInvoices().then((result) => {
      if (!result.ok || revision !== seen) return;
      setOutgoingUnpaid(result.items.filter((invoice) => !invoice.paid).length);
    });
    const sync = () => setValue(count);
    listeners.add(sync);
    sync();
    return () => {
      listeners.delete(sync);
    };
  }, []);

  return value;
}
