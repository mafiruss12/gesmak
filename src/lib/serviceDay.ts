/**
 * Statut commercial du jour — source unique, sans clignotement UI.
 * CLOSED par défaut → OPEN après « Ouvrir la journée » → CLOSED à la clôture.
 */
import { supabase } from '@/lib/supabase';
import { openDay, markClosed, loadLiveDay } from '@/lib/liveDaySales';

export type ServiceStatus = 'open' | 'closed';

export type ServiceSnapshot = {
  status: ServiceStatus;
  opened_at?: string | null;
  closed_at?: string | null;
  source: 'cash_sessions' | 'local' | 'none' | 'cache';
};

const EVENT = 'gesmak-service-day';
const memory = new Map<string, ServiceSnapshot>();

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function localKey(estId: string, date: string) {
  return `mm_service_day:${estId}:${date}`;
}

function memKey(estId: string, date: string) {
  return `${estId}:${date}`;
}

export function readLocalService(estId: string, date = todayISO()): ServiceSnapshot {
  const mk = memKey(estId, date);
  if (memory.has(mk)) {
    return { ...memory.get(mk)!, source: 'cache' };
  }
  try {
    const raw = localStorage.getItem(localKey(estId, date));
    if (raw) {
      const p = JSON.parse(raw) as ServiceSnapshot;
      if (p?.status === 'open' || p?.status === 'closed') {
        memory.set(mk, p);
        return p;
      }
    }
  } catch {
    /* */
  }
  try {
    const live = loadLiveDay(estId, date);
    if (live.closed_at) {
      const snap: ServiceSnapshot = { status: 'closed', closed_at: live.closed_at, source: 'local' };
      memory.set(mk, snap);
      return snap;
    }
    const opened = (live.activity || []).some((a) => a.type === 'open');
    if (opened && !live.closed_at) {
      const snap: ServiceSnapshot = {
        status: 'open',
        opened_at: live.activity?.find((a) => a.type === 'open')?.at,
        source: 'local',
      };
      memory.set(mk, snap);
      return snap;
    }
  } catch {
    /* */
  }
  return { status: 'closed', source: 'none' };
}

function persistLocal(estId: string, snap: ServiceSnapshot, date: string) {
  const mk = memKey(estId, date);
  memory.set(mk, snap);
  try {
    localStorage.setItem(localKey(estId, date), JSON.stringify({ ...snap, source: 'local' }));
  } catch {
    /* */
  }
}

function emitChange(estId: string, date: string, snap: ServiceSnapshot) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(
      new CustomEvent(EVENT, { detail: { establishment_id: estId, date, ...snap } }),
    );
  } catch {
    /* */
  }
}

/** Écriture + event uniquement si le statut change vraiment */
export function writeLocalService(
  estId: string,
  snap: ServiceSnapshot,
  date = todayISO(),
  opts?: { silent?: boolean },
) {
  const prev = readLocalService(estId, date);
  const next: ServiceSnapshot = { ...snap, source: snap.source || 'local' };
  persistLocal(estId, next, date);
  if (opts?.silent) return;
  if (prev.status === next.status && (prev.opened_at || '') === (next.opened_at || '')) return;
  emitChange(estId, date, next);
}

export function isServiceOpenLocal(estId: string, date = todayISO()): boolean {
  return readLocalService(estId, date).status === 'open';
}

/** Lecture serveur — ne passe JAMAIS open→closed (évite le clignotement après « Ouvrir ») */
export async function fetchServiceStatus(estId: string, date = todayISO()): Promise<ServiceSnapshot> {
  const local = readLocalService(estId, date);

  try {
    const { data, error } = await supabase
      .from('cash_sessions')
      .select('id, status, opened_at, closed_at')
      .eq('establishment_id', estId)
      .eq('session_date', date)
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data && data.status === 'open') {
      const snap: ServiceSnapshot = {
        status: 'open',
        opened_at: data.opened_at,
        closed_at: null,
        source: 'cash_sessions',
      };
      persistLocal(estId, snap, date);
      return snap;
    }
  } catch {
    /* offline / RLS */
  }

  // Important : si le local dit OPEN, on garde OPEN tant que closeService n'a pas été appelé.
  // Sinon le fetch juste après « Ouvrir la journée » force CLOSED → clignotement.
  if (local.status === 'open') {
    return local;
  }

  return { status: 'closed', closed_at: local.closed_at || null, source: local.source || 'none' };
}

export async function openService(opts: {
  estId: string;
  userId?: string | null;
  by?: string;
  date?: string;
}): Promise<{ ok: boolean; error?: string; snap: ServiceSnapshot }> {
  const date = opts.date || todayISO();
  const opened_at = new Date().toISOString();

  openDay(opts.estId, date, opts.by);

  try {
    await supabase
      .from('cash_sessions')
      .update({ status: 'closed', closed_at: opened_at })
      .eq('establishment_id', opts.estId)
      .eq('session_date', date)
      .eq('status', 'open');

    await supabase.from('cash_sessions').insert({
      establishment_id: opts.estId,
      session_date: date,
      status: 'open',
      opened_at,
      opened_by: opts.userId || null,
      opening_float: 0,
    });
  } catch {
    /* local remains source of truth if remote fails */
  }

  const snap: ServiceSnapshot = {
    status: 'open',
    opened_at,
    closed_at: null,
    source: 'local',
  };
  writeLocalService(opts.estId, snap, date); // event once
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
  let timer: ReturnType<typeof setTimeout> | null = null;
  const handler = () => {
    // debounce 80ms — évite rafales
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => cb(), 80);
  };
  window.addEventListener(EVENT, handler);
  return () => {
    if (timer) clearTimeout(timer);
    window.removeEventListener(EVENT, handler);
  };
}

export async function getActiveSessionId(estId: string, date = todayISO()): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('cash_sessions')
      .select('id')
      .eq('establishment_id', estId)
      .eq('session_date', date)
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.id || null;
  } catch {
    return null;
  }
}

export async function assertServiceOpen(estId: string): Promise<{ ok: boolean; message?: string }> {
  // Priorité cache local (instantané, stable)
  if (isServiceOpenLocal(estId)) return { ok: true };
  const s = await fetchServiceStatus(estId);
  if (s.status === 'open') return { ok: true };
  return {
    ok: false,
    message: 'Le service est fermé. Aucune nouvelle commande ou vente n’est autorisée.',
  };
}
