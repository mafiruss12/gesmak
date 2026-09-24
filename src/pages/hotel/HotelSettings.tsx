import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { getComplexSettings, saveComplexSettings } from '@/lib/hotel';

export default function HotelSettings() {
  const { activeEstablishment, member } = useAuth();
  const estId = activeEstablishment?.id || member?.establishment_id || '';
  const [form, setForm] = useState({
    display_name: '',
    address: '',
    city: '',
    country: "Côte d'Ivoire",
    phone: '',
    email: '',
    website: '',
    description: '',
    currency: 'FCFA',
    tax_rate: '0',
    primary_color: '#7c3aed',
    checkin_time: '14:00',
    checkout_time: '12:00',
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!estId) return;
    void getComplexSettings(estId).then(({ data }) => {
      if (data) {
        setForm((f) => ({
          ...f,
          display_name: data.display_name || activeEstablishment?.name || '',
          address: data.address || '',
          city: data.city || '',
          country: data.country || "Côte d'Ivoire",
          phone: data.phone || '',
          email: data.email || '',
          website: data.website || '',
          description: data.description || '',
          currency: data.currency || 'FCFA',
          tax_rate: String(data.tax_rate ?? 0),
          primary_color: data.primary_color || '#7c3aed',
          checkin_time: data.checkin_time || '14:00',
          checkout_time: data.checkout_time || '12:00',
        }));
      } else if (activeEstablishment) {
        setForm((f) => ({
          ...f,
          display_name: activeEstablishment.name || '',
          address: activeEstablishment.address || '',
          phone: activeEstablishment.phone || '',
        }));
      }
    });
  }, [estId, activeEstablishment]);

  async function save() {
    setSaving(true);
    setErr(null);
    setMsg(null);
    const { error } = await saveComplexSettings(estId, {
      ...form,
      tax_rate: Number(form.tax_rate) || 0,
    });
    setSaving(false);
    if (error) setErr(error);
    else setMsg('Paramètres enregistrés.');
  }

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <h1 className="text-xl font-bold">Paramètres — Complexe hôtelier</h1>
      {err && <p className="text-sm text-red-600">{err}</p>}
      {msg && <p className="text-sm text-emerald-700">{msg}</p>}
      {(
        [
          ['display_name', 'Nom du complexe'],
          ['address', 'Adresse'],
          ['city', 'Ville'],
          ['country', 'Pays'],
          ['phone', 'Téléphone'],
          ['email', 'Email'],
          ['website', 'Site web'],
          ['currency', 'Devise'],
          ['tax_rate', 'Taxe (%)'],
          ['primary_color', 'Couleur principale'],
          ['checkin_time', 'Heure check-in'],
          ['checkout_time', 'Heure check-out'],
        ] as const
      ).map(([key, label]) => (
        <label key={key} className="block text-xs font-medium text-stone-600">
          {label}
          <input
            className="input-field mt-1"
            type={key === 'primary_color' ? 'color' : 'text'}
            value={(form as any)[key]}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          />
        </label>
      ))}
      <label className="block text-xs font-medium text-stone-600">
        Description
        <textarea
          className="input-field mt-1"
          rows={3}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </label>
      <button type="button" className="btn-primary w-full" disabled={saving} onClick={() => void save()}>
        {saving ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </div>
  );
}
