import { useEffect, useState } from 'react';
import {
  Users, Plus, Loader2, KeyRound, RefreshCw, Copy, Check, CheckCircle2, Ban, Trash2,
} from 'lucide-react';
import { supabase, SUPABASE_URL, SUPABASE_ANON } from '@/lib/supabase';
import { serverAssertCanAddMember } from '@/lib/paymentRequests';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '@/lib/auth'
import { usePlanAccess } from '@/lib/usePlanAccess';
import type { Member, Role } from '@/lib/types';
import { ROLE_LABELS, ROLE_RANK } from '@/lib/types';
import { Modal, Badge, EmptyState } from '@/components/ui';
import { toAuthEmail, displayLogin, generatePassword, generateLogin } from '@/lib/login';

/** Rôles qu'un manager peut attribuer selon son propre rang */
function assignableRoles(myRole: Role): Role[] {
  const myRank = ROLE_RANK[myRole];
  const all: Role[] = ['owner', 'manager', 'cashier', 'employee'];
  // Ne peut attribuer que des rôles strictement inférieurs
  return all.filter((r) => ROLE_RANK[r] > myRank);
}

export default function TeamPage() {
  const { member } = useAuth();
  const [team, setTeam] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManage =
    member &&
    ['super_admin', 'admin', 'owner', 'manager'].includes(member.role) &&
    member.establishment_id;

  async function load() {
    if (!member?.establishment_id) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('members')
      .select('*')
      .eq('establishment_id', member.establishment_id)
      .order('created_at', { ascending: false });
    // Uniquement le personnel d'équipe (créé par propriétaire / admin / gérant)
    // Pas les super_admin, admin, ni le propriétaire lui-même
    const staffRoles = new Set(['manager', 'cashier', 'employee']);
    const filtered = ((data ?? []) as Member[]).filter(
      (m) => staffRoles.has(m.role) && m.user_id !== member.user_id
    );
    setTeam(filtered);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member?.establishment_id]);

  async function setStatus(m: Member, status: 'active' | 'suspended') {
    await supabase.from('members').update({ status }).eq('id', m.id);
    await load();
  }

  async function toggleEditStock(m: Member) {
    if (!['super_admin', 'admin', 'owner'].includes(member?.role || '')) {
      setError('Seul le propriétaire / admin peut autoriser la modification du stock.');
      return;
    }
    const next = !Boolean(m.can_edit_stock);
    const { error: err } = await supabase
      .from('members')
      .update({ can_edit_stock: next })
      .eq('id', m.id);
    if (err) {
      setError(
        err.message.includes('can_edit_stock')
          ? 'Colonne manquante : exécutez la migration SQL can_edit_stock sur Supabase.'
          : err.message
      );
      return;
    }
    setTeam((prev) => prev.map((x) => (x.id === m.id ? { ...x, can_edit_stock: next } : x)));
  }

  async function changeRole(m: Member, role: Role) {
    if (!member) return;
    if (ROLE_RANK[role] <= ROLE_RANK[member.role]) {
      setError('Vous ne pouvez pas attribuer un rôle égal ou supérieur au vôtre.');
      return;
    }
    const { error: err } = await supabase.from('members').update({ role }).eq('id', m.id);
    if (err) setError(err.message);
    await load();
  }

  async function removeFromEst(m: Member) {
    if (m.role === 'super_admin' || m.user_id === member?.user_id) return;
    await supabase
      .from('members')
      .update({ establishment_id: null, role: 'employee' })
      .eq('id', m.id);
    await supabase
      .from('member_establishments')
      .delete()
      .eq('user_id', m.user_id)
      .eq('establishment_id', member!.establishment_id!);
    await load();
  }

  if (!canManage) {
    return (
      <EmptyState
        icon={<Users size={48} />}
        title="Accès équipe"
        message="Réservé au propriétaire et au gérant de l'établissement."
      />
    );
  }

  if (loading) {
    return <div className="flex justify-center py-20 text-stone-400">Chargement...</div>;
  }

  const roles = assignableRoles(member!.role);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-100 flex items-center gap-2">
            <Users className="text-primary-400" /> Mon équipe
          </h1>
          <p className="text-stone-400 text-sm">
            Uniquement les accès que vous créez (gérant, caissier, employé). Les comptes admin / propriétaire n’apparaissent pas ici.
          </p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Créer un accès
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-error-500/30 bg-error-500/10 px-3 py-2 text-sm text-error-300">
          {error}
          <button className="ml-2 underline" onClick={() => setError(null)}>Fermer</button>
        </div>
      )}

      <div className="card mb-4 p-4 text-sm text-stone-400 space-y-1">
        <p className="font-medium text-stone-200">Hiérarchie des rôles</p>
        <p>1. Super Administrateur → 2. Administrateur → 3. Propriétaire → 4. Gérant → 5. Caissier → 6. Employé</p>
        <p>Vous ({ROLE_LABELS[member!.role]}) pouvez uniquement créer / modifier des rôles <strong className="text-stone-300">inférieurs</strong> au vôtre.</p>
        <p className="mt-1">Cochez <strong className="text-stone-300">Modifier stock</strong> pour autoriser un employé / gérant / caissier à gérer l&apos;inventaire (sinon lecture seule).</p>
      </div>

      {team.length === 0 ? (
        <EmptyState icon={<Users size={48} />} title="Aucun membre" message="Créez un accès pour votre gérant ou un employé." />
      ) : (
        <div className="space-y-2">
          {team.map((m) => (
            <div key={m.id} className="card flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-stone-100 truncate">{m.full_name || displayLogin(m.email)}</p>
                <p className="text-xs text-stone-500 truncate">
                  {displayLogin(m.email)} · {ROLE_LABELS[m.role]} · {m.status}
                </p>
              </div>
              <Badge color={m.status === 'active' ? 'success' : 'warning'}>{m.status}</Badge>
              {['super_admin', 'admin', 'owner'].includes(member!.role) && (
                <label className="flex items-center gap-2 text-xs text-stone-300 border border-stone-700 rounded-xl px-2 py-1.5 cursor-pointer hover:bg-stone-800/60">
                  <input
                    type="checkbox"
                    checked={Boolean(m.can_edit_stock)}
                    onChange={() => void toggleEditStock(m)}
                    className="rounded border-stone-600"
                  />
                  <span>Modifier stock</span>
                </label>
              )}
              {m.user_id !== member!.user_id && ROLE_RANK[m.role] > ROLE_RANK[member!.role] && (
                <div className="flex items-center gap-2">
                  <select
                    className="input-field text-sm py-1.5 w-36"
                    value={m.role}
                    onChange={(e) => changeRole(m, e.target.value as Role)}
                  >
                    {roles.map((r) => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                    {/* garder le rôle actuel s'il n'est pas dans la liste */}
                    {!roles.includes(m.role) && (
                      <option value={m.role}>{ROLE_LABELS[m.role]}</option>
                    )}
                  </select>
                  <button
                    onClick={() => setStatus(m, m.status === 'active' ? 'suspended' : 'active')}
                    className="p-2 rounded-lg hover:bg-stone-800 text-stone-400"
                    title={m.status === 'active' ? 'Suspendre' : 'Activer'}
                  >
                    <Ban size={16} />
                  </button>
                  <button
                    onClick={() => removeFromEst(m)}
                    className="p-2 rounded-lg hover:bg-error-500/10 text-stone-400 hover:text-error-400"
                    title="Retirer de l'établissement"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Créer un accès équipe">
        <TeamAccessForm
          establishmentId={member!.establishment_id!}
          myRole={member!.role}
          onDone={() => {
            setModal(false);
            load();
          }}
        />
      </Modal>
    </div>
  );
}

function TeamAccessForm({
  establishmentId,
  myRole,
  onDone,
}: {
  establishmentId: string;
  myRole: Role;
  onDone: () => void;
}) {
  const roles = assignableRoles(myRole);
  const [login, setLogin] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState(() => generatePassword());
  const [role, setRole] = useState<Role>(roles[0] ?? 'employee');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ login: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit() {
    if (!login.trim() || !password) {
      setError('Identifiant et mot de passe obligatoires');
      return;
    }
    // Limite plan Starter / Pro
    try {
      const { count } = await supabase
        .from('members')
        .select('user_id', { count: 'exact', head: true })
        .eq('establishment_id', establishmentId)
        .neq('role', 'owner');
      const { getEffectivePlan } = await import('@/lib/subscription');
      const { data: estRow } = await supabase
        .from('establishments')
        .select('plan_tier, subscription_status')
        .eq('id', establishmentId)
        .maybeSingle();
      const plan = getEffectivePlan(estRow as any);
      if ((count ?? 0) >= plan.maxEmployees) {
        setError(
          `Limite plan ${plan.label} : ${plan.maxEmployees} employés max. Passez en Pro pour en ajouter.`,
        );
        setLoading(false);
        return;
      }
      if (member?.establishment_id) {
        const srv = await serverAssertCanAddMember(member.establishment_id);
        if (!srv.ok) {
          setError(srv.error || 'Limite employés atteinte');
          setLoading(false);
          return;
        }
      }
    } catch {
      /* continue si table absente */
    }
    if (ROLE_RANK[role] <= ROLE_RANK[myRole]) {
      setError('Rôle non autorisé');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const authEmail = toAuthEmail(login);
      const { data: sessionData } = await supabase.auth.getSession();
      const adminSession = sessionData.session;
      if (!adminSession) {
        setError('Session invalide');
        setLoading(false);
        return;
      }

      // Client éphémère : signUp ne doit JAMAIS remplacer la session du propriétaire
      const ephemeral = createClient(SUPABASE_URL, SUPABASE_ANON, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          storage: {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          },
        },
      });
      const { data, error: signUpError } = await ephemeral.auth.signUp({
        email: authEmail,
        password,
        options: { data: { full_name: fullName, login: login.trim(), role } },
      });
      // Restaurer explicitement la session propriétaire (filet de sécurité)
      await supabase.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token,
      });

      if (signUpError) {
        // Toujours restaurer le propriétaire même en erreur
        await supabase.auth.setSession({
          access_token: adminSession.access_token,
          refresh_token: adminSession.refresh_token,
        });
        setError(
          signUpError.message.includes('already') || signUpError.message.includes('registered')
            ? 'Cet identifiant est déjà utilisé'
            : signUpError.message
        );
        setLoading(false);
        return;
      }

      if (data.user) {
        // Restaurer session propriétaire AVANT RPC (SECURITY DEFINER utilise auth.uid())
        await supabase.auth.setSession({
          access_token: adminSession.access_token,
          refresh_token: adminSession.refresh_token,
        });

        const { data: rpcData, error: rpcError } = await supabase.rpc('assign_team_member', {
          p_user_id: data.user.id,
          p_establishment_id: establishmentId,
          p_role: role,
          p_full_name: fullName || null,
          p_email: authEmail,
        });

        if (rpcError) {
          setError('Compte auth créé mais liaison équipe échouée: ' + rpcError.message);
          setLoading(false);
          return;
        }

        // Vérification lecture
        const { data: verify } = await supabase
          .from('members')
          .select('establishment_id, role')
          .eq('user_id', data.user.id)
          .maybeSingle();
        if (!verify?.establishment_id) {
          setError(
            'Liaison non visible après assignation (RPC: ' +
              JSON.stringify(rpcData) +
              '). Réessayez.'
          );
          setLoading(false);
          return;
        }
      }

      await supabase.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token,
      });

      setCreated({
        login: login.trim().includes('@') ? login.trim() : login.trim().toLowerCase(),
        password,
      });
    } catch (e: any) {
      setError(e?.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  if (created) {
    return (
      <div className="space-y-4">
        <div className="bg-success-500/10 border border-success-500/30 rounded-xl p-4 text-center">
          <CheckCircle2 className="mx-auto text-success-400 mb-2" size={28} />
          <p className="text-success-300 font-semibold">Compte créé</p>
          <p className="text-xs text-stone-400 mt-1">Vous restez connecté en tant que propriétaire. Transmettez ces identifiants à l&apos;employé.</p>
        </div>
        <div className="bg-stone-800 rounded-xl p-4 space-y-2">
          <p className="text-xs text-stone-500">Identifiant</p>
          <p className="font-mono font-bold text-primary-300">{created.login}</p>
          <p className="text-xs text-stone-500">Mot de passe</p>
          <p className="font-mono font-bold text-amber-300">{created.password}</p>
        </div>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(`Identifiant: ${created.login}\nMot de passe: ${created.password}`);
            setCopied(true);
          }}
          className="btn-secondary w-full flex items-center justify-center gap-2"
        >
          {copied ? <><Check size={18} /> Copié</> : <><Copy size={18} /> Copier</>}
        </button>
        <button onClick={onDone} className="btn-primary w-full">Terminé</button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <div className="text-sm text-error-300 bg-error-500/10 border border-error-500/30 rounded-xl p-3">{error}</div>}
      <div>
        <label className="label">Nom complet</label>
        <input className="input-field" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nom du gérant / employé" />
      </div>
      <div>
        <div className="flex justify-between mb-1">
          <label className="label mb-0">Identifiant</label>
          <button
            type="button"
            className="text-xs text-primary-400 flex items-center gap-1"
            onClick={() => {
              setLogin(generateLogin(fullName || role, role));
              setPassword(generatePassword());
            }}
          >
            <RefreshCw size={12} /> Générer
          </button>
        </div>
        <input className="input-field font-mono" value={login} onChange={(e) => setLogin(e.target.value)} placeholder="gerant01" />
      </div>
      <div>
        <label className="label">Mot de passe</label>
        <input className="input-field font-mono" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div>
        <label className="label">Rôle</label>
        <select className="input-field" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {roles.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
      </div>
      <button onClick={submit} disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
        {loading ? <Loader2 className="animate-spin" size={18} /> : <KeyRound size={18} />} Créer le compte
      </button>
    </div>
  );
}
