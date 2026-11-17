#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

echo "==> Build web (assets mobiles)"
npm install --legacy-peer-deps
npm run build:mobile

echo "==> Capacitor android"
if [ ! -d android ]; then
  npx cap add android
fi
npx cap sync android

echo "==> Inject permissions (micro, caméra, GPS, notifs…)"
bash scripts/inject-android-permissions.sh

echo "==> Gradle assembleDebug"
cd android
chmod +x gradlew
./gradlew assembleDebug --no-daemon

APK="$(pwd)/app/build/outputs/apk/debug/app-debug.apk"
echo ""
echo "APK prêt :"
echo "  $APK"
ls -lh "$APK"
