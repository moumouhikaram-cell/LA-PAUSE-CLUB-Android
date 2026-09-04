# LA PAUSE OS v2.3 — Audit UX opérateur & contrat métier

## Verdict

La v2.3 actuelle est techniquement testée mais pas encore validée comme outil d'exploitation rapide.
Le centre vend d'abord du temps et de la disponibilité de ressources : chaque clic inutile, chaque libellé ambigu et chaque calcul manuel augmente le temps au comptoir, le risque d'erreur et la perte de revenu.

La prochaine validation ne doit plus répondre seulement à « est-ce que le bouton fonctionne ? », mais à :

1. Est-ce que l'opérateur comprend immédiatement l'état de toute la salle ?
2. Peut-il lancer, modifier, déplacer et terminer une session en quelques secondes ?
3. Le formulaire change-t-il réellement selon la ressource et son modèle de facturation ?
4. Le montant affiché est-il toujours calculé avec le même moteur que le montant encaissé ?
5. Les médias sont-ils configurés en amont, responsives et jamais demandés dans le flux de vente ?
6. Peut-on terminer un rush sans navigation inutile ni calcul mental ?

---

## 1. Défauts prouvés dans l'implémentation actuelle

### 1.1 Faux modèle universel de facturation

`p1-core.js` déclare 8 types de ressources « timed » et le moteur principal expose essentiellement des modèles horaires (`FLAT_HOURLY`, `PER_HOUR_PLAYERS`).
`client-product-setup.js` présente l'étape 3 comme « Tarifs horaires » pour tous les types.
`master-v2-runtime.js` construit les sessions `fixed`, `budget` et `open` à partir d'un `rate` horaire et convertit un budget en minutes avec `(budget / rate) * 60`.

Conséquence : le système est techniquement universel par type, mais pas universel par modèle commercial.

### 1.2 Billard / snooker / ping-pong / custom mal modélisés

Une salle peut vendre :
- une partie,
- un bloc fixe,
- le temps réel à la minute,
- une durée prépayée,
- un forfait,
- un prix fixe par session,
- un prix selon le nombre de joueurs.

Le logiciel ne doit jamais imposer `/h` à une ressource dont le commerce réel utilise une autre unité.

### 1.3 Formulaire de session non contextuel

Le formulaire P1 affiche les mêmes modes `Durée / Budget / Libre` pour toutes les ressources et affiche systématiquement un résumé en `DH/h`.
Pour console, PC et sim, il ajoute des champs jeu ; pour les autres ressources il les masque, mais le modèle de facturation reste horaire.

Le flux contient encore `Image personnalisée (URL, optionnel)` alors que Paramètres > Médias affirme explicitement que les images ne sont jamais demandées lors de l'ouverture d'une session.

### 1.4 Média incohérent et incomplet

La bibliothèque V13 ne contient que : `ps5`, `sim` et quelques catégories de jeux.
Elle ne contient pas de média global éditable pour :
- PC Gaming,
- Billard,
- Snooker,
- Tennis de table,
- Salle privée,
- Custom.

Le fichier `client-product-media.js` possède bien des images premium pour ces types, mais elles ne sont pas administrées par le même écran Paramètres.

Paramètres > Postes V13 ne propose que deux types (`PS5`, `SIM`) alors que le wizard sait créer 8 types.

### 1.5 Dashboard trop analytique, pas assez opérationnel

Le dashboard actuel affiche principalement :
- CA aujourd'hui,
- sessions actives,
- occupation,
- panier moyen,
- graphique 7 jours,
- activité récente,
- réservations,
- quelques raccourcis.

Il ne permet pas de contrôler immédiatement toute la salle depuis la même surface. L'opérateur doit encore aller sur `Salle & stations` pour agir réellement.

Le dashboard cible doit être le poste de commande principal, pas une page de statistiques décorative.

### 1.6 Tests actuels insuffisants pour l'UX

`client-v230-click-matrix.spec.js` teste des contrôles isolés : baseline restaurée avant chaque clic, absence de crash et surface non vide.
Cela ne valide pas :
- une séquence utilisateur complète,
- le nombre de clics,
- la cohérence des champs,
- la cohérence quote -> paiement -> historique,
- la vitesse du parcours,
- les règles propres à chaque ressource.

Le test des 8 types prouve que chaque type peut passer par le moteur, pas que le formulaire et le pricing sont adaptés.

---

## 2. Principe produit : OPERATE NOW, ANALYZE LATER

