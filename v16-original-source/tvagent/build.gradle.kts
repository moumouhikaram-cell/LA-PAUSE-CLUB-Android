plugins {
    id("com.android.application")
}

android {
    namespace = "com.lapauseclub.tvagent"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.lapauseclub.tvagent"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
}
