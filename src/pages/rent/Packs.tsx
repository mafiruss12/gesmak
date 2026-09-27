import { useEffect, useState } from 'react';
import { Gift, Plus, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { EmptyState, Modal } from '@/components/ui';
import type { RentalPack } from '@/lib/rentalTypes';

const PRESETS: Omit<RentalPack, 'id' | 'establishment_id' | 'created_at'>[] = [
  {
    name: 'Mariage 300 invités',
    event_type: 'mariage',
    guests: 300,
    description: 'Pack type cérémonie',
    items: [
      { name: 'Chaises', qty: 300, category: 'chaises' },
      { name: 'Tables', qty: 30, category: 'tables' },
      { name: 'Bâches', qty: 4, category: 'baches' },
      { name: 'Kit sono', qty: 1, category: 'sonorisation' },
    ],
  },
  {
    name: 'Baptême 100 invités',
    event_type: 'bapteme',
    guests: 100,
    description: 'Pack familial',
    items: [
      { name: 'Chaises', qty: 100, category: 'chaises' },
      { name: 'Tables', qty: 12, category: 'tables' },
      { name: 'Bâche', qty: 2, category: 'baches' },
    ],
  },
  {
    name: 'Réunion 50 places',
    event_type: 'reunion',
    guests: 50,
    description: 'Salle / conférence',
    items: [
      { name: 'Chaises', qty: 50, category: 'chaises' },
      { name: 'Tables', qty: 8, category: 'tables' },
      { name: 'Sono simple', qty: 1, category: 'sonorisation' },
    ],
  },
];

export default function RentPacks() {
  const { member, activeEstablishment } = useAuth();
  const estId = activeEstablishment?.id || member?.establishment_id || null;
  const [packs, setPacks] = useState<RentalPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!estId) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('rental_packs')
      .select('*')
      .eq('establishment_id', estId)
      .order('name');
    setPacks((data ?? []) as RentalPack[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estId]);

  async function seedPresets() {
    if (!estId) return;
    setSaving(true);
    for (const p of PRESETS) {
      await supabase.from('rental_packs').insert({
        establishment_id: estId,
        name: p.name,
        event_type: p.event_type,
        guests: p.guests,
        description: p.description,
        items: p.items,
      });
    }
    setSaving(false);
    await load();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary-500" size={28} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-100 flex items-center gap-2">
            <Sparkles className="text-primary-400" size={22} /> Packs événements
          </h1>
          <p className="text-stone-400 text-sm">Suggestions Mariage, Baptême, Réunion…</p>
        </div>
        {packs.length === 0 && (
          <button onClick={seedPresets} disabled={saving} className="btn-primary flex items-center gap-2">
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
            Charger modèles
          </button>
        )}
      </div>

      {packs.length === 0 ? (
        <EmptyState
          icon={<Gift size={48} />}
          title="Aucun pack"
          message="Chargez les modèles Mariage 300, Baptême 100, Réunion 50."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {packs.map((p) => (
            <div key={p.id} className="card">
              <p className="font-semibold text-stone-100">{p.name}</p>
              <p className="text-xs text-stone-500 mb-2">
                {p.event_type} · {p.guests} invités
              </p>
              <ul className="text-sm text-stone-400 space-y-1">
                {(Array.isArray(p.items) ? p.items : []).map((it: any, i: number) => (
                  <li key={i}>
                    {it.qty}× {it.name}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-primary-400 mt-3">
                Utilisez ces quantités pour créer une commande dans Commandes.
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
