import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { scaleNutrients } from '../nutrition';
import { MICROS } from '../micros';
import type { Product, ProductSource } from '../types';
import { themedStyles } from '../theme/themedStyles';

interface Props {
  product: Product | null;
  source: ProductSource | null;
  /** Usual portion (from Frequent / Recent); falls back to pack weight, then 100 g. */
  initialWeight?: number | null;
  onConfirm: (weight: number) => void;
  onCancel: () => void;
  /** Overrides the main button text (default: "Ate it (+X kcal)"). */
  primaryLabel?: (kcal: number) => string;
  /** Overrides the cancel link text. */
  cancelLabel?: string;
  /** Extra secondary buttons shown under the main one. */
  extraActions?: { label: string; onPress: (weight: number) => void }[];
}

const MIN_W = 10;
const MAX_W = 500;
const MAX_INPUT = 5000;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function ProductSheet({
  product,
  source,
  initialWeight,
  onConfirm,
  onCancel,
  primaryLabel,
  cancelLabel,
  extraActions,
}: Props) {
  const { t } = useTranslation();
  const g = t('units.g');
  const insets = useSafeAreaInsets();
  const { colors: c } = useTheme();
  const visible = product !== null;

  // Keep the last product rendered while the sheet slides out.
  const shown = useRef<Product | null>(null);
  if (product) shown.current = product;
  const p = shown.current;
  const isCustom = p?.barcode.startsWith('custom-') ?? false;

  const [weightText, setWeightText] = useState('100');

  useEffect(() => {
    if (product) setWeightText(String(initialWeight ?? product.default_weight_g ?? 100));
  }, [product, initialWeight]);

  const weight = clamp(parseFloat(weightText.replace(',', '.')) || 0, 0, MAX_INPUT);

  const presets = useMemo(() => {
    const pack = p?.default_weight_g;
    if (pack && pack > 0) {
      return [
        { label: `100 ${g}`, grams: 100 },
        { label: t('sheet.half_pack'), grams: Math.round(pack / 2) },
        { label: t('sheet.whole_pack'), grams: Math.round(pack) },
      ];
    }
    return [50, 100, 200].map((n) => ({ label: `${n} ${g}`, grams: n }));
  }, [p, t, g]);

  const sourceLabel = isCustom
    ? t('sheet.source_custom')
    : source === 'local'
      ? t('sheet.source_local')
      : t('sheet.source_api');

  const portion = p ? scaleNutrients(p, weight) : null;
  const microLine = portion
    ? MICROS.filter((m) => portion[m.key] > 0)
        .map((m) => `${t(`micro.${m.key}`)} ${portion[m.key]} ${t(`units.${m.unit}`)}`)
        .join(' · ')
    : '';

  return (
    // A Modal is its own native window, so the camera SurfaceView can never cover it.
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
    <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Pressable style={styles.scrim} onPress={onCancel} />
    <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.handle} />
      {p && portion && (
        <>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.name}>{p.name}</Text>
            <Text style={styles.brand}>
              {p.brand ?? t('sheet.no_brand')}
              {isCustom ? '' : ` · ${p.barcode}`}
            </Text>
            <Text style={styles.meta}>
              {t('sheet.per100')}: {p.kcal_100g ?? '—'} {t('units.kcal')} · {t('nutrients.protein_short')}{' '}
              {p.protein_100g ?? '—'} · {t('nutrients.fat_short')} {p.fat_100g ?? '—'} ·{' '}
              {t('nutrients.carbs_short')} {p.carbs_100g ?? '—'} · {sourceLabel}
            </Text>

            {/* Portion result */}
            <View style={styles.result}>
              <Text style={styles.resultKcal}>
                {portion.kcal} {t('units.kcal')}
              </Text>
              <View style={styles.macroRow}>
                <Macro label={t('nutrients.protein')} value={portion.protein} unit={g} color={c.progress.protein} />
                <Macro label={t('nutrients.fat')} value={portion.fat} unit={g} color={c.progress.fat} />
                <Macro label={t('nutrients.carbs')} value={portion.carbs} unit={g} color={c.progress.carbs} />
              </View>
            </View>

            {/* Micronutrients of this portion (only non-zero ones) */}
            {microLine ? <Text style={styles.microLine}>{microLine}</Text> : null}

            {/* Weight input */}
            <View style={styles.weightRow}>
              <Text style={styles.weightLabel}>{t('sheet.portion')}</Text>
              <TextInput
                style={styles.weightInput}
                value={weightText}
                onChangeText={(t) => setWeightText(t.replace(/[^0-9.,]/g, ''))}
                keyboardType="decimal-pad"
                selectTextOnFocus
                maxLength={6}
              />
              <Text style={styles.weightUnit}>{g}</Text>
            </View>

            <Slider
              style={styles.slider}
              minimumValue={MIN_W}
              maximumValue={MAX_W}
              step={5}
              value={clamp(weight, MIN_W, MAX_W)}
              onValueChange={(v) => setWeightText(String(Math.round(v)))}
              minimumTrackTintColor={c.accent}
              maximumTrackTintColor={c.border}
              thumbTintColor={c.accent}
            />

            <View style={styles.presets}>
              {presets.map((pr) => {
                const active = Math.abs(weight - pr.grams) < 0.5;
                return (
                  <Pressable
                    key={pr.label}
                    style={[styles.preset, active && styles.presetActive]}
                    onPress={() => setWeightText(String(pr.grams))}
                  >
                    <Text style={[styles.presetText, active && styles.presetTextActive]}>{pr.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <Pressable
            style={[styles.eatButton, weight <= 0 && styles.eatDisabled]}
            disabled={weight <= 0}
            onPress={() => onConfirm(weight)}
          >
            <Text style={styles.eatText}>
              {primaryLabel ? primaryLabel(portion.kcal) : t('sheet.eat', { kcal: portion.kcal })}
            </Text>
          </Pressable>
          {extraActions?.map((a) => (
            <Pressable
              key={a.label}
              style={[styles.extra, weight <= 0 && styles.eatDisabled]}
              disabled={weight <= 0}
              onPress={() => a.onPress(weight)}
            >
              <Text style={styles.extraText}>{a.label}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.cancel} onPress={onCancel} hitSlop={8}>
            <Text style={styles.cancelText}>{cancelLabel ?? t('sheet.cancel')}</Text>
          </Pressable>
        </>
      )}
    </View>
    </KeyboardAvoidingView>
    </Modal>
  );
}

function Macro({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <View style={styles.macro}>
      <Text style={[styles.macroValue, { color }]}>
        {value} {unit}
      </Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

const styles = themedStyles((c) =>
  StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  scrim: { ...StyleSheet.absoluteFill },
  sheet: {
    maxHeight: '88%',
    backgroundColor: c.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
    elevation: 16,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.border, marginBottom: 12 },
  name: { fontSize: 20, fontWeight: '700', color: c.text },
  brand: { fontSize: 14, color: c.textSecondary, marginTop: 2 },
  meta: { fontSize: 12, color: c.textMuted, marginTop: 4 },
  microLine: { fontSize: 12, color: c.textMuted, marginTop: 8, textAlign: 'center' },
  result: { backgroundColor: c.card2, borderRadius: 16, padding: 14, marginTop: 14, alignItems: 'center' },
  resultKcal: { fontSize: 38, fontWeight: '800', color: c.text },
  macroRow: { flexDirection: 'row', marginTop: 8, alignSelf: 'stretch' },
  macro: { flex: 1, alignItems: 'center' },
  macroValue: { fontSize: 20, fontWeight: '700' },
  macroLabel: { fontSize: 12, color: c.textSecondary },
  weightRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  weightLabel: { fontSize: 16, color: c.textSecondary, marginRight: 12 },
  weightInput: {
    minWidth: 100,
    borderWidth: 2,
    borderColor: c.accent,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    color: c.text,
  },
  weightUnit: { fontSize: 18, color: c.textSecondary, marginLeft: 8 },
  slider: { height: 44, marginTop: 6 },
  presets: { flexDirection: 'row', gap: 8, marginTop: 2, marginBottom: 6 },
  preset: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: c.input,
    alignItems: 'center',
  },
  presetActive: { backgroundColor: c.accentSoft },
  presetText: { fontSize: 15, fontWeight: '600', color: c.textSecondary },
  presetTextActive: { color: c.accentSoftText },
  eatButton: {
    marginTop: 12,
    backgroundColor: c.accent,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  eatDisabled: { backgroundColor: c.accentDisabled },
  extra: { marginTop: 10, backgroundColor: c.accentSoft, borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
  extraText: { color: c.accentSoftText, fontSize: 16, fontWeight: '800' },
  eatText: { color: c.onAccent, fontSize: 19, fontWeight: '800' },
  cancel: { alignItems: 'center', paddingTop: 14, paddingBottom: 2 },
  cancelText: { color: c.textSecondary, fontSize: 14 },
}),
);
