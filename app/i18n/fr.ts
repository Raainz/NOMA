/**
 * French strings and metric glossary for the insights screens.
 * One object, no i18n library: full sentences only (no concatenated fragments), so it can be
 * translated or replaced by a library later without touching the screens.
 */

import { PeriodPreset } from '../analytics/periods';

export type MetricKey =
  | 'distance'
  | 'elapsed'
  | 'moving'
  | 'pace'
  | 'speed'
  | 'elevation'
  | 'maxSpeed'
  | 'interruptions'
  | 'movingAverage'
  | 'regularity'
  | 'distribution'
  | 'comparison';

export interface MetricExplanation {
  title: string;
  definition: string;
  method: string;
  limits: string;
}

export const metricGlossary: Record<MetricKey, MetricExplanation> = {
  distance: {
    title: 'Distance',
    definition: 'Longueur du parcours enregistré par le GPS.',
    method:
      "Calculée sur la trace nettoyée : les points imprécis ou aberrants sont écartés et aucune distance n'est ajoutée pendant une interruption du signal.",
    limits: 'Le GPS a une marge d’erreur : sur un trajet bruité, la distance peut varier de quelques dizaines de mètres.',
  },
  elapsed: {
    title: 'Temps écoulé',
    definition: 'Durée entre le début et la fin de la sortie, pauses et arrêts compris.',
    method: 'Heure de fin moins heure de début.',
    limits: 'Ce n’est pas le temps passé à courir : voir « Temps en mouvement ».',
  },
  moving: {
    title: 'Temps en mouvement',
    definition: 'Temps passé à avancer.',
    method: 'Somme des intervalles où la vitesse est d’au moins 0,5 m/s. Les arrêts, les pauses et les interruptions du signal sont exclus.',
    limits: 'Un arrêt de plus de 30 secondes sans point GPS est compté comme une interruption.',
  },
  pace: {
    title: 'Allure moyenne',
    definition: 'Temps nécessaire pour parcourir un kilomètre, en minutes par kilomètre.',
    method: 'Temps en mouvement divisé par la distance. Sur une période : total des temps divisé par total des distances.',
    limits: 'Non affichée sous 100 m ou 30 secondes de mouvement.',
  },
  speed: {
    title: 'Vitesse moyenne',
    definition: 'Distance parcourue par heure de mouvement.',
    method: 'Distance divisée par le temps en mouvement.',
    limits: 'Allure et vitesse sont deux façons de dire la même chose : l’allure est préférée pour la course.',
  },
  elevation: {
    title: 'Dénivelé positif (estimé)',
    definition: 'Cumul des montées de la sortie.',
    method:
      'Altitudes du GPS lissées, puis seules les variations d’au moins 3 m sont comptées.',
    limits:
      "L’altitude GPS est moins précise que la position : le chiffre est une estimation. Il n’est pas affiché si trop de points n'ont pas d'altitude.",
  },
  maxSpeed: {
    title: 'Vitesse maximale',
    definition: 'Vitesse la plus élevée tenue pendant au moins 5 secondes.',
    method: 'Calculée à partir de la trace nettoyée, pas de la vitesse brute du GPS.',
    limits: 'Non affichée si la sortie compte moins d’une minute de mouvement.',
  },
  interruptions: {
    title: 'Interruptions',
    definition: 'Moments de plus de 30 secondes sans signal GPS.',
    method: 'Détectées dans la trace. Une pause enregistrée dans l’application n’est pas comptée comme une interruption.',
    limits: 'Pour les anciennes sorties, une pause et une perte de signal ne se distinguent pas : les pauses passées ne sont pas reconstituées.',
  },
  movingAverage: {
    title: 'Moyenne mobile sur 4 semaines',
    definition: 'Distance hebdomadaire lissée sur les 4 dernières semaines complètes.',
    method: 'Moyenne des 4 semaines qui précèdent. La semaine en cours n’est pas incluse tant qu’elle n’est pas terminée.',
    limits: 'Il faut au moins 4 semaines de données pour afficher la courbe.',
  },
  regularity: {
    title: 'Régularité',
    definition: 'À quelle fréquence vous avez couru sur la période.',
    method: 'Semaines avec au moins une sortie, plus longue série de semaines consécutives, écart moyen entre deux sorties.',
    limits: 'Indicateur descriptif : il ne dit pas s’il faut courir plus ou moins.',
  },
  distribution: {
    title: 'Répartition',
    definition: 'Comment vos sorties se répartissent par distance et par durée.',
    method: 'Chaque sortie est placée dans une tranche ; la part est le nombre de sorties de la tranche sur le total.',
    limits: 'Les tranches sont fixes : 3, 5, 10 et 21 km.',
  },
  comparison: {
    title: 'Comparaison de périodes',
    definition: 'Évolution par rapport à la période équivalente précédente.',
    method:
      'Pour une semaine, un mois ou une année en cours, on compare aux mêmes jours de la période précédente. Pour les autres périodes, à la durée identique juste avant.',
    limits: 'Affichée seulement avec au moins 2 sorties de chaque côté (et 3 km pour comparer l’allure).',
  },
};

