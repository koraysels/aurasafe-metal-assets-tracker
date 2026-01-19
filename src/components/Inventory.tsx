'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import {
  createPurchase,
  createSafe,
  deletePurchase,
  deleteSafe,
  exportAllDecrypted,
  importFromJSON,
  listPurchasesBySafe,
  listSafes,
  Purchase,
  Safe,
  upsertPurchase,
  upsertSafe,
} from '../lib/db';
import { getFxRate, getSpot, perGramFromOunce } from '../lib/prices';
import { z } from 'zod';

export default function Inventory({
  keyMaterial,
  onLock,
}: {
  keyMaterial: CryptoKey;
  onLock: () => void;
}) {
  const [safes, setSafes] = useState<Safe[]>([]);
  const [currentSafe, setCurrentSafe] = useState<string | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [spot, setSpot] = useState<number>(0);
  const [currency, setCurrency] = useState<'USD' | 'EUR'>('USD');
  const [fxRates, setFxRates] = useState<Record<string, number>>({});
  const [pendingImageDataUrl, setPendingImageDataUrl] = useState<string | undefined>(undefined);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [assetSearch, setAssetSearch] = useState('');
  const [assetTypeFilter, setAssetTypeFilter] = useState('All');
  const [assetSort, setAssetSort] = useState('date-desc');
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [lastAssetDefaults, setLastAssetDefaults] = useState({ type: 'Coin', currency: 'USD' });
  const [editForm, setEditForm] = useState({
    name: '',
    date: '',
    type: 'Coin',
    weight: '',
    buyPrice: '',
    currency: 'USD',
    notes: '',
    link: '',
    imageDataUrl: '',
  });

  async function refreshSafes(selectFirstIfNeeded = true) {
    const s = await listSafes(keyMaterial);
    if (s.length === 0) {
      const safe = await createSafe(keyMaterial, 'Default', true);
      setSafes([safe]);
      setCurrentSafe(safe.id);
      return;
    }
    setSafes(s);
    if (selectFirstIfNeeded && !currentSafe) setCurrentSafe(s[0].id);
  }

  async function refreshPurchases(safeId: string) {
    const p = await listPurchasesBySafe(keyMaterial, safeId);
    setPurchases(p);
  }

  async function ensureSafeSelected() {
    if (currentSafe) return currentSafe;
    if (safes.length) {
      setCurrentSafe(safes[0].id);
      return safes[0].id;
    }
    const safe = await createSafe(keyMaterial, 'Default', true);
    setSafes([safe]);
    setCurrentSafe(safe.id);
    return safe.id;
  }

  useEffect(() => {
    (async () => {
      await refreshSafes(true);
    })();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!currentSafe) return;
    const stored = localStorage.getItem(`as_currency_${currentSafe}`);
    if (stored === 'USD' || stored === 'EUR') {
      setCurrency(stored);
    }
  }, [currentSafe]);

  useEffect(() => {
    (async () => {
      try {
        const sp = await getSpot(currency);
        setSpot(sp);
      } catch (error) {
        console.error(error);
      }
    })();
    if (typeof window !== 'undefined' && currentSafe) {
      localStorage.setItem(`as_currency_${currentSafe}`, currency);
    }
  }, [currency, currentSafe]);

  useEffect(() => {
    (async () => {
      try {
        const currencies = Array.from(new Set(purchases.map((p) => p.currency || currency)));
        const entries = await Promise.all(
          currencies.map(async (cur) => [cur, await getFxRate(cur, currency)] as const),
        );
        const next: Record<string, number> = {};
        for (const [cur, rate] of entries) next[cur] = rate;
        setFxRates(next);
      } catch (error) {
        console.error(error);
        setFxRates({ [currency]: 1 });
      }
    })();
  }, [purchases, currency]);

  useEffect(() => {
    if (currentSafe) refreshPurchases(currentSafe);
  }, [currentSafe]);

  async function addSafe() {
    const name = prompt('Safe name')?.trim();
    if (!name) return;
    await createSafe(keyMaterial, name, safes.length === 0);
    await refreshSafes(false);
  }

  async function renameSafe() {
    if (!currentSafe) return;
    const existing = safes.find((safe) => safe.id === currentSafe);
    const name = prompt('Safe name', existing?.name ?? '')?.trim();
    if (!name || !existing) return;
    await upsertSafe(keyMaterial, { ...existing, name });
    await refreshSafes(false);
  }

  const stats = useMemo(() => {
    const totalWeightG = purchases.reduce((s, p) => s + (p.weight || 0), 0);
    const totalBasis = purchases.reduce((s, p) => {
      const rate = fxRates[p.currency] ?? 1;
      return s + (p.buyPrice || 0) * rate;
    }, 0);
    const currentValue = perGramFromOunce(spot) * totalWeightG;
    const netProfit = currentValue - totalBasis;
    return { totalWeightG, totalBasis, currentValue, netProfit };
  }, [purchases, spot, fxRates]);

  function formatMoney(amount: number, code: string) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  const assetItems = useMemo(() => {
    const filtered = purchases.filter((p) => {
      const matchesType = assetTypeFilter === 'All' || p.type === assetTypeFilter;
      const search = assetSearch.trim().toLowerCase();
      if (!search) return matchesType;
      const haystack = `${p.name} ${p.notes ?? ''}`.toLowerCase();
      return matchesType && haystack.includes(search);
    });
    const enriched = filtered.map((p) => {
      const rate = fxRates[p.currency] ?? 1;
      const basis = (p.buyPrice || 0) * rate;
      const currentValue = perGramFromOunce(spot) * (p.weight || 0);
      const delta = currentValue - basis;
      return { purchase: p, basis, currentValue, delta };
    });
    return enriched.sort((a, b) => {
      switch (assetSort) {
        case 'date-asc':
          return (a.purchase.date || '').localeCompare(b.purchase.date || '');
        case 'date-desc':
          return (b.purchase.date || '').localeCompare(a.purchase.date || '');
        case 'name':
          return a.purchase.name.localeCompare(b.purchase.name);
        case 'profit-desc':
          return b.delta - a.delta;
        case 'profit-asc':
          return a.delta - b.delta;
        default:
          return 0;
      }
    });
  }, [purchases, assetTypeFilter, assetSearch, assetSort, fxRates, spot]);

  async function onExport() {
    const data = await exportAllDecrypted(keyMaterial);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `aurasafe-export-${new Date().toISOString().slice(0, 19)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function onImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      const schema = z.object({
        safes: z.array(
          z.object({ id: z.string().uuid(), name: z.string(), isDefault: z.boolean().optional() }),
        ),
        purchases: z.array(
          z.object({
            id: z.string().uuid(),
            safeId: z.string().uuid(),
            name: z.string(),
            date: z.string(),
            type: z.string(),
            weight: z.number(),
            buyPrice: z.number(),
            currency: z.string(),
            notes: z.string().optional(),
            link: z.string().url().optional(),
            imageDataUrl: z.string().optional(),
          }),
        ),
      });
      const parsed = schema.parse(JSON.parse(text));
      if (!confirm('This will overwrite your local data. Continue?')) return;
      await importFromJSON(keyMaterial, parsed);
      await refreshSafes();
      if (currentSafe) await refreshPurchases(currentSafe);
      alert('Import complete');
    };
    input.click();
  }

  async function onImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setPendingImageDataUrl(undefined);
      return;
    }
    const dataUrl = await resizeImageToDataUrl(file, 180);
    setPendingImageDataUrl(dataUrl);
  }

  function clearPendingImage() {
    setPendingImageDataUrl(undefined);
    if (imageInputRef.current) imageInputRef.current.value = '';
  }

  async function removePurchaseImage(purchase: Purchase) {
    await upsertPurchase(keyMaterial, { ...purchase, imageDataUrl: undefined });
    if (currentSafe) await refreshPurchases(currentSafe);
  }

  async function editPurchase(purchase: Purchase) {
    setEditingPurchase(purchase);
    setIsAssetModalOpen(true);
    setEditForm({
      name: purchase.name || '',
      date: purchase.date || new Date().toISOString().slice(0, 10),
      type: purchase.type || 'Coin',
      weight: String(purchase.weight ?? ''),
      buyPrice: String(purchase.buyPrice ?? ''),
      currency: purchase.currency || 'USD',
      notes: purchase.notes || '',
      link: purchase.link || '',
      imageDataUrl: purchase.imageDataUrl || '',
    });
  }

  function openAddAssetModal() {
    setEditingPurchase(null);
    setEditForm({
      name: '',
      date: new Date().toISOString().slice(0, 10),
      type: lastAssetDefaults.type,
      weight: '',
      buyPrice: '',
      currency: lastAssetDefaults.currency || currency,
      notes: '',
      link: '',
      imageDataUrl: '',
    });
    setIsAssetModalOpen(true);
  }

  async function onEditImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await resizeImageToDataUrl(file, 180);
    if (dataUrl) setEditForm((prev) => ({ ...prev, imageDataUrl: dataUrl }));
  }

  async function saveEdit() {
    const safeId = await ensureSafeSelected();
    if (!safeId) {
      alert('Please select a safe before saving.');
      return;
    }
    const nextWeight = Number(editForm.weight);
    const nextPrice = Number(editForm.buyPrice);
    if (!editForm.name.trim()) {
      alert('Please provide a purchase name.');
      return;
    }
    if (!Number.isFinite(nextWeight) || nextWeight <= 0) {
      alert('Weight must be greater than 0.');
      return;
    }
    if (!Number.isFinite(nextPrice) || nextPrice <= 0) {
      alert('Buy price must be greater than 0.');
      return;
    }
    if (editingPurchase) {
      await upsertPurchase(keyMaterial, {
        ...editingPurchase,
        name: editForm.name.trim(),
        date: editForm.date.trim(),
        type: editForm.type.trim(),
        weight: nextWeight,
        buyPrice: nextPrice,
        currency: editForm.currency.trim(),
        notes: editForm.notes.trim() || undefined,
        link: editForm.link.trim() || undefined,
        imageDataUrl: editForm.imageDataUrl || undefined,
      });
    } else {
      await createPurchase(keyMaterial, {
        safeId,
        name: editForm.name.trim(),
        date: editForm.date.trim(),
        type: editForm.type.trim(),
        weight: nextWeight,
        buyPrice: nextPrice,
        currency: editForm.currency.trim(),
        notes: editForm.notes.trim() || undefined,
        link: editForm.link.trim() || undefined,
        imageDataUrl: editForm.imageDataUrl || undefined,
      });
    }
    setLastAssetDefaults({ type: editForm.type.trim(), currency: editForm.currency.trim() });
    setEditingPurchase(null);
    setIsAssetModalOpen(false);
    await refreshPurchases(safeId);
  }

  async function resizeImageToDataUrl(file: File, maxSize: number) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(maxSize / bitmap.width, maxSize / bitmap.height, 1);
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    ctx.drawImage(bitmap, 0, 0, width, height);
    return canvas.toDataURL('image/webp', 0.9);
  }

  function renderFallbackIcon(type: string) {
    const baseClass = 'h-8 w-8 text-amber-400';
    if (type.toLowerCase() === 'coin') {
      return (
        <svg viewBox="0 0 32 32" className={baseClass} aria-hidden="true">
          <circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" strokeWidth="3" />
          <circle cx="16" cy="16" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    }
    if (type.toLowerCase() === 'jewelry') {
      return (
        <svg viewBox="0 0 32 32" className={baseClass} aria-hidden="true">
          <circle cx="16" cy="20" r="8" fill="none" stroke="currentColor" strokeWidth="3" />
          <polygon points="12,10 16,4 20,10" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    }
    return (
      <svg viewBox="0 0 32 32" className={baseClass} aria-hidden="true">
        <rect x="6" y="10" width="20" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="3" />
        <rect x="10" y="14" width="12" height="4" rx="1" fill="currentColor" />
      </svg>
    );
  }

  function renderPurchaseMedia(purchase: Purchase) {
    if (purchase.imageDataUrl) {
      return (
        <div className="flex flex-col items-start gap-2">
          <img
            src={purchase.imageDataUrl}
            alt={`${purchase.type} purchase`}
            className="h-10 w-10 rounded-md object-cover ring-1 ring-gray-700"
            loading="lazy"
          />
          <button
            type="button"
            onClick={() => removePurchaseImage(purchase)}
            className="text-xs text-gray-400 underline"
          >
            Remove image
          </button>
        </div>
      );
    }
    return renderFallbackIcon(purchase.type);
  }

  return (
    <div className="mx-auto max-w-4xl p-4">
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/aurasafe-logo.png" alt="AuraSafe" className="h-8 w-8" />
          <h1 className="text-2xl font-semibold">AuraSafe</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onLock}
            aria-label="Lock"
            className="rounded-md bg-gray-800 p-2 text-sm ring-1 ring-gray-700"
          >
            <Lock className="h-4 w-4" />
          </button>
          <button onClick={onExport} className="rounded-md bg-gray-800 px-3 py-1.5 text-sm ring-1 ring-gray-700">
            Export
          </button>
          <button onClick={onImport} className="rounded-md bg-gray-800 px-3 py-1.5 text-sm ring-1 ring-gray-700">
            Import
          </button>
        </div>
      </header>

      <section className="mb-6 rounded-lg border border-gray-800 bg-gray-900 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-400">Safe</label>
            <select
              value={currentSafe ?? ''}
              onChange={(e) => setCurrentSafe(e.target.value)}
              className="rounded-md bg-gray-800 px-3 py-1.5 ring-1 ring-gray-700"
            >
              {safes.map((safe) => (
                <option key={safe.id} value={safe.id}>
                  {safe.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as 'USD' | 'EUR')}
              className="rounded-md bg-gray-800 px-3 py-1.5 ring-1 ring-gray-700"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
            <button
              onClick={addSafe}
              className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-black"
            >
              New Safe
            </button>
            {currentSafe && (
              <button
                onClick={renameSafe}
                className="rounded-md bg-gray-800 px-3 py-1.5 text-sm ring-1 ring-gray-700"
              >
                Rename
              </button>
            )}
            {currentSafe && (
              <button
                onClick={async () => {
                  await deleteSafe(currentSafe);
                  setCurrentSafe(null);
                  await refreshSafes();
                }}
                className="rounded-md bg-red-600/80 px-3 py-1.5 text-sm"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <div className="text-xs uppercase text-gray-400">Basis</div>
          <div className="text-2xl font-semibold">{formatMoney(stats.totalBasis, currency)}</div>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <div className="text-xs uppercase text-gray-400">Current Value</div>
          <div className="text-2xl font-semibold">{formatMoney(stats.currentValue, currency)}</div>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <div className="text-xs uppercase text-gray-400">Net</div>
          <div
            className={`text-2xl font-semibold ${
              stats.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            <span className="inline-flex items-center gap-1">
              {stats.netProfit >= 0 ? (
                <svg viewBox="0 0 20 20" className="h-4 w-4 text-emerald-400" aria-hidden="true">
                  <path d="M10 4l5 6h-3v6H8v-6H5l5-6z" fill="currentColor" />
                </svg>
              ) : (
                <svg viewBox="0 0 20 20" className="h-4 w-4 text-red-400" aria-hidden="true">
                  <path d="M10 16l-5-6h3V4h4v6h3l-5 6z" fill="currentColor" />
                </svg>
              )}
              <span>{formatMoney(stats.netProfit, currency)}</span>
            </span>
          </div>
        </div>
      </section>

      <section className="mb-6 rounded-lg border border-gray-800 bg-gray-900 p-4 text-sm text-gray-300">
        Gold spot: {formatMoney(spot, currency)}/oz • {formatMoney(perGramFromOunce(spot), currency)}/g
      </section>

      <section className="mb-6 rounded-lg border border-gray-800 bg-gray-900 p-4">
        <h2 className="mb-3 font-medium">Assets</h2>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            value={assetSearch}
            onChange={(e) => setAssetSearch(e.target.value)}
            placeholder="Search name or notes"
            className="min-w-[220px] flex-1 rounded-md bg-gray-800 px-3 py-2 text-sm ring-1 ring-gray-700"
          />
          <select
            value={assetTypeFilter}
            onChange={(e) => setAssetTypeFilter(e.target.value)}
            className="rounded-md bg-gray-800 px-3 py-2 text-sm ring-1 ring-gray-700"
          >
            <option value="All">All</option>
            <option value="Coin">Coin</option>
            <option value="Bar">Bar</option>
            <option value="Jewelry">Jewelry</option>
          </select>
          <select
            value={assetSort}
            onChange={(e) => setAssetSort(e.target.value)}
            className="rounded-md bg-gray-800 px-3 py-2 text-sm ring-1 ring-gray-700"
          >
            <option value="date-desc">Date (newest)</option>
            <option value="date-asc">Date (oldest)</option>
            <option value="name">Name (A–Z)</option>
            <option value="profit-desc">Profit (high → low)</option>
            <option value="profit-asc">Profit (low → high)</option>
          </select>
        </div>
        <div className="grid gap-3 md:grid-cols-1">
          {assetItems.map(({ purchase: p, basis, currentValue, delta }) => {
            const deltaPct = basis > 0 ? (delta / basis) * 100 : 0;
            return (
              <div key={p.id} className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="pt-1">{renderPurchaseMedia(p)}</div>
                    <div>
                      <div className="text-sm text-gray-400">{p.type}</div>
                      <div className="text-lg font-semibold">{p.name}</div>
                      <div className="text-xs text-gray-500">
                        {p.date} • {p.weight} g
                      </div>
                    </div>
                  </div>
                  <div
                    className={`text-right text-sm font-semibold ${
                      delta >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    <div className="flex items-center justify-end gap-1">
                      {delta >= 0 ? (
                        <svg viewBox="0 0 20 20" className="h-4 w-4 text-emerald-400" aria-hidden="true">
                          <path d="M10 4l5 6h-3v6H8v-6H5l5-6z" fill="currentColor" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 20 20" className="h-4 w-4 text-red-400" aria-hidden="true">
                          <path d="M10 16l-5-6h3V4h4v6h3l-5 6z" fill="currentColor" />
                        </svg>
                      )}
                      <span>{formatMoney(delta, currency)}</span>
                    </div>
                    <div className="text-xs text-gray-500">{deltaPct.toFixed(2)}%</div>
                  </div>
                </div>
                <div className="mt-2 grid gap-2 text-sm text-gray-300 md:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase text-gray-500">Basis</div>
                    <div>{formatMoney(basis, currency)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-gray-500">Current Value</div>
                    <div>{formatMoney(currentValue, currency)}</div>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                  {p.link ? (
                    <a href={p.link} target="_blank" rel="noreferrer" className="text-brand underline">
                      View product
                    </a>
                  ) : (
                    <span />
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => editPurchase(p)}
                      className="rounded-md bg-gray-800 px-2 py-1 text-white ring-1 ring-gray-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={async () => {
                        await deletePurchase(p.id);
                        if (currentSafe) await refreshPurchases(currentSafe);
                      }}
                      className="rounded-md bg-red-600/80 px-2 py-1 text-white"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {!assetItems.length && (
            <div className="text-sm text-gray-500">No assets yet. Add your first purchase above.</div>
          )}
        </div>
      </section>

      <section className="mb-6 rounded-lg border border-gray-800 bg-gray-900 p-4">
        <button
          onClick={openAddAssetModal}
          className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-black"
        >
          <span className="text-lg leading-none">+</span>
          Add Asset
        </button>
      </section>

      <footer className="mt-6 text-center text-xs text-gray-500">
        Spot: {formatMoney(spot, currency)}/oz • Cached offline
      </footer>

      {isAssetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-xl border border-gray-800 bg-gray-900 p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {editingPurchase ? 'Edit Asset' : 'Add Asset'}
              </h3>
              <button
                onClick={() => {
                  setEditingPurchase(null);
                  setIsAssetModalOpen(false);
                }}
                className="rounded-md bg-gray-800 px-2 py-1 text-xs ring-1 ring-gray-700"
              >
                Close
              </button>
            </div>
          <div className="grid grid-cols-2 gap-3">
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Name"
                  className="col-span-2 rounded-md bg-gray-800 px-3 py-2 ring-1 ring-gray-700"
                />
              <input
                value={editForm.date}
                onChange={(e) => setEditForm((prev) => ({ ...prev, date: e.target.value }))}
                type="date"
                className="col-span-2 rounded-md bg-gray-800 px-3 py-2 ring-1 ring-gray-700"
              />
              <select
                value={editForm.type}
                onChange={(e) => setEditForm((prev) => ({ ...prev, type: e.target.value }))}
                className="rounded-md bg-gray-800 px-3 py-2 ring-1 ring-gray-700"
              >
                <option>Coin</option>
                <option>Bar</option>
                <option>Jewelry</option>
              </select>
              <input
                value={editForm.weight}
                onChange={(e) => setEditForm((prev) => ({ ...prev, weight: e.target.value }))}
                type="number"
                step="0.0001"
                min="0.0001"
                placeholder="Weight (g)"
                className="rounded-md bg-gray-800 px-3 py-2 ring-1 ring-gray-700"
              />
                <input
                  value={editForm.buyPrice}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, buyPrice: e.target.value }))}
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder={`Buy Price (${editForm.currency || currency})`}
                  className="rounded-md bg-gray-800 px-3 py-2 ring-1 ring-gray-700"
                />
              <select
                value={editForm.currency}
                onChange={(e) => setEditForm((prev) => ({ ...prev, currency: e.target.value }))}
                className="rounded-md bg-gray-800 px-3 py-2 ring-1 ring-gray-700"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
              <input
                value={editForm.notes}
                onChange={(e) => setEditForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Notes"
                className="col-span-2 rounded-md bg-gray-800 px-3 py-2 ring-1 ring-gray-700"
              />
              <input
                value={editForm.link}
                onChange={(e) => setEditForm((prev) => ({ ...prev, link: e.target.value }))}
                type="url"
                placeholder="Product link"
                className="col-span-2 rounded-md bg-gray-800 px-3 py-2 ring-1 ring-gray-700"
              />
              <div className="col-span-2 flex flex-col gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={onEditImageChange}
                  className="rounded-md bg-gray-800 px-3 py-2 ring-1 ring-gray-700"
                />
                {editForm.imageDataUrl && (
                  <div className="flex items-center gap-3">
                    <img
                      src={editForm.imageDataUrl}
                      alt="Preview"
                      className="h-10 w-10 rounded-md object-cover ring-1 ring-gray-700"
                    />
                    <button
                      type="button"
                      onClick={() => setEditForm((prev) => ({ ...prev, imageDataUrl: '' }))}
                      className="text-xs text-gray-400 underline"
                    >
                      Remove image
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => {
                  setEditingPurchase(null);
                  setIsAssetModalOpen(false);
                }}
                className="rounded-md bg-gray-800 px-3 py-2 text-sm ring-1 ring-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-black"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
