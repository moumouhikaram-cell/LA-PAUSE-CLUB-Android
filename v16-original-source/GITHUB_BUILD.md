# GitHub Actions APK build

The workflow `.github/workflows/build-apk.yml` builds a real Android debug APK on GitHub-hosted Ubuntu runners.

Build target:
- applicationId: `com.lapauseclub.manager`
- version: `1.1.1` (versionCode 12)
- minSdk: 26
- targetSdk: 36
- compileSdk: 37
- AGP: 9.2.1
- Gradle: 9.4.1
- Java: 21

Output artifact:
`LA-PAUSE-CLUB-Manager-v1.1.1-debug.apk`