La Home doit répondre en moins d'une seconde à 7 questions :

- Qu'est-ce qui est libre ?
- Qu'est-ce qui tourne ?
- Qu'est-ce qui se termine bientôt ?
- Qu'est-ce qui dépasse ?
- Qui attend ?
- Qui arrive bientôt ?
- Quel argent / quelle action demande mon attention ?

Les analyses historiques restent disponibles dans Pilotage, mais ne doivent pas prendre la place centrale de l'exploitation.

---

## 3. Dashboard cible — CONTROL CENTER

### Bandeau temps réel

Toujours visible :
- heure locale,
- shift caisse ouvert/fermé,
- CA encaissé aujourd'hui,
- montant attendu caisse,
- occupation,
- ressources libres,
- sessions qui finissent < 10 min,
- dépassements,
- file d'attente.

### Floor live principal

La plus grande zone de l'écran doit afficher toutes les ressources sous forme de cartes compactes responsives.

Carte libre :
- photo responsive,
- nom,
- type lisible (jamais `BILLIARD_TABLE` brut),
- modèle tarifaire lisible (`7 DH / partie`, `0,50 DH / min`, `22 DH / h`, `30 DH / 30 min`, etc.),
- bouton principal Démarrer,
- presets express pertinents.

Carte active :
- client/passage,
- activité ou jeu si pertinent,
- timer ou compteur adapté,
- montant live / montant payé / dû,
- fin prévue si applicable,
- actions 1 tap : prolonger, pause/reprise, encaisser/ajouter vente, terminer,
- Gérer pour actions secondaires.

### Rail opérationnel

À droite tablette / sous le floor mobile :
- prochaines réservations (60–90 min),
- file d'attente,
- paiements/dettes à traiter,
- stock faible,
- incidents / maintenance,
- alertes fin de session.

### Analytics réduites

Le graphique 7 jours ne doit plus dominer l'écran opérateur.
Un petit résumé peut rester ; l'analyse détaillée va dans Pilotage.

---

## 4. Modèle de facturation universel cible

Les types de ressources ne doivent plus être synonymes de modèle de prix.
Chaque RatePlan doit déclarer un modèle explicite.

### Modèles

- `TIME_PRORATED` : temps réel, facturation proratisée (minute/seconde), affichage possible en DH/h.
- `TIME_BLOCK` : bloc de N minutes pour un prix fixe (ex. SIM 15 min = 15 DH).
- `FIXED_SESSION` : session fixe, durée optionnelle, prix fixe.
- `PER_GAME` : prix par partie/manche.
- `PER_PLAYER_GAME` : prix par partie selon nombre de joueurs.
- `CUSTOM_AMOUNT` : montant saisi/confirmé pour une activité custom, si autorisé par configuration.

Compatibilité :
- `FLAT_HOURLY` -> `TIME_PRORATED`
- `PER_HOUR_PLAYERS` / `PER_PLAYER_HOURLY` -> `TIME_PRORATED` avec tiers joueurs.

Aucune migration destructive. Les anciens champs restent lisibles et un `pricingSnapshot` fige le tarif réellement utilisé par chaque session.

---

## 5. Profils de session par ressource

### Console / PS5

Par défaut : temps prépayé ou budget ; session libre optionnelle.
Champs essentiels :
- Solo / Duo,
- durée ou budget,
- client optionnel,
- jeu optionnel (sélection rapide / recherche),
- montant,
- paiement.

Aucun champ image.

### PC Gaming

Temps / budget / pass.
Nombre de joueurs généralement 1 par poste.
Jeu optionnel mais non bloquant.
Aucun champ image.

### Sim Racing

Priorité aux blocs 15 / 30 / 60 min ou packages configurés.
Le marché marocain montre fréquemment ce fonctionnement par créneaux.
Champs secondaires éventuels : pilote, mode/jeu, challenge ; jamais requis pour démarrer.
Aucun champ image.

### Billard

Défaut produit : `PER_GAME` pour respecter l'usage demandé par LA PAUSE, mais configurable par établissement.
Autres modèles autorisés : temps réel à la minute, bloc, prix selon joueurs.
Champs essentiels : nombre de joueurs/équipes si le tarif en dépend, nombre de parties (défaut 1), client optionnel.
Actions pendant session : `+1 partie`, terminer, ajouter produits, encaisser.

### Snooker

Même principe que billard : ne jamais imposer l'heure.
Le site peut choisir `PER_GAME`, `TIME_PRORATED`, `TIME_BLOCK` ou package.

