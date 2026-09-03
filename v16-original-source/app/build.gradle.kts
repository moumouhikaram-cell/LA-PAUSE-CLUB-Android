plugins {
    id("com.android.application")
}

android {
    namespace = "com.lapauseclub.manager"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.lapauseclub.manager"
        minSdk = 26
        targetSdk = 36
        versionCode = 23
        versionName = "2.0.0-beta1"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }
}

dependencies {
    implementation("com.google.zxing:core:3.5.3")
}
