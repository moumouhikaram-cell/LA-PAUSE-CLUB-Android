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
        versionCode = 21
        versionName = "1.7.1-alpha2"
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
