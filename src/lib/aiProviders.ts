/** Catalogue modèles IA — Stock Manager AI (IDs vérifiés Oct 2026) */
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

export const AI_MODELS: AiModelOption[] = [
  {
    id: 'gemini-3.5-flash-lite',
    provider: 'gemini',
    label: 'Gemini 3.5 Flash Lite',
    description: 'Défaut recommandé — chat + vision (Google)',
    caps: ['chat', 'vision', 'file'],
  },
  {
    id: 'gemini-flash-latest',
    provider: 'gemini',
    label: 'Gemini Flash (latest)',
    description: 'Dernière version Flash Google',
    caps: ['chat', 'vision', 'file'],
  },
  {
    id: 'openrouter/free',
    provider: 'openrouter',
    label: 'OpenRouter Free (auto)',
    description: 'Routage gratuit OpenRouter',
    caps: ['chat', 'file'],
  },
  {
    id: 'nvidia/nemotron-3.5-lightning:free',
    provider: 'openrouter',
    label: 'Nemotron 3.5 Lightning (free)',
    description: 'OpenRouter gratuit',
    caps: ['chat', 'file'],
  },
  {
    id: 'google/gemma-4-26b-a4b-it:free',
    provider: 'openrouter',
    label: 'Gemma 4 26B (free)',
    description: 'OpenRouter free (peut être rate-limité)',
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
    description: 'Génération de courtes vidéos',
    caps: ['video'],
    freeNoKey: true,
  },
  {
    id: 'local-rules',
    provider: 'local',
    label: 'Local (hors-ligne)',
    description: 'Réponses métier sans API (secours)',
    caps: ['chat'],
    freeNoKey: true,
  },
];

export function getModel(id: string): AiModelOption | undefined {
  return AI_MODELS.find((m) => m.id === id);
}

export function modelById(id: string): AiModelOption | undefined {
  return getModel(id);
}

export function defaultChatModelId(): string {
  return 'gemini-3.5-flash-lite';
}
