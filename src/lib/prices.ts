import { Convert } from 'easy-currencies';
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

export type SpotPriceData = {
  price: number;
  timestamp: number;
  source: string;
};

export async function getSpot(metal: 'Gold' | 'Silver' | string, currency = 'USD', forceRefresh = false): Promise<SpotPriceData> {
  const normalized = currency.toUpperCase();
  const metalKey = (metal || 'Gold').toLowerCase();
  const asset = metalKey === 'silver' ? 'XAG' : 'PAXG';
  const cacheKey = `current_${asset}_${normalized}`;
  const cached = await db.priceCache.get(cacheKey);
  const fiveMin = 5 * 60 * 1000;
  if (!forceRefresh && cached && Date.now() - cached.timestamp < fiveMin) {
    return {
      price: cached.price,
      timestamp: cached.timestamp,
      source: cached.source,
    };
  }

  try {
    const resp = await fetch(`https://api.coinbase.com/v2/prices/${asset}-${normalized}/spot`, {
      cache: 'no-store',
    });
    const json = await resp.json();
    const amount = Number(json?.data?.amount);
    if (!isFinite(amount) || amount <= 0) throw new Error('Bad price');
    const price = amount;
    const timestamp = Date.now();
    const source = `Coinbase-${asset}-${normalized}`;
    await db.priceCache.put({
      id: cacheKey,
      price,
      timestamp,
      source,
    });
    return { price, timestamp, source };
  } catch (e) {
    if (cached) {
      return {
        price: cached.price,
        timestamp: cached.timestamp,
        source: cached.source,
      };
    }
    const fallbackPrice = metalKey === 'silver' ? 25 : 1900;
    return {
      price: fallbackPrice,
      timestamp: Date.now(),
      source: 'Fallback',
    };
  }
}

export async function getFxRate(from: string, to: string) {
  if (from.toUpperCase() === to.toUpperCase()) return 1;
  const base = from.toUpperCase();
  const target = to.toUpperCase();
  const cacheKey = `fx_${base}`;
  const cached = await getCachedJson<{ rates: Record<string, number> }>(cacheKey, 12 * 60 * 60 * 1000);
  let rates = cached?.rates;

  if (!rates) {
    try {
      const convert = await Convert().from(base).fetch();
      rates = convert?.rates as Record<string, number>;
      if (rates) await setCachedJson(cacheKey, { rates }, `easy-currencies-${base}`);
    } catch {
      rates = undefined;
    }
  }

  const rate = rates ? Number(rates[target]) : NaN;
  if (isFinite(rate) && rate > 0) return rate;
  return NaN;
}

export function perGramFromOunce(perOunce: number) {
  return perOunce / 31.1034768;
}

export type HistoricalPrice = {
  date: string;
  price: number;
};

export async function getHistoricalPrices(
  metal: 'Gold' | 'Silver',
  currency: string,
  days: number = 90
): Promise<HistoricalPrice[]> {
  const metalCode = metal === 'Gold' ? 'XAU' : 'XAG';
  const cacheKey = `historical_${metalCode}_${currency}_${days}d`;

  const cached = await getCachedJson<HistoricalPrice[]>(cacheKey, 24 * 60 * 60 * 1000);
  if (cached) return cached;

  try {
    // Use Netlify function to bypass CORS
    const isLocalhost =
      typeof globalThis !== 'undefined' &&
      typeof globalThis.location !== 'undefined' &&
      globalThis.location.hostname === 'localhost';

    const apiUrl = isLocalhost
      ? `http://localhost:8888/.netlify/functions/historical-prices?metal=${metalCode}&currency=${currency}&weight_unit=g`
      : `/.netlify/functions/historical-prices?metal=${metalCode}&currency=${currency}&weight_unit=g`;

    const resp = await fetch(apiUrl, { cache: 'no-store' });
    const json = await resp.json();

    if (!json || !Array.isArray(json)) {
      throw new Error('Invalid response');
    }

    const prices: HistoricalPrice[] = json
      .slice(-days)
      .map((item: any) => ({
        date: item.date,
        price: Number(item.price),
      }))
      .filter((item) => item.date && isFinite(item.price));

    if (prices.length > 0) {
      await setCachedJson(cacheKey, prices, `GoldBroker-${metalCode}-${currency}`);
    }

    return prices;
  } catch (e) {
    console.error('Failed to fetch historical prices:', e);
    return [];
  }
}
