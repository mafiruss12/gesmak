import { type ReactNode, useState, useEffect , useRef} from 'react';
import { NavLink, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Package, Camera, ClipboardCheck, QrCode, Users, Building2, Beer, LogOut, RefreshCw, Menu, X, ChevronsUpDown, Check, UserCog, ClipboardList, Calculator, BarChart3, Truck, UserCircle, Calendar, CalendarDays, UtensilsCrossed, Bell, Settings, Sparkles, Receipt, Wallet, MessageCircle, FileText, Crown, Brain, Sun, Moon, Wrench, ShieldCheck, TrendingUp } from 'lucide-react';
import DailyReportGate from '@/components/DailyReportGate';
import OrderRealtimeAlert from '@/components/OrderRealtimeAlert';
import { registerPushToken } from '@/lib/push';
import OwnerReportReminder from '@/components/OwnerReportReminder';
import ReportDelayNotifier from '@/components/ReportDelayNotifier';
import PermissionsOnboarding from '@/components/PermissionsOnboarding';
import SubscriptionGate from '@/components/SubscriptionGate';
import { ServiceDayProvider } from '@/lib/ServiceDayContext';
import { useAuth } from '@/lib/auth';
import { usePlanAccess } from '@/lib/usePlanAccess';
import { getStoredTheme, applyTheme, type ThemeMode } from '@/lib/theme';
import { startPrefetchInterval, flushQueue, queueCount } from '@/lib/offline';
import { supabase } from '@/lib/supabase';
import { ROLE_LABELS } from '@/lib/types';
import type { Role } from '@/lib/types';
import OfflineBanner from '@/components/OfflineBanner';
import BrandFooter from '@/components/BrandFooter';
import UpdateBanner from '@/components/UpdateBanner';
import BiometricGate from '@/components/BiometricGate';
import { displayLogin } from '@/lib/login';
import TypePicker from '@/components/TypePicker';
import MfaGate from '@/components/MfaGate';
import {
  applyBusinessTheme,
  normalizeBusinessType,
  MENU_BY_TYPE,
  getEstablishmentServices,
  menuRoutesForComplexe,
  inventoryLabelForServices,
  BUSINESS_LABELS,
  BUSINESS_THEMES,
  canManageEstablishments,
  menuLabelFor,
  getBusinessUI } from '@/lib/businessTypes';

