import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getBrowserStorage(): Storage | null {
  if (typeof globalThis === 'undefined') return null;
  return (globalThis as any).localStorage as Storage | null;
}

export function getSessionStorage(): Storage | null {
  if (typeof globalThis === 'undefined') return null;
  return (globalThis as any).sessionStorage as Storage | null;
}

export function getNavigator(): Navigator | null {
  if (typeof globalThis === 'undefined') return null;
  return (globalThis as any).navigator as Navigator | null;
}

export type DocumentLike = {
  createElement: {
    (tagName: 'a'): HTMLAnchorElement;
    (tagName: 'canvas'): HTMLCanvasElement;
    (tagName: 'input'): HTMLInputElement;
    (tagName: string): HTMLElement;
  };
};

export function getDocument(): DocumentLike | null {
  if (typeof globalThis === 'undefined') return null;
  return (globalThis as any).document as DocumentLike | null;
}

export function getLocation(): Location | null {
  if (typeof globalThis === 'undefined') return null;
  return (globalThis as any).location as Location | null;
}
