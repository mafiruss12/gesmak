import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays, Wallet, TrendingUp, AlertTriangle, CheckCircle2,
  Loader2, Lock, Unlock, RefreshCw, FileText,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useEstId } from '@/lib/useEstId';
import { formatFCFA, todayISO } from '@/lib/format';
import { loadDayOpsSummary } from '@/lib/opsHub';
import { EmptyState } from '@/components/ui';

type CashSession = {
  id: string;
  establishment_id: string;
  session_date: string;
  status: 'open' | 'closed';
  opened_at: string;
  closed_at?: string | null;
  opened_by?: string | null;
  closed_by?: string | null;
  opening_float: number;
  closing_cash_real?: number | null;
  expected_cash?: number | null;
  cash_difference?: number | null;
  total_sales?: number | null;
  total_expenses?: number | null;
  notes?: string | null;
};

export default function ClotureZPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { member } = useAuth();
  const estId = useEstId();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [session, setSession] = useState<CashSession | null>(null);
  const [history, setHistory] = useState<CashSession[]>([]);
  const [floatInput, setFloatInput] = useState('20000');
  const [closingCash, setClosingCash] = useState('');
  const [notes, setNotes] = useState('');
  const [salesToday, setSalesToday] = useState(0);
  const [expensesToday, setExpensesToday] = useState(0);
  const [cashSalesToday, setCashSalesToday] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const canManage = ['super_admin', 'admin', 'owner', 'manager', 'cashier'].includes(
    String(member?.role || '')
  );

  const expectedCash = useMemo(() => {
    const opening = session ? Number(session.opening_float) || 0 : Number(floatInput) || 0;
    return opening + cashSalesToday - expensesToday;
  }, [session, floatInput, cashSalesToday, expensesToday]);

  const load = useCallback(async () => {
    if (!estId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const today = todayISO();

    const [sessRes, histRes, dayOps] = await Promise.all([
      supabase
        .from('cash_sessions')
        .select('*')
        .eq('establishment_id', estId)
        .eq('session_date', today)
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('cash_sessions')
        .select('*')
        .eq('establishment_id', estId)
        .order('session_date', { ascending: false })
        .limit(14),
      loadDayOpsSummary(estId, today),
    ]);

    if (sessRes.error && !String(sessRes.error.message || '').includes('//')) {
      // table missing or RLS
      if (sessRes.error.code === '42P01' || /does not exist/i.test(sessRes.error.message || '')) {
        setError('Table cash_sessions absente — contactez le support.');
      }
    }

    setSession((sessRes.data as CashSession) || null);
    setHistory(((histRes.data as CashSession[]) || []).filter((s) => s.session_date !== today || s.status === 'closed'));

    setSalesToday(dayOps.salesTotal);
    setCashSalesToday(dayOps.cashTotal);
    setExpensesToday(dayOps.expensesTotal);

    if (sessRes.data) {
      setFloatInput(String(sessRes.data.opening_float ?? 0));
      if (sessRes.data.closing_cash_real != null) {
        setClosingCash(String(sessRes.data.closing_cash_real));
      }
      setNotes(sessRes.data.notes || '');
    }

    setLoading(false);
  }, [estId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openSession() {
    if (!estId || !canManage) return;
    const opening = Number(floatInput) || 0;
    if (opening < 0) {
      alert('Fond de caisse invalide.');
      return;
    }
    if (!confirm(`Ouvrir la caisse avec un fond de ${formatFCFA(opening)} ?`)) return;
    setSaving(true);
    const { data, error: err } = await supabase
      .from('cash_sessions')
      .insert({
        establishment_id: estId,
        session_date: todayISO(),
        status: 'open',
        opening_float: opening,
        opened_by: member?.user_id || null,
        total_sales: salesToday,
        total_expenses: expensesToday,
      })
      .select('*')
      .single();
    setSaving(false);
    if (err) {
      alert('Impossible d’ouvrir la session : ' + err.message);
      return;
    }
    setSession(data as CashSession);
    await load();
  }

  async function closeSession() {
    if (!estId || !session || session.status !== 'open') return;
    const real = Number(closingCash);
    if (Number.isNaN(real) || real < 0) {
      alert('Indiquez les espèces réellement comptées.');
      return;
    }
    const expected = expectedCash;
    const diff = real - expected;
    if (
      !confirm(
        `Clôturer la caisse (Z) ?\nAttendu : ${formatFCFA(expected)}\nCompté : ${formatFCFA(real)}\nÉcart : ${formatFCFA(diff)}`
      )
    ) {
      return;
    }
    setSaving(true);
    const { error: err } = await supabase
      .from('cash_sessions')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        closed_by: member?.user_id || null,
        closing_cash_real: real,
        expected_cash: expected,
        cash_difference: diff,
        total_sales: salesToday,
        total_expenses: expensesToday,
        notes: notes.trim() || null,
      })
      .eq('id', session.id);
    setSaving(false);
    if (err) {
      alert('Clôture impossible : ' + err.message);
      return;
    }
    await load();
    alert('Clôture Z enregistrée.');
  }

  if (!estId) {
    return (
      <EmptyState
        icon={<CalendarDays size={40} />}
        title="Aucun établissement"
        message="Sélectionnez un établissement pour la clôture de caisse."
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-stone-400 gap-2">
        <Loader2 className="animate-spin" size={20} /> Chargement…
      </div>
    );
  }

  const isOpen = session?.status === 'open';
  const isClosed = session?.status === 'closed';
  const diffPreview =
    closingCash !== '' ? Number(closingCash) - expectedCash : null;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-amber-400/90">Caisse</p>
          {!embedded && (<h1 className="text-2xl font-bold font-display text-stone-100">Journal & Clôture Z</h1>)}
          <p className="text-sm text-stone-400">
            Fond de caisse, ventes du jour, espèces comptées et écart — idée issue de l’audit AI Studio.
          </p>
        </div>
        <button type="button" className="btn-ghost text-xs flex items-center gap-1" onClick={() => void load()}>
          <RefreshCw size={14} /> Actualiser
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card py-3">
          <p className="text-[11px] text-stone-500 uppercase">Ventes du jour</p>
          <p className="text-lg font-bold text-stone-100">{formatFCFA(salesToday)}</p>
        </div>
        <div className="card py-3">
          <p className="text-[11px] text-stone-500 uppercase">Dont espèces (estim.)</p>
          <p className="text-lg font-bold text-emerald-300">{formatFCFA(cashSalesToday)}</p>
        </div>
        <div className="card py-3">
          <p className="text-[11px] text-stone-500 uppercase">Dépenses</p>
          <p className="text-lg font-bold text-amber-200">{formatFCFA(expensesToday)}</p>
        </div>
        <div className="card py-3">
          <p className="text-[11px] text-stone-500 uppercase">Caisse attendue</p>
          <p className="text-lg font-bold text-sky-300">{formatFCFA(expectedCash)}</p>
        </div>
      </div>

      <div className="card space-y-4 border border-amber-500/20">
        <div className="flex items-center gap-2">
          {isOpen ? (
            <span className="inline-flex items-center gap-1 text-emerald-300 text-sm font-semibold">
              <Unlock size={16} /> Session ouverte
            </span>
          ) : isClosed ? (
            <span className="inline-flex items-center gap-1 text-stone-300 text-sm font-semibold">
              <Lock size={16} /> Session clôturée aujourd’hui
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-amber-300 text-sm font-semibold">
              <Wallet size={16} /> Aucune session aujourd’hui
            </span>
          )}
        </div>

        {!session && (
          <div className="space-y-3">
            <label className="label">Fond de caisse à l’ouverture (FCFA)</label>
            <input
              type="number"
              className="input-field"
              value={floatInput}
              onChange={(e) => setFloatInput(e.target.value)}
              disabled={!canManage}
            />
            <button
              type="button"
              className="btn-primary w-full flex items-center justify-center gap-2"
              disabled={saving || !canManage}
              onClick={() => void openSession()}
            >
              {saving ? <Loader2 className="animate-spin" size={18} /> : <Unlock size={18} />}
              Ouvrir la caisse
            </button>
          </div>
        )}

        {isOpen && (
          <div className="space-y-3">
            <p className="text-sm text-stone-400">
              Ouverte avec fond <strong className="text-stone-200">{formatFCFA(Number(session.opening_float))}</strong>
              {' · '}
              Attendu maintenant : <strong className="text-sky-300">{formatFCFA(expectedCash)}</strong>
            </p>
            <label className="label">Espèces réellement comptées (FCFA)</label>
            <input
              type="number"
              className="input-field"
              value={closingCash}
              onChange={(e) => setClosingCash(e.target.value)}
              placeholder="Ex: 85000"
              disabled={!canManage}
            />
            {diffPreview != null && !Number.isNaN(diffPreview) && (
              <div
                className={`rounded-xl px-3 py-2 text-sm flex items-center gap-2 ${
                  Math.abs(diffPreview) < 1
                    ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-100 border border-amber-500/30'
                }`}
              >
                {Math.abs(diffPreview) < 1 ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                Écart : {formatFCFA(diffPreview)}{' '}
                {diffPreview > 0 ? '(surplus)' : diffPreview < 0 ? '(manque)' : '(OK)'}
              </div>
            )}
            <label className="label">Notes de clôture (optionnel)</label>
            <textarea
              className="input-field min-h-[80px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={!canManage}
            />
            <button
              type="button"
              className="btn-primary w-full flex items-center justify-center gap-2"
              disabled={saving || !canManage}
              onClick={() => void closeSession()}
            >
              {saving ? <Loader2 className="animate-spin" size={18} /> : <Lock size={18} />}
              Clôturer la caisse (Z)
            </button>
            <Link to="/daily-report" className="btn-secondary w-full flex items-center justify-center gap-2">
              <FileText size={16} /> Aller au rapport du jour
            </Link>
          </div>
        )}

        {isClosed && session && (
          <div className="space-y-2 text-sm">
            <p>
              Fond : {formatFCFA(Number(session.opening_float))} · Compté :{' '}
              {formatFCFA(Number(session.closing_cash_real || 0))}
            </p>
            <p>
              Attendu : {formatFCFA(Number(session.expected_cash || 0))} · Écart :{' '}
              <span
                className={
                  Math.abs(Number(session.cash_difference || 0)) < 1 ? 'text-emerald-300' : 'text-amber-300'
                }
              >
                {formatFCFA(Number(session.cash_difference || 0))}
              </span>
            </p>
            {session.notes && <p className="text-stone-400">Note : {session.notes}</p>}
            <Link to="/daily-report" className="text-amber-400 hover:underline inline-flex items-center gap-1">
              <FileText size={14} /> Voir / compléter le rapport du jour →
            </Link>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="font-semibold text-stone-100 mb-2 flex items-center gap-2">
          <TrendingUp size={18} className="text-amber-400" /> Historique récent
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-stone-500">Aucune clôture précédente.</p>
        ) : (
          <ul className="space-y-2">
            {history.map((h) => (
              <li
                key={h.id}
                className="flex flex-wrap justify-between gap-2 text-sm border-b border-stone-800 pb-2"
              >
                <span className="text-stone-300">{h.session_date}</span>
                <span className="text-stone-400">
                  {h.status === 'closed' ? 'Clôturée' : 'Ouverte'} · écart{' '}
                  {formatFCFA(Number(h.cash_difference || 0))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
