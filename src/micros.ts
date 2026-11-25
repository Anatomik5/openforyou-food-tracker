import type { MicroKey, Product } from './types';

export type MicroUnit = 'g' | 'mg' | 'mcg';

export interface MicroDef {
  key: MicroKey;
  /** Column of `products` (per 100 g). */
  field: keyof Product;
  unit: MicroUnit;
  /** Basic daily norm (salt: upper limit). */
  daily: number;
  /** Key of the Open Food Facts nutriment and its multiplier from grams to our unit. */
  off: string;
  fromGrams: number;
}

export const MICROS: MicroDef[] = [
  { key: 'fiber', field: 'fiber_100g', unit: 'g', daily: 30, off: 'fiber_100g', fromGrams: 1 },
  { key: 'vit_c', field: 'vit_c_100g', unit: 'mg', daily: 90, off: 'vitamin-c_100g', fromGrams: 1000 },
  { key: 'vit_d', field: 'vit_d_100g', unit: 'mcg', daily: 15, off: 'vitamin-d_100g', fromGrams: 1_000_000 },
  { key: 'iron', field: 'iron_100g', unit: 'mg', daily: 14, off: 'iron_100g', fromGrams: 1000 },
  { key: 'magnesium', field: 'magnesium_100g', unit: 'mg', daily: 375, off: 'magnesium_100g', fromGrams: 1000 },
  { key: 'calcium', field: 'calcium_100g', unit: 'mg', daily: 1000, off: 'calcium_100g', fromGrams: 1000 },
  { key: 'salt', field: 'salt_100g', unit: 'g', daily: 5, off: 'salt_100g', fromGrams: 1 },
];

export const MICRO_COLORS: Record<MicroKey, string> = {
  fiber: '#8d6e63',
  vit_c: '#ffa726',
  vit_d: '#fdd835',
  iron: '#ef5350',
  magnesium: '#26a69a',
  calcium: '#90caf9',
  salt: '#b0bec5',
};
