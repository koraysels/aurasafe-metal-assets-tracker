import Dexie, { Table } from 'dexie';
import { encryptJSON, decryptJSON } from './crypto';

export type Safe = { id: string; name: string; isDefault?: boolean };
export type Purchase = {
  id: string;
  safeId: string;
  name: string;
  metal?: 'Gold' | 'Silver' | string;
  date: string; // ISO
  type: 'Coin' | 'Bar' | 'Jewelry' | string;
  weight: number; // grams
  buyPrice: number;
  currency: 'USD' | 'EUR' | string;
  notes?: string;
  link?: string;
  imageDataUrl?: string;
};

type SafeRecord = { id: string; iv: string; data: string };
type PurchaseRecord = { id: string; safeId: string; iv: string; data: string };

type PriceCache = { id: string; price: number; timestamp: number; source: string; data?: string };

class AuraSafeDB extends Dexie {
  safes!: Table<SafeRecord, string>;
  purchases!: Table<PurchaseRecord, string>;
  priceCache!: Table<PriceCache, string>;
  constructor() {
    super('AuraSafeDB');
    this.version(1).stores({
      safes: 'id',
      purchases: 'id,safeId',
    });
    this.version(2).stores({
      priceCache: 'id'
    });
  }
}

export const db = new AuraSafeDB();

export async function upsertSafe(key: CryptoKey, safe: Safe) {
  const payload = await encryptJSON(key, safe);
  await db.safes.put({ id: safe.id, iv: payload.iv, data: payload.ciphertext });
}

export async function listSafes(key: CryptoKey): Promise<Safe[]> {
  const rows = await db.safes.toArray();
  const out: Safe[] = [];
  for (const r of rows) {
    try { out.push(await decryptJSON<Safe>(key, r.iv, r.data)); } catch {}
  }
  return out;
}

export async function deleteSafe(id: string) {
  await db.safes.delete(id);
  await db.purchases.where('safeId').equals(id).delete();
}

export async function createSafe(key: CryptoKey, name: string, isDefault?: boolean): Promise<Safe> {
  const safe: Safe = { id: crypto.randomUUID(), name, isDefault: !!isDefault };
  await upsertSafe(key, safe);
  return safe;
}

export async function upsertPurchase(key: CryptoKey, p: Purchase) {
  const payload = await encryptJSON(key, p);
  await db.purchases.put({ id: p.id, safeId: p.safeId, iv: payload.iv, data: payload.ciphertext });
}

export async function createPurchase(key: CryptoKey, p: Omit<Purchase, 'id'>): Promise<Purchase> {
  const full: Purchase = { ...p, id: crypto.randomUUID() };
  await upsertPurchase(key, full);
  return full;
}

export async function listPurchasesBySafe(key: CryptoKey, safeId: string): Promise<Purchase[]> {
  const rows = await db.purchases.where('safeId').equals(safeId).toArray();
  const out: Purchase[] = [];
  for (const r of rows) {
    try { out.push(await decryptJSON<Purchase>(key, r.iv, r.data)); } catch {}
  }
  return out.sort((a,b)=> (a.date || '').localeCompare(b.date || ''));
}

export async function deletePurchase(id: string) {
  await db.purchases.delete(id);
}

export async function exportAllDecrypted(key: CryptoKey) {
  const safes = await listSafes(key);
  const purchases: Purchase[] = [];
  for (const s of safes) {
    purchases.push(...(await listPurchasesBySafe(key, s.id)));
  }
  return { safes, purchases };
}

export async function importFromJSON(key: CryptoKey, data: { safes: Safe[]; purchases: Purchase[] }) {
  await db.transaction('rw', db.safes, db.purchases, async () => {
    await db.safes.clear();
    await db.purchases.clear();
    for (const s of data.safes) await upsertSafe(key, s);
    for (const p of data.purchases) await upsertPurchase(key, p);
  });
}
