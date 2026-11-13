/**
 * Building blocks of the Performance dashboard: metric explanations, period selector,
 * distribution bars and activity calendar. Purely presentational; all figures come from analytics/*.
 */

import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { ActivitySummary } from '../analytics/metrics';
import { PERIOD_PRESETS, PeriodPreset, BandShare, CalendarDay, calendarMonth } from '../analytics/periods';
import { startOfDay } from '../analytics/performance';
import { MetricKey, WEEKDAYS_SHORT, fr, metricGlossary, monthName, periodLabels } from '../i18n/fr';
import { Button, FONTS, NOMA_COLORS } from './UIComponents';
import { Chip, Field } from './System';
import { Icon } from './Icons';
import { radius } from '../theme/tokens';
import { StatisticsService } from '../services/StatisticsService';

// ---------------------------------------------------------------------------
// Metric explanation
// ---------------------------------------------------------------------------

export const MetricInfo: React.FC<{ metric: MetricKey }> = ({ metric }) => {
  const [open, setOpen] = useState(false);
  const e = metricGlossary[metric];
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={`Comprendre : ${e.title}`}
        style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            borderWidth: 1.5,
            borderColor: NOMA_COLORS.textSecondary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontFamily: FONTS.bodySemiBold, fontSize: 12, color: NOMA_COLORS.textSecondary }}>i</Text>
        </View>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          accessibilityLabel={fr.common.close}
          onPress={() => setOpen(false)}
          style={{ flex: 1, backgroundColor: 'rgba(20,25,22,0.55)', justifyContent: 'flex-end' }}
        >
          <Pressable
            onPress={() => undefined}
            style={{ backgroundColor: NOMA_COLORS.background, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, padding: 24, paddingBottom: 32 }}
          >
            <Text accessibilityRole="header" style={{ fontFamily: FONTS.heading, fontSize: 20, color: NOMA_COLORS.carbon }}>
              {e.title}
            </Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 15, lineHeight: 22, color: NOMA_COLORS.text, marginTop: 10 }}>{e.definition}</Text>
            <Text style={{ fontFamily: FONTS.bodySemiBold, fontSize: 12, letterSpacing: 0.6, color: NOMA_COLORS.textSecondary, marginTop: 16 }}>
              COMMENT C’EST CALCULÉ
            </Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 14, lineHeight: 21, color: NOMA_COLORS.text, marginTop: 4 }}>{e.method}</Text>
            <Text style={{ fontFamily: FONTS.bodySemiBold, fontSize: 12, letterSpacing: 0.6, color: NOMA_COLORS.textSecondary, marginTop: 16 }}>
              À SAVOIR
            </Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 14, lineHeight: 21, color: NOMA_COLORS.text, marginTop: 4 }}>{e.limits}</Text>
            <View style={{ marginTop: 20 }}>
              <Button label={fr.common.close} variant="secondary" onPress={() => setOpen(false)} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

/** Small label + info button row used as a card title. */
export const LabelWithInfo: React.FC<{ label: string; metric: MetricKey }> = ({ label, metric }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    <Text style={{ fontFamily: FONTS.heading, fontSize: 16, color: NOMA_COLORS.carbon }}>{label}</Text>
    <MetricInfo metric={metric} />
  </View>
);

// ---------------------------------------------------------------------------
// Period selector
// ---------------------------------------------------------------------------

export const PeriodSelector: React.FC<{
  preset: PeriodPreset;
  onPreset: (p: PeriodPreset) => void;
  customFrom: string;
  customTo: string;
  onCustomFrom: (v: string) => void;
  onCustomTo: (v: string) => void;
  customError: string | null;
}> = ({ preset, onPreset, customFrom, customTo, onCustomFrom, onCustomTo, customError }) => (
  <View style={{ marginBottom: 16 }}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} accessibilityRole="tablist">
      {PERIOD_PRESETS.map((p) => (
        <Chip key={p} label={periodLabels[p]} selected={preset === p} onPress={() => onPreset(p)} />
      ))}
    </ScrollView>
    {preset === 'custom' && (
      <View style={{ marginTop: 14 }}>
        <Field
          label={fr.performance.customFrom}
          value={customFrom}
          onChangeText={onCustomFrom}
          keyboardType="numbers-and-punctuation"
          placeholder="01/06/2026"
          maxLength={10}
        />
        <Field
          label={fr.performance.customTo}
          value={customTo}
          onChangeText={onCustomTo}
          keyboardType="numbers-and-punctuation"
          placeholder="30/06/2026"
          maxLength={10}
          error={customError}
        />
      </View>
    )}
  </View>
);

// ---------------------------------------------------------------------------
// Distribution
// ---------------------------------------------------------------------------

