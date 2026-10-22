/** Catalogue modèles IA — Stock Manager AI */
export type AiCapability = 'chat' | 'vision' | 'image' | 'file';

export type AiProviderId = 'gemini' | 'groq' | 'openrouter' | 'pollinations' | 'local';

export interface AiModelOption {
  id: string;
  provider: AiProviderId;
  label: string;
  description: string;
  caps: AiCapability[];
  /** true = pas de clé serveur obligatoire (ex. règles locales / Pollinations image) */
  freeNoKey?: boolean;
}

export const AI_MODELS: AiModelOption[] = [
  {
    id: 'local-rules',
    provider: 'local',
    label: 'Local (rapide)',
    description: 'Réponses entraînées + règles métier sans API',
    caps: ['chat'],
    freeNoKey: true,
  },
  {
    id: 'gemini-2.0-flash',
    provider: 'gemini',
    label: 'Gemini 2.0 Flash',
    description: 'Chat + vision OCR — Google',
    caps: ['chat', 'vision', 'file'],
  },
  {
    id: 'gemini-2.5-flash',
    provider: 'gemini',
    label: 'Gemini 2.5 Flash',
    description: 'Plus récent si disponible sur votre clé',
    caps: ['chat', 'vision', 'file'],
  },
  {
    id: 'llama-3.3-70b-versatile',
    provider: 'groq',
    label: 'Groq Llama 3.3 70B',
    description: 'Très rapide, gratuit (quota)',
    caps: ['chat', 'file'],
  },
  {
    id: 'openai/gpt-oss-120b',
    provider: 'groq',
    label: 'Groq GPT-OSS 120B',
    description: 'Alternative Groq si dispo',
    caps: ['chat', 'file'],
  },
  {
    id: 'openrouter/auto',
    provider: 'openrouter',
    label: 'OpenRouter (free)',
    description: 'Route vers un modèle free OpenRouter',
    caps: ['chat', 'file'],
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    provider: 'openrouter',
    label: 'Llama 3.3 70B (OR free)',
    description: 'OpenRouter modèle free',
    caps: ['chat', 'file'],
  },
  {
    id: 'pollinations-image',
    provider: 'pollinations',
    label: 'Images (Pollinations)',
    description: 'Génération d’images gratuite',
    caps: ['image'],
    freeNoKey: true,
  },
];

export function modelById(id: string): AiModelOption | undefined {
  return AI_MODELS.find((m) => m.id === id);
}

export function modelsForCap(cap: AiCapability): AiModelOption[] {
  return AI_MODELS.filter((m) => m.caps.includes(cap));
}
