import AdMarquee from '@/components/AdMarquee';
import { useEffect, useState, type ReactNode } from 'react';
import {
  TrendingUp, DollarSign, Package, Users, AlertTriangle, Receipt, ShoppingCart,
  UtensilsCrossed, LayoutDashboard, Truck, ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { formatFCFA, todayISO } from '@/lib/format';
import { loadBeverageProfitForRange, loadBeverageProfitFromReports, loadFondsCommerce, mondayOfISO, dateDaysAgo, monthStartISO } from '@/lib/beverageProfit';
import { StatCard, EmptyState } from '@/components/ui';
import { BarChart, Sparkline } from '@/components/MiniChart';
import {
  normalizeBusinessType,
  getEstablishmentServices,
  BUSINESS_LABELS,
  BUSINESS_THEMES,
  type BusinessType,
  getBusinessUI,
} from '@/lib/businessTypes';
import type { Sale, Order } from '@/lib/types';
import type { BeveragePeriodReport } from '@/lib/beverageProfit';
import OwnerReportCalendar from '@/components/OwnerReportCalendar';
import QuickActions from '@/components/QuickActions';
import StartupGuide from '@/components/StartupGuide';
import ExchangeRatesCard from '@/components/ExchangeRatesCard';
import SectorNews from '@/components/SectorNews';
import OwnerSitesBar from '@/components/OwnerSitesBar';

function DashLink({ to, children, className = '' }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link
      to={to}
      className={`block rounded-2xl transition-all hover:ring-2 hover:ring-amber-500/40 hover:scale-[1.01] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-amber-400/50 ${className}`}
    >
      {children}
    </Link>
  );
}


interface DashboardData {
  todaySales: number;
  todayExpenses: number;
  todayProfit: number;
  weekSalesTotal: number;
  lowStockCount: number;
  employeeCount: number;
  activeOrders: number;
  freeTables: number;
  occupiedTables: number;
  weeklyData: { label: string; value: number }[];
  weekValues: number[];
  recentSales: Sale[];
  activeOrdersList: Order[];
  topProducts: { name: string; revenue: number }[];
  aiAlerts: string[];
  dataPartial: boolean;
  monthSales: number;
  monthExpenses: number;
  monthPurchases: number;
  monthProfit: number;
  stockValue: number;
  todayCogs: number;
  weekExpenses: number;
  weekPurchases: number;
  weekProfit: number;
  bevToday: BeveragePeriodReport;
  bevWeek: BeveragePeriodReport;
  bevMonth: BeveragePeriodReport;
}

