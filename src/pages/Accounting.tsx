import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calculator, Package, ChevronDown, ChevronUp, Printer, RefreshCw, Wallet, TrendingUp,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useEstId } from '@/lib/useEstId';
import { formatFCFA, todayISO } from '@/lib/format';
import { EmptyState } from '@/components/ui';
import {
  loadBeverageProfitForRange,
  loadFondsCommerce,
  mondayOfISO,
  sundayOfWeek,
  type BeveragePeriodReport,
  type FondsCommerce,
} from '@/lib/beverageProfit';

type DaySales = { date: string; sales: number; cash: number; mobile: number; profit: number };
type WeekBlock = {
  weekKey: string;
  label: string;
  monday: string;
  sunday: string;
  days: DaySales[];
  sales: number;
  /** Achats = fonds de commerce (affiché séparément, PAS dans le bénéfice) */
  purchases: number;
  expenses: number;
  /** Marge = CA − coût des boissons vendues */
  profit: number;
  cmv: number;
  linesTop: { name: string; qty: number; profit: number }[];
};
type MonthBlock = {
  monthKey: string;
  label: string;
  sales: number;
  purchases: number;
  expenses: number;
  profit: number;
  cmv: number;
  weeks: WeekBlock[];
};

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function mondayOf(dateStr: string): Date {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(12, 0, 0, 0);
  return d;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function formatFr(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}
function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

export default function Accounting() {
  const { member, effectiveRole, activeEstablishment } = useAuth();
  const estId = useEstId();
  const canSeeFinance = ['super_admin', 'admin', 'owner'].includes(
    String(effectiveRole || member?.role || '')
  );
  const [loading, setLoading] = useState(true);
  const [weeks, setWeeks] = useState<WeekBlock[]>([]);
  const [months, setMonths] = useState<MonthBlock[]>([]);
  const [fonds, setFonds] = useState<FondsCommerce | null>(null);
  const [openWeek, setOpenWeek] = useState<string | null>(null);
  const [openMonth, setOpenMonth] = useState<string | null>(null);
  const [view, setView] = useState<'weeks' | 'months'>('weeks');

  const load = useCallback(async () => {
    if (!estId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
    const today = todayISO();
    const startMon = mondayOf(today);
    startMon.setDate(startMon.getDate() - 7 * 15);
    const fromDay = toISODate(startMon);

    const [reportsRes, purchasesRes, expensesRes, fondsData] = await Promise.all([
      supabase
        .from('daily_reports')
        .select('date, total_sales, total_expenses, cash, mobile_money, notes')
        .eq('establishment_id', estId)
        .gte('date', fromDay)
        .order('date', { ascending: true }),
      supabase
        .from('purchases')
        .select('total, status, created_at')
        .eq('establishment_id', estId)
        .gte('created_at', fromDay + 'T00:00:00'),
      supabase
        .from('expenses')
        .select('amount, created_at')
        .eq('establishment_id', estId)
        .gte('created_at', fromDay + 'T00:00:00'),
      loadFondsCommerce(estId),
    ]);

    setFonds(fondsData);

    const reports = reportsRes.data ?? [];
    const purchases = (purchasesRes.data ?? []).filter(
      (r) => !r.status || ['received', 'paid', 'completed'].includes(String(r.status))
    );
    const expenses = expensesRes.data ?? [];

    const salesByDay = new Map<string, DaySales>();
    for (const r of reports) {
      const date = String(r.date).slice(0, 10);
      const prev = salesByDay.get(date) || { date, sales: 0, cash: 0, mobile: 0, profit: 0 };
      prev.sales += Number(r.total_sales || 0);
      prev.cash += Number(r.cash || 0);
      prev.mobile += Number(r.mobile_money || 0);
      salesByDay.set(date, prev);
    }

    // Marge jour : calcul local depuis notes (évite N requêtes)
    const profitByDay = new Map<string, number>();
    for (const r of reports) {
      const date = String(r.date).slice(0, 10);
      let dayProfit = 0;
      try {
        const notes = String(r.notes || '');
        if (notes.trim().startsWith('{')) {
          const parsed = JSON.parse(notes) as { items?: { qty?: number; price?: number; cost?: number }[] };
          for (const it of parsed.items || []) {
            const qty = Math.max(0, Math.floor(Number(it.qty) || 0));
            if (!qty) continue;
            dayProfit += qty * ((Number(it.price) || 0) - (Number(it.cost) || 0));
          }
        }
      } catch { /* */ }
      profitByDay.set(date, dayProfit);
      const ds = salesByDay.get(date);
      if (ds) ds.profit = dayProfit;
    }

    const purchByDay = new Map<string, number>();
    for (const p of purchases) {
      const date = String(p.created_at).slice(0, 10);
      purchByDay.set(date, (purchByDay.get(date) || 0) + Number(p.total || 0));
    }
    const expByDay = new Map<string, number>();
    for (const e of expenses) {
      const date = String(e.created_at).slice(0, 10);
      expByDay.set(date, (expByDay.get(date) || 0) + Number(e.amount || 0));
    }
    for (const r of reports) {
      const date = String(r.date).slice(0, 10);
      const te = Number(r.total_expenses || 0);
      if (te) expByDay.set(date, (expByDay.get(date) || 0) + te);
    }

    const weekList: WeekBlock[] = [];
    const cursor = mondayOf(today);
    for (let i = 0; i < 16; i++) {
      const mon = addDays(cursor, -7 * i);
      const monday = toISODate(mon);
      const sunday = toISODate(addDays(mon, 6));
      const days: DaySales[] = [];
      let sales = 0,
        purch = 0,
        exp = 0,
        profit = 0;
      for (let d = 0; d < 7; d++) {
        const iso = toISODate(addDays(mon, d));
        const daySales = salesByDay.get(iso) || {
          date: iso,
          sales: 0,
          cash: 0,
          mobile: 0,
          profit: profitByDay.get(iso) || 0,
        };
        if (!salesByDay.has(iso)) daySales.profit = profitByDay.get(iso) || 0;
        days.push(daySales);
        sales += daySales.sales;
        profit += daySales.profit;
        purch += purchByDay.get(iso) || 0;
        exp += expByDay.get(iso) || 0;
      }
      const weekRep = await loadBeverageProfitForRange(estId, monday, sunday);
      // Prefer detailed week aggregation
      profit = weekRep.totalProfit;
      sales = weekRep.totalCA || sales;
      const isCurrent = monday === toISODate(mondayOf(today));
      if (!isCurrent && sales === 0 && purch === 0 && exp === 0 && profit === 0) continue;
      weekList.push({
        weekKey: monday,
        label: `Semaine du ${formatFr(monday)} au ${formatFr(sunday)}`,
        monday,
        sunday,
        days,
        sales,
        purchases: purch,
        expenses: exp,
        profit,
        cmv: weekRep.totalCost,
        linesTop: weekRep.lines.slice(0, 5).map((l) => ({
          name: l.name,
          qty: l.qty_out,
          profit: l.profit,
        })),
      });
    }

    const monthMap = new Map<string, MonthBlock>();
    for (const w of weekList) {
      const thu = toISODate(addDays(new Date(w.monday + 'T12:00:00'), 3));
      const monthKey = thu.slice(0, 7);
      let m = monthMap.get(monthKey);
      if (!m) {
        m = {
          monthKey,
          label: monthLabel(monthKey),
          sales: 0,
          purchases: 0,
          expenses: 0,
          profit: 0,
          cmv: 0,
          weeks: [],
        };
        monthMap.set(monthKey, m);
      }
      m.weeks.push(w);
      m.sales += w.sales;
      m.purchases += w.purchases;
      m.expenses += w.expenses;
      m.profit += w.profit;
      m.cmv += w.cmv;
    }
    const monthList = Array.from(monthMap.values()).sort((a, b) =>
      b.monthKey.localeCompare(a.monthKey)
    );
    setWeeks(weekList);
    setMonths(monthList);
    if (weekList[0]) setOpenWeek(weekList[0].weekKey);
    if (monthList[0]) setOpenMonth(monthList[0].monthKey);
    } catch (e) {
      console.error('Accounting load', e);
    } finally {
      setLoading(false);
    }
  }, [estId]);

  useEffect(() => {
    void load();
  }, [load]);
  const currentMonth = useMemo(() => months[0] || null, [months]);
  const currentWeek = useMemo(() => weeks[0] || null, [weeks]);

  function printMonthReport(m: MonthBlock) {
    const estName = activeEstablishment?.name || 'Établissement';
    const rows = m.weeks
      .map(
        (w) =>
          `<tr><td style="padding:8px;border:1px solid #ddd">${w.label}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:right">${formatFCFA(w.sales)}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:right">${formatFCFA(w.cmv)}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:right;font-weight:bold;color:${w.profit >= 0 ? '#047857' : '#b91c1c'}">${formatFCFA(w.profit)}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:right;color:#666">${formatFCFA(w.purchases)}</td></tr>`
      )
      .join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Rapport ${m.label}</title>
<style>body{font-family:system-ui,sans-serif;padding:24px}h1{color:#b45309}table{border-collapse:collapse;width:100%;margin-top:16px}th{background:#fef3c7;padding:8px;border:1px solid #ddd;text-align:left}</style></head><body>
<h1>Rapport mensuel — ${m.label}</h1>
<p><strong>${estName}</strong> · ${new Date().toLocaleString('fr-FR')}</p>
<p>CA ventes ${formatFCFA(m.sales)} · Coût boissons vendues ${formatFCFA(m.cmv)}</p>
<p style="font-size:1.25rem">Bénéfice (marge) : <strong style="color:${m.profit >= 0 ? '#047857' : '#b91c1c'}">${formatFCFA(m.profit)}</strong></p>
<p style="font-size:0.9rem;color:#666">Achats stock (fonds de commerce, hors bénéfice) : ${formatFCFA(m.purchases)} · Autres dépenses : ${formatFCFA(m.expenses)}</p>
<table><thead><tr><th>Semaine lun→dim</th><th>CA</th><th>Coût vendu</th><th>Bénéfice</th><th>Achats stock</th></tr></thead><tbody>${rows}</tbody></table>
<p style="margin-top:24px;font-size:12px;color:#666">GESMAK · Bénéfice = ventes − coût des boissons vendues</p>
<script>window.onload=function(){window.print()}<\/script></body></html>`;
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  }

  if (!canSeeFinance)
    return (
      <EmptyState
        icon={<Calculator size={40} />}
        title="Comptabilité réservée"
        message="Réservée au propriétaire / administrateur."
      />
    );
  if (!estId)
    return (
      <EmptyState
        icon={<Calculator size={40} />}
        title="Aucun établissement"
        message="Sélectionnez un établissement."
      />
    );
  if (loading)
    return <div className="flex justify-center py-20 text-stone-400">Chargement…</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-100 flex items-center gap-2">
            <Calculator className="text-amber-400" /> Comptabilité
          </h1>
          <p className="text-sm text-stone-400 mt-1">
            Bénéfice = marge sur boissons vendues (rapport du jour) · Achats = fonds de commerce
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="btn-secondary flex items-center gap-1 text-sm"
        >
          <RefreshCw size={14} /> Actualiser
        </button>
      </div>

      {/* 3 pots */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-[11px] uppercase text-amber-200/80 flex items-center gap-1">
            <TrendingUp size={12} /> Bénéfice semaine
          </p>
          <p className="text-xl font-bold text-amber-100">
            {formatFCFA(currentWeek?.profit || 0)}
          </p>
          <p className="text-[10px] text-amber-200/60 mt-1">Marge CA − coût vendu</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4">
          <p className="text-[11px] uppercase text-emerald-200/80 flex items-center gap-1">
            <Wallet size={12} /> Bénéfice mois
          </p>
          <p className="text-xl font-bold text-emerald-100">
            {formatFCFA(currentMonth?.profit || 0)}
          </p>
        </div>
        <div className="rounded-2xl border border-sky-500/25 bg-sky-500/10 p-4">
          <p className="text-[11px] uppercase text-sky-200/80 flex items-center gap-1">
            <Package size={12} /> Fonds de commerce
          </p>
          <p className="text-xl font-bold text-sky-100">
            {formatFCFA(fonds?.stockValueAtCost || 0)}
          </p>
          <p className="text-[10px] text-sky-200/60 mt-1">
            Stock au coût · capital à reconduire
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-stone-800 bg-stone-900/50 p-3 text-xs text-stone-400">
        Les <strong className="text-stone-300">achats de stock</strong> ne réduisent pas le bénéfice :
        c’est le capital marchandise. Seule la <strong className="text-stone-300">marge par boisson
        vendue</strong> (ex. acheté 400 F, vendu 500 F → +100 F) compte comme bénéfice.
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
            view === 'weeks' ? 'bg-amber-500/20 text-amber-200' : 'text-stone-400'
          }`}
          onClick={() => setView('weeks')}
        >
          Par semaine
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
            view === 'months' ? 'bg-amber-500/20 text-amber-200' : 'text-stone-400'
          }`}
          onClick={() => setView('months')}
        >
          Par mois
        </button>
      </div>

      {view === 'weeks' && (
        <div className="space-y-3">
          {weeks.length === 0 ? (
            <p className="text-stone-500 text-sm">Aucune activité.</p>
          ) : (
            weeks.map((w) => {
              const open = openWeek === w.weekKey;
              return (
                <div key={w.weekKey} className="card border border-stone-800">
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 text-left"
                    onClick={() => setOpenWeek(open ? null : w.weekKey)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-stone-100 text-sm">{w.label}</p>
                      <p className="text-xs text-stone-500">
                        CA {formatFCFA(w.sales)} · Coût vendu {formatFCFA(w.cmv)} · Bénéfice{' '}
                        <span className={w.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                          {formatFCFA(w.profit)}
                        </span>
                        {' · '}
                        Achats stock{' '}
                        <span className="text-sky-400">{formatFCFA(w.purchases)}</span>
                      </p>
                    </div>
                    {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  {open && (
                    <div className="mt-3 space-y-2 border-t border-stone-800 pt-3">
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="rounded-lg bg-stone-900 p-2">
                          <p className="text-stone-500">CA</p>
                          <p className="font-semibold text-stone-200">{formatFCFA(w.sales)}</p>
                        </div>
                        <div className="rounded-lg bg-stone-900 p-2">
                          <p className="text-stone-500">Coût vendu</p>
                          <p className="font-semibold text-stone-200">{formatFCFA(w.cmv)}</p>
                        </div>
                        <div className="rounded-lg bg-stone-900 p-2">
                          <p className="text-stone-500">Bénéfice</p>
                          <p
                            className={`font-semibold ${
                              w.profit >= 0 ? 'text-emerald-300' : 'text-red-300'
                            }`}
                          >
                            {formatFCFA(w.profit)}
                          </p>
                        </div>
                      </div>
                      {w.linesTop.length > 0 && (
                        <div className="text-xs space-y-1">
                          <p className="text-stone-500 font-medium">Top marges</p>
                          {w.linesTop.map((l) => (
                            <div key={l.name} className="flex justify-between text-stone-400">
                              <span>
                                {l.name} × {l.qty}
                              </span>
                              <span className="text-emerald-400">{formatFCFA(l.profit)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="space-y-1">
                        {w.days.map((d) => {
                          const dayName = new Date(d.date + 'T12:00:00').toLocaleDateString(
                            'fr-FR',
                            { weekday: 'short', day: '2-digit', month: 'short' }
                          );
                          return (
                            <div
                              key={d.date}
                              className="flex justify-between text-xs text-stone-500 py-0.5"
                            >
                              <span>{dayName}</span>
                              <span>
                                CA {formatFCFA(d.sales)} · Bénéf.{' '}
                                <span className="text-emerald-400/90">{formatFCFA(d.profit)}</span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {view === 'months' && (
        <div className="space-y-3">
          {months.map((m) => {
            const open = openMonth === m.monthKey;
            return (
              <div key={m.monthKey} className="card border border-stone-800">
                <button
                  type="button"
                  className="w-full flex items-center gap-2 text-left"
                  onClick={() => setOpenMonth(open ? null : m.monthKey)}
                >
                  <div className="flex-1">
                    <p className="font-medium text-stone-100 capitalize">{m.label}</p>
                    <p className="text-xs text-stone-500">
                      {formatFCFA(m.sales)} CA · bénéfice{' '}
                      <span className={m.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {formatFCFA(m.profit)}
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    className="p-2 text-stone-400 hover:text-amber-300"
                    onClick={(e) => {
                      e.stopPropagation();
                      printMonthReport(m);
                    }}
                    title="Imprimer"
                  >
                    <Printer size={16} />
                  </button>
                  {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {open && (
                  <div className="mt-3 space-y-2 border-t border-stone-800 pt-3">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-stone-900 p-2">
                        Bénéfice
                        <p
                          className={`font-bold ${
                            m.profit >= 0 ? 'text-emerald-300' : 'text-red-300'
                          }`}
                        >
                          {formatFCFA(m.profit)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-stone-900 p-2">
                        Achats stock
                        <p className="font-bold text-sky-300">{formatFCFA(m.purchases)}</p>
                      </div>
                    </div>
                    {m.weeks.map((w) => (
                      <div
                        key={w.weekKey}
                        className="flex justify-between text-xs text-stone-400 py-1 border-b border-stone-800/50"
                      >
                        <span>{w.label}</span>
                        <span className={w.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                          {formatFCFA(w.profit)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
