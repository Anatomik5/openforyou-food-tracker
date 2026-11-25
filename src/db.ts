import * as SQLite from 'expo-sqlite';
import { dayRangeISO, lastNDates, toDateString } from './dateUtils';
import type { BodyProfile } from './calculator';
import { MICROS } from './micros';
import type {
  DayTotals,
  DiaryEntry,
  MicroAmounts,
  NewDiaryEntry,
  Nutrients,
  Product,
  QuickProduct,
  UserGoals,
} from './types';

export const DEFAULT_GOALS: UserGoals = { kcal: 2200, protein: 150, fat: 70, carbs: 250 };

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function ensureColumns(db: SQLite.SQLiteDatabase, table: string, cols: [string, string][]) {
  const info = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  const have = new Set(info.map((r) => r.name));
  for (const [name, ddl] of cols) {
    if (!have.has(name)) await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${name} ${ddl}`);
  }
}

/** Lazily opens the database and creates the schema once. */
function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('foodtracker.db');
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS products (
          barcode          TEXT PRIMARY KEY NOT NULL,
          name             TEXT NOT NULL,
          brand            TEXT,
          kcal_100g        REAL,
          protein_100g     REAL,
          fat_100g         REAL,
          carbs_100g       REAL,
          default_weight_g REAL,
          updated_at       INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS diary_logs (
          id        INTEGER PRIMARY KEY AUTOINCREMENT,
          barcode   TEXT,
          name      TEXT NOT NULL,
          weight_g  REAL NOT NULL,
          kcal      REAL NOT NULL,
          protein   REAL NOT NULL,
          fat       REAL NOT NULL,
          carbs     REAL NOT NULL,
          eaten_at  TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_diary_eaten_at ON diary_logs (eaten_at);
        CREATE INDEX IF NOT EXISTS idx_diary_barcode ON diary_logs (barcode);
        CREATE TABLE IF NOT EXISTS settings (
          key   TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS user_goals (
          id      INTEGER PRIMARY KEY CHECK (id = 1),
          kcal    REAL NOT NULL,
          protein REAL NOT NULL,
          fat     REAL NOT NULL,
          carbs   REAL NOT NULL
        );
      `);
      // Safe migration: add micronutrient columns only if they are missing (keeps existing data).
      await ensureColumns(
        db,
        'products',
        MICROS.map((m) => [m.field as string, 'REAL']),
      );
      await ensureColumns(
        db,
        'diary_logs',
        MICROS.map((m) => [m.key as string, 'REAL NOT NULL DEFAULT 0']),
      );
      await db.runAsync(
        'INSERT OR IGNORE INTO user_goals (id, kcal, protein, fat, carbs) VALUES (1, ?, ?, ?, ?)',
        [DEFAULT_GOALS.kcal, DEFAULT_GOALS.protein, DEFAULT_GOALS.fat, DEFAULT_GOALS.carbs],
      );
      return db;
    })().catch((e) => {
      dbPromise = null; // allow retry after a failed init
      throw e;
    });
  }
  return dbPromise;
}

/** Opens the DB and runs migrations; throws if that fails (call once at startup). */
export async function initDatabase(): Promise<void> {
  await getDb();
}

// --- Products -------------------------------------------------------------
export async function getProductByBarcode(barcode: string): Promise<Product | null> {
  const db = await getDb();
  return db.getFirstAsync<Product>('SELECT * FROM products WHERE barcode = ?', [barcode]);
}

export async function saveProduct(product: Product): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO products
       (barcode, name, brand, kcal_100g, protein_100g, fat_100g, carbs_100g, default_weight_g, updated_at,
        fiber_100g, salt_100g, vit_c_100g, vit_d_100g, iron_100g, magnesium_100g, calcium_100g)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      product.barcode,
      product.name,
      product.brand,
      product.kcal_100g,
      product.protein_100g,
      product.fat_100g,
      product.carbs_100g,
      product.default_weight_g,
      product.updated_at,
      product.fiber_100g,
      product.salt_100g,
      product.vit_c_100g,
      product.vit_d_100g,
      product.iron_100g,
      product.magnesium_100g,
      product.calcium_100g,
    ],
  );
}

