import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { listHousekeeping, updateHousekeepingStatus } from '@/lib/hotel';

const LABELS: Record<string, string> = {
  pending: 'À nettoyer',
  in_progress: 'En cours',
  done: 'Nettoyé',
  inspected: 'Inspecté',
};

export default function HotelHousekeeping() {
  const { activeEstablishment, member } = useAuth();
  const estId = activeEstablishment?.id || member?.establishment_id || '';
  const [list, setList] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function reload() {
    const { data, error } = await listHousekeeping(estId);
    setList(data);
    setErr(error || null);
  }

  useEffect(() => {
    if (estId) void reload();
  }, [estId]);

  async function setStatus(id: string, status: 'pending' | 'in_progress' | 'done' | 'inspected', roomId?: string) {
    const { error } = await updateHousekeepingStatus(id, status, roomId);
    if (error) setErr(error);
    else await reload();
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold">Housekeeping</h1>
      <p className="text-sm text-stone-500">Check-out → Nettoyage → Inspection → Disponible</p>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="space-y-2">
        {list.map((t) => (
          <div key={t.id} className="rounded-xl border border-stone-200 bg-white p-3">
            <div className="flex justify-between gap-2">
              <div>
                <p className="font-semibold">Chambre {t.hotel_rooms?.number || '—'}</p>
                <p className="text-xs text-stone-500">{LABELS[t.status] || t.status}</p>
                {t.notes && <p className="text-xs text-stone-400">{t.notes}</p>}
              </div>
              <select
                className="text-xs rounded-lg border px-2 py-1"
                value={t.status}
                onChange={(e) =>
                  void setStatus(t.id, e.target.value as any, t.room_id)
                }
              >
                {Object.entries(LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>
        ))}
        {list.length === 0 && (
          <p className="text-sm text-stone-500 text-center py-8">
            Aucune tâche. Les check-out créent automatiquement une tâche de nettoyage.
          </p>
        )}
      </div>
    </div>
  );
}
