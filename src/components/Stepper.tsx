import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { colors, hitSlop, spacing } from '@/constants/theme';
import { formatNumber } from '@/lib/date';

type Props = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  hint?: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function Stepper({
  label,
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  suffix,
  hint,
}: Props) {
  const round = (raw: number) => Number(clamp(raw, min, max).toFixed(2));
  const decrease = () => onChange(round(value - step));
  const increase = () => onChange(round(value + step));
  return (
    <View style={styles.wrapper}>
      <View style={styles.texts}>
        <AppText variant="label">{label}</AppText>
        {!!hint && (
          <AppText variant="tiny" color={colors.textMuted}>
            {hint}
          </AppText>
        )}
      </View>
      <View style={styles.controls}>
        <Pressable
          onPress={decrease}
          disabled={value <= min}
          accessibilityRole="button"
          accessibilityLabel={`Уменьшить: ${label}`}
          hitSlop={hitSlop}
          style={({ pressed }) => [
            styles.button,
            (pressed || value <= min) && styles.buttonPressed,
            value <= min && styles.disabled,
          ]}
        >
          <Ionicons name="remove" size={28} color={colors.primary} />
        </Pressable>
        <View style={styles.valueBox}>
          <AppText variant="h2" weight="800" numberOfLines={1}>
            {formatNumber(value)}
            {suffix ? <AppText variant="small" color={colors.textSecondary}> {suffix}</AppText> : null}
          </AppText>
        </View>
        <Pressable
          onPress={increase}
          disabled={value >= max}
          accessibilityRole="button"
          accessibilityLabel={`Увеличить: ${label}`}
          hitSlop={hitSlop}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
            value >= max && styles.disabled,
          ]}
        >
          <Ionicons name="add" size={28} color={colors.primary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  texts: { flex: 1, gap: 2 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  button: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: { backgroundColor: '#D5E2FC' },
  disabled: { opacity: 0.35 },
  valueBox: { minWidth: 74, alignItems: 'center' },
});
