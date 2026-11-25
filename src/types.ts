/** Vitamins / minerals / fibre. Units: fiber & salt in g, vit_c / iron / magnesium / calcium in mg, vit_d in µg. */
export interface MicroAmounts {
  fiber: number;
  salt: number;
  vit_c: number;
  vit_d: number;
  iron: number;
  magnesium: number;
  calcium: number;
}

export type MicroKey = keyof MicroAmounts;

export interface Product {
  barcode: string;
  name: string;
  brand: string | null;
  kcal_100g: number | null;
  protein_100g: number | null;
  fat_100g: number | null;
  carbs_100g: number | null;
  default_weight_g: number | null;
  fiber_100g: number | null;
  salt_100g: number | null;
  vit_c_100g: number | null;
  vit_d_100g: number | null;
  iron_100g: number | null;
  magnesium_100g: number | null;
  calcium_100g: number | null;
  updated_at: number; // unix ms
}

export type ProductSource = 'local' | 'api';

export type ScanResult =
  | { status: 'found'; product: Product; source: ProductSource }
  | { status: 'not_found'; barcode: string }
  | { status: 'ignored' }
  | { status: 'error'; barcode: string; code: 'timeout' | 'failed' };

/** Product shown in the Frequent / Recent lists, with the portion the user usually eats. */
export interface QuickProduct extends Product {
  usual_weight_g: number | null;
}

export interface Nutrients {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface DayTotals extends Nutrients {
  date: string; // YYYY-MM-DD (local)
}

export interface DiaryEntry extends Nutrients, MicroAmounts {
  id: number;
  barcode: string | null;
  name: string;
  weight_g: number;
  eaten_at: string; // ISO 8601 (UTC)
}

export type NewDiaryEntry = Omit<DiaryEntry, 'id' | 'eaten_at' | MicroKey> &
  Partial<MicroAmounts> & { eaten_at?: string };

export interface UserGoals extends Nutrients {}
