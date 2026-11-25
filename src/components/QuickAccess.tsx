import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { QuickProduct } from '../types';
import { themedStyles } from '../theme/themedStyles';

interface Props {
  frequent: QuickProduct[];
  recent: QuickProduct[];
  onSelect: (p: QuickProduct) => void;
  onCreate: () => void;
}

/** Always visible bottom panel (in normal layout flow, below the camera). */
export function QuickAccess({ frequent, recent, onSelect, onCreate }: Props) {
  const { t } = useTranslation();
  const empty = frequent.length === 0 && recent.length === 0;

  return (
    <View style={styles.wrap}>
      {empty ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>{t('quick.empty_hint')}</Text>
          <Pressable style={styles.createBtn} onPress={onCreate}>
            <Text style={styles.createText}>{t('quick.add_own')}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Row title={t('quick.frequent')} items={frequent} onSelect={onSelect} unit={t('units.g')} />
          <Row title={t('quick.recent')} items={recent} onSelect={onSelect} unit={t('units.g')} />
        </>
      )}
    </View>
  );
}

function Row({
  title,
  items,
  onSelect,
  unit,
}: {
  title: string;
  items: QuickProduct[];
  onSelect: (p: QuickProduct) => void;
  unit: string;
}) {
  if (items.length === 0) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {items.map((p) => (
          <Pressable key={p.barcode} style={styles.chip} onPress={() => onSelect(p)}>
            <Text style={styles.chipName} numberOfLines={1}>
              {p.name}
            </Text>
            {p.usual_weight_g !== null && (
              <Text style={styles.chipMeta}>
                {Math.round(p.usual_weight_g)} {unit}
              </Text>
            )}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = themedStyles((c) =>
  StyleSheet.create({
  wrap: { paddingVertical: 8, minHeight: 96, justifyContent: 'center' },
  row: { marginVertical: 3 },
  title: { color: c.text, fontSize: 12, fontWeight: '700', marginLeft: 14, marginBottom: 4, opacity: 0.8 },
  chip: {
    backgroundColor: c.card,
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginLeft: 10,
    maxWidth: 200,
  },
  chipName: { color: c.text, fontSize: 14, fontWeight: '700' },
  chipMeta: { color: c.textSecondary, fontSize: 11, marginTop: 1 },
  emptyBox: { paddingHorizontal: 16, alignItems: 'center' },
  emptyText: { color: c.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: 10 },
  createBtn: { backgroundColor: c.accent, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 24 },
  createText: { color: c.onAccent, fontSize: 16, fontWeight: '800' },
}),
);