export default function Dashboard() {
  const { member, activeEstablishment, effectiveRole } = useAuth();
  const role = String(effectiveRole || member?.role || '');
  const canSeeFinance = ['super_admin', 'admin', 'owner'].includes(role);
  const estIdInit = activeEstablishment?.id || member?.establishment_id || null;
  const [data, setData] = useState<DashboardData | null>(() => {
    try {
      if (!estIdInit) return null;
      const raw = sessionStorage.getItem('mm_dash_' + estIdInit);
      return raw ? (JSON.parse(raw) as DashboardData) : null;
    } catch {
      return null;
    }
  });
  const [error, setError] = useState<string | null>(null);
  // Si cache présent → pas de spinner plein écran
  const [loading, setLoading] = useState(() => {
    try {
      if (!estIdInit) return false;
      return !sessionStorage.getItem('mm_dash_' + estIdInit);
    } catch {
      return true;
    }
  });

  // Persister le dernier dashboard pour affichage immédiat au prochain refresh
  useEffect(() => {
    const id = activeEstablishment?.id || member?.establishment_id;
    if (id && data) {
      try {
        sessionStorage.setItem('mm_dash_' + id, JSON.stringify(data));
      } catch { /* quota */ }
    }
  }, [data, activeEstablishment?.id, member?.establishment_id]);

  const bizType: BusinessType = normalizeBusinessType(activeEstablishment?.type);
  const estServices =
    bizType === 'complexe'
      ? getEstablishmentServices(activeEstablishment?.id, (activeEstablishment as any)?.services)
      : [];
  const theme = BUSINESS_THEMES[bizType];
  const ui = getBusinessUI(bizType);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let estId = activeEstablishment?.id || member?.establishment_id || null;
      if (!estId) {
        try {
          const uid = member?.user_id;
          const raw =
            (uid && localStorage.getItem(`mm_active_est:${uid}`)) ||
            localStorage.getItem('mm_active_est');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed?.id) estId = String(parsed.id);
          }
        } catch { /* */ }
      }
      if (!estId) {
        // Ne pas effacer un dashboard déjà affiché (évite flash au refresh)
        setLoading(false);
        return;
      }
      // Rafraîchir en arrière-plan si on a déjà des données (pas de flash blanc)
      if (!data) setLoading(true);
      setError(null);

      const emptyFallback: DashboardData = {
        todaySales: 0, todayExpenses: 0, todayProfit: 0, monthSales: 0, monthExpenses: 0,
        monthPurchases: 0, monthProfit: 0, stockValue: 0, todayCogs: 0, weekExpenses: 0,
        weekPurchases: 0, weekProfit: 0,
        bevToday: { lines: [], totalQty: 0, totalCA: 0, totalCost: 0, totalProfit: 0 },
        bevWeek: { lines: [], totalQty: 0, totalCA: 0, totalCost: 0, totalProfit: 0 },
        bevMonth: { lines: [], totalQty: 0, totalCA: 0, totalCost: 0, totalProfit: 0 },
        weekSalesTotal: 0, lowStockCount: 0, employeeCount: 0, activeOrders: 0,
        freeTables: 0, occupiedTables: 0, weeklyData: [], weekValues: [],
        recentSales: [], activeOrdersList: [], topProducts: [], aiAlerts: [], dataPartial: true,
      };

      // Sécurité : jamais rester sur « Chargement... » plus de 5 s
      const safety = window.setTimeout(() => {
        if (!cancelled) {
          setData((prev) => prev ?? emptyFallback);
          setLoading(false);
          setError((e) => e || 'Chargement partiel — vérifiez la connexion');
        }
      }, 5000);

      try {
      const today = todayISO();

      const [salesRes, expensesRes, productsRes, employeesRes, ordersRes, recentRes, tablesRes, weekSalesRes] =
        await Promise.all([
          supabase.from('sales').select('total').eq('establishment_id', estId).gte('created_at', today),
          supabase.from('expenses').select('amount').eq('establishment_id', estId).gte('created_at', today),
          supabase.from('products').select('id, stock, min_stock, name').eq('establishment_id', estId),
          supabase.from('employees').select('id').eq('establishment_id', estId).eq('status', 'active'),
          supabase.from('orders').select('*').eq('establishment_id', estId).in('status', ['pending', 'preparing', 'ready']),
          supabase.from('sales').select('*').eq('establishment_id', estId).order('created_at', { ascending: false }).limit(5),
          supabase.from('restaurant_tables').select('status').eq('establishment_id', estId),
          supabase.from('sales').select('total, created_at, product_id').eq('establishment_id', estId).gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
        ]);

      const queryErrors = [salesRes, expensesRes, productsRes, weekSalesRes]
        .map((r) => r.error?.message)
        .filter(Boolean);
      const dataPartial = queryErrors.length > 0;
      if (dataPartial) {
        setError(`Données partielles : ${queryErrors[0]}`);
      }

      const todaySales = (salesRes.data ?? []).reduce((s, x) => s + Number(x.total), 0);
      const todayExpenses = (expensesRes.data ?? []).reduce((s, x) => s + Number(x.amount), 0);

      // Comptabilité mois en cours + valeur stock
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const [monthSalesRes, monthExpRes, stockValRes, purchRes] = await Promise.all([
        supabase.from('sales').select('total').eq('establishment_id', estId).gte('created_at', monthStart.toISOString()),
        supabase.from('expenses').select('amount').eq('establishment_id', estId).gte('created_at', monthStart.toISOString()),
        supabase.from('products').select('stock, cost').eq('establishment_id', estId),
        supabase.from('purchases').select('total').eq('establishment_id', estId).gte('created_at', monthStart.toISOString()),
      ]);
      const monthSales = (monthSalesRes.data ?? []).reduce((s, x) => s + Number(x.total || 0), 0);
      const monthExpenses = (monthExpRes.data ?? []).reduce((s, x) => s + Number(x.amount || 0), 0);
      const monthPurchases = (purchRes.data ?? []).reduce((s, x) => s + Number(x.total || 0), 0);
      const stockValue = (stockValRes.data ?? []).reduce(
        (s, p) => s + (Number(p.stock) || 0) * (Number(p.cost) || 0),
        0
      );
      // Bénéfice = marge rapports (pas ventes − achats)
      const mon = mondayOfISO(today);
      const [todayProfitRep, weekProfitRep, monthProfitRep, fonds] = await Promise.all([
        loadBeverageProfitForRange(estId, today, today),
        loadBeverageProfitForRange(estId, mon, today),
        loadBeverageProfitForRange(estId, monthStart.toISOString().slice(0, 10), today),
        loadFondsCommerce(estId),
      ]);
      const monthProfit = monthProfitRep.totalProfit;
      const todayCogs = todayProfitRep.totalCost;
      const weekProfitMargin = weekProfitRep.totalProfit;
      const weekPurchases = monthPurchases; // conservé pour affichage séparément
      const weekExpenses = 0;
      const stockValueFonds = fonds.stockValueAtCost;

      const products = productsRes.data ?? [];
      const lowStockItems = products.filter((p) => Number(p.stock) <= Number(p.min_stock));
      const lowStock = lowStockItems.length;
      const tables = tablesRes.data ?? [];
      const freeTables = tables.filter((t) => t.status === 'free').length;
      const occupiedTables = tables.filter((t) => t.status === 'occupied').length;

      const toLocalDay = (iso: string) => {
        const d = new Date(iso);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      const weeklyData: { label: string; value: number }[] = [];
      const weekValues: number[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setHours(12, 0, 0, 0);
        date.setDate(date.getDate() - i);
        const dayStr = toLocalDay(date.toISOString());
        const label = date.toLocaleDateString('fr-FR', { weekday: 'short' });
        const sum = (weekSalesRes.data ?? [])
          .filter((s) => s.created_at && toLocalDay(s.created_at) === dayStr)
          .reduce((a, b) => a + Number(b.total), 0);
        weeklyData.push({ label, value: sum });
        weekValues.push(sum);
      }
      const weekSalesTotal = weekValues.reduce((a, b) => a + b, 0);
      const weekProfit = weekProfitMargin;

      const aiAlerts: string[] = [];
      for (const p of lowStockItems.slice(0, 5)) {
        const st = Number(p.stock);
        const min = Number(p.min_stock) || 1;
        if (st <= 0) aiAlerts.push(`Rupture : ${p.name}`);
        else aiAlerts.push(`Stock bas : ${p.name} (${st} restant, seuil ${min})`);
      }
      if (weekSalesTotal > 0 && todaySales === 0) {
        aiAlerts.push('Aucune vente enregistrée aujourd\'hui alors que la semaine est active.');
      }
      if (todayExpenses > todaySales && todaySales > 0) {
        aiAlerts.push('Dépenses du jour supérieures aux ventes — marge négative.');
      }

      const prodRev: Record<string, number> = {};
      for (const s of weekSalesRes.data ?? []) {
        if (s.product_id) prodRev[s.product_id] = (prodRev[s.product_id] ?? 0) + Number(s.total);
      }
      const topProducts = Object.entries(prodRev).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, revenue]) => ({
        name: (productsRes.data ?? []).find((p) => p.id === id)?.name ?? 'Produit',
        revenue,
      }));

      if (!cancelled) {
        const [bevToday, bevWeek, bevMonth] = await Promise.all([
          loadBeverageProfitFromReports(estId, dateDaysAgo(0)),
          loadBeverageProfitFromReports(estId, dateDaysAgo(6)),
          loadBeverageProfitFromReports(estId, monthStartISO()),
        ]);

        setData({
          todaySales, todayExpenses, todayProfit: todayProfitRep.totalProfit,
          weekSalesTotal, lowStockCount: lowStock,
          employeeCount: employeesRes.data?.length ?? 0, activeOrders: ordersRes.data?.length ?? 0,
          freeTables, occupiedTables, weeklyData, weekValues,
          recentSales: (recentRes.data ?? []) as Sale[],
          activeOrdersList: (ordersRes.data ?? []) as Order[],
          topProducts,
          aiAlerts,
          dataPartial,
          monthSales,
          monthExpenses,
          monthPurchases,
          monthProfit: monthProfitRep.totalProfit,
          stockValue: stockValueFonds,
          todayCogs,
          weekExpenses,
          weekPurchases,
          weekProfit,
          bevToday,
          bevWeek,
          bevMonth,
        });
      }
      } catch (e) {
        setError("Impossible de charger le tableau de bord");
        console.error(e);
        if (!cancelled) {
          setData({
            todaySales: 0, todayExpenses: 0, todayProfit: 0, monthSales: 0, monthExpenses: 0, monthPurchases: 0, monthProfit: 0, stockValue: 0, todayCogs: 0, weekExpenses: 0, weekPurchases: 0, weekProfit: 0, bevToday: { lines: [], totalQty: 0, totalCA: 0, totalCost: 0, totalProfit: 0 }, bevWeek: { lines: [], totalQty: 0, totalCA: 0, totalCost: 0, totalProfit: 0 }, bevMonth: { lines: [], totalQty: 0, totalCA: 0, totalCost: 0, totalProfit: 0 }, weekSalesTotal: 0, lowStockCount: 0,
            employeeCount: 0, activeOrders: 0, freeTables: 0, occupiedTables: 0,
            weeklyData: [], weekValues: [], recentSales: [], activeOrdersList: [], topProducts: [],
            aiAlerts: [], dataPartial: true,
          });
        }
      } finally {
        window.clearTimeout(safety);
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeEstablishment?.id, member?.establishment_id]);

  // Établissement : cache local immédiat (évite écran « Chargement… » permanent)
  let cachedEstId: string | null = null;
  let cachedEstName: string | null = null;
  try {
    const uid = member?.user_id;
    const raw =
      (uid && localStorage.getItem(`mm_active_est:${uid}`)) ||
      localStorage.getItem('mm_active_est');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.id) {
        cachedEstId = String(parsed.id);
        cachedEstName = parsed.name || null;
      }
    }
  } catch { /* */ }

  const estId = activeEstablishment?.id || member?.establishment_id || cachedEstId;

  if (!estId) {
    // Pas d’écran bloquant : message + actions, menu déjà visible autour
    return (
      <div className="px-4 py-10 text-center space-y-4">
        <LayoutDashboard size={40} className="mx-auto text-stone-400" />
        <h2 className="text-lg font-semibold text-stone-800">Établissement en cours de chargement</h2>
        <p className="text-sm text-stone-500 max-w-sm mx-auto">
          Le menu est disponible. Si rien n’apparaît, tirez pour actualiser ou rouvrez l’app.
        </p>
        <button
          type="button"
          className="btn-primary"
          onClick={() => window.location.reload()}
        >
          Actualiser
        </button>
      </div>
    );
  }
  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-stone-500">
        <div className="h-8 w-8 rounded-full border-2 border-[#FF7900] border-t-transparent animate-spin" />
        <p className="text-sm">Chargement du tableau de bord…</p>
      </div>
    );
  }
  if (!data) {
    return (
      <EmptyState
        icon={<LayoutDashboard size={48} />}
        title="Tableau de bord"
        message="Aucune donnée pour le moment. Ajoutez du stock ou enregistrez une vente."
      />
    );
  }

  const shortcuts =
    bizType === 'restaurant' ? [
      { to: '/orders', label: 'Commandes', icon: Receipt },
      { to: '/kitchen', label: 'Cuisine', icon: UtensilsCrossed },
      { to: '/tables', label: 'Tables', icon: LayoutDashboard },
      { to: '/pos', label: ui.posTitle, icon: ShoppingCart },
    ] : bizType === 'bar' ? [
      { to: '/pos', label: ui.posTitle, icon: ShoppingCart },
      { to: '/orders', label: 'Commandes', icon: Receipt },
      { to: '/inventory', label: ui.shortcutInventory, icon: Package },
      { to: '/daily-report', label: 'Clôture', icon: TrendingUp },
    ] : bizType === 'pharmacie' ? [
      { to: '/pos', label: 'Caisse pharmacie', icon: ShoppingCart },
      { to: '/inventory', label: 'Médicaments', icon: Package },
      { to: '/purchases', label: 'Approvisionnement', icon: Truck },
      { to: '/suppliers', label: 'Fournisseurs', icon: Truck },
    ] : bizType === 'quincaillerie' ? [
      { to: '/pos', label: ui.posTitle, icon: ShoppingCart },
      { to: '/inventory', label: 'Matériaux', icon: Package },
      { to: '/purchases', label: 'Achats', icon: Truck },
      { to: '/suppliers', label: 'Fournisseurs', icon: Truck },
    ] : bizType === 'boutique' || bizType === 'superette' || bizType === 'magasin' || bizType === 'commerce' ? [
      { to: '/pos', label: ui.posTitle, icon: ShoppingCart },
      { to: '/inventory', label: ui.shortcutInventory, icon: Package },
      { to: '/purchases', label: 'Achats', icon: Truck },
      { to: '/suppliers', label: 'Fournisseurs', icon: Truck },
    ] : bizType === 'location_event' ? [
      { to: '/rent/equipment', label: 'Matériel', icon: Package },
      { to: '/rent/orders', label: 'Commandes', icon: Receipt },
      { to: '/rent/calendar', label: 'Calendrier', icon: LayoutDashboard },
      { to: '/rent/clients', label: 'Clients', icon: Users },
    ] : [
      { to: '/pos', label: ui.posTitle, icon: ShoppingCart },
      { to: '/inventory', label: ui.shortcutInventory, icon: Package },
      { to: '/expenses', label: 'Dépenses', icon: DollarSign },
      { to: '/daily-report', label: 'Clôture', icon: TrendingUp },
    ];

  return (
    <div>
      <AdMarquee className="mb-4" />
      <OwnerSitesBar />
      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200 mb-3">
          {error}
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: theme.primary }}>Mode {bizType === 'complexe' && estServices.length
            ? `Établissement · ${estServices.map((s) => ({ maquis: 'Maquis', restaurant: 'Resto', chambres: 'Chambres', location: 'Location', magasin: 'Magasin' } as Record<string, string>)[s] || s).join(' · ')}`
            : BUSINESS_LABELS[bizType]}</p>
          <h1 className="text-2xl font-bold font-display text-stone-100">{activeEstablishment?.name ?? 'Tableau de bord'}</h1>
          <p className="text-stone-400 text-sm">Vue d&apos;évolution de votre activité</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium" style={{ background: theme.primarySoft, color: theme.primary }}>
          <Sparkline values={data.weekValues} color={theme.primary} />
          7 jours
        </div>
      </div>

      <QuickActions businessType={activeEstablishment?.type} />
      <StartupGuide compact />
      <ExchangeRatesCard />
      <SectorNews businessType={activeEstablishment?.type} />

