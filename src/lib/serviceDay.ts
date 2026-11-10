/**
 * Service du jour (MVP) :
 * - Fermé par défaut
 * - Ouvrir la caisse → ventes + QR actifs
 * - Clôturer → tout coupé
 */
import { supabase } from '@/lib/supabase';
import { openDay, markClosed, loadLiveDay, saveLiveDay } from '@/lib/liveDaySales';

export type ServiceStatus = 'open' | 'closed';

export type ServiceSnapshot = {
  status: ServiceStatus;
  opened_at?: string | null;
  closed_at?: string | null;
  source: 'cash_sessions' | 'local' | 'none';
};

const EVENT = 'gesmak-service-day';

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function localKey(estId: string, date: string) {
  return `mm_service_day:${estId}:${date}`;
}

export function readLocalService(estId: string, date = todayISO()): ServiceSnapshot {
  try {
    const raw = localStorage.getItem(localKey(estId, date));
    if (raw) {
      const p = JSON.parse(raw) as ServiceSnapshot;
      if (p?.status === 'open' || p?.status === 'closed') {
        return { ...p, source: 'local' };
      }
    }
  } catch {
    /* */
  }
  // Compat: live day opened without closed_at after explicit open
  try {
    const live = loadLiveDay(estId, date);
    if (live.closed_at) {
      return { status: 'closed', closed_at: live.closed_at, source: 'local' };
    }
    // opened flag stored in activity
    const opened = (live.activity || []).some((a) => a.type === 'open');
    if (opened) {
      return { status: 'open', opened_at: live.activity?.find((a) => a.type === 'open')?.at, source: 'local' };
    }
  } catch {
    /* */
  }
  return { status: 'closed', source: 'none' };
}

export function writeLocalService(estId: string, snap: ServiceSnapshot, date = todayISO()) {
  try {
    localStorage.setItem(localKey(estId, date), JSON.stringify({ ...snap, source: 'local' }));
  } catch {
    /* */
  }
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent(EVENT, { detail: { establishment_id: estId, date, ...snap } }),
      );
    } catch {
      /* */
    }
  }
}

export function isServiceOpenLocal(estId: string, date = todayISO()): boolean {
  return readLocalService(estId, date).status === 'open';
}

/** Lecture serveur (QR / multi-appareils) + fallback local */
export async function fetchServiceStatus(estId: string, date = todayISO()): Promise<ServiceSnapshot> {
  try {
    const { data, error } = await supabase
      .from('cash_sessions')
      .select('id, status, opened_at, closed_at')
      .eq('establishment_id', estId)
      .eq('session_date', date)
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error && data) {
      const status: ServiceStatus = data.status === 'open' ? 'open' : 'closed';
      const snap: ServiceSnapshot = {
        status,
        opened_at: data.opened_at,
        closed_at: data.closed_at,
        source: 'cash_sessions',
      };
      writeLocalService(estId, snap, date);
      return snap;
    }
  } catch {
    /* */
  }
  return readLocalService(estId, date);
}

export async function openService(opts: {
  estId: string;
  userId?: string | null;
  by?: string;
  date?: string;
}): Promise<{ ok: boolean; error?: string; snap: ServiceSnapshot }> {
  const date = opts.date || todayISO();
  const opened_at = new Date().toISOString();

  // Local live day
  openDay(opts.estId, date, opts.by);

  let remoteOk = false;
  try {
    // close any stale open rows first (best effort)
    await supabase
      .from('cash_sessions')
      .update({ status: 'closed', closed_at: opened_at })
      .eq('establishment_id', opts.estId)
      .eq('session_date', date)
      .eq('status', 'open');

    const { error } = await supabase.from('cash_sessions').insert({
      establishment_id: opts.estId,
      session_date: date,
      status: 'open',
      opened_at,
      opened_by: opts.userId || null,
      opening_float: 0,
    });
    remoteOk = !error;
  } catch {
    remoteOk = false;
  }

  const snap: ServiceSnapshot = {
    status: 'open',
    opened_at,
    closed_at: null,
    source: remoteOk ? 'cash_sessions' : 'local',
  };
  writeLocalService(opts.estId, snap, date);
  return { ok: true, snap };
}

export async function closeService(opts: {
  estId: string;
  userId?: string | null;
  by?: string;
  date?: string;
}): Promise<{ ok: boolean; error?: string; snap: ServiceSnapshot }> {
  const date = opts.date || todayISO();
  const closed_at = new Date().toISOString();

  markClosed(opts.estId, date, opts.by);

  try {
    await supabase
      .from('cash_sessions')
      .update({ status: 'closed', closed_at, closed_by: opts.userId || null })
      .eq('establishment_id', opts.estId)
      .eq('session_date', date)
      .eq('status', 'open');
  } catch {
    /* */
  }

  const snap: ServiceSnapshot = {
    status: 'closed',
    closed_at,
    source: 'local',
  };
  writeLocalService(opts.estId, snap, date);
  return { ok: true, snap };
}

export function subscribeServiceDay(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener(EVENT, handler);
  window.addEventListener('gesmak-live-sales', handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener('gesmak-live-sales', handler);
    window.removeEventListener('storage', handler);
  };
}
