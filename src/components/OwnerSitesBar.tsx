import { Building2, Check } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { BUSINESS_LABELS, normalizeBusinessType } from '@/lib/businessTypes';

/** Bascule établissements — propriétaire / admin */
export default function OwnerSitesBar() {
  const { member, myEstablishments, activeEstablishment, switchEstablishment, effectiveRole } = useAuth();
  const role = String(effectiveRole || member?.role || '');
  const canSwitch = ['super_admin', 'admin', 'owner', 'manager'].includes(role);
  const currentId = activeEstablishment?.id || member?.establishment_id || '';

  if (!canSwitch || myEstablishments.length === 0) return null;

  return (
    <div className="mb-5 rounded-2xl border border-amber-500/40 bg-white dark:bg-stone-900/70 p-3 shadow-sm sites-bar">
      <p className="text-[11px] uppercase tracking-wide text-stone-700 font-semibold mb-2 flex items-center gap-1 sites-bar-title">
        <Building2 size={13} className="text-amber-600" /> Mes établissements
      </p>
      <div className="flex flex-wrap gap-2">
        {myEstablishments.map((e) => {
          const active = e.id === currentId;
          const label = BUSINESS_LABELS[normalizeBusinessType(e.type)] || e.type;
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => {
                if (!active) void switchEstablishment(e.id);
              }}
              className={`min-h-[44px] px-3 py-2 rounded-xl text-left text-sm border transition sites-bar-btn ${
                active
                  ? 'border-amber-500 bg-amber-50 text-stone-900 ring-1 ring-amber-400/50'
                  : 'border-stone-200 bg-stone-50 text-stone-800 hover:border-amber-400 hover:bg-amber-50/80'
              }`}
            >
              <span className="font-semibold flex items-center gap-1 text-stone-900">
                {active && <Check size={14} className="text-amber-600 shrink-0" />}
                {e.name}
              </span>
              <span className="block text-[11px] text-stone-600 font-medium">{label}</span>
            </button>
          );
        })}
      </div>
      {myEstablishments.length === 1 && (
        <p className="text-[11px] text-stone-600 mt-2 leading-snug">
          Un seul site pour l’instant. Pour un établissement multi-services, créez d’autres établissements
          (resto, maquis…) sur le même compte — vous pourrez basculer ici.
        </p>
      )}
      {myEstablishments.length > 1 && (
        <p className="text-[11px] text-stone-600 mt-2 leading-snug">
          Touchez un site pour basculer (même endroit, autre service). Les données suivent l’établissement actif.
        </p>
      )}
    </div>
  );
}
