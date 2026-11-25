import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { processBarcode } from '../scannerService';
import { addDiaryEntry, saveProduct } from '../db';
import { scaleNutrients } from '../nutrition';
import { CreateProductForm } from './CreateProductForm';
import { ProductSheet } from './ProductSheet';
import { Icon, IconBadge } from './Icon';
import { useTheme } from '../theme/ThemeContext';
import type { Product, ProductSource } from '../types';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Called after entries were written to the diary. */
  onCommitted: () => void;
}

interface QueueItem {
  id: number;
  product: Product;
  weightText: string;
}

const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e'] as const;
const RESUME_DELAY_MS = 1000;
const SAME_CODE_BLOCK_MS = 4000;

const parseWeight = (s: string) => {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 5000) : 0;
};

export function CameraModal({ visible, onClose, onCommitted }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [cooling, setCooling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  // Product waiting for confirmation (camera is paused while it is set).
  const [pending, setPending] = useState<Product | null>(null);
  const [pendingSource, setPendingSource] = useState<ProductSource>('local');
  // Barcode that is neither in SQLite nor in Open Food Facts: manual binding form.
  const [bindBarcode, setBindBarcode] = useState<string | null>(null);

  const nextId = useRef(1);
  const lastHandled = useRef<{ barcode: string; at: number } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };

  // Fresh session every time the camera is opened.
  useEffect(() => {
    if (visible) {
      setQueue([]);
      setBusy(false);
      setCooling(false);
      setFlash(null);
      setPending(null);
      setBindBarcode(null);
      lastHandled.current = null;
    }
  }, [visible]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const showFlash = (text: string) => {
    setFlash(text);
    later(() => setFlash(null), 2500);
  };

  /** Resume scanning after a short pause; the same code is ignored for a few seconds. */
  const resume = (barcode: string) => {
    lastHandled.current = { barcode, at: Date.now() };
    setCooling(true);
    later(() => setCooling(false), RESUME_DELAY_MS);
  };

  const scanningEnabled = visible && !busy && !cooling && !saving && !pending && !bindBarcode;

  const onBarcodeScanned = useCallback(
    async ({ data }: BarcodeScanningResult) => {
      if (!scanningEnabled) return;
      const last = lastHandled.current;
      if (last && last.barcode === data && Date.now() - last.at < SAME_CODE_BLOCK_MS) return;

      setBusy(true);
      const result = await processBarcode(data, () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      });
      setBusy(false);

      switch (result.status) {
        case 'found':
          setPendingSource(result.source);
          setPending(result.product); // camera pauses until the user decides
          break;
        case 'not_found':
          setBindBarcode(result.barcode);
          break;
        case 'error':
          showFlash(t(`errors.${result.code}`));
          resume(data);
          break;
        case 'ignored':
          break;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scanningEnabled, t],
  );

  // --- pending card actions ---
  const addToList = (weight: number) => {
    if (!pending) return;
    const p = pending;
    setQueue((q) => [...q, { id: nextId.current++, product: p, weightText: String(weight) }]);
    setPending(null);
    resume(p.barcode);
  };

  const skip = () => {
    if (pending) resume(pending.barcode);
    setPending(null);
  };

  const setWeight = (id: number, weightText: string) =>
    setQueue((q) => q.map((i) => (i.id === id ? { ...i, weightText } : i)));
  const removeItem = (id: number) => setQueue((q) => q.filter((i) => i.id !== id));

  const writeAll = async (items: { product: Product; weight: number }[]) => {
    setSaving(true);
    try {
      for (const { product: p, weight } of items) {
        await addDiaryEntry({
          barcode: p.barcode,
          name: p.name,
          weight_g: weight,
          ...scaleNutrients(p, weight),
        });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setQueue([]);
      setPending(null);
      onCommitted();
      onClose();
    } catch {
      showFlash(t('errors.save_failed'));
    } finally {
      setSaving(false);
    }
  };

  const queued = queue.map((i) => ({ product: i.product, weight: parseWeight(i.weightText) }));
  const totalKcal = queued.reduce((s, i) => s + scaleNutrients(i.product, i.weight).kcal, 0);
  const canCommit = queue.length > 0 && queued.every((i) => i.weight > 0) && !saving;

  /** Logs the open product together with everything already confirmed, then closes the camera. */
  const logNow = (weight: number) => {
    if (!pending) return;
    writeAll([...queued.filter((i) => i.weight > 0), { product: pending, weight }]);
  };

  const requestClose = () => {
    if (queue.length === 0) return onClose();
    Alert.alert(t('scan.discard_title'), t('scan.discard_body', { count: queue.length }), [
      { text: t('scan.keep'), style: 'cancel' },
      { text: t('scan.discard_ok'), style: 'destructive', onPress: onClose },
    ]);
  };

  // --- manual binding of an unknown barcode ---
  const bindSave = async (p: Product) => {
    try {
      await saveProduct(p); // permanently tied to the scanned barcode
      setBindBarcode(null);
      setPendingSource('local');
      setPending(p);
    } catch {
      showFlash(t('errors.save_failed'));
    }
  };

  const g = t('units.g');
  const kcalU = t('units.kcal');

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={requestClose} statusBarTranslucent>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        {!permission ? (
          <View style={styles.center} />
        ) : !permission.granted ? (
          <View style={styles.center}>
            <Text style={styles.permText}>{t('camera.permission')}</Text>
            <Pressable style={styles.permBtn} onPress={requestPermission}>
              <Text style={styles.permBtnText}>{t('camera.allow')}</Text>
            </Pressable>
            <Pressable style={styles.closeLink} onPress={onClose}>
              <Text style={styles.closeLinkText}>{t('scan.close')}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.header}>
              <IconBadge name={bindBarcode ? 'link' : 'maximize'} tone="accent" size={17} box={34} />
              <Text style={styles.title}>{bindBarcode ? t('scan.bind_title') : t('scan.title')}</Text>
              <Text style={styles.count}>{queue.length}</Text>
            </View>

            {/* Camera box: its own clipped area, nothing is drawn under the SurfaceView */}
            <View style={[styles.cameraZone, bindBarcode ? styles.cameraSmall : null]}>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                active={!pending && !bindBarcode}
                barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
                onBarcodeScanned={scanningEnabled ? onBarcodeScanned : undefined}
              />
              <View style={styles.overlay} pointerEvents="none">
                <View style={styles.frame}>
                  <View style={[styles.corner, styles.tl]} />
                  <View style={[styles.corner, styles.tr]} />
                  <View style={[styles.corner, styles.bl]} />
                  <View style={[styles.corner, styles.br]} />
                  {busy && <ActivityIndicator size="large" color="#fff" />}
                </View>
              </View>
            </View>

            {bindBarcode ? (
              <View style={[styles.bindWrap, { backgroundColor: colors.bg }]}>
                <CreateProductForm
                  barcode={bindBarcode}
                  saveLabel={t('create.save_add')}
                  onSave={bindSave}
                  onCancel={() => {
                    resume(bindBarcode);
                    setBindBarcode(null);
                  }}
                />
              </View>
            ) : (
              <>
                {flash ? (
                  <Text style={styles.flash} numberOfLines={1}>
                    {flash}
                  </Text>
                ) : (
                  <Text style={styles.hint}>{t('camera.hint')}</Text>
                )}

                {/* Confirmed products of this session */}
                <View style={styles.panel}>
                  <FlatList
                    style={styles.list}
                    data={queue}
                    keyExtractor={(i) => String(i.id)}
                    keyboardShouldPersistTaps="handled"
                    ListEmptyComponent={<Text style={styles.empty}>{t('scan.empty')}</Text>}
                    renderItem={({ item }) => {
                      const w = parseWeight(item.weightText);
                      return (
                        <View style={styles.item}>
                          <View style={styles.itemInfo}>
                            <Text style={styles.itemName} numberOfLines={1}>
                              {item.product.name}
                            </Text>
                            <Text style={styles.itemKcal}>
                              {scaleNutrients(item.product, w).kcal} {kcalU}
                            </Text>
                          </View>
                          <TextInput
                            style={styles.weightInput}
                            value={item.weightText}
                            onChangeText={(s) => setWeight(item.id, s.replace(/[^0-9.,]/g, ''))}
                            keyboardType="decimal-pad"
                            selectTextOnFocus
                            maxLength={6}
                          />
                          <Text style={styles.unit}>{g}</Text>
                          <Pressable style={styles.remove} onPress={() => removeItem(item.id)} hitSlop={8}>
                            <Icon name="x" size={15} tone="danger" />
                          </Pressable>
                        </View>
                      );
                    }}
                  />

                  <Pressable style={[styles.addAll, !canCommit && styles.addAllOff]} onPress={() => writeAll(queued)} disabled={!canCommit}>
                    <Text style={styles.addAllText}>{t('scan.add_all', { kcal: totalKcal })}</Text>
                  </Pressable>
                  <Pressable style={styles.closeLink} onPress={requestClose}>
                    <Text style={styles.closeLinkText}>{t('scan.close')}</Text>
                  </Pressable>
                </View>
              </>
            )}
          </>
        )}

        {/* Confirmation card (separate window, always above the camera) */}
        <ProductSheet
          product={pending}
          source={pendingSource}
          primaryLabel={() => t('scan.add_to_list')}
          extraActions={[{ label: t('scan.log_now'), onPress: logNow }]}
          cancelLabel={t('scan.skip')}
          onConfirm={addToList}
          onCancel={skip}
        />
      </SafeAreaView>
    </Modal>
  );
}

