import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, ChevronRight, Receipt, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { formatFCFA, formatTime } from '@/lib/format';

type OrderRow = {
  id: string;
  status: string;
  total?: number | null;
  table_number?: string | null;
  customer_name?: string | null;
  notes?: string | null;
  source?: string | null;
  created_at: string;
};

function clientLabel(o: OrderRow): string | null {
  if (o.customer_name) return o.customer_name;
  const m = String(o.notes || '').match(/Client:\s*([^·\n]+)/i);
  return m ? m[1].trim() : null;
}

/**
 * Remplace la bannière pub / "Bienvenue Stock Manager…" sur le dashboard :
 * file de commandes temps réel + alerte visuelle rouge clignotante.
 */
export default function DashboardOrdersPanel() {
  const { member, activeEstablishment, user } = useAuth();
  const estId = activeEstablishment?.id || member?.establishment_id || null;
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState(false);

  const load = useCallback(async () => {
    if (!estId) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select('id, status, total, table_number, customer_name, notes, source, created_at')
      .eq('establishment_id', estId)
      .in('status', ['pending', 'preparing', 'ready'])
      .order('created_at', { ascending: false })
      .limit(12);
    setOrders((data as OrderRow[]) || []);
    setLoading(false);
  }, [estId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!estId || !user) return;
    const channel = supabase
      .channel(`dash-orders-${estId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `establishment_id=eq.${estId}`,
        },
        (payload) => {
          void load();
          if (payload.eventType === 'INSERT') {
            setFlash(true);
            window.setTimeout(() => setFlash(false), 8000);
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [estId, user, load]);

  const pending = orders.filter((o) => o.status === 'pending').length;
  const preparing = orders.filter((o) => o.status === 'preparing').length;
  const ready = orders.filter((o) => o.status === 'ready').length;
  const alert = pending > 0 || flash;

  return (
    <div
      className={`mb-4 rounded-2xl border overflow-hidden transition-shadow ${
        alert
          ? 'border-red-500 shadow-lg shadow-red-500/30 dash-order-blink'
          : 'border-amber-500/30 bg-gradient-to-br from-stone-900/80 to-stone-950'
      }`}
      style={
        alert
          ? {
              animation: 'dashOrderPulse 1s ease-in-out infinite',
              background: 'linear-gradient(135deg, rgba(239,68,68,0.25), rgba(127,29,29,0.4))',
            }
          : undefined
      }
    >
      <style>{`
        @keyframes dashOrderPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.55); }
          50% { box-shadow: 0 0 0 6px rgba(239,68,68,0); }
        }
        @keyframes dashOrderFlash {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.65; }
        }
        .dash-order-blink .dash-order-title {
          animation: dashOrderFlash 0.9s ease-in-out infinite;
          color: #fecaca;
        }
      `}</style>

      <div className="px-3 py-2.5 flex items-center justify-between gap-2 border-b border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${
              alert ? 'bg-red-600 text-white' : 'bg-amber-500/20 text-amber-300'
            }`}
          >
            {alert ? <Bell size={18} className="animate-bounce" /> : <Receipt size={18} />}
          </span>
          <div className="min-w-0">
            <p className={`text-sm font-bold dash-order-title ${alert ? 'text-red-100' : 'text-stone-100'}`}>
              {alert ? `${pending} nouvelle(s) commande(s)` : 'Commandes en cours'}
            </p>
            <p className="text-[11px] text-stone-400">
              Temps réel · {preparing} en prépa · {ready} prête(s)
            </p>
          </div>
        </div>
        <Link
          to="/orders"
          className={`shrink-0 text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1 ${
            alert ? 'bg-red-600 text-white' : 'bg-amber-500/20 text-amber-200'
          }`}
        >
          Voir tout <ChevronRight size={14} />
        </Link>
      </div>

      {loading ? (
        <p className="px-4 py-6 text-center text-sm text-stone-500">Chargement des commandes…</p>
      ) : orders.length === 0 ? (
        <div className="px-4 py-5 text-center text-sm text-stone-500 flex flex-col items-center gap-1">
          <Sparkles size={18} className="text-amber-500/60" />
          Aucune commande ouverte. Les commandes QR / salle apparaîtront ici en direct.
        </div>
      ) : (
        <ul className="divide-y divide-white/5 max-h-56 overflow-y-auto">
          {orders.map((o) => {
            const name = clientLabel(o);
            const isNew = o.status === 'pending';
            return (
              <li key={o.id}>
                <Link
                  to="/orders"
                  className={`flex items-start justify-between gap-2 px-3 py-2.5 hover:bg-white/5 ${
                    isNew ? 'bg-red-500/15' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <p className={`text-sm font-bold truncate ${isNew ? 'text-red-200' : 'text-stone-100'}`}>
                      {name ? `👤 ${name}` : 'Client non renseigné'}
                    </p>
                    <p className="text-[11px] text-stone-400 truncate">
                      {o.table_number ? `Table ${o.table_number}` : 'Salle / comptoir'}
                      {o.source === 'qr_table' ? ' · QR' : ''}
                      {' · '}
                      {formatTime(o.created_at)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-mono text-amber-300">
                      {formatFCFA(Number(o.total) || 0)}
                    </p>
                    <p
                      className={`text-[10px] font-bold uppercase ${
                        o.status === 'pending'
                          ? 'text-red-400'
                          : o.status === 'preparing'
                            ? 'text-sky-400'
                            : 'text-emerald-400'
                      }`}
                    >
                      {o.status === 'pending'
                        ? 'Nouvelle'
                        : o.status === 'preparing'
                          ? 'Préparation'
                          : 'Prête'}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
