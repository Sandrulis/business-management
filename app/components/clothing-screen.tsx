import { ClothingView } from "@/app/components/clothing-view";
import { loadClothing, loadEmployeeOptions } from "@/app/lib/catalog/repository";
import { connection } from "next/server";

export async function ClothingScreen() {
  await connection();
  const [clothing, employees] = await Promise.all([loadClothing(), loadEmployeeOptions()]);
  return <ClothingView initialItems={clothing.items} employees={employees.employees} available={clothing.ok && employees.ok} />;
}
