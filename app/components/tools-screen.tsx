import { ToolsView } from "@/app/components/tools-view";
import { loadEmployeeOptions, loadInstruments } from "@/app/lib/catalog/repository";
import { connection } from "next/server";

export async function ToolsScreen() {
  await connection();
  const [tools, employees] = await Promise.all([loadInstruments(), loadEmployeeOptions()]);
  return <ToolsView initialItems={tools.items} employees={employees.employees} available={tools.ok && employees.ok} />;
}
