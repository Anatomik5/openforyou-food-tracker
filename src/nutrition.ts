import { MICROS } from './micros';
import type { MicroAmounts, Nutrients, Product } from './types';

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Nutrients + micronutrients for a portion of `weight` grams (missing values count as 0). */
export function scaleNutrients(product: Product, weight: number): Nutrients & MicroAmounts {
  const k = weight / 100;
  const micros = {} as MicroAmounts;
  for (const m of MICROS) micros[m.key] = round2(((product[m.field] as number | null) ?? 0) * k);
  return {
    kcal: Math.round((product.kcal_100g ?? 0) * k),
    protein: round1((product.protein_100g ?? 0) * k),
    fat: round1((product.fat_100g ?? 0) * k),
    carbs: round1((product.carbs_100g ?? 0) * k),
    ...micros,
  };
}
