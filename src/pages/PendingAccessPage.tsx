import { Clock, Loader2, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth';

export default function PendingAccessPage() {
  const { signOut, accessRequest } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950/20 flex items-center justify-center p-4">
      <div className="bg-stone-900/90 backdrop-blur-xl border border-stone-700/50 rounded-3xl p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-warning-500/20 flex items-center justify-center mx-auto mb-4">
          <Clock size={32} className="text-warning-400 animate-pulse" />
        </div>
        <h1 className="text-2xl font-bold font-display text-stone-100 mb-2">Accès en attente de validation</h1>
        <p className="text-stone-400 mb-6">
          Votre demande d'accès a bien été enregistrée. Le Super Administrateur doit approuver votre compte
          pour que vous puissiez accéder à l'application.
        </p>
        {accessRequest && (
          <div className="bg-stone-800/50 rounded-xl p-4 mb-6 text-left">
            <p className="text-sm text-stone-400">Nom</p>
            <p className="text-stone-200 font-medium">{accessRequest.full_name ?? '—'}</p>
            <p className="text-sm text-stone-400 mt-2">Email</p>
            <p className="text-stone-200 font-medium">{accessRequest.email}</p>
            <p className="text-sm text-stone-400 mt-2">Inscription via</p>
            <p className="text-stone-200 font-medium">
              {accessRequest.auth_provider === 'google' ? 'Google' : 'Email'}
            </p>
          </div>
        )}
        <div className="flex items-center justify-center gap-2 text-stone-500 mb-6">
          <Loader2 className="animate-spin" size={16} />
          <span className="text-sm">En attente d'approbation...</span>
        </div>
        <button onClick={signOut} className="btn-ghost flex items-center gap-2 mx-auto">
          <LogOut size={16} /> Se déconnecter
        </button>
      </div>
    </div>
  );
}