export const periodLabels: Record<PeriodPreset, string> = {
  '7d': '7 jours',
  '30d': '30 jours',
  '90d': '90 jours',
  '12m': '12 mois',
  week: 'Semaine',
  month: 'Mois',
  year: 'Année',
  custom: 'Personnalisée',
};

/** What the comparison compares to, per preset. */
export const comparisonCaption: Record<PeriodPreset, string> = {
  '7d': 'vs les 7 jours précédents',
  '30d': 'vs les 30 jours précédents',
  '90d': 'vs les 90 jours précédents',
  '12m': 'vs les 12 mois précédents',
  week: 'vs les mêmes jours de la semaine dernière',
  month: 'vs les mêmes jours du mois dernier',
  year: 'vs les mêmes jours de l’année dernière',
  custom: 'vs la période de même durée qui précède',
};

export const fr = {
  common: {
    close: 'Fermer',
    startRecording: 'Enregistrer une sortie',
    seeList: 'Voir en liste',
    seeChart: 'Voir le graphique',
    noData: '--',
    km: 'km',
    activities: (n: number) => `${n} sortie${n > 1 ? 's' : ''}`,
  },
  sync: {
    synced: 'Sauvegardée',
    pending: 'En attente',
    failed: 'Échec',
  },
  performance: {
    title: 'Analyses',
    subtitle: 'Votre progression, en chiffres',
    emptyTitle: 'Aucune sortie pour le moment',
    emptyBody: 'Vos analyses apparaîtront après votre première sortie.',
    periodEmpty: 'Aucune sortie sur cette période.',
    summary: 'Résumé de la période',
    evolution: 'Évolution',
    weeklyDistance: 'Distance par semaine',
    movingAverage: 'Moyenne mobile sur 4 semaines',
    movingAverageEmpty: 'Il faut au moins 4 semaines complètes de données pour afficher la moyenne mobile.',
    pace: 'Allure par sortie',
    paceEmpty: 'Il faut au moins deux sorties pour tracer l’évolution de l’allure.',
    distribution: 'Répartition',
    byDistance: 'Par distance',
    byDuration: 'Par durée',
    regularity: 'Régularité',
    calendar: 'Calendrier',
    records: 'Vos records',
    recordsEmpty: 'Vos records apparaîtront dès qu’une distance standard sera atteinte.',
    allRecords: 'Voir tous les records',
    recent: 'Sorties de la période',
    customFrom: 'Du (jj/mm/aaaa)',
    customTo: 'Au (jj/mm/aaaa)',
    customInvalid: 'Date invalide',
    customOrder: 'La date de fin précède la date de début',
    insufficientFew: 'Il faut au moins deux sorties sur chaque période pour comparer.',
    insufficientShort: 'La période vient de commencer : la comparaison apparaîtra après quelques jours.',
  },
  metrics: {
    distance: 'Distance',
    activities: 'Sorties',
    moving: 'Temps en mouvement',
    elapsed: 'Temps écoulé',
    pace: 'Allure moyenne',
    elevation: 'D+ (estimé)',
    maxSpeed: 'Vitesse max',
    speed: 'Vitesse',
    activeWeeks: 'Semaines actives',
    longestStreak: 'Plus longue série',
    averageGap: 'Écart moyen',
    activeDays: 'Jours actifs',
  },
  chart: {
    max: 'Maximum',
    min: 'Meilleure valeur',
    selected: 'Sélection',
    tapHint: 'Touchez un point pour voir sa valeur',
  },
};

const MONTHS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const monthName = (month: number): string => MONTHS_LONG[((month % 12) + 12) % 12];
export const WEEKDAYS_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