### Tennis de table

Par défaut temps/bloc, mais configurable.
Le formulaire ne montre aucun champ console/jeu.

### Salle privée

Blocs / forfait / durée, capacité de groupe, client/réservation.

### Custom

Le type custom doit exiger au setup :
- libellé activité,
- modèle de facturation,
- unité,
- tarif,
- capacité,
- presets rapides.

---

## 6. UX du formulaire — principe progressive disclosure

Écran court par défaut.

Toujours visibles :
1. ressource,
2. choix commercial principal (preset / partie / durée / budget),
3. nombre de joueurs seulement si pertinent,
4. client facultatif,
5. montant clair,
6. bouton `Encaisser & démarrer` ou `Démarrer` selon politique.

Sous `Plus d'options` seulement :
- note,
- jeu détaillé,
- remise autorisée,
- paramètres spéciaux,
- override de tarif avec autorisation.

Supprimer totalement du parcours :
- URL d'image,
- identifiants techniques,
- codes enum,
- champs non pertinents au type.

---

## 7. Budget de clics cible

Mesuré depuis Home avec l'application déjà ouverte.

- PS5 passage, preset par défaut : <= 3 actions avant démarrage.
- PS5 Duo : <= 4.
- SIM 30 min : <= 3.
- Billard 1 partie : <= 3.
- Billard +1 partie pendant jeu : 1 action.
- Prolonger une session de preset : 1 action depuis Control Center.
- Pause / reprise : 1 action.
- Fin de session : <= 2 actions (action + confirmation si nécessaire).
- Encaisser un montant déjà calculé : <= 2 actions.
- Ajouter un snack à une session active : <= 4 actions.
- Affecter le premier client de la file au premier poste compatible : <= 3 actions.

Les tests Playwright doivent mesurer ces budgets, pas seulement l'absence de crash.

---

## 8. Média cible — MEDIA CENTER

Les médias sont des paramètres, jamais des données de session.

Le Media Center doit couvrir :
- Ressources par type : 8/8,
- override par station,
- catégories / jeux,
- produits,
- événements/tournois/challenges,
- marque (logo / fond si utilisé).

Pour chaque média :
- upload fichier,
- remplacement,
- reset au défaut,
- aperçu portrait et paysage,
- rendu `cover` responsive,
- position/focus configurable ou au minimum prévisualisation du crop,
- fallback local offline.

Un média personnalisé ne doit jamais rendre l'application dépendante d'Internet.
Les URLs externes peuvent être supportées comme option avancée d'administration, mais ne doivent pas apparaître dans le flux de session.

---

## 9. Nouveau protocole de test utilisateur

### Journey tests

Les scénarios ne restaurent plus l'état après chaque clic ; ils reproduisent une vraie journée.

Scénarios minimum :
- ouverture salle / shift,
- rush de 3 clients passage,
- PS5 solo puis duo,
- SIM package,
- billard par partie,
- billard multi-parties,
- PC budget,
- réservation -> arrivée -> session,
- file d'attente -> affectation,
- prolongation,
- changement de station,
- snack pendant session,
- fin + paiement,
- fermeture / rapprochement caisse,
- reload/rotation au milieu du rush.

### Assertions sémantiques

Pour chaque type :
- champs attendus visibles,
- champs interdits absents,
- unité tarifaire correcte,
- quote = transaction = historique,
- timer/compteur correct,
- actions adaptées,
- état dashboard mis à jour immédiatement.

### UX budgets

Le test doit compter :
- clics,
- changements de route,
- ouvertures de modal/sheet,
- champs requis,
- temps d'interaction automatisé indicatif.

### Media tests

- image type -> dashboard,
- override station -> station,
- image de jeu -> session console,
- rotation portrait/paysage sans image cassée,
- fallback offline,
- aucune URL image dans nouveau formulaire session.

---

## 10. Ordre d'implémentation

1. Geler toute notion de FINAL.
2. Ajouter le contrat de billing universel non destructif.
3. Refondre le formulaire de session par profil de ressource.
4. Supprimer l'image URL du parcours de session.
5. Refondre Paramètres > Tarifs / Ressources / Médias pour 8 types.
6. Transformer Home en vrai Control Center opérateur.
7. Ajouter les tests journey + budgets de clics.
8. Faire passer les anciens tests de régression + nouveaux tests UX.
9. Tester APK réelle sur émulateur.
10. Reprendre seulement ensuite la procédure de signature FINAL.
