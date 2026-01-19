'use client';
import { useEffect, useState } from 'react';
import PinOverlay from '../components/PinOverlay';
import Inventory from '../components/Inventory';
import { getSessionStorage } from '../lib/utils';
import { deriveKeyFromPin, getOrCreateSalt, getStoredHash, hashPin, setStoredHash } from '../lib/crypto';

const SESSION_PIN_KEY = 'as_session_pin';

export default function Page() {
  const [keyMaterial, setKeyMaterial] = useState<CryptoKey | null>(null);
  const [mode, setMode] = useState<'setup'|'unlock'>('unlock');

  useEffect(() => {
    const hasHash = !!getStoredHash();
    setMode(hasHash ? 'unlock' : 'setup');
    const sessionPin = getSessionStorage()?.getItem(SESSION_PIN_KEY) ?? null;
    if (!sessionPin || !hasHash) return;
    (async () => {
      const salt = getOrCreateSalt();
      const existingHash = getStoredHash();
      if (!existingHash) return;
      const newHash = await hashPin(sessionPin, salt);
      if (newHash !== existingHash) return;
      const key = await deriveKeyFromPin(sessionPin, salt);
      setKeyMaterial(key);
    })();
  }, []);

  async function onUnlock(pin: string) {
    const salt = getOrCreateSalt();
    const existingHash = getStoredHash();
    const newHash = await hashPin(pin, salt);
    const sessionStorageSafe = getSessionStorage();
    if (!existingHash) {
      setStoredHash(newHash);
      const key = await deriveKeyFromPin(pin, salt);
      setKeyMaterial(key);
      setMode('unlock');
      sessionStorageSafe?.setItem(SESSION_PIN_KEY, pin);
      return;
    }
    if (newHash !== existingHash) throw new Error('Incorrect PIN');
    const key = await deriveKeyFromPin(pin, salt);
    setKeyMaterial(key);
    sessionStorageSafe?.setItem(SESSION_PIN_KEY, pin);
  }

  function onLock() {
    setKeyMaterial(null);
    const sessionStorageSafe = getSessionStorage();
    sessionStorageSafe?.removeItem(SESSION_PIN_KEY);
  }

  return (
    <>
      {!keyMaterial && <PinOverlay mode={mode} onUnlock={(pin)=>onUnlock(pin)} />}
      {keyMaterial && <Inventory keyMaterial={keyMaterial} onLock={onLock} />}
    </>
  );
}
