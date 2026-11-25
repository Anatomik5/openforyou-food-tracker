import { getProductByBarcode, saveProduct } from './db';
import i18n from './i18n';
import { MICROS } from './micros';
import { hasMicros, microsNeverSet, parseOffProduct } from './offParser';
import type { Product, ScanResult } from './types';

const DEDUP_WINDOW_MS = 2000;
const REQUEST_TIMEOUT_MS = 10000;
const REFRESH_TIMEOUT_MS = 4000;
const STALE_ZERO_MS = 7 * 24 * 60 * 60 * 1000;
const OFF_HEADERS = { 'User-Agent': 'FoodTracker/1.0 (Android)' };
const OFF_PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product';
const OFF_SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl';
// `nutriments` is requested as a whole object, so vitamins / minerals are not cut off.
const OFF_SEARCH_FIELDS =
  'code,product_name,product_name_de,product_name_ru,product_name_en,brands,product_quantity,nutriments';

// --- Duplicate protection -------------------------------------------------
// A scan is dropped if another one is being processed, or if the same
// barcode was accepted less than DEDUP_WINDOW_MS ago.
let busy = false;
let lastBarcode: string | null = null;
let lastAcceptedAt = 0;

function tryAcquire(barcode: string): boolean {
  const now = Date.now();
  if (busy) return false;
  if (barcode === lastBarcode && now - lastAcceptedAt < DEDUP_WINDOW_MS) return false;
  busy = true;
  lastBarcode = barcode;
  lastAcceptedAt = now;
  return true;
}

// --- Open Food Facts ------------------------------------------------------
/** GET with timeout and the required User-Agent; returns null on HTTP 404. */
async function offFetch(url: string, timeoutMs = REQUEST_TIMEOUT_MS): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: OFF_HEADERS, signal: controller.signal });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Open Food Facts: HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFromOpenFoodFacts(barcode: string, timeoutMs?: number): Promise<Product | null> {
  const json = await offFetch(`${OFF_PRODUCT_URL}/${encodeURIComponent(barcode)}.json`, timeoutMs);
  if (!json || json.status !== 1) return null;
  return parseOffProduct(barcode, json.product, i18n.language);
}

/** Text search in Open Food Facts. Throws on network / HTTP errors. */
export async function searchOpenFoodFacts(query: string): Promise<Product[]> {
  const q = query.trim();
  if (!q) return [];
  const url =
    `${OFF_SEARCH_URL}?search_terms=${encodeURIComponent(q)}` +
    `&search_simple=1&action=process&json=1&page_size=15&fields=${OFF_SEARCH_FIELDS}`;
  const json = await offFetch(url);
  const items: any[] = Array.isArray(json?.products) ? json.products : [];
  const out: Product[] = [];
  for (const item of items) {
    const parsed = parseOffProduct(String(item.code ?? ''), item, i18n.language);
    if (parsed) out.push(parsed);
  }
  return out;
}

// --- Cache refresh ---------------------------------------------------------
/**
 * Cached products saved before micronutrients existed (all NULL) or with only zeros for a week
 * are re-checked in Open Food Facts instead of being served from the stale cache.
 */
function needsMicroRefresh(p: Product): boolean {
  if (p.barcode.startsWith('custom-')) return false; // user-made, never in OFF
  if (microsNeverSet(p)) return true;
  return !hasMicros(p) && Date.now() - p.updated_at > STALE_ZERO_MS;
}

/** Returns the cached product with fresh micronutrients; falls back to the cache when offline. */
async function refreshMicros(local: Product): Promise<Product> {
  try {
    const remote = await fetchFromOpenFoodFacts(local.barcode, REFRESH_TIMEOUT_MS);
    const merged: Product = { ...local, updated_at: Date.now() };
    for (const m of MICROS) {
      // "checked, but OFF has nothing" is stored as 0 so the product is not re-fetched on every scan
      (merged as unknown as Record<string, number | null>)[m.field as string] =
        (remote?.[m.field] as number | null | undefined) ?? 0;
    }
    await saveProduct(merged);
    return merged;
  } catch {
    return local; // offline / timeout: use the cache, retry on the next scan
  }
}

// --- Public API -----------------------------------------------------------
/**
 * Handles one barcode read from the camera.
 * @param onAccepted called once the scan passes the duplicate guard
 *                   (use it for immediate haptic feedback).
 */
export async function processBarcode(
  barcode: string,
  onAccepted?: () => void,
): Promise<ScanResult> {
  if (!tryAcquire(barcode)) return { status: 'ignored' };
  onAccepted?.();

  try {
    const local = await getProductByBarcode(barcode);
    if (local) {
      const product = needsMicroRefresh(local) ? await refreshMicros(local) : local;
      return { status: 'found', product, source: 'local' };
    }

    const remote = await fetchFromOpenFoodFacts(barcode);
    if (!remote) return { status: 'not_found', barcode };

    await saveProduct(remote);
    return { status: 'found', product: remote, source: 'api' };
  } catch (e) {
    const code = e instanceof Error && e.name === 'AbortError' ? 'timeout' : 'failed';
    return { status: 'error', barcode, code };
  } finally {
    busy = false;
    lastAcceptedAt = Date.now(); // dedup window counts from the end of processing
  }
}