const CORNER = 26;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  permText: { color: '#fff', fontSize: 16, textAlign: 'center', marginBottom: 16 },
  permBtn: { backgroundColor: '#2e7d32', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  permBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 8 },
  title: { color: '#fff', fontSize: 18, fontWeight: '800', flex: 1 },
  count: { color: '#000', backgroundColor: '#ffb300', fontSize: 14, fontWeight: '800', paddingHorizontal: 10, paddingVertical: 2, borderRadius: 10, overflow: 'hidden' },
  cameraZone: { flex: 1, minHeight: 120, overflow: 'hidden', borderRadius: 20, marginHorizontal: 8, backgroundColor: '#111' },
  cameraSmall: { flex: 0, height: 90, minHeight: 90 },
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  frame: { width: 240, height: 120, alignItems: 'center', justifyContent: 'center' },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: '#fff' },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 12 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 12 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 12 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 12 },
  hint: { color: '#aaa', fontSize: 13, textAlign: 'center', paddingVertical: 6 },
  flash: { color: '#ffcdd2', backgroundColor: '#3a2020', fontSize: 14, fontWeight: '700', textAlign: 'center', marginHorizontal: 12, marginVertical: 4, paddingVertical: 6, borderRadius: 10, overflow: 'hidden' },
  bindWrap: { maxHeight: '70%', flexShrink: 1 },
  panel: { maxHeight: '40%', paddingHorizontal: 12, paddingBottom: 8 },
  list: { flexGrow: 0 },
  empty: { color: '#888', textAlign: 'center', paddingVertical: 12, fontSize: 14 },
  item: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e1e1e', borderRadius: 14, padding: 10, marginBottom: 6, gap: 6 },
  itemInfo: { flex: 1 },
  itemName: { color: '#fff', fontSize: 14, fontWeight: '700' },
  itemKcal: { color: '#ffb300', fontSize: 13, fontWeight: '700', marginTop: 2 },
  weightInput: { width: 68, backgroundColor: '#2c2c2c', color: '#fff', borderRadius: 10, paddingVertical: 6, paddingHorizontal: 6, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  unit: { color: '#aaa', fontSize: 13 },
  remove: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#3a2a2a', alignItems: 'center', justifyContent: 'center' },
  addAll: { backgroundColor: '#2e7d32', borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  addAllOff: { backgroundColor: '#2f4a30' },
  addAllText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  closeLink: { alignItems: 'center', paddingVertical: 12 },
  closeLinkText: { color: '#bbb', fontSize: 15, fontWeight: '600' },
});
