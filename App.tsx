import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import PagerView from 'react-native-pager-view';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { initLanguage } from './src/i18n';
import {
  addDiaryEntry,
  DEFAULT_GOALS,
  getFrequentProducts,
  getGoals,
  getRecentProducts,
  initDatabase,
} from './src/db';
import { scaleNutrients } from './src/nutrition';
import { ProductSheet } from './src/components/ProductSheet';
import { DiaryScreen } from './src/components/DiaryScreen';
import { SearchScreen } from './src/components/SearchScreen';
import { ProfileScreen } from './src/components/ProfileScreen';
import { CameraModal } from './src/components/CameraModal';
import { IconBadge, type IconName } from './src/components/Icon';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import type { Product, ProductSource, QuickProduct, UserGoals } from './src/types';
import { themedStyles } from './src/theme/themedStyles';

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Root />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const TABS = [
  { key: 'today', icon: 'calendar', label: 'tabs.today' },
  { key: 'search', icon: 'search', label: 'tabs.search' },
  { key: 'profile', icon: 'user', label: 'tabs.profile' },
] as const satisfies readonly { key: string; icon: IconName; label: string }[];

function Root() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors, hydrate } = useTheme();
  const pagerRef = useRef<PagerView>(null);
  const [page, setPage] = useState(0);

  const [ready, setReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [initAttempt, setInitAttempt] = useState(0);

  const [product, setProduct] = useState<Product | null>(null);
  const [source, setSource] = useState<ProductSource | null>(null);
  const [initialWeight, setInitialWeight] = useState<number | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  const [goals, setGoals] = useState<UserGoals>(DEFAULT_GOALS);
  const [frequent, setFrequent] = useState<QuickProduct[]>([]);
  const [recent, setRecent] = useState<QuickProduct[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotice = useCallback((text: string) => {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 3000);
  }, []);

  /** Reloads goals + quick lists and tells the diary to reload its day. */
  const refreshAll = useCallback(async () => {
    try {
      const [g, f, r] = await Promise.all([getGoals(), getFrequentProducts(), getRecentProducts()]);
      setGoals(g);
      setFrequent(f);
      setRecent(r);
    } catch {
      showNotice(t('errors.diary_load'));
    }
    setRefreshKey((k) => k + 1);
  }, [showNotice, t]);

  // Open the DB, then apply the saved language, before the first render of the UI.
  useEffect(() => {
    let alive = true;
    setDbError(null);
    (async () => {
      try {
        await initDatabase();
        await initLanguage();
        await hydrate(); // saved theme
        if (alive) setReady(true);
      } catch (e) {
        console.error('DB init failed', e);
        if (alive) setDbError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      alive = false;
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, [initAttempt]);

  useEffect(() => {
    if (ready) refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const openProduct = useCallback((p: Product, s: ProductSource, weight: number | null = null) => {
    setInitialWeight(weight);
    setSource(s);
    setProduct(p);
  }, []);

  const confirmPortion = useCallback(
    async (weight: number) => {
      if (!product) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      try {
        await addDiaryEntry({
          barcode: product.barcode,
          name: product.name,
          weight_g: weight,
          ...scaleNutrients(product, weight),
        });
        await refreshAll();
        setProduct(null);
      } catch {
        showNotice(t('errors.save_failed'));
      }
    },
    [product, refreshAll, showNotice, t],
  );

  const goToTab = (i: number) => {
    Keyboard.dismiss();
    pagerRef.current?.setPage(i);
  };

  if (dbError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errTitle}>{t('errors.db_open')}</Text>
        <Text style={styles.errDetail}>{dbError}</Text>
        <Pressable style={styles.retryBtn} onPress={() => setInitAttempt((n) => n + 1)}>
          <Text style={styles.retryText}>{t('errors.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  if (!ready) return <View style={styles.center} />;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style={colors.statusBar} />

      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        onPageSelected={(e) => {
          Keyboard.dismiss();
          setPage(e.nativeEvent.position);
        }}
      >
        <View key="today" style={styles.page}>
          <DiaryScreen
            goals={goals}
            refreshKey={refreshKey}
            onChanged={refreshAll}
            onScan={() => setCameraOpen(true)}
          />
        </View>
        <View key="search" style={styles.page}>
          <SearchScreen
            frequent={frequent}
            recent={recent}
            onSelectQuick={(p) => openProduct(p, 'local', p.usual_weight_g)}
            onSelect={(p, s) => {
              openProduct(p, s);
              refreshAll();
            }}
          />
        </View>
        <View key="profile" style={styles.page}>
          <ProfileScreen goals={goals} onGoalsChanged={refreshAll} />
        </View>
      </PagerView>

      {notice && (
        <View style={[styles.notice, { bottom: insets.bottom + 90 }]} pointerEvents="none">
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      )}

      {/* Bottom tab bar: kept clear of Android system navigation buttons */}
      <View style={[styles.tabBar, { paddingBottom: insets.bottom + 12 }]}>
        {TABS.map((tab, i) => (
          <Pressable key={tab.key} style={styles.tab} onPress={() => goToTab(i)}>
            <IconBadge name={tab.icon} size={19} box={42} radius={15} tone={page === i ? 'accent' : 'neutral'} />
            <Text style={[styles.tabLabel, page === i && styles.tabLabelActive]} numberOfLines={1}>
              {t(tab.label)}
            </Text>
          </Pressable>
        ))}
      </View>

      <ProductSheet
        product={product}
        source={source}
        initialWeight={initialWeight}
        onConfirm={confirmPortion}
        onCancel={() => setProduct(null)}
      />
      <CameraModal visible={cameraOpen} onClose={() => setCameraOpen(false)} onCommitted={refreshAll} />
    </View>
  );
}

const styles = themedStyles((c) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  pager: { flex: 1 },
  page: { flex: 1 },
  center: { flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errTitle: { color: c.text, fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  errDetail: { color: c.dangerText, fontSize: 13, marginBottom: 20, textAlign: 'center' },
  retryBtn: { backgroundColor: c.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  retryText: { color: c.onAccent, fontSize: 16, fontWeight: '600' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: c.card2,
    borderTopWidth: 1,
    borderTopColor: c.border,
    paddingTop: 10,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  tabLabel: { color: c.textMuted, fontSize: 12, fontWeight: '600' },
  tabLabelActive: { color: c.text, fontWeight: '800' },
  notice: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    maxWidth: '88%',
  },
  noticeText: { color: '#fff', fontSize: 14, textAlign: 'center' },
}),
);
