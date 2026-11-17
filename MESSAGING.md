# WhatsApp + SMS — Guide d’intégration

## Mode 1 — Lien (déjà actif, gratuit)

À chaque commande / livraison, un bouton ouvre WhatsApp ou SMS avec le texte prérempli.
Aucun compte API requis.

Dans **Paramètres → Messagerie** : choisir **Lien**.

---

## Mode 2 — API automatique

### A) Twilio (SMS + WhatsApp)

1. Créer un compte : https://www.twilio.com
2. Récupérer **Account SID** et **Auth Token**
3. Acheter / activer un numéro SMS
4. Pour WhatsApp : activer le sandbox ou un numéro WhatsApp Business Twilio
5. Dans Supabase → **Edge Functions → Secrets** :
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_FROM_SMS` (ex: `+225XXXXXXXX`)
   - `TWILIO_FROM_WHATSAPP` (ex: `whatsapp:+14155238886`)
6. Déployer la fonction :
   ```bash
   supabase functions deploy send-message
   ```
7. Dans l’app : Paramètres → fournisseur **Twilio**

### B) Meta WhatsApp Cloud API (officiel)

1. https://developers.facebook.com → créer une app **Business**
2. Ajouter le produit **WhatsApp**
3. Copier **Phone number ID** et **Temporary/Permanent token**
4. Secrets Supabase :
   - `META_WA_TOKEN`
   - `META_WA_PHONE_NUMBER_ID`
5. Déployer `send-message`
6. Dans l’app : fournisseur **Meta**

> Les messages WhatsApp “business” vers un client qui ne vous a jamais écrit nécessitent souvent un **template** approuvé par Meta.

---

## Côte d’Ivoire — alternatives SMS

- **Orange SMS API CI**
- **Africa’s Talking**
- **Twilio** (international)

On peut brancher un autre provider dans `supabase/functions/send-message` sur le même modèle.

---

## Fichiers du projet

| Fichier | Rôle |
|---------|------|
| `src/lib/messaging.ts` | Client unifié (lien + API) |
| `src/lib/rentalNotify.ts` | Notifications location + templates |
| `supabase/functions/send-message` | Envoi serveur sécurisé |
| Paramètres → Messagerie | Choix du mode |

## Domaine app

https://maquis-mananger.vercel.app
