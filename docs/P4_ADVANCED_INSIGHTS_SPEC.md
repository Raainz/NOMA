# NOMA - P4 Advanced Insights : specification d'implementation

Statut : S1 a S7 implementes (voir section 9). S0 et S8 restent a faire.

## 1. Vision et perimetre

Mesurer, analyser, visualiser. Aucun coaching, aucune recommandation, aucune IA (reserve a NOMA AI), aucune metrique de capteur absent.

Hors perimetre : centralisation backend des PR et segments, modification de `personalRecords.ts`, `segments.ts`, `efforts.bestEffort` et `prepareTrack`, refonte du design system, nouvelle entree dans la barre d'onglets.

## 2. Etat technique verifie

- Les `stats` stockees viennent de `StatisticsService.computeActivityStats` : somme de tous les points (y compris a travers les trous), `geolib.getDistance` arrondit chaque segment au metre, aucun rejet de saut, le temps en mouvement compte l'intervalle de pause, D+ par pas superieur a 2 m, vitesse max = `point.speed` brute.
- Aucun intervalle de pause n'etait enregistre. Les pauses historiques sont irrecuperables : seules les interruptions de trace de plus de 30 s sont detectables.
- `prepareTrack` (PR et segments) : distance nettoyee, rejet precision > 50 m et vitesse > 10 m/s, trous > 30 s.
- Trois definitions du denivele coexistaient (StatisticsService, `computeSplits`, backend `metrics-v1`).
- Deux allures coexistaient (temps en mouvement sur le resume, temps ecoule sur Accueil, Historique, Analyses).
- Comparaisons semaine et mois : periode partielle contre periode complete.
- `Charts.tsx` : Views uniquement, aucune accessibilite. `react-native-svg` et `date-fns` deja installes.
- Lectures completes (points inclus) repetees : `loadActivities`, `AnalyticsRepository.syncAll`, `SyncContext` (60 s).
- AsyncStorage 2.2.0 sur Android : backend SQLite historique par defaut (`useNextStorage = false`), base plafonnee a 6 Mo (`config.gradle`, `getDatabaseSize()`, reglable par `AsyncStorage_db_size_in_MB`). Version embarquee dans Expo Go : a verifier.
- Coeur d'enregistrement en O(n) (statistiques recalculees chaque seconde, activite en cours serialisee toutes les 5 s) : hors perimetre P4, a mesurer.
- Jest : environnement `node`, `*.test.ts` uniquement, pas de test de composant.

## 3. Architecture cible

1. `app/analytics/metrics.ts` (`metrics-m1`) : metriques de reference, pur.
2. `app/analytics/summaryIndex.ts` : index `NOMA_ACTIVITY_SUMMARIES_V1`, donnees derivees reconstruisibles.
3. `app/analytics/performance.ts` et `app/analytics/periods.ts` : agregats, comparaisons equivalentes, moyennes mobiles, repartitions, regularite, calendrier.
4. `SummariesContext` et `useSummaries` : tous les ecrans lisent les memes resumes.
5. Composants de visualisation et chaines francaises (S5 a S7).

### Definitions (metrics-m1)

| Metrique | Definition |
|---|---|
| Distance | Distance de `prepareTrack` (haversine, rayon 6 371 008,8 m), non arrondie, aucun trou compte |
| Temps ecoule | Fin moins debut |
| Pauses | Champ `pauses` (nouvelles activites). Historique : inconnu (null), jamais infere |
| Interruptions | Silences de plus de 30 s hors pauses enregistrees (tolerance 10 s) |
| Temps en mouvement | Intervalles de 30 s au plus avec vitesse >= 0,5 m/s |
| Allure moyenne | Temps en mouvement / distance (null sous 100 m ou 30 s) ; agregats : somme des temps / somme des distances |
| D+ / D- | Mediane sur 5 points puis hysteresis de 3 m ; indisponible si moins de 80 % des points ont une altitude ; toujours "estime" |
| Vitesse max | Distance / temps sur fenetre >= 5 s de la trace nettoyee ; absente sous 60 s en mouvement ; `point.speed` n'est plus utilise |

