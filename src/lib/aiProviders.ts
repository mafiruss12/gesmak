/** Catalogue modèles IA — Stock Manager AI (vérifié Oct 2026) */
export type AiCapability = 'chat' | 'vision' | 'image' | 'video' | 'file';

export type AiProviderId = 'gemini' | 'groq' | 'openrouter' | 'pollinations' | 'local';

export interface AiModelOption {
  id: string;
  provider: AiProviderId;
  label: string;
  description: string;
  caps: AiCapability[];
  freeNoKey?: boolean;
}

/** Anciens IDs → nouveau (migration localStorage) */
export const MODEL_MIGRATIONS: Record<string, string> = {
  'gemini-2.0-flash': 'gemini-3.5-flash-lite',
  'gemini-2.5-flash': 'gemini-3.5-flash-lite',
  'gemini-2.5-pro': 'gemini-3.5-flash-lite',
  'llama-3.3-70b-versatile': 'x-ai/grok-4.3',
  'llama-3.1-8b-instant': 'x-ai/grok-4.3',
  'openrouter/auto': 'openrouter/free',
  'meta-llama/llama-3.3-70b-instruct:free': 'openrouter/free',
  'gemini-flash-latest': 'gemini-3.5-flash-lite',
};

export const AI_MODELS: AiModelOption[] = [
  {
    id: 'x-ai/grok-4.3',
    provider: 'openrouter',
    label: 'Grok 4.3 (xAI)',
    description: 'Comme Grok — style direct, utile, en français',
    caps: ['chat', 'file'],
  },
  {
    id: 'x-ai/grok-4.7',
    provider: 'openrouter',
    label: 'Grok 4.7 (xAI)',
    description: 'Dernière génération Grok via OpenRouter',
    caps: ['chat', 'file'],
  },
  {
    id: 'gemini-3.5-flash-lite',
    provider: 'gemini',
    label: 'Gemini 3.5 Flash Lite',
    description: 'Chat + analyse images / fichiers (vision)',
    caps: ['chat', 'vision', 'file'],
  },
  {
    id: 'openrouter/free',
    provider: 'openrouter',
    label: 'OpenRouter Free',
    description: 'Routage gratuit (quota limité)',
    caps: ['chat', 'file'],
  },
  {
    id: 'nvidia/nemotron-3.5-lightning:free',
    provider: 'openrouter',
    label: 'Nemotron 3.5 (free)',
    description: 'Modèle free OpenRouter',
    caps: ['chat', 'file'],
  },
  {
    id: 'pollinations-image',
    provider: 'pollinations',
    label: 'Pollinations Image',
    description: 'Génération d’images',
    caps: ['image'],
    freeNoKey: true,
  },
  {
    id: 'pollinations-video',
    provider: 'pollinations',
    label: 'Pollinations Vidéo',
    description: 'Courtes vidéos générées',
    caps: ['video'],
    freeNoKey: true,
  },
  {
    id: 'local-rules',
    provider: 'local',
    label: 'Local (hors-ligne)',
    description: 'Secours sans API',
    caps: ['chat'],
    freeNoKey: true,
  },
];

export function getModel(id: string): AiModelOption | undefined {
  return AI_MODELS.find((m) => m.id === id);
}

export function modelById(id: string): AiModelOption | undefined {
  const migrated = MODEL_MIGRATIONS[id] || id;
  return getModel(migrated) || getModel(id);
}

export function resolveModelId(id: string | null | undefined): string {
  if (!id) return defaultChatModelId();
  if (MODEL_MIGRATIONS[id]) return MODEL_MIGRATIONS[id];
  if (getModel(id)) return id;
  return defaultChatModelId();
}

export function defaultChatModelId(): string {
  return 'x-ai/grok-4.3';
}

/** Modèle vision pour analyse d’images / fichiers joints */
export function visionModelId(): string {
  return 'gemini-3.5-flash-lite';
}
