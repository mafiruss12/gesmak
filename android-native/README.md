# GESMAK native (Kotlin)

Fondations de l’app Android **100 % Kotlin / Jetpack Compose**.

## État actuel (v2.0.0-native)
- Écran login (email / téléphone / pseudo)
- Auth Supabase (password grant)
- Session locale (DataStore)
- Déconnexion
- Écran d’accueil minimal

## Pas encore porté
Dashboard, caisse, inventaire, commandes, FCM, offline…

## Build local
```bash
cd android-native
# local.properties : sdk.dir=...
./gradlew :app:assembleDebug -PSUPABASE_URL=... -PSUPABASE_ANON_KEY=...
```

## CI
Workflow `Build GESMAK Native (Kotlin) APK` → artifact `GESMAK-native.apk`.
