import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { flushQueue, isOnline, queueCount } from '@/lib/offline';

/** Bandeau réseau / file offline — Partie 5 motion GESMAK */
export default function OfflineBanner() {
  const [online, setOnline] = useState(isOnline());
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  async function refreshPending() {
    try {
      setPending(await queueCount());
    } catch {
      /* ignore */
    }
  }

  async function sync() {
    if (!isOnline()) return;
    setSyncing(true);
    try {
      const result = await flushQueue(supabase);
      if (result.ok > 0 || result.conflicts > 0 || result.fail > 0) {
        setLastSync(
          `${result.ok} sync` +
            (result.conflicts ? ` · ${result.conflicts} conflit(s)` : '') +
            (result.fail ? ` · ${result.fail} échec(s)` : ''),
        );
        window.setTimeout(() => setLastSync(null), 5000);
      }
      await refreshPending();
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    void refreshPending();

    function onOnline() {
      setOnline(true);
      void sync();
    }
    function onOffline() {
      setOnline(false);
    }

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    const interval = window.setInterval(() => {
      if (isOnline()) void sync();
      else void refreshPending();
    }, 20000);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.clearInterval(interval);
    };
  }, []);

  if (online && pending === 0 && !lastSync && !syncing) return null;

  const offline = !online;
  const syncMode = online && (pending > 0 || syncing);

  return (
    <div
      className={`offline-banner-motion fixed left-3 right-3 bottom-[calc(3.75rem+env(safe-area-inset-bottom,0px))] lg:bottom-4 z-[35] mx-auto max-w-md rounded-2xl px-4 py-2.5 shadow-xl border flex items-center gap-3 pointer-events-auto ${
        offline
          ? 'bg-amber-950/95 border-amber-500/50 text-amber-50'
          : syncMode
            ? 'bg-stone-900/95 border-sky-500/40 text-stone-100'
            : 'bg-stone-900/95 border-emerald-500/40 text-stone-100'
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="relative shrink-0">
        {offline ? (
          <>
            <span className="absolute -inset-1 rounded-full bg-amber-400/20 animate-ping" aria-hidden />
            <WifiOff size={18} className="relative text-amber-300" />
          </>
        ) : syncMode ? (
          <RefreshCw size={18} className={`text-sky-400 ${syncing ? 'animate-spin' : ''}`} />
        ) : (
          <Wifi size={18} className="text-emerald-400" />
        )}
      </div>

      <div className="flex-1 min-w-0 text-xs sm:text-sm">
        {offline ? (
          <>
            <p className="font-bold leading-tight">Hors ligne</p>
            <p className="text-[11px] opacity-90 truncate">
              Travail local possible
              {pending > 0 ? ` · ${pending} en attente` : ''}
            </p>
          </>
        ) : syncMode ? (
          <>
            <p className="font-semibold leading-tight">
              {syncing ? 'Synchronisation…' : `${pending} action(s) en file`}
            </p>
            <p className="text-[11px] text-stone-400 truncate">
              {syncing ? 'Envoi vers le serveur' : 'Appuyez pour synchroniser'}
            </p>
          </>
        ) : (
          <p className="font-medium truncate">{lastSync || 'À jour'}</p>
        )}
      </div>

      {online && pending > 0 && (
        <button
          type="button"
          onClick={() => void sync()}
          disabled={syncing}
          className="shrink-0 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/30"
        >
          Sync
        </button>
      )}
      <Link
        to="/sync"
        className="shrink-0 text-[11px] font-semibold text-stone-400 hover:text-stone-200 underline-offset-2 hover:underline"
      >
        Détail
      </Link>

      <style>{`
        .offline-banner-motion {
          animation: offlineBannerIn .4s cubic-bezier(.22,1,.36,1) both;
        }
        @keyframes offlineBannerIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .offline-banner-motion { animation: none; }
        }
      `}</style>
    </div>
  );
}
