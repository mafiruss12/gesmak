import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Building2,
  Download,
  Printer,
  RefreshCw,
  Calendar,
  Package,
  Users,
  AlertTriangle,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useEstId } from '@/lib/useEstId';
import { formatFCFA, formatDate, todayISO } from '@/lib/format';
import {
  BUSINESS_LABELS,
  BUSINESS_THEMES,
  normalizeBusinessType,
} from '@/lib/businessTypes';
import { EmptyState } from '@/components/ui';
import type { DailyReport, Employee, Expense, Product, Purchase, Sale } from '@/lib/types';

type PeriodPreset = 'today' | '7d' | 'month' | 'prev_month' | '90d' | 'custom';

type ChargeLine = {
  id: string;
  date: string;
  source: 'expense' | 'loss' | 'payroll' | 'purchase';
  category: string;
  description: string;
  amount: number;
  paymentMethod?: string | null;
};

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDaysISO(iso: string, delta: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + delta);
  return toISO(d);
}

function diffDaysInclusive(from: string, to: string): number {
  const a = new Date(from + 'T00:00:00').getTime();
  const b = new Date(to + 'T00:00:00').getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 1;
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

function presetRange(preset: Exclude<PeriodPreset, 'custom'>): { from: string; to: string } {
  const today = todayISO();
  const now = new Date(today + 'T12:00:00');
  if (preset === 'today') return { from: today, to: today };
  if (preset === '7d') return { from: addDaysISO(today, -6), to: today };
  if (preset === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: toISO(start), to: today };
  }
  if (preset === 'prev_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: toISO(start), to: toISO(end) };
  }
  return { from: addDaysISO(today, -89), to: today };
}

function parseReportItemsCost(notes: string | null | undefined, costMap: Map<string, number>): number {
  if (!notes || typeof notes !== 'string') return 0;
  const trimmed = notes.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return 0;
  try {
    const parsed = JSON.parse(trimmed) as { items?: { product_id?: string; qty?: number; cost?: number }[] } | { product_id?: string; qty?: number; cost?: number }[];
    const items = Array.isArray(parsed) ? parsed : parsed.items || [];
    let cogs = 0;
    for (const it of items) {
      const qty = Math.max(0, Number(it.qty) || 0);
      if (!qty) continue;
      const explicitCost = Number(it.cost);
      const unitCost =
        Number.isFinite(explicitCost) && explicitCost >= 0
          ? explicitCost
          : (it.product_id ? costMap.get(String(it.product_id)) || 0 : 0);
      cogs += qty * unitCost;
    }
    return cogs;
  } catch {
    return 0;
  }
}

