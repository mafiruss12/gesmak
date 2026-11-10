import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X, Volume2, VolumeX } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  playOrderAlertSound,
  setOrderSoundEnabled,
  showOrderBrowserNotification,
  requestOrderAlertPermissions,
} from '@/lib/orderAlerts';

type IncomingOrder = {
  id: string;
  establishment_id: string;
  table_number?: string | null;
  customer_name?: string | null;
  notes?: string | null;
  total?: number | null;
  source?: string | null;
  status?: string | null;
  created_at?: string;
  itemsSummary?: string;
};

const ALERT_ROLES = new Set([
  'owner',
  'manager',
  'gerant',
  'gérant',
  'cashier',
  'caissier',
  'admin',
  'super_admin',
  'employee',
  'employé',
]);

async function fetchItemsSummary(orderId: string): Promise<string> {
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 300 * attempt));
    const { data: items } = await supabase
      .from('order_items')
      .select('product_name, name, qty, quantity')
      .eq('order_id', orderId);
    if (items?.length) {
      return items
        .map((i: Record<string, unknown>) => {
          const label = String(i.product_name || i.name || '?');
          const q = Number(i.qty ?? i.quantity ?? 1);
          return `${label} × ${q}`;
        })
        .join(', ');
    }
  }
  return '';
}

function playStrongOrderSound() {
  try {
    if (localStorage.getItem('mm_order_sound_ok') === '0') return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) {
      playOrderAlertSound();
      return;
    }
    const ctx = new Ctx();
    const beep = (t0: number, freq: number, dur = 0.22) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.connect(g);
      g.connect(ctx.destination);
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    };
    const now = ctx.currentTime;
    beep(now, 880);
    beep(now + 0.28, 1175);
    beep(now + 0.56, 1400, 0.35);
    setTimeout(() => {
      try {
        void ctx.close();
      } catch {
        /* */
      }
    }, 1200);
  } catch {
    playOrderAlertSound();
  }
}

/**
 * Popup + son + notif navigateur pour chaque nouvelle commande (Realtime + polling secours).
 */
