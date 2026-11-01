#!/usr/bin/env bash
set -euo pipefail
GRADLE="android/app/build.gradle"
if [ ! -f "$GRADLE" ]; then
  echo "missing $GRADLE"
  exit 1
fi
# Capacitor sync peut réécrire build.gradle — on réapplique les flavors neutres
python3 - <<'PY'
from pathlib import Path
p = Path("android/app/build.gradle")
t = p.read_text(encoding="utf-8")
t = t.replace('namespace "com.maquismanager.app"', 'namespace "com.gesmak.app"')
t = t.replace('applicationId "com.maquismanager.app"', 'applicationId "com.gesmak.app"')
t = t.replace('applicationId "com.gesmak.admin"', 'applicationId "com.gesmak.plus"')
# strip old flavor block if any
import re
t = re.sub(r"\s*flavorDimensions\s+\"[^\"]+\"\s*productFlavors\s*\{.*?\n    \}\n", "\n", t, flags=re.S)
if "productFlavors" not in t:
    t = t.replace(
        "    buildTypes {",
        """    flavorDimensions "target"
    productFlavors {
        primary {
            dimension "target"
            applicationId "com.gesmak.app"
            resValue "string", "app_name", "GESMAK"
        }
        plus {
            dimension "target"
            applicationId "com.gesmak.plus"
            resValue "string", "app_name", "GESMAK"
        }
    }
    buildTypes {""",
        1,
    )
p.write_text(t, encoding="utf-8")
print("flavors ensured")
PY
# strings
mkdir -p android/app/src/primary/res/values android/app/src/plus/res/values
printf '%s\n' '<?xml version="1.0" encoding="utf-8"?><resources><string name="app_name">GESMAK</string><string name="title_activity_main">GESMAK</string></resources>' > android/app/src/primary/res/values/strings.xml
printf '%s\n' '<?xml version="1.0" encoding="utf-8"?><resources><string name="app_name">GESMAK</string><string name="title_activity_main">GESMAK</string></resources>' > android/app/src/plus/res/values/strings.xml
printf '%s\n' '<?xml version="1.0" encoding="utf-8"?><resources><string name="app_name">GESMAK</string><string name="title_activity_main">GESMAK</string><string name="package_name">com.gesmak.app</string><string name="custom_url_scheme">com.gesmak.app</string></resources>' > android/app/src/main/res/values/strings.xml
