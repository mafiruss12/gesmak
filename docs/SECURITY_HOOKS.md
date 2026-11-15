# Hooks de sécurité — Stock Manager AI

## 1. Hooks SQL (triggers)

Fichier : `supabase/migrations/20260911_security_hooks.sql`

À exécuter dans **Supabase → SQL Editor** (une fois).

| Trigger | Effet |
|---------|--------|
| `on_auth_user_created_security` | Nouveau compte → ligne `members` + event `signup` |
| `on_member_security_change` | Changement rôle / MFA → event journalisé |
| `prevent_privilege_escalation` | Bloque l’auto-promotion admin |

## 2. Hook HTTP (Vercel)

URL :
```
https://stock-manager-ktp.vercel.app/api/security/auth-hook
```

Variable Vercel à définir :
- `SECURITY_HOOK_SECRET` (mot de passe long)
- `SUPABASE_SERVICE_ROLE_KEY` (si pas déjà présent)

### Database Webhook Supabase

1. Supabase → **Database** → **Webhooks**
2. Create a new hook
3. Table : `auth.users` (si disponible) ou `public.members`
4. Events : Insert
5. URL : l’URL ci-dessus
6. HTTP Headers : `Authorization: Bearer <SECURITY_HOOK_SECRET>`

### Test manuel

```bash
curl -X POST "https://stock-manager-ktp.vercel.app/api/security/auth-hook" \
  -H "Authorization: Bearer VOTRE_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"type":"login_success","user_id":null,"meta":{"test":true}}'
```

## 3. Côté application

- `logSecurityEvent()` dans `src/lib/securityEvents.ts`
- 2FA forcé admin à la connexion
- CAPTCHA + conditions à l’inscription
