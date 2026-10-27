import BrandFooter from '@/components/BrandFooter';
import AdMarquee from '@/components/AdMarquee';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Beer, Mail, Lock, User, Loader2, KeyRound, ArrowLeft, AlertCircle, CheckCircle2, Package, TrendingUp, WifiOff, Shield, Bot, Users, ClipboardList, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { toAuthEmail } from '@/lib/login';
import { makeSignupCaptcha, checkSignupCaptcha, getLoginLockRemaining, serverLoginThrottle } from '@/lib/security';
import { logSecurityEvent } from '@/lib/securityEvents';
import {
  enrollTotp,
  getAssuranceLevel,
  hasVerifiedTotpFactor,
  needsMfaStepUp,
  syncMemberMfaFlag,
  verifyTotpCode,
} from '@/lib/supabaseMfa';
import { supabase } from '@/lib/supabase';

const MARQUEE_MESSAGES = [
  'Stock Manager AI — la solution complète pour maquis, bars & restaurants',
  'Pourquoi Stock Manager ? Zéro perte de stock invisible',
  'Rapport du jour, inventaire, caisse et équipe au même endroit',
  'Fonctionne hors ligne · synchronise dès le retour du réseau',
  'Images boissons, casiers, Mobile Money · Powered by Kevin Tech Pro',
  'Propriétaire et gérant : chacun son rôle, un seul tableau de bord',
];

const AUTH_HIGHLIGHTS = [
  {
    icon: Package,
    title: 'Stock sous contrôle',
    text: 'Suivez chaque boisson, casier et arrivage. Fini les « ça a disparu » sans trace.',
  },
  {
    icon: ClipboardList,
    title: 'Rapport du jour clair',
    text: 'Point du soir en quelques minutes : vendu, en caisse, Mobile Money, commentaire au propriétaire.',
  },
  {
    icon: TrendingUp,
    title: 'Voir sa rentabilité',
    text: 'Ventes, dépenses et alertes rupture pour décider vite, même sans être sur place.',
  },
  {
    icon: WifiOff,
    title: 'Marche hors ligne',
    text: 'L’app mobile garde les données ; dès qu’il y a internet, tout se synchronise.',
  },
  {
    icon: Users,
    title: 'Équipe & rôles',
    text: 'Propriétaire, gérant, employés : chacun voit seulement ce qu’il doit gérer.',
  },
  {
    icon: Bot,
    title: 'Assistance IA',
    text: 'Aide à l’inventaire, suggestions et guidance pour le personnel, même débutant.',
  },
  {
    icon: Shield,
    title: 'Sécurisé',
    text: 'Comptes protégés, historique des mouvements, contrôle admin pour accompagner les établissements.',
  },
];

type Mode = 'signin' | 'signup' | 'forgot' | 'recovery' | 'mfa' | 'mfa_setup';

function mapAuthError(err: string, context: 'signin' | 'signup' | 'forgot' | 'other' = 'other'): string {
  const e = (err || '').toLowerCase();
  if (
    e.includes('invalid login credentials') ||
    e.includes('invalid_credentials') ||
    e.includes('invalid email or password') ||
    e.includes('email/password')
  ) {
    return context === 'signin'
      ? 'Identifiant ou mot de passe incorrect. Vérifiez majuscules/minuscules ou utilisez « Mot de passe oublié ».'
      : 'Identifiant ou mot de passe incorrect.';
  }
  if (
    e.includes('user already registered') ||
    e.includes('already been registered') ||
    e.includes('already registered') ||
    e.includes('email address is already') ||
    e.includes('already exists')
  ) {
    return 'Cet identifiant est déjà utilisé. Utilisez « Se connecter » ou « Mot de passe oublié ».';
  }
  if (e.includes('email not confirmed')) {
    return 'E-mail non confirmé. Vérifiez votre boîte mail.';
  }
  if (e.includes('password') && (e.includes('least') || e.includes('short') || e.includes('6') || e.includes('8'))) {
    return 'Mot de passe trop court (minimum 6 caractères).';
  }
  if (e.includes('interdit') || e.includes('insert member')) {
    return 'Impossible de créer le profil. Réessayez dans un instant.';
  }
  return err;
}

