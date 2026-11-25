import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { saveProduct, searchLocalProducts } from '../db';
import { searchOpenFoodFacts } from '../scannerService';
import { CreateProductForm } from './CreateProductForm';
import { QuickAccess } from './QuickAccess';
import { Icon } from './Icon';
import { useTheme } from '../theme/ThemeContext';
import type { Product, ProductSource, QuickProduct } from '../types';
import { themedStyles } from '../theme/themedStyles';

interface Props {
  frequent: QuickProduct[];
  recent: QuickProduct[];
  onSelectQuick: (p: QuickProduct) => void;
  onSelect: (product: Product, source: ProductSource) => void;
}

type Row = { product: Product; source: ProductSource };

/** "Search & Base" tab: frequent / recent, local + Open Food Facts search, own products. */
export function SearchScreen({ frequent, recent, onSelectQuick, onSelect }: Props) {
  const { t } = useTranslation();
  const { colors: c } = useTheme();
  const [query, setQuery] = useState('');
  const [local, setLocal] = useState<Product[]>([]);
  const [remote, setRemote] = useState<Product[] | null>(null);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const requestId = useRef(0);

  // Instant live filter over local products.
  useEffect(() => {
    const id = ++requestId.current;
    setRemote(null);
    setError(null);
    searchLocalProducts(query)
      .then((rows) => {
        if (id === requestId.current) setLocal(rows);
      })
      .catch(() => {});
  }, [query]);

  const searchRemote = async () => {
    const id = requestId.current;
    setRemoteLoading(true);
    setError(null);
    try {
      const rows = await searchOpenFoodFacts(query);
      if (id === requestId.current) setRemote(rows);
    } catch {
      if (id === requestId.current) setError(t('errors.search_failed'));
    } finally {
      setRemoteLoading(false);
    }
  };

  const pickRemote = async (p: Product) => {
    try {
      await saveProduct(p);
      onSelect(p, 'api');
    } catch {
      setError(t('errors.save_failed'));
    }
  };

  const createOwn = async (p: Product) => {
    try {
      await saveProduct(p);
      setCreating(false);
      setQuery('');
      onSelect(p, 'local');
    } catch {
      setError(t('errors.save_failed'));
    }
  };

  const rows: Row[] = [
    ...local.map((product) => ({ product, source: 'local' as const })),
    ...(remote ?? [])
      .filter((p) => !local.some((l) => l.barcode === p.barcode))
      .map((product) => ({ product, source: 'api' as const })),
  ];
  const trimmed = query.trim();

  if (creating) {
    return (
      <View style={styles.screen}>
        <CreateProductForm initialName={trimmed} onSave={createOwn} onCancel={() => setCreating(false)} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{t('tabs.search')}</Text>
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={setQuery}
        placeholder={t('search.placeholder')}
        placeholderTextColor={c.textMuted}
        returnKeyType="search"
        onSubmitEditing={() => trimmed && searchRemote()}
      />

      <Pressable style={styles.createBtn} onPress={() => setCreating(true)}>
        <View style={styles.btnRow}>
          <Icon name="plus" size={18} tone="accent" />
          <Text style={styles.createText}>{t('search.create')}</Text>
        </View>
      </Pressable>

      {trimmed ? (
        <FlatList
          data={rows}
          keyExtractor={(r) => `${r.source}-${r.product.barcode}`}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View>
              <Pressable
                style={[styles.offBtn, remoteLoading && styles.offBtnBusy]}
                onPress={searchRemote}
                disabled={remoteLoading}
              >
                {remoteLoading ? (
                  <ActivityIndicator color={c.onAccent} />
                ) : (
                  <View style={styles.btnRow}>
                    <Icon name="globe" size={17} color={c.onAccent} />
                    <Text style={styles.offBtnText}>{t('search.off_button')}</Text>
                  </View>
                )}
              </Pressable>
              {error && <Text style={styles.error}>{error}</Text>}
              {remote !== null && rows.length === 0 && <Text style={styles.empty}>{t('search.no_results')}</Text>}
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.item}
              onPress={() => (item.source === 'api' ? pickRemote(item.product) : onSelect(item.product, 'local'))}
            >
              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={2}>
                  {item.product.name}
                </Text>
                <Text style={styles.itemMeta} numberOfLines={1}>
                  {[item.product.brand, item.source === 'api' ? t('search.off_results') : null]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              <Text style={styles.itemKcal}>
                {item.product.kcal_100g ?? '—'}
                {'\n'}
                {t('units.kcal')}
              </Text>
            </Pressable>
          )}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          <QuickAccess frequent={frequent} recent={recent} onSelect={onSelectQuick} onCreate={() => setCreating(true)} />
          <Text style={styles.empty}>{t('search.hint')}</Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = themedStyles((c) =>
  StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg, paddingTop: 12 },
  title: { color: c.text, fontSize: 26, fontWeight: '800', paddingHorizontal: 20, marginBottom: 14 },
  input: {
    backgroundColor: c.card,
    color: c.text,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    fontSize: 17,
    marginHorizontal: 20,
  },
  createBtn: {
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: c.accentSoft,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  createText: { color: c.accentSoftText, fontSize: 16, fontWeight: '800' },
  list: { paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 24 },
  offBtn: { backgroundColor: c.info, borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginBottom: 12 },
  offBtnBusy: { opacity: 0.7 },
  offBtnText: { color: c.onAccent, fontSize: 16, fontWeight: '700' },
  error: { color: c.dangerText, textAlign: 'center', marginBottom: 8 },
  empty: { color: c.textMuted, textAlign: 'center', marginVertical: 16, fontSize: 15 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  itemInfo: { flex: 1, paddingRight: 10 },
  itemName: { color: c.text, fontSize: 16, fontWeight: '700' },
  itemMeta: { color: c.textSecondary, fontSize: 12, marginTop: 3 },
  itemKcal: { color: c.warn, fontSize: 14, fontWeight: '800', textAlign: 'center' },
}),
);
