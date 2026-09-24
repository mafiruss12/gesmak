import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import {
  HOTEL_SERVICE_PRESETS,
  ensureDefaultHotelServices,
  listHotelServices,
} from '@/lib/hotel';
import { supabase } from '@/lib/supabase';

export default function HotelServices() {
  const { activeEstablishment, member } = useAuth();
  const estId = activeEstablishment?.id || member?.establishment_id || '';
  const [list, setList] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>(HOTEL_SERVICE_PRESETS.map((p) => p.code));
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function reload() {
    const { data, error } = await listHotelServices(estId);
    setList(data);
    setErr(error || null);
    if (data.length) setSelected(data.filter((d) => d.is_active).map((d) => d.code));
  }

  useEffect(() => {
    if (estId) void reload();
  }, [estId]);

  async function save() {
    setSaving(true);
    setErr(null);
    setMsg(null);
    const { error } = await ensureDefaultHotelServices(estId, selected);
    if (error) {
      setErr(error);
      setSaving(false);
      return;
    }
    // désactiver non sélectionnés
    const allCodes = HOTEL_SERVICE_PRESETS.map((p) => p.code);
    for (const code of allCodes) {
      await supabase
        .from('hotel_services')
        .update({ is_active: selected.includes(code) })
        .eq('establishment_id', estId)
        .eq('code', code);
    }
    setSaving(false);
    setMsg('Services enregistrés.');
    await reload();
  }

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <h1 className="text-xl font-bold">Services du complexe</h1>
      <p className="text-sm text-stone-500">
        Activez les départements de votre complexe hôtelier.
      </p>
      {err && <p className="text-sm text-red-600">{err}</p>}
      {msg && <p className="text-sm text-emerald-700">{msg}</p>}
      <div className="space-y-2">
        {HOTEL_SERVICE_PRESETS.map((p) => {
          const checked = selected.includes(p.code);
          return (
            <label
              key={p.code}
              className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 cursor-pointer ${
                checked ? 'border-violet-500 bg-violet-50' : 'border-stone-200 bg-white'
              }`}
            >
              <input
                type="checkbox"
                className="mt-1 accent-violet-600"
                checked={checked}
                onChange={() =>
                  setSelected((prev) =>
                    checked ? prev.filter((x) => x !== p.code) : [...prev, p.code],
                  )
                }
              />
              <span>
                <span className="block font-medium text-stone-900">{p.name}</span>
                <span className="block text-[11px] text-stone-500">{p.description}</span>
              </span>
            </label>
          );
        })}
      </div>
      <button type="button" className="btn-primary w-full" disabled={saving} onClick={() => void save()}>
        {saving ? 'Enregistrement…' : 'Enregistrer les services'}
      </button>
      {list.length > 0 && (
        <p className="text-xs text-stone-400 text-center">
          {list.filter((l) => l.is_active).length} service(s) actif(s)
        </p>
      )}
    </div>
  );
}
