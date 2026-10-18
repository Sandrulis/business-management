import { WarehouseView } from "@/app/components/warehouse-view";
import { loadMaterials } from "@/app/lib/catalog/repository";
import { connection } from "next/server";
import { Suspense } from "react";

export function WarehouseScreen() {
  return (
    <Suspense fallback={<div className="h-48 animate-pulse rounded-3xl bg-white/70" />}>
      <WarehouseContent />
    </Suspense>
  );
}

async function WarehouseContent() {
  await connection();
  const materials = await loadMaterials();
  return <WarehouseView initialItems={materials.items} available={materials.ok} />;
}
