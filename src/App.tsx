import { useState, useEffect, Suspense } from 'react';
import { lazyWithRetry as lazy } from '@/lib/lazyWithRetry';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from '@/lib/auth';
import PlanGate from '@/components/PlanGate';
import { isLocationEvent, isBtp } from '@/lib/businessTypes';
import { isHotelComplex } from '@/lib/hotel';
import AppLayout from '@/components/AppLayout';
import ErrorBoundary from '@/components/ErrorBoundary';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const AuthCallback = lazy(() => import('@/pages/AuthCallback'));
const AuthPage = lazy(() => import('@/pages/AuthPage'));
const PublicHome = lazy(() => import('@/pages/PublicHome'));
const PublicEstablishments = lazy(() => import('@/pages/public/PublicEstablishments'));
const PublicEvents = lazy(() => import('@/pages/public/PublicEvents'));
const PublicServices = lazy(() => import('@/pages/public/PublicServices'));
const PublicFavorites = lazy(() => import('@/pages/public/PublicFavorites'));
const PublicDiscover = lazy(() => import('@/pages/public/PublicDiscover'));
const PublicEstablishmentProfile = lazy(() => import('@/pages/public/PublicEstablishmentProfile'));
const PublicCategory = lazy(() => import('@/pages/public/PublicCategory'));
const PendingAccessPage = lazy(() => import('@/pages/PendingAccessPage'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Documents = lazy(() => import('@/pages/Documents'));
const Caisse = lazy(() => import('@/pages/Caisse'));
const Inventaire = lazy(() => import('@/pages/Inventaire'));
const ScanInventaire = lazy(() => import('@/pages/ScanInventaire'));
const DepotClients = lazy(() => import('@/pages/DepotClients'));
const DepotDeliveries = lazy(() => import('@/pages/DepotDeliveries'));
const DepotTours = lazy(() => import('@/pages/depot/DepotTours'));
const DepotCreances = lazy(() => import('@/pages/depot/DepotCreances'));
const DepotTracking = lazy(() => import('@/pages/depot/DepotTracking'));
const DepotConsignes = lazy(() => import('@/pages/depot/DepotConsignes'));
const DepotPrices = lazy(() => import('@/pages/depot/DepotPrices'));
const PublicDepotsMap = lazy(() => import('@/pages/public/PublicDepotsMap'));
const LiveDaySales = lazy(() => import('@/pages/LiveDaySales'));
const MonService = lazy(() => import('@/pages/MonService'));
const PrintTableQR = lazy(() => import('@/pages/PrintTableQR'));
const PatronMode = lazy(() => import('@/pages/PatronMode'));
const AITrain = lazy(() => import('@/pages/AITrain'));
const DailyReportPage = lazy(() => import('@/pages/DailyReport'));
const DailyReportHub = lazy(() => import('@/pages/DailyReportHub'));
const RedirectToReportTab = lazy(() =>
  import('@/pages/DailyReportHub').then((m) => ({ default: m.RedirectToReportTab }))
);
const ClotureZPage = lazy(() => import('@/pages/ClotureZ'));
const SuperAdmin = lazy(() => import('@/pages/SuperAdmin'));
const Employees = lazy(() => import('@/pages/Employees'));
const Expenses = lazy(() => import('@/pages/Expenses'));
const Suppliers = lazy(() => import('@/pages/Suppliers'));
const Purchases = lazy(() => import('@/pages/Purchases'));
const Customers = lazy(() => import('@/pages/Customers'));
const Tables = lazy(() => import('@/pages/Tables'));
const MenuCarte = lazy(() => import('@/pages/restaurant/MenuCarte'));
const Reservations = lazy(() => import('@/pages/restaurant/Reservations'));
const Orders = lazy(() => import('@/pages/Orders'));
const Kitchen = lazy(() => import('@/pages/Kitchen'));
const Accounting = lazy(() => import('@/pages/Accounting'));
const Statistics = lazy(() => import('@/pages/Statistics'));
const Reports = lazy(() => import('@/pages/Reports'));
const Notifications = lazy(() => import('@/pages/Notifications'));
const SettingsPage = lazy(() => import('@/pages/Settings'));
const SyncPending = lazy(() => import('@/pages/SyncPending'));
const AIAssistant = lazy(() => import('@/pages/AIAssistant'));
const CalendarPage = lazy(() => import('@/pages/CalendarPage'));
const ChatPage = lazy(() => import('@/pages/Chat'));
const SuiviGerant = lazy(() => import('@/pages/SuiviGerant'));
const TeamPage = lazy(() => import('@/pages/Team'));
const MesEmployes = lazy(() => import('@/pages/MesEmployes'));
const PointManuel = lazy(() => import('@/pages/PointManuel'));
const GuidePage = lazy(() => import('@/pages/Guide'));
const SubscriptionPage = lazy(() => import('@/pages/Subscription'));
const KitsPromos = lazy(() => import('@/pages/KitsPromos'));
const MenuQR = lazy(() => import('@/pages/MenuQR'));
const PublicMenu = lazy(() => import('@/pages/PublicMenu'));
const PublicTableOrder = lazy(() => import('@/pages/public/PublicTableOrder'));
const StockTransfer = lazy(() => import('@/pages/StockTransfer'));
const RentDashboard = lazy(() => import('@/pages/rent/Dashboard'));
const RentEquipment = lazy(() => import('@/pages/rent/Equipment'));
const RentClients = lazy(() => import('@/pages/rent/Clients'));
const RentOrders = lazy(() => import('@/pages/rent/Orders'));
const RentMovements = lazy(() => import('@/pages/rent/Movements'));
const RentPayments = lazy(() => import('@/pages/rent/Payments'));
const RentCalendar = lazy(() => import('@/pages/rent/Calendar'));
const RentPacks = lazy(() => import('@/pages/rent/Packs'));
const RentInvoices = lazy(() => import('@/pages/rent/Invoices'));
const BtpDashboard = lazy(() => import('@/pages/btp/Dashboard'));
const BtpDocuments = lazy(() => import('@/pages/btp/Documents'));
const BtpClients = lazy(() => import('@/pages/btp/Clients'));
const BtpMaterials = lazy(() => import('@/pages/btp/Materials'));
const HotelDashboard = lazy(() => import('@/pages/hotel/HotelDashboard'));
const HotelRooms = lazy(() => import('@/pages/hotel/HotelRooms'));
const HotelReservations = lazy(() => import('@/pages/hotel/HotelReservations'));
const HotelGuests = lazy(() => import('@/pages/hotel/HotelGuests'));
const HotelHousekeeping = lazy(() => import('@/pages/hotel/HotelHousekeeping'));
const HotelMaintenance = lazy(() => import('@/pages/hotel/HotelMaintenance'));
const HotelEvents = lazy(() => import('@/pages/hotel/HotelEvents'));
const HotelServices = lazy(() => import('@/pages/hotel/HotelServices'));
const HotelSettings = lazy(() => import('@/pages/hotel/HotelSettings'));


function DailyReportSafe() {
  return (
    <ErrorBoundary>
      <DailyReportHub />
    </ErrorBoundary>
  );
}




function PageFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <Loader2 className="animate-spin text-[#FF7900]" size={28} />
    </div>
  );
}

