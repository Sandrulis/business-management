import { PricePositionsView } from "@/app/components/price-positions-view";
import { loadPriceCatalog } from "@/app/lib/prices/repository";
import { connection } from "next/server";
import { Suspense } from "react";

export function PricePositionsScreen() {
  return (
    <Suspense fallback={<div className="h-48 animate-pulse rounded-3xl bg-white/70" />}>
      <PricePositionsContent />
    </Suspense>
  );
}

async function PricePositionsContent() {
  await connection();
  const loaded = await loadPriceCatalog();
  return (
    <PricePositionsView
      initial={loaded.ok ? loaded.positions : []}
      loadError={loaded.ok ? null : loaded.message}
    />
  );
}
