import { EmployeesView } from "@/app/components/employees-view";
import { loadEmployees } from "@/app/lib/catalog/repository";
import { connection } from "next/server";

export async function EmployeesScreen() {
  await connection();
  const loaded = await loadEmployees();
  return <EmployeesView initialEmployees={loaded.employees} available={loaded.ok} />;
}
