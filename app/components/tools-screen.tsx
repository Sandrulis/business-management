import { ToolsView } from "@/app/components/tools-view";
import { loadEmployeeOptions, loadInstruments } from "@/app/lib/catalog/repository";
import { connection } from "next/server";
import { Suspense } from "react";

export function ToolsScreen() {
  return (
    <Suspense fallback={<div className="h-48 animate-pulse rounded-3xl bg-white/70" />}>
      <ToolsContent />
    </Suspense>
  );
}

async function ToolsContent() {
  await connection();
  const [tools, employees] = await Promise.all([loadInstruments(), loadEmployeeOptions()]);
  return <ToolsView initialItems={tools.items} employees={employees.employees} available={tools.ok && employees.ok} />;
}
