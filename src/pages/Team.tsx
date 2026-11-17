import { useEffect, useMemo, useState } from 'react';
import {
  Users, Plus, Loader2, KeyRound, RefreshCw, Copy, Check, CheckCircle2, Ban, Trash2,
  ShieldCheck, Store, Lock,
} from 'lucide-react';
import { supabase, SUPABASE_URL, SUPABASE_ANON } from '@/lib/supabase';
import { serverAssertCanAddMember } from '@/lib/paymentRequests';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '@/lib/auth';
import type { EstablishmentPole, Member, Role } from '@/lib/types';
import { ROLE_LABELS, ROLE_RANK } from '@/lib/types';
import { Modal, Badge, EmptyState } from '@/components/ui';
import { toAuthEmail, displayLogin, generatePassword, generateLogin } from '@/lib/login';
import {
  POLE_PRESETS,
  ensureDefaultPoles,
  isOwnerOrAdmin,
  listEstablishmentPoles,
  poleColor,
  poleLabel,
  setMemberPoleAndPin,
} from '@/lib/poles';

/** Rôles qu'un utilisateur peut attribuer selon la hiérarchie stricte Propriétaire -> Manager -> Caissière */
function assignableRoles(myRole: Role): Role[] {
  if (myRole === 'manager') return ['cashier'];
  const myRank = ROLE_RANK[myRole];
  const all: Role[] = ['owner', 'manager', 'cashier', 'employee'];
  return all.filter((r) => ROLE_RANK[r] > myRank);
}

