import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Check, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import {
  applyBusinessTheme,
  BUSINESS_LABELS,
  BUSINESS_THEMES,
  BUSINESS_TYPES,
  normalizeBusinessType,
  type BusinessType,
} from '@/lib/businessTypes';

/** Bascule établissements + changement instantané de mode d'activité (propriétaire / admin) */
export default function OwnerSitesBar() {
  const {
    member,
    myEstablishments,
    activeEstablishment,
    allowedBusinessTypes,
    isPlatformAdmin,
    switchEstablishment,
    effectiveRole,
    refresh,
  } = useAuth();
  const navigate = useNavigate();
  const [switchingEstId, setSwitchingEstId] = useState<string | null>(null);
  const [switchingType, setSwitchingType] = useState<BusinessType | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const role = String(effectiveRole || member?.role || '').toLowerCase();
  const canSwitchSite = ['super_admin', 'admin', 'owner', 'manager'].includes(role);
  const canChangeType = ['super_admin', 'admin', 'owner'].includes(role);
  const currentId = activeEstablishment?.id || member?.establishment_id || '';
  const currentType = normalizeBusinessType(activeEstablishment?.type);
  const currentTheme = BUSINESS_THEMES[currentType];

  // Seuls les types attribués à la demande par l'administrateur (+ admins plateforme) sont commutables
  const switchableTypes: BusinessType[] = isPlatformAdmin
    ? BUSINESS_TYPES
    : allowedBusinessTypes;
  const canInteractiveSwitchType = canChangeType && (isPlatformAdmin || switchableTypes.length > 1);

  if (!canSwitchSite || (myEstablishments.length === 0 && !currentId)) return null;

  async function handleTypeChange(nextType: BusinessType) {
    if (!currentId || nextType === currentType || switchingType) return;
    if (!isPlatformAdmin && !switchableTypes.includes(nextType)) {
      setErr("Ce type d'activité n'est pas attribué à votre compte. Faites la demande à l'administrateur.");
      return;
    }
    setSwitchingType(nextType);
    setErr(null);
    try {
      const { error } = await supabase
        .from('establishments')
        .update({ type: nextType })
        .eq('id', currentId);
      if (error) throw error;
      applyBusinessTheme(nextType);
      await refresh();
      navigate('/dashboard', { replace: true });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Impossible de changer de type d’activité.');
    } finally {
      setSwitchingType(null);
    }
  }

  return (
    <div
      className="mb-5 rounded-2xl border bg-white dark:bg-stone-900/70 p-3.5 shadow-sm sites-bar space-y-3"
      style={{ borderColor: currentTheme.primary + '66' }}
    >
      {activeEstablishment && (
        <div className="flex items-center gap-3 pb-2.5 border-b border-stone-200 dark:border-stone-800">
          <div
            className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border flex items-center justify-center bg-stone-950"
            style={{ borderColor: `${currentTheme.primary}66` }}
          >
            {activeEstablishment.logo_url ? (
              <img src={activeEstablishment.logo_url} alt={activeEstablishment.name} className="w-full h-full object-cover" />
            ) : (
              <Building2 size={18} style={{ color: currentTheme.primary }} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wider font-bold text-stone-500 dark:text-stone-400">
              Établissement actif
            </p>
            <p className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
              {activeEstablishment.name}
            </p>
          </div>
          <span
            className="text-[11px] font-bold px-2.5 py-1 rounded-lg shrink-0"
            style={{ background: currentTheme.primarySoft, color: currentTheme.primary }}
          >
            {BUSINESS_LABELS[currentType]}
          </span>
        </div>
      )}

      {myEstablishments.length > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-wide text-stone-700 dark:text-stone-300 font-semibold mb-2 flex items-center gap-1.5 sites-bar-title">
            <Building2 size={13} style={{ color: currentTheme.primary }} /> Mes établissements
          </p>
          <div className="flex flex-wrap gap-2">
            {myEstablishments.map((e) => {
              const active = e.id === currentId;
              const estType = normalizeBusinessType(e.type);
              const estTheme = BUSINESS_THEMES[estType];
              const label = BUSINESS_LABELS[estType] || e.type;
              return (
                <button
                  key={e.id}
                  type="button"
                  disabled={switchingEstId === e.id}
                  onClick={async () => {
                    if (active) return;
                    setSwitchingEstId(e.id);
                    setErr(null);
                    try {
                      await switchEstablishment(e.id);
                      applyBusinessTheme(estType);
                      navigate('/dashboard', { replace: true });
                    } catch (ex: unknown) {
                      setErr(ex instanceof Error ? ex.message : 'Changement d’établissement impossible.');
                    } finally {
                      setSwitchingEstId(null);
                    }
                  }}
                  className="min-h-[44px] px-3 py-2 rounded-xl text-left text-sm border transition sites-bar-btn flex items-center gap-2.5"
                  style={
                    active
                      ? {
                          borderColor: estTheme.primary,
                          backgroundColor: estTheme.primarySoft,
                        }
                      : undefined
                  }
                >
                  <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0 border border-stone-700/40 bg-stone-900 flex items-center justify-center">
                    {e.logo_url ? (
                      <img src={e.logo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Building2 size={14} style={{ color: estTheme.primary }} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="font-semibold flex items-center gap-1.5 text-stone-900 dark:text-stone-100">
                      {switchingEstId === e.id ? (
                        <Loader2 size={14} className="animate-spin shrink-0" />
                      ) : (
                        active && <Check size={14} style={{ color: estTheme.primary }} className="shrink-0" />
                      )}
                      {e.name}
                    </span>
                    <span className="block text-[11px] text-stone-600 dark:text-stone-400 font-medium">
                      {label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {canChangeType && currentId && (
        <div className="pt-2.5 border-t border-stone-200 dark:border-stone-800">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <p className="text-[11px] uppercase tracking-wide font-semibold flex items-center gap-1.5 text-stone-700 dark:text-stone-300">
              <Sparkles size={13} style={{ color: currentTheme.primary }} /> Activité attribuée
            </p>
            <span
              className="text-[11px] font-bold px-2.5 py-0.5 rounded-full"
              style={{ background: currentTheme.primarySoft, color: currentTheme.primary }}
            >
              {BUSINESS_LABELS[currentType]}
            </span>
          </div>

          {canInteractiveSwitchType ? (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {switchableTypes.map((t) => {
                const isCurrent = t === currentType;
                const tTheme = BUSINESS_THEMES[t];
                return (
                  <button
                    key={t}
                    type="button"
                    disabled={Boolean(switchingType)}
                    onClick={() => void handleTypeChange(t)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
                      isCurrent
                        ? 'text-white shadow-sm'
                        : 'border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950/60 text-stone-700 dark:text-stone-300 hover:border-stone-400'
                    }`}
                    style={
                      isCurrent
                        ? { backgroundColor: tTheme.primary, borderColor: tTheme.primary }
                        : undefined
                    }
                  >
                    {switchingType === t ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: isCurrent ? '#ffffff' : tTheme.primary }}
                      />
                    )}
                    {BUSINESS_LABELS[t]}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              Activité attribuée par l&apos;administrateur. Contactez-le sur demande pour ajouter un autre établissement ou type d&apos;activité.
            </p>
          )}
        </div>
      )}

      {err && <p className="text-xs text-red-500 dark:text-red-300 font-medium">{err}</p>}
    </div>
  );
}
