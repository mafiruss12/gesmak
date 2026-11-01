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

## APK Android

Les builds mobiles s’appellent uniquement **GESMAK** (aucun libellé admin / terrain sur le téléphone).

| Fichier release | applicationId (technique) |
|-----------------|---------------------------|
| **GESMAK.apk** | `com.gesmak.app` |
| **GESMAK-plus.apk** | `com.gesmak.plus` |

Les deux ouvrent https://gesmak.vercel.app — le compte connecté détermine l’espace affiché.

Release : https://github.com/mafiruss12/gesmak/releases/tag/apk-latest
