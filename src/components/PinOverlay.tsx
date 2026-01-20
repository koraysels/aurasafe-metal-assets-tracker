'use client';
import React, { useMemo, useState } from 'react';
import { useTheme } from 'next-themes';
import ThemeToggle from './theme-toggle';

export default function PinOverlay({ mode, onUnlock }: { mode: 'setup' | 'unlock'; onUnlock: (pin: string, confirmPin?: string) => Promise<void>; }) {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';
  const chartVars = useMemo(() => ({
    ['--grid-strong' as string]: isDark ? 'rgba(148,163,184,0.18)' : 'rgba(15,23,42,0.12)',
    ['--grid-soft' as string]: isDark ? 'rgba(148,163,184,0.04)' : 'rgba(15,23,42,0.04)',
    ['--line-start' as string]: isDark ? 'rgba(52,211,153,0.0)' : 'rgba(16,185,129,0.0)',
    ['--line-mid' as string]: isDark ? 'rgba(52,211,153,0.8)' : 'rgba(5,150,105,0.85)',
    ['--line-end' as string]: isDark ? 'rgba(56,189,248,0.9)' : 'rgba(2,132,199,0.9)',
    ['--line-alt' as string]: isDark ? 'rgba(56,189,248,0.35)' : 'rgba(2,132,199,0.35)',
    ['--bg-tint' as string]: isDark ? 'rgba(2,6,23,0.2)' : 'rgba(226,232,240,0.45)',
  }), [isDark]);

  function readValue(target: EventTarget | null) {
    const value = (target as { value?: string } | null)?.value;
    return typeof value === 'string' ? value : '';
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === 'setup' && pin !== confirm) {
      setError('PINs do not match');
      return;
    }
    if (pin.length < 4) {
      setError('Use at least 4 digits');
      return;
    }
    setBusy(true);
    try {
      await onUnlock(pin, mode === 'setup' ? confirm : undefined);
      setPin(''); setConfirm('');
    } catch (err: any) {
      setError(err?.message || 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm dark:bg-black/60">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-24 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl dark:bg-emerald-500/10" />
        <div className="absolute -bottom-24 -right-20 h-80 w-80 rounded-full bg-sky-400/20 blur-3xl dark:bg-blue-500/10" />
        <svg
          viewBox="0 0 1200 800"
          className="absolute inset-0 h-full w-full opacity-40"
          preserveAspectRatio="none"
          style={chartVars as React.CSSProperties}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="grid" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--grid-strong)" />
              <stop offset="100%" stopColor="var(--grid-soft)" />
            </linearGradient>
            <linearGradient id="line" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="var(--line-start)" />
              <stop offset="40%" stopColor="var(--line-mid)" />
              <stop offset="100%" stopColor="var(--line-end)" />
            </linearGradient>
          </defs>
          <rect width="1200" height="800" fill="var(--bg-tint)" />
          <g stroke="url(#grid)" strokeWidth="1">
            {Array.from({ length: 12 }).map((_, i) => (
              <line key={`h-${i}`} x1="0" y1={i * 70} x2="1200" y2={i * 70} />
            ))}
            {Array.from({ length: 12 }).map((_, i) => (
              <line key={`v-${i}`} x1={i * 100} y1="0" x2={i * 100} y2="800" />
            ))}
          </g>
          <polyline
            points="0,520 80,500 160,540 240,420 320,460 400,380 480,420 560,300 640,340 720,260 800,300 880,220 960,260 1040,210 1120,240 1200,180"
            fill="none"
            stroke="url(#line)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="8 10"
          >
            <animate attributeName="stroke-dashoffset" from="0" to="-180" dur="8s" repeatCount="indefinite" />
          </polyline>
          <polyline
            points="0,610 100,580 200,640 300,520 400,560 500,500 600,540 700,460 800,520 900,420 1000,450 1100,380 1200,420"
            fill="none"
            stroke="var(--line-alt)"
            strokeWidth="2"
            strokeDasharray="6 12"
          >
            <animate attributeName="stroke-dashoffset" from="0" to="140" dur="10s" repeatCount="indefinite" />
          </polyline>
        </svg>
      </div>
      <form
        onSubmit={submit}
        className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-card p-6 text-card-foreground shadow-xl"
      >
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted">
            <img
              src="/aurasafe-logo.png"
              alt="AuraSafe logo"
              className="h-6 w-6"
            />
          </div>
          <div>
            <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              AuraSafe Tracker
            </div>
            <h1 className="text-xl font-semibold">{mode === 'setup' ? 'Create PIN' : 'Enter PIN'}</h1>
          </div>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          Track gold and silver holdings with a local-first, privacy-first vault. Your data stays on
          this device and never leaves your browser.
        </p>
        <div className="mb-4 space-y-2 text-xs text-muted-foreground">
          <div>• Encrypted with your PIN and Web Crypto.</div>
          <div>• Offline by default, no accounts or cloud sync.</div>
          <div>• You control access and can wipe anytime.</div>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          The PIN unlocks your local vault and generates the encryption key that protects your data
          on this device.
        </p>
        <div className="space-y-3">
          <input
            className="w-full rounded-md border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
            type="password"
            inputMode="numeric"
            placeholder="PIN"
            value={pin}
            onChange={(e) => setPin(readValue(e.target))}
          />
          {mode === 'setup' && (
            <input
              className="w-full rounded-md border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
              type="password"
              inputMode="numeric"
              placeholder="Confirm PIN"
              value={confirm}
              onChange={(e) => setConfirm(readValue(e.target))}
            />
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            disabled={busy}
            className="w-full rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-60"
          >
            {busy ? 'Please wait…' : mode === 'setup' ? 'Set PIN' : 'Unlock'}
          </button>
          <p className="mt-2 text-xs text-muted-foreground">PIN never leaves your device.</p>
        </div>
      </form>
    </div>
  );
}