export const BandBars: React.FC<{ rows: BandShare[] }> = ({ rows }) => (
  <View>
    {rows.map((r) => {
      const pct = Math.round(r.share * 100);
      return (
        <View
          key={r.band.key}
          accessible
          accessibilityLabel={`${r.band.label} : ${fr.common.activities(r.count)}, ${pct} pour cent, ${r.distanceKm.toFixed(1)} kilomètres`}
          style={{ marginBottom: 12 }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 13, color: NOMA_COLORS.text }}>{r.band.label}</Text>
            <Text style={{ fontFamily: FONTS.bodySemiBold, fontSize: 13, color: NOMA_COLORS.charcoal }}>
              {fr.common.activities(r.count)} · {pct} %
            </Text>
          </View>
          <View style={{ height: 10, borderRadius: 5, backgroundColor: NOMA_COLORS.greige, overflow: 'hidden' }}>
            <View style={{ width: `${pct}%`, height: 10, borderRadius: 5, backgroundColor: r.count > 0 ? NOMA_COLORS.seaGreen : 'transparent' }} />
          </View>
        </View>
      );
    })}
  </View>
);

// ---------------------------------------------------------------------------
// Activity calendar
// ---------------------------------------------------------------------------

const LEVEL_BACKGROUND = ['transparent', '#4C8F8933', '#4C8F8999', NOMA_COLORS.seaGreen];

const dayLabel = (d: CalendarDay) => {
  const date = new Date(d.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return d.count === 0
    ? `${date}, aucune sortie`
    : `${date}, ${fr.common.activities(d.count)}, ${d.distanceKm.toFixed(1)} kilomètres`;
};

export const ActivityCalendar: React.FC<{
  items: ActivitySummary[];
  now: number;
  onOpenActivity: (id: string) => void;
}> = ({ items, now, onOpenActivity }) => {
  const today = new Date(now);
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const weeks = useMemo(() => calendarMonth(items, cursor.year, cursor.month), [items, cursor]);
  const todayStart = startOfDay(now);

  const step = (delta: number) => {
    setSelectedDay(null);
    const d = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
  };

  const selected = weeks.flat().find((d) => d.date === selectedDay) ?? null;
  const byId = useMemo(() => new Map(items.map((a) => [a.id, a])), [items]);

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Pressable onPress={() => step(-1)} accessibilityRole="button" accessibilityLabel="Mois précédent" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 22, color: NOMA_COLORS.charcoal }}>‹</Text>
        </Pressable>
        <Text accessibilityRole="header" style={{ fontFamily: FONTS.heading, fontSize: 16, color: NOMA_COLORS.carbon }}>
          {monthName(cursor.month)} {cursor.year}
        </Text>
        <Pressable onPress={() => step(1)} accessibilityRole="button" accessibilityLabel="Mois suivant" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 22, color: NOMA_COLORS.charcoal }}>›</Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row' }} importantForAccessibility="no-hide-descendants">
        {WEEKDAYS_SHORT.map((w, i) => (
          <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: NOMA_COLORS.textSecondary, fontFamily: FONTS.bodyMedium }}>
            {w}
          </Text>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View key={wi} style={{ flexDirection: 'row' }}>
          {week.map((d) => {
            const isToday = d.date === todayStart;
            const isSelected = d.date === selectedDay;
            return (
              <Pressable
                key={d.date}
                onPress={() => setSelectedDay(isSelected ? null : d.date)}
                accessibilityRole="button"
                accessibilityLabel={dayLabel(d)}
                accessibilityState={{ selected: isSelected }}
                style={{ flex: 1, minHeight: 44, padding: 2 }}
              >
                <View
                  style={{
                    flex: 1,
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: LEVEL_BACKGROUND[d.level],
                    borderWidth: isSelected ? 2 : isToday ? 1.5 : 0,
                    borderColor: isSelected ? NOMA_COLORS.carbon : NOMA_COLORS.coral,
                    opacity: d.inMonth ? 1 : 0.35,
                  }}
                >
                  <Text style={{ fontFamily: d.count > 0 ? FONTS.bodySemiBold : FONTS.body, fontSize: 13, color: d.level === 3 ? '#FFFFFF' : NOMA_COLORS.text }}>
                    {d.dayOfMonth}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}

      <View accessibilityLiveRegion="polite" style={{ marginTop: 12, minHeight: 20 }}>
        {selected ? (
          selected.count === 0 ? (
            <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: NOMA_COLORS.textSecondary }}>{dayLabel(selected)}</Text>
          ) : (
            selected.activityIds.map((id) => {
              const a = byId.get(id);
              if (!a) return null;
              return (
                <Pressable
                  key={id}
                  onPress={() => onOpenActivity(id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${a.name}, ${StatisticsService.formatDistance(a.distanceM / 1000)}, ouvrir le détail`}
                  style={{ minHeight: 44, justifyContent: 'center' }}
                >
                  <Text style={{ fontFamily: FONTS.bodySemiBold, fontSize: 14, color: NOMA_COLORS.charcoal }}>
                    {a.name} · {StatisticsService.formatDistance(a.distanceM / 1000)}
                  </Text>
                </Pressable>
              );
            })
          )
        ) : (
          <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: NOMA_COLORS.textSecondary }}>
            L’intensité est relative au mois affiché. Touchez un jour pour voir ses sorties.
          </Text>
        )}
      </View>
    </View>
  );
};