export default function TeamPage() {
  const { member, activeEstablishment } = useAuth();
  const estId = activeEstablishment?.id || member?.establishment_id || '';
  const [team, setTeam] = useState<Member[]>([]);
  const [poles, setPoles] = useState<EstablishmentPole[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [polesModal, setPolesModal] = useState(false);
  const [pinModalMember, setPinModalMember] = useState<Member | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinBusy, setPinBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canManage =
    member &&
    ['super_admin', 'admin', 'owner', 'manager'].includes(member.role) &&
    estId;

  const isOwner = isOwnerOrAdmin(member?.role);

  async function load() {
    if (!estId) {
      setLoading(false);
      return;
    }
    const [{ data }, poleRows] = await Promise.all([
      supabase
        .from('members')
        .select('*')
        .eq('establishment_id', estId)
        .order('created_at', { ascending: false }),
      listEstablishmentPoles(estId),
    ]);
    const staffRoles = new Set(['manager', 'cashier', 'employee']);
    let filtered = ((data ?? []) as Member[]).filter(
      (m) => staffRoles.has(m.role) && m.user_id !== member?.user_id
    );
    // Un manager ne voit que les caissières / employés de son pôle
    if (member?.role === 'manager') {
      filtered = filtered.filter((m) => {
        if (!['cashier', 'employee'].includes(m.role)) return false;
        if (!member.assigned_pole_code) return true;
        return !m.assigned_pole_code || m.assigned_pole_code === member.assigned_pole_code;
      });
    }
    setTeam(filtered);
    setPoles(poleRows);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estId]);

  const managers = useMemo(
    () => team.filter((m) => m.role === 'manager' && m.status === 'active'),
    [team],
  );

  const managerNameMap = useMemo(() => {
    const map = new Map<string, string>();
    if (member?.user_id) {
      map.set(member.user_id, member.full_name || displayLogin(member.email));
    }
    for (const m of team) {
      if (m.role === 'manager') map.set(m.user_id, m.full_name || displayLogin(m.email));
    }
    return map;
  }, [team, member]);

  async function setStatus(m: Member, status: 'active' | 'suspended') {
    await supabase.from('members').update({ status }).eq('id', m.id);
    await load();
  }

  async function toggleEditStock(m: Member) {
    if (!isOwner) {
      setError('Seul le propriétaire / admin peut autoriser la modification du stock.');
      return;
    }
    const next = !Boolean(m.can_edit_stock);
    const { error: err } = await supabase
      .from('members')
      .update({ can_edit_stock: next })
      .eq('id', m.id);
    if (err) {
      setError(err.message);
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

  async function updatePoleOrSupervisor(m: Member, poleCode: string | null, supervisorUserId: string | null) {
    if (!estId) return;
    const res = await setMemberPoleAndPin({
      userId: m.user_id,
      establishmentId: estId,
      poleCode,
      supervisorUserId,
    });
    if (!res.ok) {
      setError(res.error || 'Impossible de mettre à jour le pôle.');
      return;
    }
    setNotice(`Affectation mise à jour pour ${m.full_name || displayLogin(m.email)}.`);
    await load();
  }

  async function savePin() {
    if (!pinModalMember || !estId) return;
    if (pinInput.trim().length < 4) {
      setError('Le code PIN Manager doit comporter au moins 4 chiffres.');
      return;
    }
    setPinBusy(true);
    const res = await setMemberPoleAndPin({
      userId: pinModalMember.user_id,
      establishmentId: estId,
      poleCode: pinModalMember.assigned_pole_code || null,
      supervisorUserId: pinModalMember.supervisor_user_id || null,
      managerPin: pinInput,
    });
    setPinBusy(false);
    if (!res.ok) {
      setError(res.error || 'Échec enregistrement PIN');
      return;
    }
    setNotice(`Code PIN enregistré pour ${pinModalMember.full_name || displayLogin(pinModalMember.email)}.`);
    setPinModalMember(null);
    setPinInput('');
  }

  async function removeFromEst(m: Member) {
    if (m.role === 'super_admin' || m.user_id === member?.user_id) return;
    await supabase
      .from('members')
      .update({ establishment_id: null, role: 'employee', assigned_pole_code: null, supervisor_user_id: null })
      .eq('id', m.id);
    await supabase
      .from('member_establishments')
      .delete()
      .eq('user_id', m.user_id)
      .eq('establishment_id', estId);
    await load();
  }

  if (!canManage) {
    return (
      <EmptyState
        icon={<Users size={48} />}
        title="Accès équipe"
        message="Réservé au propriétaire et au manager de pôle."
      />
    );
  }

  if (loading) {
    return <div className="flex justify-center py-20 text-stone-400">Chargement...</div>;
  }

  const roles = assignableRoles(member!.role);
  const poleOptions = poles.length
    ? poles.map((p) => ({ code: p.code, name: p.name }))
    : POLE_PRESETS.map((p) => ({ code: p.code, name: p.name }));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-100 flex items-center gap-2">
            <Users className="text-primary-400" /> Hiérarchie & Équipe
          </h1>
          <p className="text-stone-400 text-sm">
            Séparation stricte : <strong className="text-stone-200">Propriétaire</strong> →{' '}
            <strong className="text-amber-300">Manager de pôle</strong> →{' '}
            <strong className="text-sky-300">Caissière</strong> (rattachée à sa caisse et à son manager).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isOwner && (
            <button
              type="button"
              onClick={() => setPolesModal(true)}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <Store size={16} /> Caisses / Pôles ({poles.length || 0})
            </button>
          )}
          <button onClick={() => setModal(true)} className="btn-primary flex items-center gap-2">
            <Plus size={18} /> Créer un accès
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-error-500/30 bg-error-500/10 px-3 py-2 text-sm text-error-300">
          {error}
          <button className="ml-2 underline" onClick={() => setError(null)}>Fermer</button>
        </div>
      )}

      {notice && (
        <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {notice}
          <button className="ml-2 underline" onClick={() => setNotice(null)}>OK</button>
        </div>
      )}

      <div className="card mb-4 p-4 text-sm text-stone-400 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium text-stone-200 flex items-center gap-2">
            <ShieldCheck size={16} className="text-amber-400" /> Chaîne de responsabilité terrain
          </p>
          {member?.assigned_pole_code && (
            <span className="text-xs px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-200 border border-amber-500/30">
              Votre pôle : {poleLabel(member.assigned_pole_code)}
            </span>
          )}
        </div>
        <div className="grid sm:grid-cols-3 gap-2 text-xs">
          <div className="rounded-xl border border-stone-800 bg-stone-950/60 p-2.5">
            <p className="font-semibold text-amber-300">1. Propriétaire</p>
            <p className="text-stone-400 mt-0.5">Crée les managers & caissières, active les pôles et consulte tout le complexe.</p>
          </div>
          <div className="rounded-xl border border-stone-800 bg-stone-950/60 p-2.5">
            <p className="font-semibold text-sky-300">2. Manager de pôle</p>
            <p className="text-stone-400 mt-0.5">Supervise sa zone (Bar, Piscine, Resto, Hôtel, Jeux…) et valide par code PIN.</p>
          </div>
          <div className="rounded-xl border border-stone-800 bg-stone-950/60 p-2.5">
            <p className="font-semibold text-emerald-300">3. Caissière</p>
            <p className="text-stone-400 mt-0.5">Caisse nominative verrouillée sur son pôle. Chaque ticket lui est attribué.</p>
          </div>
        </div>
        {isOwner && (
          <div className="pt-1 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPinModalMember(member!)}
              className="text-xs text-amber-300 hover:underline flex items-center gap-1"
            >
              <Lock size={12} /> Définir / modifier mon PIN Propriétaire de secours
            </button>
          </div>
        )}
      </div>

      {team.length === 0 ? (
        <EmptyState
          icon={<Users size={48} />}
          title="Aucun membre"
          message={
            member?.role === 'manager'
              ? 'Créez un accès caissière rattaché à votre pôle.'
              : 'Créez vos managers de pôle puis vos caissières.'
          }
        />
      ) : (
        <div className="space-y-2">
          {team.map((m) => {
            const pColor = poleColor(m.assigned_pole_code);
            const supName = m.supervisor_user_id ? managerNameMap.get(m.supervisor_user_id) : null;
            return (
              <div key={m.id} className="card flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-stone-100 truncate">{m.full_name || displayLogin(m.email)}</p>
                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-md border"
                      style={{
                        borderColor: `${pColor}55`,
                        backgroundColor: `${pColor}1a`,
                        color: pColor,
                      }}
                    >
                      {poleLabel(m.assigned_pole_code)}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 truncate mt-0.5">
                    {displayLogin(m.email)} · {ROLE_LABELS[m.role] || m.role}
                    {supName ? ` · Supervisée par ${supName}` : ''}
                  </p>
                </div>

                <Badge color={m.status === 'active' ? 'success' : 'warning'}>{m.status}</Badge>

                {isOwner && (
                  <select
                    className="input-field text-xs py-1.5 w-40"
                    value={m.assigned_pole_code || ''}
                    onChange={(e) =>
                      void updatePoleOrSupervisor(m, e.target.value || null, m.supervisor_user_id || null)
                    }
                    title="Pôle / Caisse assignée"
                  >
                    <option value="">Tous pôles / Général</option>
                    {poleOptions.map((p) => (
                      <option key={p.code} value={p.code}>{p.name}</option>
                    ))}
                  </select>
                )}

                {isOwner && m.role === 'cashier' && managers.length > 0 && (
                  <select
                    className="input-field text-xs py-1.5 w-40"
                    value={m.supervisor_user_id || ''}
                    onChange={(e) =>
                      void updatePoleOrSupervisor(m, m.assigned_pole_code || null, e.target.value || null)
                    }
                    title="Manager superviseur"
                  >
                    <option value="">Manager : Propriétaire</option>
                    {managers.map((mgr) => (
                      <option key={mgr.user_id} value={mgr.user_id}>
                        Mgr: {mgr.full_name || displayLogin(mgr.email)}
                      </option>
                    ))}
                  </select>
                )}

                {isOwner && m.role === 'manager' && (
                  <button
                    type="button"
                    onClick={() => {
                      setPinInput('');
                      setPinModalMember(m);
                    }}
                    className="text-xs px-2.5 py-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 flex items-center gap-1"
                  >
                    <Lock size={12} /> PIN Manager
                  </button>
                )}

                {isOwner && (
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
                      disabled={member?.role === 'manager'}
                    >
                      {roles.map((r) => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
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
                    {isOwner && (
                      <button
                        onClick={() => removeFromEst(m)}
                        className="p-2 rounded-lg hover:bg-error-500/10 text-stone-400 hover:text-error-400"
                        title="Retirer de l'établissement"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Créer un accès équipe">
        <TeamAccessForm
          establishmentId={estId}
          myUserId={member!.user_id}
          myRole={member!.role}
          myPoleCode={member?.assigned_pole_code || null}
          poles={poleOptions}
          managers={managers}
          onDone={() => {
            setModal(false);
            void load();
          }}
        />
      </Modal>

      <Modal open={polesModal} onClose={() => setPolesModal(false)} title="Caisses & pôles de l’établissement">
        <PolesConfigModal
          establishmentId={estId}
          existingPoles={poles}
          onSaved={() => {
            setPolesModal(false);
            void load();
          }}
        />
      </Modal>

      <Modal
        open={Boolean(pinModalMember)}
        onClose={() => !pinBusy && setPinModalMember(null)}
        title={`Code PIN Manager · ${pinModalMember?.full_name || displayLogin(pinModalMember?.email)}`}
      >
        <div className="space-y-3">
          <p className="text-xs text-stone-400">
            Ce code PIN à 4-6 chiffres permet au manager de valider les remises ou écarts de caisse directement sur le poste de la caissière.
          </p>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            className="input-field font-mono text-center text-lg tracking-[0.35em]"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value.replace(/[^\d]/g, ''))}
            placeholder="Ex: 2468"
          />
          <button
            type="button"
            disabled={pinBusy || pinInput.length < 4}
            onClick={() => void savePin()}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {pinBusy ? <Loader2 className="animate-spin" size={16} /> : <Lock size={16} />}
            Enregistrer le PIN
          </button>
        </div>
      </Modal>
    </div>
  );
}

function PolesConfigModal({
  establishmentId,
  existingPoles,
  onSaved,
}: {
  establishmentId: string;
  existingPoles: EstablishmentPole[];
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState<string[]>(() =>
    existingPoles.length
      ? existingPoles.map((p) => p.code)
      : ['maquis', 'bar', 'restaurant', 'piscine', 'hotel', 'jeux'],
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!selected.length) {
      setErr('Sélectionnez au moins un pôle / une caisse.');
      return;
    }
    setSaving(true);
    setErr(null);
    const res = await ensureDefaultPoles(establishmentId, selected);
    if (!res.ok) {
      setErr(res.error || 'Erreur enregistrement des pôles');
      setSaving(false);
      return;
    }
    // Désactiver les pôles décochés
    for (const p of POLE_PRESETS) {
      if (!selected.includes(p.code)) {
        await supabase
          .from('establishment_poles')
          .update({ is_active: false })
          .eq('establishment_id', establishmentId)
          .eq('code', p.code);
      }
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-stone-400">
        Activez tous les espaces de votre établissement. Chaque espace aura sa propre caisse reliée au même établissement.
      </p>
      {err && <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl p-2">{err}</div>}
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {POLE_PRESETS.map((p) => {
          const checked = selected.includes(p.code);
          return (
            <label
              key={p.code}
              className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 cursor-pointer ${
                checked ? 'border-amber-500/60 bg-amber-500/10' : 'border-stone-800 bg-stone-900'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() =>
                  setSelected((prev) =>
                    checked ? prev.filter((c) => c !== p.code) : [...prev, p.code],
                  )
                }
                className="mt-1 accent-amber-500"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-stone-100 flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                  {p.name}
                </p>
                <p className="text-[11px] text-stone-400">{p.description}</p>
              </div>
            </label>
          );
        })}
      </div>
      <button type="button" disabled={saving} onClick={() => void save()} className="btn-primary w-full">
        {saving ? 'Activation…' : 'Enregistrer les caisses / pôles'}
      </button>
    </div>
  );
}

function TeamAccessForm({
  establishmentId,
  myUserId,
  myRole,
  myPoleCode,
  poles,
  managers,
  onDone,
}: {
  establishmentId: string;
  myUserId: string;
  myRole: Role;
  myPoleCode: string | null;
  poles: { code: string; name: string }[];
  managers: Member[];
  onDone: () => void;
}) {
  const roles = assignableRoles(myRole);
  const [login, setLogin] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState(() => generatePassword());
  const [role, setRole] = useState<Role>(roles.includes('cashier') && myRole === 'manager' ? 'cashier' : roles[0] ?? 'cashier');
  const [poleCode, setPoleCode] = useState<string>(myPoleCode || (poles[0]?.code ?? ''));
  const [supervisorId, setSupervisorId] = useState<string>(myRole === 'manager' ? myUserId : '');
  const [managerPin, setManagerPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ login: string; password: string; role: Role; pole: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit() {
    if (!login.trim() || !password) {
      setError('Identifiant et mot de passe obligatoires');
      return;
    }
    if (role === 'manager' && managerPin.trim() && managerPin.trim().length < 4) {
      setError('Le PIN Manager doit faire au moins 4 chiffres (ou laissez vide).');
      return;
    }

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
      const srv = await serverAssertCanAddMember(establishmentId);
      if (!srv.ok) {
        setError(srv.error || 'Limite employés atteinte');
        setLoading(false);
        return;
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
      await supabase.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token,
      });

      if (signUpError) {
        setError(
          signUpError.message.includes('already') || signUpError.message.includes('registered')
            ? 'Cet identifiant est déjà utilisé'
            : signUpError.message
        );
        setLoading(false);
        return;
      }

      if (data.user) {
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

        // Affecter le pôle, le superviseur et le PIN manager si renseignés
        await setMemberPoleAndPin({
          userId: data.user.id,
          establishmentId,
          poleCode: poleCode || null,
          supervisorUserId: role === 'cashier' ? (supervisorId || null) : null,
          managerPin: role === 'manager' ? managerPin : null,
        });
      }

      await supabase.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token,
      });

      setCreated({
        login: login.trim().includes('@') ? login.trim() : login.trim().toLowerCase(),
        password,
        role,
        pole: poleLabel(poleCode || null),
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
          <p className="text-success-300 font-semibold">Compte créé ({ROLE_LABELS[created.role]})</p>
          <p className="text-xs text-stone-400 mt-1">
            Pôle affecté : <strong className="text-stone-200">{created.pole}</strong>. Transmettez ces identifiants.
          </p>
        </div>
        <div className="bg-stone-800 rounded-xl p-4 space-y-2">
          <p className="text-xs text-stone-500">Identifiant</p>
          <p className="font-mono font-bold text-primary-300">{created.login}</p>
          <p className="text-xs text-stone-500">Mot de passe</p>
          <p className="font-mono font-bold text-amber-300">{created.password}</p>
        </div>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(
              `Rôle: ${ROLE_LABELS[created.role]}\nPôle: ${created.pole}\nIdentifiant: ${created.login}\nMot de passe: ${created.password}`
            );
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
        <input className="input-field" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ex: Awa Koné" />
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
        <input className="input-field font-mono" value={login} onChange={(e) => setLogin(e.target.value)} placeholder="caisse_piscine01" />
      </div>
      <div>
        <label className="label">Mot de passe</label>
        <input className="input-field font-mono" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div>
        <label className="label">Rôle hiérarchique</label>
        <select
          className="input-field"
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          disabled={myRole === 'manager'}
        >
          {roles.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Pôle / Caisse assignée</label>
        <select
          className="input-field"
          value={poleCode}
          onChange={(e) => setPoleCode(e.target.value)}
          disabled={Boolean(myRole === 'manager' && myPoleCode)}
        >
          {!(myRole === 'manager' && myPoleCode) && <option value="">Tous pôles / Général</option>}
          {poles.map((p) => (
            <option key={p.code} value={p.code}>{p.name}</option>
          ))}
        </select>
      </div>
      {role === 'cashier' && myRole !== 'manager' && managers.length > 0 && (
        <div>
          <label className="label">Manager superviseur</label>
          <select className="input-field" value={supervisorId} onChange={(e) => setSupervisorId(e.target.value)}>
            <option value="">Supervisée directement par le Propriétaire</option>
            {managers.map((mgr) => (
              <option key={mgr.user_id} value={mgr.user_id}>
                {mgr.full_name || displayLogin(mgr.email)} ({poleLabel(mgr.assigned_pole_code)})
              </option>
            ))}
          </select>
        </div>
      )}
      {role === 'manager' && (
        <div>
          <label className="label">Code PIN Manager (4-6 chiffres)</label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            className="input-field font-mono"
            value={managerPin}
            onChange={(e) => setManagerPin(e.target.value.replace(/[^\d]/g, ''))}
            placeholder="Ex: 2468 (valide les remises/écarts)"
          />
        </div>
      )}
      <button onClick={submit} disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
        {loading ? <Loader2 className="animate-spin" size={18} /> : <KeyRound size={18} />} Créer le compte
      </button>
    </div>
  );
}
