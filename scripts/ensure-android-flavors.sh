#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# MainActivity package must match applicationId or crash at launch
mkdir -p android/app/src/main/java/com/gesmak/app
cat > android/app/src/main/java/com/gesmak/app/MainActivity.java << 'JAVA'
package com.gesmak.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {}
JAVA
rm -rf android/app/src/main/java/com/maquismanager

cat > android/app/build.gradle << 'GRADLE'
apply plugin: 'com.android.application'

android {
    namespace "com.gesmak.app"
    compileSdk rootProject.ext.compileSdkVersion
    defaultConfig {
        applicationId "com.gesmak.app"
        minSdkVersion rootProject.ext.minSdkVersion
        targetSdkVersion rootProject.ext.targetSdkVersion
        versionCode 3
        versionName "1.1.1"
        testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
        aaptOptions {
            ignoreAssetsPattern '!.svn:!.git:!.ds_store:!*.scc:.*:!CVS:!thumbs.db:!picasa.ini:!*~'
        }
    }
    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}

repositories {
    flatDir{
        dirs '../capacitor-cordova-android-plugins/src/main/libs', 'libs'
    }
}

dependencies {
    implementation fileTree(include: ['*.jar'], dir: 'libs')
    implementation "androidx.appcompat:appcompat:$androidxAppCompatVersion"
    implementation "androidx.coordinatorlayout:coordinatorlayout:$androidxCoordinatorLayoutVersion"
    implementation "androidx.core:core-splashscreen:$coreSplashScreenVersion"
    implementation project(':capacitor-android')
    testImplementation "junit:junit:$junitVersion"
    androidTestImplementation "androidx.test.ext:junit:$androidxJunitVersion"
    androidTestImplementation "androidx.test.espresso:espresso-core:$androidxEspressoCoreVersion"
    implementation project(':capacitor-cordova-android-plugins')
}

apply from: 'capacitor.build.gradle'

try {
    def servicesJSON = file('google-services.json')
    if (servicesJSON.text) {
        apply plugin: 'com.google.gms.google-services'
    }
} catch(Exception e) {
    logger.info("google-services.json not found")
}
GRADLE

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

# Manifest with full class name
if [ -f android/app/src/main/AndroidManifest.xml ]; then
  sed -i 's/android:name="\.MainActivity"/android:name="com.gesmak.app.MainActivity"/' android/app/src/main/AndroidManifest.xml || true
fi

echo "ensure: MainActivity com.gesmak.app + GESMAK branding OK"
