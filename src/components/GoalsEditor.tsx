import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { UserGoals } from '../types';
import { themedStyles } from '../theme/themedStyles';

interface Props {
  goals: UserGoals;
  onSave: (goals: UserGoals) => void;
  onCancel: () => void;
}

const FIELDS: { key: keyof UserGoals; label: string; unit: 'units.kcal' | 'units.g' }[] = [
  { key: 'kcal', label: 'nutrients.calories', unit: 'units.kcal' },
  { key: 'protein', label: 'nutrients.protein', unit: 'units.g' },
  { key: 'fat', label: 'nutrients.fat', unit: 'units.g' },
  { key: 'carbs', label: 'nutrients.carbs', unit: 'units.g' },
];

export function GoalsEditor({ goals, onSave, onCancel }: Props) {
  const { t } = useTranslation();
  const [text, setText] = useState<Record<keyof UserGoals, string>>({
    kcal: String(Math.round(goals.kcal)),
    protein: String(Math.round(goals.protein)),
    fat: String(Math.round(goals.fat)),
    carbs: String(Math.round(goals.carbs)),
  });

  const parsed = FIELDS.map((f) => parseFloat(text[f.key].replace(',', '.')));
  const valid = parsed.every((n) => Number.isFinite(n) && n > 0);

  const save = () => {
    if (!valid) return;
    onSave({ kcal: parsed[0], protein: parsed[1], fat: parsed[2], carbs: parsed[3] });
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.title}>{t('goals.title')}</Text>
        {FIELDS.map((f) => (
          <View key={f.key} style={styles.row}>
            <Text style={styles.label}>{t(f.label)}</Text>
            <TextInput
              style={styles.input}
              value={text[f.key]}
              onChangeText={(t) => setText((s) => ({ ...s, [f.key]: t.replace(/[^0-9.,]/g, '') }))}
              keyboardType="decimal-pad"
              selectTextOnFocus
              maxLength={6}
            />
            <Text style={styles.unit}>{t(f.unit)}</Text>
          </View>
        ))}
        <Pressable style={[styles.save, !valid && styles.saveDisabled]} onPress={save} disabled={!valid}>
          <Text style={styles.saveText}>{t('common.save')}</Text>
        </Pressable>
        <Pressable style={styles.cancel} onPress={onCancel}>
          <Text style={styles.cancelText}>{t('common.cancel')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = themedStyles((c) =>
  StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  card: { backgroundColor: c.card, borderRadius: 20, padding: 20 },
  title: { color: c.text, fontSize: 20, fontWeight: '800', marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  label: { color: c.text, fontSize: 16, flex: 1 },
  input: {
    width: 110,
    backgroundColor: c.input,
    color: c.text,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  unit: { color: c.textSecondary, width: 40, marginLeft: 8 },
  save: { backgroundColor: c.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  saveDisabled: { backgroundColor: c.accentDisabled },
  saveText: { color: c.onAccent, fontSize: 17, fontWeight: '800' },
  cancel: { alignItems: 'center', paddingTop: 14 },
  cancelText: { color: c.textSecondary, fontSize: 15 },
}),
);
