import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { colors, hitSlop, radius, spacing } from '@/constants/theme';
import { addDaysToKey, dateKey, formatDateKeyRu, parseDateKey, startOfToday } from '@/lib/date';

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  hint?: string;
};

function relativeLabel(value: string): string | null {
  const today = startOfToday();
  const target = parseDateKey(value);
  const diff = Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (diff === 0) return 'сегодня';
  if (diff === 1) return 'завтра';
  if (diff === 2) return 'послезавтра';
  if (diff === -1) return 'вчера';
  return null;
}

export function DateField({ label, value, onChange, min, max, hint }: Props) {
  const relative = relativeLabel(value);
  const canGoBack = !min || value > min;
  const canGoForward = !max || value < max;
  return (
    <View style={styles.wrapper}>
      <AppText variant="label">{label}</AppText>
      <View style={styles.row}>
        <Pressable
          onPress={() => onChange(addDaysToKey(value, -1))}
          disabled={!canGoBack}
          accessibilityRole="button"
          accessibilityLabel={`${label}: предыдущий день`}
          hitSlop={hitSlop}
          style={({ pressed }) => [styles.arrow, pressed && styles.pressed, !canGoBack && styles.disabled]}
        >
          <Ionicons name="chevron-back" size={26} color={colors.primary} />
        </Pressable>
        <View style={styles.center}>
          <AppText variant="h2">{formatDateKeyRu(value, true)}</AppText>
          {!!relative && (
            <AppText variant="tiny" color={colors.textMuted}>
              {relative}
            </AppText>
          )}
        </View>
        <Pressable
          onPress={() => onChange(addDaysToKey(value, 1))}
          disabled={!canGoForward}
          accessibilityRole="button"
          accessibilityLabel={`${label}: следующий день`}
          hitSlop={hitSlop}
          style={({ pressed }) => [styles.arrow, pressed && styles.pressed, !canGoForward && styles.disabled]}
        >
          <Ionicons name="chevron-forward" size={26} color={colors.primary} />
        </Pressable>
      </View>
      {!!hint && (
        <AppText variant="tiny" color={colors.textMuted}>
          {hint}
        </AppText>
      )}
    </View>
  );
}

export function DateQuickPicks({
  count,
  onPick,
  label = 'Быстрый выбор',
}: {
  count: number[];
  onPick: (days: number) => void;
  label?: string;
}) {
  return (
    <View style={styles.quick}>
      <AppText variant="tiny" color={colors.textMuted}>
        {label}
      </AppText>
      <View style={styles.quickRow}>
        {count.map((days) => (
          <Pressable
            key={days}
            onPress={() => onPick(days)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.quickChip, pressed && styles.pressed]}
          >
            <AppText variant="tiny" weight="700" color={colors.primaryDark}>
              {days} дней
            </AppText>
          </Pressable>
        ))}
        <Pressable
          onPress={() => onPick(0)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.quickChip, pressed && styles.pressed]}
        >
          <AppText variant="tiny" weight="700" color={colors.primaryDark}>
            Сегодня
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

export function todayKey(): string {
  return dateKey(new Date());
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.lg, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    padding: 6,
  },
  arrow: {
    width: 50,
    height: 52,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center', gap: 1 },
  pressed: { opacity: 0.65 },
  disabled: { opacity: 0.3 },
  quick: { gap: 6 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
});