## 4. Lots

### P4.1 Fiabilite des donnees (complexite moyenne)
- Conserver : `prepareTrack`, `bestEffort`, `stats` d'origine (valeur enregistree, jamais supprimee).
- Corriger : distance, temps, allure, denivele et vitesse max uniques ; enregistrer les pauses ; ne jamais inventer l'historique.
- Fichiers : `metrics.ts`, `types/index.ts` (`pauses?`), `TrackingContext.tsx` (pauses), `HomeScreen`, `ActivityHistoryScreen`, `ActivityDetailsScreen`, `ActivitySummaryScreen`, `ActivityRow`, `performance.ts`.
- Tests : trace propre, interruption, pauses enregistrees, pause ouverte, arret, points aberrants, vitesse max, denivele (bruit, montee, donnees absentes), repli sur `stats` stockees.
- Acceptation : memes chiffres sur Accueil, Historique, Analyses et Detail (meme fonction) ; distance des fixtures a 0,5 % ; aucune pause historique inventee ; tests PR et segments inchanges.
- Regression : valeurs historiques affichees differentes (decision D13).

### P4.2 Analyses avancees (complexite moyenne)
- Periodes : 7 j, 30 j, 90 j, 12 mois, semaine, mois, annee, personnalisee.
- Comparaison avec la periode equivalente (a date egale pour une periode civile en cours) ; "donnees insuffisantes" explicite : au moins 2 sorties de chaque cote, 3 jours ecoules pour une periode en cours, 3 km cumules de chaque cote pour comparer l'allure.
- Moyenne mobile sur 4 semaines completes (la semaine en cours n'est pas moyennee), repartition des distances et durees, progression par tranche de distance, regularite (semaines actives, serie, ecart moyen), calendrier.
- Fichiers : `performance.ts`, `periods.ts`.
- Acceptation : aucun pourcentage sans les seuils ; calculs sur 1 000 resumes en moins de 50 ms (a mesurer sur appareil).

### P4.3 Tableau de bord (complexite moyenne)
- Faire evoluer `PerformanceScreen` (chip "Analyses" du hub) : selecteur de periode, resume, evolution, repartition, regularite, historique des records en lecture seule, calendrier, detail par metrique (ecran de pile, pas d'onglet).
- Acceptation : aucune nouvelle entree d'onglet ; chaque indicateur relie a ses activites en deux appuis ; etat vide avec invitation a enregistrer.

### P4.4 Visualisation et UX (complexite elevee)
- Francais complet (objet de chaines unique), graphiques interactifs (valeur au toucher, annotations), alternative en liste, accessibilite (libelles, role, resume textuel, cibles >= 44 px), fiches d'explication des metriques, pastilles de synchronisation (icone et texte), etats vides, direction artistique Sand/Carbon, lime avec moderation, corail pour l'interaction.
- `LineChart` en SVG (dependance deja presente).
- Acceptation : aucune chaine anglaise visible, chaque graphique a un libelle accessible, valeurs cles accessibles au toucher.

### P4.5 Performance et stockage (moyenne pour A, elevee pour B)
- A (fait) : index de resumes (une lecture au lieu de tous les points), rattrapage lazy du repository analytique, file de synchronisation lazy, abonnement aux changements de stockage.
- B (optionnel, D6) : separation des points dans des cles dediees, migration par copie verifiee, lecture des deux emplacements, retour arriere par drapeau.
- Acceptation : Accueil et Analyses ne lisent aucun point GPS ; au plus 3 `getItem` au premier rendu ; resume <= 400 octets par activite ; liste de 500 activites en moins de 300 ms (a mesurer sur Android milieu de gamme) ; aucune activite modifiee ou perdue.

## 5. Strategie de migration

- Les activites brutes ne sont jamais reecrites. Les resumes sont derives ; supprimer `NOMA_ACTIVITY_SUMMARIES_V1` (`clearSummaries`) est un retour arriere complet.
- `pauses` est facultatif : les anciennes activites restent valides.
- Phase B : copie, verification, puis suppression.

## 6. Strategie de tests

- Automatises (Jest) : fonctions pures, index de resumes, stockage simule, non-regression PR et segments.
- Validation sur appareil : meme activite sur 4 ecrans, vraie pause, lecteur d'ecran, mouvement reduit, petit et grand ecran, local contre synchronise.
- Mesures reelles : taille d'une sortie (`getStorageStats`), temps de chargement a 100 / 500 / 1 000 activites, limite de 6 Mo, version d'AsyncStorage dans Expo Go.

## 7. Ordre et sprints

| Sprint | Contenu | Dependances |
|---|---|---|
| S0 | Mesures et fixtures | aucune |
| S1 | `metrics.ts` et tests | S0 |
| S2 | Index de resumes, chargement lazy, correction `SyncContext` | S1 |
| S3 | Ecrans branches sur les resumes, enregistrement des pauses | S1, S2 |
| S4 | Moteur de periodes et tests | S1 |
| S5 | Graphiques, accessibilite, glossaire, base francaise | peut commencer des S1 |
| S6 | Tableau de bord | S3, S4, S5 |
| S7 | Passe francaise complete, pastilles de synchronisation, etats vides | S6 |
| S8 | Separation des points (optionnel) | S2 |

## 8. Decisions

D1 resumes derives (retenu) ; D2 pauses dans `Activity` (retenu) ; D3 seuil de mouvement 0,5 m/s ; D4 denivele mediane 5 + hysteresis 3 m ; D5 construction du resume dans `saveActivity` ; D6 separation des points et taille de base Android (a trancher) ; D7 tranches de distance (< 3, 3-5, 5-10, 10-21, > 21 km) ; D8 semaine du lundi, fuseau local ; D9 plage personnalisee sans dependance (a trancher) ; D10 chaines dans un objet unique ; D11 LineChart en SVG ; D12 seuils de donnees insuffisantes ; D13 information sur les valeurs historiques recalculees ; D14 correction des lectures de `SyncContext` (fait).

## 9. Etat d'avancement

- S1 fait : `metrics.ts`, 17 tests.
- S2 fait : `summaryIndex.ts`, `ActivityStorageService` (`getSummaries`, `listActivityIds`, `subscribe`, `clearSummaries`), `AnalyticsRepository` et `SyncService` en chargement lazy, `SummariesContext`.
- S3 fait : Accueil, Historique, Analyses, Detail, Resume, Profil, Records, Segments sur les resumes ; pauses enregistrees (`pauses`). A valider sur appareil.
- S4 fait : `periods.ts` et tests ; comparaisons equivalentes branchees sur Accueil et Analyses.
- S5 fait : `Charts.tsx` (barres et courbes interactives, valeur au toucher, annotation du maximum ou de la meilleure valeur, alternative en liste, libelles accessibles, courbe en SVG, animation unique desactivee en mouvement reduit), `MetricInfo` et glossaire (`app/i18n/fr.ts`), `SyncBadge`.
- S6 fait : `PerformanceScreen` refait (selecteur de periode avec plage personnalisee jj/mm/aaaa sans dependance, resume, comparaison equivalente, distance hebdomadaire, moyenne mobile 4 semaines, allure, repartition, regularite, calendrier, records en lecture seule, sorties de la periode). Aucune nouvelle entree d'onglet.
- S7 fait : Accueil, Historique, Analyses, Detail, Resume, Records, Segments et en-tetes de navigation en francais ; pastille de synchronisation dans les listes et le detail ; etats vides avec invitation a enregistrer.
- Restent en anglais (moteurs PR, hors perimetre) : intitules des succes ("New 5 km PR") et libelles de distances ("Half marathon", "1 mile") dans `personalRecords.ts`.
- A faire : S0 (mesures sur appareil), S8 (separation des points, seulement si les mesures le justifient), validation sur appareil (lecteur d'ecran, mouvement reduit, petit et grand ecran).
