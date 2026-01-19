"use client";
import React, { useEffect, useRef } from 'react';
import type { Purchase } from '../lib/db';
import type { PricePoint } from '../lib/prices';
import { perGramFromOunce } from '../lib/prices';

export default function PortfolioChart({
  purchases,
  priceSeries,
  fxRates,
  spot,
}: {
  purchases: Purchase[];
  priceSeries: PricePoint[];
  fxRates: Record<string, number>;
  spot: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      const mod = await import('chart.js/auto');
      if (!isMounted) return;
      const Chart = mod.default;
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;
      const sorted = [...purchases].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      const labels: string[] = [];
      const basis: number[] = [];
      const currentVal: number[] = [];
      let cumBasis = 0;
      let cumWeight = 0;
      let purchaseIdx = 0;
      const series = priceSeries.length
        ? priceSeries
        : [{ date: new Date().toISOString().slice(0, 10), price: spot || 0 }];

      for (const point of series) {
        while (purchaseIdx < sorted.length && (sorted[purchaseIdx].date || '') <= point.date) {
          const p = sorted[purchaseIdx];
          const rate = fxRates[p.currency] ?? 1;
          cumBasis += Number(p.buyPrice || 0) * rate;
          cumWeight += Number(p.weight || 0);
          purchaseIdx += 1;
        }
        labels.push(point.date);
        basis.push(cumBasis);
        currentVal.push(cumWeight * perGramFromOunce(point.price));
      }
      if (chartRef.current) chartRef.current.destroy();
      chartRef.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Basis',
              data: basis,
              borderColor: '#94a3b8',
              backgroundColor: 'transparent',
              tension: 0,
              stepped: true,
            },
            {
              label: 'Current Value',
              data: currentVal,
              borderColor: '#34d399',
              backgroundColor: 'transparent',
              tension: 0,
              stepped: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#cbd5e1' } } },
          scales: {
            x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.1)' } },
            y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.1)' } },
          },
        },
      });
    })();
    return () => { isMounted = false; if (chartRef.current) chartRef.current.destroy(); };
  }, [purchases, priceSeries, fxRates, spot]);

  return <div className="h-64 w-full"><canvas ref={canvasRef} className="h-full w-full" /></div>;
}
