# GESMAK — deux espaces (même dépôt)

## 1. GESMAK Terrain (utilisateurs)
- **Qui** : propriétaire, gérant, caissier, employé
- **URL test** : https://gesmak.vercel.app/login
- **Après connexion** : dashboard établissement, caisse, ventes, stock, commandes
- **Ne contient pas** la console plateforme

## 2. GESMAK Admin (console)
- **Qui** : comptes `admin` ou `super_admin` uniquement
- **URL test** : https://gesmak.vercel.app/admin  
  (après login admin, redirection automatique vers `/admin`)
- **Visuel** : indigo / cyan, header « Console Admin »
- **Contenu** : établissements, membres, abonnements, activité plateforme

## Télécharger le code

```bash
git clone https://github.com/mafiruss12/gesmak.git
cd gesmak
npm install
cp .env.example .env   # si présent — sinon variables VITE_SUPABASE_*
npm run dev
```

- Terrain local : http://localhost:5173/login  
- Admin local : http://localhost:5173/admin (avec un compte admin)

## ZIP source (sans git)

GitHub → bouton **Code** → **Download ZIP**  
https://github.com/mafiruss12/gesmak/archive/refs/heads/main.zip

## Compte de test

- **Terrain** : un compte propriétaire / gérant déjà créé  
- **Admin** : uniquement un membre dont le `role` en base est `admin` ou `super_admin`

Les deux partagent la **même** base Supabase ; seuls l’interface et les droits changent.

## APK Android (2 applications)

| APK | applicationId | Contenu |
|-----|---------------|---------|
| **GESMAK** (terrain) | `com.gesmak.app` | App utilisateurs (caisse, stock…) |
| **GESMAK Admin** | `com.gesmak.admin` | Console admin (indigo) |

Les deux pointent vers **https://gesmak.vercel.app** (màj web sans rebuild).  
Le rôle du compte décide terrain vs `/admin`.

### Télécharger les APK

1. GitHub → onglet **Actions** → workflow **Build GESMAK APKs** → **Run workflow**
2. Ou tag : `git tag apk-1.0 && git push origin apk-1.0`
3. Artifacts / Release : fichiers `GESMAK-terrain-debug.apk` et `GESMAK-admin-debug.apk`

### Build local (PC avec Android SDK)

```bash
bash scripts/build-apk-both.sh
```
