'use client';
import React, { useState } from 'react';

export default function PinOverlay({ mode, onUnlock }: { mode: 'setup' | 'unlock'; onUnlock: (pin: string, confirmPin?: string) => Promise<void>; }) {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl bg-gray-900 p-6 shadow-xl ring-1 ring-gray-800">
        <h1 className="mb-4 text-xl font-semibold">{mode === 'setup' ? 'Create PIN' : 'Enter PIN'}</h1>
        <p className="mb-4 text-sm text-gray-400">
          Privacy-focused, local-first precious metal tracker. No data leaves your computer.
        </p>
        <div className="space-y-3">
          <input className="w-full rounded-md bg-gray-800 px-3 py-2 outline-none ring-1 ring-gray-700 focus:ring-brand" type="password" inputMode="numeric" placeholder="PIN" value={pin} onChange={(e)=>setPin(e.target.value)} />
          {mode === 'setup' && (
            <input className="w-full rounded-md bg-gray-800 px-3 py-2 outline-none ring-1 ring-gray-700 focus:ring-brand" type="password" inputMode="numeric" placeholder="Confirm PIN" value={confirm} onChange={(e)=>setConfirm(e.target.value)} />
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button disabled={busy} className="w-full rounded-md bg-brand px-4 py-2 font-medium text-black disabled:opacity-60">{busy ? 'Please wait…' : mode === 'setup' ? 'Set PIN' : 'Unlock'}</button>
          <p className="mt-2 text-xs text-gray-400">PIN never leaves your device.</p>
        </div>
      </form>
    </div>
  );
}