interface NavSection {
  label: string;
  items: { to: string; label: string; icon: ReactNode; roles: Role[] }[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Principal',
    items: [
      { to: '/dashboard', label: 'Tableau de bord', icon: <LayoutDashboard size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier', 'employee'] },
      { to: '/pouvoirs', label: 'Rôles & Pouvoirs', icon: <ShieldCheck size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier', 'employee'] },
      { to: '/pos', label: 'Ma Caisse', icon: <ShoppingCart size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier'] },
      { to: '/cloture', label: 'Clôture Z', icon: <ClipboardCheck size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier'] },
      { to: '/hotel', label: 'Dashboard hôtel', icon: <Building2 size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier', 'employee'] },
      { to: '/hotel/rooms', label: 'Chambres', icon: <Building2 size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier', 'employee'] },
      { to: '/hotel/reservations', label: 'Réservations', icon: <Calendar size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier', 'employee'] },
      { to: '/hotel/guests', label: 'Clients hôtel', icon: <UserCircle size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier', 'employee'] },
      { to: '/hotel/housekeeping', label: 'Housekeeping', icon: <Sparkles size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'employee'] },
      { to: '/hotel/maintenance', label: 'Maintenance', icon: <Wrench size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'employee'] },
      { to: '/hotel/events', label: 'Événementiel', icon: <Calendar size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier'] },
      { to: '/hotel/services', label: 'Services complexe', icon: <Settings size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager'] },
      { to: '/hotel/settings', label: 'Paramètres hôtel', icon: <Settings size={20} />, roles: ['super_admin', 'admin', 'owner'] },
      { to: '/patron', label: 'Mode patron', icon: <Crown size={20} />, roles: ['super_admin', 'admin', 'owner'] },
      { to: '/mon-service', label: 'Mon service', icon: <Users size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier', 'employee'] },
      { to: '/daily-report?tab=historique', label: 'Historique ventes', icon: <ClipboardList size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier'] },
      { to: '/daily-report', label: 'Vente journalière', icon: <ShoppingCart size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier'] },
      { to: '/daily-report?tab=terminer', label: 'Terminer la journée', icon: <ClipboardCheck size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier'] },
      { to: '/point-manuel', label: 'Point manuel', icon: <ClipboardList size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager'] },
      { to: '/orders', label: 'Commandes', icon: <Receipt size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier', 'employee'] },
      { to: '/menu-carte', label: 'Carte', icon: <Receipt size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager'] },
      { to: '/reservations', label: 'Réservations', icon: <CalendarDays size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier'] },
      { to: '/kitchen', label: 'Cuisine / Bar', icon: <UtensilsCrossed size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'employee'] },
      { to: '/guide', label: 'Guide démarrage', icon: <Sparkles size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier', 'employee'] },
    ] },
  {
    label: 'Gestion',
    items: [
      { to: '/inventory', label: 'Inventaire', icon: <Package size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier', 'employee'] },
      { to: '/inventory/scan', label: 'Scanner photo (OCR)', icon: <Camera size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier', 'employee'] },
      { to: '/kits', label: 'Kits & Promos', icon: <Sparkles size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager'] },
      { to: '/menu-qr', label: 'QR Code', icon: <Receipt size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager'] },
      { to: '/stock-transfer', label: 'Transfert stock', icon: <Truck size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager'] },
      { to: '/tables', label: 'Tables & serveurs', icon: <LayoutDashboard size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier'] },
      { to: '/mes-employes', label: 'Mes employés', icon: <Users size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager'] },
      { to: '/calendar', label: 'Planning', icon: <Calendar size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager'] },
      { to: '/customers', label: 'Clients', icon: <UserCircle size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier'] },
      { to: '/depot/clients', label: 'Clients dépôt', icon: <Users size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager'] },
      { to: '/depot/deliveries', label: 'Livraisons dépôt', icon: <Truck size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier'] },
      { to: '/depot/tours', label: 'Tournées', icon: <Truck size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager'] },
      { to: '/depot/creances', label: 'Créances', icon: <Wallet size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager'] },
      { to: '/depot/tracking', label: 'Suivi GPS', icon: <Truck size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'employee'] },
      { to: '/depot/consignes', label: 'Consignes', icon: <Package size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager'] },
      { to: '/depot/prices', label: 'Tarifs clients', icon: <Wallet size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager'] },
    ] },
  {
    label: 'Finances',
    items: [
      { to: '/rapports-financiers', label: 'Rapports Financiers', icon: <TrendingUp size={20} />, roles: ['super_admin', 'admin', 'owner'] },
      { to: '/expenses', label: 'Dépenses', icon: <Wallet size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager'] },
      { to: '/suppliers', label: 'Fournisseurs', icon: <Truck size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager'] },
      { to: '/purchases', label: 'Achats', icon: <ShoppingCart size={20} />, roles: ['super_admin', 'admin', 'owner'] },
      { to: '/accounting', label: 'Comptabilité', icon: <Calculator size={20} />, roles: ['super_admin', 'admin', 'owner'] },
      { to: '/statistics', label: 'Statistiques', icon: <BarChart3 size={20} />, roles: ['super_admin', 'admin', 'owner'] },
    ] },
  {
    label: 'Outils',
    items: [
      { to: '/ai', label: "Demander de l'aide", icon: <Sparkles size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier', 'employee'] },
      { to: '/ai-train', label: "Former l'IA", icon: <Brain size={20} />, roles: ['super_admin'] },
      { to: '/chat', label: 'Chat interne', icon: <MessageCircle size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier', 'employee'] },
      { to: '/notifications', label: 'Notifications', icon: <Bell size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier', 'employee'] },
      { to: '/subscription', label: 'Abonnement', icon: <Wallet size={20} />, roles: ['super_admin', 'admin', 'owner'] },
      { to: '/settings', label: 'Profil & Paramètres', icon: <Settings size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier', 'employee'] },
      { to: '/rent/equipment', label: 'Matériel', icon: <Package size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager'] },
      { to: '/rent/clients', label: 'Clients location', icon: <UserCircle size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier'] },
      { to: '/rent/orders', label: 'Commandes location', icon: <Receipt size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier'] },
      { to: '/rent/movements', label: 'Sorties & retours', icon: <Truck size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager'] },
      { to: '/rent/payments', label: 'Paiements location', icon: <Wallet size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager'] },
      { to: '/rent/calendar', label: 'Calendrier location', icon: <Calendar size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager'] },
      { to: '/rent/packs', label: 'Packs événements', icon: <Sparkles size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager'] },
      { to: '/rent/invoices', label: 'Factures location', icon: <ClipboardCheck size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager'] },
      { to: '/btp/documents', label: 'Devis & factures', icon: <FileText size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier', 'employee'] },
      { to: '/btp/clients', label: 'Clients chantier', icon: <Users size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager'] },
      { to: '/btp/materials', label: 'Matériaux BTP', icon: <Package size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier', 'employee'] },
    ] },
];


const SECTION_META: Record<string, { emoji: string; gradient: string; border: string; iconBg: string; text: string }> = {
  Principal: {
    emoji: '🏠',
    gradient: 'linear-gradient(90deg, rgba(245,158,11,0.35), rgba(234,88,12,0.2), rgba(245,158,11,0.35))',
    border: 'rgba(245,158,11,0.35)',
    iconBg: 'bg-amber-500/20 text-amber-300',
    text: 'text-amber-200' },
  Gestion: {
    emoji: '📦',
    gradient: 'linear-gradient(90deg, rgba(16,185,129,0.3), rgba(5,150,105,0.18), rgba(16,185,129,0.3))',
    border: 'rgba(16,185,129,0.35)',
    iconBg: 'bg-emerald-500/20 text-emerald-300',
    text: 'text-emerald-200' },
  Finances: {
    emoji: '💰',
    gradient: 'linear-gradient(90deg, rgba(34,197,94,0.28), rgba(234,179,8,0.22), rgba(34,197,94,0.28))',
    border: 'rgba(234,179,8,0.4)',
    iconBg: 'bg-yellow-500/20 text-yellow-300',
    text: 'text-yellow-200' },
  Outils: {
    emoji: '🛠️',
    gradient: 'linear-gradient(90deg, rgba(56,189,248,0.28), rgba(99,102,241,0.22), rgba(56,189,248,0.28))',
    border: 'rgba(56,189,248,0.35)',
    iconBg: 'bg-sky-500/20 text-sky-300',
    text: 'text-sky-200' } };

export default function AppLayout({ children }: { children: ReactNode }) {
  const planAccess = usePlanAccess();
  const allow = planAccess.allow.bind(planAccess);
  const planLimits = planAccess.plan;
  const { member, user, loading, signOut, myEstablishments, activeEstablishment, switchEstablishment, refresh, effectiveRole, viewAsRole, setViewAsRole } = useAuth();
  const location = useLocation();
  const platformAdmin =
    member?.role === 'super_admin' ||
    member?.role === 'admin' ||
    effectiveRole === 'super_admin' ||
    effectiveRole === 'admin';

  // Console Admin = app séparée (pas le chrome terrain ambre/maquis)
  if (platformAdmin) {
    if (!(location.pathname.startsWith('/console') || location.pathname.startsWith('/admin'))) {
      return <Navigate to="/console" replace />;
    }
    return <>{children}</>;
  }

  // Pas de déconnexion automatique par inactivité (règle métier)
  useEffect(() => {
    const role = member?.role;
    const uid = user?.id;
    const eid = activeEstablishment?.id || member?.establishment_id;
    if (!uid || !role) return;
    if (!['owner', 'manager', 'cashier', 'admin', 'super_admin'].includes(role)) return;
    void registerPushToken({ userId: uid, establishmentId: eid });
  }, [user?.id, member?.role, member?.establishment_id, activeEstablishment?.id]);

  const [ordersPendingCount, setOrdersPendingCount] = useState(0);
  useEffect(() => {
    const eid = activeEstablishment?.id || member?.establishment_id;
    if (!eid) { setOrdersPendingCount(0); return; }
    const pull = async () => {
      const { count } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('establishment_id', eid)
        .eq('status', 'pending');
      setOrdersPendingCount(count || 0);
    };
    void pull();
    const ch = supabase
      .channel(`nav-orders-badge-${eid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `establishment_id=eq.${eid}` }, () => { void pull(); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [activeEstablishment?.id, member?.establishment_id]);


  useEffect(() => {
    return startPrefetchInterval(
      () => activeEstablishment?.id || member?.establishment_id,
      supabase,
      3 * 60 * 1000
    );
  }, [activeEstablishment?.id, member?.establishment_id]);

  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [estSwitchOpen, setEstSwitchOpen] = useState(false);
  const [estSwitchBusy, setEstSwitchBusy] = useState(false);
  const [estSwitchError, setEstSwitchError] = useState<string | null>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getStoredTheme());
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [estRecoveryTimedOut, setEstRecoveryTimedOut] = useState(false);

  useEffect(() => {
    if (!estSwitchOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEstSwitchOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [estSwitchOpen]);

  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [estName, setEstName] = useState<string | null>(() => {
    try {
      const raw = localStorage.getItem('mm_active_est');
      if (raw) {
        const p = JSON.parse(raw);
        if (p?.name) return String(p.name);
      }
    } catch { /* */ }
    return null;
  });
  const [estLogo, setEstLogo] = useState<string | null>(null);

  const bizType = normalizeBusinessType(activeEstablishment?.type);
  const theme = BUSINESS_THEMES[bizType];
  // Tous les types d'établissements ont accès aux mêmes menus (filtrage par rôle uniquement)

  useEffect(() => {
    applyBusinessTheme(bizType);
  }, [bizType]);

  useEffect(() => {
    const on = () => {
      setIsOnline(true);
      void (async () => {
        try {
          const n = await queueCount();
          if (n > 0) {
            const r = await flushQueue(supabase);
            if (r && (r as any).done > 0) {
              /* synced */
            }
          }
        } catch { /* */ }
      })();
    };
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    setIsOnline(navigator.onLine);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  useEffect(() => {
    if (!member?.user_id) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function refreshNotifs() {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', member!.user_id)
        .eq('read', false);
      setUnreadNotifs(count ?? 0);
    }

    void (async () => {
      await refreshNotifs();
      if (activeEstablishment) {
        setEstName(activeEstablishment.name);
        setEstLogo(activeEstablishment.logo_url || null);
      } else if (member.establishment_id) {
        const { data } = await supabase
          .from('establishments')
          .select('name, logo_url, type')
          .eq('id', member.establishment_id)
          .maybeSingle();
        if (data) {
          setEstName(data.name);
          setEstLogo((data as any).logo_url ?? null);
        }
      } else {
        setEstName(null);
        setEstLogo(null);
      }
    })();

    channel = supabase
      .channel(`user-notifs-${member.user_id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${member.user_id}`,
        },
        () => {
          void refreshNotifs();
        },
      )
      .subscribe();

    return () => {
      if (channel) void supabase.removeChannel(channel);
    };
  }, [member, activeEstablishment]);

  async function handleSignOut() {
    try {
      await signOut();
    } catch { /* */ }
    window.location.replace('/login');
  }

  // Services cochés (type Établissement) → menu adapté, pas générique maquis
  const estServices =
    bizType === 'complexe'
      ? getEstablishmentServices(
          activeEstablishment?.id || member?.establishment_id,
          (activeEstablishment as { services?: string[] } | null)?.services,
        )
      : [];
  const allowedRoutes = new Set(
    bizType === 'complexe'
      ? menuRoutesForComplexe(estServices)
      : (bizType === 'complexe')
        ? (MENU_BY_TYPE.complexe || MENU_BY_TYPE.maquis)
        : MENU_BY_TYPE[bizType] || MENU_BY_TYPE.maquis,
  );

  const HOTEL_ONLY = new Set([
    '/hotel', '/hotel/rooms', '/hotel/reservations', '/hotel/guests',
    '/hotel/housekeeping', '/hotel/maintenance', '/hotel/events',
    '/hotel/services', '/hotel/settings',
  ]);

  const RENT_ONLY = new Set([
    '/rent/equipment',
    '/rent/clients',
    '/rent/orders',
    '/rent/movements',
    '/rent/payments',
    '/rent/calendar',
    '/rent/packs',
    '/rent/invoices',
  ]);

  const isLocation = bizType === 'location_event' || (bizType === 'complexe' && estServices.includes('location'));

  const visibleSections = NAV_SECTIONS.map((section) => {
    let items = section.items.filter((item) => {
      if (!member) return false;
      if (item.to === '/admin') return member.role === 'super_admin';

      // Filtre métier : uniquement les routes du type d'établissement
      const alwaysOn = item.to === '/dashboard' || item.to === '/pouvoirs' || item.to === '/settings' || item.to === '/subscription' || item.to === '/notifications' || item.to === '/chat';
      if (!alwaysOn && !allowedRoutes.has(item.to)) return false;

      // Limites de palier (Essentiel / Pro / Business)
      try {
        if ((item.to === '/kitchen') && !allow('kitchen')) return false;
        if ((item.to === '/menu-qr' || item.to === '/print-qr') && !allow('qrOrdering')) return false;
        if ((item.to === '/vision-scan' || item.to === '/ocr') && !allow('ocrAi')) return false;
      } catch { /* plan access non bloquant */ }

      // Modules location uniquement pour location_event (et dans Outils)
      if (RENT_ONLY.has(item.to) && !isLocation) return false;
      if (RENT_ONLY.has(item.to) && section.label !== 'Outils') return false;

      // Modules hôtel uniquement pour complexe hôtelier
      if (HOTEL_ONLY.has(item.to) && bizType !== 'complexe') return false;
        if (item.to.startsWith('/depot') && bizType !== 'depot') return false;
        if ((item.to === '/menu-carte' || item.to === '/reservations') && bizType !== 'restaurant' && !(bizType === 'complexe' && estServices.includes('restaurant'))) return false;
        if (bizType === 'restaurant' && (item.to === '/kits' || item.to === '/stock-transfer')) return false;

      const roleForMenu = effectiveRole || member.role;
      // Seul le propriétaire/admin voit tous les menus ; manager et caissière sont strictement filtrés
      if (['super_admin', 'admin', 'owner'].includes(roleForMenu)) {
        return true;
      }
      if (roleForMenu === 'cashier' && (item.to === '/inventory' || item.to === '/inventory/scan')) {
        return Boolean(member.can_edit_stock);
      }
      return item.roles.includes(roleForMenu);
    });

    // Libellés adaptés location
    if (isLocation && section.label === 'Outils') {
      items = items.map((item) => {
        if (item.to === '/rent/equipment') return { ...item, label: 'Parc matériel' };
        if (item.to === '/rent/clients') return { ...item, label: 'Clients' };
        if (item.to === '/rent/orders') return { ...item, label: 'Commandes' };
        if (item.to === '/rent/calendar') return { ...item, label: 'Calendrier' };
        if (item.to === '/rent/invoices') return { ...item, label: 'Devis & Factures' };
        if (item.to === '/rent/movements') return { ...item, label: 'Sorties & retours' };
        if (item.to === '/rent/payments') return { ...item, label: 'Paiements' };
        if (item.to === '/rent/packs') return { ...item, label: 'Packs événements' };
        return item;
      });
    }

    // Maquis / bar : renommer Cuisine
    if ((bizType === 'maquis') && section.label === 'Principal') {
      items = items.map((item) =>
        item.to === '/kitchen' ? { ...item, label: bizType === 'maquis' ? 'Grill / Bar' : 'Cuisine' } : item
      );
    }
    // Établissement multi-services : libellés selon services cochés
    if (bizType === 'complexe') {
      const hasResto = estServices.includes('restaurant');
      const hasMaquis = estServices.includes('maquis');
      items = items.map((item) => {
        if (item.to === '/kitchen') {
          if (hasResto && hasMaquis) return { ...item, label: 'Cuisine / Grill' };
          if (hasResto) return { ...item, label: 'Cuisine' };
          if (hasMaquis) return { ...item, label: 'Grill / Bar' };
        }
        if (item.to === '/inventory') {
          return { ...item, label: inventoryLabelForServices(estServices) };
        }
        return item;
      });
    }

    return { ...section, items };
  }).filter((section) => section.items.length > 0);

  // Cache local UNIQUEMENT s'il correspond au membre connecté (sinon fuite RCO → nouveau compte)
  let cachedEstPayload: { id?: string; type?: string; name?: string } | null = null;
  let cachedEstForThisUser = false;
  try {
    const uid = user?.id || member?.user_id;
    const raw =
      (uid && localStorage.getItem(`mm_active_est:${uid}`)) ||
      null;
    // Ne jamais utiliser mm_active_est global s'il ne matche pas le member.establishment_id
    if (raw) {
      cachedEstPayload = JSON.parse(raw);
      if (
        cachedEstPayload?.id &&
        member?.establishment_id &&
        cachedEstPayload.id === member.establishment_id
      ) {
        cachedEstForThisUser = true;
      }
    }
  } catch { /* */ }

  // Source de vérité = serveur (member + liste), pas le localStorage d'un autre compte
  const hasEstablishment = Boolean(
    member?.establishment_id ||
    (myEstablishments && myEstablishments.length > 0) ||
    (activeEstablishment?.id &&
      member?.establishment_id &&
      activeEstablishment.id === member.establishment_id)
  );

  const hadEstRef = useRef(false);
  if (hasEstablishment) hadEstRef.current = true;

  // Filet 5s : ne jamais rester bloqué sur « Récupération établissement »
  useEffect(() => {
    if (hasEstablishment || member?.establishment_id) {
      setEstRecoveryTimedOut(false);
      return;
    }
    if (!member) return;
    setEstRecoveryTimedOut(false);
    const t = window.setTimeout(() => setEstRecoveryTimedOut(true), 5000);
    return () => window.clearTimeout(t);
  }, [member, member?.establishment_id, hasEstablishment]);

  // Nouveau user sans établissement : reset le ref
  if (member && !member.establishment_id && (!myEstablishments || myEstablishments.length === 0)) {
    hadEstRef.current = false;
  }

  const isPrivileged = ['super_admin', 'admin'].includes(member?.role || '');
  const isExistingStaff =
    ['owner', 'manager', 'cashier', 'employee'].includes(member?.role || '') &&
    Boolean(member?.establishment_id);

  const isInvitedStaffRole = ['manager', 'cashier', 'employee'].includes(member?.role || '');

  // Cache local (mobile) : ne pas forcer TypePicker si on a déjà un site connu pour cet user
  let cachedIdsForUser: string[] = [];
  try {
    const rawIds = localStorage.getItem(user?.id ? `mm_est_ids:${user.id}` : '') || localStorage.getItem('mm_est_ids');
    if (rawIds) {
      const parsed = JSON.parse(rawIds);
      if (Array.isArray(parsed)) cachedIdsForUser = parsed.filter(Boolean);
    }
  } catch { /* */ }

  // TypePicker UNIQUEMENT si vraiment nouveau compte (pas de member.est, liste vide, pas de cache, pas de ref session)
  const showTypePicker =
    !loading &&
    Boolean(member) &&
    !isPrivileged &&
    !isInvitedStaffRole &&
    !member?.establishment_id &&
    !(myEstablishments && myEstablishments.length > 0) &&
    !hasEstablishment &&
    !activeEstablishment?.id &&
    !hadEstRef.current &&
    cachedIdsForUser.length === 0;

  if (!loading && isInvitedStaffRole && !member?.establishment_id && !hasEstablishment) {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-100 flex items-center justify-center p-6">
      {!isOnline && (
        <div className="sticky top-0 z-[60] bg-gradient-to-r from-amber-600 via-amber-500 to-orange-500 text-stone-950 text-center text-xs font-bold py-2 px-3 flex items-center justify-center gap-2 shadow-md">
          <span className="inline-flex h-2 w-2 rounded-full bg-stone-950 animate-pulse" aria-hidden />
          Hors ligne — travail local actif · sync au retour du réseau
        </div>
      )}
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-xl font-bold">Compte équipe</h1>
          <p className="text-stone-400 text-sm">
            Votre compte est reconnu comme membre d&apos;équipe, mais aucun établissement
            ne vous est encore lié. Demandez au propriétaire de recréer ou confirmer votre accès
            dans <strong>Mon équipe</strong>.
          </p>
          <button type="button" className="btn-secondary" onClick={() => refresh()}>
            Réessayer
          </button>
          <button
            type="button"
            className="btn-ghost text-sm text-stone-400"
            onClick={async () => {
              try {
                await signOut();
              } catch {
                window.location.replace('/login');
              }
            }}
          >
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  // Ne plus bloquer l’UI : le menu s’affiche toujours.
  // L’établissement se charge en arrière-plan (cache local + refresh).

  if (showTypePicker) {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-100">
        <TypePicker mode="create" onDone={() => refresh()} />
      </div>
    );
  }

  // Type inconnu : ne pas bloquer toute l'app — fallback type "maquis"
  const knownTypes = new Set([
    'maquis', 'restaurant', 'location_event', 'depot', 'complexe',
  ]);
  const rawType = (activeEstablishment?.type || cachedEstPayload?.type || '').toLowerCase().trim();
  // Ancien écran "choose-type" désactivé pour éviter le spam récursif chez tous les users
  // if (member?.establishment_id && activeEstablishment && rawType && !knownTypes.has(rawType)) { TypePicker choose-type }
  void rawType;
  void knownTypes;

  return (
    <BiometricGate>
    <ServiceDayProvider>
    <div className="min-h-screen bg-stone-950 flex">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-stone-900 border-r border-stone-800 flex flex-col z-40 transition-transform lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-stone-800 shrink-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 overflow-hidden shadow-sm"
            style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` }}
          >
            {estLogo ? (
              <img src={estLogo} alt="" className="w-full h-full object-cover" />
            ) : (
              <Beer size={20} className="text-white" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold font-display text-stone-100 text-sm truncate">
              {estName || 'GESMAK'}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span
                className="inline-block px-1.5 py-0.5 rounded-md text-[10px] font-bold tracking-wide truncate max-w-full"
                style={{ background: theme.primarySoft, color: theme.primary }}
              >
                {BUSINESS_LABELS[bizType]}
              </span>
              {member && (
                <span className="text-[10px] text-stone-500 truncate">{ROLE_LABELS[member.role]}</span>
              )}
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-3 overflow-y-auto">
          {visibleSections.map((section, sIdx) => {
            const meta = SECTION_META[section.label] || {
              emoji: '✨',
              gradient: 'linear-gradient(90deg, rgba(168,162,158,0.25), rgba(87,83,78,0.2))',
              border: 'rgba(168,162,158,0.3)',
              iconBg: 'bg-stone-600/40 text-stone-300',
              text: 'text-stone-300' };
            return (
            <div
              key={section.label}
              className="nav-section-card"
              style={{ borderColor: meta.border, animationDelay: `${sIdx * 0.15}s` }}
            >
              <div
                className={`nav-section-head ${meta.text}`}
                style={{ backgroundImage: meta.gradient, border: `1px solid ${meta.border}` }}
              >
                <span className="nav-section-emoji" style={{ animationDelay: `${sIdx * 0.3}s` }}>
                  {meta.emoji}
                </span>
                <span>{section.label}</span>
                <span className="ml-auto opacity-70 text-[10px]">{section.items.length}</span>
              </div>
              <div className="space-y-0.5 px-0.5 pb-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/dashboard'}
                    onClick={(e) => {
                      setSidebarOpen(false);
                      // Force navigation (certains WebView APK n'appliquent pas le NavLink)
                      if (item.to === '/daily-report' || item.to === '/cloture') {
                        e.preventDefault();
                        navigate(item.to);
                      }
                    }}
                    className={({ isActive }) =>
                      `nav-item-link flex items-center gap-2.5 px-2 py-2 rounded-xl text-sm font-medium transition-all ${
                        isActive
                          ? 'active bg-stone-800/90 text-stone-50 shadow-inner ring-1 ring-white/10'
                          : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800/50'
                      }`
                    }
                  >
                    <span className={`nav-item-icon ${meta.iconBg}`}>
                      {item.icon}
                    </span>
                    <span className="flex-1 truncate flex items-center gap-1">
                      {menuLabelFor(item.to, bizType) || item.label}
                      {item.to === '/orders' && ordersPendingCount > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[1.15rem] h-5 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold">
                          {ordersPendingCount}
                        </span>
                      )}
                    </span>
                    {item.to === '/notifications' && unreadNotifs > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-error-500 text-white animate-pulse">
                        {unreadNotifs}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
            );
          })}
        </nav>

        {/* Sélecteur d'activité — menu déroulant custom (mobile-friendly) */}
        {member &&
          canManageEstablishments(member.role) &&
          myEstablishments.length >= 1 && (
          <div className="px-3 pb-3 relative z-20">
            <p
              className="text-[10px] uppercase tracking-wide px-1 flex items-center gap-1 mb-1.5 font-semibold"
              style={{ color: theme.primary }}
            >
              <span className="nav-section-emoji text-sm">🎯</span> Activité
              {myEstablishments.length > 1 && (
                <span className="ml-auto text-[10px] font-semibold opacity-90 normal-case tracking-normal">
                  {myEstablishments.length} sites
                </span>
              )}
            </p>

            {myEstablishments.length === 1 ? (
              <button
                type="button"
                onClick={() => {
                  setSidebarOpen(false);
                  navigate('/dashboard');
                }}
                className="w-full rounded-xl border bg-stone-900/80 px-3 py-2.5 text-left hover:bg-stone-800/80 transition"
                style={{ borderColor: `${theme.primary}55` }}
              >
                <p className="text-sm font-semibold text-stone-100 truncate">{myEstablishments[0].name}</p>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <span
                    className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold truncate"
                    style={{ background: theme.primarySoft, color: theme.primary }}
                  >
                    {BUSINESS_LABELS[normalizeBusinessType(myEstablishments[0].type)] || myEstablishments[0].type}
                  </span>
                  <span className="text-[10px] text-stone-400 shrink-0">Changer →</span>
                </div>
              </button>
            ) : (
              <div className="relative">
                <button
                  type="button"
                  disabled={estSwitchBusy}
                  onClick={() => setEstSwitchOpen((v) => !v)}
                  className="w-full flex items-center gap-2 rounded-xl border bg-stone-900 px-3 py-2.5 text-left hover:bg-stone-800 active:scale-[0.99] transition disabled:opacity-60"
                  style={{ borderColor: `${theme.primary}66` }}
                  aria-haspopup="listbox"
                  aria-expanded={estSwitchOpen}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-stone-100 truncate">
                      {activeEstablishment?.name
                        || myEstablishments.find((e) => e.id === member?.establishment_id)?.name
                        || 'Choisir un établissement'}
                    </p>
                    <p className="text-[11px] truncate" style={{ color: theme.primary }}>
                      {BUSINESS_LABELS[bizType]} · changer de site
                    </p>
                  </div>
                  <ChevronsUpDown size={18} className="shrink-0" style={{ color: theme.primary }} />
                </button>

                {estSwitchOpen && (
                  <>
                    <button
                      type="button"
                      className="fixed inset-0 z-30 cursor-default"
                      aria-label="Fermer la liste"
                      onClick={() => setEstSwitchOpen(false)}
                    />
                    <ul
                      role="listbox"
                      className="absolute left-0 right-0 bottom-full mb-1 z-40 max-h-56 overflow-y-auto rounded-xl border border-stone-600 bg-stone-950 shadow-xl shadow-black/50 py-1"
                    >
                      {myEstablishments.map((e) => {
                        const selected =
                          (activeEstablishment?.id || member?.establishment_id) === e.id;
                        const eType = normalizeBusinessType(e.type);
                        const eTheme = BUSINESS_THEMES[eType];
                        return (
                          <li key={e.id}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={selected}
                              disabled={estSwitchBusy || selected}
                              className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm transition text-stone-200 hover:bg-stone-800 active:bg-stone-800 disabled:opacity-90"
                              style={selected ? { background: eTheme.primarySoft } : undefined}
                              onClick={async () => {
                                if (selected) {
                                  setEstSwitchOpen(false);
                                  return;
                                }
                                setEstSwitchBusy(true);
                                setEstSwitchError(null);
                                try {
                                  await switchEstablishment(e.id);
                                  setEstSwitchOpen(false);
                                  setSidebarOpen(false);
                                } catch (err: any) {
                                  setEstSwitchError(err?.message || 'Changement impossible');
                                } finally {
                                  setEstSwitchBusy(false);
                                }
                              }}
                            >
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold truncate">{e.name}</p>
                                <p className="text-[11px] truncate" style={{ color: eTheme.primary }}>
                                  {BUSINESS_LABELS[eType] || e.type}
                                </p>
                              </div>
                              {selected && <Check size={16} className="shrink-0" style={{ color: eTheme.primary }} />}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </div>
            )}
            {estSwitchError && (
              <p className="mt-1.5 text-[11px] text-red-300 px-1">{estSwitchError}</p>
            )}
          </div>
        )}
        <div className="p-3 border-t border-stone-800 shrink-0">
          <div className="px-3 pb-2 flex items-center gap-1.5 opacity-70">
            <img src="/logo-circle.png" alt="" className="w-4 h-4 rounded-full object-cover" />
            <span className="text-[10px] font-semibold tracking-wide text-stone-500">GESMAK</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-stone-700 flex items-center justify-center shrink-0">
              <Users size={16} className="text-stone-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-stone-200 truncate">{member?.full_name ?? displayLogin(member?.email)}</p>
              <p className="text-xs text-stone-500 truncate">
                {displayLogin(member?.email)}
                {member?.assigned_pole_code ? ` · ${member.assigned_pole_code}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-stone-400 hover:text-error-300 hover:bg-error-500/10 transition-all"
          >
            <LogOut size={18} /> Déconnexion
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-stone-900 border-b border-stone-800 sticky top-0 z-20">
          <button onClick={() => setSidebarOpen(true)} className="text-stone-300">
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2 min-w-0 flex-1 justify-center px-1">
            <span className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center">
              <span
                className="absolute inset-0 rounded-full border opacity-90"
                style={{ borderColor: `${theme.primary}88` }}
                aria-hidden
              />
              <img
                src={estLogo || '/logo-circle.png'}
                alt={estName || 'GESMAK'}
                className="relative z-[1] h-9 w-9 rounded-full object-cover border border-orange-200/40 bg-white"
                onError={(e) => { (e.target as HTMLImageElement).src = '/logo-gesmak-icon.png'; }}
              />
            </span>
            <div className="min-w-0 flex flex-col items-start">
              <span className="font-display font-bold text-stone-100 truncate text-sm max-w-[155px]">
                {estName || 'GESMAK'}
              </span>
              <span
                className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide truncate"
                style={{ background: theme.primarySoft, color: theme.primary }}
              >
                Actif · {BUSINESS_LABELS[bizType]}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                const next = themeMode === 'dark' ? 'light' : 'dark';
                applyTheme(next);
                setThemeMode(next);
              }}
              className="text-stone-300 p-2 rounded-lg hover:bg-stone-800"
              title={themeMode === 'dark' ? 'Mode jour' : 'Mode sombre'}
              aria-label="Changer le thème"
            >
              {themeMode === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button
              onClick={handleSignOut}
              className="text-stone-300 p-1 rounded-lg hover:bg-stone-800"
              title="Déconnexion"
              aria-label="Déconnexion"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

        
        {/* Bascule thème — bureau, haut droite */}
        <div className="hidden lg:flex justify-end px-8 pt-4 pb-0">
          <button
            type="button"
            onClick={() => {
              const next = themeMode === 'dark' ? 'light' : 'dark';
              applyTheme(next);
              setThemeMode(next);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-stone-700 bg-stone-900 px-3 py-2 text-sm text-stone-200 hover:border-amber-500/50"
            title={themeMode === 'dark' ? 'Passer en mode jour' : 'Passer en mode sombre'}
          >
            {themeMode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            {themeMode === 'dark' ? 'Mode jour' : 'Mode sombre'}
          </button>
        </div>

        <main className="flex-1 p-4 lg:p-8 pb-36"><SubscriptionGate />
          <DailyReportGate />
          <OrderRealtimeAlert />
          <OwnerReportReminder />
          <ReportDelayNotifier />
          <PermissionsOnboarding />
        <MfaGate>{children}</MfaGate></main>
        <UpdateBanner />
      <BrandFooter />
      
      {/* Barre bas mobile — adaptée dynamiquement au type d'activité */}
      <nav data-no-print className="bottom-nav-maquis lg:hidden fixed bottom-0 inset-x-0 z-50 border-t border-stone-800 bg-stone-900/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
        <div className="flex overflow-x-auto no-scrollbar max-w-lg mx-auto">
          {(bizType === 'location_event'
            ? [
                { to: '/dashboard', label: 'Accueil', icon: <LayoutDashboard size={20} /> },
                { to: '/rent/equipment', label: 'Matériel', icon: <Package size={20} /> },
                { to: '/rent/orders', label: 'Location', icon: <Receipt size={20} /> },
                { to: '/rent/calendar', label: 'Calendrier', icon: <Calendar size={20} /> },
                { to: '/rent/clients', label: 'Clients', icon: <UserCircle size={20} /> },
              ]
            : bizType === 'complexe'
              ? [
                  { to: '/hotel', label: 'Hôtel', icon: <Building2 size={20} /> },
                  { to: '/hotel/rooms', label: 'Chambres', icon: <Building2 size={20} /> },
                  { to: '/hotel/reservations', label: 'Résas', icon: <Calendar size={20} /> },
                  { to: '/pos', label: 'Caisse', icon: <ShoppingCart size={20} /> },
                  { to: '/dashboard', label: 'Global', icon: <LayoutDashboard size={20} /> },
                ]
              : bizType === 'depot'
                ? [
                    { to: '/dashboard', label: 'Accueil', icon: <LayoutDashboard size={20} /> },
                    { to: '/inventory', label: 'Stock gros', icon: <Package size={20} /> },
                    { to: '/depot/deliveries', label: 'Livraisons', icon: <Truck size={20} /> },
                    { to: '/depot/clients', label: 'Clients', icon: <Users size={20} /> },
                    { to: '/depot/creances', label: 'Créances', icon: <Wallet size={20} /> },
                    { to: '/daily-report', label: 'CA', icon: <BarChart3 size={20} /> },
                  ]
                : bizType === 'restaurant'
                  ? [
                      { to: '/dashboard', label: 'Accueil', icon: <LayoutDashboard size={20} /> },
                      { to: '/tables', label: 'Salle', icon: <LayoutDashboard size={20} /> },
                      { to: '/orders', label: 'Commandes', icon: <Receipt size={20} /> },
                      { to: '/kitchen', label: 'Cuisine', icon: <UtensilsCrossed size={20} /> },
                      { to: '/pos', label: 'Caisse', icon: <ShoppingCart size={20} /> },
                      { to: '/menu-carte', label: 'Carte', icon: <FileText size={20} /> },
                    ]
                  : [
                      { to: '/dashboard', label: 'Accueil', icon: <LayoutDashboard size={20} /> },
                      { to: '/inventory', label: 'Stock', icon: <Package size={20} /> },
                      { to: '/inventory/scan', label: 'Arrivage', icon: <Camera size={20} /> },
                      { to: '/orders', label: 'Commandes', icon: <Receipt size={20} /> },
                      { to: '/pos', label: 'Caisse', icon: <ShoppingCart size={20} /> },
                      { to: '/daily-report', label: 'CA', icon: <BarChart3 size={20} /> },
                      { to: '/menu-qr', label: 'QR', icon: <QrCode size={20} /> },
                    ]
          ).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard' || item.to === '/hotel'}
              onClick={() => setSidebarOpen(false)}
              style={({ isActive }) => (isActive ? { color: theme.primary } : undefined)}
              className={({ isActive }) =>
                `flex-1 min-w-[52px] flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-[10px] font-semibold transition-colors ${
                  isActive ? '' : 'text-stone-400'
                }`
              }
            >
              {item.icon}
              <span className="truncate">{item.label}
                    {item.to === '/orders' && ordersPendingCount > 0 && (
                      <span className="ml-0.5 inline-flex items-center justify-center min-w-[1rem] h-4 px-1 rounded-full bg-red-600 text-white text-[9px] font-bold">
                        {ordersPendingCount}
                      </span>
                    )}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <OfflineBanner />
      </div>

      {sidebarOpen && (
        <button onClick={() => setSidebarOpen(false)} className="fixed top-4 right-4 z-50 text-stone-300 lg:hidden">
          <X size={24} />
        </button>
      )}
    </div>
    </ServiceDayProvider>
    </BiometricGate>
  );
}
