import { useEffect, useState } from 'react';
import { Brain, Plus, Trash2, Save, Loader2, BookOpen } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import {
  loadAllKnowledgeAdmin,
  saveKnowledge,
  deleteKnowledge,
  type AiKnowledge,
} from '@/lib/aiTrainer';
import { EmptyState, Badge } from '@/components/ui';

/**
 * Formation de l'assistant IA — admin / owner
 * Personnalité + paires question/réponse
 */
export default function AITrain() {
  const { member, effectiveRole } = useAuth();
  const role = (effectiveRole || member?.role || '') as string;
  const canTrain = role === 'super_admin';

  const [rows, setRows] = useState<AiKnowledge[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [persona, setPersona] = useState('');
  const [personaId, setPersonaId] = useState<string | undefined>();
  const [form, setForm] = useState({ keywords: '', title: '', answer: '' });
  const [msg, setMsg] = useState('');

  async function refresh() {
    setLoading(true);
    const data = await loadAllKnowledgeAdmin();
    setRows(data.filter((r) => r.kind === 'qa'));
    const p = data.find((r) => r.kind === 'persona');
    setPersona(p?.answer || '');
    setPersonaId(p?.id);
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function savePersona() {
    setSaving(true);
    await saveKnowledge({
      id: personaId,
      kind: 'persona',
      keywords: '',
      title: 'Personnalité',
      answer: persona.trim(),
      active: true,
    });
    setMsg('Personnalité enregistrée.');
    await refresh();
    setSaving(false);
  }

  async function addQa() {
    if (!form.answer.trim()) {
      alert('La réponse est obligatoire.');
      return;
    }
    setSaving(true);
    await saveKnowledge({
      kind: 'qa',
      keywords: form.keywords.trim(),
      title: form.title.trim() || form.keywords.split(',')[0] || 'Sans titre',
      answer: form.answer.trim(),
      active: true,
      establishment_id: null, // global — admin only
    });
    setForm({ keywords: '', title: '', answer: '' });
    setMsg('Exemple ajouté — l’assistant s’en servira.');
    await refresh();
    setSaving(false);
  }

  async function remove(id: string) {
    if (!confirm('Supprimer cet entraînement ?')) return;
    await deleteKnowledge(id);
    await refresh();
  }

  if (!canTrain) {
    return (
      <EmptyState
        icon={<Brain size={48} />}
        title="Formation IA"
        message="Seul le super administrateur peut entraîner l’assistant IA."
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
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-100 flex items-center gap-2">
          <Brain className="text-primary-400" size={26} /> Former l’assistant IA
        </h1>
        <p className="text-stone-400 text-sm mt-1">
          Définissez la personnalité et ajoutez des questions/réponses. L’assistant les utilise
          avant les réponses automatiques.
        </p>
      </div>

      {msg && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {msg}
        </div>
      )}

      {/* Persona */}
      <div className="card space-y-3">
        <h2 className="font-semibold text-stone-100 flex items-center gap-2">
          <BookOpen size={18} className="text-amber-400" /> Personnalité / consignes
        </h2>
        <textarea
          className="input-field min-h-[120px]"
          value={persona}
          onChange={(e) => setPersona(e.target.value)}
          placeholder="Ex. Tu parles simplement, tu tutoyes, tu aides les gérants de maquis…"
        />
        <button
          type="button"
          className="btn-primary flex items-center gap-2"
          disabled={saving}
          onClick={() => void savePersona()}
        >
          <Save size={16} /> Enregistrer la personnalité
        </button>
      </div>

      {/* New QA */}
      <div className="card space-y-3">
        <h2 className="font-semibold text-stone-100 flex items-center gap-2">
          <Plus size={18} className="text-emerald-400" /> Nouvel exemple d’entraînement
        </h2>
        <div>
          <label className="label">Mots-clés (séparés par des virgules)</label>
          <input
            className="input-field"
            value={form.keywords}
            onChange={(e) => setForm({ ...form, keywords: e.target.value })}
            placeholder="ex: inventaire, stock, arrivage"
          />
        </div>
        <div>
          <label className="label">Titre court</label>
          <input
            className="input-field"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="ex: Ajouter un arrivage"
          />
        </div>
        <div>
          <label className="label">Réponse que l’IA doit donner</label>
          <textarea
            className="input-field min-h-[100px]"
            value={form.answer}
            onChange={(e) => setForm({ ...form, answer: e.target.value })}
            placeholder="Explique clairement la marche à suivre…"
          />
        </div>
        <button
          type="button"
          className="btn-primary flex items-center gap-2"
          disabled={saving}
          onClick={() => void addQa()}
        >
          <Plus size={16} /> Ajouter à l’entraînement
        </button>
      </div>

      {/* List */}
      <div className="space-y-2">
        <h2 className="font-semibold text-stone-200">Exemples enregistrés ({rows.length})</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-stone-500">Aucun exemple encore — ajoutez-en ci-dessus.</p>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="card space-y-1">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-stone-100">{r.title || 'Sans titre'}</p>
                  <p className="text-xs text-stone-500 mt-0.5">
                    <Badge color="neutral">{r.keywords || '—'}</Badge>
                  </p>
                  <p className="text-sm text-stone-300 mt-2 whitespace-pre-wrap">{r.answer}</p>
                </div>
                <button
                  type="button"
                  className="p-2 text-error-400 hover:bg-error-500/10 rounded-lg"
                  onClick={() => void remove(r.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <p className="text-xs text-stone-500">
        Astuce : plus vos mots-clés collent aux questions des utilisateurs, plus l’assistant répond
        comme vous l’avez formé. Testez dans le menu <strong>Assistant IA</strong>.
      </p>
    </div>
  );
}
