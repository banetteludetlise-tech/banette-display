# Banette Display V4.5 Entreprise

Version actuelle : GitHub Pages + Firebase + Cloudinary, issue de la V4.3/V4.4 existante. Voir les nouveautés et réglages V4.5 plus bas.

## Historique V4.3 — installation manuelle

Cette version remplace Firebase Storage par Cloudinary.

## Déjà configuré

- Firebase Authentication et Firestore :
  - projet `banette-display-c5ecd`
- Cloudinary :
  - Cloud name : `pcvsv0co`
  - Upload preset : `banette_display`
  - dossier : `banette-display`

## Installation sur Netlify

1. Décompressez le ZIP.
2. Ouvrez votre projet Netlify.
3. Allez dans **Deploys**.
4. Déposez le dossier décompressé complet dans la zone de déploiement manuel.
5. Attendez le statut **Published**.
6. Ouvrez :
   - écran : `/index.html`
   - administration : `/admin.html`

## Première connexion

Utilisez l’adresse e-mail et le mot de passe créés dans Firebase Authentication.

## Fonctions

- onglets sans limite imposée par le code ;
- photos et vidéos ;
- téléchargement direct vers Cloudinary ;
- widgets ;
- météo ;
- date et heure ;
- informations et rendez-vous ;
- message principal prioritaire ;
- programmation ;
- modification depuis téléphone ou ordinateur ;
- mot de passe modifiable.

## Sécurité importante

Le préréglage Cloudinary `banette_display` est **non signé**, ce qui est obligatoire pour envoyer les fichiers directement depuis un navigateur statique.

Pour limiter les abus dans Cloudinary, il est conseillé de régler le preset avec :
- formats autorisés : jpg, jpeg, png, webp, gif, mp4, webm, mov ;
- taille maximale adaptée ;
- dossier fixe `banette-display`.

Ne communiquez jamais une clé API secrète Cloudinary.


## V4.3
- Titre caché sur écran pour photos/vidéos.
- Image entière par défaut.
- Suppression immédiate Firestore + tentative suppression Cloudinary via delete token.

## V4.5 Entreprise — météo 3 jours et marées

Cette évolution reprend le dépôt existant, dont la base est la V4.3 avec le correctif V4.4 de plein écran TV. Firebase, Cloudinary, contenus, catégories, programmations, couleurs et messages prioritaires sont conservés.

### Accès

- Écran Boutique : https://banetteludetlise-tech.github.io/banette-display/
- Administration : https://banetteludetlise-tech.github.io/banette-display/admin.html
- Météo seule : `index.html?screen=boutique&view=weather`
- Marées seules : `index.html?screen=boutique&view=tides`
- Autre écran : `index.html?screen=vitrine` (ou l’identifiant choisi dans l’administration).

### Météo

Dans **Météo 3 jours**, régler la ville, l’écran, la durée, l’intervalle et chaque information. Les valeurs initiales demandées sont **Combourg / Boutique / 20 secondes toutes les 60 secondes**. L’intervalle se mesure entre deux débuts de passage : 20 s de météo puis 40 s de diaporama. Premier passage après 60 s. Les vidéos et les délais des catégories se mettent en pause, puis reprennent ; une annonce prioritaire interrompt la météo. L’aperçu intégré suit le formulaire ; le lien plein écran affiche les réglages enregistrés.

Les températures, l’état du ciel, la pluie et le vent sont activés par défaut. Les horaires du soleil sont facultatifs. Les prévisions proviennent de [MET Norway](https://api.met.no/weatherapi/locationforecast/2.0/documentation), sous [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), et sont regroupées par date à Paris. Mini/maxi et vent sont calculés sur les créneaux disponibles ; aujourd’hui représente le reste de la journée. Les périodes de pluie ne sont jamais additionnées deux fois. Le risque en pourcentage ne s’affiche que si le fournisseur le transmet. Les valeurs manquantes restent indiquées comme telles.

Actualisation météo au plus une fois par heure, respect du cache HTTP, reprise automatique et cache local. Au-delà de 36 h, les prévisions sont masquées. Une coupure réseau ne permet pas un premier chargement complet hors connexion : aucun service worker n’est ajouté à l’application.

### Marées de Saint-Malo

Dans **Widgets**, activer les marées dans le bandeau, comme page du diaporama, ou les deux ; choisir l’écran et la durée. Le tableau de bord montre aussi le prochain horaire de pleine et basse mer, les hauteurs, coefficients disponibles, tendance et horaires du jour, à l’heure de Paris.

Source : [vignette publique SHOM Saint-Malo](https://services.data.shom.fr/hdm/vignette/grande/SAINT-MALO?locale=fr), [port officiel](https://maree.shom.fr/harbor/SAINT-MALO). Le traitement lit uniquement les chaînes des tables ; aucun JavaScript du fournisseur n’est exécuté par le lecteur ni par le script d’actualisation. Les indications ne remplacent pas les documents nautiques officiels.

Le workflow `refresh-tides.yml` lit et vérifie les sept jours fournis, quatre fois par jour, puis publie `tides.json` sur la branche `tides-data`. Il crée cette branche au premier lancement. Le lecteur consulte ce flux indépendamment des déploiements Pages et conserve une copie locale ; le fichier `data/tides.json` permet un premier affichage. Un échec de mise à jour conserve les données valides précédentes. Une source ancienne est signalée ; les données sans horaires du jour sont masquées. Les horaires GitHub Actions peuvent être retardés. Sur un dépôt public inactif, GitHub peut suspendre les tâches programmées après 60 jours : réactiver le workflow dans Actions si nécessaire.

### Configuration et maintenance

Les nouveaux documents `config/weather` et `config/tides` utilisent les règles Firestore existantes : lecture publique et écriture authentifiée. Aucun effacement ni migration de données n’est requis. Les réglages météo généraux historiques sont conservés dans `config/settings` ; la V4.5 utilise désormais l’onglet **Météo 3 jours** pour la météo et son widget.

GitHub Pages publie la branche `main` à la racine. L’ancien déploiement manuel Netlify n’est pas mis à jour par un envoi GitHub. Aucun secret ni abonnement météo n’est nécessaire.

Vérifications locales, Node 22 ou plus récent :

```sh
node --test tests/*.test.js
node scripts/refresh-tides.mjs
```

Les tests couvrent heure de Paris/changement d’heure, données périmées, parsing SHOM, valeurs météo manquantes, cumuls de pluie, temporisation 20/60, pause/reprise des vidéos, priorité urgente, filtrage par écran et conservation de la programmation média. Les essais de formulaires s’effectuent dans un environnement local simulé, sans écrire dans la boutique en production.
