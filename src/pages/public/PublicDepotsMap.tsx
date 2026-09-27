import { useEffect, useState } from 'react';
import { MapPin, Phone } from 'lucide-react';
import { listPublicDepots } from '@/lib/depot';
import { EmptyState } from '@/components/ui';

export default function PublicDepotsMap() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listPublicDepots()
      .then(setRows)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 p-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-1">Grossistes / dépôts</h1>
      <p className="text-sm text-stone-400 mb-4">
        Annuaire public des dépôts qui ont choisi d&apos;être visibles (opt-in).
      </p>
      {loading && <p className="text-stone-500">Chargement…</p>}
      {!loading && rows.length === 0 && (
        <EmptyState
          icon={<MapPin size={40} />}
          title="Aucun dépôt public"
          message="Les propriétaires doivent activer la visibilité publique dans leurs paramètres."
        />
      )}
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="rounded-2xl border border-stone-800 p-4">
            <div className="font-semibold">{r.name}</div>
            {r.public_zone && <div className="text-sm text-stone-400">Zone : {r.public_zone}</div>}
            {r.public_phone && (
              <a href={`tel:${r.public_phone}`} className="text-sm text-sky-400 flex items-center gap-1 mt-1">
                <Phone size={14} /> {r.public_phone}
              </a>
            )}
            {r.public_lat != null && r.public_lng != null && (
              <a
                className="text-xs text-amber-400 mt-2 inline-block"
                href={`https://www.google.com/maps?q=${r.public_lat},${r.public_lng}`}
                target="_blank"
                rel="noreferrer"
              >
                Voir sur la carte
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
