# TEST REPORT — LA PAUSE CLUB Android v1.5.0 PARITY

Date : 2026-08-31

## Contrôles exécutés dans l'environnement de préparation
PASS — `node --check` app.js
PASS — `node --check` v13.js
PASS — `node --check` v14.js
PASS — `node --check` v15.js

PASS — compileSdk 36
PASS — targetSdk 36
PASS — versionCode 18
PASS — versionName 1.5.0

PASS — conservation tarifaire Android 22 / 28 / 45
PASS — paiement par défaut `start`
PASS — migration non destructive des réservations legacy → bookings
PASS — route `king` séparée de `hall`
PASS — Hall PS5 Android conservé
PASS — Pass & abonnements
PASS — Pause Points
PASS — Consentements média
PASS — Manettes & accessoires
PASS — Clients & rétention
PASS — Données & sauvegardes
PASS — contrôle global pause/reprise
PASS — checklist de clôture
PASS — références v15.js/v15.css dans index.html
PASS — images dynamiques v1.3.2/v1.4 conservées
PASS — notifications Android natives et configChanges conservés

## À valider uniquement après GitHub Actions
- compilation Gradle Android réelle
- résolution de la dépendance ZXing
- badging APK 1.5.0 / code 18 / target 36
- installation et mise à jour sur téléphone réel
- tests tactiles/rotation/notifications réelles
- test de non-régression avec données v1.4.0 réelles

Aucune compilation APK locale n'est revendiquée dans ce rapport.
