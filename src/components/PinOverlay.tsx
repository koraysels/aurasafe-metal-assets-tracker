'use client';
import React, { useState } from 'react';

export default function PinOverlay({ mode, onUnlock }: { mode: 'setup' | 'unlock'; onUnlock: (pin: string, confirmPin?: string) => Promise<void>; }) {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-xl border border-border bg-card p-6 text-card-foreground shadow-xl"
      >
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
