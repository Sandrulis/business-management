import { ClothingView } from "@/app/components/clothing-view";
import { loadClothing, loadEmployeeOptions } from "@/app/lib/catalog/repository";
import { connection } from "next/server";
import { Suspense } from "react";

export function ClothingScreen() {
  return (
    <Suspense fallback={<div className="h-48 animate-pulse rounded-3xl bg-white/70" />}>
      <ClothingContent />
    </Suspense>
  );
}

async function ClothingContent() {
  await connection();
  const [clothing, employees] = await Promise.all([loadClothing(), loadEmployeeOptions()]);
  return <ClothingView initialItems={clothing.items} employees={employees.employees} available={clothing.ok && employees.ok} />;
}
