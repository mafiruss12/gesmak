import { useState } from 'react';
import { Users, UserCog, ClipboardList } from 'lucide-react';
import TeamPage from '@/pages/Team';
import Employees from '@/pages/Employees';
import SuiviGerant from '@/pages/SuiviGerant';
import { useAuth } from '@/lib/auth';

type Tab = 'acces' | 'fiches' | 'suivi';

/**
 * Page unique « Mes employés » :
 * - Accès (création comptes / rôles / autoriser stock)
 * - Fiches employés (annuaire RH local)
 * - Suivi (activité / gérant)
 */
export default function MesEmployes() {
  const { member, effectiveRole } = useAuth();
  const role = String(effectiveRole || member?.role || '');
  const canSuivi = ['super_admin', 'admin', 'owner'].includes(role);
  const [tab, setTab] = useState<Tab>('acces');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-stone-100 flex items-center gap-2">
          <Users className="text-amber-400" size={22} />
          Mes employés
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          Accès plateforme, fiches et suivi d&apos;activité au même endroit.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 p-1 rounded-2xl bg-stone-900 border border-stone-800">
        <button
          type="button"
          onClick={() => setTab('acces')}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
            tab === 'acces'
              ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40'
              : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <UserCog size={16} /> Accès & autorisations
        </button>
        <button
          type="button"
          onClick={() => setTab('fiches')}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
            tab === 'fiches'
              ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40'
              : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <Users size={16} /> Fiches
        </button>
        {canSuivi && (
          <button
            type="button"
            onClick={() => setTab('suivi')}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
              tab === 'suivi'
                ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <ClipboardList size={16} /> Suivi
          </button>
        )}
      </div>

      <div className={tab === 'acces' ? '' : 'hidden'}>
        <TeamPage />
      </div>
      <div className={tab === 'fiches' ? '' : 'hidden'}>
        <Employees />
      </div>
      {canSuivi && (
        <div className={tab === 'suivi' ? '' : 'hidden'}>
          <SuiviGerant />
        </div>
      )}
    </div>
  );
}
