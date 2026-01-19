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

export type AnchorLike = {
  href: string;
  download: string;
  click: () => void;
};

export type InputLike = {
  type: string;
  accept: string;
  files: FileList | null;
  onchange: ((this: GlobalEventHandlers, ev: Event) => any) | null;
};

export type CanvasLike = {
  width: number;
  height: number;
  getContext: (contextId: '2d') => CanvasRenderingContext2D | null;
  toDataURL: (type?: string, quality?: number) => string;
};

export type DocumentLike = {
  createElement: {
    (tagName: 'a'): AnchorLike;
    (tagName: 'canvas'): CanvasLike;
    (tagName: 'input'): InputLike;
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
