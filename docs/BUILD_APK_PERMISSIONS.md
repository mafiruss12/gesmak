# Build APK avec permissions (localisation, notifications, caméra, galerie, stockage)

## Sur une machine avec Android SDK

```bash
npm install
npm run build
npx cap add android   # une seule fois
npx cap sync android
bash scripts/inject-android-permissions.sh
cd android && ./gradlew assembleDebug
```

APK : `android/app/build/outputs/apk/debug/app-debug.apk`

## Permissions injectées
- INTERNET, NETWORK_STATE
- ACCESS_FINE/COARSE_LOCATION
- CAMERA, READ_MEDIA_IMAGES
- POST_NOTIFICATIONS, VIBRATE

L’APK charge https://stock-manager-ktp.vercel.app : l’écran « Autorisations recommandées » demande aussi les accès au premier login.