function ConfigError() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-950 p-6">
      <div className="max-w-md w-full bg-stone-900 border border-red-500/40 rounded-2xl p-6 text-center">
        <h1 className="text-xl font-bold text-red-400 mb-3">Configuration manquante</h1>
        <p className="text-stone-300 text-sm mb-4">
          Les variables Supabase ne sont pas configurées sur Cloudflare Pages (rebuild avec VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).
        </p>
        <div className="text-left bg-stone-800 rounded-xl p-4 text-sm text-stone-300 space-y-2">
          <p>1. Va dans Cloudflare Pages → ton projet → <strong>Settings → Environment variables, puis rebuild</strong></p>
          <p>2. Ajoute :</p>
          <p className="font-mono text-xs text-amber-300">VITE_SUPABASE_URL</p>
          <p className="font-mono text-xs text-amber-300">VITE_SUPABASE_ANON_KEY</p>
          <p>3. Redeploie le site</p>
        </div>
      </div>
    </div>
  );
}

function DashboardSwitch() {
  const { activeEstablishment, member, effectiveRole } = useAuth();
  const role = String(effectiveRole || member?.role || '');
  // Super admin : tout le cockpit plateforme sur le tableau de bord (plus de section Administration)
  if (role === 'super_admin') return <SuperAdmin />;
  if (isLocationEvent(activeEstablishment?.type)) return <RentDashboard />;
  if (isBtp(activeEstablishment?.type)) return <BtpDashboard />;
  if (isHotelComplex(activeEstablishment?.type)) return <HotelDashboard />;
  return <Dashboard />;
}

