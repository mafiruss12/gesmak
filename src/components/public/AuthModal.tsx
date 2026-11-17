import { useState } from 'react';
import { Loader2, X, Eye, Building2, Users, Handshake } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

export type AuthMode = 'signin' | 'signup';
export type AccountIntent = 'visitor' | 'owner' | 'staff' | 'provider';

const INTENTS: { id: AccountIntent; title: string; desc: string; icon: typeof Eye }[] = [
  { id: 'visitor', title: 'Je suis visiteur', desc: 'Découvrir établissements, menus et événements.', icon: Eye },
  { id: 'owner', title: 'Je suis propriétaire', desc: 'Gérer et promouvoir mon établissement.', icon: Building2 },
  { id: 'staff', title: 'Je travaille ici', desc: 'Accès créé par le propriétaire uniquement.', icon: Users },
  { id: 'provider', title: 'Je propose des services', desc: 'DJ, traiteur, photo, décoration…', icon: Handshake },
];

export default function AuthModal({
  open,
  mode,
  onClose,
  onMode,
}: {
  open: boolean;
  mode: AuthMode;
  onClose: () => void;
  onMode: (m: AuthMode) => void;
}) {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const [step, setStep] = useState<'intent' | 'form'>('intent');
  const [intent, setIntent] = useState<AccountIntent>('visitor');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'signin') {
        const { error: err } = await signIn(email.trim(), password);
        if (err) {
          setError(err);
          setLoading(false);
          return;
        }
        const { data: { user: u } } = await supabase.auth.getUser();
        const t = u?.user_metadata?.account_type;
        if (t === 'visitor' || t === 'provider') {
          onClose();
          window.location.assign('/');
          return;
        }
        window.location.assign('/dashboard');
        return;
      }
      if (intent === 'staff') {
        setError('Les accès employés sont créés par le propriétaire dans « Mes employés ». Contactez votre patron.');
        setLoading(false);
        return;
      }
      if (!fullName.trim()) {
        setError('Nom complet requis');
        setLoading(false);
        return;
      }
      if (password.length < 6) {
        setError('Mot de passe : minimum 6 caractères');
        setLoading(false);
        return;
      }
      const { error: err } = await signUp(email.trim(), password, fullName.trim());
      if (err) {
        setError(err);
        setLoading(false);
        return;
      }
      try {
        await supabase.auth.updateUser({
          data: { account_type: intent, full_name: fullName.trim() },
        });
      } catch {
        /* */
      }
      if (intent === 'visitor' || intent === 'provider') {
        onClose();
        setLoading(false);
        window.location.assign('/');
        return;
      }
      window.location.assign('/dashboard');
    } catch (ex: any) {
      setError(ex?.message || 'Erreur');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button type="button" className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} aria-label="Fermer" />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between">
          <p className="font-bold text-slate-900">
            {mode === 'signin' ? 'Connexion' : 'Créer un compte'}
          </p>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center">
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          {mode === 'signup' && step === 'intent' ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600 mb-2">Bienvenue sur GESMAK. Que souhaitez-vous faire ?</p>
              {INTENTS.map((it) => {
                const Icon = it.icon;
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => {
                      setIntent(it.id);
                      setStep('form');
                    }}
                    className="w-full text-left flex gap-3 p-3.5 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                      <Icon size={18} />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-slate-900">{it.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{it.desc}</p>
                    </div>
                  </button>
                );
              })}
              <button type="button" className="text-sm text-blue-600 font-medium w-full text-center pt-2" onClick={() => onMode('signin')}>
                Déjà un compte ? Se connecter
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              {mode === 'signup' && (
                <button type="button" className="text-xs text-blue-600 font-medium" onClick={() => setStep('intent')}>
                  ← Changer de profil ({INTENTS.find((i) => i.id === intent)?.title})
                </button>
              )}
              {mode === 'signup' && (
                <input
                  className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  placeholder="Nom complet"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              )}
              <input
                className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                placeholder="E-mail, téléphone ou identifiant"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                type="password"
                placeholder="Mot de passe (min. 6)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : mode === 'signin' ? 'Se connecter' : "S'inscrire"}
              </button>
              <button
                type="button"
                className="w-full h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-sm"
                onClick={async () => {
                  try {
                    await signInWithGoogle();
                  } catch (ex: any) {
                    setError(ex?.message || 'Google indisponible');
                  }
                }}
              >
                Continuer avec Google
              </button>
              <button
                type="button"
                className="text-sm text-slate-500 w-full text-center"
                onClick={() => {
                  onMode(mode === 'signin' ? 'signup' : 'signin');
                  setStep(mode === 'signin' ? 'intent' : 'form');
                }}
              >
                {mode === 'signin' ? "Pas de compte ? S'inscrire" : 'Déjà inscrit ? Se connecter'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