// --- Diary ----------------------------------------------------------------
/** Saves an eaten portion; eaten_at defaults to now (ISO 8601). */
export async function addDiaryEntry(entry: NewDiaryEntry): Promise<number> {
  const db = await getDb();
  const res = await db.runAsync(
    `INSERT INTO diary_logs (barcode, name, weight_g, kcal, protein, fat, carbs, eaten_at,
                             fiber, salt, vit_c, vit_d, iron, magnesium, calcium)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.barcode,
      entry.name,
      entry.weight_g,
      entry.kcal,
      entry.protein,
      entry.fat,
      entry.carbs,
      entry.eaten_at ?? new Date().toISOString(),
      entry.fiber ?? 0,
      entry.salt ?? 0,
      entry.vit_c ?? 0,
      entry.vit_d ?? 0,
      entry.iron ?? 0,
      entry.magnesium ?? 0,
      entry.calcium ?? 0,
    ],
  );
  return res.lastInsertRowId;
}

/** Entries of a local day (YYYY-MM-DD, default today), oldest first. */
export async function getDiaryEntriesByDate(dateString: string = toDateString()): Promise<DiaryEntry[]> {
  const db = await getDb();
  const [start, end] = dayRangeISO(dateString);
  return db.getAllAsync<DiaryEntry>(
    'SELECT * FROM diary_logs WHERE eaten_at >= ? AND eaten_at < ? ORDER BY eaten_at ASC, id ASC',
    [start, end],
  );
}

export async function deleteDiaryEntry(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM diary_logs WHERE id = ?', [id]);
}

export async function getDailyTotals(dateString: string = toDateString()): Promise<Nutrients> {
  const db = await getDb();
  const [start, end] = dayRangeISO(dateString);
  const row = await db.getFirstAsync<Nutrients>(
    `SELECT COALESCE(SUM(kcal), 0)    AS kcal,
            COALESCE(SUM(protein), 0) AS protein,
            COALESCE(SUM(fat), 0)     AS fat,
            COALESCE(SUM(carbs), 0)   AS carbs
     FROM diary_logs WHERE eaten_at >= ? AND eaten_at < ?`,
    [start, end],
  );
  return row ?? { kcal: 0, protein: 0, fat: 0, carbs: 0 };
}

/** Micronutrient sums of a local day (YYYY-MM-DD, default today). */
export async function getDailyMicros(dateString: string = toDateString()): Promise<MicroAmounts> {
  const db = await getDb();
  const [start, end] = dayRangeISO(dateString);
  const row = await db.getFirstAsync<MicroAmounts>(
    `SELECT COALESCE(SUM(fiber), 0) AS fiber, COALESCE(SUM(salt), 0) AS salt,
            COALESCE(SUM(vit_c), 0) AS vit_c, COALESCE(SUM(vit_d), 0) AS vit_d,
            COALESCE(SUM(iron), 0) AS iron, COALESCE(SUM(magnesium), 0) AS magnesium,
            COALESCE(SUM(calcium), 0) AS calcium
     FROM diary_logs WHERE eaten_at >= ? AND eaten_at < ?`,
    [start, end],
  );
  return row ?? { fiber: 0, salt: 0, vit_c: 0, vit_d: 0, iron: 0, magnesium: 0, calcium: 0 };
}

/** Per-day totals for the last `days` days (oldest first, empty days are zeros). */
export async function getTotalsForLastDays(days: number): Promise<DayTotals[]> {
  const db = await getDb();
  const dates = lastNDates(days);
  const result = new Map<string, DayTotals>(
    dates.map((date) => [date, { date, kcal: 0, protein: 0, fat: 0, carbs: 0 }]),
  );
  const start = dayRangeISO(dates[0])[0];
  const end = dayRangeISO(dates[dates.length - 1])[1];
  const rows = await db.getAllAsync<{ eaten_at: string } & Nutrients>(
    'SELECT eaten_at, kcal, protein, fat, carbs FROM diary_logs WHERE eaten_at >= ? AND eaten_at < ?',
    [start, end],
  );
  for (const r of rows) {
    const day = result.get(toDateString(new Date(r.eaten_at)));
    if (!day) continue;
    day.kcal += r.kcal;
    day.protein += r.protein;
    day.fat += r.fat;
    day.carbs += r.carbs;
  }
  return dates.map((d) => result.get(d)!);
}

// --- Quick access ---------------------------------------------------------
const roundTo5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

/** Last unique products from the diary; usual weight = the last portion eaten. */
export async function getRecentProducts(limit = 15): Promise<QuickProduct[]> {
  const db = await getDb();
  return db.getAllAsync<QuickProduct>(
    `SELECT p.*,
            (SELECT d2.weight_g FROM diary_logs d2
              WHERE d2.barcode = p.barcode ORDER BY d2.eaten_at DESC, d2.id DESC LIMIT 1) AS usual_weight_g
     FROM products p
     JOIN (SELECT barcode, MAX(eaten_at) AS last_at
             FROM diary_logs WHERE barcode IS NOT NULL
            GROUP BY barcode ORDER BY last_at DESC LIMIT ?) r ON r.barcode = p.barcode
     ORDER BY r.last_at DESC`,
    [limit],
  );
}

/** Top products by number of diary entries; usual weight = average portion (rounded to 5 g). */
export async function getFrequentProducts(limit = 15): Promise<QuickProduct[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<QuickProduct>(
    `SELECT p.*, f.avg_weight AS usual_weight_g
     FROM products p
     JOIN (SELECT barcode, COUNT(*) AS cnt, AVG(weight_g) AS avg_weight, MAX(eaten_at) AS last_at
             FROM diary_logs WHERE barcode IS NOT NULL
            GROUP BY barcode ORDER BY cnt DESC, last_at DESC LIMIT ?) f ON f.barcode = p.barcode
     ORDER BY f.cnt DESC, f.last_at DESC`,
    [limit],
  );
  return rows.map((r) => ({
    ...r,
    usual_weight_g: r.usual_weight_g === null ? null : roundTo5(r.usual_weight_g),
  }));
}

// --- Search ---------------------------------------------------------------
/** Live filter over the local products table (name, brand or barcode). */
export async function searchLocalProducts(query: string, limit = 30): Promise<Product[]> {
  const q = query.trim();
  if (!q) return [];
  const db = await getDb();
  const like = `%${q.replace(/[\\%_]/g, (c) => '\\' + c)}%`;
  return db.getAllAsync<Product>(
    `SELECT * FROM products
     WHERE name LIKE ? ESCAPE '\\' OR brand LIKE ? ESCAPE '\\' OR barcode LIKE ? ESCAPE '\\'
     ORDER BY updated_at DESC LIMIT ?`,
    [like, like, like, limit],
  );
}

// --- Settings -------------------------------------------------------------
export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
}

export async function getAllDiaryEntries(): Promise<DiaryEntry[]> {
  const db = await getDb();
  return db.getAllAsync<DiaryEntry>('SELECT * FROM diary_logs ORDER BY eaten_at ASC, id ASC');
}

// --- Body profile (calculator input, stored as JSON in settings) ----------
export async function getBodyProfile(): Promise<BodyProfile | null> {
  try {
    const raw = await getSetting('body_profile');
    return raw ? (JSON.parse(raw) as BodyProfile) : null;
  } catch {
    return null;
  }
}

export async function saveBodyProfile(profile: BodyProfile): Promise<void> {
  await setSetting('body_profile', JSON.stringify(profile));
}

// --- Goals ----------------------------------------------------------------
export async function getGoals(): Promise<UserGoals> {
  const db = await getDb();
  const row = await db.getFirstAsync<UserGoals>(
    'SELECT kcal, protein, fat, carbs FROM user_goals WHERE id = 1',
  );
  return row ?? DEFAULT_GOALS;
}

export async function updateGoals(goals: UserGoals): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE user_goals SET kcal = ?, protein = ?, fat = ?, carbs = ? WHERE id = 1',
    [goals.kcal, goals.protein, goals.fat, goals.carbs],
  );
}
