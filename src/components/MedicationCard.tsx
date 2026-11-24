import { Pressable, StyleSheet, View } from 'react-native';
import type { Medication } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { StockBar } from '@/components/StockBar';
import { colors, radius, spacing } from '@/constants/theme';
import { scheduleSummary } from '@/lib/schedule';
import { formLabel } from '@/lib/stock';

type Props = {
  med: Medication;
  now: number;
  nextDose?: string;
  onPress: () => void;
};

export function MedicationCard({ med, now, nextDose, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${med.name}, ${med.dosage}. Открыть карточку`}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <Card style={styles.card}>
        <View style={styles.header}>
          <View style={[styles.avatar, { backgroundColor: med.color }]}>
            <AppText variant="h1" color={colors.white} weight="800">
              {med.name.trim().charAt(0).toUpperCase() || '?'}
            </AppText>
          </View>
          <View style={styles.titleBlock}>
            <AppText variant="h2" numberOfLines={2}>
              {med.name}
            </AppText>
            <AppText variant="small" color={colors.textSecondary}>
              {[med.dosage, formLabel(med.form)].filter(Boolean).join(' · ')}
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={24} color={colors.textMuted} />
        </View>

        <View style={styles.scheduleRow}>
          <Ionicons name="calendar-outline" size={19} color={colors.textSecondary} />
          <AppText variant="small" color={colors.textSecondary} style={styles.scheduleText}>
            {scheduleSummary(med)}
          </AppText>
        </View>

        {!!nextDose && (
          <View style={styles.nextRow}>
            <Ionicons name="alarm-outline" size={19} color={colors.primary} />
            <AppText variant="small" weight="700" color={colors.primary}>
              Ближайший приём: {nextDose}
            </AppText>
          </View>
        )}

        <View style={styles.stock}>
          <StockBar med={med} now={now} compact />
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md, gap: spacing.md },
  pressed: { opacity: 0.75 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: { flex: 1, gap: 2 },
  scheduleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  scheduleText: { flex: 1 },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stock: { marginTop: 2 },
});
