import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell, ClipboardList } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import {
  buildOwnerReminderMessage,
  formatDateFr,
  getMissingReportDates,
  getReportStaff,
  todayISO,
  type ReportStaff,
} from '@/lib/dailyReportGate';
import { supabase } from '@/lib/supabase';

const OWNER_DISMISS_KEY = (estId: string, day: string) => `mm_owner_report_banner_${estId}_${day}`;

function isAfterReportHour(): boolean {
  try { return new Date().getHours() >= 22; } catch { return false; }
}


const OWNER_ROLES = ['owner', 'admin', 'super_admin'];

/**
 * Rappels pour le propriétaire : point du jour manquant + jours sans rapport + équipe concernée.
 */
export default function OwnerReportReminder() {
  const { member, activeEstablishment, effectiveRole } = useAuth();
  const location = useLocation();
  const [missingDates, setMissingDates] = useState<string[]>([]);
  const [staff, setStaff] = useState<ReportStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  const role = String(effectiveRole || member?.role || '');
  const isOwnerView = OWNER_ROLES.includes(role);
  const estId = activeEstablishment?.id || member?.establishment_id || null;
  const today = todayISO();

  useEffect(() => {
    if (!estId) return;
    if (!isAfterReportHour()) { setDismissed(true); return; }
    try {
      if (localStorage.getItem(OWNER_DISMISS_KEY(estId, today)) === '1') setDismissed(true);
    } catch { /* */ }
  }, [estId, today]);

  const todayMissing = missingDates.includes(today);
  const pastMissing = missingDates.filter((d) => d !== today);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!isOwnerView || !estId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const [missing, team] = await Promise.all([
        getMissingReportDates(estId, 14),
        getReportStaff(estId),
      ]);
      if (cancelled) return;
      setMissingDates(missing);
      setStaff(team);
      setLoading(false);

      // Notification propriétaire 1× / jour si point du jour manquant
      if (missing.includes(today) && member?.user_id) {
        const key = `mm_owner_report_nudge_${estId}_${today}`;
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, '1');
          const msg = buildOwnerReminderMessage({
            establishmentName: activeEstablishment?.name || 'Établissement',
            missingDates: missing,
            staff: team,
            todayDone: false,
          });
          await supabase.from('notifications').insert({
            user_id: member.user_id,
            title: msg.title,
            body: msg.body.replace(/\\n/g, '\n'),
            message: msg.body.replace(/\\n/g, '\n'),
            type: 'owner_report_reminder',
            link: '/daily-report',
            read: false,
            action_label: 'Voir les rapports',
          });
        }
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [isOwnerView, estId, member?.user_id, activeEstablishment?.name, location.pathname, today]);

  if (!isOwnerView || loading || dismissed || !isAfterReportHour()) return null;
  if (missingDates.length === 0) return null;
  if (location.pathname.startsWith('/daily-report')) return null;

  const staffNames =
    staff.length > 0
      ? staff.map((s) => s.full_name || s.email || s.role).join(', ')
      : 'Aucun employé / gérant / caissier actif';

  return (
    <div className="mx-3 mt-2 sm:mx-4 rounded-xl border border-sky-500/40 bg-sky-500/10 px-3 py-3 text-sm text-sky-50 space-y-2">
      <div className="flex items-start gap-2">
        <Bell className="text-sky-300 shrink-0 mt-0.5" size={18} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sky-100 flex items-center gap-2">
            <ClipboardList size={16} /> Rappels rapports — votre établissement
          </p>
          {todayMissing ? (
            <p className="mt-1 text-sky-100/90">
              Le <strong>point d&apos;aujourd&apos;hui</strong> n&apos;a pas encore été fait.
            </p>
          ) : (
            <p className="mt-1 text-sky-100/90">Des jours précédents n&apos;ont pas de point.</p>
          )}
          <p className="text-xs text-sky-200/80 mt-1">
            Équipe concernée (doit faire le point) : <span className="text-sky-100">{staffNames}</span>
          </p>
          {pastMissing.length > 0 && (
            <p className="text-xs text-sky-200/80 mt-1">
              Jours sans point : {pastMissing.map(formatDateFr).join(' · ')}
              {todayMissing ? ' · + aujourd&apos;hui' : ''}
            </p>
          )}
          {todayMissing && pastMissing.length === 0 && (
            <p className="text-xs text-sky-200/80 mt-1">Seul aujourd&apos;hui est en attente.</p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <Link
          to="/daily-report"
          className="inline-flex px-3 py-1.5 rounded-lg bg-sky-500 text-stone-900 text-xs font-semibold"
        >
          Voir / faire le point
        </Link>
        <Link to="/suivi" className="inline-flex px-3 py-1.5 rounded-lg border border-sky-500/40 text-xs text-sky-100">
          Suivi gérant
        </Link>
        <button
          type="button"
          className="text-xs text-sky-200/70 underline ml-auto"
          onClick={() => {
            try { if (estId) localStorage.setItem(OWNER_DISMISS_KEY(estId, today), '1'); } catch { /* */ }
            setDismissed(true);
          }}
        >
          Masquer pour cette session
        </button>
      </div>
    </div>
  );
}
