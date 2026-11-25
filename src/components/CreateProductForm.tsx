import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MICROS } from '../micros';
import { IconBadge } from './Icon';
import { useTheme } from '../theme/ThemeContext';
import type { MicroKey, Product } from '../types';
import { themedStyles } from '../theme/themedStyles';

interface Props {
  initialName?: string;
  /** If set, the product is permanently bound to this scanned barcode. */
  barcode?: string;
  saveLabel?: string;
  onSave: (p: Product) => void;
  onCancel: () => void;
}

/** Returns null for an empty field, NaN for an invalid one. */
const num = (s: string): number | null => {
  const t = s.trim().replace(',', '.');
  if (t === '') return null;
  const n = parseFloat(t);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};

export function CreateProductForm({ initialName = '', barcode, saveLabel, onSave, onCancel }: Props) {
  const { t } = useTranslation();
  const { colors: c } = useTheme();
  const [name, setName] = useState(initialName);
  const [weight, setWeight] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');
  const [showMicro, setShowMicro] = useState(false);
  const [micro, setMicro] = useState<Record<MicroKey, string>>({
    fiber: '',
    salt: '',
    vit_c: '',
    vit_d: '',
    iron: '',
    magnesium: '',
    calcium: '',
  });

  const main = [kcal, protein, fat, carbs, weight].map(num);
  const microVals = MICROS.map((m) => num(micro[m.key]));
  const valid =
    name.trim().length > 0 &&
    main[0] !== null &&
    [...main, ...microVals].every((v) => v === null || !Number.isNaN(v));

  const save = () => {
    if (!valid) return;
    const rand = Math.random().toString(36).slice(2, 7);
    const p: Product = {
      barcode: barcode ?? `custom-${Date.now().toString(36)}${rand}`,
      name: name.trim(),
      brand: null,
      kcal_100g: main[0] as number,
      protein_100g: (main[1] as number | null) ?? 0,
      fat_100g: (main[2] as number | null) ?? 0,
      carbs_100g: (main[3] as number | null) ?? 0,
      default_weight_g: main[4] && main[4] > 0 ? (main[4] as number) : null,
      fiber_100g: null,
      salt_100g: null,
      vit_c_100g: null,
      vit_d_100g: null,
      iron_100g: null,
      magnesium_100g: null,
      calcium_100g: null,
      updated_at: Date.now(),
    };
    MICROS.forEach((m, i) => {
      (p as unknown as Record<string, number | null>)[m.field as string] = microVals[i] as number | null;
    });
    onSave(p);
  };

  const field = (label: string, value: string, set: (s: string) => void, numeric = true) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={(s) => set(numeric ? s.replace(/[^0-9.,]/g, '') : s)}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        placeholderTextColor={c.textMuted}
        maxLength={numeric ? 8 : 80}
      />
    </View>
  );

  const g = t('units.g');
  const unitName = (u: 'g' | 'mg' | 'mcg') => t(`units.${u}`);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{t('create.title')}</Text>
      {barcode && <Text style={styles.barcode}>{t('create.barcode', { barcode })}</Text>}

      {field(t('create.name'), name, setName, false)}
      {field(t('create.weight'), weight, setWeight)}
      {field(t('create.kcal'), kcal, setKcal)}
      {field(`${t('create.protein')}`, protein, setProtein)}
      {field(`${t('create.fat')}`, fat, setFat)}
      {field(`${t('create.carbs')}`, carbs, setCarbs)}

      <Pressable style={styles.toggle} onPress={() => setShowMicro((v) => !v)}>
        <IconBadge name={showMicro ? 'minus' : 'plus'} tone="warm" size={15} box={28} />
        <Text style={styles.toggleText}>{showMicro ? t('create.micro_hide') : t('create.micro_show')}</Text>
      </Pressable>

      {showMicro && (
        <View style={styles.microBox}>
          <Text style={styles.microHint}>{t('create.micro_hint')}</Text>
          {MICROS.map((m) =>
            field(`${t(`micro.${m.key}`)} (${unitName(m.unit)} / 100 ${g})`, micro[m.key], (s) =>
              setMicro((prev) => ({ ...prev, [m.key]: s })),
            ),
          )}
        </View>
      )}

      <Pressable style={[styles.save, !valid && styles.saveDisabled]} onPress={save} disabled={!valid}>
        <Text style={styles.saveText}>{saveLabel ?? t('create.save')}</Text>
      </Pressable>
      <Pressable style={styles.cancel} onPress={onCancel}>
        <Text style={styles.cancelText}>{t('common.cancel')}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = themedStyles((c) =>
  StyleSheet.create({
  scroll: { flexShrink: 1 },
  content: { padding: 20, paddingBottom: 32, gap: 4 },
  title: { color: c.text, fontSize: 22, fontWeight: '800' },
  barcode: { color: c.textSecondary, fontSize: 13, marginBottom: 8 },
  field: { marginTop: 10 },
  label: { color: c.textSecondary, fontSize: 13, marginBottom: 6 },
  input: {
    backgroundColor: c.card,
    color: c.text,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 18,
  },
  toggle: { marginTop: 18, backgroundColor: c.input, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleText: { color: c.text, fontSize: 15, fontWeight: '700' },
  microBox: { backgroundColor: c.card2, borderRadius: 16, padding: 14, marginTop: 10 },
  microHint: { color: c.textMuted, fontSize: 12 },
  save: { backgroundColor: c.accent, borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginTop: 20 },
  saveDisabled: { backgroundColor: c.accentDisabled },
  saveText: { color: c.onAccent, fontSize: 18, fontWeight: '800' },
  cancel: { alignItems: 'center', paddingTop: 16 },
  cancelText: { color: c.textSecondary, fontSize: 15 },
}),
);
