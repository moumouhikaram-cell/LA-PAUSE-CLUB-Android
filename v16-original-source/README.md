# LA PAUSE CLUB Manager Android — v1.1.0

Application Android de gestion de salle gaming, adaptée à partir des écrans web de LA PAUSE CLUB et conçue pour fonctionner localement avant la synchronisation Web ↔ Android.

## Navigation reprise du manager web

### Exploitation
- Gaming Floor
- Sessions
- Réservations & planning
- File d'attente
- Historique
- Dashboard

### Commerce
- Caisse express
- Commandes live
- Produits
- Clients / CRM
- Tarifs
- Offres & coupons
- Campagnes

### Communauté
- Tournois
- Challenges
- Classements
- Hall PS5

### Parc & technique
- TV & Stations
- Parc matériel

### Système
- Paramètres

## Fonctions principales
- 6 PS5 + 1 Sim Racing par défaut, nombre de postes modifiable.
- Sessions chronométrées ou libres, Solo/Duo, pause, transfert, prolongation, remise, notes.
- Paiements partiels/complets et suivi des impayés.
- Réservations, file d'attente, clients, caisse et shifts.
- Produits, stock et commandes live.
- Tarifs paramétrables.
- Offres/coupons, campagnes, tournois et challenges.
- Classements/Hall PS5.
- Inventaire matériel et activation/désactivation des stations.
- Dashboard et statistiques.
- Sauvegarde locale et contrat de future synchronisation REST/WebSocket.

## Deux couches Android
Le projet standard dans `app/` contient le bridge Android complet : SharedPreferences, vibration, son, notifications, alarmes, import/export de fichiers et requêtes HTTP natives.

Le fichier APK livré séparément est un build de test signé qui embarque la même interface métier et les données locales afin de pouvoir être installé immédiatement sans dépendre de Codex ou du projet web.


## v1.3.0
Sim Racing 45 DH/h, facturation temps/budget/forfait/libre, médias intégrés, CRM de passage, snack illustré, tournois/challenges avancés, light mode et rotation.
