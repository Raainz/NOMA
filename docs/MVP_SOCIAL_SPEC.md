# NOMA - MVP social : positionnement, roadmap et specification

Statut : brouillon v1 (13 novembre 2026). Remplace l'ordre de la feuille de route de `backend_dev.txt` (section 17) pour le MVP.

## 1. Positionnement

- **Promesse** : trouver ou, quand et avec qui courir en Tunisie. Le suivi GPS et l'analyse sont le socle, le social est le point fort.
- **Cible n°1** : coureurs debutants et intermediaires. Pas les competiteurs equipes de montres.
- **Point d'entree** : clubs, organisateurs de runs et influenceurs (deja partants). Les membres suivent leurs organisateurs.
- **Acquisition** : influenceurs et clubs, catalogue de parcours et d'evenements alimente par l'equipe, presence sur les reseaux sociaux.
- **Ce que NOMA n'essaie pas d'etre** : un concurrent de Strava sur l'analyse avancee. Le tracking est une necessite, pas un argument de vente.

## 2. Principes

1. Le social ne doit pas dependre de la taille de la communaute : chaque ecran doit avoir de la valeur avec peu d'utilisateurs.
2. Les organisateurs sont des utilisateurs a part entiere : outils de creation, d'inscription et de suivi des presences.
3. Prive par defaut : aucune activite publique sans choix explicite, zone de confidentialite sur les traces.
4. Hors ligne d'abord (deja le cas pour l'enregistrement et la synchronisation).
5. Francais maintenant, arabe (RTL) prevu dans l'i18n des le depart.
6. Pas de scraping de plateformes tierces (voir section 9).

## 3. Feuille de route reordonnee

