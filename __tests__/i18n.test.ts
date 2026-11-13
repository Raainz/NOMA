import { PERIOD_PRESETS } from '../app/analytics/periods';
import { comparisonCaption, fr, metricGlossary, monthName, periodLabels } from '../app/i18n/fr';

describe('French strings', () => {
  it('explains every metric with a definition, a method and its limits', () => {
    for (const [key, e] of Object.entries(metricGlossary)) {
      expect(e.title.length).toBeGreaterThan(2);
      expect(e.definition.length).toBeGreaterThan(10);
      expect(e.method.length).toBeGreaterThan(10);
      expect(e.limits.length).toBeGreaterThan(10);
      expect(key).toBeTruthy();
    }
  });

  it('labels every period preset and its comparison', () => {
    for (const p of PERIOD_PRESETS) {
      expect(periodLabels[p]).toBeTruthy();
      expect(comparisonCaption[p]).toMatch(/^vs /);
    }
  });

  it('pluralizes activity counts', () => {
    expect(fr.common.activities(0)).toBe('0 sortie');
    expect(fr.common.activities(1)).toBe('1 sortie');
    expect(fr.common.activities(2)).toBe('2 sorties');
  });

  it('names months in French and wraps around', () => {
    expect(monthName(0)).toBe('janvier');
    expect(monthName(11)).toBe('décembre');
    expect(monthName(12)).toBe('janvier');
    expect(monthName(-1)).toBe('décembre');
  });

  it('has a message for every social error the server can return', () => {
    for (const code of ['handle_taken', 'handle_required', 'profile_not_public', 'validation_error', 'not_found', 'cannot_follow_self', 'fallback']) {
      expect(fr.social.errors[code]).toBeTruthy();
    }
  });

  it('pluralizes follower counts', () => {
    expect(fr.social.followers(1)).toBe('1 abonné');
    expect(fr.social.followers(3)).toBe('3 abonnés');
  });
});
