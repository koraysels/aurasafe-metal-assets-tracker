'use client';
import { useEffect, useState } from 'react';
import PinOverlay from '../components/PinOverlay';
import Inventory from '../components/Inventory';
import { getSessionStorage } from '../lib/utils';
import { deriveKeyFromPin, exportKeyToJWK, getOrCreateSalt, getStoredHash, hashPin, importKeyFromJWK, setStoredHash } from '../lib/crypto';

const SESSION_KEY_JWK = 'as_session_key_jwk';

export default function Page() {
  const [keyMaterial, setKeyMaterial] = useState<CryptoKey | null>(null);
  const [mode, setMode] = useState<'setup'|'unlock'>('unlock');

  useEffect(() => {
    const hasHash = !!getStoredHash();
    setMode(hasHash ? 'unlock' : 'setup');
    const sessionJwkStr = getSessionStorage()?.getItem(SESSION_KEY_JWK) ?? null;
    if (!sessionJwkStr || !hasHash) return;
    (async () => {
      try {
        const jwk = JSON.parse(sessionJwkStr);
        const key = await importKeyFromJWK(jwk);
        setKeyMaterial(key);
      } catch {
        // Invalid JWK, clear it
        getSessionStorage()?.removeItem(SESSION_KEY_JWK);
      }
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
      const jwk = await exportKeyToJWK(key);
      sessionStorageSafe?.setItem(SESSION_KEY_JWK, JSON.stringify(jwk));
      return;
    }
    if (newHash !== existingHash) throw new Error('Incorrect PIN');
    const key = await deriveKeyFromPin(pin, salt);
    setKeyMaterial(key);
    const jwk = await exportKeyToJWK(key);
    sessionStorageSafe?.setItem(SESSION_KEY_JWK, JSON.stringify(jwk));
  }

  function onLock() {
    setKeyMaterial(null);
    const sessionStorageSafe = getSessionStorage();
    sessionStorageSafe?.removeItem(SESSION_KEY_JWK);
  }

  return (
    <>
      {!keyMaterial && <PinOverlay mode={mode} onUnlock={(pin)=>onUnlock(pin)} />}
      {keyMaterial && <Inventory keyMaterial={keyMaterial} onLock={onLock} />}
    </>
  );
}
