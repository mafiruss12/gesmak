/** Contact pro — uniquement via escalade assistance IA, pas affiché partout */
export const SUPPORT_EMAIL = 'kevintechpro0@gmail.com';

export function supportMailto(subject?: string, body?: string): string {
  const s = encodeURIComponent(subject || 'Assistance GESMAK');
  const b = encodeURIComponent(
    body ||
      'Bonjour Kevin Tech Pro,\n\nL’assistant IA n’a pas pu résoudre mon problème.\n\nDescription :\n\n',
  );
  return `mailto:${SUPPORT_EMAIL}?subject=${s}&body=${b}`;
}
