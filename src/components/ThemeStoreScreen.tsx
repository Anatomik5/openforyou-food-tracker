import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeContext';
import { themedStyles } from '../theme/themedStyles';
import { THEME_ORDER, THEMES, type Colors } from '../theme/themes';
import { Icon, IconBadge } from './Icon';

interface Props {
  visible: boolean;
  onClose: () => void;
}

/** "Themes" screen: every theme is free and can be applied right away. */
export function ThemeStoreScreen({ visible, onClose }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { themeName, colors: c, setTheme } = useTheme();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10}>
            <IconBadge name="arrow-left" size={18} box={40} />
          </Pressable>
          <Text style={styles.title}>{t('themes.title')}</Text>
        </View>

        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.grid}>
            {THEME_ORDER.map((name) => {
              const active = name === themeName;
              return (
                <View key={name} style={[styles.themeCard, active && { borderColor: c.accent }]}>
                  <ThemePreview colors={THEMES[name].colors} />
                  <Text style={styles.themeName}>{t(`themes.${name}`)}</Text>
                  <Pressable
                    style={[styles.applyBtn, active && styles.applyBtnActive]}
                    onPress={() => setTheme(name)}
                    disabled={active}
                  >
                    {active && <Icon name="check" size={15} color={c.accentSoftText} />}
                    <Text style={[styles.applyText, active && styles.applyTextActive]}>
                      {active ? t('themes.applied') : t('themes.apply')}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

/** Mini mock-up of the interface in the colours of a theme. */
function ThemePreview({ colors: p }: { colors: Colors }) {
  return (
    <View style={[previewStyles.frame, { backgroundColor: p.bg, borderColor: p.border }]}>
      <View style={[previewStyles.card, { backgroundColor: p.card, borderColor: p.border }]}>
        <View style={[previewStyles.line, { width: '55%', backgroundColor: p.text, opacity: 0.8 }]} />
        <View style={[previewStyles.track, { backgroundColor: p.track }]}>
          <View style={[previewStyles.fill, { width: '68%', backgroundColor: p.progress.kcal }]} />
        </View>
        <View style={[previewStyles.track, { backgroundColor: p.track }]}>
          <View style={[previewStyles.fill, { width: '42%', backgroundColor: p.progress.protein }]} />
        </View>
        <View style={[previewStyles.track, { backgroundColor: p.track }]}>
          <View style={[previewStyles.fill, { width: '55%', backgroundColor: p.progress.carbs }]} />
        </View>
      </View>
      <View style={[previewStyles.button, { backgroundColor: p.accent }]}>
        <View style={[previewStyles.line, { width: '40%', backgroundColor: p.onAccent }]} />
      </View>
      <View style={[previewStyles.tabs, { backgroundColor: p.tabBar, borderColor: p.tabBorder }]}>
        <View style={[previewStyles.dot, { backgroundColor: p.accent }]} />
        <View style={[previewStyles.dot, { backgroundColor: p.textMuted }]} />
        <View style={[previewStyles.dot, { backgroundColor: p.textMuted }]} />
      </View>
    </View>
  );
}

const previewStyles = StyleSheet.create({
  frame: { borderRadius: 14, borderWidth: 1, padding: 8, gap: 7 },
  card: { borderRadius: 10, borderWidth: 1, padding: 8, gap: 6 },
  line: { height: 6, borderRadius: 3 },
  track: { height: 5, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  button: { borderRadius: 10, height: 24, alignItems: 'center', justifyContent: 'center' },
  tabs: { borderRadius: 8, borderWidth: 1, paddingVertical: 5, flexDirection: 'row', justifyContent: 'space-around' },
  dot: { width: 8, height: 8, borderRadius: 4 },
});

const styles = themedStyles((c) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingBottom: 8 },
    title: { color: c.text, fontSize: 22, fontWeight: '800', flex: 1 },
    content: { paddingHorizontal: 20, paddingTop: 12 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    themeCard: {
      width: '47.5%',
      flexGrow: 1,
      backgroundColor: c.card,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: c.border,
      padding: 12,
      gap: 10,
    },
    themeName: { color: c.text, fontSize: 16, fontWeight: '800', marginTop: 2 },
    applyBtn: {
      backgroundColor: c.accent,
      borderRadius: 14,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 6,
    },
    applyBtnActive: { backgroundColor: c.accentSoft },
    applyText: { color: c.onAccent, fontSize: 14, fontWeight: '800' },
    applyTextActive: { color: c.accentSoftText },
  }),
);
