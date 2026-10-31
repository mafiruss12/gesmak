import { useEffect, useRef, useState } from 'react';
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

async function fetchItemsSummary(orderId: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 350 * attempt));
    const { data: items } = await supabase
      .from('order_items')
      .select('product_name, name, qty, quantity')
      .eq('order_id', orderId);
    if (items?.length) {
      return items
        .map((i: any) => {
          const label = i.product_name || i.name || '?';
          const q = i.qty ?? i.quantity ?? 1;
          return `${label} × ${q}`;
        })
        .join(', ');
    }
  }
  return '';
}

/** Son plus long / distinct (3 tons) */
function playStrongOrderSound() {
  try {
    if (localStorage.getItem('mm_order_sound_ok') === '0') return;
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
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
 * Alertes temps réel propriétaire / gérant / caissier :
 * INSERT sur orders de l'établissement actif (QR + salle).
 */
export default function OrderRealtimeAlert() {
  const { member, activeEstablishment, user } = useAuth();
  const navigate = useNavigate();
  const estId = activeEstablishment?.id || member?.establishment_id || null;
  const role = member?.role;
  const canReceive =
    !!estId &&
    !!user &&
    (role === 'owner' ||
      role === 'manager' ||
      role === 'cashier' ||
      role === 'admin' ||
      role === 'super_admin');

  const [popup, setPopup] = useState<IncomingOrder | null>(null);
  const [soundOn, setSoundOn] = useState(() => {
    try {
      return localStorage.getItem('mm_order_sound_ok') !== '0';
    } catch {
      return true;
    }
  });
  const seen = useRef<Set<string>>(new Set());
  const armed = useRef(false);

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

  useEffect(() => {
    if (!canReceive || !estId) return;

    const handleOrder = async (row: IncomingOrder) => {
      if (!row?.id || seen.current.has(row.id)) return;
      // ignorer commandes déjà traitées si UPDATE arrive
      if (row.status && !['pending', 'preparing'].includes(row.status) && row.status !== undefined) {
        // INSERT is always pending usually
      }
      seen.current.add(row.id);

      const itemsSummary = await fetchItemsSummary(row.id);
      const order: IncomingOrder = { ...row, itemsSummary };
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

      showOrderBrowserNotification('🚨 Nouvelle commande', body);

      try {
        if (user?.id) {
          await supabase.from('notifications').insert({
            user_id: user.id,
            title: '🚨 Nouvelle commande',
            message: body,
            type: 'qr_order',
            link: '/kitchen',
            read: false,
          });
        }
      } catch {
        /* */
      }
    };

    const channel = supabase
      .channel(`order-alert-${estId}-${user?.id || 'x'}`)
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
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [canReceive, estId, user?.id]);

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setOrderSoundEnabled(next);
  }

  if (!canReceive) return null;

  return (
    <>
      {popup && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-3 bg-black/55">
          <div className="w-full max-w-md rounded-2xl border-2 border-red-500 bg-stone-900 shadow-2xl shadow-red-900/50 overflow-hidden animate-pulse">
            <div className="bg-red-600 px-4 py-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-bold text-white text-lg">
                <Bell className="animate-bounce" size={24} />
                🚨 Nouvelle commande
              </div>
              <button type="button" className="text-white/90 p-1" onClick={() => setPopup(null)} aria-label="Fermer">
                <X size={22} />
              </button>
            </div>
            <div className="p-4 space-y-2 text-stone-100">
              {popup.customer_name && (
                <p className="text-sm">
                  <span className="text-stone-400">Client :</span> <strong>{popup.customer_name}</strong>
                </p>
              )}
              {popup.table_number && (
                <p className="text-sm">
                  <span className="text-stone-400">Table :</span> <strong>{popup.table_number}</strong>
                </p>
              )}
              {popup.itemsSummary ? (
                <p className="text-sm font-medium leading-relaxed">{popup.itemsSummary}</p>
              ) : (
                <p className="text-sm text-stone-400">{popup.notes || 'Détail des articles en cours…'}</p>
              )}
              {popup.total != null && (
                <p className="text-xl font-bold text-amber-400">
                  {Math.round(Number(popup.total)).toLocaleString('fr-FR')} F
                </p>
              )}
              <p className="text-xs text-stone-500">
                {popup.created_at
                  ? new Date(popup.created_at).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })
                  : 'À l’instant'}
                {popup.source === 'qr_table' ? ' · Commande QR' : ' · Commande'}
              </p>
              <div className="flex gap-2 pt-2">
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
            </div>
          </div>
        </div>
      )}
    </>
  );
}
