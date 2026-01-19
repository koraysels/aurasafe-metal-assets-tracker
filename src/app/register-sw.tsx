'use client';
import { useEffect, useState } from 'react';
import { getLocation, getNavigator } from '../lib/utils';

export default function RegisterSW() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    const nav = getNavigator();
    if (!nav || !('serviceWorker' in nav)) return;
    const serviceWorker = nav.serviceWorker as ServiceWorkerContainer | undefined;
    if (!serviceWorker) return;

    const onControllerChange = () => {
      getLocation()?.reload();
    };

    serviceWorker.addEventListener('controllerchange', onControllerChange);

    serviceWorker
      .getRegistrations()
      .then((registrations) => {
        const registration = registrations.find((reg) =>
          reg.active?.scriptURL.includes('/serwist/sw.js') ||
          reg.waiting?.scriptURL.includes('/serwist/sw.js') ||
          reg.installing?.scriptURL.includes('/serwist/sw.js')
        );
        if (!registration) return;

        const onWaiting = (worker: ServiceWorker | null) => {
          if (!worker) return;
          setWaitingWorker(worker);
          setShowUpdate(true);
        };

        if (registration.waiting) onWaiting(registration.waiting);

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && serviceWorker.controller) {
              onWaiting(registration.waiting);
            }
          });
        });
      })
      .catch(() => {});

    return () => {
      serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  function onUpdateNow() {
    if (!waitingWorker) return;
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    setShowUpdate(false);
  }

  if (!showUpdate) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm rounded-xl border border-slate-800 bg-slate-950/90 p-4 text-slate-100 shadow-2xl backdrop-blur">
      <div className="text-sm font-semibold">New version available.</div>
      <div className="mt-1 text-xs text-slate-400">Update to the latest secure build.</div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          onClick={() => setShowUpdate(false)}
          className="rounded-md bg-slate-800 px-3 py-1.5 text-xs ring-1 ring-slate-700"
        >
          Later
        </button>
        <button
          onClick={onUpdateNow}
          className="rounded-md bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-slate-950"
        >
          Update Now
        </button>
      </div>
    </div>
  );
}
