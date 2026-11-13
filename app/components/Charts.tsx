/**
 * Charts built with plain Views and react-native-svg (no chart dependency).
 *
 * Every chart is interactive (touch a bar or a point to read its value), annotated (maximum / best value
 * always stated in text), accessible (each datum is a labelled button, the key figure is a live region)
 * and has a list alternative. Selection never relies on colour alone: the selected datum is outlined.
 * Animations run once on mount and are skipped when the OS asks for reduced motion.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, Pressable, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { NOMA_COLORS, FONTS } from './UIComponents';
import { motion } from '../theme/tokens';
import { useReducedMotion } from '../theme/useReducedMotion';
import { fr } from '../i18n/fr';

export interface BarDatum {
  /** Short axis label. */
  label: string;
  value: number;
  /** Highlights the datum (e.g. the period in progress). */
  highlight?: boolean;
  /** Spoken / tooltip label, e.g. "semaine du 3 juin". Defaults to `label`. */
  caption?: string;
}

const defaultFormat = (v: number) => v.toFixed(1);

const ChartHeader: React.FC<{ text: string }> = ({ text }) => (
  <Text
    accessibilityLiveRegion="polite"
    style={{ fontFamily: FONTS.bodySemiBold, fontSize: 13, color: NOMA_COLORS.charcoal, minHeight: 20, marginBottom: 8 }}
  >
    {text}
  </Text>
);

const ListToggle: React.FC<{ showList: boolean; onToggle: () => void }> = ({ showList, onToggle }) => (
  <Pressable
    onPress={onToggle}
    accessibilityRole="button"
    style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}
  >
    <Text style={{ fontFamily: FONTS.bodySemiBold, fontSize: 13, color: NOMA_COLORS.coral }}>
      {showList ? fr.common.seeChart : fr.common.seeList}
    </Text>
  </Pressable>
);

const DataList: React.FC<{ rows: Array<{ caption: string; value: string }> }> = ({ rows }) => (
  <View>
    {rows.map((r, i) => (
      <View
        key={`${r.caption}-${i}`}
        accessible
        accessibilityLabel={`${r.caption} : ${r.value}`}
        style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: NOMA_COLORS.greige }}
      >
        <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: NOMA_COLORS.textSecondary }}>{r.caption}</Text>
        <Text style={{ fontFamily: FONTS.bodySemiBold, fontSize: 13, color: NOMA_COLORS.charcoal }}>{r.value}</Text>
      </View>
    ))}
  </View>
);

