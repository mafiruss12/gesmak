import { useState } from 'react';
import { Beer, CalendarDays, Loader2, Check, Building2, UtensilsCrossed, Warehouse } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { seedDefaultStockForEstablishment } from '@/lib/seedDefaultStock';
import { ensureDefaultHotelServices, HOTEL_SERVICE_PRESETS } from '@/lib/hotel';
import {
  BUSINESS_TYPES_SELECTABLE,
  BUSINESS_LABELS,
  BUSINESS_DESCRIPTIONS,
  BUSINESS_THEMES,
  type BusinessType,
} from '@/lib/businessTypes';

/** Services proposés quand le type « Établissement » (multi-services) est choisi */
export const ESTABLISHMENT_SERVICES: { id: string; label: string; hint: string }[] = [
  { id: 'maquis', label: 'Maquis / Bar', hint: 'Boissons, grillades, caisse' },
  { id: 'restaurant', label: 'Restaurant', hint: 'Salle, cuisine, carte' },
  { id: 'chambres', label: 'Chambres / Hébergement', hint: 'Résidence, hôtel, divertissement, piscine' },
  { id: 'location', label: 'Location événementielle', hint: 'Salle, matériel' },
  { id: 'magasin', label: 'Boutique / Magasin', hint: 'Vente produits' },
];

const ICONS: Record<BusinessType, typeof Beer> = {
  maquis: Beer,
  restaurant: UtensilsCrossed,
  location_event: CalendarDays,
  depot: Warehouse,
  complexe: Building2,
};

interface Props {
  mode: 'create' | 'choose-type';
  onDone: () => void;
  /** Préremplir si on crée un établissement */
  defaultName?: string;
}

