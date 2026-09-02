# Build Android standard

Ouvrir le dossier dans Android Studio puis lancer **Build > Build APK(s)**.

Configuration du projet :
- Application ID : `com.lapauseclub.manager`
- Version : `1.1.0` (code 11)
- Orientation : portrait
- Interface : assets HTML/CSS/JS embarqués dans une WebView native

Le build Android Studio active le bridge natif complet défini dans `MainActivity.java` et `SessionAlarmReceiver.java`.
