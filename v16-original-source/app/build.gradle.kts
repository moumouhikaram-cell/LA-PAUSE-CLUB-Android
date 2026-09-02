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
        versionCode = 20
        versionName = "1.7.0-alpha1"
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
