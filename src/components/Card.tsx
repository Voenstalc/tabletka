import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { cardShadow, colors, radius, spacing } from '@/constants/theme';

type Props = {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  muted?: boolean;
  padding?: number;
};

export function Card({ children, style, muted = false, padding = spacing.lg }: Props) {
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: muted ? colors.cardMuted : colors.card, padding },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...cardShadow,
  },
});
