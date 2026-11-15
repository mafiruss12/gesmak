import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/lib/auth';
import {
  closeService,
  openService,
  readLocalService,
  subscribeServiceDay,
  type ServiceSnapshot,
} from '@/lib/serviceDay';

type ServiceDayCtx = {
  estId: string | null;
  snap: ServiceSnapshot;
  isOpen: boolean;
  busy: boolean;
  open: () => Promise<void>;
  close: () => Promise<void>;
  refreshLocal: () => void;
};

const Ctx = createContext<ServiceDayCtx | null>(null);

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Une seule source de vérité pour OPEN/CLOSED.
 * Aucun "Chargement du service", aucun fetch qui écrase OPEN.
 */
export function ServiceDayProvider({ children }: { children: ReactNode }) {
  const { member, activeEstablishment, user } = useAuth();
  const estId = activeEstablishment?.id || member?.establishment_id || null;

  const [snap, setSnap] = useState<ServiceSnapshot>(() =>
    estId ? readLocalService(estId) : { status: 'closed', source: 'none' },
  );
  const [busy, setBusy] = useState(false);

  const refreshLocal = useCallback(() => {
    if (!estId) {
      setSnap({ status: 'closed', source: 'none' });
      return;
    }
    setSnap(readLocalService(estId, todayISO()));
  }, [estId]);

  useEffect(() => {
    refreshLocal();
    if (!estId) return;
    return subscribeServiceDay(() => {
      setSnap(readLocalService(estId, todayISO()));
    });
  }, [estId, refreshLocal]);

  const open = useCallback(async () => {
    if (!estId || busy) return;
    setBusy(true);
    const optimistic: ServiceSnapshot = {
      status: 'open',
      opened_at: new Date().toISOString(),
      closed_at: null,
      source: 'local',
    };
    setSnap(optimistic);
    try {
      const res = await openService({
        estId,
        userId: member?.user_id || user?.id,
        by: member?.full_name || member?.role || 'equipe',
      });
      setSnap(res.snap);
    } catch {
      setSnap(optimistic);
    } finally {
      setBusy(false);
    }
  }, [estId, busy, member, user]);

  const close = useCallback(async () => {
    if (!estId || busy) return;
    setBusy(true);
    try {
      const res = await closeService({
        estId,
        userId: member?.user_id || user?.id,
        by: member?.full_name || member?.role || 'equipe',
      });
      setSnap(res.snap);
    } finally {
      setBusy(false);
    }
  }, [estId, busy, member, user]);

  const value = useMemo(
    () => ({
      estId,
      snap,
      isOpen: snap.status === 'open',
      busy,
      open,
      close,
      refreshLocal,
    }),
    [estId, snap, busy, open, close, refreshLocal],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useServiceDay(): ServiceDayCtx {
  const v = useContext(Ctx);
  if (!v) {
    // Fallback sûr hors provider (pages publiques)
    return {
      estId: null,
      snap: { status: 'closed', source: 'none' },
      isOpen: false,
      busy: false,
      open: async () => undefined,
      close: async () => undefined,
      refreshLocal: () => undefined,
    };
  }
  return v;
}