export default function FinancialReports() {
  const { member, effectiveRole, activeEstablishment } = useAuth();
  const estId = useEstId();
  const role = String(effectiveRole || member?.role || '').toLowerCase();
  const canSeeFinance = ['super_admin', 'admin', 'owner'].includes(role);

  const [preset, setPreset] = useState<PeriodPreset>('month');
  const initialRange = presetRange('month');
  const [fromDate, setFromDate] = useState<string>(initialRange.from);
  const [toDate, setToDate] = useState<string>(initialRange.to);
  const [includePayroll, setIncludePayroll] = useState<boolean>(true);
  const [chargeFilter, setChargeFilter] = useState<'all' | 'expense' | 'purchase' | 'loss'>('all');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [prevSales, setPrevSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [prevExpenses, setPrevExpenses] = useState<Expense[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [prevReports, setPrevReports] = useState<DailyReport[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [extraRevenue, setExtraRevenue] = useState<number>(0);

  const bizType = normalizeBusinessType(activeEstablishment?.type);
  const theme = BUSINESS_THEMES[bizType];

  function selectPreset(next: PeriodPreset) {
    setPreset(next);
    if (next !== 'custom') {
      const r = presetRange(next);
      setFromDate(r.from);
      setToDate(r.to);
    }
  }

  const load = useCallback(async () => {
    if (!estId || !canSeeFinance) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const safeFrom = fromDate <= toDate ? fromDate : toDate;
      const safeTo = fromDate <= toDate ? toDate : fromDate;
      const spanDays = diffDaysInclusive(safeFrom, safeTo);
      const prevTo = addDaysISO(safeFrom, -1);
      const prevFrom = addDaysISO(prevTo, -(spanDays - 1));

      const fromIso = `${safeFrom}T00:00:00`;
      const toIso = `${safeTo}T23:59:59.999`;
      const prevFromIso = `${prevFrom}T00:00:00`;
      const prevToIso = `${prevTo}T23:59:59.999`;

      const [
        prodRes,
        salesRes,
        prevSalesRes,
        expRes,
        prevExpRes,
        purRes,
        repRes,
        prevRepRes,
        empRes,
      ] = await Promise.all([
        supabase
          .from('products')
          .select('id, name, cost, price, stock')
          .eq('establishment_id', estId),
        supabase
          .from('sales')
          .select('id, product_id, qty, unit_price, total, payment_method, created_at')
          .eq('establishment_id', estId)
          .gte('created_at', fromIso)
          .lte('created_at', toIso),
        supabase
          .from('sales')
          .select('id, product_id, qty, unit_price, total, created_at')
          .eq('establishment_id', estId)
          .gte('created_at', prevFromIso)
          .lte('created_at', prevToIso),
        supabase
          .from('expenses')
          .select('id, category, description, amount, payment_method, created_at')
          .eq('establishment_id', estId)
          .gte('created_at', fromIso)
          .lte('created_at', toIso)
          .order('created_at', { ascending: false }),
        supabase
          .from('expenses')
          .select('id, amount, created_at')
          .eq('establishment_id', estId)
          .gte('created_at', prevFromIso)
          .lte('created_at', prevToIso),
        supabase
          .from('purchases')
          .select('id, product_id, qty, unit_cost, total, status, notes, created_at')
          .eq('establishment_id', estId)
          .gte('created_at', fromIso)
          .lte('created_at', toIso)
          .order('created_at', { ascending: false }),
        supabase
          .from('daily_reports')
          .select('id, date, total_sales, total_expenses, cash, mobile_money, losses, broken, notes')
          .eq('establishment_id', estId)
          .gte('date', safeFrom)
          .lte('date', safeTo)
          .order('date', { ascending: false }),
        supabase
          .from('daily_reports')
          .select('id, date, total_sales, total_expenses, losses, broken, notes')
          .eq('establishment_id', estId)
          .gte('date', prevFrom)
          .lte('date', prevTo),
        supabase
          .from('employees')
          .select('id, name, role, salary, status')
          .eq('establishment_id', estId),
      ]);

      let extraRev = 0;
      if (bizType === 'location_event' || bizType === 'complexe') {
        try {
          const { data: rentPay } = await supabase
            .from('rent_payments')
            .select('amount, paid_at, created_at')
            .eq('establishment_id', estId)
            .gte('created_at', fromIso)
            .lte('created_at', toIso);
          for (const rp of (rentPay || []) as { amount?: number | null }[]) {
            extraRev += Number(rp.amount || 0);
          }
        } catch {
          /* table optionnelle */
        }
      }
      if (bizType === 'complexe') {
        try {
          const { data: hotelRes } = await supabase
            .from('hotel_reservations')
            .select('paid_amount, total_amount, status, created_at')
            .eq('establishment_id', estId)
            .gte('created_at', fromIso)
            .lte('created_at', toIso);
          for (const hr of (hotelRes || []) as { paid_amount?: number | null; total_amount?: number | null; status?: string | null }[]) {
            if (String(hr.status || '') !== 'cancelled') {
              extraRev += Number(hr.paid_amount ?? hr.total_amount ?? 0);
            }
          }
        } catch {
          /* table optionnelle */
        }
      }

      setProducts((prodRes.data ?? []) as Product[]);
      setSales((salesRes.data ?? []) as Sale[]);
      setPrevSales((prevSalesRes.data ?? []) as Sale[]);
      setExpenses((expRes.data ?? []) as Expense[]);
      setPrevExpenses((prevExpRes.data ?? []) as Expense[]);
      setPurchases((purRes.data ?? []) as Purchase[]);
      setReports((repRes.data ?? []) as DailyReport[]);
      setPrevReports((prevRepRes.data ?? []) as DailyReport[]);
      setEmployees((empRes.data ?? []) as Employee[]);
      setExtraRevenue(extraRev);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement des rapports financiers');
    } finally {
      setLoading(false);
    }
  }, [estId, canSeeFinance, fromDate, toDate, bizType]);

  useEffect(() => {
    void load();
  }, [load]);

  const analytics = useMemo(() => {
    const safeFrom = fromDate <= toDate ? fromDate : toDate;
    const safeTo = fromDate <= toDate ? toDate : fromDate;
    const spanDays = diffDaysInclusive(safeFrom, safeTo);

    const costMap = new Map<string, number>();
    const nameMap = new Map<string, string>();
    for (const p of products) {
      costMap.set(p.id, Number(p.cost) || 0);
      nameMap.set(p.id, p.name);
    }

    // Ventes par jour (POS) pour éviter le double comptage avec daily_reports
    const salesByDay = new Map<string, { revenue: number; cogs: number }>();
    for (const s of sales) {
      const day = String(s.created_at).slice(0, 10);
      const prev = salesByDay.get(day) || { revenue: 0, cogs: 0 };
      const rev = Number(s.total) || 0;
      const unitCost = s.product_id ? (costMap.get(s.product_id) || 0) : 0;
      const cogs = (Number(s.qty) || 0) * unitCost;
      prev.revenue += rev;
      prev.cogs += cogs;
      salesByDay.set(day, prev);
    }

    const expByDay = new Map<string, number>();
    for (const e of expenses) {
      const day = String(e.created_at).slice(0, 10);
      expByDay.set(day, (expByDay.get(day) || 0) + (Number(e.amount) || 0));
    }

    let posRevenue = 0;
    let posCogs = 0;
    for (const v of salesByDay.values()) {
      posRevenue += v.revenue;
      posCogs += v.cogs;
    }

    let manualReportRevenue = 0;
    let manualReportCogs = 0;
    let reportOnlyExpenses = 0;
    let lossesAndBroken = 0;
    const extraLossLines: ChargeLine[] = [];

    for (const r of reports) {
      const d = String(r.date).slice(0, 10);
      const hasPosForDay = salesByDay.has(d);
      if (!hasPosForDay && Number(r.total_sales || 0) > 0) {
        manualReportRevenue += Number(r.total_sales || 0);
        manualReportCogs += parseReportItemsCost(r.notes, costMap);
      }
      if (!expByDay.has(d) && Number(r.total_expenses || 0) > 0) {
        reportOnlyExpenses += Number(r.total_expenses || 0);
        extraLossLines.push({
          id: `rep-exp-${r.id}`,
          date: d,
          source: 'expense',
          category: 'Dépense clôture',
          description: `Dépenses déclarées au rapport du ${formatDate(d)}`,
          amount: Number(r.total_expenses || 0),
        });
      }
      const lossAmt = Number(r.losses || 0) + Number(r.broken || 0);
      if (lossAmt > 0) {
        lossesAndBroken += lossAmt;
        extraLossLines.push({
          id: `loss-${r.id}`,
          date: d,
          source: 'loss',
          category: 'Pertes & Casse',
          description: `Pertes (${formatFCFA(r.losses || 0)}) + Casse (${formatFCFA(r.broken || 0)})`,
          amount: lossAmt,
        });
      }
    }

    const totalRevenue = posRevenue + manualReportRevenue + extraRevenue;
    const totalCogs = posCogs + manualReportCogs;
    const grossMargin = totalRevenue - totalCogs;

    const expensesTotal = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0) + reportOnlyExpenses;

    // Salaires déjà enregistrés dans `expenses` sous catégorie "Salaires"
    const recordedSalaryExpenses = expenses
      .filter((e) => e.category.toLowerCase().includes('salaire'))
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);

    const activeEmployees = employees.filter((emp) => emp.status === 'active' && Number(emp.salary) > 0);
    const monthlyPayroll = activeEmployees.reduce((s, emp) => s + (Number(emp.salary) || 0), 0);
    const proratedPayrollRaw = monthlyPayroll > 0 ? Math.round((monthlyPayroll / 30) * spanDays) : 0;
    // Éviter le double comptage si des salaires ont déjà été saisis dans `expenses`
    const additionalPayroll = includePayroll
      ? Math.max(0, proratedPayrollRaw - recordedSalaryExpenses)
      : 0;

    const activePurchases = purchases.filter((p) => p.status !== 'cancelled');
    const purchasesTotal = activePurchases.reduce((s, p) => s + (Number(p.total) || 0), 0);

    const consolidatedCharges = expensesTotal + lossesAndBroken + additionalPayroll;
    const netProfit = grossMargin - consolidatedCharges;
    const netMarginPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    const cashFlowAfterRestock = totalRevenue - consolidatedCharges - purchasesTotal;

    // Période précédente pour comparaison
    const prevSalesDays = new Map<string, number>();
    let prevPosRev = 0;
    let prevPosCogs = 0;
    for (const s of prevSales) {
      const d = String(s.created_at).slice(0, 10);
      prevSalesDays.set(d, (prevSalesDays.get(d) || 0) + (Number(s.total) || 0));
      prevPosRev += Number(s.total) || 0;
      prevPosCogs += (Number(s.qty) || 0) * (s.product_id ? (costMap.get(s.product_id) || 0) : 0);
    }
    let prevRepRev = 0;
    let prevRepCogs = 0;
    let prevLosses = 0;
    const prevExpDays = new Set(prevExpenses.map((e) => String(e.created_at).slice(0, 10)));
    let prevRepExp = 0;
    for (const r of prevReports) {
      const d = String(r.date).slice(0, 10);
      if (!prevSalesDays.has(d)) {
        prevRepRev += Number(r.total_sales || 0);
        prevRepCogs += parseReportItemsCost(r.notes, costMap);
      }
      if (!prevExpDays.has(d)) prevRepExp += Number(r.total_expenses || 0);
      prevLosses += Number(r.losses || 0) + Number(r.broken || 0);
    }
    const prevRevTotal = prevPosRev + prevRepRev;
    const prevChargesTotal =
      prevExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0) +
      prevRepExp +
      prevLosses +
      additionalPayroll;
    const prevNetProfit = (prevRevTotal - prevPosCogs - prevRepCogs) - prevChargesTotal;

    // Regroupement charges consolidées par catégorie
    const categoryTotals = new Map<string, number>();
    for (const e of expenses) {
      const cat = e.category || 'Autre';
      categoryTotals.set(cat, (categoryTotals.get(cat) || 0) + (Number(e.amount) || 0));
    }
    if (reportOnlyExpenses > 0) {
      categoryTotals.set('Dépenses clôture', (categoryTotals.get('Dépenses clôture') || 0) + reportOnlyExpenses);
    }
    if (lossesAndBroken > 0) {
      categoryTotals.set('Pertes & Casse', (categoryTotals.get('Pertes & Casse') || 0) + lossesAndBroken);
    }
    if (additionalPayroll > 0) {
      categoryTotals.set(
        'Masse salariale (prorata RH)',
        (categoryTotals.get('Masse salariale (prorata RH)') || 0) + additionalPayroll,
      );
    }
    const categoriesBreakdown = Array.from(categoryTotals.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        pct: consolidatedCharges > 0 ? (amount / consolidatedCharges) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    // Série journalière (jusqu'à 31 derniers jours de la plage pour la lisibilité)
    const dayMap = new Map<string, { date: string; revenue: number; charges: number; cogs: number }>();
    const ensureDay = (date: string) => {
      let row = dayMap.get(date);
      if (!row) {
        row = { date, revenue: 0, charges: 0, cogs: 0 };
        dayMap.set(date, row);
      }
      return row;
    };
    for (const [d, v] of salesByDay.entries()) {
      const row = ensureDay(d);
      row.revenue += v.revenue;
      row.cogs += v.cogs;
    }
    for (const r of reports) {
      const d = String(r.date).slice(0, 10);
      const row = ensureDay(d);
      if (!salesByDay.has(d) && Number(r.total_sales || 0) > 0) {
        row.revenue += Number(r.total_sales || 0);
        row.cogs += parseReportItemsCost(r.notes, costMap);
      }
      if (!expByDay.has(d) && Number(r.total_expenses || 0) > 0) {
        row.charges += Number(r.total_expenses || 0);
      }
      row.charges += Number(r.losses || 0) + Number(r.broken || 0);
    }
    for (const e of expenses) {
      const d = String(e.created_at).slice(0, 10);
      ensureDay(d).charges += Number(e.amount) || 0;
    }
    const dailySeries = Array.from(dayMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30)
      .map((d) => ({
        ...d,
        net: d.revenue - d.cogs - d.charges,
      }));

    // Grand livre des charges consolidées
    const ledger: ChargeLine[] = [
      ...expenses.map((e) => ({
        id: e.id,
        date: String(e.created_at).slice(0, 10),
        source: 'expense' as const,
        category: e.category || 'Autre',
        description: e.description || e.category || 'Dépense',
        amount: Number(e.amount) || 0,
        paymentMethod: e.payment_method,
      })),
      ...extraLossLines,
      ...activePurchases.map((p) => ({
        id: p.id,
        date: String(p.created_at).slice(0, 10),
        source: 'purchase' as const,
        category: 'Achat stock',
        description: `${p.product_id ? (nameMap.get(p.product_id) || 'Article') : 'Réapprovisionnement'} × ${p.qty}${p.notes ? ` · ${p.notes}` : ''}`,
        amount: Number(p.total) || 0,
      })),
    ].sort((a, b) => b.date.localeCompare(a.date));

    const filteredLedger =
      chargeFilter === 'all' ? ledger : ledger.filter((l) => l.source === chargeFilter);

    return {
      spanDays,
      totalRevenue,
      totalCogs,
      grossMargin,
      expensesTotal,
      lossesAndBroken,
      monthlyPayroll,
      proratedPayrollRaw,
      recordedSalaryExpenses,
      additionalPayroll,
      consolidatedCharges,
      purchasesTotal,
      netProfit,
      netMarginPct,
      cashFlowAfterRestock,
      prevNetProfit,
      prevRevTotal,
      categoriesBreakdown,
      dailySeries,
      filteredLedger,
      activeEmployeesCount: activeEmployees.length,
    };
  }, [
    fromDate,
    toDate,
    products,
    sales,
    prevSales,
    expenses,
    prevExpenses,
    purchases,
    reports,
    prevReports,
    employees,
    extraRevenue,
    includePayroll,
    chargeFilter,
  ]);

  function exportCsv() {
    const estName = activeEstablishment?.name || 'Etablissement';
    const headers = ['Date', 'Type', 'Catégorie', 'Description', 'Montant (FCFA)'];
    const rows = analytics.filteredLedger.map((l) => [
      l.date,
      l.source === 'purchase' ? 'Achat stock' : l.source === 'loss' ? 'Perte/Casse' : 'Charge',
      `"${l.category.replace(/"/g, '""')}"`,
      `"${l.description.replace(/"/g, '""')}"`,
      Math.round(l.amount),
    ]);
    const summaryRows = [
      [],
      ['SYNTHESE FINANCIERE', `"${estName.replace(/"/g, '""')}"`, `${fromDate} au ${toDate}`, '', ''],
      ['Chiffre d affaires', '', '', '', Math.round(analytics.totalRevenue)],
      ['Cout des ventes (CMV)', '', '', '', Math.round(analytics.totalCogs)],
      ['Marge brute', '', '', '', Math.round(analytics.grossMargin)],
      ['Charges consolidees', '', '', '', Math.round(analytics.consolidatedCharges)],
      ['Benefice net', '', '', '', Math.round(analytics.netProfit)],
      ['Achats stock (hors P&L)', '', '', '', Math.round(analytics.purchasesTotal)],
    ];
    const csv = [headers, ...rows, ...summaryRows].map((r) => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport_financier_${fromDate}_${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!canSeeFinance) {
    return (
      <EmptyState
        icon={<TrendingUp size={44} />}
        title="Accès réservé"
        message="Les rapports financiers consolidés sont réservés au propriétaire et à l'administrateur."
      />
    );
  }

  if (!estId) {
    return (
      <EmptyState
        icon={<Building2 size={44} />}
        title="Aucun établissement actif"
        message="Sélectionnez un établissement pour consulter ses bénéfices nets et charges consolidées."
      />
    );
  }

  const netPositive = analytics.netProfit >= 0;
  const deltaNet = analytics.netProfit - analytics.prevNetProfit;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* En-tête avec établissement actif et logo */}
      <div
        className="rounded-2xl border bg-stone-900/90 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4"
        style={{ borderColor: `${theme.primary}55` }}
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div
            className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 border flex items-center justify-center bg-stone-950 shadow-sm"
            style={{ borderColor: `${theme.primary}66` }}
          >
            {activeEstablishment?.logo_url ? (
              <img
                src={activeEstablishment.logo_url}
                alt={activeEstablishment.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Building2 size={26} style={{ color: theme.primary }} />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-wider font-bold text-stone-400">
                Établissement actif
              </span>
              <span
                className="px-2 py-0.5 rounded-md text-[10px] font-bold"
                style={{ background: theme.primarySoft, color: theme.primary }}
              >
                {BUSINESS_LABELS[bizType]}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold font-display text-stone-100 truncate mt-0.5">
              Rapports Financiers — {activeEstablishment?.name || 'Établissement'}
            </h1>
            <p className="text-xs sm:text-sm text-stone-400">
              Bénéfices nets, marge brute et charges consolidées sur la période sélectionnée
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap" data-no-print>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="btn-secondary flex items-center gap-1.5 text-xs sm:text-sm"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Actualiser
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={loading}
            className="btn-secondary flex items-center gap-1.5 text-xs sm:text-sm"
          >
            <Download size={15} /> Export CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="btn-primary flex items-center gap-1.5 text-xs sm:text-sm"
          >
            <Printer size={15} /> Imprimer
          </button>
        </div>
      </div>

      {/* Sélecteur de période */}
      <div className="card space-y-3" data-no-print>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['today', "Aujourd'hui"],
                ['7d', '7 jours'],
                ['month', 'Ce mois'],
                ['prev_month', 'Mois dernier'],
                ['90d', '90 jours'],
                ['custom', 'Personnalisée'],
              ] as [PeriodPreset, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => selectPreset(key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
                  preset === key
                    ? 'text-white border-transparent shadow-sm'
                    : 'border-stone-700 bg-stone-900 text-stone-300 hover:border-stone-500'
                }`}
                style={preset === key ? { backgroundColor: theme.primary } : undefined}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includePayroll}
              onChange={(e) => setIncludePayroll(e.target.checked)}
              className="accent-amber-500"
            />
            Inclure masse salariale RH proratisée ({analytics.activeEmployeesCount} actif{analytics.activeEmployeesCount > 1 ? 's' : ''})
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="label flex items-center gap-1 text-xs">
              <Calendar size={12} /> Du
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setPreset('custom');
                setFromDate(e.target.value);
              }}
              className="input-field"
            />
          </div>
          <div>
            <label className="label flex items-center gap-1 text-xs">
              <Calendar size={12} /> Au
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setPreset('custom');
                setToDate(e.target.value);
              }}
              className="input-field"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-stone-400">Calcul des résultats financiers…</div>
      ) : (
        <>
          {/* 4 KPI principaux */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="text-[11px] uppercase font-semibold text-emerald-200/80 flex items-center gap-1.5">
                <TrendingUp size={13} /> Bénéfice Net Consolidé
              </p>
              <p
                className={`text-2xl font-extrabold mt-1 ${
                  netPositive ? 'text-emerald-300' : 'text-red-300'
                }`}
              >
                {formatFCFA(analytics.netProfit)}
              </p>
              <p className="text-xs text-stone-400 mt-1 flex items-center gap-1">
                {deltaNet >= 0 ? (
                  <ArrowUpRight size={13} className="text-emerald-400" />
                ) : (
                  <ArrowDownRight size={13} className="text-red-400" />
                )}
                <span>
                  {deltaNet >= 0 ? '+' : ''}
                  {formatFCFA(deltaNet)} vs période préc.
                </span>
              </p>
            </div>

            <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4">
              <p className="text-[11px] uppercase font-semibold text-sky-200/80 flex items-center gap-1.5">
                <Wallet size={13} /> Chiffre d&apos;affaires
              </p>
              <p className="text-2xl font-extrabold text-sky-100 mt-1">
                {formatFCFA(analytics.totalRevenue)}
              </p>
              <p className="text-xs text-stone-400 mt-1">
                Marge brute : <strong className="text-stone-200">{formatFCFA(analytics.grossMargin)}</strong>
              </p>
            </div>

            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
              <p className="text-[11px] uppercase font-semibold text-rose-200/80 flex items-center gap-1.5">
                <TrendingDown size={13} /> Charges Consolidées
              </p>
              <p className="text-2xl font-extrabold text-rose-200 mt-1">
                {formatFCFA(analytics.consolidatedCharges)}
              </p>
              <p className="text-xs text-stone-400 mt-1">
                Dépenses + Pertes {analytics.additionalPayroll > 0 ? '+ Salaires RH' : ''}
              </p>
            </div>

            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-[11px] uppercase font-semibold text-amber-200/80 flex items-center gap-1.5">
                <Package size={13} /> Rentabilité & Achats
              </p>
              <p className="text-2xl font-extrabold text-amber-200 mt-1">
                {analytics.netMarginPct.toFixed(1)}%
              </p>
              <p className="text-xs text-stone-400 mt-1">
                Achats stock : <strong className="text-stone-200">{formatFCFA(analytics.purchasesTotal)}</strong>
              </p>
            </div>
          </div>

          {/* Compte de résultat synthétique + Répartition des charges */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card space-y-3">
              <h2 className="text-base font-bold text-stone-100 flex items-center gap-2">
                <Receipt size={18} style={{ color: theme.primary }} /> Compte de résultat synthétique
              </h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1.5 border-b border-stone-800">
                  <span className="text-stone-300">Chiffre d&apos;affaires total</span>
                  <span className="font-semibold text-stone-100">{formatFCFA(analytics.totalRevenue)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-stone-800">
                  <span className="text-stone-400">− Coût des marchandises vendues (CMV)</span>
                  <span className="font-medium text-amber-300">− {formatFCFA(analytics.totalCogs)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-stone-800 bg-stone-900/60 px-2 rounded-lg">
                  <span className="font-semibold text-stone-200">= Marge brute sur ventes</span>
                  <span className="font-bold text-sky-300">{formatFCFA(analytics.grossMargin)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-stone-800">
                  <span className="text-stone-400">− Dépenses d&apos;exploitation</span>
                  <span className="font-medium text-rose-300">− {formatFCFA(analytics.expensesTotal)}</span>
                </div>
                {analytics.lossesAndBroken > 0 && (
                  <div className="flex justify-between py-1.5 border-b border-stone-800">
                    <span className="text-stone-400 flex items-center gap-1">
                      <AlertTriangle size={13} className="text-amber-400" /> − Pertes & casse déclarées
                    </span>
                    <span className="font-medium text-rose-300">− {formatFCFA(analytics.lossesAndBroken)}</span>
                  </div>
                )}
                {analytics.additionalPayroll > 0 && (
                  <div className="flex justify-between py-1.5 border-b border-stone-800">
                    <span className="text-stone-400 flex items-center gap-1">
                      <Users size={13} className="text-sky-400" /> − Complément masse salariale ({analytics.spanDays}j)
                    </span>
                    <span className="font-medium text-rose-300">− {formatFCFA(analytics.additionalPayroll)}</span>
                  </div>
                )}
                <div
                  className={`flex justify-between py-2.5 px-3 rounded-xl border ${
                    netPositive
                      ? 'border-emerald-500/40 bg-emerald-500/10'
                      : 'border-red-500/40 bg-red-500/10'
                  }`}
                >
                  <span className="font-bold text-stone-100">= BÉNÉFICE NET CONSOLIDÉ</span>
                  <span className={`font-extrabold text-base ${netPositive ? 'text-emerald-300' : 'text-red-300'}`}>
                    {formatFCFA(analytics.netProfit)}
                  </span>
                </div>
                <div className="pt-2 text-xs text-stone-400 flex justify-between">
                  <span>Flux achats stock (capital réinvesti)</span>
                  <span className="font-medium text-stone-300">{formatFCFA(analytics.purchasesTotal)}</span>
                </div>
                <div className="text-xs text-stone-400 flex justify-between">
                  <span>Trésorerie nette après achats</span>
                  <span className={`font-semibold ${analytics.cashFlowAfterRestock >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {formatFCFA(analytics.cashFlowAfterRestock)}
                  </span>
                </div>
              </div>
            </div>

            <div className="card space-y-3">
              <h2 className="text-base font-bold text-stone-100 flex items-center gap-2">
                <TrendingDown size={18} className="text-rose-400" /> Répartition des charges consolidées
              </h2>
              {analytics.categoriesBreakdown.length === 0 ? (
                <p className="text-sm text-stone-500 py-8 text-center">
                  Aucune charge enregistrée sur cette période.
                </p>
              ) : (
                <div className="space-y-3">
                  {analytics.categoriesBreakdown.map((row) => (
                    <div key={row.category} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-stone-200">{row.category}</span>
                        <span className="text-stone-300">
                          {formatFCFA(row.amount)}{' '}
                          <span className="text-stone-500">({row.pct.toFixed(1)}%)</span>
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-stone-800 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, Math.max(4, row.pct))}%`,
                            backgroundColor: theme.primary,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Évolution journalière */}
          {analytics.dailySeries.length > 0 && (
            <div className="card space-y-3">
              <h2 className="text-base font-bold text-stone-100">
                Évolution journalière (Revenus vs Charges & Bénéfice net)
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="text-left text-stone-400 border-b border-stone-800">
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 px-2 text-right">Revenus</th>
                      <th className="py-2 px-2 text-right">CMV</th>
                      <th className="py-2 px-2 text-right">Charges</th>
                      <th className="py-2 pl-2 text-right">Bénéfice net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...analytics.dailySeries].reverse().map((d) => (
                      <tr key={d.date} className="border-b border-stone-800/60">
                        <td className="py-2 pr-3 text-stone-300">{formatDate(d.date)}</td>
                        <td className="py-2 px-2 text-right text-sky-300">{formatFCFA(d.revenue)}</td>
                        <td className="py-2 px-2 text-right text-stone-400">{formatFCFA(d.cogs)}</td>
                        <td className="py-2 px-2 text-right text-rose-300">{formatFCFA(d.charges)}</td>
                        <td
                          className={`py-2 pl-2 text-right font-bold ${
                            d.net >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {formatFCFA(d.net)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Grand livre des charges consolidées */}
          <div className="card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold text-stone-100">
                Détail des charges et décaissements ({analytics.filteredLedger.length})
              </h2>
              <div className="flex flex-wrap gap-1.5" data-no-print>
                {(
                  [
                    ['all', 'Tout'],
                    ['expense', 'Dépenses'],
                    ['loss', 'Pertes/Casse'],
                    ['purchase', 'Achats stock'],
                  ] as const
                ).map(([k, lbl]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setChargeFilter(k)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${
                      chargeFilter === k
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-200'
                        : 'border-stone-800 text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            {analytics.filteredLedger.length === 0 ? (
              <p className="text-sm text-stone-500 py-6 text-center">
                Aucune écriture sur ce filtre et cette période.
              </p>
            ) : (
              <div className="divide-y divide-stone-800/70">
                {analytics.filteredLedger.slice(0, 80).map((item) => (
                  <div key={item.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-stone-100">{item.category}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                            item.source === 'purchase'
                              ? 'bg-sky-500/15 text-sky-300'
                              : item.source === 'loss'
                                ? 'bg-amber-500/15 text-amber-300'
                                : 'bg-rose-500/15 text-rose-300'
                          }`}
                        >
                          {item.source === 'purchase'
                            ? 'Stock'
                            : item.source === 'loss'
                              ? 'Perte/Casse'
                              : 'Charge'}
                        </span>
                        <span className="text-xs text-stone-500">{formatDate(item.date)}</span>
                      </div>
                      <p className="text-xs text-stone-400 truncate mt-0.5">{item.description}</p>
                    </div>
                    <span
                      className={`font-bold shrink-0 ${
                        item.source === 'purchase' ? 'text-sky-300' : 'text-rose-300'
                      }`}
                    >
                      − {formatFCFA(item.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
