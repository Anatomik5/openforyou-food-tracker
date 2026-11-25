import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';

export type IconName = React.ComponentProps<typeof Feather>['name'];

export type Tone = 'neutral' | 'accent' | 'warm' | 'danger';

/** Bare icon in a muted tone colour (or an explicit colour). */
export function Icon({ name, size = 18, tone = 'neutral', color }: { name: IconName; size?: number; tone?: Tone; color?: string }) {
  const { colors } = useTheme();
  return <Feather name={name} size={size} color={color ?? colors.badge[tone].fg} />;
}

/** Icon inside a rounded badge. */
export function IconBadge({
  name,
  size = 18,
  tone = 'neutral',
  box,
  radius,
}: {
  name: IconName;
  size?: number;
  tone?: Tone;
  box?: number;
  radius?: number;
}) {
  const { colors } = useTheme();
  const side = box ?? size + 18;
  const t = colors.badge[tone];
  return (
    <View
      style={[
        styles.badge,
        { width: side, height: side, borderRadius: radius ?? Math.round(side * 0.34), backgroundColor: t.bg },
      ]}
    >
      <Feather name={name} size={size} color={t.fg} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', justifyContent: 'center' },
});
