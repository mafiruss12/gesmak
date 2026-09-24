import { type ReactNode, useState, useEffect , useRef} from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Package, Camera, ClipboardCheck, QrCode, Users, Building2, Beer, LogOut, Menu, X, UserCog, ClipboardList, Calculator, BarChart3, Truck, UserCircle, Calendar, UtensilsCrossed, Bell, Settings, Sparkles, Receipt, Wallet, MessageCircle, FileText, Crown, Brain, Sun, Moon, Wrench } from 'lucide-react';
import DailyReportGate from '@/components/DailyReportGate';
import OwnerReportReminder from '@/components/OwnerReportReminder';
import ReportDelayNotifier from '@/components/ReportDelayNotifier';
import PermissionsOnboarding from '@/components/PermissionsOnboarding';
import SubscriptionGate from '@/components/SubscriptionGate';
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
      { to: '/hotel', label: 'Dashboard hôtel', icon: <Building2 size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier', 'employee'] },
      { to: '/hotel/rooms', label: 'Chambres', icon: <Building2 size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier', 'employee'] },
      { to: '/hotel/reservations', label: 'Réservations', icon: <Calendar size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier', 'employee'] },
      { to: '/hotel/guests', label: 'Clients hôtel', icon: <UserCircle size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier', 'employee'] },
      { to: '/hotel/housekeeping', label: 'Housekeeping', icon: <Sparkles size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'employee'] },
      { to: '/hotel/maintenance', label: 'Maintenance', icon: <Wrench size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'employee'] },
      { to: '/hotel/events', label: 'Événementiel', icon: <Calendar size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier'] },
      { to: '/hotel/services', label: 'Services complexe', icon: <Settings size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager'] },
      { to: '/hotel/settings', label: 'Paramètres hôtel', icon: <Settings size={20} />, roles: ['super_admin', 'admin', 'owner'] },
      { to: '/patron', label: 'Mode patron', icon: <Crown size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager'] },
      { to: '/mon-service', label: 'Mon service', icon: <Users size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier', 'employee'] },
      { to: '/daily-report', label: 'Rapport du jour', icon: <ClipboardCheck size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier', 'employee'] },
      { to: '/live-sales', label: 'Ventes journée', icon: <ShoppingCart size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier', 'employee'] },
      { to: '/point-manuel', label: 'Point manuel', icon: <ClipboardList size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier', 'employee'] },
      { to: '/orders', label: 'Commandes', icon: <Receipt size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier', 'employee'] },
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
    ] },
  {
    label: 'Finances',
    items: [
      { to: '/expenses', label: 'Dépenses', icon: <Wallet size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager'] },
      { to: '/suppliers', label: 'Fournisseurs', icon: <Truck size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager'] },
      { to: '/purchases', label: 'Achats', icon: <ShoppingCart size={20} />, roles: ['super_admin', 'admin', 'owner'] },
      { to: '/accounting', label: 'Comptabilité', icon: <Calculator size={20} />, roles: ['super_admin', 'admin', 'owner'] },
      { to: '/statistics', label: 'Statistiques', icon: <BarChart3 size={20} />, roles: ['super_admin', 'admin', 'owner'] },
    ] },
  {
    label: 'Outils',
    items: [
      { to: '/ai', label: 'Assistant IA', icon: <Sparkles size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier', 'employee'] },
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

  // Pas de déconnexion automatique par inactivité (règle métier)
  useEffect(() => {
    return startPrefetchInterval(
      () => activeEstablishment?.id || member?.establishment_id,
      supabase,
      3 * 60 * 1000
    );
  }, [activeEstablishment?.id, member?.establishment_id]);

  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getStoredTheme());
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [estRecoveryTimedOut, setEstRecoveryTimedOut] = useState(false);

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
    window.location.assign('/');
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
      : bizType === 'complexe_hotelier'
        ? (MENU_BY_TYPE.complexe_hotelier || MENU_BY_TYPE.maquis)
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
      const alwaysOn = item.to === '/daily-report' || item.to === '/dashboard' || item.to === '/settings';
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
      if (HOTEL_ONLY.has(item.to) && bizType !== 'complexe_hotelier' && bizType !== 'complexe') return false;

      const roleForMenu = effectiveRole || member.role;
      if (['super_admin', 'admin', 'owner', 'manager'].includes(roleForMenu)) {
        return true;
      }
      const r = roleForMenu;
      return item.roles.includes(r);
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
        item.to === '/kitchen' ? { ...item, label: 'Grill / Bar' } : item
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
        <div className="sticky top-0 z-[60] bg-amber-600 text-stone-950 text-center text-xs font-semibold py-1.5 px-3">
          Hors ligne — vous pouvez continuer le travail local ; synchronisation dès le retour du réseau
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
    'maquis', 'restaurant', 'magasin', 'boutique', 'superette', 'quincaillerie', 'depot', 'complexe', 'complexe_hotelier', 'location_event', 'btp',
    'quincaillerie', 'location_event', 'btp',
  ]);
  const rawType = (activeEstablishment?.type || cachedEstPayload?.type || '').toLowerCase().trim();
  // Ancien écran "choose-type" désactivé pour éviter le spam récursif chez tous les users
  // if (member?.establishment_id && activeEstablishment && rawType && !knownTypes.has(rawType)) { TypePicker choose-type }
  void rawType;
  void knownTypes;

  return (
    <BiometricGate>
    <div className="min-h-screen bg-stone-950 flex">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-stone-900 border-r border-stone-800 flex flex-col z-40 transition-transform lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-2 px-5 py-4 border-b border-stone-800 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shrink-0 overflow-hidden">
            {estLogo ? (
              <img src={estLogo} alt="" className="w-full h-full object-cover" />
            ) : (
              <Beer size={20} className="text-white" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-bold font-display text-stone-100 text-sm truncate">
              {estName || 'Stock Manager AI'}
            </p>
            <p className="text-xs text-stone-500 truncate">{member ? ROLE_LABELS[member.role] : ''}</p>
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
                    <span className="flex-1 truncate">{menuLabelFor(item.to, bizType) || item.label}</span>
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

        {/* Sélecteur d'activité : uniquement propriétaire/admin avec plusieurs établissements */}
        {member &&
          ['super_admin', 'admin', 'owner'].includes(member.role) &&
          myEstablishments.length > 1 && (
          <div className="px-3 pb-2">
            <label className="text-[10px] uppercase tracking-wide text-violet-300/90 px-1 flex items-center gap-1">
              <span className="nav-section-emoji text-sm">🎯</span> Activité
            </label>
            <select
              className="input-field text-sm py-2 mt-1"
              value={activeEstablishment?.id || member?.establishment_id || ''}
              onChange={async (e) => {
                if (e.target.value) await switchEstablishment(e.target.value);
              }}
              style={{ borderColor: theme.primary + '55' }}
            >
              {myEstablishments.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({BUSINESS_LABELS[normalizeBusinessType(e.type)]})
                </option>
              ))}
            </select>
          </div>
        )}
        {member &&
          ['super_admin', 'admin', 'owner'].includes(member.role) &&
          myEstablishments.length === 1 && (
          <div className="px-3 pb-2">
            <p className="text-[10px] uppercase tracking-wide text-violet-300/90 px-1 flex items-center gap-1">
              <span className="nav-section-emoji text-sm">🎯</span> Activité
            </p>
            <p className="text-xs text-stone-400 px-1 mt-1 truncate">
              {myEstablishments[0].name} ({BUSINESS_LABELS[normalizeBusinessType(myEstablishments[0].type)]})
            </p>
          </div>
        )}
        <div className="p-3 border-t border-stone-800 shrink-0">
          <div className="flex items-center gap-2 px-3 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-stone-700 flex items-center justify-center shrink-0">
              <Users size={16} className="text-stone-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-stone-200 truncate">{member?.full_name ?? displayLogin(member?.email)}</p>
              <p className="text-xs text-stone-500 truncate">{displayLogin(member?.email)}</p>
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
            <img
              src="/logo-sm.png"
              alt="Stock Manager"
              className="w-8 h-8 rounded-full object-cover shrink-0 border border-amber-500/30"
            />
            <span className="font-display font-bold text-stone-100 truncate text-sm">
              {estName || 'Stock Manager AI'}
            </span>
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
          <OwnerReportReminder />
          <ReportDelayNotifier />
          <PermissionsOnboarding />
        <MfaGate>{children}</MfaGate></main>
        <UpdateBanner />
      <BrandFooter />
      
      {/* Barre bas mobile — adaptée au type d'établissement */}
      <nav data-no-print className="bottom-nav-maquis lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-stone-800 bg-stone-900/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5 gap-0 max-w-lg mx-auto">
          {(bizType === 'depot'
            ? [
                { to: '/dashboard', label: 'Accueil', icon: <LayoutDashboard size={22} /> },
                { to: '/depot/deliveries', label: 'Livraisons', icon: <Truck size={22} /> },
                { to: '/depot/clients', label: 'Clients', icon: <Users size={22} /> },
                { to: '/inventory', label: 'Stock', icon: <Package size={22} /> },
                { to: '/daily-report', label: 'Journal', icon: <ClipboardCheck size={22} /> },
              ]
            : bizType === 'btp'
            ? [
                { to: '/dashboard', label: 'Accueil', icon: <LayoutDashboard size={22} /> },
                { to: '/btp/documents', label: 'Devis', icon: <FileText size={22} /> },
                { to: '/btp/clients', label: 'Clients', icon: <Users size={22} /> },
                { to: '/btp/materials', label: 'Matériaux', icon: <Package size={22} /> },
                { to: '/ai', label: 'IA', icon: <Brain size={22} /> },
              ]
            : bizType === 'location_event'
            ? [
                { to: '/dashboard', label: 'Accueil', icon: <LayoutDashboard size={22} /> },
                { to: '/rent/orders', label: 'Commandes', icon: <Receipt size={22} /> },
                { to: '/rent/clients', label: 'Clients', icon: <Users size={22} /> },
                { to: '/rent/equipment', label: 'Matériel', icon: <Package size={22} /> },
                { to: '/rent/calendar', label: 'Agenda', icon: <Calendar size={22} /> },
              ]
            : bizType === 'restaurant'
            ? [
                { to: '/dashboard', label: 'Accueil', icon: <LayoutDashboard size={22} /> },
                { to: '/orders', label: 'Commandes', icon: <Receipt size={22} /> },
                { to: '/print-qr', label: 'Imprimer QR', icon: <QrCode size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager'] },
      { to: '/tables', label: 'Tables', icon: <UtensilsCrossed size={22} /> },
                { to: '/kitchen', label: 'Cuisine', icon: <Package size={22} /> },
                { to: '/daily-report', label: 'Journal', icon: <ClipboardCheck size={22} /> },
              ]
            : bizType === 'complexe_hotelier'
            ? [
                { to: '/hotel', label: 'Hôtel', icon: <Building2 size={22} /> },
                { to: '/hotel/rooms', label: 'Chambres', icon: <Building2 size={22} /> },
                { to: '/hotel/reservations', label: 'Résa', icon: <Calendar size={22} /> },
                { to: '/pos', label: 'Caisse', icon: <ShoppingCart size={22} /> },
                { to: '/hotel/housekeeping', label: 'Ménage', icon: <Sparkles size={22} /> },
              ]
            : bizType === 'complexe'
            ? [
                { to: '/dashboard', label: 'Accueil', icon: <LayoutDashboard size={22} /> },
                ...(estServices.includes('restaurant')
                  ? [
                      { to: '/orders', label: 'Commandes', icon: <Receipt size={22} /> },
                      { to: '/tables', label: 'Tables', icon: <UtensilsCrossed size={22} /> },
                    ]
                  : [
                      { to: '/live-sales', label: 'Ventes', icon: <ShoppingCart size={20} /> },
                      { to: '/pos', label: 'Caisse', icon: <ShoppingCart size={22} /> },
                    ]),
                { to: '/inventory', label: inventoryLabelForServices(estServices), icon: <Package size={22} /> },
                { to: '/daily-report', label: 'Journal', icon: <ClipboardCheck size={22} /> },
              ]
            : ['boutique', 'magasin', 'superette', 'quincaillerie'].includes(bizType)
            ? [
                { to: '/dashboard', label: 'Accueil', icon: <LayoutDashboard size={22} /> },
                { to: '/pos', label: 'Caisse', icon: <ShoppingCart size={22} /> },
                { to: '/inventory', label: 'Stock', icon: <Package size={22} /> },
                { to: '/customers', label: 'Clients', icon: <Users size={22} /> },
                { to: '/daily-report', label: 'Journal', icon: <ClipboardCheck size={22} /> },
              ]
            : bizType === 'maquis'
            ? [
                { to: '/dashboard', label: 'Accueil', icon: <LayoutDashboard size={22} /> },
                { to: '/live-sales', label: 'Ventes journée', icon: <ShoppingCart size={20} /> },
                { to: '/pos', label: 'Caisse', icon: <ShoppingCart size={22} /> },
                { to: '/inventory', label: 'Boissons', icon: <Package size={22} /> },
                { to: '/daily-report', label: 'Journal', icon: <ClipboardCheck size={22} /> },
              ]
            : [
                { to: '/dashboard', label: 'Accueil', icon: <LayoutDashboard size={22} /> },
                { to: '/pos', label: 'Caisse', icon: <ShoppingCart size={22} /> },
                { to: '/inventory', label: 'Stock', icon: <Package size={22} /> },
                { to: '/daily-report', label: 'Journal', icon: <ClipboardCheck size={22} /> },
                { to: '/settings', label: 'Réglages', icon: <Settings size={22} /> },
              ]
          ).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-[10px] font-semibold transition-colors ${
                  isActive ? 'text-amber-400' : 'text-stone-400'
                }`
              }
            >
              {item.icon}
              <span>{item.label}</span>
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
    </BiometricGate>
  );
}
