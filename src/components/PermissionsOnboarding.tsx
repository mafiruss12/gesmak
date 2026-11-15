import { useEffect, useState } from 'react';
import {
  Bell,
  Camera,
  MapPin,
  HardDrive,
  Image,
  Mic,
  Shield,
  Loader2,
  CheckCircle2,
  XCircle,
  Settings,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import {
  hasCompletedPermissionsOnboarding,
  markPermissionsOnboardingDone,
  requestAllDevicePermissions,
  requestMicrophone,
  openAppSettings,
  type PermissionResult,
} from '@/lib/devicePermissions';

const ITEMS = [
  {
    id: 'notifications',
    icon: Bell,
    title: 'Notifications',
    desc: 'Rappels de point, messages, alertes stock',
  },
  {
    id: 'microphone',
    icon: Mic,
    title: 'Microphone',
    desc: 'Dictée des quantités, rapport vocal, mode patron',
  },
  {
    id: 'camera',
    icon: Camera,
    title: 'Appareil photo',
    desc: 'Photos produits, scan inventaire',
  },
  {
    id: 'location',
    icon: MapPin,
    title: 'Localisation',
    desc: 'Clients, livraisons et suivi terrain',
  },
  {
    id: 'gallery',
    icon: Image,
    title: 'Galerie',
    desc: 'Importer des images (demandé à l’usage)',
  },
  {
    id: 'storage',
    icon: HardDrive,
    title: 'Stockage',
    desc: 'Mode hors ligne plus fiable',
  },
] as const;

export default function PermissionsOnboarding() {
  // Désactivé : l'utilisateur ne veut plus voir ce message automatiquement
  const DISABLED_BY_USER = true;
  if (DISABLED_BY_USER) return null;

  const { member } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [openingSettings, setOpeningSettings] = useState(false);
  const [results, setResults] = useState<PermissionResult[] | null>(null);
  const [settingsMsg, setSettingsMsg] = useState('');

  useEffect(() => {
    if (!member) {
      setOpen(false);
      return;
    }
    if (!hasCompletedPermissionsOnboarding()) {
      setOpen(true);
    }
  }, [member]);

  useEffect(() => {
    function onForce() {
      setResults(null);
      setSettingsMsg('');
      setOpen(true);
    }
    window.addEventListener('mm-request-permissions', onForce);
    return () => window.removeEventListener('mm-request-permissions', onForce);
  }, []);

  if (!member || !open) return null;

  async function allowMicOnly() {
    setLoading(true);
    setResults(null);
    try {
      const r = await requestMicrophone();
      setResults([r]);
      if (r.ok) markPermissionsOnboardingDone();
    } finally {
      setLoading(false);
    }
  }

  async function allowAll() {
    setLoading(true);
    setResults(null);
    try {
      const res = await requestAllDevicePermissions();
      setResults(res);
      markPermissionsOnboardingDone();
      // Si au moins un refus → proposer les paramètres système
      if (res.some((r) => !r.ok)) {
        setSettingsMsg(
          'Certaines autorisations sont refusées. Ouvrez les paramètres du téléphone pour les activer.'
        );
      }
    } finally {
      setLoading(false);
    }
  }

  async function goToSettings() {
    setOpeningSettings(true);
    setSettingsMsg('');
    try {
      const r = await openAppSettings();
      setSettingsMsg(r.detail);
      markPermissionsOnboardingDone();
    } finally {
      setOpeningSettings(false);
    }
  }

  function skip() {
    markPermissionsOnboardingDone();
    setOpen(false);
  }

  function close() {
    markPermissionsOnboardingDone();
    setOpen(false);
  }

  return (
    <div className="fixed inset-0 z-[90] bg-stone-950/90 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-stone-700 bg-stone-900 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500/15">
              <Shield className="text-amber-400" size={22} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-stone-100">Autoriser l’accès à l’appareil</h2>
              <p className="text-sm text-stone-400 mt-1">
                Sur téléphone (APK Stock AI), activez Micro / Caméra / Position dans Réglages → Applications. Sur Chrome, autorisez ici, ou ouvrez les <strong className="text-stone-200">paramètres</strong> de
                votre téléphone. Le micro est demandé en premier pour la dictée et le mode vocal.
              </p>
            </div>
          </div>

          <ul className="space-y-2">
            {ITEMS.map((item) => {
              const Icon = item.icon;
              const r = results?.find(
                (x) => x.id === item.id || (item.id === 'gallery' && x.id === 'camera')
              );
              return (
                <li
                  key={item.id}
                  className="flex gap-3 rounded-xl border border-stone-800 bg-stone-950/50 px-3 py-2.5"
                >
                  <Icon className="text-stone-400 shrink-0 mt-0.5" size={18} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-200">{item.title}</p>
                    <p className="text-xs text-stone-500">{item.desc}</p>
                    {r && (
                      <p
                        className={`text-xs mt-1 flex items-center gap-1 ${
                          r.ok ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {r.ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        {r.detail}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {settingsMsg && (
            <p className="text-xs text-amber-200/90 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
              {settingsMsg}
            </p>
          )}

          <div className="flex flex-col gap-2 pt-1">
            {/* Bouton principal demandé : redirection paramètres */}
            <button
              type="button"
              className="btn-primary min-h-[52px] flex items-center justify-center gap-2 text-base"
              disabled={openingSettings}
              onClick={() => void goToSettings()}
            >
              {openingSettings ? (
                <>
                  <Loader2 className="animate-spin" size={18} /> Ouverture…
                </>
              ) : (
                <>
                  <Settings size={20} /> Ouvrir les paramètres du téléphone
                  <ExternalLink size={16} />
                </>
              )}
            </button>

            <button
              type="button"
              className="btn-secondary min-h-[48px] flex items-center justify-center gap-2"
              disabled={loading}
              onClick={() => void allowAll()}
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={18} /> Demandes en cours…
                </>
              ) : (
                'Demander dans l’application'
              )}
            </button>
              <button
                type="button"
                className="btn-secondary w-full mt-2"
                disabled={loading}
                onClick={() => void allowMicOnly()}
              >
                Autoriser le micro seulement
              </button>

            {results && (
              <button type="button" className="btn-secondary min-h-[44px]" onClick={close}>
                Continuer dans l’app
              </button>
            )}
            {!results && (
              <button type="button" className="btn-ghost text-stone-500 text-sm" onClick={skip}>
                Plus tard
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
