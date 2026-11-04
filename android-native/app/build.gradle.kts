plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.gesmak.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.gesmak.app"
        minSdk = 24
        targetSdk = 34
        versionCode = 106
        versionName = "2.0.6-native"
                buildConfigField("String", "SUPABASE_URL", "\"https://ycoaxbgxstxondxxnhhf.supabase.co\"")
                buildConfigField("String", "SUPABASE_ANON_KEY", "\"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inljb2F4Ymd4c3R4b25keHhuaGhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2MTg5MTgsImV4cCI6MjEwMTE5NDkxOH0.iSPqcC8X1BXlgVYfhtFBY4QFq9UwiMycSisfhkNxV80\"")
        buildConfigField("String", "WEB_FALLBACK", "\"https://gesmak.vercel.app\"")
    }

    signingConfigs {
        create("gesmak") {
            storeFile = file("../keystore/gesmak-update.jks")
            storePassword = "gesmakupdate"
            keyAlias = "gesmak"
            keyPassword = "gesmakupdate"
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("gesmak")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            signingConfig = signingConfigs.getByName("gesmak")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.8"
    }
    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.02.00")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.activity:activity-compose:1.8.2")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.7.0")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.navigation:navigation-compose:2.7.7")
    implementation("androidx.datastore:datastore-preferences:1.0.0")

    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.2")

    debugImplementation("androidx.compose.ui:ui-tooling")
}
