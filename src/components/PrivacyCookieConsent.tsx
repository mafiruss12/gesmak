import { useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Cookie, ShieldCheck } from 'lucide-react';

export const PRIVACY_CONSENT_KEY = 'gesmak_privacy_cookies_v1';

export interface PrivacyConsentRecord {
  accepted: boolean;
  essential: true;
  preferences: boolean;
  acceptedAt: string;
}

export function getStoredPrivacyConsent(): PrivacyConsentRecord | null {
  try {
    const raw = localStorage.getItem(PRIVACY_CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PrivacyConsentRecord>;
    if (parsed && parsed.accepted && typeof parsed.acceptedAt === 'string') {
      return {
        accepted: true,
        essential: true,
        preferences: Boolean(parsed.preferences),
        acceptedAt: parsed.acceptedAt,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function savePrivacyConsent(preferences: boolean): PrivacyConsentRecord {
  const rec: PrivacyConsentRecord = {
    accepted: true,
    essential: true,
    preferences,
    acceptedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(PRIVACY_CONSENT_KEY, JSON.stringify(rec));
  } catch {
    /* ignore storage errors */
  }
  return rec;
}

interface Props {
  forceOpen?: boolean;
  onClose?: () => void;
}

export default function PrivacyCookieConsent({ forceOpen = false, onClose }: Props) {
  const [consent, setConsent] = useState<PrivacyConsentRecord | null>(() => getStoredPrivacyConsent());
  const [open, setOpen] = useState<boolean>(() => forceOpen || !getStoredPrivacyConsent());
  const [prefCookies, setPrefCookies] = useState<boolean>(() => getStoredPrivacyConsent()?.preferences ?? true);
  const [checkedPolicy, setCheckedPolicy] = useState<boolean>(() => Boolean(getStoredPrivacyConsent()));
  const [showDetails, setShowDetails] = useState<boolean>(forceOpen);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (forceOpen) {
      setOpen(true);
      setShowDetails(true);
      const current = getStoredPrivacyConsent();
      if (current) {
        setConsent(current);
        setPrefCookies(current.preferences);
        setCheckedPolicy(true);
      }
    }
  }, [forceOpen]);

  useEffect(() => {
    const handler = () => {
      const current = getStoredPrivacyConsent();
      setConsent(current);
      setPrefCookies(current?.preferences ?? true);
      setCheckedPolicy(Boolean(current));
      setShowDetails(true);
      setOpen(true);
    };
    window.addEventListener('gesmak-open-privacy', handler);
    return () => window.removeEventListener('gesmak-open-privacy', handler);
  }, []);

  if (!open) return null;

  const alreadyAccepted = Boolean(consent?.accepted);

  const accept = (withPrefs: boolean) => {
    if (!checkedPolicy) {
      setErr('Veuillez cocher la case pour confirmer avoir pris connaissance de la politique de confidentialité.');
      return;
    }
    setErr(null);
    const saved = savePrivacyConsent(withPrefs);
    setConsent(saved);
    setOpen(false);
    onClose?.();
  };

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gesmak-privacy-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-amber-500/40 bg-stone-900 text-stone-100 shadow-2xl p-5 space-y-4 my-auto">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400">
            <ShieldCheck size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 id="gesmak-privacy-title" className="text-base sm:text-lg font-bold text-stone-100">
              Politique de confidentialité &amp; Cookies
            </h2>
            <p className="text-xs text-stone-400 mt-0.5">
              GESMAK — Kevin Tech Pro (Akoh Ago Armand Kevin · 0502012011 / 0711163661)
            </p>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
          Pour garantir le bon fonctionnement de votre gestion commerciale (connexion sécurisée, sauvegarde hors-ligne,
          alertes commandes et choix de l&apos;établissement actif), GESMAK utilise des cookies techniques et le stockage local.
        </p>

        <div className="rounded-xl border border-stone-800 bg-stone-950/70 p-3 space-y-2.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Cookie size={15} className="text-amber-400 shrink-0" />
              <div>
                <p className="font-semibold text-stone-200">Cookies &amp; stockage essentiels</p>
                <p className="text-stone-500">Session, sécurité, panier, file de synchronisation hors-ligne.</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-semibold text-[11px] shrink-0">
              Toujours actif
            </span>
          </div>

          <label className="flex items-center justify-between gap-2 pt-2 border-t border-stone-800 cursor-pointer">
            <div>
              <p className="font-semibold text-stone-200">Cookies de préférences &amp; confort</p>
              <p className="text-stone-500">Thème jour/nuit, établissement actif mémorisé, sonnerie commandes.</p>
            </div>
            <input
              type="checkbox"
              checked={prefCookies}
              onChange={(e) => setPrefCookies(e.target.checked)}
              className="h-4 w-4 accent-amber-500 rounded"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          className="text-xs font-semibold text-amber-400 hover:underline flex items-center gap-1"
        >
          {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {showDetails ? 'Masquer la politique détaillée' : 'Lire la politique de confidentialité complète'}
        </button>

        {showDetails && (
          <div className="max-h-48 overflow-y-auto rounded-xl border border-stone-800 bg-stone-950/80 p-3 text-xs text-stone-300 space-y-2 leading-relaxed">
            <p>
              <strong>1. Responsable du traitement :</strong> Application GESMAK éditée par{' '}
              <strong>Kevin Tech Pro</strong> (fondateur : <strong>Akoh Ago Armand Kevin</strong>, contacts :{' '}
              <strong>0502012011 / 0711163661</strong>).
            </p>
            <p>
              <strong>2. Données traitées :</strong> Nom complet, identifiant/e-mail, rôle, informations de
              l&apos;établissement (nom, logo, téléphone, e-mail propriétaire, adresse et position GPS volontaire),
              ventes, stocks, dépenses, rapports journaliers et écritures financières.
            </p>
            <p>
              <strong>3. Finalité &amp; sécurité :</strong> Les données servent uniquement à l&apos;exploitation de
              votre établissement et à l&apos;assistance technique. Aucune donnée n&apos;est vendue à des tiers.
              Les échanges sont chiffrés via HTTPS et isolés par établissement.
            </p>
            <p>
              <strong>4. Vos droits :</strong> Vous pouvez modifier vos informations d&apos;établissement, retirer le
              logo ou arrêter le partage GPS à tout moment depuis <em>Paramètres</em>, ou demander la suppression de
              votre compte auprès de Kevin Tech Pro.
            </p>
          </div>
        )}

        <label className="flex items-start gap-2.5 text-xs text-stone-200 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={checkedPolicy}
            onChange={(e) => {
              setCheckedPolicy(e.target.checked);
              if (e.target.checked) setErr(null);
            }}
            className="mt-0.5 h-4 w-4 accent-amber-500 rounded shrink-0"
          />
          <span>
            J&apos;ai lu et j&apos;accepte la <strong>Politique de confidentialité</strong> et l&apos;utilisation des{' '}
            <strong>cookies / stockage local</strong> de GESMAK.
          </span>
        </label>

        {alreadyAccepted && consent?.acceptedAt && (
          <p className="text-[11px] text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 size={14} />
            Acceptée le {new Date(consent.acceptedAt).toLocaleDateString('fr-FR')}
          </p>
        )}

        {err && <p className="text-xs text-red-400 font-medium">{err}</p>}

        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <button
            type="button"
            onClick={() => accept(false)}
            className="btn-secondary flex-1 text-xs py-2.5"
          >
            Essentiel uniquement
          </button>
          <button
            type="button"
            onClick={() => accept(prefCookies)}
            className="btn-primary flex-1 text-xs py-2.5 font-bold"
          >
            Accepter et continuer
          </button>
          {alreadyAccepted && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onClose?.();
              }}
              className="btn-ghost text-xs py-2.5"
            >
              Fermer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
