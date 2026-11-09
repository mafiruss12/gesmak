import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, WifiOff, Trash2, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  queueList,
  queueRemove,
  queueCount,
  flushQueue,
  isOnline,
  labelQueueAction,
  type QueueItem,
} from '@/lib/offline';

export default function SyncPending() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const online = isOnline();

  async function load() {
    setLoading(true);
    try {
      setItems(await queueList());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, []);

  async function syncNow() {
    if (!isOnline()) {
      setMsg('Toujours hors ligne — impossible de synchroniser.');
      return;
    }
    setSyncing(true);
    setMsg(null);
    try {
      const r = await flushQueue(supabase);
      setMsg(
        `${r.ok} synchronisée(s)` +
          (r.fail ? ` · ${r.fail} échec(s)` : '') +
          (r.conflicts ? ` · ${r.conflicts} conflit(s) stock résolu(s) par delta` : '')
      );
      await load();
    } finally {
      setSyncing(false);
    }
  }

  async function drop(id: string) {
    if (!confirm('Supprimer cette action en attente ? Elle ne sera pas envoyée au serveur.')) return;
    await queueRemove(id);
    await load();
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 sync-page-motion">
      <div className="flex items-center gap-3">
        <Link to="/dashboard" className="text-stone-400 hover:text-stone-200">
          <ArrowLeft size={20} />
        </Link>
        <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
          <span className={`absolute inset-0 rounded-full border-2 border-transparent ${online ? 'border-t-emerald-400 border-r-sky-400' : 'border-t-amber-400 border-r-orange-400'} ${syncing ? 'animate-spin' : ''}`} style={{ animationDuration: '1.6s' }} aria-hidden />
          <img src="/logo-circle.png" alt="" className="relative z-[1] w-[72%] h-[72%] rounded-full object-cover" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-stone-100">Actions en attente</h1>
          <p className="text-sm text-stone-500">
            Opérations hors ligne · synchronisation GESMAK
          </p>
        </div>
      </div>

      <div
        className={`rounded-xl border px-4 py-3 text-sm flex flex-wrap items-center gap-3 ${
          online ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100' : 'border-amber-500/30 bg-amber-500/10 text-amber-100'
        }`}
      >
        {online ? (
          <span className="inline-flex items-center gap-1.5 font-semibold">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> En ligne
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 font-semibold">
            <WifiOff size={16} /> Hors ligne
          </span>
        )}
        <span className="text-stone-400">· {items.length} en file</span>
        <button
          type="button"
          disabled={!online || syncing || items.length === 0}
          onClick={() => void syncNow()}
          className="ml-auto btn-primary text-sm flex items-center gap-2 disabled:opacity-40"
        >
          <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
          Synchroniser maintenant
        </button>
      </div>

      {msg && <p className="text-sm text-stone-300">{msg}</p>}

      {loading ? (
        <p className="text-stone-500 text-sm">Chargement…</p>
      ) : items.length === 0 ? (
        <div className="card text-stone-400 text-sm">Aucune action en attente. Tout est synchronisé.</div>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.id} className="card flex items-start gap-3 text-sm">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-stone-100">{labelQueueAction(it)}</p>
                <p className="text-xs text-stone-500 mt-0.5">
                  {new Date(it.createdAt).toLocaleString('fr-FR')} · {it.action} · {it.table}
                  {it.retries ? ` · essais: ${it.retries}` : ''}
                </p>
                {it.lastError && <p className="text-xs text-red-400 mt-1">{it.lastError}</p>}
                {it.payload?.name != null && (
                  <p className="text-xs text-stone-400 mt-1 truncate">{String(it.payload.name)}</p>
                )}
                {it.payload?.stock != null && (
                  <p className="text-xs text-stone-400">stock → {String(it.payload.stock)}</p>
                )}
              </div>
              <button
                type="button"
                className="text-red-400 hover:text-red-300 p-2"
                title="Abandonner"
                onClick={() => void drop(it.id)}
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <style dangerouslySetInnerHTML={{ __html: "\n        .sync-page-motion { animation: syncPageIn .45s ease both; }\n        @keyframes syncPageIn {\n          from { opacity: 0; transform: translateY(8px); }\n          to { opacity: 1; transform: translateY(0); }\n        }\n      " }} />
    </div>
  );
}
