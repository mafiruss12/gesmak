#!/usr/bin/env bash
# Neutralise le branding Android (libellé GESMAK uniquement).
set -euo pipefail
GRADLE="android/app/build.gradle"
python3 - <<'PY'
from pathlib import Path
p = Path("android/app/build.gradle")
t = p.read_text(encoding="utf-8")
t = t.replace("com.maquismanager.app", "com.gesmak.app")
t = t.replace("com.gesmak.admin", "com.gesmak.app")
# retirer productFlavors si présents (build simple = plus fiable sur CI)
import re
t = re.sub(r"\n\s*flavorDimensions\s+\"[^\"]+\"\s*\n\s*productFlavors\s*\{.*?\n\s*\}\n", "\n", t, flags=re.S)
if 'applicationId "com.gesmak.app"' not in t:
    t = t.replace('applicationId "com.gesmak.app"', 'applicationId "com.gesmak.app"')
    if 'applicationId "' in t and 'com.gesmak.app' not in t:
        t = re.sub(r'applicationId\s+"[^"]+"', 'applicationId "com.gesmak.app"', t, count=1)
p.write_text(t, encoding="utf-8")
print("android branding: com.gesmak.app / no flavors")
PY
mkdir -p android/app/src/main/res/values
cat > android/app/src/main/res/values/strings.xml << 'XML'
<?xml version='1.0' encoding='utf-8'?>
<resources>
    <string name="app_name">GESMAK</string>
    <string name="title_activity_main">GESMAK</string>
    <string name="package_name">com.gesmak.app</string>
    <string name="custom_url_scheme">com.gesmak.app</string>
</resources>
XML
