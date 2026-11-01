#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

npm install --legacy-peer-deps
npm run build:mobile
npx cap sync android
bash scripts/inject-android-permissions.sh || true
cd android
chmod +x gradlew
./gradlew assembleTerrainDebug assembleAdminDebug --no-daemon

echo "APK Terrain:"
ls -lh app/build/outputs/apk/terrain/debug/*.apk || ls -lh app/build/outputs/apk/**/*.apk
echo "APK Admin:"
ls -lh app/build/outputs/apk/admin/debug/*.apk || true
