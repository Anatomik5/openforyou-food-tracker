/**
 * Chain check for micronutrients:
 *   real Open Food Facts JSON -> parser -> products (migrated old DB) -> portion -> diary_logs -> daily sums.
 * Run: npx tsx scripts/verify-micros.ts   (needs Node 22+ for node:sqlite)
 */
import { testDb } from './mock-expo-sqlite';
import assert from 'node:assert/strict';
import fixture from './fixtures/off-multivitamin.json';
import { addDiaryEntry, getDailyMicros, getProductByBarcode, initDatabase, saveProduct } from '../src/db';
import { hasMicros, microsNeverSet, parseOffProduct, readMicro } from '../src/offParser';
import { scaleNutrients } from '../src/nutrition';

async function main() {
  // 1. Parser on real OFF data (_100g is in grams -> mg / µg)
  const solevita = (fixture as any[]).find((p) => p.code === '4056489181460');
  const parsed = parseOffProduct('4056489181460', solevita, 'de')!;
  console.log('parsed:', {
    fiber: parsed.fiber_100g,
    salt: parsed.salt_100g,
    vit_c_mg: parsed.vit_c_100g,
    vit_d: parsed.vit_d_100g,
  });
  assert.equal(parsed.fiber_100g, 0.5);
  assert.equal(parsed.salt_100g, 0.01);
  assert.equal(parsed.vit_c_100g, 12); // 0.012 g -> 12 mg
  assert.equal(parsed.vit_d_100g, null); // not present in OFF -> null, not a fake 0

  // 2. Units: already-mg values must not be multiplied twice
  assert.equal(readMicro({ 'vitamin-c_100g': 23, 'vitamin-c_value': 23, 'vitamin-c_unit': 'mg' }, 'vitamin-c', 'mg'), 23);
  assert.equal(readMicro({ 'vitamin-c_100g': 0.023, 'vitamin-c_value': 23, 'vitamin-c_unit': 'mg' }, 'vitamin-c', 'mg'), 23);
  assert.equal(readMicro({ 'vitamin-d_100g': 0.0000025, 'vitamin-d_value': 2.5, 'vitamin-d_unit': 'µg' }, 'vitamin-d', 'mcg'), 2.5);
  assert.equal(readMicro({ 'vitamin-d_100g': 5, 'vitamin-d_value': 5, 'vitamin-d_unit': 'µg' }, 'vitamin-d', 'mcg'), 5);

  // 3. Old database (before micronutrients) is migrated without losing rows
  testDb.exec(`
    CREATE TABLE products (barcode TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, brand TEXT, kcal_100g REAL,
      protein_100g REAL, fat_100g REAL, carbs_100g REAL, default_weight_g REAL, updated_at INTEGER NOT NULL);
    CREATE TABLE diary_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, barcode TEXT, name TEXT NOT NULL,
      weight_g REAL NOT NULL, kcal REAL NOT NULL, protein REAL NOT NULL, fat REAL NOT NULL, carbs REAL NOT NULL,
      eaten_at TEXT NOT NULL);
    INSERT INTO products VALUES ('111', 'Old cached', NULL, 100, 1, 2, 3, NULL, 1);
    INSERT INTO diary_logs (barcode, name, weight_g, kcal, protein, fat, carbs, eaten_at)
      VALUES ('111', 'Old cached', 100, 100, 1, 2, 3, '${new Date().toISOString()}');
  `);
  await initDatabase();
  const old = (await getProductByBarcode('111'))!;
  assert.equal(old.name, 'Old cached');
  assert.ok(microsNeverSet(old), 'old cached product has never-set micros -> scanner will refresh it from OFF');
  assert.ok(!hasMicros(old));

  // 4. Save product with vitamins, add a 250 g portion, read daily sums (what the "Today" card shows)
  await saveProduct(parsed);
  const stored = (await getProductByBarcode('4056489181460'))!;
  assert.equal(stored.vit_c_100g, 12);
  const portion = scaleNutrients(stored, 250);
  console.log('portion 250 g:', portion);
  assert.equal(portion.vit_c, 30);
  assert.equal(portion.fiber, 1.25);
  await addDiaryEntry({ barcode: stored.barcode, name: stored.name, weight_g: 250, ...portion });

  const day = await getDailyMicros();
  console.log('daily micros:', day);
  assert.equal(day.vit_c, 30);
  assert.equal(day.fiber, 1.25);
  assert.equal(day.salt, 0.03); // 0.01 g/100 g * 2.5 = 0.025 -> stored with 2 decimals (0.03)
  console.log('OK: non-zero micronutrients reach the daily summary');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
