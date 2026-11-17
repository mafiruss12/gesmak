# Stock Manager AI — APK Android

## Domaine chargé par l’APK
**https://stock-manager-ktp.vercel.app** (`capacitor.config.ts` → `server.url`)

## Permissions injectées (Manifest)
- INTERNET, NETWORK
- CAMERA, RECORD_AUDIO (micro)
- ACCESS_FINE/COARSE_LOCATION
- POST_NOTIFICATIONS
- READ_MEDIA_IMAGES / stockage
- VIBRATE

## Build local
```bash
npm install --legacy-peer-deps
bash scripts/build-apk.sh
```
APK : `android/app/build/outputs/apk/debug/app-debug.apk`

## Build via GitHub Actions
1. Repo GitHub → **Actions** → **Build Android APK** → **Run workflow**
2. Télécharger l’artifact `stock-manager-ai-debug`

## Après install
Au premier login : **Ouvrir les paramètres du téléphone** → activer Micro, Caméra, Localisation, Notifications.