export const BarChart: React.FC<{
  data: BarDatum[];
  height?: number;
  formatValue?: (v: number) => string;
  /** Unit spoken after the value ("km"). */
  unit?: string;
}> = ({ data, height = 120, formatValue = defaultFormat, unit = '' }) => {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const [selected, setSelected] = useState<number | null>(null);
  const [showList, setShowList] = useState(false);

  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    Animated.timing(progress, { toValue: 1, duration: motion.chart, useNativeDriver: false }).start();
  }, [reduced, progress]);

  const max = Math.max(...data.map((d) => d.value), 0);
  const maxIndex = max > 0 ? data.findIndex((d) => d.value === max) : -1;
  const say = (d: BarDatum) => `${d.caption ?? d.label} : ${formatValue(d.value)}${unit ? ` ${unit}` : ''}`;

  const header =
    selected !== null
      ? say(data[selected])
      : maxIndex >= 0
        ? `${fr.chart.max} : ${say(data[maxIndex])}`
        : fr.chart.tapHint;

  return (
    <View>
      <ChartHeader text={header} />
      {showList ? (
        <DataList rows={data.map((d) => ({ caption: d.caption ?? d.label, value: `${formatValue(d.value)}${unit ? ` ${unit}` : ''}` }))} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: height + 40 }}>
          {data.map((d, i) => {
            const target = Math.max(d.value > 0 ? 4 : 2, max > 0 ? (d.value / max) * height : 0);
            const isSelected = selected === i;
            return (
              <Pressable
                key={`${d.label}-${i}`}
                onPress={() => setSelected(isSelected ? null : i)}
                accessibilityRole="button"
                accessibilityLabel={say(d)}
                accessibilityState={{ selected: isSelected }}
                style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: height + 40, minWidth: 28 }}
              >
                <Text style={{ fontSize: 10, color: NOMA_COLORS.textSecondary, marginBottom: 4, fontFamily: i === maxIndex ? FONTS.bodySemiBold : FONTS.body }}>
                  {d.value > 0 ? formatValue(d.value) : ''}
                </Text>
                <Animated.View
                  style={{
                    width: '60%',
                    height: progress.interpolate({ inputRange: [0, 1], outputRange: [2, target] }),
                    borderRadius: 6,
                    backgroundColor: isSelected
                      ? NOMA_COLORS.coral
                      : d.highlight
                        ? NOMA_COLORS.lime
                        : d.value > 0
                          ? NOMA_COLORS.sage
                          : NOMA_COLORS.greige,
                    borderWidth: isSelected ? 2 : 0,
                    borderColor: NOMA_COLORS.carbon,
                  }}
                />
                <Text style={{ fontSize: 10, color: NOMA_COLORS.textSecondary, marginTop: 6, fontFamily: d.highlight ? FONTS.bodySemiBold : FONTS.body }}>
                  {d.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
      <ListToggle showList={showList} onToggle={() => setShowList((v) => !v)} />
    </View>
  );
};

export const LineChart: React.FC<{
  values: number[];
  /** Spoken / tooltip label of each point (e.g. date). Defaults to "Point n". */
  labels?: string[];
  height?: number;
  color?: string;
  /** Lower values drawn higher (useful for pace). */
  invert?: boolean;
  formatValue?: (v: number) => string;
  unit?: string;
}> = ({ values, labels, height = 120, color = NOMA_COLORS.charcoal, invert = false, formatValue = defaultFormat, unit = '' }) => {
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showList, setShowList] = useState(false);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const caption = (i: number) => labels?.[i] ?? `Point ${i + 1}`;
  const say = (i: number) => `${caption(i)} : ${formatValue(values[i])}${unit ? ` ${unit}` : ''}`;

  const geometry = useMemo(() => {
    if (values.length === 0) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const pad = 12;
    const innerH = height - pad * 2;
    const pts = values.map((v, i) => {
      const ratio = (v - min) / span;
      return {
        x: values.length === 1 ? width / 2 : (i / (values.length - 1)) * (width - pad * 2) + pad,
        y: pad + (invert ? ratio : 1 - ratio) * innerH,
      };
    });
    const bestIndex = values.indexOf(invert ? min : max);
    return { pts, bestIndex };
  }, [values, width, height, invert]);

  if (values.length === 0 || !geometry) return null;
  const { pts, bestIndex } = geometry;
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const header = selected !== null ? say(selected) : `${fr.chart.min} : ${say(bestIndex)}`;

  return (
    <View>
      <ChartHeader text={header} />
      {showList ? (
        <DataList rows={values.map((_, i) => ({ caption: caption(i), value: `${formatValue(values[i])}${unit ? ` ${unit}` : ''}` }))} />
      ) : (
        <View onLayout={onLayout} style={{ height, backgroundColor: NOMA_COLORS.backgroundLight, borderRadius: 14, overflow: 'hidden' }}>
          {width > 0 && (
            <Svg width={width} height={height}>
              {values.length > 1 && <Path d={path} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
              {values.length <= 40 &&
                pts.map((p, i) => (
                  <Circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={selected === i ? 7 : i === bestIndex ? 6 : 4}
                    fill={selected === i ? NOMA_COLORS.coral : NOMA_COLORS.lime}
                    stroke={color}
                    strokeWidth={selected === i ? 2.5 : 1.5}
                  />
                ))}
            </Svg>
          )}
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, flexDirection: 'row' }}>
            {values.map((_, i) => (
              <Pressable
                key={i}
                onPress={() => setSelected(selected === i ? null : i)}
                accessibilityRole="button"
                accessibilityLabel={say(i)}
                accessibilityState={{ selected: selected === i }}
                style={{ flex: 1, minWidth: 28 }}
              />
            ))}
          </View>
        </View>
      )}
      <ListToggle showList={showList} onToggle={() => setShowList((v) => !v)} />
    </View>
  );
};

/** Elevation profile drawn as vertical bars. */
export const ElevationChart: React.FC<{ values: number[]; height?: number }> = ({ values, height = 80 }) => {
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return (
    <View accessible accessibilityLabel={`Profil d'altitude, de ${Math.round(min)} à ${Math.round(max)} mètres`}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height, backgroundColor: NOMA_COLORS.backgroundLight, borderRadius: 14, padding: 6, overflow: 'hidden' }}>
        {values.map((v, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 6 + ((v - min) / span) * (height - 18),
              backgroundColor: NOMA_COLORS.seaGreen,
              borderTopLeftRadius: 2,
              borderTopRightRadius: 2,
            }}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <Text style={{ fontSize: 10, color: NOMA_COLORS.textSecondary }}>{Math.round(min)} m</Text>
        <Text style={{ fontSize: 10, color: NOMA_COLORS.textSecondary }}>{Math.round(max)} m</Text>
      </View>
    </View>
  );
};
