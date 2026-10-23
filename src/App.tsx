import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/auth';
import AuthCallback from '@/pages/AuthCallback';
import AuthPage from '@/pages/AuthPage';
import PublicHome from '@/pages/PublicHome';
import PublicEstablishments from '@/pages/public/PublicEstablishments';
import PublicEvents from '@/pages/public/PublicEvents';
import PublicServices from '@/pages/public/PublicServices';
import PublicFavorites from '@/pages/public/PublicFavorites';
import PublicDiscover from '@/pages/public/PublicDiscover';
import PublicEstablishmentProfile from '@/pages/public/PublicEstablishmentProfile';
import PublicCategory from '@/pages/public/PublicCategory';
import PendingAccessPage from '@/pages/PendingAccessPage';
import Dashboard from '@/pages/Dashboard';
import Documents from '@/pages/Documents';
import Caisse from '@/pages/Caisse';
import Inventaire from '@/pages/Inventaire';
import ScanInventaire from '@/pages/ScanInventaire';
import DepotClients from '@/pages/DepotClients';
import DepotDeliveries from '@/pages/DepotDeliveries';
import DepotTours from '@/pages/depot/DepotTours';
import DepotCreances from '@/pages/depot/DepotCreances';
import DepotTracking from '@/pages/depot/DepotTracking';
import DepotConsignes from '@/pages/depot/DepotConsignes';
import DepotPrices from '@/pages/depot/DepotPrices';
import PublicDepotsMap from '@/pages/public/PublicDepotsMap';
import LiveDaySales from '@/pages/LiveDaySales';
import MonService from '@/pages/MonService';
import PrintTableQR from '@/pages/PrintTableQR';
import PatronMode from '@/pages/PatronMode';
import AITrain from '@/pages/AITrain';
import DailyReportPage from '@/pages/DailyReport';
import DailyReportHub, { RedirectToReportTab } from '@/pages/DailyReportHub';

function DailyReportSafe() {
  return (
    <ErrorBoundary>
      <DailyReportHub />
    </ErrorBoundary>
  );
}

import ClotureZPage from '@/pages/ClotureZ';
import SuperAdmin from '@/pages/SuperAdmin';
import Employees from '@/pages/Employees';
import Expenses from '@/pages/Expenses';
import Suppliers from '@/pages/Suppliers';
import Purchases from '@/pages/Purchases';
import Customers from '@/pages/Customers';
import Tables from '@/pages/Tables';
import MenuCarte from '@/pages/restaurant/MenuCarte';
import Reservations from '@/pages/restaurant/Reservations';
import Orders from '@/pages/Orders';
import Kitchen from '@/pages/Kitchen';
import PlanGate from '@/components/PlanGate';
import Accounting from '@/pages/Accounting';
import Statistics from '@/pages/Statistics';
import Reports from '@/pages/Reports';
import Notifications from '@/pages/Notifications';
import SettingsPage from '@/pages/Settings';
import SyncPending from '@/pages/SyncPending';
import AIAssistant from '@/pages/AIAssistant';
import CalendarPage from '@/pages/CalendarPage';
import ChatPage from '@/pages/Chat';
import SuiviGerant from '@/pages/SuiviGerant';
import TeamPage from '@/pages/Team';
import MesEmployes from '@/pages/MesEmployes';
import PointManuel from '@/pages/PointManuel';
import GuidePage from '@/pages/Guide';
import SubscriptionPage from '@/pages/Subscription';
import KitsPromos from '@/pages/KitsPromos';
import MenuQR from '@/pages/MenuQR';
import PublicMenu from '@/pages/PublicMenu';
import PublicTableOrder from '@/pages/public/PublicTableOrder';
import StockTransfer from '@/pages/StockTransfer';
import RentDashboard from '@/pages/rent/Dashboard';
import RentEquipment from '@/pages/rent/Equipment';
import RentClients from '@/pages/rent/Clients';
import RentOrders from '@/pages/rent/Orders';
import RentMovements from '@/pages/rent/Movements';
import RentPayments from '@/pages/rent/Payments';
import RentCalendar from '@/pages/rent/Calendar';
import RentPacks from '@/pages/rent/Packs';
import RentInvoices from '@/pages/rent/Invoices';
import { isLocationEvent, isBtp } from '@/lib/businessTypes';
import { isHotelComplex } from '@/lib/hotel';
import BtpDashboard from '@/pages/btp/Dashboard';
import BtpDocuments from '@/pages/btp/Documents';
import BtpClients from '@/pages/btp/Clients';
import BtpMaterials from '@/pages/btp/Materials';
import HotelDashboard from '@/pages/hotel/HotelDashboard';
import HotelRooms from '@/pages/hotel/HotelRooms';
import HotelReservations from '@/pages/hotel/HotelReservations';
import HotelGuests from '@/pages/hotel/HotelGuests';
import HotelHousekeeping from '@/pages/hotel/HotelHousekeeping';
import HotelMaintenance from '@/pages/hotel/HotelMaintenance';
import HotelEvents from '@/pages/hotel/HotelEvents';
import HotelServices from '@/pages/hotel/HotelServices';
import HotelSettings from '@/pages/hotel/HotelSettings';

import AppLayout from '@/components/AppLayout';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Loader2 } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

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