export default function OrderRealtimeAlert() {
  const { member, activeEstablishment, user, effectiveRole } = useAuth();
  const navigate = useNavigate();
  const estId = activeEstablishment?.id || member?.establishment_id || null;
  const role = String(effectiveRole || member?.role || '').toLowerCase();
  const canReceive = !!estId && !!user && ALERT_ROLES.has(role);

  const [popup, setPopup] = useState<IncomingOrder | null>(null);
  const [soundOn, setSoundOn] = useState(() => {
    try {
      return localStorage.getItem('mm_order_sound_ok') !== '0';
    } catch {
      return true;
    }
  });
  const [liveOk, setLiveOk] = useState(false);
  const seen = useRef<Set<string>>(new Set());
  const armed = useRef(false);
  const bootstrapDone = useRef(false);

  const handleOrder = useCallback(
    async (row: IncomingOrder, opts?: { silent?: boolean }) => {
      if (!row?.id || seen.current.has(row.id)) return;
      if (row.status && !['pending', 'preparing', 'ready'].includes(String(row.status))) return;
      seen.current.add(row.id);

      const itemsSummary = await fetchItemsSummary(row.id);
      const order: IncomingOrder = { ...row, itemsSummary };
      if (!opts?.silent) {
        setPopup(order);
        if (localStorage.getItem('mm_order_sound_ok') !== '0') {
          playStrongOrderSound();
        }
        const body = [
          order.customer_name || order.notes || 'Commande',
          order.table_number ? `Table ${order.table_number}` : null,
          itemsSummary || null,
          order.total != null ? `${Math.round(Number(order.total))} F` : null,
        ]
          .filter(Boolean)
          .join(' · ');
        showOrderBrowserNotification('🚨 Nouvelle commande GESMAK', body);
        try {
          if (user?.id) {
            await supabase.from('notifications').insert({
              user_id: user.id,
              title: '🚨 Nouvelle commande',
              message: body,
              type: 'qr_order',
              link: '/orders',
              read: false,
            });
          }
        } catch {
          /* */
        }
      }
    },
    [user?.id],
  );

  // Premier clic = activer audio (politique navigateur)
  useEffect(() => {
    if (!canReceive) return;
    const arm = () => {
      if (armed.current) return;
      armed.current = true;
      void requestOrderAlertPermissions().then((r) => {
        if (r.sound) {
          setSoundOn(true);
          setOrderSoundEnabled(true);
        }
      });
    };
    window.addEventListener('pointerdown', arm, { once: true, passive: true });
    window.addEventListener('keydown', arm, { once: true });
    return () => {
      window.removeEventListener('pointerdown', arm);
      window.removeEventListener('keydown', arm);
    };
  }, [canReceive]);

  // Realtime INSERT
  useEffect(() => {
    if (!canReceive || !estId) return;

    const channel = supabase
      .channel(`order-alert-${estId}-${user?.id || 'anon'}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `establishment_id=eq.${estId}`,
        },
        (payload) => {
          void handleOrder(payload.new as IncomingOrder);
        },
      )
      .subscribe((status) => {
        setLiveOk(status === 'SUBSCRIBED');
      });

    return () => {
      void supabase.removeChannel(channel);
      setLiveOk(false);
    };
  }, [canReceive, estId, user?.id, handleOrder]);

  // Polling de secours (Realtime parfois silencieux) — toutes les 12 s
  useEffect(() => {
    if (!canReceive || !estId) return;

    const tick = async () => {
      try {
        const since = new Date(Date.now() - 3 * 60 * 1000).toISOString();
        const { data } = await supabase
          .from('orders')
          .select(
            'id, establishment_id, table_number, customer_name, notes, total, source, status, created_at',
          )
          .eq('establishment_id', estId)
          .in('status', ['pending', 'preparing', 'ready'])
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(8);

        if (!data?.length) return;

        // Premier cycle : mémoriser sans popup (évite alerte sur anciennes commandes)
        if (!bootstrapDone.current) {
          data.forEach((o) => seen.current.add(o.id));
          bootstrapDone.current = true;
          return;
        }

        for (const o of data) {
          if (!seen.current.has(o.id)) {
            await handleOrder(o as IncomingOrder);
          }
        }
      } catch {
        /* */
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), 12000);
    return () => window.clearInterval(id);
  }, [canReceive, estId, handleOrder]);

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setOrderSoundEnabled(next);
  }

  if (!canReceive) return null;

  return (
    <>
      {popup && (
        <div
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-3 bg-black/65 backdrop-blur-[2px]"
          role="alertdialog"
          aria-modal="true"
          aria-label="Nouvelle commande"
        >
          <div className="w-full max-w-md rounded-2xl border-2 border-red-500 bg-stone-900 shadow-2xl shadow-red-900/50 overflow-hidden order-alert-motion">
            <div className="bg-gradient-to-r from-red-700 via-red-600 to-orange-600 px-4 py-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-white font-bold">
                <Bell className="animate-bounce" size={22} />
                Nouvelle commande
              </div>
              <button
                type="button"
                className="text-white/90 p-1 rounded-lg hover:bg-white/10"
                onClick={() => setPopup(null)}
                aria-label="Fermer"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-2 text-stone-100">
              <p className="text-lg font-bold">
                {popup.customer_name || 'Client'}
                {popup.table_number ? ` · Table ${popup.table_number}` : ''}
              </p>
              {popup.itemsSummary && (
                <p className="text-sm text-amber-200">{popup.itemsSummary}</p>
              )}
              {popup.notes && <p className="text-xs text-stone-400">{popup.notes}</p>}
              {popup.total != null && (
                <p className="text-xl font-black text-amber-300">
                  {Math.round(Number(popup.total)).toLocaleString('fr-FR')} F
                </p>
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  className="btn-primary flex-1 min-h-[44px]"
                  onClick={() => {
                    setPopup(null);
                    navigate('/orders');
                  }}
                >
                  Voir les commandes
                </button>
                <button
                  type="button"
                  className="btn-secondary flex items-center justify-center gap-1 px-3 min-h-[44px]"
                  onClick={toggleSound}
                  title={soundOn ? 'Couper le son' : 'Activer le son'}
                >
                  {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
                </button>
                <button type="button" className="btn-ghost px-3 min-h-[44px]" onClick={() => setPopup(null)}>
                  Fermer
                </button>
              </div>
              <p className="text-[10px] text-stone-500">
                Alertes {liveOk ? 'temps réel actives' : 'par contrôle périodique'}
              </p>
            </div>
          </div>
        </div>
      )}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .order-alert-motion {
          animation: orderAlertIn .45s cubic-bezier(.22,1,.36,1) both,
                     orderAlertPulse 1.6s ease-in-out .45s infinite;
        }
        @keyframes orderAlertIn {
          from { opacity: 0; transform: translateY(24px) scale(.94); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes orderAlertPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,.45); }
          50% { box-shadow: 0 0 0 10px rgba(239,68,68,0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .order-alert-motion { animation: orderAlertIn .3s ease both; }
        }
      `,
        }}
      />
    </>
  );
}
