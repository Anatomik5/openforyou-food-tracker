import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { getTotalsForLastDays } from '../db';
import { parseLocal } from '../dateUtils';
import { currentLocale } from '../i18n';
import { useTheme } from '../theme/ThemeContext';
import type { DayTotals, UserGoals } from '../types';
import { themedStyles } from '../theme/themedStyles';

interface Props {
  days: 7 | 30;
  goals: UserGoals;
}

const CHART_H = 160;

export function StatsView({ days, goals }: Props) {
  const { t } = useTranslation();
  const { colors: c } = useTheme();
  const [data, setData] = useState<DayTotals[]>([]);

  useEffect(() => {
    let alive = true;
    getTotalsForLastDays(days)
      .then((d) => alive && setData(d))
      .catch(() => alive && setData([]));
    return () => {
      alive = false;
    };
  }, [days]);

  const locale = currentLocale();
  const logged = data.filter((d) => d.kcal > 0);
  const n = logged.length;
  const sum = (k: 'kcal' | 'protein' | 'fat' | 'carbs') => logged.reduce((s, d) => s + d[k], 0);
  const avg = { kcal: n ? sum('kcal') / n : 0, protein: n ? sum('protein') / n : 0, fat: n ? sum('fat') / n : 0, carbs: n ? sum('carbs') / n : 0 };

  // Energy share of macros (4 / 9 / 4 kcal per gram).
  const pk = avg.protein * 4;
  const fk = avg.fat * 9;
  const ck = avg.carbs * 4;
  const macroTotal = pk + fk + ck || 1;
  const macros = [
    { key: 'protein', label: t('nutrients.protein'), grams: avg.protein, pct: (pk / macroTotal) * 100, color: c.progress.protein },
    { key: 'fat', label: t('nutrients.fat'), grams: avg.fat, pct: (fk / macroTotal) * 100, color: c.progress.fat },
    { key: 'carbs', label: t('nutrients.carbs'), grams: avg.carbs, pct: (ck / macroTotal) * 100, color: c.progress.carbs },
  ];

  const maxKcal = Math.max(goals.kcal, ...data.map((d) => d.kcal), 1) * 1.1;
  const goalBottom = (goals.kcal / maxKcal) * CHART_H;

  const shortDate = (s: string) => parseLocal(s).toLocaleDateString(locale, { day: 'numeric', month: 'numeric' });
  const weekday = (s: string) => parseLocal(s).toLocaleDateString(locale, { weekday: 'short' });

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {/* Bar chart */}
      <View style={styles.card}>
        <View style={styles.chart}>
          <View style={[styles.bars, { gap: days === 7 ? 8 : 2 }]}>
            {data.map((d) => (
              <View key={d.date} style={styles.barSlot}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: Math.max((d.kcal / maxKcal) * CHART_H, d.kcal > 0 ? 3 : 0),
                      backgroundColor: d.kcal > goals.kcal ? c.danger : c.progress.kcal,
                    },
                  ]}
                />
              </View>
            ))}
          </View>
          <View style={[styles.goalLine, { bottom: goalBottom }]} pointerEvents="none">
            <Text style={styles.goalText}>{t('stats.goal', { value: Math.round(goals.kcal) })}</Text>
          </View>
        </View>

        {days === 7 ? (
          <View style={[styles.axis, { gap: 8 }]}>
            {data.map((d) => (
              <Text key={d.date} style={styles.axisLabelFlex} numberOfLines={1}>
                {weekday(d.date)}
              </Text>
            ))}
          </View>
        ) : (
          data.length > 0 && (
            <View style={styles.axisBetween}>
              <Text style={styles.axisLabel}>{shortDate(data[0].date)}</Text>
              <Text style={styles.axisLabel}>{shortDate(data[Math.floor(data.length / 2)].date)}</Text>
              <Text style={styles.axisLabel}>{shortDate(data[data.length - 1].date)}</Text>
            </View>
          )
        )}
      </View>

      {n === 0 ? (
        <Text style={styles.empty}>{t('stats.no_data')}</Text>
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('stats.avg_kcal')}</Text>
            <Text style={styles.avgKcal}>
              {Math.round(avg.kcal)} {t('units.kcal')}
            </Text>
            <Text style={styles.sub}>{t('stats.days_logged', { logged: n, total: days })}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('stats.split')}</Text>
            <View style={styles.stack}>
              {macros.map((m) => (
                <View key={m.key} style={{ flex: Math.max(m.pct, 0.5), backgroundColor: m.color }} />
              ))}
            </View>
            {macros.map((m) => (
              <View key={m.key} style={styles.macroRow}>
                <View style={[styles.dot, { backgroundColor: m.color }]} />
                <Text style={styles.macroLabel}>{m.label}</Text>
                <Text style={styles.macroPct}>{Math.round(m.pct)}%</Text>
                <Text style={styles.macroGrams}>{t('stats.per_day', { value: Math.round(m.grams) })}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = themedStyles((c) =>
  StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: c.card, borderRadius: 18, padding: 16, marginBottom: 14 },
  chart: { height: CHART_H, justifyContent: 'flex-end' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: CHART_H },
  barSlot: { flex: 1, justifyContent: 'flex-end', height: CHART_H },
  bar: { width: '100%', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  goalLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1.5, borderTopColor: c.text },
  goalText: { position: 'absolute', right: 0, top: -18, color: c.text, fontSize: 11, fontWeight: '700' },
  axis: { flexDirection: 'row', marginTop: 6 },
  axisLabelFlex: { flex: 1, color: c.textSecondary, fontSize: 11, textAlign: 'center' },
  axisBetween: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  axisLabel: { color: c.textSecondary, fontSize: 11 },
  empty: { color: c.textMuted, textAlign: 'center', marginTop: 10, fontSize: 15 },
  cardTitle: { color: c.textSecondary, fontSize: 13, marginBottom: 6 },
  avgKcal: { color: c.text, fontSize: 34, fontWeight: '800' },
  sub: { color: c.textSecondary, fontSize: 13, marginTop: 2 },
  stack: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', marginBottom: 12 },
  macroRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  macroLabel: { color: c.text, fontSize: 15, flex: 1 },
  macroPct: { color: c.text, fontSize: 15, fontWeight: '800', width: 52, textAlign: 'right' },
  macroGrams: { color: c.textSecondary, fontSize: 13, width: 90, textAlign: 'right' },
}),
);
