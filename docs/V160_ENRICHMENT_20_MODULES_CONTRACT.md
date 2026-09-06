# LA PAUSE CLUB v1.6.0 FINAL — contrat d'enrichissement des 20 modules

Base produit unique : `android-classic-restored-v160` / `a7e7b81ca3a223d15c867962ae68bc78af9e92c4`.
Branche d'enrichissement : `android-v160-enrichment`.

## Règles absolues

1. `app.js`, `app.css`, `v13`, `v14`, `v15`, `MainActivity` et `CoreStore` historiques restent l'autorité tant qu'un remplacement précis n'est pas validé.
2. Aucun shell v230/v240/v250/v29x/v301 n'est importé.
3. Aucun onboarding/SaaS n'est actif pour le moment.
4. Aucun `location.reload()` n'est autorisé dans la couche `enrich-v160-*`.
5. Une capacité récente est adaptée au moteur v1.6 ; elle ne remplace pas une fonction v1.6 qui fonctionne mieux.
6. Les intégrations sont chargées après `v15.js` et doivent être additives.
7. Toute intégration visible doit conserver le système visuel v1.6 sauf décision explicite contraire.
8. Chaque module a son gate ; un module rouge ne doit pas contaminer les autres.

## Cartographie des 20 modules

| # | Module | Décision v1.6 | État actuel |
|---|---|---|---|
| 1 | Multi-activité + facturation universelle | **ADAPTER**. Conserver PS5/SIM v1.6 ; ajouter les nouveaux modèles autour. | Backend additif `enrich-v160-billing.js` |
| 2 | Parcours session contextuel | **ADAPTER/DEVELOP**. Profils nouveaux, UI v1.6 conservée jusqu'au branchement contrôlé. | Profils data `enrich-v160-session-profiles.js` |
| 3 | Control Center operator-first | **REDEVELOP ON V1.6**. Ne jamais importer la Home/shell v230-v292. Réutiliser seulement les moteurs utiles. | À développer après moteurs |
| 4 | Revenue Actions / CA assisté | **ADAPTER** autour des actions v1.6 existantes. | Mesure extension v1.6 active ; unités/blocs après nouveaux métiers |
| 5 | Next Best Action / Lost Revenue | **ADAPTER** sur données v1.6, sans nouvelle Home. | Calculs `enrich-v160-intelligence.js` |
| 6 | Operator Client Capture | **KEEP + ENRICH**. v1.6 possède déjà CRM/client ; ajouter seulement capture/recherche rapide si elle manque. | Analyse UI à faire avant changement |
| 7 | Device Control v240 | **REDEVELOP NATIVE ADAPTER** sur `MainActivity` v1.6 ; ne jamais importer `NewAppActivity`. | À intégrer avec smoke natif séparé |
| 8 | Owner / Trust / Profit P3 | **ADAPTER**. Réutiliser calculs ; UI Owner actuelle v1.6 reste prioritaire. | Health/forecast/lost revenue/NBA adaptés |
| 9 | Player Growth P4 | **ADAPTER** sur clients/sessions v1.6. | DNA + churn adaptés ; missions/Elo/QR à venir |
| 10 | Finance avancée | **KEEP + GAP FILL**. Auditer remboursements/reçus/avoirs v1.6 avant tout ajout. | Audit requis |
| 11 | Tenant/Workspace/Venue/Branch + RBAC SaaS | **PARKED**. Aucun SaaS actif pour le moment. | Conservé hors runtime |
| 12 | Onboarding SaaS v301 | **PARKED / FORBIDDEN NOW**. | Conservé hors runtime |
| 13 | Setup établissement v301 | **DO NOT IMPORT**. Les réglages utiles seront réécrits dans Paramètres v1.6 si nécessaires. | Parked |
| 14 | Catalogue 24 produits | **KEEP + OPTIONAL SEED**. v1.6 possède déjà Produits ; jamais écraser le catalogue utilisateur. | Seed éventuel uniquement si catalogue vide |
| 15 | Floor Builder | **REDEVELOP ON V1.6** comme sous-module de la Salle/Paramètres, en conservant la Gaming Floor. | À développer |
| 16 | Packages | **KEEP + GAP FILL**. v1.6 a déjà Pass & abonnements ; ajouter wallet/redemption seulement si absent. | Audit requis |
| 17 | Mobile Home v292 | **DO NOT IMPORT VISUAL SHELL**. v1.6 reste référence design. Les KPI/moteurs peuvent être réutilisés plus tard. | Parked visuellement |
| 18 | Mobile interaction hardening | **EXTRACT FIXES ONLY**. Aucun moteur tactile global v297-v303 importé. Corrections ciblées après bug physique prouvé. | Gate no-reload actif |
| 19 | Platform P5 | **SELECTIVE ONLY**. i18n/support/notifications possibles ; onboarding/SaaS/entitlements restent off. | À découper |
| 20 | Sync / sécurité / entitlement offline | **ADAPT TO V1.6 CORE**. Utiliser `CoreStore` historique comme fondation ; pas d'autorité SaaS. | À développer sélectivement |

## Ordre technique interne (pas un ordre produit imposé)

Les dépendances techniques imposent seulement ceci :

- Fondation : runtime additif + gates.
- Moteurs data sans UI : billing, profils, intelligence, player analytics.
- Gap analysis des fonctions déjà présentes en v1.6 : CRM, finance, passes, produits.
- Nouvelles surfaces nécessaires : nouveaux métiers/floor/device, intégrées dans le design v1.6.
- SaaS/onboarding restent hors runtime jusqu'à décision explicite.

Cette carte n'autorise aucune intégration visuelle automatique. Elle empêche précisément le mélange de générations qui a causé les régressions du shell v250.
