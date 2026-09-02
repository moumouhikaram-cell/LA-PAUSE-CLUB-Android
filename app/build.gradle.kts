plugins {
    id("com.android.application")
}

android {
    namespace = "com.lapauseclub.manager.a1"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.lapauseclub.manager.a1"
        minSdk = 26
        targetSdk = 35
        versionCode = 20
        versionName = "1.6.1-a1.1"

        testInstrumentationRunner = "android.test.InstrumentationTestRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    testOptions {
        unitTests.isReturnDefaultValues = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    testImplementation("junit:junit:4.13.2")
}
