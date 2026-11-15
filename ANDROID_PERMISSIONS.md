# Permissions Android — Stock Manager AI (APK)

## Problème
Si l’écran Android « Autorisations des applications » ne montre que **Notifications**,
le manifeste de l’APK **ne déclare pas** micro, caméra et localisation.
Le système n’affichera **jamais** la demande.

## Permissions à déclarer (AndroidManifest.xml)
```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
```

Fichier modèle dans le dépôt : `android/app/src/main/AndroidManifest.xml`

## Rebuild APK
```bash
npm run build
npx cap sync android
# Ouvrir Android Studio → Build → Generate Signed Bundle / APK
```

Après installation de la **nouvelle** APK, Réglages → Apps → Stock AI → Autorisations
doit lister Micro, Caméra, Localisation, Notifications.
