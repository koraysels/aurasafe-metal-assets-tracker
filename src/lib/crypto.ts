export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const te = new TextEncoder();
const td = new TextDecoder();

export function getOrCreateSalt(): string {
  let salt = localStorage.getItem('as_salt');
  if (!salt) {
    const buf = new Uint8Array(16);
    crypto.getRandomValues(buf);
    salt = bytesToBase64(buf);
    localStorage.setItem('as_salt', salt);
  }
  return salt;
}

async function importPBKDF2Key(pin: string) {
  return crypto.subtle.importKey('raw', te.encode(pin), 'PBKDF2', false, ['deriveKey','deriveBits']);
}

export async function deriveKeyFromPin(pin: string, saltB64: string): Promise<CryptoKey> {
  const baseKey = await importPBKDF2Key(pin);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: base64ToBytes(saltB64), iterations: 150000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt','decrypt']
  );
}

export async function hashPin(pin: string, saltB64: string): Promise<string> {
  const baseKey = await importPBKDF2Key(pin);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: base64ToBytes(saltB64), iterations: 150000, hash: 'SHA-256' },
    baseKey,
    256
  );
  return bytesToBase64(new Uint8Array(bits));
}

export function getStoredHash(): string | null {
  return typeof window === 'undefined' ? null : localStorage.getItem('as_master_hash');
}

export function setStoredHash(hash: string) {
  localStorage.setItem('as_master_hash', hash);
}

function makeIV(): Uint8Array {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  return iv;
}

export async function encryptJSON(key: CryptoKey, obj: any): Promise<{ iv: string; ciphertext: string }> {
  const iv = makeIV();
  const plaintext = te.encode(JSON.stringify(obj));
  const buf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return { iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(buf)) };
}

export async function decryptJSON<T>(key: CryptoKey, ivB64: string, ciphertextB64: string): Promise<T> {
  const iv = base64ToBytes(ivB64);
  const data = base64ToBytes(ciphertextB64);
  const buf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return JSON.parse(td.decode(new Uint8Array(buf))) as T;
}
