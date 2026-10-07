# Déploiement Cloudflare Pages — Stock Manager AI

## Build
- Commande : `npm run build`
- Dossier de sortie : `dist`
- Node : 18 ou 20

## Variables d'environnement (Production)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

(et toute autre variable `VITE_*` déjà utilisée sur Vercel)

## SPA
- `public/_redirects` : toutes les routes → `index.html`
- `public/_headers` : sécurité + cache assets

## API / Crons
Les routes `api/` (Vercel) ne sont pas migrées automatiquement.
Rappels journaliers / WhatsApp / CinetPay restent à migrer vers Pages Functions ou Workers si besoin.

## Créer le projet
1. https://dash.cloudflare.com → Workers & Pages → Create → Pages → Connect to Git
2. Repo : mafiruss12/stock-manager-ai (branche main)
3. Build command : npm run build
4. Output : dist
5. Ajouter les variables d'env puis Deploy
