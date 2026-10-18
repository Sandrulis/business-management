import { EmployeesView } from "@/app/components/employees-view";
import { loadEmployees } from "@/app/lib/catalog/repository";
import { connection } from "next/server";
import { Suspense } from "react";

export function EmployeesScreen() {
  return (
    <Suspense fallback={<div className="h-48 animate-pulse rounded-3xl bg-white/70" />}>
      <EmployeesContent />
    </Suspense>
  );
}

async function EmployeesContent() {
  await connection();
  const loaded = await loadEmployees();
  return <EmployeesView initialEmployees={loaded.employees} available={loaded.ok} />;
}
