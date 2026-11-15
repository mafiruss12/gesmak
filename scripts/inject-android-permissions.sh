#!/usr/bin/env bash
set -euo pipefail
MANIFEST="android/app/src/main/AndroidManifest.xml"
if [ ! -f "$MANIFEST" ]; then
  echo "Pas de projet android. Lance: npx cap add android && npx cap sync android"
  exit 1
fi
python3 << 'PY'
from pathlib import Path
p = Path("android/app/src/main/AndroidManifest.xml")
c = p.read_text()
perms = [
  "android.permission.INTERNET",
  "android.permission.ACCESS_NETWORK_STATE",
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.CAMERA",
  "android.permission.RECORD_AUDIO",
  "android.permission.MODIFY_AUDIO_SETTINGS",
  "android.permission.READ_MEDIA_IMAGES",
  "android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.WRITE_EXTERNAL_STORAGE",
  "android.permission.POST_NOTIFICATIONS",
  "android.permission.VIBRATE",
]
features = [
  ('android.hardware.camera', 'false'),
  ('android.hardware.microphone', 'false'),
]
for perm in perms:
    if perm not in c:
        tag = f'    <uses-permission android:name="{perm}" />'
        if "<application" in c:
            c = c.replace("<application", tag + "\n    <application", 1)
for name, req in features:
    if name not in c:
        tag = f'    <uses-feature android:name="{name}" android:required="{req}" />'
        if "<application" in c:
            c = c.replace("<application", tag + "\n    <application", 1)
p.write_text(c)
print("OK permissions:", p)
PY
