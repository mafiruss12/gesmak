import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { flushQueue, isOnline, queueCount } from '@/lib/offline';

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
      if (result.ok > 0 || result.conflicts > 0) {
        setLastSync(
          `${result.ok} sync` +
            (result.conflicts ? ` · ${result.conflicts} conflit(s) résolu(s)` : '') +
            (result.fail ? ` · ${result.fail} échec(s)` : '')
        );
        setTimeout(() => setLastSync(null), 5000);
      }
      await refreshPending();
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    refreshPending();

    function onOnline() {
      setOnline(true);
      void sync();
    }
    function onOffline() {
      setOnline(false);
    }

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    const interval = setInterval(() => {
      if (isOnline()) void sync();
      else void refreshPending();
    }, 20000);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      clearInterval(interval);
    };
  }, []);

  if (online && pending === 0 && !lastSync) return null;
  // P3 : toujours visible hors-ligne pour rassurer le terrain

  return (
    <div
      className={`fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-2xl px-4 py-3 shadow-xl border flex items-center gap-3 ${
        online
          ? 'bg-stone-900/95 border-primary-500/40 text-stone-100'
          : 'bg-amber-950/95 border-amber-500/40 text-amber-100'
      }`}
    >
      {online ? (
        pending > 0 || syncing ? (
          <RefreshCw size={18} className={`text-primary-400 shrink-0 ${syncing ? 'animate-spin' : ''}`} />
        ) : (
          <Wifi size={18} className="text-success-400 shrink-0" />
        )
      ) : (
        <WifiOff size={18} className="text-amber-400 shrink-0" />
      )}
      <div className="flex-1 min-w-0 text-sm">
        {!online && (
          <p className="font-medium">Mode hors ligne — stock, caisse et rapport restent utilisables</p>
        )}
        {online && pending > 0 && (
          <p>
            {pending} action(s) en attente
            {syncing ? ' · sync…' : ''}
          </p>
        )}
        {lastSync && <p className="text-xs text-stone-400">{lastSync}</p>}
      </div>
      {pending > 0 && (
        <Link to="/sync-pending" className="text-xs text-amber-300 underline whitespace-nowrap">
          Voir
        </Link>
      )}
      {online && pending > 0 && (
        <button type="button" onClick={() => void sync()} className="text-xs text-primary-300 underline">
          Sync
        </button>
      )}
    </div>
  );
}
