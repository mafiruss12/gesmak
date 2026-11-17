import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar as CalIcon, Loader2, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { EmptyState, Badge } from '@/components/ui';
import { RENTAL_STATUS_LABELS } from '@/lib/businessTypes';
import type { RentalOrder } from '@/lib/rentalTypes';

const WEEKDAYS = ['LUN.', 'MAR.', 'MER.', 'JEU.', 'VEN.', 'SAM.', 'DIM.'];

function statusColor(s: string): 'primary' | 'warning' | 'success' | 'neutral' | 'error' {
  if (s === 'confirmed' || s === 'draft') return 'primary';
  if (s === 'out') return 'warning';
  if (s === 'returned') return 'success';
  if (s === 'cancelled') return 'error';
  return 'neutral';
}

function monthLabel(y: number, m: number) {
  return new Date(y, m, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function RentCalendar() {
  const { member, activeEstablishment } = useAuth();
  const estId = activeEstablishment?.id || member?.establishment_id || null;
  const [orders, setOrders] = useState<RentalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-11
  const [selected, setSelected] = useState<string | null>(toISODate(now));

  useEffect(() => {
    (async () => {
      if (!estId) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('rental_orders')
        .select('*')
        .eq('establishment_id', estId)
        .neq('status', 'cancelled')
        .order('event_date');
      setOrders((data ?? []) as RentalOrder[]);
      setLoading(false);
    })();
  }, [estId]);

  const byDate = useMemo(() => {
    const map: Record<string, RentalOrder[]> = {};
    for (const o of orders) {
      const d = o.event_date;
      if (!d) continue;
      if (!map[d]) map[d] = [];
      map[d].push(o);
      // aussi marquer return_date légèrement si différent
      if (o.return_date && o.return_date !== d) {
        if (!map[o.return_date]) map[o.return_date] = [];
        // avoid duplicate same order twice on return if already listed — use tag via notes in UI
        if (!map[o.return_date].find((x) => x.id === o.id)) {
          map[o.return_date].push(o);
        }
      }
    }
    return map;
  }, [orders]);

  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    // Monday-first
    let startDow = first.getDay(); // 0 Sun
    startDow = startDow === 0 ? 6 : startDow - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevDays = new Date(year, month, 0).getDate();
    const cells: { date: Date; iso: string; inMonth: boolean }[] = [];
    for (let i = 0; i < startDow; i++) {
      const day = prevDays - startDow + i + 1;
      const d = new Date(year, month - 1, day);
      cells.push({ date: d, iso: toISODate(d), inMonth: false });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      cells.push({ date: d, iso: toISODate(d), inMonth: true });
    }
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1].date;
      const d = new Date(last);
      d.setDate(d.getDate() + 1);
      cells.push({ date: d, iso: toISODate(d), inMonth: false });
    }
    return cells;
  }, [year, month]);

  function prevMonth() {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  }

  const selectedOrders = selected ? byDate[selected] || [] : [];
  const todayIso = toISODate(now);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary-500" size={28} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-2">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-100 capitalize">
            {monthLabel(year, month)}
          </h1>
          <p className="text-stone-400 text-sm">Commandes par jour (plusieurs possibles)</p>
        </div>
        <Link to="/rent/orders" className="btn-primary flex items-center gap-2 shrink-0">
          <Plus size={18} /> Commande
        </Link>
      </div>

      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={prevMonth} className="p-2 rounded-lg hover:bg-stone-800 text-stone-300">
          <ChevronLeft size={20} />
        </button>
        <button
          type="button"
          className="text-sm text-primary-400"
          onClick={() => {
            setYear(now.getFullYear());
            setMonth(now.getMonth());
            setSelected(todayIso);
          }}
        >
          Aujourd&apos;hui
        </button>
        <button type="button" onClick={nextMonth} className="p-2 rounded-lg hover:bg-stone-800 text-stone-300">
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="card p-2 mb-4">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS.map((d) => (
            <div key={d} className="text-center text-[10px] font-semibold text-stone-500 py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((c) => {
            const list = byDate[c.iso] || [];
            const isToday = c.iso === todayIso;
            const isSel = c.iso === selected;
            return (
              <button
                type="button"
                key={c.iso + String(c.inMonth)}
                onClick={() => setSelected(c.iso)}
                className={`min-h-[52px] rounded-xl p-1 text-left transition-colors ${
                  isSel ? 'bg-primary-500/25 ring-1 ring-primary-500/50' : 'hover:bg-stone-800/80'
                } ${!c.inMonth ? 'opacity-35' : ''}`}
              >
                <div
                  className={`w-7 h-7 flex items-center justify-center text-sm rounded-full mb-0.5 ${
                    isToday ? 'bg-primary-500 text-white font-bold' : 'text-stone-300'
                  }`}
                >
                  {c.date.getDate()}
                </div>
                <div className="space-y-0.5">
                  {list.slice(0, 3).map((o) => (
                    <div
                      key={o.id}
                      className={`truncate text-[9px] px-1 rounded ${
                        o.status === 'out'
                          ? 'bg-amber-500/30 text-amber-200'
                          : o.status === 'returned'
                            ? 'bg-success-500/25 text-success-300'
                            : 'bg-primary-500/25 text-primary-200'
                      }`}
                      title={o.client_name || ''}
                    >
                      {o.client_name || 'Cmd'}
                    </div>
                  ))}
                  {list.length > 3 && (
                    <div className="text-[9px] text-stone-500 px-1">+{list.length - 3}</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold text-stone-100">
          {selected
            ? new Date(selected + 'T12:00:00').toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })
            : 'Sélectionnez un jour'}
        </h2>
        <span className="text-xs text-stone-500">{selectedOrders.length} commande(s)</span>
      </div>

      {selectedOrders.length === 0 ? (
        <EmptyState
          icon={<CalIcon size={40} />}
          title="Aucune commande ce jour"
          message="Les commandes confirmées, en cours et terminées apparaissent ici."
        />
      ) : (
        <div className="space-y-2">
          {selectedOrders.map((o) => (
            <Link key={o.id} to="/rent/orders" className="card flex justify-between items-center gap-2">
              <div className="min-w-0">
                <p className="text-stone-100 font-medium truncate">{o.client_name || 'Client'}</p>
                <p className="text-xs text-stone-500">
                  Événement {o.event_date || '—'} · Retour {o.return_date || '—'}
                  {o.event_date === selected && o.return_date !== selected ? ' · jour événement' : ''}
                  {o.return_date === selected && o.event_date !== selected ? ' · jour retour' : ''}
                </p>
              </div>
              <Badge color={statusColor(o.status)}>{RENTAL_STATUS_LABELS[o.status] || o.status}</Badge>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2 text-[10px] text-stone-500">
        <span className="px-2 py-1 rounded bg-primary-500/20 text-primary-300">Confirmée / brouillon</span>
        <span className="px-2 py-1 rounded bg-amber-500/20 text-amber-300">En sortie</span>
        <span className="px-2 py-1 rounded bg-success-500/20 text-success-300">Terminée</span>
      </div>
    </div>
  );
}