function ProtectedRoutes() {
  const { user, member, loading, needsAccess } = useAuth();

  if (!isSupabaseConfigured) return <ConfigError />;

  // Si session locale déjà connue (user posé en synchrone), afficher l’app tout de suite.
  // Spinner discret uniquement s’il n’y a vraiment aucune session en mémoire.
  if (loading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5]">
        <Loader2 className="animate-spin text-[#FF7900]" size={28} />
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;

  try {
    const acct = (user as any)?.user_metadata?.account_type;
    if (acct === 'visitor' || acct === 'provider') return <Navigate to="/" replace />;
  } catch { /* */ }

  // needsAccess seulement si boot fini et vraiment pas de membre
  if (!loading && needsAccess && !member) return <PendingAccessPage />;

  return (
    <AppLayout>
      <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/dashboard" element={<DashboardSwitch />} />
        <Route path="/rent/equipment" element={<RentEquipment />} />
        <Route path="/rent/clients" element={<RentClients />} />
        <Route path="/rent/orders" element={<RentOrders />} />
        <Route path="/rent/movements" element={<RentMovements />} />
        <Route path="/rent/payments" element={<RentPayments />} />
        <Route path="/rent/calendar" element={<RentCalendar />} />
        <Route path="/rent/packs" element={<RentPacks />} />
        <Route path="/rent/invoices" element={<RentInvoices />} />
        <Route path="/btp/documents" element={<BtpDocuments />} />
        <Route path="/btp/clients" element={<BtpClients />} />
        <Route path="/btp/materials" element={<BtpMaterials />} />
        <Route path="/documents" element={<RedirectToReportTab tab="docs" />} />
        <Route path="/pos" element={<RedirectToReportTab tab="caisse" />} />
        <Route path="/caisse" element={<Navigate to="/pos" replace />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/menu-carte" element={<MenuCarte />} />
        <Route path="/reservations" element={<Reservations />} />
        <Route path="/kitchen" element={<PlanGate feature="kitchen" label="Cuisine / Grill"><Kitchen /></PlanGate>} />
        <Route path="/inventory" element={<Inventaire />} />
        <Route path="/public/depots" element={<PublicDepotsMap />} />
        <Route path="/depot/clients" element={<DepotClients />} />
        <Route path="/depot/deliveries" element={<DepotDeliveries />} />
        <Route path="/depot/tours" element={<DepotTours />} />
        <Route path="/depot/creances" element={<DepotCreances />} />
        <Route path="/depot/tracking" element={<DepotTracking />} />
        <Route path="/depot/consignes" element={<DepotConsignes />} />
        <Route path="/depot/prices" element={<DepotPrices />} />
        <Route path="/inventory/scan" element={<ScanInventaire />} />
        <Route path="/inventaire" element={<Navigate to="/inventory" replace />} />
        <Route path="/point-manuel" element={<PointManuel />} />
        <Route path="/guide" element={<GuidePage />} />
        <Route path="/subscription" element={<SubscriptionPage />} />
        <Route path="/kits" element={<KitsPromos />} />
        <Route path="/menu-qr" element={<PlanGate feature="qrOrdering" label="QR Code"><MenuQR /></PlanGate>} />
        <Route path="/stock-transfer" element={<StockTransfer />} />
        <Route path="/tables" element={<Tables />} />
        <Route path="/mes-employes" element={<MesEmployes />} />
        <Route path="/employees" element={<Navigate to="/mes-employes" replace />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/purchases" element={<Purchases />} />
        <Route path="/accounting" element={<Accounting />} />
        <Route path="/statistics" element={<PlanGate feature="advancedReports" label="Statistiques avancees"><Statistics /></PlanGate>} />
        <Route path="/reports" element={<Navigate to="/daily-report" replace />} />
        <Route path="/daily-report" element={<DailyReportSafe />} />
        <Route path="/live-sales" element={<LiveDaySales />} />
        <Route path="/mon-service" element={<MonService />} />
        <Route path="/print-qr" element={<PlanGate feature="qrOrdering" label="Imprimer QR tables"><PrintTableQR /></PlanGate>} />
        <Route path="/patron" element={<PatronMode />} />
        <Route path="/cloture" element={<RedirectToReportTab tab="cloture" />} />
        <Route path="/ai" element={<AIAssistant />} />
        <Route path="/ai-train" element={<PlanGate feature="ocrAi" label="Entrainement IA"><AITrain /></PlanGate>} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/suivi" element={<Navigate to="/mes-employes" replace />} />
        <Route path="/suivi-gerant" element={<Navigate to="/mes-employes" replace />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/sync-pending" element={<SyncPending />} />
        
        <Route path="/hotel" element={<HotelDashboard />} />
        <Route path="/hotel/rooms" element={<HotelRooms />} />
        <Route path="/hotel/reservations" element={<HotelReservations />} />
        <Route path="/hotel/guests" element={<HotelGuests />} />
        <Route path="/hotel/housekeeping" element={<HotelHousekeeping />} />
        <Route path="/hotel/maintenance" element={<HotelMaintenance />} />
        <Route path="/hotel/events" element={<HotelEvents />} />
        <Route path="/hotel/services" element={<HotelServices />} />
        <Route path="/hotel/settings" element={<HotelSettings />} />

        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/team" element={<Navigate to="/mes-employes" replace />} />
        <Route path="/admin" element={<SuperAdmin />} />
        {/* /admin conservé en alias ; menu Administration retiré */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      </Suspense>
    </AppLayout>
  );
}

function PublicOrApp() {
  // Login + commande table (QR) uniquement — menu public / annuaire désactivés.
  if (!isSupabaseConfigured) return <ConfigError />;

  return (
    <Routes>
      <Route path="/" element={<AuthPage />} />
      <Route path="/login" element={<AuthPage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/commander/:estId" element={<PublicTableOrder />} />
      <Route path="/order/:estId" element={<PublicTableOrder />} />
      <Route path="/accueil" element={<Navigate to="/login" replace />} />
      <Route path="/discover" element={<Navigate to="/login" replace />} />
      <Route path="/establishments" element={<Navigate to="/login" replace />} />
      <Route path="/restaurants" element={<Navigate to="/login" replace />} />
      <Route path="/maquis" element={<Navigate to="/login" replace />} />
      <Route path="/bars" element={<Navigate to="/login" replace />} />
      <Route path="/events" element={<Navigate to="/login" replace />} />
      <Route path="/services" element={<Navigate to="/login" replace />} />
      <Route path="/favorites" element={<Navigate to="/login" replace />} />
      <Route path="/m/:estId" element={<Navigate to="/login" replace />} />
      <Route path="/e/:slugOrId" element={<Navigate to="/login" replace />} />
      <Route path="/establishment/:slugOrId" element={<Navigate to="/login" replace />} />
      <Route path="/*" element={<ProtectedRoutes />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
          <PublicOrApp />
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
}
