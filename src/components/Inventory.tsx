'use client';
import { useEffect, useMemo, useState } from 'react';
import { saveAs } from 'file-saver';
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
import { getFxRate, getSpot, perGramFromOunce, SpotPriceData, getHistoricalPrices, HistoricalPrice } from '../lib/prices';
import { z } from 'zod';
import ThemeToggle from './theme-toggle';
import { getBrowserStorage, getDocument } from '../lib/utils';
import ValueChart from './ValueChart';
import { Button, buttonVariants } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ScrollArea } from './ui/scroll-area';

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
  const [spotByMetal, setSpotByMetal] = useState<Record<string, SpotPriceData>>({
    Gold: { price: 0, timestamp: Date.now(), source: '' },
    Silver: { price: 0, timestamp: Date.now(), source: '' },
  });
  const [currency, setCurrency] = useState<'USD' | 'EUR'>('USD');
  const [fxRates, setFxRates] = useState<Record<string, number>>({});
  const [historicalPrices, setHistoricalPrices] = useState<{ gold: HistoricalPrice[]; silver: HistoricalPrice[] }>({
    gold: [],
    silver: [],
  });
  const [assetSearch, setAssetSearch] = useState('');
  const [assetTypeFilter, setAssetTypeFilter] = useState('All');
  const [assetSort, setAssetSort] = useState('date-desc');
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [isSafeModalOpen, setIsSafeModalOpen] = useState(false);
  const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false);
  const [safeModalMode, setSafeModalMode] = useState<'create' | 'rename'>('create');
  const [safeName, setSafeName] = useState('');
  const [safeError, setSafeError] = useState('');
  const [assetError, setAssetError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [pendingImportData, setPendingImportData] = useState<{
    safes: Safe[];
    purchases: Purchase[];
  } | null>(null);
  const [lastAssetDefaults, setLastAssetDefaults] = useState({
    type: 'Coin',
    currency: 'USD',
    metal: 'Gold',
  });
  const [editForm, setEditForm] = useState({
    name: '',
    date: '',
    metal: 'Gold',
    type: 'Coin',
    weight: '',
    buyPrice: '',
    currency: 'USD',
    isGift: false,
    notes: '',
    link: '',
    imageDataUrl: '',
  });

  function readValue(target: EventTarget | null) {
    const value = (target as { value?: string } | null)?.value;
    return typeof value === 'string' ? value : '';
  }

  function readChecked(target: EventTarget | null) {
    return Boolean((target as { checked?: boolean } | null)?.checked);
  }

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
    const storage = getBrowserStorage();
    if (!storage) return;
    if (!currentSafe) return;
    const stored = storage.getItem(`as_currency_${currentSafe}`);
    if (stored === 'USD' || stored === 'EUR') {
      setCurrency(stored);
    }
  }, [currentSafe]);

  useEffect(() => {
    (async () => {
      try {
        const goldSpot = await getSpot('Gold', currency);
        const silverSpot = await getSpot('Silver', currency);
        setSpotByMetal({ Gold: goldSpot, Silver: silverSpot });
      } catch (error) {
        console.error(error);
      }
    })();
    if (currentSafe) {
      const storage = getBrowserStorage();
      storage?.setItem(`as_currency_${currentSafe}`, currency);
    }
  }, [currency, currentSafe]);

  useEffect(() => {
    (async () => {
      try {
        const [goldPrices, silverPrices] = await Promise.all([
          getHistoricalPrices('Gold', currency, 90),
          getHistoricalPrices('Silver', currency, 90),
        ]);
        setHistoricalPrices({ gold: goldPrices, silver: silverPrices });
      } catch (error) {
        console.error('Failed to fetch historical prices:', error);
        setHistoricalPrices({ gold: [], silver: [] });
      }
    })();
  }, [currency]);

  useEffect(() => {
    (async () => {
      try {
        const currencies = Array.from(new Set(purchases.map((p) => p.currency || currency)));
        const entries = await Promise.all(
          currencies.map(async (cur) => [cur, await getFxRate(cur, currency)] as const),
        );
        const next: Record<string, number> = {};
        next[currency] = 1;
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
    setSafeModalMode('create');
    setSafeName('');
    setSafeError('');
    setIsSafeModalOpen(true);
  }

  async function renameSafe() {
    if (!currentSafe) return;
    const existing = safes.find((safe) => safe.id === currentSafe);
    setSafeModalMode('rename');
    setSafeName(existing?.name ?? '');
    setSafeError('');
    setIsSafeModalOpen(true);
  }

  async function saveSafe() {
    const name = safeName.trim();
    if (!name) {
      setSafeError('Please provide a safe name.');
      return;
    }
    if (safeModalMode === 'create') {
      await createSafe(keyMaterial, name, safes.length === 0);
    } else if (currentSafe) {
      const existing = safes.find((safe) => safe.id === currentSafe);
      if (existing) await upsertSafe(keyMaterial, { ...existing, name });
    }
    setIsSafeModalOpen(false);
    setSafeError('');
    await refreshSafes(false);
  }

  const stats = useMemo(() => {
    let missingFx = 0;
    let goldWeight = 0;
    let silverWeight = 0;
    const totals = purchases.reduce(
      (acc, p) => {
        const hasPrice = (p.buyPrice || 0) > 0;
        const rate = p.currency === currency ? 1 : fxRates[p.currency];
        const rateValid = Number.isFinite(rate) && rate > 0;
        if (hasPrice && !rateValid) {
          missingFx += 1;
          return acc;
        }
        const metal = p.metal || 'Gold';
        const metalSpot = spotByMetal[metal]?.price ?? spotByMetal.Gold?.price ?? 0;
        acc.basis += hasPrice ? (p.buyPrice || 0) * (rateValid ? rate : 1) : 0;
        acc.current += perGramFromOunce(metalSpot) * (p.weight || 0);
        if (metal === 'Gold') {
          goldWeight += p.weight || 0;
        } else if (metal === 'Silver') {
          silverWeight += p.weight || 0;
        }
        return acc;
      },
      { basis: 0, current: 0 },
    );
    const netProfit = totals.current - totals.basis;
    const profitPercent = totals.basis > 0 ? (netProfit / totals.basis) * 100 : 0;
    return {
      totalBasis: totals.basis,
      currentValue: totals.current,
      netProfit,
      profitPercent,
      goldWeight,
      silverWeight,
      missingFx,
    };
  }, [purchases, spotByMetal, fxRates, currency]);

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
      const rate = fxRates[p.currency];
      const rateValid = p.currency === currency || (Number.isFinite(rate) && rate > 0);
      const appliedRate = p.currency === currency ? 1 : rate;
      const basis = rateValid ? (p.buyPrice || 0) * (appliedRate || 1) : 0;
      const metal = p.metal || 'Gold';
      const metalSpot = spotByMetal[metal]?.price ?? spotByMetal.Gold?.price ?? 0;
      const currentValue = perGramFromOunce(metalSpot) * (p.weight || 0);
      const delta = currentValue - basis;
      return { purchase: p, basis, currentValue, delta, rateValid };
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
  }, [purchases, assetTypeFilter, assetSearch, assetSort, fxRates, spotByMetal]);

  async function onExport() {
    const data = await exportAllDecrypted(keyMaterial);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    saveAs(blob, `aurasafe-export-${new Date().toISOString().slice(0, 19)}.json`);
  }

  async function onImportFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const target = e.target as unknown as { files?: FileList | null; value?: string };
    const file = target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const schema = z.object({
      safes: z.array(z.object({ id: z.string().uuid(), name: z.string(), isDefault: z.boolean().optional() })),
      purchases: z.array(
        z.object({
          id: z.string().uuid(),
          safeId: z.string().uuid(),
          name: z.string(),
          metal: z.string().optional(),
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
    setPendingImportData(parsed);
    setIsImportConfirmOpen(true);
    if (typeof target.value === 'string') target.value = '';
  }

  async function confirmImport() {
    if (!pendingImportData) return;
    await importFromJSON(keyMaterial, pendingImportData);
    await refreshSafes();
    if (currentSafe) await refreshPurchases(currentSafe);
    setIsImportConfirmOpen(false);
    setPendingImportData(null);
    setStatusMessage('Import complete.');
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
      metal: purchase.metal || 'Gold',
      type: purchase.type || 'Coin',
      weight: String(purchase.weight ?? ''),
      buyPrice: String(purchase.buyPrice ?? ''),
      currency: purchase.currency || 'USD',
      isGift: !purchase.buyPrice,
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
      metal: lastAssetDefaults.metal || 'Gold',
      type: lastAssetDefaults.type,
      weight: '',
      buyPrice: '',
      currency: lastAssetDefaults.currency || currency,
      isGift: false,
      notes: '',
      link: '',
      imageDataUrl: '',
    });
    setIsAssetModalOpen(true);
  }

  async function onEditImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const target = e.target as unknown as { files?: FileList | null };
    const file = target.files?.[0];
    if (!file) return;
    const dataUrl = await resizeImageToDataUrl(file, 180);
    if (dataUrl) setEditForm((prev) => ({ ...prev, imageDataUrl: dataUrl }));
  }

  async function saveEdit() {
    const safeId = await ensureSafeSelected();
    if (!safeId) {
      setAssetError('Please select a safe before saving.');
      return;
    }
    const nextWeight = Number(editForm.weight);
    const nextPrice = editForm.isGift ? 0 : Number(editForm.buyPrice);
    if (!editForm.name.trim()) {
      setAssetError('Please provide a purchase name.');
      return;
    }
    if (!Number.isFinite(nextWeight) || nextWeight <= 0) {
      setAssetError('Weight must be greater than 0.');
      return;
    }
    if (!editForm.isGift && (!Number.isFinite(nextPrice) || nextPrice <= 0)) {
      setAssetError('Buy price must be greater than 0.');
      return;
    }
    if (editingPurchase) {
      await upsertPurchase(keyMaterial, {
        ...editingPurchase,
        name: editForm.name.trim(),
        date: editForm.date.trim(),
        metal: editForm.metal.trim(),
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
        metal: editForm.metal.trim(),
        type: editForm.type.trim(),
        weight: nextWeight,
        buyPrice: nextPrice,
        currency: editForm.currency.trim(),
        notes: editForm.notes.trim() || undefined,
        link: editForm.link.trim() || undefined,
        imageDataUrl: editForm.imageDataUrl || undefined,
      });
    }
    setLastAssetDefaults({
      type: editForm.type.trim(),
      currency: editForm.currency.trim(),
      metal: editForm.metal.trim(),
    });
    setEditingPurchase(null);
    setIsAssetModalOpen(false);
    setAssetError('');
    await refreshPurchases(safeId);
  }

  async function resizeImageToDataUrl(file: File, maxSize: number) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(maxSize / bitmap.width, maxSize / bitmap.height, 1);
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const doc = getDocument();
    if (!doc) return undefined;
    const canvas = doc.createElement('canvas');
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
      <input
        id="import-input"
        type="file"
        accept="application/json"
        onChange={onImportFileChange}
        className="hidden"
      />
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/aurasafe-logo.png" alt="AuraSafe" className="h-8 w-8" />
          <h1 className="text-2xl font-semibold">AuraSafe</h1>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="outline" size="icon" onClick={onLock} aria-label="Lock">
            <Lock className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={onExport}>
            Export
          </Button>
          <label htmlFor="import-input" className={buttonVariants({ variant: 'outline' })}>
            Import
          </label>
        </div>
      </header>

      <Card className="mb-6">
        <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Label>Safe</Label>
            <select
              value={currentSafe ?? ''}
              onChange={(e) => setCurrentSafe(readValue(e.target))}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              {safes.map((safe) => (
                <option key={safe.id} value={safe.id}>
                  {safe.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Label>Currency</Label>
            <select
              value={currency}
              onChange={(e) => {
                const value = readValue(e.target);
                if (value === 'USD' || value === 'EUR') setCurrency(value);
              }}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
            <Button onClick={addSafe}>New Safe</Button>
            {currentSafe && (
              <Button variant="outline" onClick={renameSafe}>
                Rename
              </Button>
            )}
            {currentSafe && (
              <Button
                variant="destructive"
                onClick={async () => {
                  await deleteSafe(currentSafe);
                  setCurrentSafe(null);
                  await refreshSafes();
                }}
              >
                Delete
              </Button>
            )}
          </div>
        </div>
        </CardContent>
      </Card>

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Basis</div>
          <div className="text-2xl font-semibold">{formatMoney(stats.totalBasis, currency)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Current Value</div>
          <div className="text-2xl font-semibold">{formatMoney(stats.currentValue, currency)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Net</div>
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
            <div className="mt-1 text-sm font-normal text-muted-foreground">
              {stats.profitPercent.toFixed(2)}%
            </div>
          </div>
          </CardContent>
        </Card>
      </section>

      {stats.missingFx > 0 && (
        <Card className="mb-6 border-amber-500/30">
          <CardContent className="p-3 text-xs text-amber-400">
            Some assets use currencies without a current FX rate. Their basis is shown in the
            original currency until rates update.
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardContent className="p-4 text-sm text-muted-foreground">
          <div>
            Gold spot: {formatMoney(spotByMetal.Gold?.price || 0, currency)}/oz •{' '}
            {formatMoney(perGramFromOunce(spotByMetal.Gold?.price || 0), currency)}/g
            {spotByMetal.Gold?.timestamp && (
              <span className="ml-2 text-[10px] text-muted-foreground">
                (as of {new Date(spotByMetal.Gold.timestamp).toLocaleString()})
              </span>
            )}
          </div>
          <div>
            Silver spot: {formatMoney(spotByMetal.Silver?.price || 0, currency)}/oz •{' '}
            {formatMoney(perGramFromOunce(spotByMetal.Silver?.price || 0), currency)}/g
            {spotByMetal.Silver?.timestamp && (
              <span className="ml-2 text-[10px] text-muted-foreground">
                (as of {new Date(spotByMetal.Silver.timestamp).toLocaleString()})
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardContent className="p-4">
          <ValueChart
            goldPrices={historicalPrices.gold}
            silverPrices={historicalPrices.silver}
            goldWeight={stats.goldWeight}
            silverWeight={stats.silverWeight}
            currency={currency}
          />
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle>Assets</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Input
            value={assetSearch}
            onChange={(e) => setAssetSearch(readValue(e.target))}
            placeholder="Search name or notes"
            className="min-w-[220px] flex-1"
          />
          <select
            value={assetTypeFilter}
            onChange={(e) => setAssetTypeFilter(readValue(e.target))}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="All">All</option>
            <option value="Coin">Coin</option>
            <option value="Bar">Bar</option>
            <option value="Jewelry">Jewelry</option>
          </select>
          <select
            value={assetSort}
            onChange={(e) => setAssetSort(readValue(e.target))}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="date-desc">Date (newest)</option>
            <option value="date-asc">Date (oldest)</option>
            <option value="name">Name (A–Z)</option>
            <option value="profit-desc">Profit (high → low)</option>
            <option value="profit-asc">Profit (low → high)</option>
          </select>
        </div>
        <ScrollArea className="max-h-[520px]">
          <div className="grid gap-3 pr-2">
            {assetItems.map(({ purchase: p, basis, currentValue, delta, rateValid }) => {
              const deltaPct = rateValid && basis > 0 ? (delta / basis) * 100 : 0;
              return (
                <Card key={p.id} className="bg-muted/30">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="pt-1">{renderPurchaseMedia(p)}</div>
                        <div>
                          <div className="text-sm text-muted-foreground">
                            {(p.metal || 'Gold')} • {p.type}
                          </div>
                          <div className="text-lg font-semibold">{p.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {p.date} • {p.weight} g
                          </div>
                        </div>
                      </div>
                      <div
                        className={`text-right text-sm font-semibold ${
                          delta >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {rateValid ? (
                          <>
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
                          </>
                        ) : (
                          <div className="text-xs text-amber-400">FX pending</div>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 grid gap-2 text-sm text-muted-foreground md:grid-cols-3">
                      <div>
                        <div className="text-xs uppercase text-muted-foreground">Basis</div>
                        <div>
                          {p.buyPrice ? formatMoney(basis, rateValid ? currency : p.currency) : 'Gifted'}
                          {!rateValid && p.buyPrice ? (
                            <span className="ml-2 text-[10px] text-amber-400">FX pending</span>
                          ) : null}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs uppercase text-muted-foreground">Current Value</div>
                        <div>{formatMoney(currentValue, currency)}</div>
                      </div>
                      <div className="flex items-end justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => editPurchase(p)}>
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={async () => {
                            await deletePurchase(p.id);
                            if (currentSafe) await refreshPurchases(currentSafe);
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                    {p.notes && (
                      <details className="mt-2 text-xs text-muted-foreground">
                        <summary className="cursor-pointer">
                          Notes:{' '}
                          <span className="inline-block max-w-[260px] truncate align-bottom">
                            {p.notes}
                          </span>
                        </summary>
                        <div className="mt-1 break-words">{p.notes}</div>
                      </details>
                    )}
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      {p.link ? (
                        <a href={p.link} target="_blank" rel="noreferrer" className="text-brand underline">
                          View product
                        </a>
                      ) : (
                        <span />
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {!assetItems.length && (
              <Card className="bg-muted/30">
                <CardContent className="p-6 text-center">
                  <div className="text-sm text-muted-foreground">Add your first asset.</div>
                  <div className="mt-3 flex justify-center">
                    <Button onClick={openAddAssetModal}>
                      <span className="text-lg leading-none">+</span>
                      Add Asset
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardContent className="p-4">
          <Button onClick={openAddAssetModal}>
            <span className="text-lg leading-none">+</span>
            Add Asset
          </Button>
        </CardContent>
      </Card>

      {statusMessage && (
        <Card className="mb-6 border-emerald-500/30">
          <CardContent className="p-3 text-xs text-emerald-400">{statusMessage}</CardContent>
        </Card>
      )}

      <footer className="mt-6 text-center text-xs text-gray-500">
        Spot: {formatMoney(spotByMetal.Gold?.price || 0, currency)}/oz • Cached offline
      </footer>

      <Dialog
        open={isAssetModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEditingPurchase(null);
          }
          setIsAssetModalOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPurchase ? 'Edit Asset' : 'Add Asset'}</DialogTitle>
          </DialogHeader>
          {assetError && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {assetError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-2">
              <Label>Name</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((prev) => ({ ...prev, name: readValue(e.target) }))}
                placeholder="Name"
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Date</Label>
              <Input
                value={editForm.date}
                onChange={(e) => setEditForm((prev) => ({ ...prev, date: readValue(e.target) }))}
                type="date"
              />
            </div>
            <div className="space-y-2">
              <Label>Metal</Label>
              <select
                value={editForm.metal}
                onChange={(e) => setEditForm((prev) => ({ ...prev, metal: readValue(e.target) }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option>Gold</option>
                <option>Silver</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <select
                value={editForm.type}
                onChange={(e) => setEditForm((prev) => ({ ...prev, type: readValue(e.target) }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option>Coin</option>
                <option>Bar</option>
                <option>Jewelry</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Weight (g)</Label>
              <Input
                value={editForm.weight}
                onChange={(e) => setEditForm((prev) => ({ ...prev, weight: readValue(e.target) }))}
                type="number"
                step="0.0001"
                min="0.0001"
              />
            </div>
            <div className="space-y-2">
              <Label>Buy Price</Label>
              <Input
                value={editForm.buyPrice}
                onChange={(e) => setEditForm((prev) => ({ ...prev, buyPrice: readValue(e.target) }))}
                type="number"
                step="0.01"
                min="0.01"
                placeholder={`Buy Price (${editForm.currency || currency})`}
                disabled={editForm.isGift}
              />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <select
                value={editForm.currency}
                onChange={(e) => setEditForm((prev) => ({ ...prev, currency: readValue(e.target) }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            <div className="col-span-2 flex items-center gap-2 text-sm text-muted-foreground">
              <input
                id="gifted"
                type="checkbox"
                checked={editForm.isGift}
                onChange={(e) => setEditForm((prev) => ({ ...prev, isGift: readChecked(e.target) }))}
                className="h-4 w-4 rounded border border-input"
              />
              <Label htmlFor="gifted">Gifted / no purchase price</Label>
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Notes</Label>
              <Input
                value={editForm.notes}
                onChange={(e) => setEditForm((prev) => ({ ...prev, notes: readValue(e.target) }))}
                placeholder="Notes"
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Product link</Label>
              <Input
                value={editForm.link}
                onChange={(e) => setEditForm((prev) => ({ ...prev, link: readValue(e.target) }))}
                type="url"
                placeholder="Product link"
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Image</Label>
              <Input type="file" accept="image/*" onChange={onEditImageChange} />
              {editForm.imageDataUrl && (
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <img
                    src={editForm.imageDataUrl}
                    alt="Preview"
                    className="h-10 w-10 rounded-md object-cover ring-1 ring-border"
                  />
                  <Button variant="ghost" size="sm" onClick={() => setEditForm((prev) => ({ ...prev, imageDataUrl: '' }))}>
                    Remove image
                  </Button>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => setIsAssetModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveEdit}>{editingPurchase ? 'Save' : 'Add'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSafeModalOpen} onOpenChange={setIsSafeModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{safeModalMode === 'create' ? 'New Safe' : 'Rename Safe'}</DialogTitle>
          </DialogHeader>
          {safeError && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {safeError}
            </div>
          )}
          <div className="space-y-2">
            <Label>Safe name</Label>
            <Input value={safeName} onChange={(e) => setSafeName(readValue(e.target))} placeholder="Safe name" />
          </div>
          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => setIsSafeModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveSafe}>{safeModalMode === 'create' ? 'Create' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isImportConfirmOpen} onOpenChange={setIsImportConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Overwrite local data?</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            Importing will replace your current safes and purchases.
          </div>
          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => setIsImportConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmImport}>Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
