import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import {
  addDiaryEntry,
  deleteDiaryEntry,
  getDailyMicros,
  getDailyTotals,
  getDiaryEntriesByDate,
} from '../db';
import { MICRO_COLORS, MICROS } from '../micros';
import { dayLabel, formatTime, shiftDate, toDateString } from '../dateUtils';
import { currentLocale } from '../i18n';
import { ProgressBar } from './ProgressBar';
import { useTheme } from '../theme/ThemeContext';
import { Icon, IconBadge } from './Icon';
import { StatsView } from './StatsView';
import type { DiaryEntry, MicroAmounts, Nutrients, UserGoals } from '../types';
import { themedStyles } from '../theme/themedStyles';

interface Props {
  goals: UserGoals;
  /** Bumped by the parent whenever diary data changes elsewhere. */
  refreshKey: number;
  onChanged: () => void;
  onScan: () => void;
}

type Mode = 'day' | 'week' | 'month';

const EMPTY: Nutrients = { kcal: 0, protein: 0, fat: 0, carbs: 0 };
const EMPTY_MICROS: MicroAmounts = { fiber: 0, salt: 0, vit_c: 0, vit_d: 0, iron: 0, magnesium: 0, calcium: 0 };

/** "Today" tab: day switcher, progress, food diary card, scan button. */
export function DiaryScreen({ goals, refreshKey, onChanged, onScan }: Props) {
  const { t } = useTranslation();
  const { colors: c } = useTheme();
  const [mode, setMode] = useState<Mode>('day');
  const [date, setDate] = useState(toDateString());
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [totals, setTotals] = useState<Nutrients>(EMPTY);
  const [micros, setMicros] = useState<MicroAmounts>(EMPTY_MICROS);
  const [microOpen, setMicroOpen] = useState(false);

  const kcalUnit = t('units.kcal');
  const gUnit = t('units.g');

  const load = useCallback(async () => {
    const [e, tt, mm] = await Promise.all([
      getDiaryEntriesByDate(date),
      getDailyTotals(date),
      getDailyMicros(date),
    ]);
    setEntries(e);
    setTotals(tt);
    setMicros(mm);
  }, [date]);

  useEffect(() => {
    load().catch(() => {});
  }, [load, refreshKey]);

  const remove = async (id: number) => {
    await deleteDiaryEntry(id);
    onChanged();
  };

  const repeat = async (e: DiaryEntry) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await addDiaryEntry({
      barcode: e.barcode,
      name: e.name,
      weight_g: e.weight_g,
      kcal: e.kcal,
      protein: e.protein,
      fat: e.fat,
      carbs: e.carbs,
      fiber: e.fiber,
      salt: e.salt,
      vit_c: e.vit_c,
      vit_d: e.vit_d,
      iron: e.iron,
      magnesium: e.magnesium,
      calcium: e.calcium,
    });
    // New entry is logged "now", so jump to today to show it.
    setDate(toDateString());
    onChanged();
  };

  const modes: { key: Mode; label: string }[] = [
    { key: 'day', label: t('diary.mode_day') },
    { key: 'week', label: t('diary.mode_week') },
    { key: 'month', label: t('diary.mode_month') },
  ];

  return (
    <View style={styles.screen}>
      <View style={styles.segment}>
        {modes.map((m) => (
          <Pressable
            key={m.key}
            style={[styles.segBtn, mode === m.key && styles.segBtnActive]}
            onPress={() => setMode(m.key)}
          >
            <Text style={[styles.segText, mode === m.key && styles.segTextActive]}>{m.label}</Text>
          </Pressable>
        ))}
      </View>

      {mode === 'day' ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.dayRow}>
            <Pressable style={styles.arrow} onPress={() => setDate((d) => shiftDate(d, -1))}>
              <Icon name="chevron-left" size={30} color={c.text} />
            </Pressable>
            <Text style={styles.dayLabel}>
              {dayLabel(
                date,
                { today: t('diary.today'), yesterday: t('diary.yesterday'), tomorrow: t('diary.tomorrow') },
                currentLocale(),
              )}
            </Text>
            <Pressable style={styles.arrow} onPress={() => setDate((d) => shiftDate(d, 1))}>
              <Icon name="chevron-right" size={30} color={c.text} />
            </Pressable>
          </View>

          <View style={styles.card}>
            <ProgressBar large label={t('nutrients.calories')} unit={kcalUnit} value={totals.kcal} goal={goals.kcal} color={c.progress.kcal} />
            <ProgressBar large label={t('nutrients.protein')} unit={gUnit} value={totals.protein} goal={goals.protein} color={c.progress.protein} />
            <ProgressBar large label={t('nutrients.fat')} unit={gUnit} value={totals.fat} goal={goals.fat} color={c.progress.fat} />
            <ProgressBar large label={t('nutrients.carbs')} unit={gUnit} value={totals.carbs} goal={goals.carbs} color={c.progress.carbs} />
          </View>

          <View style={styles.microCard}>
            <Pressable style={styles.microHeader} onPress={() => setMicroOpen((v) => !v)}>
              <IconBadge name="activity" tone="warm" size={18} box={38} />
              <Text style={styles.microTitle}>{t('micro.title')}</Text>
              <Icon name={microOpen ? 'chevron-up' : 'chevron-down'} size={20} tone="neutral" />
            </Pressable>
            {microOpen && (
              <View style={styles.microBody}>
                {MICROS.map((m) => (
                  <ProgressBar
                    key={m.key}
                    precise
                    label={t(`micro.${m.key}`)}
                    unit={t(`units.${m.unit}`)}
                    value={micros[m.key]}
                    goal={m.daily}
                    color={MICRO_COLORS[m.key]}
                  />
                ))}
              </View>
            )}
          </View>

          <View style={styles.journal}>
            <Text style={styles.journalTitle}>{t('today.journal')}</Text>
            {entries.length === 0 ? (
              <Text style={styles.empty}>{t('diary.empty')}</Text>
            ) : (
              entries.map((item, idx) => (
                <View key={item.id} style={[styles.entry, idx > 0 && styles.entryBorder]}>
                  <View style={styles.entryMain}>
                    <Text style={styles.entryTime}>{formatTime(item.eaten_at)}</Text>
                    <View style={styles.entryInfo}>
                      <Text style={styles.entryName} numberOfLines={2}>
                        {item.name}
                      </Text>
                      <Text style={styles.entryMeta}>
                        {Math.round(item.weight_g)} {gUnit} · {t('nutrients.protein_short')} {item.protein} ·{' '}
                        {t('nutrients.fat_short')} {item.fat} · {t('nutrients.carbs_short')} {item.carbs}
                      </Text>
                    </View>
                    <Text style={styles.entryKcal}>
                      {Math.round(item.kcal)}
                      {'\n'}
                      <Text style={styles.entryKcalUnit}>{kcalUnit}</Text>
                    </Text>
                  </View>
                  <View style={styles.entryActions}>
                    <Pressable style={[styles.actionBtn, styles.repeatBtn]} onPress={() => repeat(item)}>
                      <Icon name="repeat" size={15} tone="accent" />
                      <Text style={styles.actionText}>{t('diary.repeat')}</Text>
                    </Pressable>
                    <Pressable style={[styles.actionBtn, styles.deleteBtn]} onPress={() => remove(item.id)}>
                      <Icon name="trash-2" size={15} tone="danger" />
                      <Text style={styles.actionText}>{t('diary.delete')}</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      ) : (
        <StatsView key={refreshKey} days={mode === 'week' ? 7 : 30} goals={goals} />
      )}

      <Pressable style={styles.fab} onPress={onScan}>
        <Icon name="camera" size={22} color={c.onAccent} />
        <Text style={styles.fabText}>{t('home.scan')}</Text>
      </Pressable>
    </View>
  );
}

const styles = themedStyles((c) =>
  StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg },
  segment: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: c.card,
    borderRadius: 16,
    padding: 4,
  },
  segBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  segBtnActive: { backgroundColor: c.accent },
  segText: { color: c.textSecondary, fontSize: 15, fontWeight: '600' },
  segTextActive: { color: c.onAccent, fontWeight: '800' },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 120 },
  dayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  arrow: { width: 56, height: 48, alignItems: 'center', justifyContent: 'center' },
  dayLabel: { color: c.text, fontSize: 22, fontWeight: '800' },
  card: { backgroundColor: c.card, borderRadius: 24, padding: 20, paddingBottom: 6, marginBottom: 16 },
  microCard: { backgroundColor: c.card, borderRadius: 24, marginBottom: 24, overflow: 'hidden' },
  microHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  microTitle: { color: c.text, fontSize: 17, fontWeight: '800', flex: 1 },
  microBody: { paddingHorizontal: 20, paddingBottom: 6 },
  journal: {
    backgroundColor: c.card2,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: c.border,
    padding: 18,
  },
  journalTitle: { color: c.text, fontSize: 18, fontWeight: '800', marginBottom: 8 },
  empty: { color: c.textMuted, fontSize: 15, paddingVertical: 20, textAlign: 'center' },
  entry: { paddingVertical: 14 },
  entryBorder: { borderTopWidth: 1, borderTopColor: c.border },
  entryMain: { flexDirection: 'row', alignItems: 'center' },
  entryTime: { color: c.textSecondary, fontSize: 14, width: 52 },
  entryInfo: { flex: 1, paddingRight: 10 },
  entryName: { color: c.text, fontSize: 16, fontWeight: '700' },
  entryMeta: { color: c.textSecondary, fontSize: 13, marginTop: 3 },
  entryKcal: { color: c.warn, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  entryKcalUnit: { fontSize: 11, fontWeight: '600' },
  entryActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionBtn: { flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  repeatBtn: { backgroundColor: c.accentSoft },
  deleteBtn: { backgroundColor: c.dangerSoft },
  actionText: { color: c.text, fontSize: 14, fontWeight: '700' },
  fab: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 16,
    height: 64,
    borderRadius: 32,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    elevation: 8,
  },
  fabText: { color: c.onAccent, fontSize: 20, fontWeight: '800' },
}),
);