export default function TypePicker({ mode, onDone, defaultName = '' }: Props) {
  const { member, user, refresh } = useAuth();
  const [selected, setSelected] = useState<BusinessType | null>(null);
  const [selectedServices, setSelectedServices] = useState<string[]>(['maquis']);
  const [name, setName] = useState(defaultName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!selected || !user) {
      setError(!user ? 'Session expirée. Reconnectez-vous.' : 'Choisissez un type.');
      return;
    }
    if (mode === 'create' && !name.trim()) {
      setError('Indiquez le nom de l’établissement');
      return;
    }
    if (selected === 'complexe' && selectedServices.length === 0) {
      setError('Cochez au moins un service proposé par votre établissement.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (mode === 'create') {
        const { data: est, error: e1 } = await supabase
          .from('establishments')
          .insert({
            name: name.trim(),
            type: selected,
            created_by: user.id,
            subscription_status: 'trial',
            trial_ends_at: new Date(Date.now() + 30 * 86400000).toISOString(),
          })
          .select()
          .single();
        if (e1 || !est) throw new Error(e1?.message || 'Création impossible');

        // Lien propriétaire robuste (RPC contourne triggers/RLS fragiles)
        const { error: linkErr } = await supabase.rpc('ensure_owner_establishment', {
          p_establishment_id: est.id,
          p_full_name: member?.full_name || user.user_metadata?.full_name || name.trim() || null,
        });
        if (linkErr) {
          console.warn('ensure_owner_establishment', linkErr);
          // secours direct
          const nextRole =
            member && ['employee', 'cashier'].includes(String(member.role))
              ? 'owner'
              : member?.role || 'owner';
          await supabase
            .from('members')
            .upsert(
              {
                user_id: user.id,
                email: user.email || null,
                full_name: member?.full_name || name.trim() || 'Propriétaire',
                role: nextRole,
                status: 'active',
                establishment_id: est.id,
              },
              { onConflict: 'user_id' }
            );
          await supabase.from('member_establishments').upsert(
            {
              user_id: user.id,
              establishment_id: est.id,
              role: nextRole,
              status: 'active',
            },
            { onConflict: 'user_id,establishment_id' }
          );
          await supabase.from('establishments').update({ owner_user_id: user.id, created_by: user.id }).eq('id', est.id);
        }

        // Services cochés (organisation multi-services)
        if (selected === 'complexe' && selectedServices.length > 0) {
          try {
            localStorage.setItem(`mm_est_services:${est.id}`, JSON.stringify(selectedServices));
          } catch { /* */ }
          try {
            await supabase
              .from('establishments')
              .update({ services: selectedServices } as any)
              .eq('id', est.id);
          } catch { /* colonne absente = ignore */ }
        }

        // Catalogue de démarrage (boissons / produits à 0)
        try {
          await seedDefaultStockForEstablishment(est.id, selected);
        } catch (seedErr) {
          console.warn('seed stock', seedErr);
        }
        if (selected === 'complexe') {
          try {
            const codes = selectedServices.includes('chambres')
              ? HOTEL_SERVICE_PRESETS.map((p) => p.code)
              : undefined;
            await ensureDefaultHotelServices(est.id, codes);
          } catch (hErr) {
            console.warn('hotel services', hErr);
          }
        }
        try {
          localStorage.setItem(
            'mm_active_est',
            JSON.stringify({ id: est.id, type: selected, name: name.trim() })
          );
          localStorage.setItem('mm_est_ids', JSON.stringify([est.id]));
        } catch { /* */ }
      } else {
        // choose-type sur établissement existant
        if (!member.establishment_id) throw new Error('Aucun établissement');
        const { error: e2 } = await supabase
          .from('establishments')
          .update({ type: selected })
          .eq('id', member.establishment_id);
        if (e2) throw new Error(e2.message);
      }
      await refresh();
      onDone();
      // Évite de rester bloqué sur l'écran si refresh async
      window.location.assign('/dashboard');
    } catch (e: any) {
      setError(e?.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <h1 className="text-2xl font-bold font-display text-stone-100 text-center mb-2">
          {mode === 'create' ? 'Créer votre activité' : 'Quel type d’activité ?'}
        </h1>
        <p className="text-stone-400 text-sm text-center mb-6">
          Le menu, les couleurs et le tableau de bord s’adaptent à votre choix.
        </p>

        {mode === 'create' && (
          <div className="mb-5">
            <label className="label">Nom de l’établissement</label>
            <input
              className="input-field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex. RCO Maquis, Le Gourmet…"
            />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {BUSINESS_TYPES_SELECTABLE.map((t) => {
            const Icon = ICONS[t];
            const theme = BUSINESS_THEMES[t];
            const active = selected === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => { setSelected(t); if (t !== 'complexe') setSelectedServices(['maquis']); }}
                className={`text-left rounded-2xl border p-4 transition-all ${
                  active ? 'ring-2 scale-[1.02]' : 'hover:border-stone-600'
                }`}
                style={{
                  borderColor: active ? theme.primary : undefined,
                  background: active ? theme.primarySoft : undefined,
                  // @ts-expect-error css var
                  ['--tw-ring-color']: theme.primary,
                }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="p-2.5 rounded-xl"
                    style={{ background: theme.primarySoft, color: theme.primary }}
                  >
                    <Icon size={22} />
                  </div>
                  <div>
                    <p className="font-semibold text-stone-100">{BUSINESS_LABELS[t]}</p>
                    <p className="text-xs text-stone-500">{theme.label}</p>
                  </div>
                  {active && <Check size={18} className="ml-auto" style={{ color: theme.primary }} />}
                </div>
                <p className="text-sm text-stone-400">{BUSINESS_DESCRIPTIONS[t]}</p>
              </button>
            );
          })}
        </div>

        {error && (
          <div className="mb-3 text-sm text-error-300 bg-error-500/10 border border-error-500/30 rounded-xl p-3">
            {error}
          </div>
        )}

        {selected === 'complexe' && (
          <div className="mb-4 rounded-2xl border border-violet-200 bg-violet-50/80 p-3 space-y-2">
            <p className="text-sm font-semibold text-stone-800">Services proposés</p>
            <p className="text-[11px] text-stone-600 leading-snug">
              Cochez ce que votre établissement propose. Cela aide à organiser menus et suivi.
            </p>
            <div className="space-y-2 pt-1">
              {ESTABLISHMENT_SERVICES.map((s) => {
                const checked = selectedServices.includes(s.id);
                return (
                  <label
                    key={s.id}
                    className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition ${
                      checked
                        ? 'border-violet-500 bg-white ring-1 ring-violet-300'
                        : 'border-stone-200 bg-white/70 hover:border-violet-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 accent-violet-600"
                      checked={checked}
                      onChange={() => {
                        setSelectedServices((prev) =>
                          checked ? prev.filter((x) => x !== s.id) : [...prev, s.id]
                        );
                      }}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-stone-900">{s.label}</span>
                      <span className="block text-[11px] text-stone-500">{s.hint}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <button
          onClick={submit}
          disabled={!selected || loading}
          className="btn-primary w-full flex items-center justify-center gap-2"
          style={selected ? { backgroundColor: BUSINESS_THEMES[selected].primary } : undefined}
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : null}
          Continuer
        </button>
      </div>
    </div>
  );
}
