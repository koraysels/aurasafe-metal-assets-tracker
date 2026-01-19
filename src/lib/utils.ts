import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getBrowserStorage() {
  if (typeof globalThis === 'undefined') return null;
  return (globalThis as any).localStorage as Storage | null;
}

export function getSessionStorage() {
  if (typeof globalThis === 'undefined') return null;
  return (globalThis as any).sessionStorage as Storage | null;
}

export function getNavigator() {
  if (typeof globalThis === 'undefined') return null;
  return (globalThis as any).navigator as Navigator | null;
}

export function getDocument() {
  if (typeof globalThis === 'undefined') return null;
  return (globalThis as any).document as Document | null;
}

export function getLocation() {
  if (typeof globalThis === 'undefined') return null;
  return (globalThis as any).location as Location | null;
}
