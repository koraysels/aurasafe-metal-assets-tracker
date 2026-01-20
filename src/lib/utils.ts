import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

declare const window: any;
declare const document: any;
declare const navigator: any;
declare const location: any;

export function getBrowserStorage() {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

export function getSessionStorage() {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage;
}

export function getNavigator() {
  if (typeof window === 'undefined') return null;
  return navigator;
}

export function getDocument() {
  if (typeof window === 'undefined') return null;
  return document;
}

export function getLocation() {
  if (typeof window === 'undefined') return null;
  return location;
}
