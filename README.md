# Banette Display V4.3 — Netlify + Firebase + Cloudinary

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
