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
./gradlew assemblePrimaryDebug assemblePlusDebug --no-daemon

mkdir -p ../out-apk
cp app/build/outputs/apk/primary/debug/*.apk ../out-apk/GESMAK.apk
cp app/build/outputs/apk/plus/debug/*.apk ../out-apk/GESMAK-plus.apk
ls -lh ../out-apk