export default function AuthPage() {
  const { signIn, signUp, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('signin');
  const [newPassword, setNewPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [captcha, setCaptcha] = useState(() => makeSignupCaptcha());
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [setupQr, setSetupQr] = useState<string | null>(null);
  const [pendingMfaUserId, setPendingMfaUserId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [password, setPassword] = useState('');

  useEffect(() => {
    const id = window.setInterval(() => {
      setHighlightIdx((i) => (i + 1) % AUTH_HIGHLIGHTS.length);
    }, 4200);
    return () => window.clearInterval(id);
  }, []);
  const [fullName, setFullName] = useState('');
  
  const [netOnline, setNetOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  useEffect(() => {
    const on = () => setNetOnline(true);
    const off = () => setNetOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Déjà connecté → dashboard
  useEffect(() => {
    if (user && !authLoading) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, authLoading, navigate]);


  
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('recovery');
        setError(null);
        setSuccess('Choisissez un nouveau mot de passe sécurisé.');
      }
    });
    // Lien de récupération dans l'URL
    const hash = window.location.hash || '';
    if (hash.includes('type=recovery')) {
      setMode('recovery');
    }
    return () => sub.subscription.unsubscribe();
  }, []);

async function resendConfirmation() {
    const authEmail = toAuthEmail(login);
    if (!authEmail.includes('@') || authEmail.endsWith('@maquis.local')) {
      setError('Indiquez une vraie adresse e-mail pour renvoyer la confirmation.');
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.resend({ type: 'signup', email: authEmail });
    setLoading(false);
    if (err) setError(mapAuthError(err.message, 'other'));
    else setSuccess(`E-mail de confirmation renvoyé à ${authEmail}`);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const login = email.trim();
      if (!login) {
        setError('E-mail, téléphone ou identifiant requis');
        setLoading(false);
        return;
      }

      if (mode === 'forgot') {
        const authEmail = toAuthEmail(login);
        if (!authEmail.includes('@') || authEmail.endsWith('@maquis.local')) {
          setError(
            'La réinitialisation par e-mail nécessite une vraie adresse e-mail (pas un login simple).'
          );
          setLoading(false);
          return;
        }
        const { error: err } = await supabase.auth.resetPasswordForEmail(authEmail, {
          redirectTo: `${window.location.origin}/?type=recovery`,
        });
        if (err) setError(mapAuthError(err.message, 'forgot'));
        else
          setSuccess(
            `Un e-mail de réinitialisation a été envoyé à ${authEmail} s'il existe un compte.`
          );
        setLoading(false);
        return;
      }

      if (mode === 'recovery') {
        if (!newPassword || newPassword.length < 8) {
          setError('Nouveau mot de passe : 8 caractères minimum');
          setLoading(false);
          return;
        }
        const { error: err } = await supabase.auth.updateUser({ password: newPassword });
        if (err) setError(mapAuthError(err.message, 'other'));
        else {
          setSuccess('Mot de passe mis à jour. Vous pouvez vous connecter.');
          setMode('signin');
          setNewPassword('');
          window.history.replaceState({}, '', '/');
        }
        setLoading(false);
        return;
      }

      if (mode === 'mfa_setup') {
        if (!mfaFactorId) {
          setError('Session 2FA invalide — recommencez la configuration');
          setLoading(false);
          return;
        }
        const res = await verifyTotpCode(mfaFactorId, mfaCode);
        if (!res.ok) {
          setError(res.error || 'Code 2FA incorrect — réessayez');
          setLoading(false);
          return;
        }
        const uid = (await supabase.auth.getUser()).data.user?.id;
        if (uid) await syncMemberMfaFlag(uid, true);
        void logSecurityEvent('mfa_success', { setup: true, native: true });
        setSuccess('2FA activé — redirection…');
        setMode('signin');
        setMfaCode('');
        setMfaFactorId(null);
        setLoading(false);
        window.location.replace('/dashboard');
        return;
      }

      if (mode === 'mfa') {
        let factorId = mfaFactorId;
        if (!factorId) {
          const f = await hasVerifiedTotpFactor();
          factorId = f.factorId;
          if (factorId) setMfaFactorId(factorId);
        }
        if (!factorId) {
          setError('Aucun facteur MFA trouvé — reconnectez-vous');
          setMode('signin');
          setLoading(false);
          return;
        }
        const res = await verifyTotpCode(factorId, mfaCode);
        if (!res.ok) {
          setError(res.error || 'Code 2FA incorrect');
          setLoading(false);
          return;
        }
        void logSecurityEvent('mfa_success', { native: true });
        setSuccess('Double authentification validée…');
        setMfaCode('');
        setLoading(false);
        navigate('/dashboard', { replace: true });
        return;
      }

      if (mode !== 'mfa' && mode !== 'mfa_setup' && mode !== 'forgot' && (!password || password.length < 6)) {
        setError('Le mot de passe doit contenir au moins 6 caractères');
        setLoading(false);
        return;
      }

      if (mode === 'signin') {
        const lockMs = getLoginLockRemaining();
        if (lockMs > 0) {
          setError(`Trop de tentatives. Réessayez dans ${Math.ceil(lockMs / 60000)} min.`);
          setLoading(false);
          return;
        }
        let finished = false;
        const safetyTimer = window.setTimeout(() => {
          if (finished) return;
          setLoading(false);
          setError((prev) => prev || 'Le serveur met trop de temps à répondre. Réessayez.');
        }, 25000);
        let err: string | null = null;
        try {
          const throttle = await serverLoginThrottle(login, 'check');
          if (throttle.locked) {
            const min = Math.ceil((throttle.remainingMs || 0) / 60000) || 15;
            setError(`Trop de tentatives. Réessayez dans ${min} min.`);
            setSubmitting(false);
            return;
          }
          const res = await signIn(login, password);
          err = res.error;
        } catch (ex: any) {
          err = ex?.message || 'Connexion impossible';
        } finally {
          finished = true;
          window.clearTimeout(safetyTimer);
        }
        if (err) {
          setError(mapAuthError(err, 'signin'));
          if (err.toLowerCase().includes('trop de tentatives')) setError(err);
          setLoading(false);
          return;
        }
        // Succès Auth → dashboard tout de suite (MFA admin géré par MfaGate si besoin)
        void logSecurityEvent('login_success', {});
        void serverLoginThrottle(login, 'success');
        setLoading(false);
        setSuccess('Connexion réussie…');
        try {
          navigate('/dashboard', { replace: true });
        } catch {
          window.location.assign('/dashboard');
        }
        window.setTimeout(() => {
          const path = window.location.pathname;
          if (path === '/' || path === '/login') {
            window.location.assign('/dashboard');
          }
        }, 300);
        return;
      }

      // signup (mode explicite)
      if (mode !== 'signup') {
        setError('Choisissez « Créer un compte » puis réessayez.');
        setLoading(false);
        return;
      }
      if (!fullName.trim()) {
        setError('Nom complet requis');
        setLoading(false);
        return;
      }
      if (password.length < 8) {
        setError('Mot de passe : minimum 8 caractères, avec lettre et chiffre');
        setLoading(false);
        return;
      }
      if (!acceptedTerms) {
        setError('Veuillez accepter les conditions d\'utilisation');
        setLoading(false);
        return;
      }
      if (!checkSignupCaptcha(captchaAnswer, captcha.expected)) {
        setError('Réponse anti-robot incorrecte');
        setCaptcha(makeSignupCaptcha());
        setCaptchaAnswer('');
        setLoading(false);
        return;
      }
      let err: string | null = null;
      try {
        const r = await Promise.race([
          signUp(login, password, fullName.trim()),
          new Promise<{ error: string }>((resolve) =>
            setTimeout(() => resolve({ error: 'Délai dépassé. Vérifiez Internet et réessayez.' }), 20000)
          ),
        ]);
        err = r.error;
      } catch (ex: any) {
        err = ex?.message || 'Inscription impossible';
      }
      if (err) {
        setError(mapAuthError(err, 'signup'));
        setLoading(false);
        return;
      }
      void logSecurityEvent('signup');
      setSuccess('Compte créé. Redirection…');
      setLoading(false);
      // Si session posée par signUp → dashboard ; sinon message connexion
      navigate('/dashboard', { replace: true });
      return;
    } catch (ex: any) {
      setError(ex?.message || 'Erreur inattendue. Réessayez.');
      setLoading(false);
    }
  }


  return (
    <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-10 bg-primary-600/90 overflow-hidden flex items-center z-20">
        <div className="flex whitespace-nowrap animate-marquee">
          {MARQUEE_MESSAGES.concat(MARQUEE_MESSAGES).map((msg, i) => (
            <span key={i} className="mx-8 text-sm font-medium text-white flex items-center gap-2">
              <Beer size={14} /> {msg}
            </span>
          ))}
        </div>
      </div>

      {/* Fond logo Kevin Tech Pro animé */}
      <div className="auth-logo-bg absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
        <div className="auth-logo-bg-glow" />
        {Array.from({ length: 6 }).map((_, i) => (
          <img
            key={i}
            src="/kevin-tech-pro-logo.png"
            alt=""
            className="auth-logo-float absolute object-contain opacity-[0.12]"
            style={{
              left: `${8 + (i % 3) * 32}%`,
              top: `${10 + Math.floor(i / 3) * 42}%`,
              width: `${120 + (i % 3) * 40}px`,
              height: `${120 + (i % 3) * 40}px`,
              animationDelay: `${i * 1.2}s`,
              animationDuration: `${14 + (i % 4) * 3}s`,
            }}
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/kevin-tech-pro-logo.jpg';
            }}
          />
        ))}
        {/* Grand logo central en fond */}
        <img
          src="/kevin-tech-pro-logo.png"
          alt=""
          className="auth-logo-center absolute left-1/2 top-1/2 -translate-y-1/2 -translate-x-1/2 object-contain opacity-[0.08] w-[min(90vw,520px)] h-[min(90vw,520px)]"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/kevin-tech-pro-logo.jpg';
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-6xl mt-12 mb-8 px-2 grid lg:grid-cols-2 gap-6 lg:gap-10 items-center">
        {/* Panneau avantages animé */}
        <aside className="order-2 lg:order-1 space-y-5 auth-showcase">
          <div className="space-y-2">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400/90">
              <Sparkles size={14} className="auth-pulse" /> Pourquoi Stock Manager AI ?
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 leading-tight font-display">
              La solution qui fait gagner du temps
              <span className="block text-amber-400">et de l’argent à votre établissement</span>
            </h2>
            <p className="text-sm text-stone-600 max-w-lg leading-relaxed">
              Inventaire, caisse, rapport du jour, équipe et suivi propriétaire — une seule app pensée
              pour les maquis, bars, restaurants et commerces en Afrique de l’Ouest.
            </p>
          </div>

          {/* Carte mise en avant (rotation) */}
          <div className="auth-feature-hero relative overflow-hidden rounded-2xl border border-orange-200 bg-white p-5 shadow-md">
            <div className="auth-feature-shine pointer-events-none" />
            {(() => {
              const h = AUTH_HIGHLIGHTS[highlightIdx];
              const Icon = h.icon;
              return (
                <div key={highlightIdx} className="auth-feature-swap flex gap-4 items-start">
                  <div className="shrink-0 w-12 h-12 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-[#FF7900]">
                    <Icon size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-amber-400/80 mb-1">
                      Avantage {highlightIdx + 1} / {AUTH_HIGHLIGHTS.length}
                    </p>
                    <h3 className="text-lg font-semibold text-stone-900">{h.title}</h3>
                    <p className="text-sm text-stone-600 mt-1 leading-relaxed">{h.text}</p>
                  </div>
                </div>
              );
            })()}
            <div className="flex gap-1.5 mt-4">
              {AUTH_HIGHLIGHTS.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Avantage ${i + 1}`}
                  onClick={() => setHighlightIdx(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === highlightIdx ? 'w-6 bg-amber-400' : 'w-1.5 bg-stone-600 hover:bg-stone-500'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Grille avantages */}
          <div className="grid sm:grid-cols-2 gap-3">
            {AUTH_HIGHLIGHTS.slice(0, 4).map((h, i) => {
              const Icon = h.icon;
              return (
                <div
                  key={h.title}
                  className="auth-feature-card rounded-xl border border-stone-200 bg-white shadow-sm p-3.5 flex gap-3"
                  style={{ animationDelay: `${i * 0.15}s` }}
                >
                  <div className="shrink-0 w-9 h-9 rounded-lg bg-stone-800 text-amber-400 flex items-center justify-center">
                    <Icon size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-stone-900">{h.title}</p>
                    <p className="text-[11px] text-stone-500 leading-snug mt-0.5">{h.text}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-stone-500 flex flex-wrap gap-x-3 gap-y-1">
            <span className="text-stone-400">✓ Multi-établissements</span>
            <span className="text-stone-400">✓ WhatsApp & rapports</span>
            <span className="text-stone-400">✓ Kevin Tech Pro</span>
          </p>
        </aside>

        {/* Formulaire connexion */}
        <div className="order-1 lg:order-2 w-full max-w-md mx-auto lg:mx-0 lg:ml-auto">
        <div className="bg-white border border-stone-200 rounded-3xl p-8 shadow-xl auth-form-card">
          <div className="flex flex-col items-center mb-6">
            <img
              src="/logo-sm.png"
              alt="Stock Manager AI"
              className="h-20 w-20 rounded-full object-cover mb-3 shadow-md border border-orange-200"
            />
            <h1 className="text-3xl font-bold font-display text-stone-900">Stock Manager AI</h1>
            <p className="text-sm text-stone-500 mt-1">
              {mode === 'forgot' ? 'Réinitialiser le mot de passe' : 'Gestion intelligente multi-métiers'}
            </p>
          </div>

          {/* Alertes */}
          {!netOnline && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm px-3 py-2 mb-3">
              Hors ligne : la connexion nécessite Internet. Après connexion, stock et rapports restent utilisables hors réseau.
            </div>
          )}
          {error && (error.toLowerCase().includes('confirm') || error.toLowerCase().includes('confirmé')) && (
              <button type="button" className="text-sm text-amber-400 underline mb-2" onClick={resendConfirmation}>
                Renvoyer l&apos;e-mail de confirmation
              </button>
            )}
            {error && (
            <div className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 flex gap-2">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">{error}</p>
                {mode === 'signin' && (
                  <button
                    type="button"
                    className="mt-2 text-amber-300 hover:text-amber-200 underline text-xs"
                    onClick={() => {
                      setError(null);
                      setMode('forgot');
                    }}
                  >
                    Mot de passe oublié ? Réinitialiser par e-mail
                  </button>
                )}
              </div>
            </div>
          )}
          {success && (
            <div className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex gap-2">
              <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
              <p>{success}</p>
            </div>
          )}


        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Inscription publique desactivee : seul un admin cree les comptes membres. */}

            {mode === 'signup' && (
              <div>
                <label className="label">Nom complet</label>
                <div className="relative">
                  <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jean Kouassi"
                    className="input-field pl-10"
                  />
                </div>
              </div>
            )}

            {mode !== 'mfa' && mode !== 'mfa_setup' && (
            <div>
              <label className="label">{mode === 'forgot' ? 'E-mail du compte' : 'Identifiant ou email'}</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={mode === 'forgot' ? 'vous@exemple.com' : '0708091011, gerant1 ou email@gmail.com'}
                  className="input-field pl-10"
                />
              
              <p className="text-[11px] text-stone-500 mt-1">
                Téléphone ou pseudo → compte interne. E-mail complet → compte e-mail (réinitialisation possible).
              </p>
              </div>
            </div>
            )}

            {(mode === 'mfa' || mode === 'mfa_setup') && (
              <div>
                <label className="label">Code de double authentification (6 chiffres)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="input-field text-center tracking-[0.3em] text-lg"
                  required
                />
              </div>
            )}

            {mode !== 'forgot' && mode !== 'recovery' && mode !== 'mfa' && mode !== 'mfa_setup' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label mb-0">Mot de passe</label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      className="text-xs text-amber-400 hover:text-amber-300"
                      onClick={() => {
                        setError(null);
                        setSuccess(null);
                        setMode('forgot');
                      }}
                    >
                      Mot de passe oublié ?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
                  <input
                    type="password"
                    required
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input-field pl-10"
                    minLength={8}
                  />
                </div>
              </div>
            )}


            {mode === 'signup' && (
              <div className="space-y-3">
                <label className="flex items-start gap-2 text-xs text-stone-400">
                  <input type="checkbox" className="mt-0.5" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} />
                  <span>J&apos;accepte les conditions d&apos;utilisation et la politique de confidentialité de Stock Manager AI.</span>
                </label>
                <div>
                  <label className="text-xs text-stone-400">Anti-robot : combien font {captcha.a} + {captcha.b} ?</label>
                  <input
                    type="number"
                    className="input mt-1 w-full"
                    value={captchaAnswer}
                    onChange={(e) => setCaptchaAnswer(e.target.value)}
                    placeholder="Résultat"
                  />
                </div>
              </div>
            )}

            {mode === 'mfa_setup' && setupQr && (
              <div className="space-y-2 text-center">
                <p className="text-xs text-amber-200/90">Scannez ce QR avec Google Authenticator / Authy, puis entrez le code à 6 chiffres.</p>
                <img src={setupQr} alt="QR 2FA" className="mx-auto w-[180px] h-[180px] rounded-lg bg-white p-2" />
                <p className="text-[10px] font-mono text-stone-500 break-all">{setupSecret}</p>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : mode === 'recovery' ? (
                'Enregistrer le nouveau mot de passe'
              ) : mode === 'mfa' || mode === 'mfa_setup' ? (
                'Valider le code 2FA'
              ) : mode === 'forgot' ? (
                <><KeyRound size={18} /> Envoyer le lien</>
              ) : mode === 'signin' ? (
                'Se connecter'
              ) : (
                "S'inscrire"
              )}
            </button>
          </form>
          <div className="mt-6"><BrandFooter /></div>

          {mode === 'forgot' ? (
            <button
              type="button"
              className="mt-4 w-full text-sm text-stone-400 hover:text-stone-200 flex items-center justify-center gap-1"
              onClick={() => {
                setMode('signin');
                setError(null);
                setSuccess(null);
              }}
            >
              <ArrowLeft size={14} /> Retour à la connexion
            </button>
          ) : null}
        </div>
        </div>
      </div>
    </div>
  );
}