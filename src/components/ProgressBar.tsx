import { StyleSheet, View } from 'react-native';
import { colors } from '@/constants/theme';

type Props = {
  value: number;
  color?: string;
  height?: number;
  background?: string;
};

export function ProgressBar({ value, color = colors.primary, height = 12, background }: Props) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <View
      style={[styles.track, { height, backgroundColor: background ?? colors.cardMuted }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      <View
        style={[
          styles.fill,
          { width: `${clamped * 100}%`, backgroundColor: color, height, borderRadius: height / 2 },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: 999,
  },
});
