plugins {
    id("com.android.application")
}

val pinnedEntitlementKeyFile = rootProject.file("../contracts/security/entitlement-prod-v2-public.der.b64")
val pinnedEntitlementPublicKey = if (pinnedEntitlementKeyFile.exists()) pinnedEntitlementKeyFile.readText().trim() else ""
val entitlementPublicKey = ((findProperty("LA_PAUSE_ENTITLEMENT_PUBLIC_KEY_B64") as String?)
    ?: System.getenv("LA_PAUSE_ENTITLEMENT_PUBLIC_KEY_B64")
    ?: pinnedEntitlementPublicKey).replace("\\", "\\\\").replace("\"", "\\\"")
val entitlementKeyId = ((findProperty("LA_PAUSE_ENTITLEMENT_KEY_ID") as String?)
    ?: System.getenv("LA_PAUSE_ENTITLEMENT_KEY_ID")
    ?: "prod-v2").replace("\\", "\\\\").replace("\"", "\\\"")

android {
    namespace = "com.lapauseclub.manager"
    compileSdk = 36

    buildFeatures {
        buildConfig = true
    }

    defaultConfig {
        applicationId = "com.lapauseclub.manager"
        minSdk = 26
        targetSdk = 36
        versionCode = 30
        versionName = "2.5.0"
        buildConfigField("String", "ENTITLEMENT_PUBLIC_KEY_B64", "\"$entitlementPublicKey\"")
        buildConfigField("String", "ENTITLEMENT_KEY_ID", "\"$entitlementKeyId\"")
    }

    buildTypes {
        debug {
            isMinifyEnabled = false
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
}

dependencies {
    implementation("com.google.zxing:core:3.5.3")
}
