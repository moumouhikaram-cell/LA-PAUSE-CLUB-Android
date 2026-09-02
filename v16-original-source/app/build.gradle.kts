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
        versionCode = 22
        versionName = "1.7.2-alpha3"
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
