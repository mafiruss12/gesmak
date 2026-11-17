import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  KeyRound,
  Users,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  Power,
  Wallet,
  Package,
  Crown,
  ClipboardCheck,
  Calculator,
  ShoppingCart,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useServiceDay } from '@/lib/ServiceDayContext';
import {
  POLE_PRESETS,
  ensureDefaultPoles,
  isCashierOnly,
  isOwnerOrAdmin,
  isPoleManager,
  listEstablishmentPoles,
  poleColor,
  poleLabel,
  resolveLockedPole,
  setMemberPoleAndPin,
  verifyManagerPin,
} from '@/lib/poles';
import { ROLE_LABELS, type EstablishmentPole, type Member, type Role } from '@/lib/types';

interface CashSessionMini {
  id: string;
  session_date: string;
  status: string;
  opened_at: string;
  opening_float: number;
  pole_code: string | null;
  cashier_name: string | null;
}

interface AuditEntry {
  id: string;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_label: string | null;
  reason: string | null;
  created_at: string;
}

const PERMISSION_MATRIX: {
  rule: string;
  owner: string;
  manager: string;
  cashier: string;
}[] = [
  {
    rule: 'Périmètre des pôles',
    owner: 'Tous les pôles + multi-établissements',
    manager: 'Limité à son pôle affecté',
    cashier: 'Verrouillé sur sa caisse / pôle nominal',
  },
  {
    rule: 'Création pôles & gestion rôles',
    owner: 'Complet (créer pôles, nommer managers/caissières)',
    manager: 'Affecte les caissières dans son propre pôle',
    cashier: 'Aucun accès administration',
  },
  {
    rule: 'Code PIN Manager',
    owner: 'Définit / réinitialise le PIN de tout manager',
    manager: 'Définit son PIN personnel et valide sur le terrain',
    cashier: 'Saisit le PIN du manager pour débloquer une exception',
  },
  {
    rule: 'Gestion du stock (Inventaire)',
    owner: 'Lecture & écriture complètes',
    manager: 'Lecture & écriture autorisées',
    cashier: 'Verrouillé par défaut (modifiable via can_edit_stock)',
  },
  {
    rule: 'Remises & annulations caisse',
    owner: 'Direct sans restriction',
    manager: 'Direct sur son pôle + validation par PIN',
    cashier: 'Autorisation par Code PIN Manager requise',
  },
  {
    rule: 'Ouverture / Clôture journée & Clôture Z',
    owner: 'Ouvre/clôture tout pôle sans blocage',
    manager: 'Ouvre/clôture son pôle et valide les écarts',
    cashier: 'Ouvre sa session · Clôture avec écart soumise à PIN',
  },
  {
    rule: 'Comptabilité, marges & achats',
    owner: 'Accès total (CA, bénéfices, fournisseurs)',
    manager: 'Dépenses & suivi opérationnel du pôle uniquement',
    cashier: 'Masqué (confidentialité financière)',
  },
];

