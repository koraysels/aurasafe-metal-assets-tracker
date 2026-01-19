import { db } from './db';

async function getCachedJson<T>(key: string, maxAgeMs: number) {
  const cached = await db.priceCache.get(key);
  if (!cached || !cached.data) return null;
  if (Date.now() - cached.timestamp > maxAgeMs) return null;
  try {
    return JSON.parse(cached.data) as T;
  } catch {
    return null;
  }
}

async function setCachedJson(key: string, data: unknown, source: string) {
  await db.priceCache.put({
    id: key,
    price: 0,
    timestamp: Date.now(),
    source,
    data: JSON.stringify(data),
  });
}

export async function getSpot(currency = 'USD', forceRefresh = false): Promise<number> {
  const normalized = currency.toUpperCase();
  const cacheKey = `current_gold_${normalized}`;
  const cached = await db.priceCache.get(cacheKey);
  const fiveMin = 5 * 60 * 1000;
  if (!forceRefresh && cached && Date.now() - cached.timestamp < fiveMin) return cached.price;

  try {
    const resp = await fetch(`https://api.coinbase.com/v2/prices/PAXG-${normalized}/spot`, {
      cache: 'no-store',
    });
    const json = await resp.json();
    const amount = Number(json?.data?.amount);
    if (!isFinite(amount) || amount <= 0) throw new Error('Bad price');
    const price = amount;
    await db.priceCache.put({
      id: cacheKey,
      price,
      timestamp: Date.now(),
      source: `Coinbase-PAXG-${normalized}`,
    });
    return price;
  } catch (e) {
    if (cached) return cached.price;
    return 1900;
  }
}

export async function getFxRate(from: string, to: string) {
  if (from.toUpperCase() === to.toUpperCase()) return 1;
  const base = from.toUpperCase();
  const target = to.toUpperCase();
  const cacheKey = `fx_${base}`;
  const cached = await getCachedJson<Record<string, string>>(cacheKey, 12 * 60 * 60 * 1000);
  let rates = cached;

  if (!rates) {
    try {
      const resp = await fetch(`https://api.coinbase.com/v2/exchange-rates?currency=${base}`, {
        cache: 'no-store',
      });
      const json = await resp.json();
      rates = json?.data?.rates || null;
      if (rates) await setCachedJson(cacheKey, rates, `Coinbase-FX-${base}`);
    } catch {
      rates = null;
    }
  }

  const rate = rates ? Number(rates[target]) : NaN;
  if (isFinite(rate) && rate > 0) return rate;
  return base === 'USD' && target === 'EUR' ? 0.9 : 1;
}

export function perGramFromOunce(perOunce: number) {
  return perOunce / 31.1034768;
}
