import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { currentLanguage, LANGUAGES, setLanguage } from '../i18n';
import { getAllDiaryEntries, getBodyProfile, saveBodyProfile, updateGoals } from '../db';
import {
  calculateGoals,
  DEFAULT_PROFILE,
  type Activity,
  type Build,
  type Sex,
  type Strategy,
} from '../calculator';
import { GoalsEditor } from './GoalsEditor';
import { Icon, IconBadge } from './Icon';
import { ThemeStoreScreen } from './ThemeStoreScreen';
import type { UserGoals } from '../types';
import { themedStyles } from '../theme/themedStyles';

interface Props {
  goals: UserGoals;
  onGoalsChanged: () => void;
}

const csvCell = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`;

/** "Profile" tab: KBJU calculator, language, export. */
export function ProfileScreen({ goals, onGoalsChanged }: Props) {
  const { t } = useTranslation();
  const active = currentLanguage();

  const [sex, setSex] = useState<Sex>(DEFAULT_PROFILE.sex);
  const [age, setAge] = useState(String(DEFAULT_PROFILE.age));
  const [height, setHeight] = useState(String(DEFAULT_PROFILE.height_cm));
  const [weight, setWeight] = useState(String(DEFAULT_PROFILE.weight_kg));
  const [build, setBuild] = useState<Build>(DEFAULT_PROFILE.build);
  const [activity, setActivity] = useState<Activity>(DEFAULT_PROFILE.activity);
  const [strategy, setStrategy] = useState<Strategy>(DEFAULT_PROFILE.strategy);
  const [message, setMessage] = useState<string | null>(null);
  const [editingGoals, setEditingGoals] = useState(false);
  const [storeOpen, setStoreOpen] = useState(false);

  useEffect(() => {
    getBodyProfile().then((p) => {
      if (!p) return;
      setSex(p.sex);
      setAge(String(p.age));
      setHeight(String(p.height_cm));
      setWeight(String(p.weight_kg));
      setBuild(p.build);
      setActivity(p.activity);
      setStrategy(p.strategy);
    });
  }, []);

  const num = (s: string) => parseFloat(s.replace(',', '.'));

  const apply = async () => {
    const a = num(age);
    const h = num(height);
    const w = num(weight);
    if (!(a >= 10 && a <= 100 && h >= 100 && h <= 250 && w >= 30 && w <= 300)) {
      setMessage(t('profile.invalid'));
      return;
    }
    const profile = { sex, age: a, height_cm: h, weight_kg: w, build, activity, strategy };
    const result = calculateGoals(profile);
    await saveBodyProfile(profile);
    await updateGoals(result);
    onGoalsChanged();
    setMessage(
      `${result.kcal} ${t('units.kcal')} · ${t('nutrients.protein_short')} ${result.protein} · ` +
        `${t('nutrients.fat_short')} ${result.fat} · ${t('nutrients.carbs_short')} ${result.carbs}`,
    );
  };

  const exportCsv = async () => {
    const entries = await getAllDiaryEntries();
    if (entries.length === 0) {
      setMessage(t('profile.export_empty'));
      return;
    }
    const header = 'eaten_at,barcode,name,weight_g,kcal,protein,fat,carbs';
    const lines = entries.map((e) =>
      [e.eaten_at, e.barcode, e.name, e.weight_g, e.kcal, e.protein, e.fat, e.carbs].map(csvCell).join(','),
    );
    await Share.share({ title: 'foodtracker-diary.csv', message: [header, ...lines].join('\n') });
  };

  const saveGoals = async (g: UserGoals) => {
    await updateGoals(g);
    setEditingGoals(false);
    onGoalsChanged();
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t('tabs.profile')}</Text>

        <Text style={styles.section}>{t('settings.language')}</Text>
        <View style={styles.row}>
          {LANGUAGES.map((l) => (
            <Choice key={l.code} label={l.label} active={l.code === active} onPress={() => setLanguage(l.code)} />
          ))}
        </View>

        <Pressable style={styles.entry} onPress={() => setStoreOpen(true)}>
          <IconBadge name="droplet" tone="accent" size={18} box={42} />
          <View style={styles.entryText}>
            <Text style={styles.entryTitle}>{t('profile.themes')}</Text>
            <Text style={styles.entryHint}>{t('profile.themes_hint')}</Text>
          </View>
          <Icon name="chevron-right" size={20} tone="neutral" />
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('profile.calc')}</Text>

          <Text style={styles.label}>{t('profile.sex')}</Text>
          <View style={styles.row}>
            <Choice label={t('profile.male')} active={sex === 'male'} onPress={() => setSex('male')} />
            <Choice label={t('profile.female')} active={sex === 'female'} onPress={() => setSex('female')} />
          </View>

          <View style={styles.row}>
            <NumField label={`${t('profile.age')} (${t('profile.years')})`} value={age} onChange={setAge} />
            <NumField label={`${t('profile.height')} (${t('profile.cm')})`} value={height} onChange={setHeight} />
            <NumField label={`${t('profile.weight')} (${t('profile.kg')})`} value={weight} onChange={setWeight} />
          </View>

          <Text style={styles.label}>{t('profile.build')}</Text>
          <View style={styles.wrap}>
            <Choice label={t('profile.lean')} active={build === 'lean'} onPress={() => setBuild('lean')} />
            <Choice label={t('profile.average')} active={build === 'average'} onPress={() => setBuild('average')} />
            <Choice label={t('profile.high')} active={build === 'high'} onPress={() => setBuild('high')} />
          </View>

          <Text style={styles.label}>{t('profile.activity')}</Text>
          <View style={styles.wrap}>
            <Choice label={t('profile.act_sedentary')} active={activity === 'sedentary'} onPress={() => setActivity('sedentary')} />
            <Choice label={t('profile.act_light')} active={activity === 'light'} onPress={() => setActivity('light')} />
            <Choice label={t('profile.act_moderate')} active={activity === 'moderate'} onPress={() => setActivity('moderate')} />
            <Choice label={t('profile.act_high')} active={activity === 'high'} onPress={() => setActivity('high')} />
          </View>

          <Text style={styles.label}>{t('profile.goal')}</Text>
          <View style={styles.wrap}>
            <Choice label={t('profile.goal_lose')} active={strategy === 'lose'} onPress={() => setStrategy('lose')} />
            <Choice label={t('profile.goal_maintain')} active={strategy === 'maintain'} onPress={() => setStrategy('maintain')} />
            <Choice label={t('profile.goal_gain')} active={strategy === 'gain'} onPress={() => setStrategy('gain')} />
            <Choice label={t('profile.goal_lowcarb')} active={strategy === 'lowcarb'} onPress={() => setStrategy('lowcarb')} />
          </View>

          <Pressable style={styles.apply} onPress={apply}>
            <Text style={styles.applyText}>{t('profile.apply')}</Text>
          </Pressable>
          {message && <Text style={styles.message}>{message}</Text>}
          <Text style={styles.calcNote}>{t('profile.disclaimer')}</Text>

          <Text style={styles.current}>
            {t('goals.title')}: {Math.round(goals.kcal)} {t('units.kcal')} · {t('nutrients.protein_short')}{' '}
            {Math.round(goals.protein)} · {t('nutrients.fat_short')} {Math.round(goals.fat)} ·{' '}
            {t('nutrients.carbs_short')} {Math.round(goals.carbs)}
          </Text>
          <Pressable style={styles.secondary} onPress={() => setEditingGoals(true)}>
            <Text style={styles.secondaryText}>{t('profile.manual')}</Text>
          </Pressable>
        </View>

        <Text style={styles.section}>{t('profile.data')}</Text>
        <Pressable style={styles.secondary} onPress={exportCsv}>
          <Icon name="share" size={16} tone="neutral" />
          <Text style={styles.secondaryText}>{t('profile.export')}</Text>
        </Pressable>

        <Text style={styles.disclaimer}>{t('settings.disclaimer')}</Text>
      </ScrollView>

      <ThemeStoreScreen visible={storeOpen} onClose={() => setStoreOpen(false)} />
      {editingGoals && <GoalsEditor goals={goals} onSave={saveGoals} onCancel={() => setEditingGoals(false)} />}
    </View>
  );
}

function Choice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.choice, active && styles.choiceActive]} onPress={onPress}>
      <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text>
    </Pressable>
  );
}

function NumField({ label, value, onChange }: { label: string; value: string; onChange: (s: string) => void }) {
  return (
    <View style={styles.numField}>
      <Text style={styles.numLabel} numberOfLines={1}>
        {label}
      </Text>
      <TextInput
        style={styles.numInput}
        value={value}
        onChangeText={(s) => onChange(s.replace(/[^0-9.,]/g, ''))}
        keyboardType="decimal-pad"
        maxLength={5}
        selectTextOnFocus
      />
    </View>
  );
}

const styles = themedStyles((c) =>
  StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg },
  content: { padding: 20, paddingTop: 12, paddingBottom: 40, gap: 12 },
  title: { color: c.text, fontSize: 26, fontWeight: '800', marginBottom: 4 },
  section: { color: c.textSecondary, fontSize: 14, marginTop: 8 },
  row: { flexDirection: 'row', gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: c.card, borderRadius: 20, padding: 14, borderWidth: 1, borderColor: c.border },
  entryText: { flex: 1 },
  entryTitle: { color: c.text, fontSize: 16, fontWeight: '800' },
  entryHint: { color: c.textSecondary, fontSize: 12, marginTop: 2 },
  card: { backgroundColor: c.card, borderRadius: 24, padding: 20, gap: 12, marginTop: 8 },
  cardTitle: { color: c.text, fontSize: 19, fontWeight: '800' },
  label: { color: c.textSecondary, fontSize: 13, marginTop: 4 },
  choice: { flexGrow: 1, backgroundColor: c.input, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 14, alignItems: 'center' },
  choiceActive: { backgroundColor: c.accent },
  choiceText: { color: c.textSecondary, fontSize: 14, fontWeight: '600' },
  choiceTextActive: { color: c.onAccent, fontWeight: '800' },
  numField: { flex: 1, gap: 6 },
  numLabel: { color: c.textSecondary, fontSize: 12 },
  numInput: {
    backgroundColor: c.input,
    color: c.text,
    borderRadius: 14,
    paddingVertical: 12,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  apply: { backgroundColor: c.accent, borderRadius: 16, paddingVertical: 17, alignItems: 'center', marginTop: 8 },
  applyText: { color: c.onAccent, fontSize: 17, fontWeight: '800' },
  message: { color: c.accent, fontSize: 14, textAlign: 'center' },
  calcNote: { color: c.textMuted, fontSize: 12, textAlign: 'center' },
  current: { color: c.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 4 },
  secondary: { backgroundColor: c.input, borderRadius: 16, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 },
  secondaryText: { color: c.text, fontSize: 15, fontWeight: '700' },
  disclaimer: { color: c.textMuted, fontSize: 12, textAlign: 'center', marginTop: 20 },
}),
);