function formatFcfa(v: number): string {
  return `${Math.round(v).toLocaleString('fr-FR')} F`;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function PouvoirsRoles() {
  const { member, activeEstablishment, effectiveRole, viewAsRole, setViewAsRole, user } = useAuth();
  const serviceDay = useServiceDay();

  const estId = activeEstablishment?.id || member?.establishment_id || '';
  const realRole = member?.role || 'cashier';
  const activeRole = (effectiveRole || realRole) as Role;
  const realIsOwner = isOwnerOrAdmin(realRole);

  const actAsOwner = isOwnerOrAdmin(activeRole);
  const actAsManager = isPoleManager(activeRole);
  const actAsCashier = isCashierOnly(activeRole);
  const lockedPole = resolveLockedPole(member, activeRole);

  const [poles, setPoles] = useState<EstablishmentPole[]>([]);
  const [team, setTeam] = useState<Member[]>([]);
  const [sessions, setSessions] = useState<CashSessionMini[]>([]);
  const [audits, setAudits] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Pole activation state
  const [selectedPresetCodes, setSelectedPresetCodes] = useState<string[]>([
    'maquis',
    'bar',
    'restaurant',
  ]);

  // Member configuration form
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<Role>('cashier');
  const [editPole, setEditPole] = useState<string>('');
  const [editSupervisorId, setEditSupervisorId] = useState<string>('');
  const [editPin, setEditPin] = useState<string>('');

  // Manager self-PIN form
  const [selfPin, setSelfPin] = useState('');

  // PIN Validation execution form
  const [pinAction, setPinAction] = useState<'pos.discount' | 'cloture.z' | 'pos.approval'>('pos.discount');
  const [pinPole, setPinPole] = useState<string>(lockedPole || '');
  const [pinReason, setPinReason] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [lastPinApproval, setLastPinApproval] = useState<string | null>(null);

  // Cash session open form
  const [openingFloat, setOpeningFloat] = useState('0');
  const [sessionPole, setSessionPole] = useState<string>(lockedPole || '');

  const loadAll = useCallback(async () => {
    if (!estId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const [poleRows, teamRes, sessRes, auditRes] = await Promise.all([
        listEstablishmentPoles(estId),
        supabase
          .from('members')
          .select('*')
          .eq('establishment_id', estId)
          .order('created_at', { ascending: true }),
        supabase
          .from('cash_sessions')
          .select('id, session_date, status, opened_at, opening_float, pole_code, cashier_name')
          .eq('establishment_id', estId)
          .eq('session_date', today)
          .order('opened_at', { ascending: false })
          .limit(12),
        actAsOwner || actAsManager
          ? supabase
              .from('operation_audit')
              .select('id, actor_name, action, entity_type, entity_label, reason, created_at')
              .eq('establishment_id', estId)
              .order('created_at', { ascending: false })
              .limit(12)
          : Promise.resolve({ data: [] as AuditEntry[] }),
      ]);

      setPoles(poleRows);
      if (poleRows.length > 0) {
        setSelectedPresetCodes(poleRows.map((p) => p.code));
      }
      setTeam(((teamRes.data as Member[]) || []).filter(Boolean));
      setSessions(((sessRes.data as CashSessionMini[]) || []).filter(Boolean));
      setAudits(((auditRes as { data?: AuditEntry[] }).data || []).filter(Boolean));
    } finally {
      setLoading(false);
    }
  }, [estId, actAsOwner, actAsManager]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (lockedPole) {
      setPinPole(lockedPole);
      setSessionPole(lockedPole);
    }
  }, [lockedPole]);

  const supervisorName = useMemo(() => {
    if (!member?.supervisor_user_id) return null;
    const found = team.find((m) => m.user_id === member.supervisor_user_id);
    return found?.full_name || found?.email || member.supervisor_user_id.slice(0, 8);
  }, [member?.supervisor_user_id, team]);

  const managersAndOwners = useMemo(
    () =>
      team.filter(
        (m) =>
          m.status === 'active' &&
          (isOwnerOrAdmin(m.role) || isPoleManager(m.role)),
      ),
    [team],
  );

  const manageableTeam = useMemo(() => {
    if (actAsOwner) return team.filter((m) => m.user_id !== member?.user_id);
    if (actAsManager) {
      return team.filter(
        (m) =>
          m.user_id !== member?.user_id &&
          isCashierOnly(m.role) &&
          (!lockedPole || !m.assigned_pole_code || m.assigned_pole_code === lockedPole),
      );
    }
    return [];
  }, [team, actAsOwner, actAsManager, member?.user_id, lockedPole]);

  const visibleSessions = useMemo(() => {
    if (!lockedPole) return sessions;
    return sessions.filter((s) => !s.pole_code || s.pole_code === lockedPole);
  }, [sessions, lockedPole]);

  function openMemberEditor(target: Member) {
    setEditingMemberId(target.id);
    setEditRole(target.role);
    setEditPole(target.assigned_pole_code || (actAsManager && lockedPole ? lockedPole : ''));
    setEditSupervisorId(target.supervisor_user_id || '');
    setEditPin('');
    setFeedback(null);
  }

  async function handleSavePoles() {
    if (!estId || selectedPresetCodes.length === 0) return;
    setBusy(true);
    setFeedback(null);
    const res = await ensureDefaultPoles(estId, selectedPresetCodes);
    setBusy(false);
    if (res.ok) {
      setFeedback({ kind: 'ok', text: `${selectedPresetCodes.length} pôle(s) activé(s) sur l'établissement.` });
      await loadAll();
    } else {
      setFeedback({ kind: 'err', text: res.error || 'Impossible d’activer les pôles.' });
    }
  }

  async function handleSaveMemberConfig(target: Member) {
    if (!estId) return;
    setBusy(true);
    setFeedback(null);
    try {
      if (actAsOwner && editRole !== target.role) {
        const { error: rErr } = await supabase
          .from('members')
          .update({ role: editRole })
          .eq('id', target.id);
        if (rErr) throw new Error(rErr.message);

        await supabase
          .from('member_establishments')
          .update({ role: editRole })
          .eq('user_id', target.user_id)
          .eq('establishment_id', estId);
      }

      const poleToSave = actAsManager && lockedPole ? lockedPole : editPole || null;
      const rpcRes = await setMemberPoleAndPin({
        userId: target.user_id,
        establishmentId: estId,
        poleCode: poleToSave,
        supervisorUserId: editSupervisorId || (actAsManager ? member?.user_id : null),
        managerPin: editPin.trim().length >= 4 ? editPin.trim() : null,
      });
      if (!rpcRes.ok) throw new Error(rpcRes.error || 'Mise à jour pôle/PIN refusée.');

      setEditingMemberId(null);
      setEditPin('');
      setFeedback({
        kind: 'ok',
        text: `Pouvoirs mis à jour pour ${target.full_name || target.email}.`,
      });
      await loadAll();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur mise à jour membre.';
      setFeedback({ kind: 'err', text: msg });
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleStockEdit(target: Member) {
    if (!actAsOwner) return;
    setBusy(true);
    setFeedback(null);
    const next = !target.can_edit_stock;
    const { error } = await supabase
      .from('members')
      .update({ can_edit_stock: next })
      .eq('id', target.id);
    setBusy(false);
    if (error) {
      setFeedback({ kind: 'err', text: error.message });
    } else {
      setFeedback({
        kind: 'ok',
        text: `Droit stock ${next ? 'accordé' : 'retiré'} pour ${target.full_name || target.email}.`,
      });
      await loadAll();
    }
  }

  async function handleToggleStatus(target: Member) {
    if (!actAsOwner && !(actAsManager && isCashierOnly(target.role))) return;
    setBusy(true);
    setFeedback(null);
    const nextStatus = target.status === 'active' ? 'suspended' : 'active';
    const { error } = await supabase
      .from('members')
      .update({ status: nextStatus })
      .eq('id', target.id);
    setBusy(false);
    if (error) {
      setFeedback({ kind: 'err', text: error.message });
    } else {
      setFeedback({
        kind: 'ok',
        text: `${target.full_name || target.email} : statut passé à « ${nextStatus === 'active' ? 'Actif' : 'Suspendu'} ».`,
      });
      await loadAll();
    }
  }

  async function handleSaveSelfPin(e: React.FormEvent) {
    e.preventDefault();
    if (!estId || !member?.user_id) return;
    if (selfPin.trim().length < 4) {
      setFeedback({ kind: 'err', text: 'Le code PIN doit contenir au moins 4 chiffres.' });
      return;
    }
    setBusy(true);
    setFeedback(null);
    const res = await setMemberPoleAndPin({
      userId: member.user_id,
      establishmentId: estId,
      poleCode: lockedPole || member.assigned_pole_code || null,
      managerPin: selfPin.trim(),
    });
    setBusy(false);
    if (res.ok) {
      setSelfPin('');
      setFeedback({ kind: 'ok', text: 'Votre code PIN Manager personnel est enregistré.' });
      await loadAll();
    } else {
      setFeedback({ kind: 'err', text: res.error || 'Enregistrement du PIN refusé.' });
    }
  }

  async function handleVerifyPin(e: React.FormEvent) {
    e.preventDefault();
    if (!estId) return;
    if (pinCode.trim().length < 4) {
      setFeedback({ kind: 'err', text: 'Saisissez un code PIN valide (4 chiffres minimum).' });
      return;
    }
    setBusy(true);
    setFeedback(null);
    setLastPinApproval(null);
    const res = await verifyManagerPin({
      establishmentId: estId,
      poleCode: lockedPole || pinPole || null,
      pin: pinCode.trim(),
      action: pinAction,
      reason: pinReason.trim() || `Validation depuis Rôles & Pouvoirs (${pinAction})`,
    });
    setBusy(false);
    if (res.ok) {
      const msg = `Autorisé par ${res.approved_by_name || 'Superviseur'} (${ROLE_LABELS[(res.approved_by_role as Role) || 'manager'] || res.approved_by_role || 'Manager'})`;
      setLastPinApproval(msg);
      setPinCode('');
      setPinReason('');
      setFeedback({ kind: 'ok', text: `${msg} · Événement journalisé.` });
      await loadAll();
    } else {
      setFeedback({ kind: 'err', text: res.error || 'Code PIN incorrect pour ce pôle.' });
    }
  }

  async function handleOpenCashSession(e: React.FormEvent) {
    e.preventDefault();
    if (!estId || !user?.id) return;
    const floatVal = Math.max(0, Number(openingFloat) || 0);
    const today = new Date().toISOString().split('T')[0];
    setBusy(true);
    setFeedback(null);
    const { error } = await supabase.from('cash_sessions').insert({
      establishment_id: estId,
      session_date: today,
      status: 'open',
      opened_at: new Date().toISOString(),
      opened_by: member?.user_id || user.id,
      opening_float: floatVal,
      pole_code: lockedPole || sessionPole || null,
      cashier_name: member?.full_name || member?.email || 'Équipe',
    });
    setBusy(false);
    if (error) {
      setFeedback({ kind: 'err', text: error.message });
    } else {
      setFeedback({
        kind: 'ok',
        text: `Session de caisse ouverte (${poleLabel(lockedPole || sessionPole)}) avec fond initial ${formatFcfa(floatVal)}.`,
      });
      await loadAll();
    }
  }

  const canModifyStock = actAsOwner || actAsManager || Boolean(member?.can_edit_stock);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-stone-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-amber-400">
            <ShieldCheck size={15} />
            <span>Gouvernance & Habilitations</span>
          </div>
          <h1 className="text-2xl font-bold font-display text-stone-100 mt-1">
            Rôles & Pouvoirs
          </h1>
          <p className="text-sm text-stone-400 mt-0.5">
            {activeEstablishment?.name || 'Établissement'} · Profil actif :{' '}
            <strong className="text-stone-200">{ROLE_LABELS[activeRole]}</strong>
            {lockedPole ? ` · Pôle ${poleLabel(lockedPole)}` : ' · Tous pôles'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {realIsOwner && (
            <div className="inline-flex rounded-xl border border-stone-700 bg-stone-900 p-1">
              {(
                [
                  { id: null, label: 'Propriétaire' },
                  { id: 'manager', label: 'Manager' },
                  { id: 'cashier', label: 'Caissière' },
                ] as const
              ).map((opt) => {
                const active = (viewAsRole || null) === opt.id;
                return (
                  <button
                    key={String(opt.id)}
                    type="button"
                    onClick={() => setViewAsRole(opt.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-amber-500 text-stone-950'
                        : 'text-stone-300 hover:bg-stone-800'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={() => void loadAll()}
            disabled={loading || busy}
            className="inline-flex items-center gap-2 rounded-xl border border-stone-700 bg-stone-900 px-3.5 py-2 text-xs font-semibold text-stone-200 hover:bg-stone-800 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Actualiser
          </button>
        </div>
      </div>

      {viewAsRole && realIsOwner && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          <div className="flex items-center gap-2 text-amber-200">
            <AlertTriangle size={16} className="shrink-0" />
            <span>
              Mode simulation actif : vous utilisez actuellement les pouvoirs du rôle{' '}
              <strong>{ROLE_LABELS[viewAsRole]}</strong>.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setViewAsRole(null)}
            className="text-xs font-semibold text-amber-300 hover:underline shrink-0 text-left sm:text-right"
          >
            Revenir au rôle Propriétaire
          </button>
        </div>
      )}

      {feedback && (
        <div
          className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm ${
            feedback.kind === 'ok'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
              : 'border-red-500/40 bg-red-500/10 text-red-200'
          }`}
        >
          {feedback.kind === 'ok' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* 4 métriques d'état */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-stone-800 bg-stone-900 p-4">
          <p className="text-xs text-stone-400">Niveau d&apos;autorité</p>
          <p className="text-lg font-bold text-stone-100 mt-1">{ROLE_LABELS[activeRole]}</p>
          <p className="text-xs text-stone-400 mt-1">
            {actAsOwner ? 'Sommet hiérarchique' : actAsManager ? 'Supervision de pôle' : 'Exécution caisse'}
          </p>
        </div>

        <div className="rounded-xl border border-stone-800 bg-stone-900 p-4">
          <p className="text-xs text-stone-400">Périmètre pôle</p>
          <p className="text-lg font-bold text-stone-100 mt-1">
            {lockedPole ? poleLabel(lockedPole) : `Tous (${poles.length})`}
          </p>
          <p className="text-xs text-stone-400 mt-1">
            {lockedPole ? 'Verrouillé sur ce pôle' : 'Bascule multi-pôles ouverte'}
          </p>
        </div>

        <div className="rounded-xl border border-stone-800 bg-stone-900 p-4">
          <p className="text-xs text-stone-400">Droit stock & superviseur</p>
          <p className="text-lg font-bold text-stone-100 mt-1">
            {canModifyStock ? 'Stock modifiable' : 'Stock verrouillé'}
          </p>
          <p className="text-xs text-stone-400 mt-1 truncate">
            {supervisorName ? `Superviseur : ${supervisorName}` : 'Superviseur : Établissement'}
          </p>
        </div>

        <div className="rounded-xl border border-stone-800 bg-stone-900 p-4">
          <p className="text-xs text-stone-400">Journée d&apos;exploitation</p>
          <p
            className={`text-lg font-bold mt-1 ${
              serviceDay.isOpen ? 'text-emerald-400' : 'text-stone-300'
            }`}
          >
            {serviceDay.isOpen ? 'Ouverte' : 'Fermée'}
          </p>
          <p className="text-xs text-stone-400 mt-1 tabular-nums">
            {visibleSessions.filter((s) => s.status === 'open').length} session(s) caisse ouverte(s)
          </p>
        </div>
      </div>

      {/* BLOC 1 : Exécution directe Exploitation & Caisse */}
      <section className="rounded-2xl border border-stone-800 bg-stone-900 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-stone-100 flex items-center gap-2">
              <Power size={17} className="text-amber-400" />
              Exercer mes pouvoirs opérationnels
            </h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Ouvrir ou fermer la journée d&apos;exploitation, démarrer une session caisse ou accéder directement aux modules autorisés.
            </p>
          </div>

          {(actAsOwner || actAsManager) && (
            <button
              type="button"
              disabled={serviceDay.busy}
              onClick={() => (serviceDay.isOpen ? void serviceDay.close() : void serviceDay.open())}
              className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                serviceDay.isOpen
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              <Power size={15} />
              {serviceDay.isOpen ? 'Fermer la journée' : 'Ouvrir la journée'}
            </button>
          )}
        </div>

        {/* Ouverture rapide d'une session de caisse */}
        <form
          onSubmit={handleOpenCashSession}
          className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end border-t border-stone-800 pt-4"
        >
          <div>
            <label className="label text-xs">Pôle de la caisse</label>
            <select
              className="input-field text-sm"
              disabled={Boolean(lockedPole)}
              value={lockedPole || sessionPole}
              onChange={(e) => setSessionPole(e.target.value)}
            >
              {!lockedPole && <option value="">Général / Établissement</option>}
              {poles.map((p) => (
                <option key={p.id} value={p.code}>
                  {p.name}
                </option>
              ))}
              {lockedPole && !poles.some((p) => p.code === lockedPole) && (
                <option value={lockedPole}>{poleLabel(lockedPole)}</option>
              )}
            </select>
          </div>

          <div>
            <label className="label text-xs">Fond de caisse initial (FCFA)</label>
            <input
              type="number"
              min="0"
              step="500"
              value={openingFloat}
              onChange={(e) => setOpeningFloat(e.target.value)}
              className="input-field text-sm font-mono tabular-nums"
              placeholder="0"
            />
          </div>

          <button
            type="submit"
            disabled={busy || !estId}
            className="btn-primary text-sm inline-flex items-center justify-center gap-2"
          >
            <Wallet size={15} />
            Ouvrir une session caisse
          </button>
        </form>

        {visibleSessions.length > 0 && (
          <div className="border-t border-stone-800 pt-3">
            <p className="text-xs font-semibold text-stone-400 mb-2">
              Sessions du jour ({visibleSessions.length})
            </p>
            <div className="divide-y divide-stone-800 rounded-xl border border-stone-800">
              {visibleSessions.slice(0, 5).map((s) => (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-stone-200">
                      {s.cashier_name || 'Caisse'}
                    </span>
                    <span className="text-stone-400">·</span>
                    <span className="text-stone-300">{poleLabel(s.pole_code)}</span>
                  </div>
                  <div className="flex items-center gap-3 font-mono tabular-nums">
                    <span className="text-stone-400">Fond : {formatFcfa(s.opening_float || 0)}</span>
                    <span
                      className={
                        s.status === 'open' ? 'text-emerald-400 font-semibold' : 'text-stone-400'
                      }
                    >
                      {s.status === 'open' ? 'Ouverte' : 'Clôturée'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Liens directs exécutables selon rôle */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
          <Link
            to="/daily-report"
            className="flex items-center justify-between rounded-xl border border-stone-800 bg-stone-950/60 px-3 py-2.5 text-sm font-medium text-stone-200 hover:border-amber-500/50"
          >
            <span className="flex items-center gap-2">
              <ShoppingCart size={15} className="text-amber-400" />
              Ma Caisse
            </span>
            <ArrowRight size={14} className="text-stone-500" />
          </Link>

          <Link
            to="/cloture"
            className="flex items-center justify-between rounded-xl border border-stone-800 bg-stone-950/60 px-3 py-2.5 text-sm font-medium text-stone-200 hover:border-amber-500/50"
          >
            <span className="flex items-center gap-2">
              <ClipboardCheck size={15} className="text-emerald-400" />
              Clôture Z
            </span>
            <ArrowRight size={14} className="text-stone-500" />
          </Link>

          {canModifyStock ? (
            <Link
              to="/inventory"
              className="flex items-center justify-between rounded-xl border border-stone-800 bg-stone-950/60 px-3 py-2.5 text-sm font-medium text-stone-200 hover:border-amber-500/50"
            >
              <span className="flex items-center gap-2">
                <Package size={15} className="text-sky-400" />
                Gérer le stock
              </span>
              <ArrowRight size={14} className="text-stone-500" />
            </Link>
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-stone-800 bg-stone-950/30 px-3 py-2.5 text-sm text-stone-500">
              <span className="flex items-center gap-2">
                <Lock size={15} />
                Stock verrouillé
              </span>
            </div>
          )}

          {actAsOwner ? (
            <Link
              to="/accounting"
              className="flex items-center justify-between rounded-xl border border-stone-800 bg-stone-950/60 px-3 py-2.5 text-sm font-medium text-stone-200 hover:border-amber-500/50"
            >
              <span className="flex items-center gap-2">
                <Calculator size={15} className="text-amber-400" />
                Comptabilité
              </span>
              <ArrowRight size={14} className="text-stone-500" />
            </Link>
          ) : (
            <Link
              to="/orders"
              className="flex items-center justify-between rounded-xl border border-stone-800 bg-stone-950/60 px-3 py-2.5 text-sm font-medium text-stone-200 hover:border-amber-500/50"
            >
              <span className="flex items-center gap-2">
                <Crown size={15} className="text-sky-400" />
                Commandes
              </span>
              <ArrowRight size={14} className="text-stone-500" />
            </Link>
          )}
        </div>
      </section>

      {/* BLOC 2 : Activation Pôles & Gestion Hiérarchique (Owner + Manager) */}
      {(actAsOwner || actAsManager) && (
        <section className="rounded-2xl border border-stone-800 bg-stone-900 p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-stone-100 flex items-center gap-2">
                <Users size={17} className="text-amber-400" />
                {actAsOwner
                  ? 'Pouvoirs du Propriétaire : Pôles, Rôles, PINs & Droits Stock'
                  : 'Pouvoirs du Manager : Caissières du pôle & Code PIN personnel'}
              </h2>
              <p className="text-xs text-stone-400 mt-0.5">
                {actAsOwner
                  ? 'Configurez les pôles actifs, attribuez les rôles Manager/Caissière, définissez les PINs de validation et ouvrez ou verrouillez l’accès au stock.'
                  : 'Mettez à jour votre code PIN de supervision terrain et affectez les caissières rattachées à votre pôle.'}
              </p>
            </div>
            {actAsOwner && (
              <Link
                to="/patron"
                className="text-xs font-semibold text-amber-400 hover:underline shrink-0"
              >
                Ouvrir Mode Patron →
              </Link>
            )}
          </div>

          {/* Initialisation des pôles */}
          {actAsOwner && (
            <div className="rounded-xl border border-stone-800 bg-stone-950/50 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <p className="text-sm font-semibold text-stone-200">
                  Pôles / Caisses de l&apos;établissement ({poles.length} actif(s))
                </p>
                <button
                  type="button"
                  disabled={busy || selectedPresetCodes.length === 0}
                  onClick={() => void handleSavePoles()}
                  className="btn-primary text-xs py-2 px-3"
                >
                  Activer la sélection
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {POLE_PRESETS.map((preset) => {
                  const checked = selectedPresetCodes.includes(preset.code);
                  return (
                    <label
                      key={preset.code}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs cursor-pointer transition-colors ${
                        checked
                          ? 'border-amber-500/60 bg-amber-500/10 text-stone-100'
                          : 'border-stone-800 bg-stone-900 text-stone-400'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPresetCodes((prev) => [...new Set([...prev, preset.code])]);
                          } else {
                            setSelectedPresetCodes((prev) => prev.filter((c) => c !== preset.code));
                          }
                        }}
                        className="accent-amber-500"
                      />
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: poleColor(preset.code) }}
                      />
                      <span className="truncate font-medium">{preset.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Code PIN personnel Manager / Propriétaire */}
          <form
            onSubmit={handleSaveSelfPin}
            className="rounded-xl border border-stone-800 bg-stone-950/50 p-4 flex flex-col sm:flex-row sm:items-end gap-3"
          >
            <div className="flex-1">
              <label className="label text-xs">
                Mon Code PIN de validation terrain (4 chiffres minimum)
              </label>
              <input
                type="password"
                inputMode="numeric"
                minLength={4}
                maxLength={12}
                value={selfPin}
                onChange={(e) => setSelfPin(e.target.value)}
                placeholder="Ex : 2580"
                className="input-field text-sm font-mono tabular-nums"
              />
            </div>
            <button
              type="submit"
              disabled={busy || selfPin.trim().length < 4}
              className="btn-primary text-xs py-2.5 px-4 inline-flex items-center justify-center gap-2"
            >
              <KeyRound size={14} />
              Enregistrer mon Code PIN
            </button>
          </form>

          {/* Tableau / liste des membres gérables */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-stone-200">
                Membres sous votre autorité ({manageableTeam.length})
              </p>
              <Link to="/mes-employes" className="text-xs font-medium text-amber-400 hover:underline">
                Créer ou inviter un compte →
              </Link>
            </div>

            {manageableTeam.length === 0 ? (
              <p className="text-xs text-stone-400 rounded-xl border border-stone-800 p-4">
                Aucun autre membre dans ce périmètre pour le moment.
              </p>
            ) : (
              <div className="divide-y divide-stone-800 rounded-xl border border-stone-800">
                {manageableTeam.map((m) => {
                  const isEditing = editingMemberId === m.id;
                  const sup = team.find((t) => t.user_id === m.supervisor_user_id);
                  return (
                    <div key={m.id} className="p-3.5 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-stone-100 truncate">
                            {m.full_name || m.email}
                          </p>
                          <p className="text-xs text-stone-400 mt-0.5">
                            {ROLE_LABELS[m.role]} · {poleLabel(m.assigned_pole_code)} ·{' '}
                            {m.status === 'active' ? 'Actif' : 'Suspendu'}
                            {sup ? ` · Sup. ${sup.full_name || sup.email}` : ''}
                            {isCashierOnly(m.role)
                              ? ` · Stock ${m.can_edit_stock ? 'autorisé' : 'verrouillé'}`
                              : ''}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {actAsOwner && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleToggleStockEdit(m)}
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                                m.can_edit_stock
                                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                                  : 'border-stone-700 bg-stone-900 text-stone-300 hover:bg-stone-800'
                              }`}
                            >
                              {m.can_edit_stock ? <Unlock size={12} /> : <Lock size={12} />}
                              {m.can_edit_stock ? 'Stock ON' : 'Stock OFF'}
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              isEditing ? setEditingMemberId(null) : openMemberEditor(m)
                            }
                            className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20"
                          >
                            {isEditing ? 'Fermer' : 'Rôle / Pôle / PIN'}
                          </button>

                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleToggleStatus(m)}
                            className="rounded-lg border border-stone-700 bg-stone-900 px-2.5 py-1.5 text-xs font-medium text-stone-300 hover:bg-stone-800"
                          >
                            {m.status === 'active' ? 'Suspendre' : 'Réactiver'}
                          </button>
                        </div>
                      </div>

                      {isEditing && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-stone-800">
                          {actAsOwner && (
                            <div>
                              <label className="label text-xs">Rôle</label>
                              <select
                                className="input-field text-xs"
                                value={editRole}
                                onChange={(e) => setEditRole(e.target.value as Role)}
                              >
                                <option value="manager">Manager de pôle</option>
                                <option value="cashier">Caissière / Caissier</option>
                                <option value="employee">Employé</option>
                              </select>
                            </div>
                          )}

                          <div>
                            <label className="label text-xs">Pôle assigné</label>
                            <select
                              className="input-field text-xs"
                              disabled={Boolean(actAsManager && lockedPole)}
                              value={actAsManager && lockedPole ? lockedPole : editPole}
                              onChange={(e) => setEditPole(e.target.value)}
                            >
                              <option value="">Tous pôles / Général</option>
                              {poles.map((p) => (
                                <option key={p.id} value={p.code}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {actAsOwner && (
                            <div>
                              <label className="label text-xs">Manager superviseur</label>
                              <select
                                className="input-field text-xs"
                                value={editSupervisorId}
                                onChange={(e) => setEditSupervisorId(e.target.value)}
                              >
                                <option value="">Aucun superviseur</option>
                                {managersAndOwners
                                  .filter((supCand) => supCand.user_id !== m.user_id)
                                  .map((supCand) => (
                                    <option key={supCand.id} value={supCand.user_id}>
                                      {supCand.full_name || supCand.email} ({ROLE_LABELS[supCand.role]})
                                    </option>
                                  ))}
                              </select>
                            </div>
                          )}

                          <div>
                            <label className="label text-xs">Nouveau Code PIN (optionnel)</label>
                            <input
                              type="password"
                              inputMode="numeric"
                              value={editPin}
                              onChange={(e) => setEditPin(e.target.value)}
                              placeholder="4+ chiffres"
                              className="input-field text-xs font-mono tabular-nums"
                            />
                          </div>

                          <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleSaveMemberConfig(m)}
                              className="btn-primary text-xs py-2 px-4"
                            >
                              Enregistrer les pouvoirs
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* BLOC 3 : Validation Terrain par Code PIN & Journal d'audit */}
      <section className="rounded-2xl border border-stone-800 bg-stone-900 p-5 space-y-4">
        <div>
          <h2 className="text-base font-bold text-stone-100 flex items-center gap-2">
            <KeyRound size={17} className="text-amber-400" />
            {actAsCashier
              ? 'Demander une validation Manager par Code PIN'
              : 'Validation terrain par Code PIN & Journal d’audit'}
          </h2>
          <p className="text-xs text-stone-400 mt-0.5">
            Vérifie le PIN d&apos;un manager habilité sur ce pôle (ou du propriétaire) et enregistre la preuve dans le journal d&apos;audit.
          </p>
        </div>

        <form onSubmit={handleVerifyPin} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div>
            <label className="label text-xs">Type d&apos;opération</label>
            <select
              className="input-field text-xs"
              value={pinAction}
              onChange={(e) => setPinAction(e.target.value as 'pos.discount' | 'cloture.z' | 'pos.approval')}
            >
              <option value="pos.discount">Remise / annulation caisse</option>
              <option value="cloture.z">Clôture Z avec écart</option>
              <option value="pos.approval">Autre autorisation manager</option>
            </select>
          </div>

          <div>
            <label className="label text-xs">Pôle concerné</label>
            <select
              className="input-field text-xs"
              disabled={Boolean(lockedPole)}
              value={lockedPole || pinPole}
              onChange={(e) => setPinPole(e.target.value)}
            >
              {!lockedPole && <option value="">Général / Tous pôles</option>}
              {poles.map((p) => (
                <option key={p.id} value={p.code}>
                  {p.name}
                </option>
              ))}
              {lockedPole && !poles.some((p) => p.code === lockedPole) && (
                <option value={lockedPole}>{poleLabel(lockedPole)}</option>
              )}
            </select>
          </div>

          <div>
            <label className="label text-xs">Motif (traçabilité)</label>
            <input
              type="text"
              value={pinReason}
              onChange={(e) => setPinReason(e.target.value)}
              placeholder="Ex : Remise client VIP 2 000 F"
              className="input-field text-xs"
            />
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="label text-xs">Code PIN Manager</label>
              <input
                type="password"
                inputMode="numeric"
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
                placeholder="••••"
                className="input-field text-xs font-mono tabular-nums"
              />
            </div>
            <button
              type="submit"
              disabled={busy || pinCode.trim().length < 4}
              className="btn-primary text-xs px-3 self-end"
            >
              Valider
            </button>
          </div>
        </form>

        {lastPinApproval && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-200 flex items-center gap-2">
            <CheckCircle2 size={15} />
            <span>{lastPinApproval}</span>
          </div>
        )}

        {(actAsOwner || actAsManager) && (
          <div className="pt-2 border-t border-stone-800">
            <p className="text-xs font-semibold text-stone-400 mb-2">
              Dernières validations & actions sensibles ({audits.length})
            </p>
            {audits.length === 0 ? (
              <p className="text-xs text-stone-500">Aucune validation enregistrée pour le moment.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-stone-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-950/60 text-stone-400">
                    <tr>
                      <th className="px-3 py-2 font-medium">Date</th>
                      <th className="px-3 py-2 font-medium">Acteur</th>
                      <th className="px-3 py-2 font-medium">Action</th>
                      <th className="px-3 py-2 font-medium">Pôle / Cible</th>
                      <th className="px-3 py-2 font-medium">Motif</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-800">
                    {audits.map((a) => (
                      <tr key={a.id} className="text-stone-300">
                        <td className="px-3 py-2 font-mono tabular-nums whitespace-nowrap text-stone-400">
                          {formatTime(a.created_at)}
                        </td>
                        <td className="px-3 py-2 font-medium text-stone-200">
                          {a.actor_name || 'Système'}
                        </td>
                        <td className="px-3 py-2 font-mono text-amber-300">{a.action}</td>
                        <td className="px-3 py-2">{a.entity_label || a.entity_type}</td>
                        <td className="px-3 py-2 text-stone-400">{a.reason || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      {/* BLOC 4 : Matrice officielle des droits par rôle */}
      <section className="rounded-2xl border border-stone-800 bg-stone-900 p-5 space-y-3">
        <div>
          <h2 className="text-base font-bold text-stone-100">
            Règles officielles des droits & accès
          </h2>
          <p className="text-xs text-stone-400 mt-0.5">
            Comparatif exact appliqué côté interface et sécurité serveur (RLS & RPC).
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-stone-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-950/70 text-stone-300 border-b border-stone-800">
              <tr>
                <th className="px-3.5 py-2.5 font-semibold">Règle / Pouvoir</th>
                <th
                  className={`px-3.5 py-2.5 font-semibold ${
                    actAsOwner ? 'text-amber-400' : ''
                  }`}
                >
                  Propriétaire {actAsOwner ? '(Votre rôle)' : ''}
                </th>
                <th
                  className={`px-3.5 py-2.5 font-semibold ${
                    actAsManager ? 'text-amber-400' : ''
                  }`}
                >
                  Manager de pôle {actAsManager ? '(Votre rôle)' : ''}
                </th>
                <th
                  className={`px-3.5 py-2.5 font-semibold ${
                    actAsCashier ? 'text-amber-400' : ''
                  }`}
                >
                  Caissière {actAsCashier ? '(Votre rôle)' : ''}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800">
              {PERMISSION_MATRIX.map((row) => (
                <tr key={row.rule}>
                  <td className="px-3.5 py-2.5 font-semibold text-stone-200">{row.rule}</td>
                  <td
                    className={`px-3.5 py-2.5 ${
                      actAsOwner ? 'bg-amber-500/5 text-stone-100 font-medium' : 'text-stone-400'
                    }`}
                  >
                    {row.owner}
                  </td>
                  <td
                    className={`px-3.5 py-2.5 ${
                      actAsManager ? 'bg-amber-500/5 text-stone-100 font-medium' : 'text-stone-400'
                    }`}
                  >
                    {row.manager}
                  </td>
                  <td
                    className={`px-3.5 py-2.5 ${
                      actAsCashier ? 'bg-amber-500/5 text-stone-100 font-medium' : 'text-stone-400'
                    }`}
                  >
                    {row.cashier}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
