/// <reference lib="webworker" />
import { Serwist } from 'serwist';

declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: Array<{ url: string; revision: string }>;
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
});

serwist.addEventListeners();

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
