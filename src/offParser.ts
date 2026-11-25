import { MICROS, type MicroUnit } from './micros';
import type { Product } from './types';

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

const round1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Name fields in priority order for the selected UI language. */
const NAME_FIELDS: Record<string, string[]> = {
  ru: ['product_name_ru', 'product_name', 'product_name_en', 'product_name_de'],
  de: ['product_name_de', 'product_name', 'product_name_en'],
  en: ['product_name_en', 'product_name', 'product_name_de'],
};

function pickName(p: any, lang: string): string {
  for (const f of NAME_FIELDS[lang] ?? NAME_FIELDS.en) {
    const v = typeof p[f] === 'string' ? p[f].trim() : '';
    if (v) return v;
  }
  return '';
}

const GRAM_TO: Record<MicroUnit, number> = { g: 1, mg: 1000, mcg: 1_000_000 };

function normUnit(u: unknown): MicroUnit | null {
  const s = String(u ?? '').trim().toLowerCase().replace('μ', 'µ');
  if (s === 'g') return 'g';
  if (s === 'mg') return 'mg';
  if (s === 'µg' || s === 'ug' || s === 'mcg') return 'mcg';
  return null;
}

/**
 * Reads `<base>_100g` and converts it to `target`.
 * Open Food Facts stores `_100g` in grams, so mg / µg are obtained by multiplying.
 * If `<base>_unit` says mg / µg and `<base>_value` equals the `_100g` number, the number is already
 * expressed in that unit and is only converted between mg and µg (never multiplied twice).
 */
export function readMicro(n: any, base: string, target: MicroUnit): number | null {
  const per100 = toNumber(n[`${base}_100g`]);
  if (per100 === null) return null;
  const unit = normUnit(n[`${base}_unit`]);
  const value = toNumber(n[`${base}_value`]);

  let amount = per100 * GRAM_TO[target];
  if (unit && unit !== 'g' && value !== null && Math.abs(value - per100) < 1e-9) {
    amount = per100 * (GRAM_TO[target] / GRAM_TO[unit]);
  }
  return round2(amount);
}

/** Converts a raw Open Food Facts product object to our Product. */
export function parseOffProduct(barcode: string, p: any, lang: string): Product | null {
  if (!p || !barcode) return null;
  const n = p.nutriments ?? {};

  const name = pickName(p, lang);
  if (!name) return null;

  let kcal = toNumber(n['energy-kcal_100g']);
  if (kcal === null) {
    const kj = toNumber(n['energy_100g']); // kJ fallback
    kcal = kj === null ? null : kj / 4.184;
  }

  const product: Product = {
    barcode,
    name,
    brand: String(p.brands ?? '').trim() || null,
    kcal_100g: round1(kcal),
    protein_100g: round1(toNumber(n['proteins_100g'])),
    fat_100g: round1(toNumber(n['fat_100g'])),
    carbs_100g: round1(toNumber(n['carbohydrates_100g'])),
    default_weight_g: toNumber(p.product_quantity),
    fiber_100g: null,
    salt_100g: null,
    vit_c_100g: null,
    vit_d_100g: null,
    iron_100g: null,
    magnesium_100g: null,
    calcium_100g: null,
    updated_at: Date.now(),
  };
  for (const m of MICROS) {
    (product as unknown as Record<string, number | null>)[m.field as string] = readMicro(
      n,
      m.off.replace('_100g', ''),
      m.unit,
    );
  }
  return product;
}

/** True if at least one micronutrient has a positive value. */
export function hasMicros(p: Product): boolean {
  return MICROS.some((m) => ((p[m.field] as number | null) ?? 0) > 0);
}

/** True if no micronutrient was ever stored (never fetched / migrated from the old schema). */
export function microsNeverSet(p: Product): boolean {
  return MICROS.every((m) => p[m.field] === null || p[m.field] === undefined);
}
