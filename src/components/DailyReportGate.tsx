import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AlertTriangle, ClipboardList, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import {
  buildReminderMessage,
  formatDateFr,
  freeWhatsAppLink,
  getMissingReportDates,
  isReportRequiredRole,
  todayISO,
} from '@/lib/dailyReportGate';
import { supabase } from '@/lib/supabase';

const DISMISS_KEY = (estId: string, day: string) => `mm_report_banner_dismiss_${estId}_${day}`;

/** Visible uniquement à partir de 22h00 (heure locale) */
function isAfterReportHour(): boolean {
  try {
    return new Date().getHours() >= 22;
  } catch {
    return false;
  }
}

function wasDismissedToday(estId: string, day: string): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY(estId, day)) === '1';
  } catch {
    return false;
  }
}

function dismissToday(estId: string, day: string) {
  try {
    localStorage.setItem(DISMISS_KEY(estId, day), '1');
  } catch {
    /* */
  }
}

/**
 * Rappel rapport journalier :
 * - seulement à partir de 22h
 * - une seule fois par jour (fermeture = disparition jusqu'au lendemain 22h)
 * - ne s'affiche pas à chaque entrée / sortie de l'app
 */
export default function DailyReportGate() {
  const { member, activeEstablishment, effectiveRole } = useAuth();
  const location = useLocation();
  const [missingDates, setMissingDates] = useState<string[]>([]);
  const [checking, setChecking] = useState(true);
  const [visible, setVisible] = useState(false);

  const role = String(effectiveRole || member?.role || '');
  const estId = activeEstablishment?.id || member?.establishment_id || null;
  const required = isReportRequiredRole(role);
  const today = todayISO();
  const todayMissing = missingDates.includes(today);
  const pastMissing = missingDates.filter((d) => d !== today);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!required || !estId) {
        setMissingDates([]);
        setChecking(false);
        setVisible(false);
        return;
      }
      if (!isAfterReportHour()) {
        setChecking(false);
        setVisible(false);
        return;
      }
      if (wasDismissedToday(estId, today)) {
        setChecking(false);
        setVisible(false);
        return;
      }

      setChecking(true);
      const missing = await getMissingReportDates(estId, 14);
      if (cancelled) return;
      setMissingDates(missing);
      setChecking(false);
      const show = missing.length > 0;
      setVisible(show);

      if (show && member?.user_id) {
        const key = `mm_report_nudge_${estId}_${today}`;
        if (!localStorage.getItem(key)) {
          localStorage.setItem(key, '1');
          const msg = buildReminderMessage({
            establishmentName: activeEstablishment?.name || 'Établissement',
            staffName: member.full_name || 'Équipe',
            date: today,
            missingDates: missing,
          });
          try {
            await supabase.from('notifications').insert({
              user_id: member.user_id,
              title: msg.title,
              body: msg.body,
              message: msg.body,
              type: 'report_reminder',
              link: '/daily-report',
              read: false,
              action_label: 'Terminer la journée',
            });
          } catch {
            /* */
          }
        }
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [required, estId, member?.user_id, activeEstablishment?.name, location.pathname, today]);

  function handleDismiss() {
    if (estId) dismissToday(estId, today);
    setVisible(false);
  }

  if (checking || !required || !visible || missingDates.length === 0) return null;
  if (location.pathname.startsWith('/daily-report')) return null;

  const msg = buildReminderMessage({
    establishmentName: activeEstablishment?.name || 'Établissement',
    staffName: member?.full_name || 'Équipe',
    date: today,
    missingDates,
  });

  const ownerPhone =
    (activeEstablishment as { phone?: string } | null)?.phone ||
    (member as { phone?: string } | null)?.phone ||
    '';

  return (
    <div className="mx-3 mt-2 sm:mx-4 rounded-xl border border-amber-500/50 bg-amber-500/10 px-3 py-3 text-sm text-amber-50 space-y-2 relative">
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 rounded-lg text-amber-200/80 hover:bg-amber-500/20"
        aria-label="Fermer"
        title="Ne plus afficher aujourd’hui"
      >
        <X size={16} />
      </button>
      <div className="flex items-start gap-2 pr-6">
        <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={18} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-amber-100 flex items-center gap-2">
            <ClipboardList size={16} /> Clôture de journée (après 22h)
          </p>
          {todayMissing ? (
            <p className="text-amber-100/90 mt-1">
              La journée n&apos;est pas encore clôturée ({formatDateFr(today)}).
              Rappel affiché une seule fois par jour à partir de 22h.
            </p>
          ) : (
            <p className="text-amber-100/90 mt-1">Des jours précédents n&apos;ont pas de rapport.</p>
          )}
          {pastMissing.length > 0 && (
            <p className="text-xs text-amber-200/80 mt-1">
              Jours manquants : {pastMissing.map(formatDateFr).join(' · ')}
              {todayMissing ? " · + aujourd'hui" : ''}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          to="/daily-report?tab=terminer"
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 text-stone-900 text-xs font-semibold"
          onClick={handleDismiss}
        >
          Terminer la journée
        </Link>
        {ownerPhone ? (
          <a
            href={freeWhatsAppLink(ownerPhone, msg.waText)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex px-3 py-1.5 rounded-lg border border-amber-500/40 text-xs text-amber-100"
          >
            WhatsApp
          </a>
        ) : null}
        <button
          type="button"
          onClick={handleDismiss}
          className="inline-flex px-3 py-1.5 rounded-lg border border-amber-500/40 text-xs text-amber-100"
        >
          Plus tard (1× / jour)
        </button>
      </div>
    </div>
  );
}
