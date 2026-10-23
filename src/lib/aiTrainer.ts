import { supabase } from '@/lib/supabase';

export type AiKnowledge = {
  id: string;
  establishment_id?: string | null;
  kind: 'persona' | 'qa' | string;
  keywords: string;
  title: string;
  answer: string;
  active: boolean;
  created_at?: string;
};

const LS_KEY = 'mm_ai_knowledge_v1';

function lsLoad(): AiKnowledge[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AiKnowledge[];
  } catch {
    return [];
  }
}

function lsSave(rows: AiKnowledge[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(rows));
  } catch {
    /* */
  }
}

export async function loadKnowledge(estId?: string | null): Promise<AiKnowledge[]> {
  try {
    let q = supabase.from('ai_knowledge').select('*').eq('active', true).order('created_at', { ascending: false });
    // global + est
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data || []) as AiKnowledge[];
    if (rows.length) {
      lsSave(rows);
      return rows.filter((r) => !r.establishment_id || r.establishment_id === estId);
    }
  } catch {
    /* table or network */
  }
  return lsLoad().filter((r) => r.active !== false && (!r.establishment_id || r.establishment_id === estId));
}

export async function loadAllKnowledgeAdmin(): Promise<AiKnowledge[]> {
  try {
    const { data, error } = await supabase
      .from('ai_knowledge')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    const rows = (data || []) as AiKnowledge[];
    lsSave(rows);
    return rows;
  } catch {
    return lsLoad();
  }
}

export async function saveKnowledge(row: Partial<AiKnowledge> & { kind: string; answer: string }): Promise<AiKnowledge | null> {
  const payload = {
    establishment_id: row.establishment_id ?? null,
    kind: row.kind,
    keywords: row.keywords || '',
    title: row.title || '',
    answer: row.answer,
    active: row.active !== false,
    updated_at: new Date().toISOString(),
  };
  try {
    if (row.id && !String(row.id).startsWith('local-')) {
      const { data, error } = await supabase
        .from('ai_knowledge')
        .update(payload)
        .eq('id', row.id)
        .select()
        .maybeSingle();
      if (error) throw error;
      return data as AiKnowledge;
    }
    const { data, error } = await supabase.from('ai_knowledge').insert(payload).select().maybeSingle();
    if (error) throw error;
    return data as AiKnowledge;
  } catch {
    // local fallback
    const local: AiKnowledge = {
      id: row.id || `local-${Date.now()}`,
      ...payload,
      active: true,
    };
    const all = lsLoad().filter((x) => x.id !== local.id);
    all.unshift(local);
    lsSave(all);
    return local;
  }
}

export async function deleteKnowledge(id: string): Promise<void> {
  try {
    if (!id.startsWith('local-')) {
      await supabase.from('ai_knowledge').delete().eq('id', id);
    }
  } catch {
    /* */
  }
  lsSave(lsLoad().filter((x) => x.id !== id));
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Match trained Q&A against user question */
export function matchTrainedAnswer(question: string, knowledge: AiKnowledge[]): AiKnowledge | null {
  const q = normalize(question);
  const qas = knowledge.filter((k) => k.kind === 'qa' && k.active !== false && k.answer);
  let best: { row: AiKnowledge; score: number } | null = null;
  for (const row of qas) {
    const keys = (row.keywords || '')
      .split(/[,;|]/)
      .map((k) => normalize(k.trim()))
      .filter(Boolean);
    if (!keys.length && row.title) keys.push(normalize(row.title));
    let score = 0;
    for (const k of keys) {
      if (k.length >= 2 && q.includes(k)) score += k.length;
    }
    // title words
    for (const w of normalize(row.title).split(/\s+/)) {
      if (w.length > 3 && q.includes(w)) score += 2;
    }
    if (score > 0 && (!best || score > best.score)) best = { row, score };
  }
  return best && best.score >= 3 ? best.row : null;
}

export function getPersona(knowledge: AiKnowledge[]): string {
  const p = knowledge.find((k) => k.kind === 'persona' && k.active !== false);
  return (
    p?.answer ||
    "Tu es Stock AI, un assistant IA polyvalent. Tu peux aider sur n'importe quel sujet, pas seulement le stock ou le commerce."
  );
}
