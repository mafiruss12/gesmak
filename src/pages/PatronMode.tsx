import { useEffect, useMemo, useState } from 'react';
import { Volume2, CheckCircle2, AlertTriangle, ThumbsUp, Mic, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useEstId } from '@/lib/useEstId';
import { formatFCFA } from '@/lib/format';
import {
  speakFrench,
  playTone,
  buildReportSpeech,
  startQuantityDictation,
  isSpeechRecognitionSupported,
} from '@/lib/a11yVoice';
import { EmptyState } from '@/components/ui';

type SavedPayload = {
  items?: { name: string; qty: number; price?: number }[];
  cash_counted?: number;
  mobile_counted?: number;
  theoretical?: number;
  match?: boolean;
  comment?: string;
};

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Mode Patron — 3 actions seulement, pour propriétaires qui ne lisent pas.
 * 1. Écouter le point
 * 2. Voir OK (vert) ou problème (rouge)
 * 3. Valider (vu)
 */
export default function PatronMode() {
  const { member, activeEstablishment } = useAuth();
  const estId = useEstId();
  const [loading, setLoading] = useState(true);
  const [date] = useState(todayISO());
  const [payload, setPayload] = useState<SavedPayload | null>(null);
  const [sent, setSent] = useState(false);
  const [validated, setValidated] = useState(false);
  const [listening, setListening] = useState(false);
  const [dictating, setDictating] = useState(false);
  const [hint, setHint] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!estId) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('daily_reports')
        .select('*')
        .eq('establishment_id', estId)
        .eq('date', date)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setSent(Boolean((data as any).sent_at));
        try {
          const raw = data.notes || '';
          if (raw.startsWith('{')) setPayload(JSON.parse(raw));
          else
            setPayload({
              theoretical: Number(data.total_sales) || 0,
              cash_counted: Number(data.cash) || 0,
              mobile_counted: Number((data as any).mobile_money) || 0,
              match: true,
              items: [],
            });
        } catch {
          setPayload({
            theoretical: Number(data.total_sales) || 0,
            cash_counted: Number(data.cash) || 0,
            match: true,
            items: [],
          });
        }
      } else {
        setPayload(null);
      }
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [estId, date]);

  const theoretical = payload?.theoretical ?? 0;
  const cash = payload?.cash_counted ?? 0;
  const mobile = payload?.mobile_counted ?? 0;
  const match = payload?.match ?? Math.abs(theoretical - (cash + mobile)) < 1;
  const items = payload?.items?.filter((i) => i.qty > 0) || [];

  function listen() {
    setListening(true);
    const text = payload
      ? buildReportSpeech({
          establishmentName: activeEstablishment?.name,
          date,
          items: items.map((i) => ({
            name: i.name,
            qty: i.qty,
            total: i.qty * (i.price || 0),
          })),
          theoretical,
          cash,
          mobile,
          match,
          diff: theoretical - (cash + mobile),
        })
      : `Aucun rapport pour aujourd'hui. Demandez au gérant d'envoyer le point.`;
    playTone(payload ? (match ? 'ok' : 'warn') : 'tap');
    speakFrench(text);
    setTimeout(() => setListening(false), 2500);
  }

  async function validate() {
    if (!estId || !member?.user_id) return;
    playTone('ok');
    speakFrench('Validé. Merci.');
    setValidated(true);
    try {
      await supabase.from('notifications').insert({
        user_id: member.user_id,
        title: 'Point validé par le propriétaire',
        message: `Validation mode patron — ${date}`,
        read: false,
        type: 'patron_ok',
        link: '/daily-report',
      });
      // log soft
      await supabase.from('catalog_events').insert({
        establishment_id: estId,
        actor_id: member.user_id,
        kind: 'patron_validate',
        message: `Propriétaire a validé le point du ${date}`,
      });
    } catch {
      /* */
    }
  }

  function dictateTest() {
    if (!isSpeechRecognitionSupported()) {
      setHint('Dictée non dispo. Utilisez Chrome sur téléphone Android.');
      speakFrench('Dictée non disponible sur cet appareil.');
      return;
    }
    setDictating(true);
    setHint('Parlez… dites un nombre, par exemple : douze');
    speakFrench('Dites un nombre.');
    startQuantityDictation({
      onResult: ({ transcript, qty }) => {
        setHint(
          qty != null
            ? `Compris : ${qty} (vous avez dit « ${transcript} »)`
            : `Pas de nombre clair (« ${transcript} »)`
        );
        if (qty != null) {
          playTone('ok');
          speakFrench(`${qty}`);
        } else playTone('warn');
      },
      onError: (m) => setHint(m),
      onEnd: () => setDictating(false),
    });
  }

  if (!estId) {
    return (
      <EmptyState
        icon={<ThumbsUp size={40} />}
        title="Mode patron"
        message="Sélectionnez un établissement."
      />
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary-500" size={28} />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-5 pb-8">
      <div className="text-center">
        <p className="text-xs text-stone-500 uppercase tracking-wide">Mode patron</p>
        <h1 className="text-2xl font-bold text-stone-100 mt-1">
          {activeEstablishment?.name || 'Mon maquis'}
        </h1>
        <p className="text-stone-500 text-sm mt-1">{date}</p>
      </div>

      {/* Statut géant */}
      <div
        className={`rounded-3xl p-8 text-center border-2 ${
          !payload
            ? 'border-stone-700 bg-stone-900'
            : match
              ? 'border-emerald-500/60 bg-emerald-500/15'
              : 'border-red-500/60 bg-red-500/15'
        }`}
      >
        {!payload ? (
          <>
            <AlertTriangle className="mx-auto text-stone-400" size={64} />
            <p className="text-xl font-bold text-stone-200 mt-4">Pas encore de point</p>
            <p className="text-stone-500 text-sm mt-2">Le gérant doit envoyer le rapport du jour.</p>
          </>
        ) : match ? (
          <>
            <CheckCircle2 className="mx-auto text-emerald-400" size={72} />
            <p className="text-3xl font-bold text-emerald-300 mt-4">Caisse OK</p>
            <p className="text-stone-300 text-lg mt-2">{formatFCFA(theoretical)}</p>
          </>
        ) : (
          <>
            <AlertTriangle className="mx-auto text-red-400" size={72} />
            <p className="text-3xl font-bold text-red-300 mt-4">Problème</p>
            <p className="text-stone-300 text-lg mt-2">
              Écart {formatFCFA(Math.abs(theoretical - (cash + mobile)))}
            </p>
          </>
        )}
        {sent && <p className="text-xs text-stone-500 mt-3">Rapport déjà envoyé</p>}
        {validated && <p className="text-sm text-emerald-400 mt-2 font-medium">✓ Vous avez validé</p>}
      </div>

      {/* 3 boutons seulement */}
      <button
        type="button"
        onClick={listen}
        disabled={listening}
        className="w-full min-h-[72px] rounded-3xl bg-amber-500 text-stone-950 font-bold text-xl flex items-center justify-center gap-3 shadow-lg active:scale-[0.98]"
      >
        <Volume2 size={32} /> 1. Écouter
      </button>

      <div className="w-full min-h-[72px] rounded-3xl border-2 border-stone-700 bg-stone-900 flex items-center justify-center gap-3 text-xl font-bold text-stone-200">
        {!payload ? (
          <span className="text-stone-500">2. Attendre le point</span>
        ) : match ? (
          <span className="text-emerald-400 flex items-center gap-2">
            <CheckCircle2 size={28} /> 2. Tout va bien
          </span>
        ) : (
          <span className="text-red-400 flex items-center gap-2">
            <AlertTriangle size={28} /> 2. Voir le problème
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => void validate()}
        disabled={!payload || validated}
        className="w-full min-h-[72px] rounded-3xl bg-emerald-600 disabled:opacity-40 text-white font-bold text-xl flex items-center justify-center gap-3 shadow-lg active:scale-[0.98]"
      >
        <ThumbsUp size={32} /> 3. Valider
      </button>

      {/* Mini test micro */}
      <button
        type="button"
        onClick={dictateTest}
        disabled={dictating}
        className="w-full min-h-[52px] rounded-2xl border border-stone-700 text-stone-300 flex items-center justify-center gap-2"
      >
        <Mic size={20} /> {dictating ? 'Écoute…' : 'Tester le micro'}
      </button>
      {hint && <p className="text-center text-sm text-amber-200/90">{hint}</p>}
    </div>
  );
}
