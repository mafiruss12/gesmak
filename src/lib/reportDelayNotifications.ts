import { supabase } from '@/lib/supabase';
import {
  formatDateFr,
  getMissingReportDates,
  getReportStaff,
  todayISO,
} from '@/lib/dailyReportGate';

function onceKey(key: string): boolean {
  try {
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, '1');
    return true;
  } catch {
    return true;
  }
}

async function insertNotif(opts: {
  userId: string;
  title: string;
  body: string;
  type: string;
  link?: string;
}) {
  await supabase.from('notifications').insert({
    user_id: opts.userId,
    title: opts.title,
    body: opts.body,
    message: opts.body,
    type: opts.type,
    link: opts.link || '/daily-report',
    read: false,
    action_label: 'Voir',
  });
}

/** Notifications retards pour un membre staff (employé / gérant / caissier) */
export async function notifyStaffReportDelays(opts: {
  userId: string;
  establishmentId: string;
  establishmentName: string;
  staffName: string;
}): Promise<void> {
  const missing = await getMissingReportDates(opts.establishmentId, 14);
  if (missing.length === 0) return;
  const today = todayISO();
  const key = `mm_delay_staff_${opts.establishmentId}_${opts.userId}_${today}`;
  if (!onceKey(key)) return;

  const past = missing.filter((d) => d !== today);
  const todayLate = missing.includes(today);
  const title = todayLate
    ? 'Retard — point du jour non fait'
    : `Retard — ${past.length} jour(s) sans point`;
  const body = [
    `Bonjour ${opts.staffName},`,
    todayLate
      ? `Le point d'aujourd'hui (${formatDateFr(today)}) pour « ${opts.establishmentName} » n'est pas encore enregistré.`
      : `Des points manquent pour « ${opts.establishmentName} ».`,
    past.length
      ? `Jours en retard : ${past.map(formatDateFr).join(', ')}.`
      : '',
    'Merci de régulariser dès que possible.',
  ]
    .filter(Boolean)
    .join('\n');

  await insertNotif({
    userId: opts.userId,
    title,
    body,
    type: 'report_delay',
    link: '/daily-report',
  });
}

/** Notifications retards pour le propriétaire */
export async function notifyOwnerReportDelays(opts: {
  ownerUserId: string;
  establishmentId: string;
  establishmentName: string;
}): Promise<void> {
  const [missing, staff] = await Promise.all([
    getMissingReportDates(opts.establishmentId, 14),
    getReportStaff(opts.establishmentId),
  ]);
  if (missing.length === 0) return;
  const today = todayISO();
  const key = `mm_delay_owner_${opts.establishmentId}_${opts.ownerUserId}_${today}`;
  if (!onceKey(key)) return;

  const todayLate = missing.includes(today);
  const past = missing.filter((d) => d !== today);
  const staffNames =
    staff.length > 0
      ? staff.map((s) => s.full_name || s.email || s.role).join(', ')
      : 'aucun employé actif';

  const title = todayLate
    ? `Retard équipe — point du jour manquant`
    : `Retards rapports — ${past.length} jour(s)`;

  const body = [
    `Établissement : ${opts.establishmentName}`,
    todayLate ? `⚠ Point d'aujourd'hui NON fait.` : `Point d'aujourd'hui OK.`,
    past.length ? `Jours sans point : ${past.map(formatDateFr).join(', ')}.` : '',
    `Équipe concernée : ${staffNames}.`,
  ]
    .filter(Boolean)
    .join('\n');

  await insertNotif({
    userId: opts.ownerUserId,
    title,
    body,
    type: 'report_delay_owner',
    link: '/dashboard',
  });
}