{canSeeFinance && (activeEstablishment?.id || member?.establishment_id) && (
        <OwnerReportCalendar establishmentId={(activeEstablishment?.id || member?.establishment_id)!} />
      )}

{canSeeFinance && (
      <>
      {/* Comptabilité */}
      <div className="mb-6 rounded-2xl border border-stone-800 bg-stone-900/60 p-4 theme-card-light">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h2 className="text-lg font-semibold text-stone-100">Comptabilité</h2>
            <p className="text-xs text-stone-500">Chiffres de gestion — appuyez sur une carte pour ouvrir</p>
          </div>
          <Link to="/accounting" className="text-sm text-amber-400 hover:underline">
            Voir détail →
          </Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <DashLink to="/pos"><StatCard title="CA du jour" value={formatFCFA(data.todaySales)} icon={<DollarSign size={20} />} /></DashLink>
          <DashLink to="/expenses"><StatCard title="Dépenses du jour" value={formatFCFA(data.todayExpenses)} icon={<DollarSign size={20} />} /></DashLink>
          <DashLink to="/accounting"><StatCard title="Résultat du jour" value={formatFCFA(data.todayProfit)} icon={<TrendingUp size={20} />} /></DashLink>
          <DashLink to="/statistics"><StatCard title="CA 7 jours" value={formatFCFA(data.weekSalesTotal)} icon={<TrendingUp size={20} />} /></DashLink>
          <DashLink to="/accounting"><StatCard title="CA du mois" value={formatFCFA(data.monthSales ?? 0)} icon={<TrendingUp size={20} />} /></DashLink>
          <DashLink to="/expenses"><StatCard title="Dépenses du mois" value={formatFCFA(data.monthExpenses ?? 0)} icon={<DollarSign size={20} />} /></DashLink>
          <DashLink to="/inventory"><StatCard title="Achats stock (mois)" value={formatFCFA(data.monthPurchases ?? 0)} icon={<Package size={20} />} /></DashLink>
        </div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <DashLink to="/accounting" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
            <p className="text-emerald-200/80 text-xs uppercase tracking-wide">Bénéfice (marge) — semaine (7 j) →</p>
            <p className={`text-2xl font-bold mt-1 ${(data.weekProfit ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatFCFA(data.weekProfit ?? 0)}
            </p>
            <p className="text-[11px] text-stone-500 mt-1">
              CA {formatFCFA(data.weekSalesTotal)} − dépenses {formatFCFA(data.weekExpenses ?? 0)} − achats {formatFCFA(data.weekPurchases ?? 0)}
            </p>
          </DashLink>
          <DashLink to="/accounting" className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <p className="text-amber-200/80 text-xs uppercase tracking-wide">Bénéfice (marge) — mois →</p>
            <p className={`text-2xl font-bold mt-1 ${(data.monthProfit ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatFCFA(data.monthProfit ?? 0)}
            </p>
            <p className="text-[11px] text-stone-500 mt-1">
              CA {formatFCFA(data.monthSales ?? 0)} − dépenses {formatFCFA(data.monthExpenses ?? 0)} − achats {formatFCFA(data.monthPurchases ?? 0)}
            </p>
          </DashLink>
        </div>
      </div>

      {/* Sorties boissons & bénéfice auto (rapports du jour) */}
      <div className="mb-6 rounded-2xl border border-stone-800 bg-stone-900/60 p-4 theme-card-light">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h2 className="text-lg font-semibold text-stone-100">Sorties boissons &amp; bénéfice</h2>
            <p className="text-xs text-stone-500">
              Calcul auto : rapports du jour + ventes caisse × (prix vente − prix achat)
            </p>
          </div>
          <Link to="/daily-report" className="text-sm text-amber-400 hover:underline">
            Rapport du jour →
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          {[
            { label: "Aujourd'hui", r: data.bevToday },
            { label: '7 jours', r: data.bevWeek },
            { label: 'Mois', r: data.bevMonth },
          ].map((b) => (
            <div key={b.label} className="rounded-xl border border-stone-700 bg-stone-800/50 px-3 py-3 theme-inner-card">
              <p className="text-xs text-stone-500 uppercase">{b.label}</p>
              <p className="text-stone-300 text-sm mt-1">{b.r?.totalQty ?? 0} sorties</p>
              <p className="text-stone-400 text-xs">CA {formatFCFA(b.r?.totalCA ?? 0)}</p>
              <p className={`text-lg font-bold mt-1 ${(b.r?.totalProfit ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatFCFA(b.r?.totalProfit ?? 0)}
              </p>
              <p className="text-[11px] text-stone-500">bénéfice brut boissons</p>
            </div>
          ))}
        </div>
        {(data.bevToday?.lines?.length ?? 0) > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="text-stone-500 text-left border-b border-stone-800">
                  <th className="py-2">Boisson</th>
                  <th className="py-2">Sorties (jour)</th>
                  <th className="py-2">CA</th>
                  <th className="py-2">Coût</th>
                  <th className="py-2">Bénéfice</th>
                </tr>
              </thead>
              <tbody>
                {(data.bevToday?.lines ?? []).slice(0, 12).map((l) => (
                  <tr key={l.product_id} className="border-b border-stone-800/60">
                    <td className="py-2 text-stone-200">{l.name}</td>
                    <td className="py-2 text-stone-300">{l.qty_out}</td>
                    <td className="py-2 text-stone-300">{formatFCFA(l.ca)}</td>
                    <td className="py-2 text-stone-400">{formatFCFA(l.cost)}</td>
                    <td className={`py-2 font-medium ${l.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatFCFA(l.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-stone-500">
            Aucune sortie boisson dans les rapports du jour pour aujourd&apos;hui. Faites la clôture pour alimenter ce rapport.
          </p>
        )}
      </div>

      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl bg-stone-800/80 px-3 py-2 text-sm theme-inner-card">
          <p className="text-stone-500 text-xs">Valeur du stock (au coût d&apos;achat)</p>
          <p className="text-amber-300 font-semibold text-lg">{formatFCFA(data.stockValue ?? 0)}</p>
        </div>
        <div className="rounded-xl bg-stone-800/80 px-3 py-2 text-sm theme-inner-card">
          <p className="text-stone-500 text-xs">Résultat du jour (CA − dépenses)</p>
          <p className={`font-semibold text-lg ${(data.todayProfit ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatFCFA(data.todayProfit ?? 0)}
          </p>
        </div>
      </div>
      </>
      )}

      {/* Stats résumées — montants réservés au propriétaire */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {canSeeFinance ? (
          <>
        <StatCard title="Ventes du jour" value={formatFCFA(data.todaySales)} icon={<DollarSign size={20} />} />
        <DashLink to="/statistics"><StatCard title="CA 7 jours" value={formatFCFA(data.weekSalesTotal)} icon={<TrendingUp size={20} />} /></DashLink>
        <DashLink to="/expenses"><StatCard title="Dépenses du jour" value={formatFCFA(data.todayExpenses)} icon={<DollarSign size={20} />} /></DashLink>
        <StatCard title="Bénéfice jour" value={formatFCFA(data.todayProfit)} icon={<TrendingUp size={20} />} />
          </>
        ) : (
          <>
        <StatCard title="Stock bas" value={String(data.lowStockCount)} icon={<AlertTriangle size={20} />} />
        <StatCard title="Équipe" value={String(data.employeeCount)} icon={<Users size={20} />} />
          </>
        )}
        {(bizType === 'restaurant' || bizType === 'bar') && (
          <StatCard title="Commandes actives" value={String(data.activeOrders)} icon={<Receipt size={20} />} />
        )}
        {bizType === 'restaurant' && (
          <StatCard title="Tables" value={`${data.occupiedTables}/${data.occupiedTables + data.freeTables}`} icon={<LayoutDashboard size={20} />} />
        )}
        {(bizType === 'maquis' || bizType === 'magasin') && (
          <StatCard title={ui.stockAlert} value={String(data.lowStockCount)} icon={<AlertTriangle size={20} />} />
        )}
        {bizType === 'magasin' && (
          <StatCard title="Employés" value={String(data.employeeCount)} icon={<Users size={20} />} />
        )}
        {bizType === 'maquis' && (
          <StatCard title="Résultat jour" value={formatFCFA(data.todayProfit)} icon={<TrendingUp size={20} />} />
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {shortcuts.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.to} to={s.to} className="card flex items-center gap-3 hover:border-stone-600 transition-all">
              <div className="p-2 rounded-xl" style={{ background: theme.primarySoft, color: theme.primary }}><Icon size={18} /></div>
              <span className="font-medium text-stone-200 text-sm">{s.label}</span>
              <ArrowRight size={14} className="ml-auto text-stone-600" />
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <DashLink to="/statistics" className="block">
        <div className={`card bg-gradient-to-br ${theme.gradient} h-full`}>
          <h2 className="font-semibold text-stone-100 mb-1">Évolution des ventes (7 j) →</h2>
          <p className="text-xs text-stone-500 mb-3">Graphique {BUSINESS_LABELS[bizType]}</p>
          <BarChart data={data.weeklyData} color={theme.primary} height={140} />
          <p className="text-xs text-stone-400 mt-2">Appuyer pour statistiques détaillées</p>
        </div>
        </DashLink>
        <DashLink to="/inventory" className="block">
        <div className="card h-full">
          <h2 className="font-semibold text-stone-100 mb-3">{bizType === 'restaurant' ? 'Commandes en cours' : 'Top produits (7 j)'} →</h2>
          {bizType === 'restaurant' && data.activeOrdersList.length > 0 ? (
            <ul className="space-y-2">
              {data.activeOrdersList.slice(0, 5).map((o) => (
                <li key={o.id} className="flex justify-between text-sm text-stone-300">
                  <span>Table {o.table_number ?? '—'} · {o.status}</span>
                  <span className="font-medium">{formatFCFA(Number(o.total))}</span>
                </li>
              ))}
            </ul>
          ) : data.topProducts.length > 0 ? (
            <ul className="space-y-2">
              {data.topProducts.map((p, i) => (
                <li key={i} className="flex justify-between text-sm">
                  <span className="text-stone-300">{p.name}</span>
                  <span className="font-medium" style={{ color: theme.primary }}>{formatFCFA(p.revenue)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-stone-500">Pas encore assez de données.</p>
          )}
        </div>
        </DashLink>
      </div>

      
      {data.aiAlerts.length > 0 && (
        <DashLink to="/inventory" className="mb-6">
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
          <p className="text-sm font-semibold text-amber-200">Alertes IA — Stock Manager →</p>
          <ul className="space-y-1">
            {data.aiAlerts.map((a, i) => (
              <li key={i} className="text-sm text-amber-100/90">⚠️ {a}</li>
            ))}
          </ul>
        </div>
        </DashLink>
      )}

      {data.lowStockCount > 0 && (
        <DashLink to="/inventory">
        <div className="card border border-warning-500/30 bg-warning-500/5 flex items-start gap-3">
          <AlertTriangle className="text-warning-400 shrink-0" size={20} />
          <div>
            <p className="font-medium text-stone-100">{data.lowStockCount} produit(s) sous le seuil</p>
            <span className="text-sm text-primary-400">Voir l&apos;inventaire →</span>
          </div>
        </div>
        </DashLink>
      )}
    </div>
  );
}