| Etape | Objectif | Livrables |
|---|---|---|
| M0 - Fiabilisation | Valider l'existant sur le terrain | Tests sur 2-3 telephones Android reels, mesures batterie et precision, correctifs. Aucune nouvelle fonctionnalite sociale avant. |
| M1 - Import | Eviter le demarrage a vide | Import GPX/FIT et Strava (export d'archive puis API), deduplication, export GPX. |
| M2 - Profils et visibilite | Fondation sociale | Profil public, visibilite des activites (prive / abonnes / public), zone de confidentialite, suivre un runner. |
| M3 - Runs et evenements | Raison de venir | Creation et decouverte de runs sociales et d'evenements, inscription, liste des participants, rappels. |
| M4 - Clubs et organisateurs | Point d'entree communautaire | Clubs, roles, runs recurrentes, presences (check-in), communication aux membres. |
| M5 - Catalogue de parcours | Contenu local | Parcours valides (OSM + contributions), fiches, GPX, filtres par ville et distance. |
| M6 - Stabilisation et lancement | Pilote Tunis | Moderation, signalement, monitoring, notifications, beta fermee avec clubs partenaires. |
| Plus tard | Hors MVP | Fil d'actualite, likes et commentaires, paiement en ligne, plans d'entrainement, chaussures, partage de position en direct, moteur de generation de parcours, NOMA AI, Gear. |

Les etapes S3 (PR serveur), S4 (segments serveur) et S5 (moteur de parcours) de la roadmap precedente sont reportees : les PR et segments restent calcules sur le mobile.

## 4. Perimetre du MVP

**Inclus** : enregistrement, analyse existante, import/export, profil public, abonnements entre runners, runs sociales, evenements, clubs, catalogue de parcours, notifications de base.

**Exclus** : fil d'actualite, commentaires, messagerie privee, paiement en ligne, coaching, IA.

## 5. Modele de donnees (ajouts)

Existant : `users`, `refresh_tokens`, `activities`, `activity_points`.

| Table | Champs principaux |
|---|---|
| `profiles` (ou colonnes sur `users`) | handle unique, display_name, city, level (debutant / intermediaire / confirme), bio, avatar_url, is_public |
| `activities` (ajouts) | visibility (private / followers / public), privacy_zone_applied, source (app / gpx / strava), external_id |
| `follows` | follower_id, followed_id, created_at, unique(follower, followed) |
| `clubs` | id, name, slug, city, description, logo_url, visibility, created_by |
| `club_members` | club_id, user_id, role (owner / organizer / member), joined_at |
| `events` | id, organizer_user_id, club_id nullable, kind (social_run / race), title, description, starts_at, city, meeting_point (lat/lon + label), distance_km, pace_min/max, level, capacity, external_registration_url, route_id nullable, status |
| `event_registrations` | event_id, user_id, status (registered / waitlist / cancelled / attended), created_at |
| `routes` | id, title, city, distance_m, elevation_gain_m, surface, geometry (polyline), source (osm / organizer / community), author_id, status (draft / verified), license/attribution |
| `reports` | reporter_id, target_type, target_id, reason, status |
| `notification_tokens` | user_id, device_token, platform |

Index utiles : events(starts_at, city), routes(city, distance_m), follows(followed_id). PostGIS est optionnel pour le MVP (recherche par ville et distance suffisante au depart), a reevaluer pour la recherche "pres de moi".

## 6. API (v1, ajouts)

- Profils : `GET /users/{handle}`, `PATCH /me/profile`.
- Abonnements : `POST /users/{id}/follow`, `DELETE /users/{id}/follow`, `GET /me/following`, `GET /me/followers`.
- Activites : `PATCH /activities/{id}/visibility`, `POST /activities/import` (GPX/FIT), `GET /activities/{id}/export.gpx`.
- Strava : `POST /integrations/strava/connect`, `POST /integrations/strava/import`.
- Evenements : `GET /events` (filtres ville, date, distance, niveau), `POST /events`, `GET /events/{id}`, `PATCH /events/{id}`, `DELETE /events/{id}`, `POST /events/{id}/register`, `DELETE /events/{id}/register`, `GET /events/{id}/participants`, `POST /events/{id}/checkin`.
- Clubs : `GET /clubs`, `POST /clubs`, `GET /clubs/{slug}`, `POST /clubs/{id}/join`, `DELETE /clubs/{id}/join`, `GET /clubs/{id}/members`, `PATCH /clubs/{id}/members/{uid}` (roles).
- Parcours : `GET /routes`, `GET /routes/{id}`, `GET /routes/{id}/export.gpx`, `POST /routes` (contribution), `PATCH /routes/{id}` (verification par un admin).
- Moderation : `POST /reports`.

Regles transverses : verification du proprietaire et des roles sur chaque ecriture, pagination par curseur, idempotence conservee pour la synchro, versionnage `/api/v1`.

## 7. Ecrans mobile

Navigation actuelle conservee ; ajout d'un onglet **Communaute** (ou "Decouvrir") regroupant :
1. Runs et evenements (liste, filtres, fiche, inscription).
2. Clubs (liste, fiche, membres, runs du club).
3. Parcours (catalogue, fiche, telechargement GPX, "courir ce parcours").
4. Profil public d'un runner (stats resumees, activites publiques, bouton suivre).
5. Carte de partage et badge de finish (section 13).

Cote organisateur : creation d'une run ou d'un evenement, liste des inscrits, check-in (QR ou liste), message aux participants.

## 8. Import Strava et GPX

- **GPX/FIT** : parseur cote serveur, conversion vers le format `Activity` existant, recalcul des metriques (`metrics-m1`), deduplication par `source + external_id` et par recouvrement temporel.
- **Strava** : deux voies. (a) import de l'archive d'export de l'utilisateur (aucune dependance API, a livrer en premier) ; (b) OAuth et API Strava pour l'import des activites du compte (verifier les conditions d'usage et les quotas avant de s'engager ; un historique importe ne doit pas etre republie sans accord de l'utilisateur).
- Les activites importees sont **privees par defaut**.

## 9. Sources du catalogue de parcours

Autorise : OpenStreetMap (licence ODbL, attribution obligatoire), parcours fournis par les organisateurs et influenceurs avec leur accord, contributions d'utilisateurs, GPX officiels des courses.

Interdit : scraping de Strava, Wikiloc, Komoot, AllTrails ou toute plateforme dont les conditions l'interdisent ; reutilisation de traces personnelles sans consentement.

Processus : chaque parcours a un statut (brouillon / verifie) et une source tracee. Un parcours n'est jamais presente comme "sur" ; afficher les inconnues (eclairage, trafic, surface) comme "non verifie".

## 10. Confidentialite, securite, moderation

- Activites privees par defaut ; zone de confidentialite (masquage des X premiers et derniers metres) appliquee avant toute publication.
- Lieu de rendez-vous des runs : point public ; adresse exacte seulement apres inscription si l'organisateur le demande.
- Profils organisateurs verifies (badge) pour les clubs et influenceurs partenaires.
- Signalement et suppression de contenu, journal de moderation, suppression de compte et export des donnees.
- Conformite : loi tunisienne sur la protection des donnees personnelles (INPDP) ; consentement explicite pour la localisation et la publication.

## 11. Indicateurs de reussite (pilote Tunis)

- Fiabilite : taux d'activites enregistrees sans perte de trace, impact batterie par heure.
- Activation : % de nouveaux inscrits qui s'inscrivent a une run dans les 7 jours.
- Retention : % d'inscrits revenant a une 2e run, retention a 4 semaines.
- Offre : nombre de runs creees par semaine, nombre d'organisateurs actifs.
- Import : % de nouveaux utilisateurs ayant importe un historique.

## 12. Decisions prises (13 novembre 2026)

1. **Bassin du pilote** : Tunis et environs (Ariana, La Marsa, Carthage, Sidi Bou Said, Gammarth, etc.). Les villes sont des valeurs de reference dans `events` et `routes`.
2. **Besoin des influenceurs** : organiser des runs et offrir un **badge de finish partageable** (visuel soigne pour Instagram, a la maniere de Strava). Voir section 13.
3. **Inscription aux evenements** : liste interne gratuite (pas de paiement, pas de simple lien externe). `external_registration_url` reste optionnel pour les courses officielles.
4. **Strava** : archive d'export + import GPX/FIT au MVP (M1). OAuth reporte apres le pilote, a reevaluer apres lecture des conditions d'usage a jour.

## 13. Badge de finish et partage Instagram

- A la fin d'une run sociale (check-in valide ou activite liee a l'evenement) : generation d'une **carte de partage** (image) avec nom de l'evenement, date, distance, temps, trace stylisee, logo NOMA, avatar de l'organisateur.
- Formats : story 9:16 et publication 1:1 ; fonds clair/sombre ; palette de marque (Sand, Carbon, lime, corail ; Manrope et Inter).
- Partage via la feuille de partage native vers Instagram, WhatsApp, etc. Aucun envoi automatique ; l'utilisateur choisit.
- Respect de la confidentialite : la trace affichee applique la zone de confidentialite ; option "sans trace".
- Badge persistant dans le profil (collection de badges "finisher").
- Technique : rendu cote mobile (react-native-svg deja installe + capture en image), sans service tiers. Aucun badge ne doit exposer de donnees privees.
- Le visuel est un enjeu de marque : prevoir un passage de design dedie (maquettes validees par le guide de marque) avant l'implementation.

## 14. Questions ouvertes

1. Liste des clubs et influenceurs partenaires pour le pilote (noms, nombre, premieres runs prevues).
2. Modele economique cible (commission, abonnement club, partenariats) : a trancher avant M5.
3. Hebergement et budget du backend (PostgreSQL gere, stockage des images et GPX).
4. Arabe : dans le MVP ou juste prepare dans l'i18n ?
5. Check-in du badge : par QR code scanne par l'organisateur, par geolocalisation au point de rendez-vous, ou par activite enregistree ?

## 15. Etat d'avancement

### M2 - Profils et visibilite (code ecrit le 13 novembre 2026, a valider)

Choix d'implementation, parfois differents de la section 5 :
- Le profil public est porte par des colonnes sur `users` (handle, city, level, bio, avatar_url, is_public, privacy_zone_m), pas par une table `profiles`.
- Prive par defaut : `is_public = false`, `activities.visibility = 'private'`. Un profil non public est indistinguable d'un profil inexistant (404). Rendre un profil public exige un pseudo ; partager une activite exige un profil public.
- La zone de confidentialite est appliquee **a la lecture** (200 m par defaut, reglable de 0 a 1000 m) : le tracé brut n'est jamais modifie en base. Une sortie plus courte que deux fois la zone est servie sans tracé. Le champ `privacy_zone_applied` n'est donc pas necessaire.
- Un tiers ne recoit ni `client_metrics`, ni `client_activity_id`, ni la qualite du signal. Les points sont renumerotes depuis 0.
- Suivre est immediat (pas de validation par le coureur suivi). Se desabonner reste possible apres qu'un profil est repasse en prive.
- Ajout hors liste initiale : `GET /users?q=&city=` (recherche de coureurs publics) ; sans cela personne ne peut se trouver au lancement.
- Pas d'envoi d'avatar : `avatar_url` existe en base mais n'est pas modifiable tant que le stockage d'images n'est pas decide (question ouverte 3).

Endpoints : `PATCH /me/profile`, `GET /users`, `GET /users/{handle}`, `GET /users/{handle}/activities[/{id}]`, `POST|DELETE /users/{id}/follow`, `GET /me/following`, `GET /me/followers`, `PATCH /activities/{id}/visibility`. Migration `0002`.

Mobile : ecran Profil public (pseudo, ville, niveau, zone), Coureurs (recherche, suivre), profil d'un coureur, carte Visibilite dans le detail d'une activite.
