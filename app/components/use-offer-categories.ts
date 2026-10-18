"use client";

import { loadOffer } from "@/app/lib/offers/repository";
import { profitFactor, sumPrices, type OfferDocument } from "@/app/lib/offers/model";
import { useEffect, useState } from "react";

export type OfferCategoryRow = { id: string; name: string; offerTotal: number };

export function useOfferCategories(siteId: string) {
  return useOfferCategoryState(siteId).categories;
}

export function categoryBudgets(document: OfferDocument): OfferCategoryRow[] {
  const factor = profitFactor(document.profitPercent, document.profitHidden);
  return document.groups
    .filter((group) => group.kind === "category")
    .map((group) => ({
      id: group.id,
      name: group.name.trim() || "Bez nosaukuma",
      offerTotal: sumPrices(group.children, factor).volumeTotal,
    }));
}

export function useOfferCategoryState(siteId: string) {
  const [categories, setCategories] = useState<OfferCategoryRow[]>([]);
  const [ready, setReady] = useState(!siteId);

  useEffect(() => {
    setCategories([]);
    if (!siteId) {
      setReady(true);
      return;
    }
    setReady(false);
    let active = true;
    loadOffer(siteId).then((result) => {
      if (!active) return;
      setCategories(result.ok ? categoryBudgets(result.document) : []);
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, [siteId]);

  return { categories, ready };
}
