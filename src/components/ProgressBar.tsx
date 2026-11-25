import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeContext';

interface Props {
  label: string;
  value: number;
  goal: number;
  unit: string;
  color: string;
  /** Large variant for the diary summary (shows "left / over"). */
  large?: boolean;
  /** Show one decimal for small values (micronutrients). */
  precise?: boolean;
}


export function ProgressBar({ label, value, goal, unit, color, large, precise }: Props) {
  const { t } = useTranslation();
  const ratio = goal > 0 ? Math.min(value / goal, 1) : 0;
  const over = goal > 0 && value > goal;
  const { colors: c } = useTheme();
  const textColor = c.text;
  const subColor = c.textSecondary;
  const trackColor = c.track;
  const left = Math.round(goal - value);

  return (
    <View style={large ? styles.largeWrap : styles.smallWrap}>
      <View style={styles.header}>
        <Text style={[large ? styles.largeLabel : styles.smallLabel, { color: textColor }]}>{label}</Text>
        <Text style={[large ? styles.largeValue : styles.smallValue, { color: textColor }]}>
          {fmt(value, precise)} / {fmt(goal, precise)} {unit}
        </Text>
      </View>
      <View style={[styles.track, large && styles.trackLarge, { backgroundColor: trackColor }]}>
        <View
          style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: over ? c.danger : color }]}
        />
      </View>
      {large && (
        <Text style={[styles.remaining, { color: over ? c.danger : subColor }]}>
          {over ? t('diary.over', { value: -left, unit }) : t('diary.left', { value: left, unit })}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  smallWrap: { marginBottom: 14 },
  largeWrap: { marginBottom: 18 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 },
  smallLabel: { fontSize: 12, fontWeight: '700' },
  smallValue: { fontSize: 11, fontWeight: '600' },
  largeLabel: { fontSize: 17, fontWeight: '700' },
  largeValue: { fontSize: 15, fontWeight: '600' },
  track: { height: 5, borderRadius: 3, overflow: 'hidden' },
  trackLarge: { height: 12, borderRadius: 6 },
  fill: { height: '100%', borderRadius: 6 },
  remaining: { fontSize: 13, marginTop: 4 },
});

export const COLORS = {
  kcal: '#ffb300',
  protein: '#42a5f5',
  fat: '#ef5350',
  carbs: '#66bb6a',
};

function fmt(n: number, precise?: boolean): string {
  if (!precise || n >= 100) return String(Math.round(n));
  return String(Math.round(n * 10) / 10);
}
